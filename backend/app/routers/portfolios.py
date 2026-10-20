from fastapi import APIRouter, Depends, HTTPException, status

from app.auth import get_current_user_id
from app.db import get_db
from app.schemas import HoldingCreate, PortfolioCreate, PortfolioUpdate
from app.services.market_data import TickerNotFound, lookup_ticker

router = APIRouter(prefix="/portfolios", tags=["portfolios"])


def get_owned_portfolio(portfolio_id: str, user_id: str) -> dict:
    res = (
        get_db()
        .table("portfolios")
        .select("*, holdings(*)")
        .eq("id", portfolio_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Portfolio not found")
    portfolio = res.data[0]
    portfolio["holdings"] = sorted(portfolio.get("holdings") or [], key=lambda h: h["ticker"])
    return portfolio


@router.get("")
def list_portfolios(user_id: str = Depends(get_current_user_id)) -> list[dict]:
    res = (
        get_db()
        .table("portfolios")
        .select("*, holdings(count)")
        .eq("user_id", user_id)
        .order("created_at")
        .execute()
    )
    for p in res.data:
        counts = p.pop("holdings", None) or [{"count": 0}]
        p["holding_count"] = counts[0]["count"]
    return res.data


@router.post("", status_code=status.HTTP_201_CREATED)
def create_portfolio(body: PortfolioCreate, user_id: str = Depends(get_current_user_id)) -> dict:
    res = get_db().table("portfolios").insert({"name": body.name, "user_id": user_id}).execute()
    return {**res.data[0], "holdings": []}


@router.get("/{portfolio_id}")
def get_portfolio(portfolio_id: str, user_id: str = Depends(get_current_user_id)) -> dict:
    return get_owned_portfolio(portfolio_id, user_id)


@router.patch("/{portfolio_id}")
def rename_portfolio(
    portfolio_id: str, body: PortfolioUpdate, user_id: str = Depends(get_current_user_id)
) -> dict:
    get_owned_portfolio(portfolio_id, user_id)
    get_db().table("portfolios").update({"name": body.name}).eq("id", portfolio_id).execute()
    return get_owned_portfolio(portfolio_id, user_id)


@router.delete("/{portfolio_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_portfolio(portfolio_id: str, user_id: str = Depends(get_current_user_id)) -> None:
    get_owned_portfolio(portfolio_id, user_id)
    get_db().table("portfolios").delete().eq("id", portfolio_id).execute()


@router.post("/{portfolio_id}/holdings", status_code=status.HTTP_201_CREATED)
def add_holding(
    portfolio_id: str, body: HoldingCreate, user_id: str = Depends(get_current_user_id)
) -> dict:
    get_owned_portfolio(portfolio_id, user_id)
    try:
        lookup_ticker(body.ticker)
    except TickerNotFound as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(e))
    # Adding an existing ticker replaces its quantity and cost basis.
    get_db().table("holdings").upsert(
        {
            "portfolio_id": portfolio_id,
            "ticker": body.ticker,
            "quantity": body.quantity,
            "cost_basis": body.cost_basis,
        },
        on_conflict="portfolio_id,ticker",
    ).execute()
    return get_owned_portfolio(portfolio_id, user_id)


@router.delete("/{portfolio_id}/holdings/{holding_id}")
def remove_holding(
    portfolio_id: str, holding_id: str, user_id: str = Depends(get_current_user_id)
) -> dict:
    get_owned_portfolio(portfolio_id, user_id)
    get_db().table("holdings").delete().eq("id", holding_id).eq(
        "portfolio_id", portfolio_id
    ).execute()
    return get_owned_portfolio(portfolio_id, user_id)
