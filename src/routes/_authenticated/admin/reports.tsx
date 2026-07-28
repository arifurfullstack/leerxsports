import { createFileRoute } from "@tanstack/react-router";
import {
  queryOptions,
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Flag, ShieldAlert, RotateCcw, Search, CheckCircle2, XCircle } from "lucide-react";
import {
  adminHideTarget,
  adminListReports,
  adminResolveReport,
  REPORT_REASONS,
  REPORT_TARGETS,
  type ReportRow,
  type ReportReason,
  type ReportTarget,
} from "@/lib/moderation-functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdminNav } from "@/components/admin-nav";

type StatusFilter = "all" | "open" | "reviewed" | "actioned" | "dismissed";
type TargetFilter = "all" | ReportTarget;
type ReasonFilter = "all" | ReportReason;

const reportsQ = queryOptions({
  queryKey: ["admin-reports"],
  queryFn: () => adminListReports(),
});

export const Route = createFileRoute("/_authenticated/admin/reports")({
  loader: ({ context }) => context.queryClient.ensureQueryData(reportsQ),
  head: () => ({
    meta: [
      { title: "Admin — Reports Queue — LEER Sports" },
      {
        name: "description",
        content:
          "Review, filter, and resolve user reports across posts, comments, profiles, and community threads.",
      },
      { property: "og:title", content: "Admin — Reports Queue — LEER Sports" },
      {
        property: "og:description",
        content: "Filter and resolve user reports across the platform.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReportsPage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-destructive">{error.message}</div>
  ),
  notFoundComponent: () => <div className="p-8">Not found.</div>,
});

function ReportsPage() {
  const { data } = useSuspenseQuery(reportsQ);
  const qc = useQueryClient();
  const resolve = useServerFn(adminResolveReport);
  const act = useServerFn(adminHideTarget);

  const [status, setStatus] = useState<StatusFilter>("open");
  const [target, setTarget] = useState<TargetFilter>("all");
  const [reason, setReason] = useState<ReasonFilter>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (target !== "all" && r.target_type !== target) return false;
      if (reason !== "all" && r.reason !== reason) return false;
      if (q) {
        const hay = `${r.target_id} ${r.reporter_id} ${r.details ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [data, status, target, reason, query]);

  const counts = useMemo(() => {
    return {
      total: data.length,
      open: data.filter((r) => r.status === "open").length,
      actioned: data.filter((r) => r.status === "actioned").length,
      dismissed: data.filter((r) => r.status === "dismissed").length,
    };
  }, [data]);

  const resolveM = useMutation({
    mutationFn: (v: {
      reportId: string;
      status: "reviewed" | "actioned" | "dismissed";
      note?: string;
    }) => resolve({ data: v }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: ["admin-reports"] });
      const prev = qc.getQueryData<ReportRow[]>(["admin-reports"]);
      qc.setQueryData<ReportRow[]>(["admin-reports"], (old) =>
        (old ?? []).map((r) =>
          r.id === v.reportId
            ? {
                ...r,
                status: v.status,
                resolution_note: v.note ?? r.resolution_note,
                resolved_at: new Date().toISOString(),
              }
            : r,
        ),
      );
      return { prev };
    },
    onError: (e: Error, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["admin-reports"], ctx.prev);
      toast.error(e.message);
    },
    onSuccess: () => toast.success("Report updated"),
    onSettled: () => qc.invalidateQueries({ queryKey: ["admin-reports"] }),
  });

  const actM = useMutation({
    mutationFn: (v: {
      report: ReportRow;
      action: "hide" | "restore" | "remove";
    }) =>
      act({
        data: {
          target_type: v.report.target_type,
          target_id: v.report.target_id,
          action: v.action,
          reason: v.report.reason,
        },
      }),
    onSuccess: (_r, v) => {
      toast.success(`Content ${v.action}d`);
      resolveM.mutate({ reportId: v.report.id, status: "actioned" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetFilters = () => {
    setStatus("all");
    setTarget("all");
    setReason("all");
    setQuery("");
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header className="mb-6">
        <span className="font-display text-xs uppercase tracking-[0.3em] text-primary">
          Admin
        </span>
        <h1 className="mt-1 flex items-center gap-2 font-display text-3xl uppercase tracking-tight">
          <ShieldAlert className="h-6 w-6" /> Reports Queue
        </h1>
        <p className="text-sm text-muted-foreground">
          Review, filter, and resolve user reports across the platform.
        </p>
        <AdminNav />
      </header>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total" value={counts.total} />
        <StatCard label="Open" value={counts.open} tone="danger" />
        <StatCard label="Actioned" value={counts.actioned} tone="success" />
        <StatCard label="Dismissed" value={counts.dismissed} />
      </div>

      <div className="mb-4 grid gap-2 rounded-lg border border-border bg-card p-3 sm:grid-cols-[1fr_repeat(3,minmax(0,180px))_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search target id, reporter, details…"
            className="pl-8"
          />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="reviewed">Reviewed</SelectItem>
            <SelectItem value="actioned">Actioned</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={target} onValueChange={(v) => setTarget(v as TargetFilter)}>
          <SelectTrigger><SelectValue placeholder="Target" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All targets</SelectItem>
            {REPORT_TARGETS.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={reason} onValueChange={(v) => setReason(v as ReasonFilter)}>
          <SelectTrigger><SelectValue placeholder="Reason" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All reasons</SelectItem>
            {REPORT_REASONS.map((r) => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="sm" onClick={resetFilters}>
          Reset
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No reports match these filters.
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((r) => (
            <li key={r.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                    <Flag className="h-3 w-3" />
                    <span>{r.target_type}</span>
                    <span>·</span>
                    <span>{r.reason}</span>
                    <StatusPill status={r.status} />
                  </p>
                  <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                    target #{r.target_id.slice(0, 8)} · reporter #
                    {r.reporter_id.slice(0, 8)} ·{" "}
                    {new Date(r.created_at).toLocaleString()}
                    {r.resolved_at && (
                      <> · resolved {new Date(r.resolved_at).toLocaleString()}</>
                    )}
                  </p>
                  {r.details && (
                    <p className="mt-2 whitespace-pre-wrap text-sm">{r.details}</p>
                  )}
                  {r.resolution_note && (
                    <p className="mt-2 rounded-md border border-border bg-muted/30 p-2 text-xs">
                      <span className="font-semibold">Note: </span>
                      {r.resolution_note}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col">
                  {r.status === "open" && (
                    <>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => actM.mutate({ report: r, action: "hide" })}
                        disabled={actM.isPending}
                      >
                        Hide & action
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          resolveM.mutate({ reportId: r.id, status: "reviewed" })
                        }
                        disabled={resolveM.isPending}
                      >
                        <CheckCircle2 className="mr-1 h-3 w-3" /> Mark reviewed
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          resolveM.mutate({ reportId: r.id, status: "dismissed" })
                        }
                        disabled={resolveM.isPending}
                      >
                        <XCircle className="mr-1 h-3 w-3" /> Dismiss
                      </Button>
                    </>
                  )}
                  {r.status !== "open" && (
                    <>
                      {r.target_type !== "profile" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            actM.mutate({ report: r, action: "restore" })
                          }
                          disabled={actM.isPending}
                        >
                          <RotateCcw className="mr-1 h-3 w-3" /> Restore
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          resolveM.mutate({ reportId: r.id, status: "open" as never })
                        }
                        disabled
                      >
                        {r.status}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "danger" | "success";
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-1 font-display text-2xl ${
          tone === "danger"
            ? "text-destructive"
            : tone === "success"
              ? "text-primary"
              : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function StatusPill({ status }: { status: ReportRow["status"] }) {
  const cls =
    status === "open"
      ? "border-destructive text-destructive"
      : status === "actioned"
        ? "border-primary text-primary"
        : "border-border text-muted-foreground";
  return (
    <span className={`rounded-full border px-1.5 text-[10px] ${cls}`}>
      {status}
    </span>
  );
}