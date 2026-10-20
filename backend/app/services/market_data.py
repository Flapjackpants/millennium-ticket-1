"""Price data from Yahoo Finance (via yfinance), cached in Supabase `price_history`."""

import logging
import time
from datetime import date, datetime, timedelta, timezone

import pandas as pd
import yfinance as yf
from cachetools import TTLCache

from app.db import get_db

log = logging.getLogger(__name__)

PERIOD_DAYS = {"6mo": 183, "1y": 365, "2y": 730, "3y": 1095, "5y": 1826}
PAGE_SIZE = 1000
# Tickers fetched from Yahoo recently. Stops repeat fetches on market holidays,
# when the "last trading day" guess is ahead of the newest available close.
_recently_fetched: TTLCache = TTLCache(maxsize=10_000, ttl=3600)


class TickerNotFound(Exception):
    pass


def period_start(period: str) -> date:
    if period not in PERIOD_DAYS:
        raise ValueError(f"Unsupported period {period!r}; use one of {list(PERIOD_DAYS)}")
    return date.today() - timedelta(days=PERIOD_DAYS[period])


def last_trading_day(today: date | None = None) -> date:
    """Most recent weekday before today (ignores exchange holidays)."""
    d = (today or date.today()) - timedelta(days=1)
    while d.weekday() >= 5:
        d -= timedelta(days=1)
    return d


def _with_retry(fn, attempts: int = 3, base_delay: float = 1.0):
    for i in range(attempts):
        try:
            return fn()
        except Exception as e:  # yfinance raises a variety of errors on throttling
            if i == attempts - 1:
                raise
            delay = base_delay * 2**i
            log.warning("Yahoo request failed (%s); retrying in %.1fs", e, delay)
            time.sleep(delay)


def _download(tickers: list[str], start: date) -> pd.DataFrame:
    df = _with_retry(
        lambda: yf.download(
            tickers,
            start=start.isoformat(),
            auto_adjust=True,
            progress=False,
            threads=True,
        )
    )
    if df is None or df.empty:
        return pd.DataFrame()
    close = df["Close"]
    if isinstance(close, pd.Series):
        close = close.to_frame(tickers[0])
    close.index = pd.to_datetime(close.index).date
    return close


def _read_cached(tickers: list[str], start: date) -> pd.DataFrame:
    db = get_db()
    rows: list[dict] = []
    offset = 0
    while True:
        res = (
            db.table("price_history")
            .select("ticker,date,close")
            .in_("ticker", tickers)
            .gte("date", start.isoformat())
            .order("ticker")
            .order("date")
            .range(offset, offset + PAGE_SIZE - 1)
            .execute()
        )
        rows.extend(res.data)
        if len(res.data) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
    if not rows:
        return pd.DataFrame(columns=tickers)
    df = pd.DataFrame(rows)
    df["date"] = pd.to_datetime(df["date"]).dt.date
    df["close"] = df["close"].astype(float)
    return df.pivot(index="date", columns="ticker", values="close").sort_index()


def _upsert(prices: pd.DataFrame) -> None:
    long = prices.stack().reset_index()
    long.columns = ["date", "ticker", "close"]
    records = [
        {"ticker": r.ticker, "date": r.date.isoformat(), "close": float(r.close)}
        for r in long.itertuples(index=False)
    ]
    db = get_db()
    for i in range(0, len(records), PAGE_SIZE):
        db.table("price_history").upsert(records[i : i + PAGE_SIZE]).execute()


def _needs_fetch(cached: pd.DataFrame, ticker: str, start: date) -> bool:
    if ticker in _recently_fetched:
        return False
    if ticker not in cached.columns:
        return True
    series = cached[ticker].dropna()
    if series.empty:
        return True
    # Allow a week of slack at the start for weekends/holidays/listing date.
    too_short = series.index.min() > start + timedelta(days=7)
    stale = series.index.max() < last_trading_day()
    return too_short or stale


def get_prices(tickers: list[str], period: str = "1y") -> pd.DataFrame:
    """Adjusted daily closes, one column per ticker, indexed by date."""
    tickers = sorted({t.upper() for t in tickers})
    start = period_start(period)
    cached = _read_cached(tickers, start)

    to_fetch = [t for t in tickers if _needs_fetch(cached, t, start)]
    if to_fetch:
        fresh = _download(to_fetch, start)
        for t in to_fetch:
            _recently_fetched[t] = True
        if not fresh.empty:
            _upsert(fresh)
            cached = cached.combine_first(fresh) if not cached.empty else fresh

    missing = [t for t in tickers if t not in cached.columns or cached[t].dropna().empty]
    if missing:
        raise TickerNotFound(f"No price data for: {', '.join(missing)}")
    return cached[tickers].sort_index()


def lookup_ticker(symbol: str) -> dict:
    """Validate a symbol against Yahoo and cache its metadata in `ticker_info`."""
    symbol = symbol.upper().strip()
    t = yf.Ticker(symbol)
    hist = _with_retry(lambda: t.history(period="5d"))
    if hist is None or hist.empty:
        raise TickerNotFound(f"Unknown ticker: {symbol}")
    try:
        info = t.info or {}
    except Exception:  # metadata is best-effort
        info = {}
    record = {
        "ticker": symbol,
        "name": info.get("longName") or info.get("shortName"),
        "sector": info.get("sector"),
        "currency": info.get("currency"),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    get_db().table("ticker_info").upsert(record).execute()
    return record


def get_ticker_info(symbol: str) -> dict | None:
    res = get_db().table("ticker_info").select("*").eq("ticker", symbol.upper()).execute()
    return res.data[0] if res.data else None
