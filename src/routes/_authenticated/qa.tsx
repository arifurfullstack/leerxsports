import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { HelpCircle, Loader2, Clock, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import SLACountdown from "@/components/sla-countdown";
import {
  answerQADispatch,
  listMyQADispatches,
  QA_PRICE,
  type QADispatch,
} from "@/lib/qa-functions";

export const Route = createFileRoute("/_authenticated/qa")({
  component: QAInbox,
  head: () => ({
    meta: [
      { title: "Paid Q&A · LEER" },
      {
        name: "description",
        content: `Send or answer paid $${QA_PRICE} questions to the LEER creator community.`,
      },
      { property: "og:title", content: "Paid Q&A · LEER" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function statusIcon(s: QADispatch["status"]) {
  if (s === "answered") return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (s === "pending") return <Clock className="h-4 w-4 text-amber-500" />;
  return <XCircle className="h-4 w-4 text-muted-foreground" />;
}

function QAInbox() {
  const list = useServerFn(listMyQADispatches);
  const qc = useQueryClient();
  const [tab, setTab] = useState<"received" | "sent">("received");

  const received = useQuery({
    queryKey: ["qa", "creator"],
    queryFn: () => list({ data: { role: "creator" } }),
  });
  const sent = useQuery({
    queryKey: ["qa", "fan"],
    queryFn: () => list({ data: { role: "fan" } }),
  });

  // Count overdue pending requests for the trainer
  const overdueCount = (received.data ?? []).filter((d) => {
    if (d.status !== "pending") return false;
    const deadline = new Date(d.created_at).getTime() + 48 * 60 * 60 * 1000;
    return Date.now() > deadline;
  }).length;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8">
        <div className="flex items-center gap-2 text-premium">
          <HelpCircle className="h-4 w-4" />
          <span className="text-xs uppercase tracking-[0.2em]">Paid Q&A</span>
        </div>
        <h1 className="mt-1 font-display text-3xl uppercase">Questions</h1>
        <p className="text-sm text-muted-foreground">
          Every question is a ${QA_PRICE} paid dispatch. Creators have 48 hours to answer or the fan is refunded.
        </p>
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="received">
            Received{received.data ? ` (${received.data.length})` : ""}
            {overdueCount > 0 && (
              <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                {overdueCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="sent">
            Sent{sent.data ? ` (${sent.data.length})` : ""}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="received" className="mt-6 space-y-4">
          {received.isLoading && <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />}
          {received.data?.length === 0 && (
            <EmptyState text="No questions yet. Share your profile to get inbound." />
          )}
          {received.data?.map((d) => (
            <ReceivedCard key={d.id} d={d} onAnswered={() => qc.invalidateQueries({ queryKey: ["qa"] })} />
          ))}
        </TabsContent>

        <TabsContent value="sent" className="mt-6 space-y-4">
          {sent.isLoading && <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />}
          {sent.data?.length === 0 && (
            <EmptyState text="You haven't asked anything yet. Find a creator and hit Ask · $300 on their profile." />
          )}
          {sent.data?.map((d) => <SentCard key={d.id} d={d} />)}
        </TabsContent>
      </Tabs>
    </main>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-8 text-center">
      <HelpCircle className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function Meta({ d }: { d: QADispatch }) {
  const created = new Date(d.created_at).toLocaleDateString();
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      {statusIcon(d.status)}
      <span className="uppercase tracking-widest">{d.status}</span>
      <span>· ${Number(d.price).toFixed(2)}</span>
      <span>· sent {created}</span>
      {d.status === "pending" && (
        <SLACountdown createdAt={d.created_at} deadlineHours={48} compact />
      )}
    </div>
  );
}

function ReceivedCard({ d, onAnswered }: { d: QADispatch; onAnswered: () => void }) {
  const answer = useServerFn(answerQADispatch);
  const [text, setText] = useState("");
  const mut = useMutation({
    mutationFn: () => answer({ data: { dispatchId: d.id, answer: text } }),
    onSuccess: () => {
      toast.success("Answer sent. Payout released.");
      setText("");
      onAnswered();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const from = d.fan?.display_name ?? d.fan?.username ?? "A fan";

  return (
    <article className="rounded-lg border border-border/60 bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-medium">From {from}</div>
        <Meta d={d} />
      </div>
      <p className="whitespace-pre-wrap text-sm">{d.question}</p>
      {d.status === "answered" && d.answer && (
        <div className="mt-4 rounded-md border-l-2 border-premium bg-muted/30 p-3 text-sm">
          <div className="mb-1 text-xs uppercase tracking-widest text-premium">Your answer</div>
          <p className="whitespace-pre-wrap">{d.answer}</p>
        </div>
      )}
      {d.status === "pending" && (
        <div className="mt-4 space-y-3">
          {/* Prominent SLA countdown for trainer */}
          <div className="flex items-center gap-2">
            <SLACountdown createdAt={d.created_at} deadlineHours={48} />
          </div>
          <Textarea
            placeholder="Write your answer…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            maxLength={5000}
          />
          <div className="flex justify-end">
            <Button
              className="bg-premium ring-premium font-semibold uppercase tracking-widest"
              disabled={text.trim().length < 10 || mut.isPending}
              onClick={() => mut.mutate()}
            >
              {mut.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Answer · Release ${Number(d.price).toFixed(2)}
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}

function SentCard({ d }: { d: QADispatch }) {
  const to = d.creator?.display_name ?? d.creator?.username ?? "creator";
  return (
    <article className="rounded-lg border border-border/60 bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-medium">To {to}</div>
        <Meta d={d} />
      </div>
      <p className="whitespace-pre-wrap text-sm">{d.question}</p>
      {d.answer ? (
        <div className="mt-4 rounded-md border-l-2 border-premium bg-muted/30 p-3 text-sm">
          <div className="mb-1 text-xs uppercase tracking-widest text-premium">Answer</div>
          <p className="whitespace-pre-wrap">{d.answer}</p>
        </div>
      ) : d.status === "pending" ? (
        <div className="mt-3 flex items-center gap-2">
          <p className="text-xs text-muted-foreground">Waiting on {to} to answer.</p>
          <SLACountdown createdAt={d.created_at} deadlineHours={48} compact />
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          No answer within the deadline — refund processed.
        </p>
      )}
    </article>
  );
}
