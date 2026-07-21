import { checkPassword } from "@/lib/password-strength";

export function PasswordStrengthMeter({ password }: { password: string }) {
  if (!password) return null;
  const result = checkPassword(password);
  const barColor = [
    "bg-destructive",
    "bg-destructive/70",
    "bg-amber-500",
    "bg-sport",
    "bg-sport",
  ][result.score];

  return (
    <div className="space-y-1.5" aria-live="polite">
      <div className="flex h-1.5 gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`flex-1 rounded-full ${i < Math.max(1, result.score) ? barColor : "bg-muted"}`}
          />
        ))}
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Strength</span>
        <span className="font-medium">{result.label}</span>
      </div>
      {result.issues.length > 0 && (
        <ul className="ml-4 list-disc text-xs text-muted-foreground">
          {result.issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      )}
    </div>
  );
}