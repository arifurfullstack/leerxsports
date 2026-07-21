import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, Clock, Flag, Heart, Loader2, Send } from "lucide-react";
import {
  getCoachingThread,
  submitFinalResponse,
  submitFollowUp,
  submitPrimaryResponse,
  type CoachingMessage,
  type CoachingThread,
} from "@/lib/coaching-functions";
import {
  getPlatformSettings,
  listRecentTipsForTrainer,
} from "@/lib/payments-functions";
import { openCoachingDispute } from "@/lib/moderation-functions";
import { ReportDialog } from "@/components/report-dialog";
import { TipModal } from "@/components/tip-modal";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

function threadQuery(id: string) {
  return queryOptions({
    queryKey: ["coaching-thread", id],
    queryFn: () => getCoachingThread({ data: { id } }),
  });
}

export const Route = createFileRoute("/_authenticated/coaching/$threadId")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(threadQuery(params.threadId)),
  head: () => ({
    meta: [{ title: "Coaching Thread — LEER Sports" }],
  }),
  component: ThreadPage,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="mx-auto max-w-2xl p-8 text-center">
        <h1 className="font-display text-2xl">Could not load thread</h1>
        <p className="text-muted-foreground">{error.message}</p>
        <Button
          className="mt-4"
          onClick={() => {
            router.invalidate();
            reset();
          }}
        >
          Retry
        </Button>
      </div>
    );
  },
  notFoundComponent: () => (
    <div className="p-8 text-center">
      <Link to="/coaching" className="text-primary underline">
        Back to coaching
      </Link>
    </div>
  ),
});

function ThreadPage() {
  const { threadId } = Route.useParams();
  const { data } = useSuspenseQuery(threadQuery(threadId));
  const { thread, messages, viewerRole } = data;
  const other = viewerRole === "trainee" ? thread.trainer : thread.subscriber;
  const trainerName =
    thread.trainer?.display_name ?? thread.trainer?.username ?? "Trainer";

  const showTipSection =
    viewerRole === "trainee" && thread.status === "coaching_completed";

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-4 py-10 sm:px-6">
      <Link
        to="/coaching"
        className="mb-4 inline-flex items-center gap-1 text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> All threads
      </Link>

      <header className="mb-6 rounded-lg border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
              {viewerRole === "trainee" ? "To" : "From"}{" "}
              {other?.display_name ?? other?.username ?? "user"}
            </p>
            <h1 className="mt-1 font-display text-2xl uppercase tracking-tight">
              {thread.title}
            </h1>
          </div>
          <StatusChip thread={thread} />
        </div>
        {(thread.exercise || thread.goal || thread.injury_info) && (
          <dl className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
            {thread.exercise && (
              <MetaCell label="Exercise" value={thread.exercise} />
            )}
            {thread.goal && <MetaCell label="Goal" value={thread.goal} />}
            {thread.injury_info && (
              <MetaCell label="Injuries" value={thread.injury_info} />
            )}
          </dl>
        )}
      </header>

      <section className="space-y-3">
        {messages.map((m) => (
          <MessageBubble key={m.id} msg={m} thread={thread} />
        ))}
      </section>

      <ReplyBox thread={thread} messages={messages} viewerRole={viewerRole} />
      {showTipSection && (
        <TipSection
          trainerId={thread.trainer_id}
          trainerName={trainerName}
          threadId={thread.id}
        />
      )}
      {thread.status === "coaching_completed" && (
        <DisputeSection thread={thread} viewerRole={viewerRole} />
      )}
    </main>
  );
}

