export const pct = (v: number | null | undefined, digits = 2) =>
  v == null ? "—" : `${(v * 100).toFixed(digits)}%`;

export const num = (v: number | null | undefined, digits = 2) =>
  v == null ? "—" : v.toFixed(digits);

export const money = (v: number | null | undefined) =>
  v == null ? "—" : v.toLocaleString(undefined, { style: "currency", currency: "USD" });
