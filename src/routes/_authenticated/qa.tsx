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
import { TranslateToggle } from "@/components/translate-toggle";
import { CoachingDisputeModal } from "@/components/coaching-dispute-modal";
import { CompletionTipModal } from "@/components/completion-tip-modal";
import { AlertTriangle, Heart } from "lucide-react";
import {
  answerQADispatch,
  submitQAFollowup,
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
          <span className="text-xs uppercase tracking-[0.2em]">Private Coaching</span>
        </div>
        <h1 className="mt-1 font-display text-3xl uppercase">Coaching Inbox</h1>
        <p className="text-sm text-muted-foreground">
          5-Step 1:1 Private Coaching sessions. Submit workout videos, receive HD video feedback, and 1 follow-up reply per session.
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
          {received.isError && (
            <EmptyState text={`Error loading received questions: ${(received.error as Error)?.message}`} />
          )}
          {!received.isLoading && !received.isError && (received.data ?? []).length === 0 && (
            <EmptyState text="No coaching dispatches yet. Share your profile to get inbound subscribers." />
          )}
          {received.data?.map((d) => (
            <ReceivedCard key={d.id} d={d} onAnswered={() => qc.invalidateQueries({ queryKey: ["qa"] })} />
          ))}
        </TabsContent>

        <TabsContent value="sent" className="mt-6 space-y-4">
          {sent.isLoading && <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />}
          {sent.isError && (
            <EmptyState text={`Error loading sent questions: ${(sent.error as Error)?.message}`} />
          )}
          {!sent.isLoading && !sent.isError && (sent.data ?? []).length === 0 && (
            <EmptyState text="You haven't requested coaching yet. Find a creator and hit Ask · $300 on their profile." />
          )}
          {sent.data?.map((d) => (
            <SentCard key={d.id} d={d} onFollowupSent={() => qc.invalidateQueries({ queryKey: ["qa"] })} />
          ))}
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
  const label =
    d.status === "completed"
      ? "COACHING COMPLETED (LOCKED)"
      : d.status === "coached"
        ? "COACHED (1 FOLLOW-UP OPEN)"
        : d.status === "followup_pending"
          ? "FOLLOW-UP PENDING"
          : d.status.toUpperCase();
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      {statusIcon(d.status)}
      <span className="font-bold uppercase tracking-widest text-foreground">{label}</span>
      <span>· ${Number(d.price).toFixed(2)}</span>
      <span>· sent {created}</span>
      {(d.status === "pending" || d.status === "followup_pending") && (
        <SLACountdown createdAt={d.created_at} deadlineHours={48} compact />
      )}
    </div>
  );
}

