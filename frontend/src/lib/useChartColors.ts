import { useEffect, useState } from "react";

const VARS = ["--accent", "--negative", "--grid", "--muted", "--surface", "--text"] as const;

type Colors = Record<"accent" | "negative" | "grid" | "muted" | "surface" | "text", string>;

function read(): Colors {
  const s = getComputedStyle(document.documentElement);
  const [accent, negative, grid, muted, surface, text] = VARS.map((v) => s.getPropertyValue(v).trim());
  return { accent, negative, grid, muted, surface, text };
}

/** Theme tokens resolved to concrete colors, since SVG attributes cannot use var(). */
export function useChartColors(): Colors {
  const [colors, setColors] = useState(read);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setColors(read());
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return colors;
}
