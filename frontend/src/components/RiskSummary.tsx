import { num, pct } from "../lib/format";
import type { Metrics } from "../lib/types";

export default function RiskSummary({ metrics, benchmark }: { metrics: Metrics; benchmark: string }) {
  const tiles: { label: string; value: string; hint: string }[] = [
    { label: "Volatility", value: pct(metrics.annualized_volatility), hint: "Annualized std. dev. of daily log returns" },
    { label: "Return", value: pct(metrics.annualized_return), hint: "Annualized mean daily log return" },
    { label: "Sharpe", value: num(metrics.sharpe_ratio), hint: "(Return − risk-free) / volatility" },
    { label: `Beta vs ${benchmark}`, value: num(metrics.beta), hint: "Sensitivity to benchmark returns" },
    { label: "VaR 95%", value: pct(metrics.var_95), hint: "1-day historical loss not exceeded 95% of days" },
    { label: "VaR 99%", value: pct(metrics.var_99), hint: "1-day historical loss not exceeded 99% of days" },
    { label: "CVaR 95%", value: pct(metrics.cvar_95), hint: "Average 1-day loss on the worst 5% of days" },
    { label: "Max drawdown", value: pct(metrics.max_drawdown), hint: "Largest peak-to-trough decline" },
  ];
  return (
    <div className="tiles">
      {tiles.map((t) => (
        <div key={t.label} className="tile" title={t.hint}>
          <div className="tile-label">{t.label}</div>
          <div className="tile-value">{t.value}</div>
        </div>
      ))}
    </div>
  );
}
