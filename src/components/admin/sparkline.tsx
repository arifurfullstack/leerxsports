export function Sparkline({
  points,
  className,
  strokeClassName = "stroke-primary",
  fillClassName = "fill-primary/15",
}: {
  points: number[];
  className?: string;
  strokeClassName?: string;
  fillClassName?: string;
}) {
  if (points.length === 0) return null;
  const w = 100;
  const h = 28;
  const max = Math.max(1, ...points);
  const min = Math.min(...points);
  const range = Math.max(1, max - min);
  const step = points.length > 1 ? w / (points.length - 1) : 0;
  const coords = points.map((p, i) => {
    const x = i * step;
    const y = h - ((p - min) / range) * (h - 4) - 2;
    return [x, y] as const;
  });
  const path = coords
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  const area = `${path} L${w},${h} L0,${h} Z`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className={className}
      aria-hidden
    >
      <path d={area} className={fillClassName} />
      <path
        d={path}
        fill="none"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={strokeClassName}
      />
    </svg>
  );
}