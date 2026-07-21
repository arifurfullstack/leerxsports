import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { listMyCoachingThreads, type CoachingThread } from "@/lib/coaching-functions";
import { Clock, CheckCircle2, MessageSquare } from "lucide-react";

const threadsQuery = queryOptions({
  queryKey: ["coaching-threads"],
  queryFn: () => listMyCoachingThreads(),
});

export const Route = createFileRoute("/_authenticated/coaching/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(threadsQuery),
  head: () => ({
    meta: [
      { title: "Coaching — LEER Sports" },
      { name: "description", content: "Your private coaching threads." },
    ],
  }),
  component: CoachingIndex,
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-sm text-muted-foreground">
      {error.message}
    </div>
  ),
  notFoundComponent: () => <div className="p-8">Not found</div>,
});

function CoachingIndex() {
  const { data } = useSuspenseQuery(threadsQuery);
  return (
    <main className="mx-auto min-h-dvh max-w-4xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <span className="font-display text-xs uppercase tracking-[0.3em] text-primary">
          Coaching
        </span>
        <h1 className="mt-1 font-display text-3xl uppercase tracking-tight">
          Your Threads
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Private trainer feedback. One follow-up allowed per response.
        </p>
      </header>

      {data.asTrainer.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 font-display text-sm uppercase tracking-widest text-muted-foreground">
            Incoming ({data.asTrainer.length})
          </h2>
          <ThreadList threads={data.asTrainer} viewerRole="trainer" />
        </section>
      )}

      <section>
        <h2 className="mb-3 font-display text-sm uppercase tracking-widest text-muted-foreground">
          Your Requests ({data.asTrainee.length})
        </h2>
        {data.asTrainee.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            You haven't opened any coaching threads yet. Visit a subscribed
            trainer's profile and click Ask a Question.
          </div>
        ) : (
          <ThreadList threads={data.asTrainee} viewerRole="trainee" />
        )}
      </section>
    </main>
  );
}

function ThreadList({
  threads,
  viewerRole,
}: {
  threads: CoachingThread[];
  viewerRole: "trainer" | "trainee";
}) {
  return (
    <ul className="space-y-2">
      {threads.map((t) => {
        const other = viewerRole === "trainee" ? t.trainer : t.subscriber;
        return (
          <li key={t.id}>
            <Link
              to="/coaching/$threadId"
              params={{ threadId: t.id }}
              className="block rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-display uppercase tracking-tight">
                    {t.title}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {viewerRole === "trainee" ? "To" : "From"}{" "}
                    {other?.display_name ?? other?.username ?? "user"} ·{" "}
                    {new Date(t.created_at).toLocaleDateString()}
                  </p>
                </div>
                <StatusBadge status={t.status} deadline={t.deadline_at} />
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function StatusBadge({
  status,
  deadline,
}: {
  status: CoachingThread["status"];
  deadline: string | null;
}) {
  const overdue =
    status === "pending" &&
    deadline &&
    new Date(deadline).getTime() < Date.now();
  const label =
    status === "pending"
      ? overdue
        ? "Overdue"
        : "Pending"
      : status === "coached"
        ? "Coached"
        : status === "follow_up_submitted"
          ? "Follow-up"
          : status === "final_response_submitted"
            ? "Final Sent"
            : status === "coaching_completed"
              ? "Completed"
              : status === "cancelled"
                ? "Cancelled"
                : status;
  const Icon =
    status === "coaching_completed"
      ? CheckCircle2
      : status === "pending"
        ? Clock
        : MessageSquare;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest ${
        overdue
          ? "border-destructive text-destructive"
          : status === "coaching_completed"
            ? "border-primary/50 text-primary"
            : "border-border text-muted-foreground"
      }`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}