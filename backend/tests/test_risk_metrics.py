import numpy as np
import pandas as pd
import pytest

from app.services import risk_metrics as rm


def _prices(returns: list[float], start: float = 100.0) -> pd.Series:
    idx = pd.date_range("2024-01-01", periods=len(returns) + 1, freq="B").date
    return pd.Series(start * np.exp(np.concatenate([[0.0], np.cumsum(returns)])), index=idx)


def test_log_returns_roundtrip():
    rets = [0.01, -0.02, 0.005]
    out = rm.log_returns(_prices(rets))
    assert np.allclose(out.values, rets)


def test_volatility_of_constant_returns_is_zero():
    rets = rm.log_returns(_prices([0.001] * 50))
    assert rm.annualized_volatility(rets) == pytest.approx(0.0, abs=1e-12)
    assert rm.sharpe_ratio(rets) is None


def test_annualized_volatility_scaling():
    rng = np.random.default_rng(0)
    daily = rng.normal(0, 0.01, 5000)
    vol = rm.annualized_volatility(pd.Series(daily))
    assert vol == pytest.approx(0.01 * np.sqrt(252), rel=0.05)


def test_beta_of_scaled_series():
    rng = np.random.default_rng(1)
    bench = pd.Series(rng.normal(0, 0.01, 500))
    asset = 1.5 * bench
    assert rm.beta(asset, bench) == pytest.approx(1.5)


def test_var_and_cvar():
    rets = pd.Series(np.linspace(-0.10, 0.09, 20))  # step 0.01
    var95 = rm.historical_var(rets, 0.95)
    cvar95 = rm.historical_cvar(rets, 0.95)
    assert var95 == pytest.approx(-np.percentile(rets, 5))
    assert cvar95 >= var95


def test_max_drawdown():
    idx = pd.date_range("2024-01-01", periods=5, freq="B").date
    prices = pd.Series([100, 120, 90, 110, 60], index=idx, dtype=float)
    assert rm.max_drawdown(prices) == pytest.approx(60 / 120 - 1)


def test_weights_and_value_series():
    idx = pd.date_range("2024-01-01", periods=3, freq="B").date
    prices = pd.DataFrame({"A": [10.0, 11.0, 12.0], "B": [20.0, 20.0, 18.0]}, index=idx)
    qty = pd.Series({"A": 10.0, "B": 5.0})
    w = rm.portfolio_weights(qty, prices.iloc[-1])
    assert w.sum() == pytest.approx(1.0)
    assert w["A"] == pytest.approx(120 / 210)
    values = rm.portfolio_value_series(prices, qty)
    assert list(values) == [200.0, 210.0, 210.0]


def test_risk_contributions_sum_to_one():
    rng = np.random.default_rng(2)
    rets = pd.DataFrame(rng.normal(0, 0.01, (300, 3)), columns=["A", "B", "C"])
    w = pd.Series({"A": 0.5, "B": 0.3, "C": 0.2})
    contrib = rm.risk_contributions(rets, w)
    assert contrib.sum() == pytest.approx(1.0)


def test_summary_keys():
    rng = np.random.default_rng(3)
    p = _prices(list(rng.normal(0, 0.01, 260)))
    b = _prices(list(rng.normal(0, 0.01, 260)))
    s = rm.summary(p, b)
    assert set(s) == {
        "annualized_return", "annualized_volatility", "sharpe_ratio", "beta",
        "var_95", "var_99", "cvar_95", "max_drawdown", "observations",
    }
    assert s["observations"] == 260
