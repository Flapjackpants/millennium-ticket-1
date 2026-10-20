from pydantic import BaseModel, Field, field_validator


class PortfolioCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class PortfolioUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class HoldingCreate(BaseModel):
    ticker: str = Field(min_length=1, max_length=15)
    quantity: float = Field(gt=0)
    cost_basis: float | None = Field(default=None, ge=0)

    @field_validator("ticker")
    @classmethod
    def normalize_ticker(cls, v: str) -> str:
        return v.strip().upper()
