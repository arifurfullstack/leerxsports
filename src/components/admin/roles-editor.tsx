import { useEffect, useMemo, useState } from "react";
import {
  Shield,
  ShieldCheck,
  Dumbbell,
  User,
  AlertTriangle,
  Check,
  Plus,
  Minus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export type RoleKey = "admin" | "moderator" | "trainer" | "trainee";

const ROLE_META: {
  key: RoleKey;
  label: string;
  short: string;
  description: string;
  icon: typeof Shield;
  accent: string;
}[] = [
  {
    key: "admin",
    label: "Admin",
    short: "Full control",
    description:
      "Manage every user, run migrations, and access all admin panels. Grant sparingly.",
    icon: Shield,
    accent: "text-red-400",
  },
  {
    key: "moderator",
    label: "Moderator",
    short: "Content safety",
    description:
      "Review reports, hide posts, and issue warnings. Cannot manage other admins.",
    icon: ShieldCheck,
    accent: "text-amber-400",
  },
  {
    key: "trainer",
    label: "Trainer",
    short: "Creator tools",
    description:
      "Publish premium content, receive subscriptions, and run coaching threads.",
    icon: Dumbbell,
    accent: "text-emerald-400",
  },
  {
    key: "trainee",
    label: "Trainee",
    short: "Default member",
    description:
      "Follow trainers, comment, save posts, and subscribe. Assigned to every new account.",
    icon: User,
    accent: "text-sky-400",
  },
];

export type RolesValidation = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  added: RoleKey[];
  removed: RoleKey[];
};

export function validateRoles(
  next: RoleKey[],
  original: RoleKey[],
  opts: { isSelf: boolean },
): RolesValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const nextSet = new Set(next);
  const origSet = new Set(original);

  if (nextSet.size === 0) errors.push("At least one role is required.");
  if (opts.isSelf && origSet.has("admin") && !nextSet.has("admin")) {
    errors.push("You cannot remove your own admin role.");
  }
  if (nextSet.has("admin") && !origSet.has("admin")) {
    warnings.push("Admin has full access to every user and setting.");
  }
  if (nextSet.has("trainer") && !nextSet.has("trainee")) {
    warnings.push(
      "Most trainers keep the trainee role too so they can follow, save, and comment normally.",
    );
  }

  const added = [...nextSet].filter((r) => !origSet.has(r)) as RoleKey[];
  const removed = [...origSet].filter((r) => !nextSet.has(r)) as RoleKey[];

  return { valid: errors.length === 0, errors, warnings, added, removed };
}

export function RolesEditor({
  value,
  original,
  targetUserId,
  onChange,
  onValidationChange,
}: {
  value: string[];
  original: string[];
  targetUserId: string;
  onChange: (next: string[]) => void;
  onValidationChange?: (v: RolesValidation) => void;
}) {
  const [selfId, setSelfId] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setSelfId(data.user?.id ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const isSelf = selfId != null && selfId === targetUserId;
  const asKeys = (arr: string[]): RoleKey[] =>
    arr.filter((r): r is RoleKey =>
      ["admin", "moderator", "trainer", "trainee"].includes(r),
    );

  const validation = useMemo(
    () => validateRoles(asKeys(value), asKeys(original), { isSelf }),
    [value, original, isSelf],
  );

  useEffect(() => {
    onValidationChange?.(validation);
  }, [validation, onValidationChange]);

  const toggle = (role: RoleKey) => {
    const set = new Set(value);
    if (set.has(role)) set.delete(role);
    else set.add(role);
    onChange([...set]);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Roles</p>
          <p className="text-xs text-muted-foreground">
            Pick one or more. Changes preview below and only apply on save.
          </p>
        </div>
        {(validation.added.length > 0 || validation.removed.length > 0) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => onChange([...original])}
          >
            Reset
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ROLE_META.map((r) => {
          const active = value.includes(r.key);
          const isAdded = validation.added.includes(r.key);
          const isRemoved = !active && validation.removed.includes(r.key);
          const Icon = r.icon;
          return (
            <button
              key={r.key}
              type="button"
              role="checkbox"
              aria-checked={active}
              onClick={() => toggle(r.key)}
              className={cn(
                "group relative flex items-start gap-3 rounded-lg border p-3 text-left transition-all",
                active
                  ? "border-primary/60 bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary)/0.35)]"
                  : "border-border bg-card hover:border-primary/40 hover:bg-muted/40",
                isRemoved && "opacity-70 line-through decoration-destructive/60",
              )}
            >
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border",
                  active ? "border-primary/40 bg-background" : "border-border bg-muted/40",
                )}
              >
                <Icon className={cn("h-4 w-4", r.accent)} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{r.label}</p>
                  <span className="text-xs text-muted-foreground">{r.short}</span>
                  {isAdded && (
                    <Badge variant="secondary" className="ml-auto h-5 gap-0.5 px-1.5 text-[10px]">
                      <Plus className="h-3 w-3" /> new
                    </Badge>
                  )}
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {r.description}
                </p>
              </div>
              <span
                aria-hidden
                className={cn(
                  "absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full border transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-transparent text-transparent",
                )}
              >
                <Check className="h-3 w-3" />
              </span>
            </button>
          );
        })}
      </div>

      {(validation.added.length > 0 || validation.removed.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-xs">
          <span className="text-muted-foreground">Pending:</span>
          {validation.added.map((r) => (
            <Badge key={"+" + r} variant="default" className="gap-1">
              <Plus className="h-3 w-3" /> {r}
            </Badge>
          ))}
          {validation.removed.map((r) => (
            <Badge key={"-" + r} variant="destructive" className="gap-1">
              <Minus className="h-3 w-3" /> {r}
            </Badge>
          ))}
        </div>
      )}

      {validation.errors.map((e) => (
        <p
          key={e}
          className="flex items-center gap-1.5 text-xs font-medium text-destructive"
        >
          <AlertTriangle className="h-3.5 w-3.5" /> {e}
        </p>
      ))}
      {validation.warnings.map((w) => (
        <p
          key={w}
          className="flex items-center gap-1.5 text-xs text-amber-500"
        >
          <AlertTriangle className="h-3.5 w-3.5" /> {w}
        </p>
      ))}
    </div>
  );
}