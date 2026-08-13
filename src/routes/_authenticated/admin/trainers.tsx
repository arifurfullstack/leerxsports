import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { BadgeCheck, XCircle, RotateCcw, Clock, MapPin } from "lucide-react";
import {
  adminListTrainerApplications,
  adminReviewTrainerApplication,
} from "@/lib/admin-functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AdminNav } from "@/components/admin-nav";

const appsQuery = queryOptions({
  queryKey: ["admin-trainer-apps"],
  queryFn: () => adminListTrainerApplications(),
});

export const Route = createFileRoute("/_authenticated/admin/trainers")({
  loader: ({ context }) => context.queryClient.ensureQueryData(appsQuery),
  head: () => ({
    meta: [
      { title: "Admin — Trainer Applications — LEER Sports" },
      { name: "description", content: "Review pending trainer applications." },
    ],
  }),
  component: AdminTrainersPage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-destructive">{error.message}</div>
  ),
  notFoundComponent: () => <div className="p-8">Not found.</div>,
});

type Decision = "approved" | "rejected" | "resubmit";

function AdminTrainersPage() {
  const { data: apps } = useSuspenseQuery(appsQuery);
  const [filter, setFilter] = useState<"pending" | "all">("pending");

  const visible = apps.filter((a) =>
    filter === "pending" ? a.status === "pending" || a.status === "resubmit" : true,
  );

  return (
    <main className="min-h-dvh bg-background py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <span className="font-display text-xs uppercase tracking-[0.3em] text-primary">
              Admin
            </span>
            <h1 className="mt-1 font-display text-3xl uppercase tracking-tight">
              Trainer Applications
            </h1>
            <AdminNav />
          </div>
          <div className="flex gap-2">
            <Button
              variant={filter === "pending" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("pending")}
            >
              Pending
            </Button>
            <Button
              variant={filter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("all")}
            >
              All
            </Button>
          </div>
        </header>

        {visible.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-10 text-center text-sm text-muted-foreground">
            No applications to review.
          </div>
        ) : (
          <div className="space-y-4">
            {visible.map((a) => (
              <AppCard key={a.id} app={a} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

type App = Awaited<ReturnType<typeof adminListTrainerApplications>>[number];

function AppCard({ app }: { app: App }) {
  const [notes, setNotes] = useState(app.admin_notes ?? "");
  const qc = useQueryClient();
  const reviewFn = useServerFn(adminReviewTrainerApplication);
  const review = useMutation({
    mutationFn: (decision: Decision) =>
      reviewFn({ data: { applicationId: app.id, decision, notes: notes || null } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-trainer-apps"] });
      qc.invalidateQueries({ queryKey: ["navbar-trainer-status"] });
    },
  });

  const statusColor =
    app.status === "approved"
      ? "text-primary"
      : app.status === "rejected"
        ? "text-destructive"
        : "text-warning";

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-display text-xl uppercase">
              {app.public_trainer_name}
            </h3>
            <span
              className={`font-display text-[10px] uppercase tracking-widest ${statusColor}`}
            >
              {app.status}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Legal name: {app.full_legal_name}
          </p>
          <p className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {app.country}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(app.created_at).toLocaleDateString()}
            </span>
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-lg text-primary">
            ${Number(app.requested_price ?? 0).toFixed(2)}/mo
          </p>
          <p className="text-[11px] text-muted-foreground">Requested price</p>
        </div>
      </header>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
            Biography
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{app.biography}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
            Certifications
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm">
            {app.certification_details}
          </p>
          {app.certificates?.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs">
              {app.certificates.map((c, i) => (
                <li key={i}>
                  <a
                    href={c}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline break-all"
                  >
                    {c}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {app.specialties?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {app.specialties.map((s) => (
            <span
              key={s}
              className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground"
            >
              {s}
            </span>
          ))}
        </div>
      )}

      {(app.status === "pending" || app.status === "resubmit") && (
        <div className="mt-4 border-t border-border pt-4">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Admin notes (visible to the applicant if rejected or asked to resubmit)…"
            rows={2}
          />
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => review.mutate("resubmit")}
              disabled={review.isPending}
            >
              <RotateCcw className="mr-1 h-3 w-3" /> Ask to Resubmit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => review.mutate("rejected")}
              disabled={review.isPending}
            >
              <XCircle className="mr-1 h-3 w-3" /> Reject
            </Button>
            <Button
              size="sm"
              onClick={() => review.mutate("approved")}
              disabled={review.isPending}
            >
              <BadgeCheck className="mr-1 h-3 w-3" /> Approve
            </Button>
          </div>
          {review.isError && (
            <p className="mt-2 text-xs text-destructive">
              {(review.error as Error).message}
            </p>
          )}
        </div>
      )}

      {app.admin_notes && app.status !== "pending" && (
        <p className="mt-3 rounded border border-border bg-background p-2 text-xs text-muted-foreground">
          <strong>Notes:</strong> {app.admin_notes}
        </p>
      )}
    </div>
  );
}