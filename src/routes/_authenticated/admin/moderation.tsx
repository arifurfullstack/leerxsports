import { createFileRoute } from "@tanstack/react-router";
import {
  queryOptions,
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, ShieldAlert, Flag, Ban, RotateCcw, Trash2 } from "lucide-react";
import {
  adminHideTarget,
  adminIssueStrike,

  adminListReports,
  adminListStrikes,

  adminResolveReport,
  adminRevokeStrike,

  type ReportRow,
} from "@/lib/moderation-functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminNav } from "@/components/admin-nav";

const reportsQ = queryOptions({
  queryKey: ["admin-reports"],
  queryFn: () => adminListReports(),
});
const strikesQ = queryOptions({
  queryKey: ["admin-strikes"],
  queryFn: () => adminListStrikes(),
});

export const Route = createFileRoute("/_authenticated/admin/moderation")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(reportsQ),
      context.queryClient.ensureQueryData(strikesQ),
    ]);
  },
  head: () => ({
    meta: [
      { title: "Admin — Moderation — LEER Sports" },
      { name: "description", content: "Reports and strikes." },
    ],
  }),
  component: ModerationPage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-destructive">{error.message}</div>
  ),
  notFoundComponent: () => <div className="p-8">Not found.</div>,
});

function ModerationPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <header className="mb-6">
        <span className="font-display text-xs uppercase tracking-[0.3em] text-primary">
          Admin
        </span>
        <h1 className="mt-1 flex items-center gap-2 font-display text-3xl uppercase tracking-tight">
          <ShieldAlert className="h-6 w-6" /> Moderation
        </h1>
        <p className="text-sm text-muted-foreground">
          Reports and trainer strikes.
        </p>
        <AdminNav />
      </header>

      <Tabs defaultValue="reports">
        <TabsList>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="strikes">Strikes</TabsTrigger>
        </TabsList>
        <TabsContent value="reports">
          <ReportsList />
        </TabsContent>
        <TabsContent value="strikes">
          <StrikesList />
        </TabsContent>
      </Tabs>
    </main>
  );
}

function ReportsList() {
  const { data } = useSuspenseQuery(reportsQ);
  const qc = useQueryClient();
  const resolve = useServerFn(adminResolveReport);
  const act = useServerFn(adminHideTarget);

  const resolveM = useMutation({
    mutationFn: (v: {
      reportId: string;
      status: "reviewed" | "actioned" | "dismissed";
    }) => resolve({ data: v }),
    onSuccess: () => {
      toast.success("Report updated");
      qc.invalidateQueries({ queryKey: ["admin-reports"] });
    },
    onError: (e: Error) => toast.error(e.message),
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

  if (!data.length) {
    return (
      <p className="mt-6 text-sm text-muted-foreground">No reports yet.</p>
    );
  }

  return (
    <ul className="mt-4 space-y-3">
      {data.map((r) => (
        <li key={r.id} className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                <Flag className="h-3 w-3" />
                {r.target_type} · {r.reason}
                <span
                  className={`rounded-full border px-1.5 text-[10px] ${
                    r.status === "open"
                      ? "border-destructive text-destructive"
                      : "border-border"
                  }`}
                >
                  {r.status}
                </span>
              </p>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                target #{r.target_id.slice(0, 8)} ·{" "}
                {new Date(r.created_at).toLocaleString()}
              </p>
              {r.details && (
                <p className="mt-2 whitespace-pre-wrap text-sm">{r.details}</p>
              )}
            </div>
            <div className="flex shrink-0 flex-col gap-1">
              {r.status === "open" && (
                <>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() =>
                      actM.mutate({ report: r, action: "hide" })
                    }
                    disabled={actM.isPending}
                  >
                    Hide
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      resolveM.mutate({ reportId: r.id, status: "dismissed" })
                    }
                    disabled={resolveM.isPending}
                  >
                    Dismiss
                  </Button>
                </>
              )}
              {r.status !== "open" && r.target_type !== "profile" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => actM.mutate({ report: r, action: "restore" })}
                >
                  <RotateCcw className="mr-1 h-3 w-3" /> Restore
                </Button>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}


function StrikesList() {
  const { data } = useSuspenseQuery(strikesQ);
  const qc = useQueryClient();
  const revoke = useServerFn(adminRevokeStrike);
  const issue = useServerFn(adminIssueStrike);
  const [trainerId, setTrainerId] = useState("");
  const [reason, setReason] = useState("");

  const revokeM = useMutation({
    mutationFn: (id: string) => revoke({ data: { id } }),
    onSuccess: () => {
      toast.success("Strike revoked");
      qc.invalidateQueries({ queryKey: ["admin-strikes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const issueM = useMutation({
    mutationFn: () => issue({ data: { trainerId, reason } }),
    onSuccess: (r) => {
      toast.success(`Strike issued (${r.activeCount} active)`);
      setTrainerId("");
      setReason("");
      qc.invalidateQueries({ queryKey: ["admin-strikes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="font-display text-sm uppercase tracking-widest">
          Issue strike
        </h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,220px)_1fr_auto]">
          <input
            placeholder="Trainer user id"
            value={trainerId}
            onChange={(e) => setTrainerId(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          />
          <input
            placeholder="Reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          />
          <Button
            size="sm"
            variant="destructive"
            disabled={
              !trainerId ||
              reason.trim().length < 3 ||
              issueM.isPending
            }
            onClick={() => issueM.mutate()}
          >
            {issueM.isPending ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <Ban className="mr-1 h-3 w-3" />
            )}
            Issue
          </Button>
        </div>
      </div>

      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No strikes on file.</p>
      ) : (
        <ul className="space-y-2">
          {data.map((s: {
            id: string;
            trainer_id: string;
            reason: string;
            status: string;
            created_at: string;
          }) => (
            <li
              key={s.id}
              className="flex items-center justify-between rounded-md border border-border bg-card p-3"
            >
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">
                  {s.status} · trainer #{s.trainer_id.slice(0, 8)} ·{" "}
                  {new Date(s.created_at).toLocaleDateString()}
                </p>
                <p className="text-sm">{s.reason}</p>
              </div>
              {s.status === "active" && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => revokeM.mutate(s.id)}
                  disabled={revokeM.isPending}
                >
                  <Trash2 className="mr-1 h-3 w-3" /> Revoke
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}