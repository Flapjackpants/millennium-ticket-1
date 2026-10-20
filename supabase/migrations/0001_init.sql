-- Portfolios owned by a Supabase Auth user
create table if not exists public.portfolios (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    name text not null,
    created_at timestamptz not null default now()
);

create index if not exists portfolios_user_id_idx on public.portfolios (user_id);

-- Positions inside a portfolio
create table if not exists public.holdings (
    id uuid primary key default gen_random_uuid(),
    portfolio_id uuid not null references public.portfolios (id) on delete cascade,
    ticker text not null,
    quantity numeric not null check (quantity > 0),
    cost_basis numeric,
    created_at timestamptz not null default now(),
    unique (portfolio_id, ticker)
);

create index if not exists holdings_portfolio_id_idx on public.holdings (portfolio_id);

-- Shared cache of adjusted daily closes (written by backend service role only)
create table if not exists public.price_history (
    ticker text not null,
    date date not null,
    close numeric not null,
    primary key (ticker, date)
);

-- Shared cache of ticker metadata
create table if not exists public.ticker_info (
    ticker text primary key,
    name text,
    sector text,
    currency text,
    updated_at timestamptz not null default now()
);

-- Row Level Security
alter table public.portfolios enable row level security;
alter table public.holdings enable row level security;
alter table public.price_history enable row level security;
alter table public.ticker_info enable row level security;

create policy "own portfolios" on public.portfolios
    for all
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

create policy "own holdings" on public.holdings
    for all
    using (exists (
        select 1 from public.portfolios p
        where p.id = holdings.portfolio_id and p.user_id = auth.uid()
    ))
    with check (exists (
        select 1 from public.portfolios p
        where p.id = holdings.portfolio_id and p.user_id = auth.uid()
    ));

-- Cache tables: readable by signed-in users, writable only by service role (no write policy)
create policy "read prices" on public.price_history
    for select to authenticated using (true);

create policy "read ticker info" on public.ticker_info
    for select to authenticated using (true);