function ReceivedCard({ d, onAnswered }: { d: QADispatch; onAnswered: () => void }) {
  const answer = useServerFn(answerQADispatch);
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const mut = useMutation({
    mutationFn: () => answer({ data: { dispatchId: d.id, answer: text } }),
    onSuccess: () => {
      toast.success("Answer sent successfully! Funds credited to your wallet.");
      setText("");
      qc.invalidateQueries({ queryKey: ["user-wallet"] });
      qc.invalidateQueries({ queryKey: ["qa"] });
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
      <TranslateToggle text={d.question} />
      
      {d.answer && (
        <div className="mt-4 rounded-md border-l-2 border-premium bg-muted/30 p-3 text-sm">
          <div className="mb-1 text-xs uppercase tracking-widest text-premium">Your Primary Feedback</div>
          <p className="whitespace-pre-wrap">{d.answer}</p>
          <TranslateToggle text={d.answer} />
        </div>
      )}

      {d.followup_question && (
        <div className="mt-4 rounded-md border-l-2 border-amber-500 bg-amber-500/10 p-3 text-sm">
          <div className="mb-1 text-xs font-bold uppercase tracking-widest text-amber-500">
            Trainee Follow-Up Question (Final Reply Allowed)
          </div>
          <p className="whitespace-pre-wrap">{d.followup_question}</p>
          <TranslateToggle text={d.followup_question} />
        </div>
      )}

      {d.followup_answer && (
        <div className="mt-4 rounded-md border-l-2 border-emerald-500 bg-emerald-500/10 p-3 text-sm">
          <div className="mb-1 text-xs font-bold uppercase tracking-widest text-emerald-500">
            Your Final Response
          </div>
          <p className="whitespace-pre-wrap">{d.followup_answer}</p>
          <TranslateToggle text={d.followup_answer} />
        </div>
      )}

      {d.status === "completed" && (
        <div className="mt-4 rounded-md border border-white/10 bg-black/40 p-3 text-center text-xs font-bold uppercase tracking-widest text-muted-foreground">
          🔒 Thread Locked · Coaching Session Completed
        </div>
      )}

      {(d.status === "pending" || d.status === "followup_pending") && (
        <div className="mt-4 space-y-3">
          <Textarea
            placeholder={d.status === "followup_pending" ? "Write your final response…" : "Write your posture feedback & coaching analysis…"}
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
              {d.status === "followup_pending" ? "Final Answer · Complete Session" : `Answer · Release $${Number(d.price).toFixed(2)}`}
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}

function SentCard({ d, onFollowupSent }: { d: QADispatch; onFollowupSent: () => void }) {
  const followupFn = useServerFn(submitQAFollowup);
  const [followupText, setFollowupText] = useState("");
  const [showDispute, setShowDispute] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const to = d.creator?.display_name ?? d.creator?.username ?? "creator";

  const followupMut = useMutation({
    mutationFn: () => followupFn({ data: { dispatchId: d.id, question: followupText } }),
    onSuccess: () => {
      toast.success("Follow-up submitted!");
      setFollowupText("");
      onFollowupSent();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <article className="rounded-lg border border-border/60 bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-medium">To {to}</div>
        <Meta d={d} />
      </div>
      <p className="whitespace-pre-wrap text-sm">{d.question}</p>
      <TranslateToggle text={d.question} />
      
      {d.answer && (
        <div className="mt-4 rounded-md border-l-2 border-premium bg-muted/30 p-3 text-sm">
          <div className="mb-1 text-xs uppercase tracking-widest text-premium">Trainer Feedback</div>
          <p className="whitespace-pre-wrap">{d.answer}</p>
          <TranslateToggle text={d.answer} />
        </div>
      )}

      {/* Step 3: Single Follow-Up Input */}
      {d.status === "coached" && !d.followup_question && (
        <div className="mt-4 space-y-3 rounded-md border border-sport/30 bg-sport/5 p-4">
          <div className="text-xs font-bold uppercase tracking-widest text-sport">
            ⚡ Ask Your 1 Allowed Follow-Up Question
          </div>
          <Textarea
            placeholder="Ask clarification on posture, reps, or program adjustments…"
            value={followupText}
            onChange={(e) => setFollowupText(e.target.value)}
            rows={3}
            maxLength={2000}
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              className="bg-sport text-white font-bold uppercase tracking-widest"
              disabled={followupText.trim().length < 5 || followupMut.isPending}
              onClick={() => followupMut.mutate()}
            >
              {followupMut.isPending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
              Submit 1 Follow-Up
            </Button>
          </div>
        </div>
      )}

      {d.followup_question && (
        <div className="mt-4 rounded-md border-l-2 border-amber-500 bg-amber-500/10 p-3 text-sm">
          <div className="mb-1 text-xs font-bold uppercase tracking-widest text-amber-500">Your Follow-Up</div>
          <p className="whitespace-pre-wrap">{d.followup_question}</p>
        </div>
      )}

      {d.followup_answer && (
        <div className="mt-4 rounded-md border-l-2 border-emerald-500 bg-emerald-500/10 p-3 text-sm">
          <div className="mb-1 text-xs font-bold uppercase tracking-widest text-emerald-500">Trainer Final Response</div>
          <p className="whitespace-pre-wrap">{d.followup_answer}</p>
        </div>
      )}

      {d.status === "disputing" && (
        <div className="mt-4 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-center text-xs font-bold uppercase tracking-widest text-amber-500">
          ⚡ Thread Under Admin Dispute Review
        </div>
      )}

      {d.status === "completed" && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-white/10 bg-black/40 p-3">
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            🔒 Thread Locked · Coaching Session Completed
          </span>
          <Button
            size="sm"
            variant="outline"
            className="border-amber-500/50 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 text-xs gap-1"
            onClick={() => setShowTip(true)}
          >
            <Heart className="h-3.5 w-3.5 fill-current" /> Send Tip
          </Button>
        </div>
      )}

      {d.status !== "disputing" && d.status !== "completed" && (
        <div className="mt-4 flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            className="text-xs text-muted-foreground hover:text-amber-500 gap-1"
            onClick={() => setShowDispute(true)}
          >
            <AlertTriangle className="h-3.5 w-3.5" /> Dispute Coaching
          </Button>
        </div>
      )}

      <CoachingDisputeModal
        open={showDispute}
        onOpenChange={setShowDispute}
        threadId={d.id}
        onSuccess={onFollowupSent}
      />

      <CompletionTipModal
        open={showTip}
        onOpenChange={setShowTip}
        trainerName={to}
        threadId={d.id}
      />
    </article>
  );
}
