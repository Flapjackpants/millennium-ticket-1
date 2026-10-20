import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { pct } from "../lib/format";
import type { Position } from "../lib/types";
import { useChartColors } from "../lib/useChartColors";

/** Capital weight vs. share of portfolio volatility, per position. */
export default function ContributionChart({ positions }: { positions: Position[] }) {
  const c = useChartColors();
  const data = positions.map((p) => ({ ticker: p.ticker, weight: p.weight, risk: p.risk_contribution ?? 0 }));
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, 40 * data.length + 60)}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={c.grid} horizontal={false} />
        <XAxis type="number" tickFormatter={(v) => pct(v, 0)} tick={{ fill: c.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="ticker" tick={{ fill: c.text, fontSize: 12 }} width={64} axisLine={false} tickLine={false} />
        <Tooltip
          formatter={(v: number) => pct(v)}
          contentStyle={{ background: c.surface, border: `1px solid ${c.grid}`, color: c.text }}
          cursor={{ fill: c.grid, opacity: 0.4 }}
        />
        <Legend wrapperStyle={{ color: c.muted, fontSize: 12 }} />
        <Bar dataKey="weight" name="Capital weight" fill={c.muted} radius={[0, 3, 3, 0]} />
        <Bar dataKey="risk" name="Risk contribution" fill={c.accent} radius={[0, 3, 3, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
