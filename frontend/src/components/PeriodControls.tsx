import { useState } from "react";
import type { Period } from "../lib/types";

const PERIODS: Period[] = ["6mo", "1y", "2y", "3y", "5y"];

interface Props {
  period: Period;
  benchmark: string;
  onPeriod: (p: Period) => void;
  onBenchmark: (b: string) => void;
}

export default function PeriodControls({ period, benchmark, onPeriod, onBenchmark }: Props) {
  const [draft, setDraft] = useState(benchmark);
  return (
    <div className="row">
      <div className="segmented" role="group" aria-label="Lookback period">
        {PERIODS.map((p) => (
          <button key={p} className={p === period ? "active" : ""} onClick={() => onPeriod(p)}>
            {p}
          </button>
        ))}
      </div>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim()) onBenchmark(draft.trim().toUpperCase());
        }}
      >
        <label className="small muted" htmlFor="benchmark">
          Benchmark
        </label>
        <input id="benchmark" className="narrow" value={draft} onChange={(e) => setDraft(e.target.value)} />
      </form>
    </div>
  );
}
