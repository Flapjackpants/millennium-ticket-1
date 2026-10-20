interface Props {
  tickers: string[];
  matrix: (number | null)[][];
}

// Diverging scale: negative correlation blue, positive red, zero transparent.
function cellColor(v: number | null): string {
  if (v == null) return "transparent";
  const hue = v >= 0 ? 4 : 214;
  return `hsla(${hue}, 70%, 50%, ${Math.min(Math.abs(v), 1) * 0.75})`;
}

export default function CorrelationHeatmap({ tickers, matrix }: Props) {
  if (tickers.length < 2) return <p className="muted small">Add at least two holdings to see correlations.</p>;
  return (
    <div className="heatmap-scroll">
      <table className="heatmap">
        <thead>
          <tr>
            <th />
            {tickers.map((t) => (
              <th key={t}>{t}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, i) => (
            <tr key={tickers[i]}>
              <th>{tickers[i]}</th>
              {row.map((v, j) => (
                <td key={tickers[j]} style={{ background: cellColor(v) }} title={`${tickers[i]} / ${tickers[j]}`}>
                  {v == null ? "—" : v.toFixed(2)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
