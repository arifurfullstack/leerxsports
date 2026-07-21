import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Trash2, Loader2, Check, X, ShieldPlus, Copy } from "lucide-react";
import { toast } from "sonner";
import {
  adminSeedDemoStep,
  adminClearDemoStep,
  adminGetDemoStats,
  adminSeedAdminOnly,
  SEED_STEPS,
  CLEAR_STEPS,
  DEMO_PASSWORD,
  DEMO_ACCOUNTS,
} from "@/lib/demo-seed-functions";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

type StepStatus = "pending" | "running" | "done" | "error";
type StepState = { key: string; label: string; status: StepStatus; detail?: string };

export function AdminDemoPanel() {
  const router = useRouter();
  const qc = useQueryClient();
  const seedStepFn = useServerFn(adminSeedDemoStep);
  const clearStepFn = useServerFn(adminClearDemoStep);
  const statsFn = useServerFn(adminGetDemoStats);
  const seedAdminOnlyFn = useServerFn(adminSeedAdminOnly);

  const [seeding, setSeeding] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const [adminCred, setAdminCred] = useState<
    | {
        email: string;
        password: string;
        displayName: string;
        username: string;
        alreadyExisted: boolean;
      }
    | null
  >(null);
  const [steps, setSteps] = useState<StepState[]>([]);
  const [progress, setProgress] = useState(0);
  const [mode, setMode] = useState<"seed" | "clear" | null>(null);

  const { data: stats, refetch } = useQuery({
    queryKey: ["admin-demo-stats"],
    queryFn: () => statsFn(),
  });

  const total =
    (stats?.profiles ?? 0) +
    (stats?.posts ?? 0) +
    (stats?.community ?? 0) +
    (stats?.transformations ?? 0) +
    (stats?.classes ?? 0);

  async function runSteps(
    kind: "seed" | "clear",
    plan: { key: string; label: string }[],
    runner: (step: string) => Promise<{ detail: string }>,
  ) {
    setMode(kind);
    setProgress(0);
    const initial: StepState[] = plan.map((p) => ({ ...p, status: "pending" }));
    setSteps(initial);

    const toastId = toast.loading(
      kind === "seed" ? "Seeding demo content…" : "Clearing demo content…",
      { description: `0 / ${plan.length} steps complete` },
    );

    let completed = 0;
    for (let i = 0; i < plan.length; i++) {
      const p = plan[i]!;
      setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, status: "running" } : s)));
      try {
        const { detail } = await runner(p.key);
        completed++;
        setSteps((prev) =>
          prev.map((s, idx) => (idx === i ? { ...s, status: "done", detail } : s)),
        );
        setProgress(Math.round((completed / plan.length) * 100));
        toast.loading(
          kind === "seed" ? "Seeding demo content…" : "Clearing demo content…",
          {
            id: toastId,
            description: `${completed} / ${plan.length} · ${p.label}`,
          },
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setSteps((prev) =>
          prev.map((s, idx) => (idx === i ? { ...s, status: "error", detail: msg } : s)),
        );
        toast.error(kind === "seed" ? "Seed failed" : "Clear failed", {
          id: toastId,
          description: `${p.label}: ${msg}`,
        });
        throw err;
      }
    }

    toast.success(
      kind === "seed" ? "Demo content seeded" : "Demo content cleared",
      { id: toastId, description: `${completed} / ${plan.length} steps complete` },
    );
  }

  async function handleSeed() {
    setSeeding(true);
    try {
      await runSteps("seed", SEED_STEPS, async (step) => {
        const r = await seedStepFn({ data: { step } });
        const detail = Object.entries(r.counts ?? {})
          .filter(([, v]) => (v ?? 0) > 0)
          .map(([k, v]) => `${v} ${k}`)
          .join(", ");
        return { detail: detail || "ok" };
      });
      await refetch();
      qc.invalidateQueries();
      router.invalidate();
    } catch {
      /* toast already shown */
    } finally {
      setSeeding(false);
    }
  }

  async function handleClear() {
    if (
      !confirm(
        "Remove ALL demo content (demo profiles, posts, transformations, classes, auth users)? This cannot be undone.",
      )
    )
      return;
    setClearing(true);
    try {
      await runSteps("clear", CLEAR_STEPS, async (step) => {
        const r = await clearStepFn({ data: { step } });
        return { detail: `${r.removed} removed` };
      });
      await refetch();
      qc.invalidateQueries();
      router.invalidate();
    } catch {
      /* toast already shown */
    } finally {
      setClearing(false);
    }
  }

  async function handleCreateAdminOnly() {
    const ok = confirm(
      `Create or reset the admin demo user?\n\nThis will provision admin@leerdemo.local with the admin role and reset its password to ${DEMO_PASSWORD}. Anyone with these credentials can sign in as a full admin.`,
    );
    if (!ok) return;
    setCreatingAdmin(true);
    const toastId = toast.loading("Creating admin demo user…");
    try {
      const r = await seedAdminOnlyFn();
      setAdminCred(r);
      toast.success(r.alreadyExisted ? "Admin credentials reset" : "Admin demo user created", {
        id: toastId,
        description: `${r.email} · password reset to ${r.password}`,
      });
      await refetch();
      qc.invalidateQueries();
      router.invalidate();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error("Create admin failed", { id: toastId, description: msg });
    } finally {
      setCreatingAdmin(false);
    }
  }

  const busy = seeding || clearing || creatingAdmin;

  return (
    <section className="mt-8 rounded-lg border border-dashed border-primary/40 bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 font-display text-sm uppercase tracking-widest">
            <Sparkles className="h-4 w-4 text-primary" /> Demo content
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Seed sample trainers, trainees, posts, community threads, transformations and
            classes for demos. Everything is tagged and removable in one click.
          </p>
          {stats && (
            <p className="mt-2 text-xs text-muted-foreground">
              Currently seeded: <strong className="text-foreground">{stats.profiles}</strong> profiles ·{" "}
              <strong className="text-foreground">{stats.posts}</strong> posts ·{" "}
              <strong className="text-foreground">{stats.community}</strong> community ·{" "}
              <strong className="text-foreground">{stats.transformations}</strong> transformations ·{" "}
              <strong className="text-foreground">{stats.classes}</strong> classes
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={handleCreateAdminOnly}
            disabled={busy}
          >
            {creatingAdmin ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ShieldPlus className="mr-2 h-4 w-4" />
            )}
            Create admin only
          </Button>
          <Button onClick={handleSeed} disabled={busy}>
            {seeding ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {total > 0 ? "Re-seed demo" : "Seed demo content"}
          </Button>
          <Button
            variant="outline"
            onClick={handleClear}
            disabled={busy || total === 0}
            className="text-destructive hover:text-destructive"
          >
            {clearing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Clear demo
          </Button>
        </div>
      </div>

      {adminCred && (
        <div className="mt-5 rounded-md border border-primary/40 bg-primary/5 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-display text-xs uppercase tracking-widest text-primary">
                {adminCred.alreadyExisted ? "Admin credentials reset" : "Admin demo user created"}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {adminCred.displayName} · @{adminCred.username}
              </p>
              <dl className="mt-3 space-y-1 text-sm">
                <div className="flex items-center gap-2">
                  <dt className="w-20 text-xs uppercase tracking-widest text-muted-foreground">
                    Email
                  </dt>
                  <dd>
                    <code className="rounded bg-background px-1.5 py-0.5 font-mono text-xs">
                      {adminCred.email}
                    </code>
                  </dd>
                </div>
                <div className="flex items-center gap-2">
                  <dt className="w-20 text-xs uppercase tracking-widest text-muted-foreground">
                    Password
                  </dt>
                  <dd>
                    <code className="rounded bg-background px-1.5 py-0.5 font-mono text-xs">
                      {adminCred.password}
                    </code>
                  </dd>
                </div>
              </dl>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                navigator.clipboard
                  .writeText(`${adminCred.email} / ${adminCred.password}`)
                  .then(() => toast.success("Credentials copied"))
                  .catch(() => toast.error("Copy failed"));
              }}
            >
              <Copy className="mr-2 h-3.5 w-3.5" />
              Copy
            </Button>
          </div>
        </div>
      )}

      {steps.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-widest text-muted-foreground">
            <span>
              {mode === "seed" ? "Seeding" : "Clearing"} · {progress}%
            </span>
            <span>
              {steps.filter((s) => s.status === "done").length} / {steps.length}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
          <ul className="mt-3 space-y-1 text-sm">
            {steps.map((s) => (
              <li key={s.key} className="flex items-center gap-2">
                {s.status === "pending" && (
                  <span className="h-3 w-3 rounded-full border border-muted-foreground/40" />
                )}
                {s.status === "running" && (
                  <Loader2 className="h-3 w-3 animate-spin text-primary" />
                )}
                {s.status === "done" && <Check className="h-3 w-3 text-primary" />}
                {s.status === "error" && <X className="h-3 w-3 text-destructive" />}
                <span
                  className={
                    s.status === "pending"
                      ? "text-muted-foreground"
                      : s.status === "error"
                        ? "text-destructive"
                        : ""
                  }
                >
                  {s.label}
                </span>
                {s.detail && (
                  <span className="text-xs text-muted-foreground">— {s.detail}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 rounded-md border border-border/60 bg-muted/30 p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-display text-xs uppercase tracking-widest text-muted-foreground">
            Demo credentials
          </h3>
          <span className="text-xs text-muted-foreground">
            Shared password: <code className="rounded bg-background px-1 py-0.5 font-mono">{DEMO_PASSWORD}</code>
          </span>
        </div>
        <ul className="divide-y divide-border/50 text-sm">
          {DEMO_ACCOUNTS.map((a) => (
            <li key={a.email} className="flex items-center justify-between gap-3 py-1.5">
              <span className="flex items-center gap-2">
                <span
                  className={
                    a.role === "admin"
                      ? "rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary"
                      : a.role === "trainer"
                        ? "rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-foreground"
                        : "rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                  }
                >
                  {a.role}
                </span>
                <span className="text-foreground">{a.displayName}</span>
              </span>
              <code className="font-mono text-xs text-muted-foreground">{a.email}</code>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}