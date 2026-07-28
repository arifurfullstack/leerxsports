import { useEffect, useState } from "react";
import { Clock, AlertTriangle } from "lucide-react";

/**
 * SLACountdown — Live countdown timer for coaching request deadlines.
 *
 * PRD: "Trainers should respond within 48 hours."
 * Visual states:
 *   Green  (> 24h remaining)
 *   Amber  (4–24h remaining)
 *   Red    (< 4h remaining)
 *   Overdue (past deadline) — flashing red badge
 */

type SLAState = "safe" | "warning" | "urgent" | "overdue";

function computeRemaining(
  createdAt: string,
  deadlineHours: number,
): { state: SLAState; label: string; ms: number } {
  const deadline = new Date(createdAt).getTime() + deadlineHours * 60 * 60 * 1000;
  const ms = deadline - Date.now();

  if (ms <= 0) return { state: "overdue", label: "OVERDUE", ms: 0 };

  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  let label: string;
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remH = hours % 24;
    label = remH > 0 ? `${days}d ${remH}h remaining` : `${days}d remaining`;
  } else if (hours > 0) {
    label = `${hours}h ${minutes}m remaining`;
  } else {
    label = `${minutes}m remaining`;
  }

  let state: SLAState;
  if (hours >= 24) state = "safe";
  else if (hours >= 4) state = "warning";
  else state = "urgent";

  return { state, label, ms };
}

const STATE_STYLES: Record<SLAState, string> = {
  safe: "text-emerald-500",
  warning: "text-amber-500",
  urgent: "text-red-500",
  overdue: "text-red-600 font-bold",
};

const STATE_BG: Record<SLAState, string> = {
  safe: "bg-emerald-500/10",
  warning: "bg-amber-500/10",
  urgent: "bg-red-500/10",
  overdue: "bg-red-600/15",
};

export default function SLACountdown({
  createdAt,
  deadlineHours = 48,
  compact = false,
}: {
  createdAt: string;
  deadlineHours?: number;
  compact?: boolean;
}) {
  const [remaining, setRemaining] = useState(() =>
    computeRemaining(createdAt, deadlineHours),
  );

  useEffect(() => {
    const tick = () => setRemaining(computeRemaining(createdAt, deadlineHours));
    tick();
    const id = setInterval(tick, 60_000); // refresh every minute
    return () => clearInterval(id);
  }, [createdAt, deadlineHours]);

  const { state, label } = remaining;
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const isOverdue = state === "overdue";
  const animateClass =
    isOverdue && !prefersReducedMotion ? "animate-pulse" : "";

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${STATE_STYLES[state]} ${STATE_BG[state]} ${animateClass}`}
      >
        {isOverdue ? (
          <AlertTriangle className="h-3 w-3" />
        ) : (
          <Clock className="h-3 w-3" />
        )}
        {label}
      </span>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold ${STATE_STYLES[state]} ${STATE_BG[state]} ${animateClass}`}
    >
      {isOverdue ? (
        <AlertTriangle className="h-3.5 w-3.5" />
      ) : (
        <Clock className="h-3.5 w-3.5" />
      )}
      {label}
    </div>
  );
}
