import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle, XCircle, ShieldAlert, RefreshCw, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AdminNav } from "@/components/admin-nav";
import { adminListReports } from "@/lib/moderation-functions";
import { resolveCoachingDispute } from "@/lib/dispute-functions";

export const Route = createFileRoute("/_authenticated/admin/disputes")({
  component: AdminDisputesPage,
  head: () => ({
    meta: [
      { title: "Admin — Coaching Disputes — LEER Sports" },
      { name: "description", content: "Review and resolve active 1:1 coaching disputes." },
    ],
  }),
});

function AdminDisputesPage() {
  const getReports = useServerFn(adminListReports);
  const resolveFn = useServerFn(resolveCoachingDispute);
  const qc = useQueryClient();
  const [selectedDisputeId, setSelectedDisputeId] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const disputesQuery = useQuery({
    queryKey: ["admin-disputes"],
    queryFn: async () => {
      const reports = await getReports();
      return reports.filter((r) => r.target_type === "coaching_thread");
    },
  });

  const resolveMut = useMutation({
    mutationFn: (v: { threadId: string; verdict: "trainer_upheld" | "user_upheld" }) =>
      resolveFn({
        data: {
          threadId: v.threadId,
          verdict: v.verdict,
          note: note.trim() || undefined,
        },
      }),
    onSuccess: (res) => {
      toast.success(
        res.finalStatus === "coaching_completed"
          ? "Verdict: Trainer Upheld. Thread marked as completed."
          : "Verdict: Trainee Upheld. Refund processed & trainer strike issued.",
      );
      qc.invalidateQueries({ queryKey: ["admin-disputes"] });
      setSelectedDisputeId(null);
      setNote("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const disputes = disputesQuery.data ?? [];

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <header className="mb-6">
        <span className="font-display text-xs uppercase tracking-[0.3em] text-primary">
          Admin
        </span>
        <h1 className="mt-1 flex items-center gap-2 font-display text-3xl uppercase tracking-tight">
          <AlertTriangle className="h-6 w-6 text-amber-500" /> Coaching Disputes
        </h1>
        <p className="text-sm text-muted-foreground">
          Manual review queue for disputed 1:1 coaching sessions and SLA breaches.
        </p>
        <AdminNav />
      </header>

      {disputesQuery.isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> Loading disputes queue...
        </div>
      ) : disputes.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center text-muted-foreground">
          <CheckCircle className="mx-auto mb-3 h-8 w-8 text-emerald-500" />
          <p className="font-display text-lg uppercase">No Active Disputes</p>
          <p className="text-xs">All coaching sessions are in good standing.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {disputes.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-3">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-500">
                    DISPUTING
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Thread ID: <code className="text-foreground">{item.target_id}</code>
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  Reported {new Date(item.created_at).toLocaleDateString()}
                </span>
              </div>

              <div className="my-3 space-y-1">
                <p className="text-xs font-medium uppercase text-muted-foreground">Details / Claim:</p>
                <p className="rounded bg-card p-3 text-xs text-foreground font-mono">
                  {item.details || "No specific details provided."}
                </p>
              </div>

              {selectedDisputeId === item.target_id ? (
                <div className="mt-4 space-y-3 rounded-md border border-border bg-card p-3">
                  <p className="text-xs font-semibold uppercase">Admin Resolution Note</p>
                  <Textarea
                    placeholder="Provide context for verdict (logged in audit trail)..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    className="text-xs"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs gap-1"
                      disabled={resolveMut.isPending}
                      onClick={() =>
                        resolveMut.mutate({ threadId: item.target_id, verdict: "trainer_upheld" })
                      }
                    >
                      <CheckCircle className="h-3.5 w-3.5" /> Uphold Trainer (Release Payout)
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="text-xs gap-1"
                      disabled={resolveMut.isPending}
                      onClick={() =>
                        resolveMut.mutate({ threadId: item.target_id, verdict: "user_upheld" })
                      }
                    >
                      <XCircle className="h-3.5 w-3.5" /> Uphold Trainee (Refund & Strike Trainer)
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs"
                      onClick={() => setSelectedDisputeId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs gap-1"
                    onClick={() => setSelectedDisputeId(item.target_id)}
                  >
                    <ShieldAlert className="h-3.5 w-3.5" /> Review & Render Verdict
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
