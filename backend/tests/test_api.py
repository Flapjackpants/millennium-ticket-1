import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.auth import get_current_user_id
from app.main import app
from app.routers import risk


@pytest.fixture
def client(monkeypatch):
    app.dependency_overrides[get_current_user_id] = lambda: "user-1"

    rng = np.random.default_rng(0)
    idx = pd.date_range("2024-01-01", periods=260, freq="B").date
    fake = pd.DataFrame(
        100 * np.exp(np.cumsum(rng.normal(0, 0.01, (260, 3)), axis=0)),
        index=idx,
        columns=["AAPL", "MSFT", "SPY"],
    )
    monkeypatch.setattr(risk, "get_prices", lambda tickers, period: fake[sorted(set(tickers))])
    monkeypatch.setattr(risk, "get_ticker_info", lambda s: {"ticker": s, "name": s})
    monkeypatch.setattr(
        risk,
        "get_owned_portfolio",
        lambda pid, uid: {
            "id": pid,
            "holdings": [
                {"ticker": "AAPL", "quantity": 10},
                {"ticker": "MSFT", "quantity": 5},
            ],
        },
    )
    risk._portfolio_risk_cache.clear()
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_requires_auth():
    assert TestClient(app).get("/portfolios").status_code == 401


def test_ticker_risk(client):
    r = client.get("/tickers/aapl/risk?period=1y")
    assert r.status_code == 200
    body = r.json()
    assert body["ticker"] == "AAPL"
    assert body["metrics"]["observations"] == 259
    assert len(body["prices"]) == 260


def test_portfolio_risk(client):
    r = client.get("/portfolios/p1/risk")
    assert r.status_code == 200
    body = r.json()
    weights = sum(p["weight"] for p in body["positions"])
    contrib = sum(p["risk_contribution"] for p in body["positions"])
    assert weights == pytest.approx(1.0)
    assert contrib == pytest.approx(1.0)
    assert body["correlation"]["tickers"] == ["AAPL", "MSFT"]


def test_bad_period(client):
    assert client.get("/tickers/AAPL/risk?period=10y").status_code == 422
