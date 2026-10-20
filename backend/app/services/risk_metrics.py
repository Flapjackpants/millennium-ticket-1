"""Pure risk metric functions. Inputs are pandas price/return series; no I/O."""

import numpy as np
import pandas as pd

TRADING_DAYS = 252


def log_returns(prices: pd.DataFrame | pd.Series) -> pd.DataFrame | pd.Series:
    return np.log(prices / prices.shift(1)).dropna(how="all")


def annualized_volatility(returns: pd.Series) -> float:
    return float(returns.std(ddof=1) * np.sqrt(TRADING_DAYS))


def annualized_return(returns: pd.Series) -> float:
    return float(returns.mean() * TRADING_DAYS)


def sharpe_ratio(returns: pd.Series, risk_free_rate: float = 0.0) -> float | None:
    vol = annualized_volatility(returns)
    if np.isnan(vol) or vol < 1e-12:
        return None
    return float((annualized_return(returns) - risk_free_rate) / vol)


def beta(returns: pd.Series, benchmark_returns: pd.Series) -> float | None:
    joined = pd.concat([returns, benchmark_returns], axis=1, join="inner").dropna()
    if len(joined) < 2:
        return None
    var_b = joined.iloc[:, 1].var(ddof=1)
    if var_b == 0:
        return None
    cov = joined.iloc[:, 0].cov(joined.iloc[:, 1])
    return float(cov / var_b)


def historical_var(returns: pd.Series, confidence: float = 0.95) -> float:
    """1-day historical VaR as a positive loss fraction."""
    return float(-np.percentile(returns, (1 - confidence) * 100))


def historical_cvar(returns: pd.Series, confidence: float = 0.95) -> float:
    """1-day expected shortfall: mean loss beyond VaR, as a positive fraction."""
    cutoff = np.percentile(returns, (1 - confidence) * 100)
    tail = returns[returns <= cutoff]
    return float(-tail.mean())


def drawdown_series(prices: pd.Series) -> pd.Series:
    running_max = prices.cummax()
    return prices / running_max - 1.0


def max_drawdown(prices: pd.Series) -> float:
    """Most negative drawdown, as a negative fraction (e.g. -0.35)."""
    return float(drawdown_series(prices).min())


def summary(
    prices: pd.Series,
    benchmark_prices: pd.Series | None = None,
    risk_free_rate: float = 0.0,
) -> dict:
    prices = prices.dropna()
    rets = log_returns(prices)
    bench_rets = log_returns(benchmark_prices.dropna()) if benchmark_prices is not None else None
    return {
        "annualized_return": annualized_return(rets),
        "annualized_volatility": annualized_volatility(rets),
        "sharpe_ratio": sharpe_ratio(rets, risk_free_rate),
        "beta": beta(rets, bench_rets) if bench_rets is not None else None,
        "var_95": historical_var(rets, 0.95),
        "var_99": historical_var(rets, 0.99),
        "cvar_95": historical_cvar(rets, 0.95),
        "max_drawdown": max_drawdown(prices),
        "observations": int(len(rets)),
    }


def portfolio_weights(quantities: pd.Series, last_prices: pd.Series) -> pd.Series:
    values = quantities * last_prices
    total = values.sum()
    if total == 0:
        raise ValueError("Portfolio has zero market value")
    return values / total


def portfolio_value_series(prices: pd.DataFrame, quantities: pd.Series) -> pd.Series:
    """Buy-and-hold portfolio value over time for fixed share quantities."""
    aligned = prices[quantities.index].dropna()
    return (aligned * quantities).sum(axis=1)


def risk_contributions(returns: pd.DataFrame, weights: pd.Series) -> pd.Series:
    """Fraction of portfolio volatility contributed by each asset (sums to 1)."""
    cov = returns[weights.index].cov().values
    w = weights.values
    port_var = float(w @ cov @ w)
    if port_var == 0:
        return pd.Series(0.0, index=weights.index)
    contrib = w * (cov @ w) / port_var
    return pd.Series(contrib, index=weights.index)
