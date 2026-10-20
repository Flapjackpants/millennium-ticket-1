import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { money, pct } from "../lib/format";
import type { Period } from "../lib/types";
import RiskSummary from "../components/RiskSummary";
import PeriodControls from "../components/PeriodControls";
import LineSeriesChart from "../components/LineSeriesChart";

export default function Ticker() {
  const { symbol = "" } = useParams();
  const [period, setPeriod] = useState<Period>("1y");
  const [benchmark, setBenchmark] = useState("SPY");
  const { data, isLoading, error } = useQuery({
    queryKey: ["ticker-risk", symbol, period, benchmark],
    queryFn: () => api.tickerRisk(symbol, period, benchmark),
  });

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{symbol.toUpperCase()}</h1>
          {data?.info && (
            <p className="muted small">
              {[data.info.name, data.info.sector, data.info.currency].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        <PeriodControls period={period} benchmark={benchmark} onPeriod={setPeriod} onBenchmark={setBenchmark} />
      </div>

      {isLoading && <p className="muted">Loading…</p>}
      {error && <p className="error">{error.message}</p>}
      {data && (
        <>
          <section className="card">
            <h2>Risk</h2>
            <RiskSummary metrics={data.metrics} benchmark={data.benchmark} />
          </section>
          <div className="two-col">
            <section className="card">
              <h2>Adjusted close</h2>
              <LineSeriesChart data={data.prices} format={(v) => money(v)} />
            </section>
            <section className="card">
              <h2>Drawdown</h2>
              <LineSeriesChart data={data.drawdown} format={(v) => pct(v, 0)} tone="negative" />
            </section>
          </div>
        </>
      )}
    </>
  );
}
