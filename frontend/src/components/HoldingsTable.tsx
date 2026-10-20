import { Link } from "react-router-dom";
import { money, num, pct } from "../lib/format";
import type { Holding, Position } from "../lib/types";

interface Props {
  holdings: Holding[];
  positions?: Position[];
  onRemove: (holdingId: string) => void;
  removing: boolean;
}

export default function HoldingsTable({ holdings, positions, onRemove, removing }: Props) {
  const byTicker = new Map(positions?.map((p) => [p.ticker, p]));
  return (
    <div className="table-scroll">
      <table className="data">
        <thead>
          <tr>
            <th>Ticker</th>
            <th className="num">Qty</th>
            <th className="num">Price</th>
            <th className="num">Value</th>
            <th className="num">Weight</th>
            <th className="num">Vol</th>
            <th className="num">Beta</th>
            <th className="num">VaR 95%</th>
            <th className="num">Max DD</th>
            <th className="num">Risk contrib.</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {holdings.map((h) => {
            const p = byTicker.get(h.ticker);
            return (
              <tr key={h.id}>
                <td>
                  <Link to={`/tickers/${h.ticker}`}>{h.ticker}</Link>
                </td>
                <td className="num">{h.quantity}</td>
                <td className="num">{money(p?.last_price)}</td>
                <td className="num">{money(p?.market_value)}</td>
                <td className="num">{pct(p?.weight, 1)}</td>
                <td className="num">{pct(p?.metrics.annualized_volatility, 1)}</td>
                <td className="num">{num(p?.metrics.beta)}</td>
                <td className="num">{pct(p?.metrics.var_95)}</td>
                <td className="num">{pct(p?.metrics.max_drawdown, 1)}</td>
                <td className="num">{pct(p?.risk_contribution, 1)}</td>
                <td>
                  <button className="ghost danger small" disabled={removing} onClick={() => onRemove(h.id)}>
                    Remove
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
