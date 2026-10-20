# Risk Platform

Basic portfolio risk management app.

- **Frontend:** React + Vite + TypeScript, TanStack Query, Recharts (`frontend/`)
- **Backend:** FastAPI + pandas/numpy, prices from Yahoo Finance via `yfinance` (`backend/`)
- **Database / auth:** Supabase Postgres + Supabase Auth (`supabase/migrations/`)

Users create portfolios of tickers and quantities. The backend pulls adjusted daily closes from Yahoo, caches them in the `price_history` table, and computes risk metrics per ticker and per portfolio.

## Metrics

All metrics use daily log returns over the selected lookback (6mo, 1y, 2y, 3y, 5y).

| Metric | Definition |
|---|---|
| Volatility | Std. dev. of daily returns × √252 |
| Return | Mean daily return × 252 |
| Sharpe | (Return − `RISK_FREE_RATE`) / Volatility |
| Beta | Cov(asset, benchmark) / Var(benchmark); benchmark defaults to `SPY` |
| VaR 95% / 99% | 1-day historical VaR, shown as a positive loss |
| CVaR 95% | Mean loss on days beyond the 95% VaR |
| Max drawdown | Largest peak-to-trough decline in price/value |
| Risk contribution | `w_i · (Σw)_i / σ²_p`, each position's share of portfolio variance |

Portfolio metrics treat current quantities as held for the whole lookback (buy-and-hold).

## Setup

### 1. Supabase

1. Create a project at https://supabase.com.
2. Run `supabase/migrations/0001_init.sql` in the SQL editor, or with `supabase db push` if you use the CLI.
3. Note the project URL, anon key, service role key, and JWT secret (Project Settings > API).

### 2. Backend

```bash
cd backend
cp .env.example .env        # fill in SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_JWT_SECRET
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python -r requirements.txt
.venv/bin/uvicorn app.main:app --reload
```

API docs: http://localhost:8000/docs

The backend accepts HS256 tokens (verified with `SUPABASE_JWT_SECRET`) and asymmetric tokens (verified with the project's JWKS endpoint).

### 3. Frontend

```bash
cd frontend
cp .env.example .env        # fill in VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

Open http://localhost:5173.

## Security

- The service role key bypasses Row Level Security. Keep it in `backend/.env` only. Never put it in the frontend.
- The backend checks portfolio ownership on every request, because the service role client ignores RLS.
- RLS policies still protect `portfolios` and `holdings` if the anon key is used directly.

## Tests

```bash
cd backend && .venv/bin/python -m pytest
```

## API

| Method | Path | Purpose |
|---|---|---|
| GET / POST | `/portfolios` | List / create portfolios |
| GET / PATCH / DELETE | `/portfolios/{id}` | Get / rename / delete |
| POST | `/portfolios/{id}/holdings` | Add or update a holding (ticker validated on Yahoo) |
| DELETE | `/portfolios/{id}/holdings/{holding_id}` | Remove a holding |
| GET | `/portfolios/{id}/risk?period=1y&benchmark=SPY` | Portfolio risk |
| GET | `/tickers/{symbol}/risk?period=1y&benchmark=SPY` | Single-ticker risk |
| GET | `/tickers/search?q=AAPL` | Validate a ticker and return metadata |

## Known limits

- `yfinance` is unofficial and can be throttled. Price caching and retry with backoff reduce the impact.
- All values are assumed to be USD. The ticker's currency is shown but not converted.
- Computed portfolio risk is cached in-process for 5 minutes. Use a shared cache such as Redis if you run several backend instances.
