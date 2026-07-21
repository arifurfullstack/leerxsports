import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Gavel } from "lucide-react";
import {
  adminListDisputes,
  adminResolveDispute,
  type AdminDisputeRow,
} from "@/lib/moderation-functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/disputes")({
  component: DisputesPage,
  head: () => ({ meta: [{ title: "Admin · Disputes" }] }),
});

function DisputesPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListDisputes);
  const resolveFn = useServerFn(adminResolveDispute);

  const { data, isLoading } = useQuery<AdminDisputeRow[]>({
    queryKey: ["admin", "disputes"],
    queryFn: () => listFn(),
  });

  const resolve = useMutation({
    mutationFn: (vars: { disputeId: string; outcome: "resolved_trainer" | "resolved_trainee" }) =>
      resolveFn({ data: vars }),
    onSuccess: () => {
      toast.success("Dispute resolved");
      qc.invalidateQueries({ queryKey: ["admin", "disputes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <p className="font-display text-xs uppercase tracking-[0.3em] text-primary">Admin</p>
        <h1 className="font-display text-3xl uppercase tracking-tight">Disputes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review coaching disputes and rule in favor of the trainer or trainee.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (data ?? []).length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          <Gavel className="mx-auto mb-3 h-8 w-8 opacity-50" />
          No disputes yet.
        </div>
      ) : (
        <div className="space-y-3">
          {(data ?? []).map((d) => (
            <div key={d.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant={d.status === "open" ? "destructive" : "outline"}>
                      {d.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(d.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-2 text-sm">{d.reason}</p>
                  {d.verdict && (
                    <p className="mt-1 text-xs text-muted-foreground">Verdict: {d.verdict}</p>
                  )}
                </div>
                {d.status === "open" && (
                  <div className="flex flex-shrink-0 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={resolve.isPending}
                      onClick={() =>
                        resolve.mutate({ disputeId: d.id, outcome: "resolved_trainer" })
                      }
                    >
                      Rule for trainer
                    </Button>
                    <Button
                      size="sm"
                      disabled={resolve.isPending}
                      onClick={() =>
                        resolve.mutate({ disputeId: d.id, outcome: "resolved_trainee" })
                      }
                    >
                      Rule for trainee
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}