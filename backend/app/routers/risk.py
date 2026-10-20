import hashlib
import math
from datetime import date

import pandas as pd
from cachetools import TTLCache
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.auth import get_current_user_id
from app.config import get_settings
from app.routers.portfolios import get_owned_portfolio
from app.services import risk_metrics as rm
from app.services.market_data import (
    PERIOD_DAYS,
    TickerNotFound,
    get_prices,
    get_ticker_info,
    lookup_ticker,
)

router = APIRouter(tags=["risk"])

PeriodParam = Query("1y", pattern="^(" + "|".join(PERIOD_DAYS) + ")$")
BenchmarkParam = Query("SPY", min_length=1, max_length=15)

# Computed portfolio risk, keyed on holdings content so edits invalidate it.
_portfolio_risk_cache: TTLCache = TTLCache(maxsize=1000, ttl=300)


def _clean(v):
    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
        return None
    return v


def _clean_dict(d: dict) -> dict:
    return {k: _clean(v) for k, v in d.items()}


def _series(s: pd.Series) -> list[dict]:
    return [{"date": d.isoformat(), "value": _clean(float(v))} for d, v in s.dropna().items()]


def _load_prices(tickers: list[str], period: str) -> pd.DataFrame:
    try:
        return get_prices(tickers, period)
    except TickerNotFound as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(e))
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))


@router.get("/tickers/search")
def search_ticker(
    q: str = Query(min_length=1, max_length=15), _: str = Depends(get_current_user_id)
) -> dict:
    try:
        return lookup_ticker(q)
    except TickerNotFound as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(e))


@router.get("/tickers/{symbol}/risk")
def ticker_risk(
    symbol: str,
    period: str = PeriodParam,
    benchmark: str = BenchmarkParam,
    _: str = Depends(get_current_user_id),
) -> dict:
    symbol, benchmark = symbol.upper(), benchmark.upper()
    prices = _load_prices([symbol, benchmark], period)
    px = prices[symbol].dropna()
    metrics = rm.summary(px, prices[benchmark], get_settings().risk_free_rate)
    return {
        "ticker": symbol,
        "info": get_ticker_info(symbol),
        "period": period,
        "benchmark": benchmark,
        "metrics": _clean_dict(metrics),
        "prices": _series(px),
        "drawdown": _series(rm.drawdown_series(px)),
    }


@router.get("/portfolios/{portfolio_id}/risk")
def portfolio_risk(
    portfolio_id: str,
    period: str = PeriodParam,
    benchmark: str = BenchmarkParam,
    user_id: str = Depends(get_current_user_id),
) -> dict:
    portfolio = get_owned_portfolio(portfolio_id, user_id)
    holdings = portfolio["holdings"]
    if not holdings:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Portfolio has no holdings")

    benchmark = benchmark.upper()
    fingerprint = hashlib.sha1(
        repr([(h["ticker"], h["quantity"]) for h in holdings]).encode()
    ).hexdigest()
    cache_key = (portfolio_id, fingerprint, period, benchmark, date.today())
    if cache_key in _portfolio_risk_cache:
        return _portfolio_risk_cache[cache_key]

    quantities = pd.Series({h["ticker"]: float(h["quantity"]) for h in holdings})
    tickers = list(quantities.index)
    prices = _load_prices(tickers + [benchmark], period)

    # Align holdings on common dates so the portfolio series has no gaps.
    holding_prices = prices[tickers].dropna()
    if len(holding_prices) < 2:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Not enough overlapping price history")

    last = holding_prices.iloc[-1]
    weights = rm.portfolio_weights(quantities, last)
    values = rm.portfolio_value_series(holding_prices, quantities)
    returns = rm.log_returns(holding_prices)
    rf = get_settings().risk_free_rate

    positions = []
    for t in tickers:
        m = rm.summary(prices[t], prices[benchmark], rf)
        positions.append(
            {
                "ticker": t,
                "quantity": quantities[t],
                "last_price": float(last[t]),
                "market_value": float(quantities[t] * last[t]),
                "weight": float(weights[t]),
                "metrics": _clean_dict(m),
            }
        )

    contributions = rm.risk_contributions(returns, weights)
    for p in positions:
        p["risk_contribution"] = _clean(float(contributions[p["ticker"]]))

    corr = returns.corr()
    result = {
        "portfolio_id": portfolio_id,
        "period": period,
        "benchmark": benchmark,
        "market_value": float(values.iloc[-1]),
        "metrics": _clean_dict(rm.summary(values, prices[benchmark], rf)),
        "positions": positions,
        "correlation": {
            "tickers": list(corr.columns),
            "matrix": [[_clean(float(v)) for v in row] for row in corr.values],
        },
        "value_series": _series(values),
        "drawdown": _series(rm.drawdown_series(values)),
    }
    _portfolio_risk_cache[cache_key] = result
    return result
