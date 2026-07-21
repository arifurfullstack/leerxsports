import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getOnboardingState } from "@/lib/onboarding-functions";
import { listMyPosts, deletePost } from "@/lib/post-functions";
import { PostComposer } from "@/components/post-composer";
import { TransformationComposer } from "@/components/transformation-composer";
import {
  listMyTransformations,
  deleteTransformation,
  updateTraineeProfile,
} from "@/lib/transformation-functions";
import {
  getTrainerBalance,
  listTrainerTransactions,
  listMyPayouts,
  requestPayout,
} from "@/lib/payments-functions";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Lock, Trash2, Play, BadgeCheck, Wallet, Loader2 } from "lucide-react";
import { toast } from "sonner";

const onboardingStateQuery = queryOptions({
  queryKey: ["onboarding-state"],
  queryFn: () => getOnboardingState(),
});

const myPostsQuery = queryOptions({
  queryKey: ["my-posts"],
  queryFn: () => listMyPosts(),
});

const myTransformationsQuery = queryOptions({
  queryKey: ["my-transformations"],
  queryFn: () => listMyTransformations(),
});

export const Route = createFileRoute("/_authenticated/dashboard")({
  loader: ({ context }) => context.queryClient.ensureQueryData(onboardingStateQuery),
  head: () => ({
    meta: [
      { title: "Dashboard — LEER Sports" },
      { name: "description", content: "Your LEER Sports dashboard." },
      { property: "og:title", content: "Dashboard — LEER Sports" },
      { property: "og:description", content: "Your LEER Sports dashboard." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: DashboardPage,
  errorComponent: DashboardError,
  notFoundComponent: DashboardNotFound,
});

function DashboardPage() {
  const { data: state } = useSuspenseQuery(onboardingStateQuery);

  return (
    <main className="min-h-dvh bg-background py-12">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <header className="mb-8">
          <span className="font-display text-xs uppercase tracking-[0.3em] text-primary">
            {state.isTrainer ? "Trainer" : state.isAdmin ? "Admin" : "Trainee"}
          </span>
          <h1 className="mt-1 font-display text-3xl uppercase tracking-tight">
            {state.profile?.display_name ?? "Your Dashboard"}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {state.isTrainer
              ? "Publish content, manage your posts, grow your community."
              : "Discover trainers and unlock premium fitness content."}
          </p>
        </header>

        {state.isTrainer ? (
          <TrainerDashboard userId={state.userId} username={state.profile?.username ?? null} />
        ) : (
          <TraineeDashboard
            userId={state.userId}
            username={state.profile?.username ?? null}
            applicationStatus={state.trainerApplication?.status ?? null}
          />
        )}
      </div>
    </main>
  );
}

function TraineeDashboard({
  userId,
  username,
  applicationStatus,
}: {
  userId: string;
  username: string | null;
  applicationStatus: string | null;
}) {
  return (
    <div className="space-y-6">
      {applicationStatus && (
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="font-display uppercase tracking-widest text-sm">
            Trainer Application:{" "}
            <span className="text-primary">{applicationStatus}</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {applicationStatus === "pending" &&
              "Our team is reviewing your application. This typically takes 24–48 hours."}
            {applicationStatus === "approved" &&
              "Your application was approved. Refresh this page to enter the Trainer dashboard."}
            {applicationStatus === "rejected" &&
              "Your application was declined. You may re-apply after 30 days."}
            {applicationStatus === "resubmit" &&
              "Please update and resubmit your application from the onboarding flow."}
          </p>
        </div>
      )}

      <div className="flex flex-col justify-between gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center">
        <div>
          <p className="font-display uppercase tracking-widest text-sm">Your Public Profile</p>
          <p className="text-xs text-muted-foreground">
            {username ? `leersports.app/u/${username}` : "Finish onboarding to claim your handle."}
          </p>
        </div>
        <div className="flex gap-2">
          {username && (
            <Link to="/u/$username" params={{ username }}>
              <Button variant="outline" size="sm">
                View Public Profile
              </Button>
            </Link>
          )}
          <Link to="/trainers">
            <Button size="sm">Explore Trainers</Button>
          </Link>
        </div>
      </div>

      <ProfileSettingsCard />
      <TransformationComposer userId={userId} />
      <MyTransformationsGrid />
    </div>
  );
}

function ProfileSettingsCard() {
  const { data: state } = useSuspenseQuery(onboardingStateQuery);
  const [bio, setBio] = useState<string>(state.profile?.display_name ? "" : "");
  const [goal, setGoal] = useState("");
  const [prs, setPrs] = useState("");
  const [profileVis, setProfileVis] = useState<"public" | "subscribers" | "private">("public");
  const [txVis, setTxVis] = useState<"public" | "subscribers" | "private">("public");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();
  const update = useServerFn(updateTraineeProfile);

  const save = useMutation({
    mutationFn: () =>
      update({
        data: {
          bio: bio.trim() || null,
          goal: goal.trim() || null,
          personal_records: prs.trim() || null,
          profile_visibility: profileVis,
          transformation_visibility: txVis,
        },
      }),
    onSuccess: () => {
      setSaved(true);
      setError(null);
      qc.invalidateQueries({ queryKey: ["onboarding-state"] });
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h2 className="font-display text-lg uppercase tracking-widest">Profile & Privacy</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="bio">Bio</Label>
          <Textarea
            id="bio"
            rows={2}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="mt-1"
            placeholder="Tell the community about yourself"
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="goal">Current goal</Label>
          <Input
            id="goal"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            className="mt-1"
            placeholder="e.g. Cut to 12% body fat by June"
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="prs">Personal records</Label>
          <Textarea
            id="prs"
            rows={3}
            value={prs}
            onChange={(e) => setPrs(e.target.value)}
            className="mt-1"
            placeholder={"Bench 100kg\nSquat 140kg\nDeadlift 180kg"}
          />
        </div>
        <div>
          <Label>Profile visibility</Label>
          <select
            value={profileVis}
            onChange={(e) => setProfileVis(e.target.value as typeof profileVis)}
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="public">Public</option>
            <option value="subscribers">Subscribers only</option>
            <option value="private">Private</option>
          </select>
        </div>
        <div>
          <Label>Transformation visibility</Label>
          <select
            value={txVis}
            onChange={(e) => setTxVis(e.target.value as typeof txVis)}
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="public">Public</option>
            <option value="subscribers">Subscribers only</option>
            <option value="private">Private</option>
          </select>
        </div>
      </div>
      {error && (
        <p className="mt-3 rounded border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive">
          {error}
        </p>
      )}
      <div className="mt-4 flex items-center justify-end gap-3">
        {saved && <span className="text-xs text-primary">Saved</span>}
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
          Save Changes
        </Button>
      </div>
    </div>
  );
}

function MyTransformationsGrid() {
  const { data, isLoading } = useQuery(myTransformationsQuery);
  const qc = useQueryClient();
  const del = useServerFn(deleteTransformation);
  const remove = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-transformations"] }),
  });

  return (
    <section>
      <h2 className="font-display text-lg uppercase tracking-widest">
        Your Transformation ({data?.length ?? 0})
      </h2>
      {isLoading ? (
        <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
      ) : data && data.length > 0 ? (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {data.map((t) => (
            <div
              key={t.id}
              className="group relative aspect-square overflow-hidden rounded-md border border-border bg-muted"
            >
              {t.kind === "video" ? (
                <video src={t.media_url} muted loop className="h-full w-full object-cover" />
              ) : (
                <img
                  src={t.thumbnail_url ?? t.media_url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              )}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent px-2 py-1 text-[10px] text-white">
                <span>{new Date(t.captured_on).toLocaleDateString()}</span>
                <span className="uppercase tracking-widest opacity-70">
                  {t.visibility === "public"
                    ? "PUB"
                    : t.visibility === "subscribers"
                      ? "SUB"
                      : "PRV"}
                </span>
              </div>
              <button
                onClick={() => remove.mutate(t.id)}
                disabled={remove.isPending}
                className="absolute right-1 top-1 rounded-full bg-background/80 p-1 text-foreground opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="Delete"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No transformation entries yet. Log your first one above.
        </div>
      )}
    </section>
  );
}

function TrainerDashboard({
  userId,
  username,
}: {
  userId: string;
  username: string | null;
}) {
  const { data: posts, isLoading } = useQuery(myPostsQuery);
  const qc = useQueryClient();
  const deletePostFn = useServerFn(deletePost);
  const del = useMutation({
    mutationFn: (id: string) => deletePostFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-posts"] });
      qc.invalidateQueries({ queryKey: ["trainer"] });
    },
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
        <div>
          <p className="flex items-center gap-1.5 font-display uppercase tracking-widest text-sm">
            <BadgeCheck className="h-4 w-4 text-primary" /> Verified Trainer
          </p>
          <p className="text-xs text-muted-foreground">
            Public profile: /trainers/{username ?? "(set a username)"}
          </p>
        </div>
        {username && (
          <Link to="/trainers/$username" params={{ username }}>
            <Button variant="outline" size="sm">
              View Public Profile
            </Button>
          </Link>
        )}
      </div>

      <PostComposer userId={userId} />

      <TrainerEarningsCard />

      <section>
        <h2 className="font-display text-lg uppercase tracking-widest">
          Your Posts ({posts?.length ?? 0})
        </h2>
        {isLoading ? (
          <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
        ) : posts && posts.length > 0 ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((p) => (
              <div
                key={p.id}
                className="group relative overflow-hidden rounded-md border border-border bg-card"
              >
                <div className="relative aspect-square bg-muted">
                  {p.thumbnail_url || p.media_url ? (
                    p.kind === "short" ? (
                      <video
                        src={p.media_url}
                        muted
                        loop
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <img
                        src={p.thumbnail_url ?? p.media_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    )
                  ) : null}
                  {p.is_premium && (
                    <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-background/80 px-2 py-0.5 text-[10px] uppercase tracking-widest text-primary">
                      <Lock className="h-3 w-3" /> Premium
                    </div>
                  )}
                  {p.kind === "short" && (
                    <div className="absolute left-2 top-2 rounded-full bg-background/80 p-1">
                      <Play className="h-3 w-3" />
                    </div>
                  )}
                </div>
                <div className="p-3">
                  {p.caption && (
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {p.caption}
                    </p>
                  )}
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString()}
                    </span>
                    <button
                      onClick={() => del.mutate(p.id)}
                      disabled={del.isPending}
                      className="text-muted-foreground transition-colors hover:text-destructive"
                      aria-label="Delete post"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            You haven't published any posts yet. Upload your first one above.
          </div>
        )}
      </section>
    </div>
  );
}

function DashboardError({ error }: { error: Error }) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 text-center">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Could not load bookings</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      </div>
    </div>
  );
}

function TrainerEarningsCard() {
  const qc = useQueryClient();
  const balanceQ = useQuery({
    queryKey: ["trainer-balance"],
    queryFn: () => getTrainerBalance(),
  });
  const txQ = useQuery({
    queryKey: ["trainer-transactions"],
    queryFn: () => listTrainerTransactions(),
  });
  const payoutsQ = useQuery({
    queryKey: ["trainer-payouts"],
    queryFn: () => listMyPayouts(),
  });
  const [amount, setAmount] = useState<number>(0);
  const [method, setMethod] = useState<"stripe" | "bank" | "paypal" | "other">("stripe");
  const [detail, setDetail] = useState("");
  const req = useServerFn(requestPayout);
  const mut = useMutation({
    mutationFn: () =>
      req({
        data: {
          amount,
          method,
          method_details: detail ? { destination: detail } : undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Payout requested");
      setAmount(0);
      setDetail("");
      qc.invalidateQueries({ queryKey: ["trainer-balance"] });
      qc.invalidateQueries({ queryKey: ["trainer-payouts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const bal = balanceQ.data;
  const currency = bal?.currency ?? "USD";
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <Wallet className="h-4 w-4 text-primary" />
        <h2 className="font-display text-lg uppercase tracking-widest">Earnings</h2>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <BalanceStat label="Available" value={fmt(bal?.available_amount ?? 0)} highlight />
        <BalanceStat label="Pending" value={fmt(bal?.pending_amount ?? 0)} />
        <BalanceStat label="Frozen" value={fmt(bal?.frozen_amount ?? 0)} />
        <BalanceStat label="Paid out" value={fmt(bal?.paid_out_amount ?? 0)} />
      </div>

      <div className="mt-6 rounded-md border border-border p-4">
        <h3 className="font-display text-sm uppercase tracking-widest">Request payout</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <div>
            <Label htmlFor="payout-amount">Amount</Label>
            <Input
              id="payout-amount"
              type="number"
              min={0}
              step="1"
              value={amount || ""}
              onChange={(e) => setAmount(Number(e.target.value) || 0)}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Method</Label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as typeof method)}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="stripe">Stripe</option>
              <option value="bank">Bank transfer</option>
              <option value="paypal">PayPal</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="payout-detail">Destination</Label>
            <Input
              id="payout-detail"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="e.g. IBAN, PayPal email, Stripe account"
              className="mt-1"
            />
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <Button
            size="sm"
            disabled={mut.isPending || amount <= 0}
            onClick={() => mut.mutate()}
          >
            {mut.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            Request Payout
          </Button>
        </div>
      </div>

      {payoutsQ.data && payoutsQ.data.length > 0 && (
        <div className="mt-5">
          <h3 className="font-display text-sm uppercase tracking-widest">Payout history</h3>
          <ul className="mt-2 divide-y divide-border rounded-md border border-border text-sm">
            {payoutsQ.data.map((p) => (
              <li key={p.id} className="flex items-center justify-between px-3 py-2">
                <span>{fmt(p.amount)} · {p.method}</span>
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  {p.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {txQ.data && txQ.data.length > 0 && (
        <div className="mt-5">
          <h3 className="font-display text-sm uppercase tracking-widest">
            Recent transactions
          </h3>
          <ul className="mt-2 divide-y divide-border rounded-md border border-border text-sm">
            {txQ.data.slice(0, 8).map((t) => (
              <li key={t.id} className="flex items-center justify-between px-3 py-2">
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">
                    {t.kind}
                  </p>
                  <p>{t.counterparty ?? "—"}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">+{fmt(t.trainer_amount)}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(t.created_at).toLocaleDateString()}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function BalanceStat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-md border p-3 ${
        highlight
          ? "border-primary/40 bg-primary/5"
          : "border-border bg-background"
      }`}
    >
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className={`mt-1 font-display text-lg ${highlight ? "text-primary" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function DashboardNotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 text-center">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Page not found</h1>
      </div>
    </div>
  );
}
