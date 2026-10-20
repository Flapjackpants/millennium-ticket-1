import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Point } from "../lib/types";
import { useChartColors } from "../lib/useChartColors";

interface Props {
  data: Point[];
  format: (v: number) => string;
  tone?: "accent" | "negative";
  height?: number;
}

export default function LineSeriesChart({ data, format, tone = "accent", height = 240 }: Props) {
  const c = useChartColors();
  const color = c[tone];
  const gradientId = `fill-${tone}`;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={c.grid} vertical={false} />
        <XAxis dataKey="date" tick={{ fill: c.muted, fontSize: 11 }} minTickGap={48} tickLine={false} axisLine={false} />
        <YAxis
          tick={{ fill: c.muted, fontSize: 11 }}
          tickFormatter={format}
          width={64}
          tickLine={false}
          axisLine={false}
          domain={["auto", "auto"]}
        />
        <Tooltip
          formatter={(v: number) => format(v)}
          contentStyle={{ background: c.surface, border: `1px solid ${c.grid}`, color: c.text }}
          labelStyle={{ color: c.muted }}
        />
        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} fill={`url(#${gradientId})`} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
