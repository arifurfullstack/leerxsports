import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Wallet,
  TrendingUp,
  Clock,
  Loader2,
  ArrowUpRight,
  Ban,
  DollarSign,
  Receipt,
  LineChart,
  Sparkles,
  Plus,
  User,
} from "lucide-react";
import {
  getTrainerBalance,
  getEarningsSummary,
  listTrainerTransactions,
  getPlatformSettings,
  type TransactionRow,
} from "@/lib/payments-functions";
import { useProfileMode } from "@/lib/profile-mode-context";
import { CreatePostDialog } from "@/components/create-post-dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/creator/dashboard")({
  component: CreatorDashboard,
  head: () => ({
    meta: [
      { title: "Creator Dashboard · LEER" },
      { name: "robots", content: "noindex" },
      {
        name: "description",
        content:
          "Track your LEER earnings, payout-ready balance, and per-post revenue in one dashboard.",
      },
      { property: "og:title", content: "Creator Dashboard · LEER" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type KindFilter = "all" | "subscription" | "tip" | "unlock" | "qa" | "refund" | "adjustment";

function CreatorDashboard() {
  const { mode, switchMode } = useProfileMode();
  const [createPostOpen, setCreatePostOpen] = useState(false);
  const balanceFn = useServerFn(getTrainerBalance);
  const summaryFn = useServerFn(getEarningsSummary);
  const settingsFn = useServerFn(getPlatformSettings);
  const txFn = useServerFn(listTrainerTransactions);

  const [kind, setKind] = useState<KindFilter>("all");
  const [postFilter, setPostFilter] = useState<string>("all");

  const balance = useQuery({
    queryKey: ["creator-balance"],
    queryFn: () => balanceFn(),
    staleTime: 30_000,
  });
  const summary = useQuery({
    queryKey: ["creator-earnings-summary"],
    queryFn: () => summaryFn(),
    staleTime: 60_000,
  });
  const settings = useQuery({
    queryKey: ["platform-settings"],
    queryFn: () => settingsFn(),
    staleTime: 5 * 60_000,
  });
  const txQuery = useQuery({
    queryKey: ["creator-tx", kind, postFilter],
    queryFn: () =>
      txFn({
        data: {
          kind: kind === "all" ? undefined : kind,
          postId: postFilter === "all" ? undefined : postFilter,
        },
      }),
    staleTime: 15_000,
  });

  const currency = balance.data?.currency ?? summary.data?.currency ?? "USD";
  const fmt = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }),
    [currency],
  );
  const minPayout = settings.data?.min_payout_amount ?? 25;
  const available = balance.data?.available_amount ?? 0;
  const payoutReady = available >= minPayout;

  const topPosts = summary.data?.top_posts ?? [];

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-hairline pb-6">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-500">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Creator Studio Dashboard
          </div>
          <h1 className="font-display text-3xl font-bold uppercase tracking-tight sm:text-4xl text-foreground">
            Creator Studio
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Track balance, total earnings, subscriber analytics, and manage published content.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Profile Mode Switcher Button */}
          <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-muted/40 p-1">
            <button
              type="button"
              onClick={() => switchMode("normal")}
              className={`flex items-center gap-1 rounded px-3 py-1.5 text-xs font-semibold transition-all ${
                mode === "normal"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <User className="h-3.5 w-3.5" /> Athlete View
            </button>
            <button
              type="button"
              onClick={() => switchMode("creator")}
              className={`flex items-center gap-1 rounded px-3 py-1.5 text-xs font-semibold transition-all ${
                mode === "creator"
                  ? "bg-amber-500 text-black font-bold shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" /> Creator Studio
            </button>
          </div>

          <Button
            onClick={() => setCreatePostOpen(true)}
            size="sm"
            className="gap-1.5 font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md"
          >
            <Plus className="h-4 w-4" /> New Post / Short
          </Button>

          <Button asChild variant="outline" size="sm">
            <Link to="/profile">My Profile</Link>
          </Button>
        </div>
      </header>

      <CreatePostDialog
        open={createPostOpen}
        onOpenChange={setCreatePostOpen}
      />

      {/* Balance strip */}
      <section
        aria-labelledby="balance-heading"
        className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <h2 id="balance-heading" className="sr-only">
          Balance
        </h2>
        <StatCard
          icon={Wallet}
          label="Available"
          value={fmt.format(available)}
          tone="primary"
          hint={
            payoutReady
              ? "Payout ready"
              : `Min payout ${fmt.format(minPayout)}`
          }
          loading={balance.isLoading}
        />
        <StatCard
          icon={Clock}
          label="Pending"
          value={fmt.format(balance.data?.pending_amount ?? 0)}
          hint="Clears after dispute window"
          loading={balance.isLoading}
        />
        <StatCard
          icon={Ban}
          label="Frozen"
          value={fmt.format(balance.data?.frozen_amount ?? 0)}
          hint="Held pending review"
          loading={balance.isLoading}
        />
        <StatCard
          icon={ArrowUpRight}
          label="Paid out"
          value={fmt.format(balance.data?.paid_out_amount ?? 0)}
          hint="Lifetime withdrawals"
          loading={balance.isLoading}
        />
      </section>

      {/* Earnings + Top posts */}
      <section
        aria-labelledby="earnings-heading"
        className="mb-8 grid gap-4 lg:grid-cols-3"
      >
        <h2 id="earnings-heading" className="sr-only">
          Earnings
        </h2>
        <Card className="lg:col-span-2 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" aria-hidden />
              <h3 className="font-display text-sm uppercase tracking-wider">
                Earnings breakdown
              </h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Total: <span className="font-medium text-foreground">{fmt.format(summary.data?.total_earned ?? 0)}</span>
              <span className="mx-2 opacity-40">·</span>
              Last 30d: <span className="font-medium text-foreground">{fmt.format(summary.data?.last_30d ?? 0)}</span>
            </p>
          </div>
          {summary.isLoading ? (
            <SkeletonRow />
          ) : (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(["subscription", "unlock", "tip", "qa", "adjustment", "refund"] as const).map((k) => {
                const v = summary.data?.by_kind?.[k] ?? 0;
                return (
                  <li
                    key={k}
                    className="rounded-lg border border-border/50 bg-surface-1 p-3"
                  >
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {kindLabel(k)}
                    </p>
                    <p className={cn("mt-1 font-display text-lg", v < 0 && "text-destructive")}>{fmt.format(v)}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" aria-hidden />
            <h3 className="font-display text-sm uppercase tracking-wider">Top posts</h3>
          </div>
          {summary.isLoading ? (
            <SkeletonRow />
          ) : topPosts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No post-attributed revenue yet. Unlocks and Q&A tied to a post will appear here.
            </p>
          ) : (
            <ul className="space-y-2">
              {topPosts.map((p) => (
                <li key={p.post_id}>
                  <Link
                    to="/posts/$postId"
                    params={{ postId: p.post_id }}
                    className="flex items-center justify-between gap-3 rounded-md p-2 hover:bg-surface-1 focus-visible:bg-surface-1 focus-visible:outline-none"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {p.caption ?? <em className="text-muted-foreground">Untitled post</em>}
                    </span>
                    <span className="flex-shrink-0 text-right">
                      <span className="block font-medium">{fmt.format(p.earned)}</span>
                      <span className="block text-[10px] text-muted-foreground">
                        {p.count} txn{p.count === 1 ? "" : "s"}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      {/* Transactions */}
      <section aria-labelledby="tx-heading">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" aria-hidden />
            <h2 id="tx-heading" className="font-display text-sm uppercase tracking-wider">
              Transactions
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={kind} onValueChange={(v) => setKind(v as KindFilter)}>
              <SelectTrigger className="h-9 w-40" aria-label="Filter by kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All kinds</SelectItem>
                <SelectItem value="subscription">Subscriptions</SelectItem>
                <SelectItem value="unlock">Post unlocks</SelectItem>
                <SelectItem value="tip">Tips</SelectItem>
                <SelectItem value="qa">Paid Q&A</SelectItem>
                <SelectItem value="refund">Refunds</SelectItem>
                <SelectItem value="adjustment">Adjustments</SelectItem>
              </SelectContent>
            </Select>
            <Select value={postFilter} onValueChange={setPostFilter}>
              <SelectTrigger className="h-9 w-48" aria-label="Filter by post">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All posts</SelectItem>
                {topPosts.map((p) => (
                  <SelectItem key={p.post_id} value={p.post_id}>
                    {truncate(p.caption ?? "Untitled post", 40)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card className="overflow-hidden p-0">
          {txQuery.isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
              Loading transactions…
            </div>
          ) : txQuery.isError ? (
            <div className="p-6 text-center text-sm text-destructive">
              Could not load transactions.
              <Button variant="link" size="sm" onClick={() => txQuery.refetch()}>
                Retry
              </Button>
            </div>
          ) : (txQuery.data?.length ?? 0) === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              No transactions match this filter.
            </div>
          ) : (
            <TxTable rows={txQuery.data ?? []} fmt={fmt} />
          )}
        </Card>
      </section>
    </main>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
  loading,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  value: string;
  hint?: string;
  tone?: "primary";
  loading?: boolean;
}) {
  return (
    <Card
      className={cn(
        "p-4",
        tone === "primary" && "border-primary/40 bg-linear-to-br from-primary/10 to-surface-1",
      )}
    >
      <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {label}
      </div>
      <p className="font-display text-2xl leading-tight">
        {loading ? <span className="inline-block h-6 w-24 animate-pulse rounded bg-muted" /> : value}
      </p>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </Card>
  );
}

function TxTable({ rows, fmt }: { rows: TransactionRow[]; fmt: Intl.NumberFormat }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-border/60 bg-surface-1 text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-3 text-left font-medium">Date</th>
            <th scope="col" className="px-4 py-3 text-left font-medium">Kind</th>
            <th scope="col" className="px-4 py-3 text-left font-medium">From</th>
            <th scope="col" className="px-4 py-3 text-left font-medium">Post</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Gross</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Fee</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">You get</th>
            <th scope="col" className="px-4 py-3 text-left font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-border/40 last:border-0 hover:bg-surface-1/60">
              <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                {new Date(r.created_at).toLocaleDateString()}
              </td>
              <td className="px-4 py-3">
                <Badge variant="outline" className="text-xs">{kindLabel(r.kind)}</Badge>
              </td>
              <td className="px-4 py-3">{r.counterparty ?? <span className="text-muted-foreground">—</span>}</td>
              <td className="px-4 py-3">
                {r.post_id ? (
                  <Link
                    to="/posts/$postId"
                    params={{ postId: r.post_id }}
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    View
                  </Link>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">{fmt.format(r.gross)}</td>
              <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                -{fmt.format(r.platform_fee)}
              </td>
              <td className={cn(
                "px-4 py-3 text-right tabular-nums font-medium",
                r.kind === "refund" && "text-destructive",
              )}>
                {r.kind === "refund" ? "-" : ""}{fmt.format(r.trainer_amount)}
              </td>
              <td className="px-4 py-3">
                <StatusPill status={r.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "succeeded"
      ? "bg-emerald-500/15 text-emerald-500"
      : status === "pending" || status === "held"
        ? "bg-amber-500/15 text-amber-500"
        : status === "refunded" || status === "failed"
          ? "bg-destructive/15 text-destructive"
          : "bg-muted text-muted-foreground";
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider", tone)}>
      {status}
    </span>
  );
}

function SkeletonRow() {
  return (
    <div className="space-y-2">
      <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
      <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
      <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
    </div>
  );
}

function kindLabel(kind: string): string {
  switch (kind) {
    case "subscription": return "Sub";
    case "unlock": return "Unlock";
    case "tip": return "Tip";
    case "qa": return "Q&A";
    case "refund": return "Refund";
    case "adjustment": return "Adjust";
    default: return kind;
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}