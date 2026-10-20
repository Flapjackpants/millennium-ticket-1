export type Period = "6mo" | "1y" | "2y" | "3y" | "5y";

export interface Holding {
  id: string;
  portfolio_id: string;
  ticker: string;
  quantity: number;
  cost_basis: number | null;
}

export interface Portfolio {
  id: string;
  name: string;
  created_at: string;
  holdings?: Holding[];
  holding_count?: number;
}

export interface Metrics {
  annualized_return: number | null;
  annualized_volatility: number | null;
  sharpe_ratio: number | null;
  beta: number | null;
  var_95: number | null;
  var_99: number | null;
  cvar_95: number | null;
  max_drawdown: number | null;
  observations: number;
}

export interface Point {
  date: string;
  value: number | null;
}

export interface TickerInfo {
  ticker: string;
  name: string | null;
  sector: string | null;
  currency: string | null;
}

export interface TickerRisk {
  ticker: string;
  info: TickerInfo | null;
  period: Period;
  benchmark: string;
  metrics: Metrics;
  prices: Point[];
  drawdown: Point[];
}

export interface Position {
  ticker: string;
  quantity: number;
  last_price: number;
  market_value: number;
  weight: number;
  risk_contribution: number | null;
  metrics: Metrics;
}

export interface PortfolioRisk {
  portfolio_id: string;
  period: Period;
  benchmark: string;
  market_value: number;
  metrics: Metrics;
  positions: Position[];
  correlation: { tickers: string[]; matrix: (number | null)[][] };
  value_series: Point[];
  drawdown: Point[];
}
