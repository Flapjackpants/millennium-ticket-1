import { supabase } from "./supabase";
import type { Period, Portfolio, PortfolioRisk, TickerInfo, TickerRisk } from "./types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, detail);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export const api = {
  listPortfolios: () => request<Portfolio[]>("/portfolios"),
  getPortfolio: (id: string) => request<Portfolio>(`/portfolios/${id}`),
  createPortfolio: (name: string) =>
    request<Portfolio>("/portfolios", { method: "POST", body: JSON.stringify({ name }) }),
  renamePortfolio: (id: string, name: string) =>
    request<Portfolio>(`/portfolios/${id}`, { method: "PATCH", body: JSON.stringify({ name }) }),
  deletePortfolio: (id: string) => request<void>(`/portfolios/${id}`, { method: "DELETE" }),
  addHolding: (id: string, ticker: string, quantity: number, cost_basis: number | null) =>
    request<Portfolio>(`/portfolios/${id}/holdings`, {
      method: "POST",
      body: JSON.stringify({ ticker, quantity, cost_basis }),
    }),
  removeHolding: (id: string, holdingId: string) =>
    request<Portfolio>(`/portfolios/${id}/holdings/${holdingId}`, { method: "DELETE" }),
  portfolioRisk: (id: string, period: Period, benchmark: string) =>
    request<PortfolioRisk>(`/portfolios/${id}/risk?period=${period}&benchmark=${encodeURIComponent(benchmark)}`),
  tickerRisk: (symbol: string, period: Period, benchmark: string) =>
    request<TickerRisk>(
      `/tickers/${encodeURIComponent(symbol)}/risk?period=${period}&benchmark=${encodeURIComponent(benchmark)}`,
    ),
  searchTicker: (q: string) => request<TickerInfo>(`/tickers/search?q=${encodeURIComponent(q)}`),
};
