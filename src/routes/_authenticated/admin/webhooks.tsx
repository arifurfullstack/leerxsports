import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Copy,
  Webhook,
} from "lucide-react";
import { toast } from "sonner";
import {
  listWebhookEvents,
  type WebhookEvent,
} from "@/lib/payment-webhooks-functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/webhooks")({
  head: () => ({ meta: [{ title: "Admin · Payment webhooks" }] }),
  component: WebhooksPage,
});

function WebhooksPage() {
  const listFn = useServerFn(listWebhookEvents);
  const [provider, setProvider] = useState<"all" | "stripe" | "paypal">("all");
  const [status, setStatus] = useState<
    "all" | "received" | "processed" | "ignored" | "failed"
  >("all");

  const { data, isLoading, error, refetch, isFetching } = useQuery<
    WebhookEvent[]
  >({
    queryKey: ["admin", "webhook-events", provider, status],
    queryFn: () => listFn({ data: { provider, status, limit: 100 } }),
  });

  const endpoints = useMemo(() => {
    if (typeof window === "undefined") return { stripe: "", paypal: "" };
    const base = window.location.origin;
    return {
      stripe: `${base}/api/public/webhooks/stripe`,
      paypal: `${base}/api/public/webhooks/paypal`,
    };
  }, []);

  const copy = (v: string) => {
    navigator.clipboard.writeText(v);
    toast.success("Copied URL");
  };

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <header>
        <p className="font-display text-xs uppercase tracking-[0.3em] text-primary">
          Admin
        </p>
        <h1 className="font-display text-3xl uppercase tracking-tight">
          Payment webhooks
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Signed events from Stripe and PayPal are verified, deduplicated, and
          synced into your transactions in real time.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        {(["stripe", "paypal"] as const).map((p) => (
          <div key={p} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <Webhook className="h-4 w-4 text-primary" />
              <h2 className="font-display text-sm uppercase tracking-widest">
                {p} endpoint
              </h2>
            </div>
            <code className="mt-3 block truncate rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
              {endpoints[p]}
            </code>
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Paste this URL into{" "}
                {p === "stripe"
                  ? "Stripe → Developers → Webhooks"
                  : "PayPal → Apps & Credentials → Webhooks"}
                .
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copy(endpoints[p])}
              >
                <Copy className="mr-1.5 h-3 w-3" /> Copy
              </Button>
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <h2 className="font-display text-sm uppercase tracking-widest">
            Recent events
          </h2>
          <div className="flex flex-wrap gap-2">
            <Select
              value={provider}
              onValueChange={(v) => setProvider(v as any)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All providers</SelectItem>
                <SelectItem value="stripe">Stripe</SelectItem>
                <SelectItem value="paypal">PayPal</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(v) => setStatus(v as any)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any status</SelectItem>
                <SelectItem value="processed">Processed</SelectItem>
                <SelectItem value="ignored">Ignored</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="received">Received</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              {isFetching ? (
                <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
              ) : null}
              Refresh
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="m-4 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {(error as Error).message}
          </div>
        ) : (data ?? []).length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No webhook events yet. Once you configure the endpoint in your
            provider dashboard, verified events will appear here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Provider</th>
                  <th className="px-4 py-2 text-left">Event</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Verified</th>
                  <th className="px-4 py-2 text-left">Received</th>
                  <th className="px-4 py-2 text-left">Notes</th>
                </tr>
              </thead>
              <tbody>
                {(data ?? []).map((ev) => (
                  <tr
                    key={ev.id}
                    className="border-t border-border/60 hover:bg-muted/20"
                  >
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="uppercase">
                        {ev.provider}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{ev.event_type}</div>
                      <div className="text-xs text-muted-foreground">
                        {ev.event_id}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={ev.status} />
                    </td>
                    <td className="px-4 py-3">
                      {ev.verified ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(ev.received_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {ev.processing_error ?? ev.transaction_id ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function StatusBadge({ status }: { status: WebhookEvent["status"] }) {
  if (status === "processed")
    return (
      <Badge className="gap-1 bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/20">
        <CheckCircle2 className="h-3 w-3" /> Processed
      </Badge>
    );
  if (status === "failed")
    return (
      <Badge variant="destructive" className="gap-1">
        <XCircle className="h-3 w-3" /> Failed
      </Badge>
    );
  if (status === "ignored")
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground">
        <MinusCircle className="h-3 w-3" /> Ignored
      </Badge>
    );
  return (
    <Badge variant="outline" className="gap-1">
      Received
    </Badge>
  );
}