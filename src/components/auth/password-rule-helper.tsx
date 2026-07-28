import { Check, Circle } from "lucide-react";
import { PASSWORD_MIN_LENGTH } from "@/lib/password-strength";

export function PasswordRuleHelper({ password }: { password: string }) {
  const length = password.length;
  const met = length >= PASSWORD_MIN_LENGTH;
  const remaining = Math.max(0, PASSWORD_MIN_LENGTH - length);

  return (
    <div
      className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs"
      aria-live="polite"
    >
      <div className="flex items-center gap-2">
        {met ? (
          <Check className="h-3.5 w-3.5 text-sport" aria-hidden="true" />
        ) : (
          <Circle className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        )}
        <span className={met ? "text-foreground" : "text-muted-foreground"}>
          {met
            ? `Looks good — minimum ${PASSWORD_MIN_LENGTH} characters met.`
            : length === 0
              ? `Use at least ${PASSWORD_MIN_LENGTH} characters. No other rules.`
              : `${remaining} more character${remaining === 1 ? "" : "s"} to reach the ${PASSWORD_MIN_LENGTH}-character minimum.`}
        </span>
      </div>
    </div>
  );
}

// Back-compat alias so existing imports keep working.
export { PasswordRuleHelper as PasswordStrengthMeter };