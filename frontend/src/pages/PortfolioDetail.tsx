import { useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { money, pct } from "../lib/format";
import type { Period, Portfolio } from "../lib/types";
import HoldingsTable from "../components/HoldingsTable";
import RiskSummary from "../components/RiskSummary";
import PeriodControls from "../components/PeriodControls";
import LineSeriesChart from "../components/LineSeriesChart";
import ContributionChart from "../components/ContributionChart";
import CorrelationHeatmap from "../components/CorrelationHeatmap";

export default function PortfolioDetail() {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<Period>("1y");
  const [benchmark, setBenchmark] = useState("SPY");
  const [ticker, setTicker] = useState("");
  const [quantity, setQuantity] = useState("");
  const [costBasis, setCostBasis] = useState("");
  const [editingName, setEditingName] = useState<string | null>(null);

  const portfolio = useQuery({ queryKey: ["portfolio", id], queryFn: () => api.getPortfolio(id) });
  const hasHoldings = (portfolio.data?.holdings?.length ?? 0) > 0;
  const risk = useQuery({
    queryKey: ["portfolio-risk", id, period, benchmark, portfolio.data?.holdings],
    queryFn: () => api.portfolioRisk(id, period, benchmark),
    enabled: hasHoldings,
  });

  const onPortfolioChange = (p: Portfolio) => {
    queryClient.setQueryData(["portfolio", id], p);
    queryClient.invalidateQueries({ queryKey: ["portfolios"] });
  };

  const add = useMutation({
    mutationFn: () =>
      api.addHolding(id, ticker.trim(), Number(quantity), costBasis ? Number(costBasis) : null),
    onSuccess: (p) => {
      onPortfolioChange(p);
      setTicker("");
      setQuantity("");
      setCostBasis("");
    },
  });
  const remove = useMutation({ mutationFn: (hid: string) => api.removeHolding(id, hid), onSuccess: onPortfolioChange });
  const rename = useMutation({
    mutationFn: (name: string) => api.renamePortfolio(id, name),
    onSuccess: (p) => {
      onPortfolioChange(p);
      setEditingName(null);
    },
  });

  const submitHolding = (e: FormEvent) => {
    e.preventDefault();
    if (ticker.trim() && Number(quantity) > 0) add.mutate();
  };

  if (portfolio.isLoading) return <p className="muted">Loading…</p>;
  if (portfolio.error) return <p className="error">{portfolio.error.message}</p>;
  const p = portfolio.data!;

  return (
    <>
      <div className="page-head">
        {editingName == null ? (
          <h1 onDoubleClick={() => setEditingName(p.name)} title="Double-click to rename">
            {p.name}
          </h1>
        ) : (
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              if (editingName.trim()) rename.mutate(editingName.trim());
            }}
          >
            <input autoFocus value={editingName} onChange={(e) => setEditingName(e.target.value)} />
            <button type="submit">Save</button>
            <button type="button" className="ghost" onClick={() => setEditingName(null)}>
              Cancel
            </button>
          </form>
        )}
        {hasHoldings && (
          <PeriodControls period={period} benchmark={benchmark} onPeriod={setPeriod} onBenchmark={setBenchmark} />
        )}
      </div>

      <section className="card">
        <h2>Holdings</h2>
        <form className="row wrap" onSubmit={submitHolding}>
          <input placeholder="Ticker (e.g. AAPL)" value={ticker} onChange={(e) => setTicker(e.target.value)} />
          <input
            type="number"
            placeholder="Quantity"
            min="0"
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          <input
            type="number"
            placeholder="Cost basis (optional)"
            min="0"
            step="any"
            value={costBasis}
            onChange={(e) => setCostBasis(e.target.value)}
          />
          <button type="submit" disabled={add.isPending}>
            {add.isPending ? "Validating…" : "Add / update"}
          </button>
        </form>
        {add.error && <p className="error">{add.error.message}</p>}
        {hasHoldings ? (
          <HoldingsTable
            holdings={p.holdings!}
            positions={risk.data?.positions}
            onRemove={(hid) => remove.mutate(hid)}
            removing={remove.isPending}
          />
        ) : (
          <p className="muted">No holdings yet. Add a ticker above.</p>
        )}
      </section>

      {hasHoldings && (
        <>
          {risk.isLoading && <p className="muted">Fetching prices and computing risk…</p>}
          {risk.error && <p className="error">{risk.error.message}</p>}
          {risk.data && (
            <>
              <section className="card">
                <div className="row between">
                  <h2>Portfolio risk</h2>
                  <span className="muted small">
                    Market value {money(risk.data.market_value)} · {risk.data.metrics.observations} daily returns
                  </span>
                </div>
                <RiskSummary metrics={risk.data.metrics} benchmark={risk.data.benchmark} />
              </section>

              <div className="two-col">
                <section className="card">
                  <h2>Value (current quantities)</h2>
                  <LineSeriesChart data={risk.data.value_series} format={(v) => money(v)} />
                </section>
                <section className="card">
                  <h2>Drawdown</h2>
                  <LineSeriesChart data={risk.data.drawdown} format={(v) => pct(v, 0)} tone="negative" />
                </section>
              </div>

              <div className="two-col">
                <section className="card">
                  <h2>Risk contribution</h2>
                  <ContributionChart positions={risk.data.positions} />
                </section>
                <section className="card">
                  <h2>Correlation</h2>
                  <CorrelationHeatmap tickers={risk.data.correlation.tickers} matrix={risk.data.correlation.matrix} />
                </section>
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