function DisputeSection({
  thread,
  viewerRole,
}: {
  thread: CoachingThread;
  viewerRole: "trainee" | "trainer";
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState("");
  const dispute = useServerFn(openCoachingDispute);
  const mut = useMutation({
    mutationFn: () =>
      dispute({ data: { threadId: thread.id, reason } }),
    onSuccess: () => {
      toast.success("Dispute opened. Our team will review shortly.");
      setOpen(false);
      setReason("");
      qc.invalidateQueries({ queryKey: ["coaching-thread", thread.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const windowClosed =
    thread.completed_at &&
    Date.now() - new Date(thread.completed_at).getTime() > 24 * 3600 * 1000;

  return (
    <div className="mt-6 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          {windowClosed
            ? "Dispute window has closed."
            : "Not satisfied with this coaching? You have 24h to dispute."}
        </p>
        <div className="flex gap-2">
          {!windowClosed && (
            <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
              Open dispute
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setReportOpen(true)}
            aria-label="Report thread"
          >
            <Flag className="mr-1 h-3 w-3" /> Report
          </Button>
        </div>
      </div>

      {open && (
        <div className="mt-3 space-y-2 rounded-md border border-border bg-card p-3">
          <Textarea
            placeholder="Explain what went wrong (10+ chars)"
            rows={4}
            maxLength={2000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={reason.trim().length < 10 || mut.isPending}
              onClick={() => mut.mutate()}
            >
              {mut.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              Submit dispute
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Filing a dispute freezes the trainer's earnings for this thread until admins resolve it.
          </p>
        </div>
      )}

      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        targetType="coaching_thread"
        targetId={thread.id}
      />
      {/* keep reference to viewerRole so unused-var lint stays quiet */}
      <span className="sr-only">{viewerRole}</span>
    </div>
  );
}

function TipSection({
  trainerId,
  trainerName,
  threadId,
}: {
  trainerId: string;
  trainerName: string;
  threadId: string;
}) {
  const [open, setOpen] = useState(false);
  const settingsQ = useQuery({
    queryKey: ["platform-settings"],
    queryFn: () => getPlatformSettings(),
  });
  const tipsQ = useQuery({
    queryKey: ["thread-tips", threadId, trainerId],
    queryFn: () => listRecentTipsForTrainer({ data: { trainerId } }),
  });
  const alreadyTipped = (tipsQ.data ?? []).some(
    (t) => new Date(t.created_at).getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000,
  );
  useEffect(() => {
    if (!alreadyTipped && !tipsQ.isLoading && !open) {
      const t = setTimeout(() => setOpen(true), 400);
      return () => clearTimeout(t);
    }
  }, [alreadyTipped, tipsQ.isLoading]); // eslint-disable-line react-hooks/exhaustive-deps
  const presets = settingsQ.data?.tip_presets ?? [5, 15, 30];

  return (
    <div className="mt-6 rounded-lg border border-primary/30 bg-primary/5 p-5 text-center">
      <Heart className="mx-auto h-6 w-6 text-primary" />
      <h2 className="mt-2 font-display text-lg uppercase tracking-widest">
        Thank {trainerName}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Send a tip if this coaching helped you. 100% goes toward your trainer's earnings (minus platform fee).
      </p>
      <Button className="mt-3" onClick={() => setOpen(true)}>
        <Heart className="mr-1 h-4 w-4" /> Send a Tip
      </Button>
      <TipModal
        open={open}
        onOpenChange={setOpen}
        trainerId={trainerId}
        trainerName={trainerName}
        presets={presets}
        threadId={threadId}
        onSuccess={() => tipsQ.refetch()}
      />
    </div>
  );
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-widest">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap text-foreground">{value}</dd>
    </div>
  );
}

function MessageBubble({
  msg,
  thread,
}: {
  msg: CoachingMessage;
  thread: CoachingThread;
}) {
  const isTrainer = msg.role === "trainer";
  const who =
    isTrainer
      ? thread.trainer?.display_name ?? thread.trainer?.username ?? "Trainer"
      : thread.subscriber?.display_name ??
        thread.subscriber?.username ??
        "Trainee";
  const kindLabel: Record<CoachingMessage["kind"], string> = {
    primary_question: "Primary Question",
    primary_response: "Coach Response",
    follow_up: "Follow-Up",
    final_response: "Final Response",
  };
  return (
    <article
      className={`rounded-lg border p-4 ${
        isTrainer
          ? "border-primary/30 bg-primary/5"
          : "border-border bg-card"
      }`}
    >
      <header className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-widest text-muted-foreground">
        <span>{who}</span>
        <span>{kindLabel[msg.kind]}</span>
      </header>
      <p className="whitespace-pre-wrap text-sm">{msg.text}</p>
      <p className="mt-2 text-[10px] text-muted-foreground">
        {new Date(msg.created_at).toLocaleString()}
      </p>
    </article>
  );
}

function StatusChip({ thread }: { thread: CoachingThread }) {
  const overdue =
    thread.status === "pending" &&
    thread.deadline_at &&
    new Date(thread.deadline_at).getTime() < Date.now();
  const label =
    thread.status === "coaching_completed"
      ? "Completed"
      : overdue
        ? "Overdue"
        : thread.status.replace(/_/g, " ");
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest ${
        overdue
          ? "border-destructive text-destructive"
          : thread.status === "coaching_completed"
            ? "border-primary/50 text-primary"
            : "border-border text-muted-foreground"
      }`}
    >
      <Clock className="h-3 w-3" />
      {label}
    </span>
  );
}

function ReplyBox({
  thread,
  messages,
  viewerRole,
}: {
  thread: CoachingThread;
  messages: CoachingMessage[];
  viewerRole: "trainee" | "trainer";
}) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const primaryFn = useServerFn(submitPrimaryResponse);
  const followFn = useServerFn(submitFollowUp);
  const finalFn = useServerFn(submitFinalResponse);

  // Determine which action, if any, is allowed
  const hasPrimary = messages.some((m) => m.kind === "primary_response");
  const hasFollowUp = messages.some((m) => m.kind === "follow_up");
  const hasFinal = messages.some((m) => m.kind === "final_response");

  let action:
    | { label: string; fn: (text: string) => Promise<unknown> }
    | null = null;
  if (viewerRole === "trainer" && !hasPrimary && thread.status === "pending") {
    action = {
      label: "Send Coach Response",
      fn: (t) => primaryFn({ data: { threadId: thread.id, text: t } }),
    };
  } else if (
    viewerRole === "trainee" &&
    hasPrimary &&
    !hasFollowUp &&
    thread.status === "coached"
  ) {
    action = {
      label: "Send Follow-Up",
      fn: (t) => followFn({ data: { threadId: thread.id, text: t } }),
    };
  } else if (
    viewerRole === "trainer" &&
    hasFollowUp &&
    !hasFinal &&
    thread.status === "follow_up_submitted"
  ) {
    action = {
      label: "Send Final Response",
      fn: (t) => finalFn({ data: { threadId: thread.id, text: t } }),
    };
  }

  const mut = useMutation({
    mutationFn: (t: string) => action!.fn(t),
    onSuccess: () => {
      toast.success("Message sent");
      setText("");
      qc.invalidateQueries({ queryKey: ["coaching-thread", thread.id] });
      qc.invalidateQueries({ queryKey: ["coaching-threads"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!action) {
    return (
      <div className="mt-8 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        {thread.status === "coaching_completed"
          ? "This coaching thread is complete and read-only."
          : viewerRole === "trainee"
            ? "Waiting on the trainer's response."
            : "Waiting on the trainee's follow-up."}
      </div>
    );
  }

  return (
    <div className="mt-8 rounded-lg border border-border bg-card p-4">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write your response…"
        rows={5}
        maxLength={4000}
      />
      <div className="mt-3 flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">
          {text.length}/4000
        </p>
        <Button
          disabled={text.trim().length < 1 || mut.isPending}
          onClick={() => mut.mutate(text.trim())}
        >
          {mut.isPending ? (
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          ) : (
            <Send className="mr-1 h-3 w-3" />
          )}
          {action.label}
        </Button>
      </div>
    </div>
  );
}