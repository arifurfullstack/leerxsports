import { useEffect, useRef, useState } from "react";

function parsePrefixSuffix(value: string | number) {
  const s = String(value);
  const m = s.match(/^([^\d.-]*)(-?\d[\d,]*\.?\d*)(.*)$/);
  if (!m) return { prefix: "", number: NaN, suffix: s };
  return {
    prefix: m[1] ?? "",
    number: Number(m[2].replace(/,/g, "")),
    suffix: m[3] ?? "",
  };
}

export function AnimatedNumber({
  value,
  duration = 900,
  className,
}: {
  value: string | number;
  duration?: number;
  className?: string;
}) {
  const { prefix, number, suffix } = parsePrefixSuffix(value);
  const [display, setDisplay] = useState(Number.isFinite(number) ? 0 : number);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!Number.isFinite(number)) {
      setDisplay(number);
      return;
    }
    const from = 0;
    const to = number;
    startRef.current = null;
    const tick = (t: number) => {
      if (startRef.current === null) startRef.current = t;
      const p = Math.min(1, (t - startRef.current) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (to - from) * eased);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [number, duration]);

  if (!Number.isFinite(number)) {
    return <span className={className}>{String(value)}</span>;
  }

  const hasDecimals = String(number).includes(".");
  const formatted = hasDecimals
    ? display.toFixed(2)
    : Math.round(display).toLocaleString();

  return (
    <span className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}