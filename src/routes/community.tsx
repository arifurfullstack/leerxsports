import { createFileRoute, Link, getRouteApi, useNavigate, useRouter } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useEffect, useMemo, useState } from "react";
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  BadgeCheck,
  Dumbbell,
  HelpCircle,
  Loader2,
  MessageSquare,
  Plus,
  Search,
  X,
  Trophy,
  Bookmark,
  Flag,
  MoreHorizontal,
  ImagePlus,
  Hash,
  CornerDownRight,
} from "lucide-react";
import { GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MediaLightbox } from "@/components/media-lightbox";
import { buildSrcSet, sizedImageUrl } from "@/lib/image-url";
import { SmartImage } from "@/components/smart-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import {
  addCommunityComment,
  createCommunityPost,
  getMyCommunityRespects,
  listCommunityPosts,
  toggleCommunityRespect,
  type CommunityKind,
  type CommunityPost,
  type CommunitySort,
} from "@/lib/community-functions";
import {
  submitReport,
  REPORT_REASONS,
  type ReportReason,
} from "@/lib/moderation-functions";
import { UserAvatar } from "@/components/user-avatar";

type Filter = { kind: CommunityKind | "all" | "saved"; sort: CommunitySort };

const BOOKMARK_KEY = "leer:community:bookmarks";
const BOOKMARK_EVENT = "leer:bookmarks:changed";

function readBookmarks(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(BOOKMARK_KEY);
    return new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function listQuery(f: Filter) {
  return queryOptions({
    queryKey: ["community", f.kind, f.sort],
    queryFn: () => listCommunityPosts({ data: { kind: f.kind, sort: f.sort } }),
  });
}

const communitySearchSchema = z.object({
  commentSort: fallback(z.string(), "new").default("new"),
});
type CommentSort = "new" | "old" | "top";
function normalizeCommentSort(v: string | undefined): CommentSort {
  return v === "old" || v === "top" ? v : "new";
}
const communityRouteApi = getRouteApi("/community");

export const Route = createFileRoute("/community")({
  validateSearch: zodValidator(communitySearchSchema),
  loader: async ({ context }) => {
    try {
      await context.queryClient.ensureQueryData(listQuery({ kind: "all", sort: "new" }));
    } catch (e) {
      console.error("Community loader error:", e);
    }
  },
  head: () => ({
    meta: [
      { title: "Community — LEER Sports" },
      {
        name: "description",
        content:
          "Ask questions, share progress, and get answers from verified creators on LEER Sports.",
      },
      { property: "og:title", content: "LEER Sports Community" },
      {
        property: "og:description",
        content: "Q&A and progress posts from fans and verified creators.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: CommunityPage,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    const isHtml = error.message?.includes("<html") || error.message?.includes("<!doctype");
    const cleanMsg = isHtml
      ? "Unable to connect to community server. Please check your connection."
      : error.message || "An unexpected error occurred while loading community content.";
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold uppercase tracking-tight text-foreground">
          Could not load community
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{cleanMsg}</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button
            className="font-bold bg-primary text-primary-foreground"
            onClick={() => {
              router.invalidate();
              reset();
            }}
          >
            Retry
          </Button>
          <Button asChild variant="outline">
            <Link to="/">Go Home</Link>
          </Button>
        </div>
      </div>
    );
  },
  notFoundComponent: () => <div className="p-8">Not found</div>,
});

function CommunityPage() {
  const [filter, setFilter] = useState<Filter>({ kind: "all", sort: "new" });
  const first = useSuspenseQuery(listQuery({ kind: "all", sort: "new" }));
  const listFilter: Filter =
    filter.kind === "saved" ? { kind: "all", sort: filter.sort } : filter;
  const q = useQuery({ ...listQuery(listFilter), initialData: first.data });
  const allPosts = q.data ?? [];
  const qc = useQueryClient();

  // Bookmarks (localStorage-backed) — subscribed so the Saved tab updates live.
  const [bookmarks, setBookmarks] = useState<Set<string>>(() => readBookmarks());
  useEffect(() => {
    const sync = () => setBookmarks(readBookmarks());
    sync();
    if (typeof window === "undefined") return;
    window.addEventListener(BOOKMARK_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(BOOKMARK_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // Realtime: reconcile respect_count / comment_count across devices.
  useEffect(() => {
    const ch = supabase
      .channel("community-posts-counts")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "community_posts" },
        (payload) => {
          const row = payload.new as {
            id: string;
            respect_count: number;
            comment_count: number;
            trainer_answered: boolean;
          };
          qc.setQueriesData<CommunityPost[] | undefined>(
            { queryKey: ["community"] },
            (list) =>
              list?.map((p) =>
                p.id === row.id
                  ? {
                      ...p,
                      respect_count: row.respect_count,
                      comment_count: row.comment_count,
                      trainer_answered: row.trainer_answered,
                    }
                  : p,
              ),
          );
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  // Search + auto-suggest
  const [query, setQuery] = useState("");
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const trimmed = query.trim().toLowerCase();

  const posts = useMemo(() => {
    const base =
      filter.kind === "saved"
        ? allPosts.filter((p) => bookmarks.has(p.id))
        : allPosts;
    if (!trimmed) return base;
    return base.filter((p) => {
      const author =
        `${p.author?.display_name ?? ""} ${p.author?.username ?? ""}`.toLowerCase();
      return (
        p.title.toLowerCase().includes(trimmed) ||
        (p.body ?? "").toLowerCase().includes(trimmed) ||
        author.includes(trimmed) ||
        p.hashtags.some((h) => h.toLowerCase().includes(trimmed))
      );
    });
  }, [allPosts, trimmed, filter.kind, bookmarks]);

  type Suggestion =
    | { kind: "post"; id: string; label: string; sub: string }
    | { kind: "author"; label: string; sub: string; avatar?: string | null; is_trainer?: boolean }
    | { kind: "tag"; label: string };

  const suggestions = useMemo<Suggestion[]>(() => {
    if (!trimmed) return [];
    const out: Suggestion[] = [];
    const seenAuthors = new Set<string>();
    const seenTags = new Set<string>();
    for (const p of allPosts) {
      const authorName = p.author?.display_name ?? p.author?.username ?? "";
      if (
        authorName &&
        authorName.toLowerCase().includes(trimmed) &&
        !seenAuthors.has(authorName.toLowerCase())
      ) {
        seenAuthors.add(authorName.toLowerCase());
        out.push({
          kind: "author",
          label: authorName,
          sub: p.author?.username ? `@${p.author.username}` : "Author",
          avatar: p.author?.avatar_url,
          is_trainer: p.author?.is_trainer,
        });
      }
      for (const h of p.hashtags) {
        const key = h.toLowerCase();
        if (key.includes(trimmed) && !seenTags.has(key)) {
          seenTags.add(key);
          out.push({ kind: "tag", label: `#${h}` });
        }
      }
      if (p.title.toLowerCase().includes(trimmed)) {
        out.push({
          kind: "post",
          id: p.id,
          label: p.title,
          sub: `${p.kind === "question" ? "Q&A" : "Flex"} · ${authorName || "user"}`,
        });
      }
    }
    return out.slice(0, 8);
  }, [allPosts, trimmed]);

  function applySuggestion(s: Suggestion) {
    if (s.kind === "author") setQuery(s.label);
    else if (s.kind === "tag") setQuery(s.label.replace(/^#/, ""));
    else setQuery(s.label);
    setSuggestOpen(false);
    setActiveIdx(-1);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!suggestOpen || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      applySuggestion(suggestions[activeIdx]);
    } else if (e.key === "Escape") {
      setSuggestOpen(false);
    }
  }

  const [signedIn, setSignedIn] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!alive) return;
      setSignedIn(!!data.user);
      setUserId(data.user?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_, session) => {
      setSignedIn(!!session?.user);
      setUserId(session?.user?.id ?? null);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const getMine = useServerFn(getMyCommunityRespects);
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const postIds = useMemo(
    () => posts.map((p) => p.id).filter((id) => UUID_RE.test(id)),
    [posts],
  );
  const mineQ = useQuery({
    queryKey: ["community-my-respects", userId, postIds],
    queryFn: () => getMine({ data: { postIds } }),
    enabled: signedIn && postIds.length > 0,
  });
  const mine = new Set(mineQ.data ?? []);

  const [composerOpen, setComposerOpen] = useState(false);

  const stats = useMemo(() => {
    const totalRespect = allPosts.reduce((s, p) => s + (p.respect_count ?? 0), 0);
    const totalComments = allPosts.reduce((s, p) => s + (p.comment_count ?? 0), 0);
    const trainerAnswered = allPosts.filter((p) => p.trainer_answered).length;
    return { totalPosts: allPosts.length, totalRespect, totalComments, trainerAnswered };
  }, [allPosts]);

  const topContributors = useMemo(() => {
    const map = new Map<
      string,
      { name: string; username?: string | null; avatar?: string | null; is_trainer?: boolean; xp: number }
    >();
    for (const p of allPosts) {
      const key = p.author?.username ?? p.author?.display_name ?? "anon";
      const cur = map.get(key) ?? {
        name: p.author?.display_name ?? p.author?.username ?? "user",
        username: p.author?.username,
        avatar: p.author?.avatar_url,
        is_trainer: p.author?.is_trainer,
        xp: 0,
      };
      cur.xp += (p.respect_count ?? 0) + (p.comment_count ?? 0) * 2;
      map.set(key, cur);
    }
    return Array.from(map.values())
      .sort((a, b) => b.xp - a.xp)
      .slice(0, 5);
  }, [allPosts]);

  return (
    <main className="mx-auto min-h-dvh w-full max-w-6xl px-4 py-10 sm:px-6 selection:bg-primary selection:text-primary-foreground">
      {/* Header */}
      <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <span className="font-display text-xs uppercase tracking-[0.3em] text-primary">
            LEER Community
          </span>
          <h1 className="mt-2 font-display text-6xl uppercase leading-none tracking-tight sm:text-7xl md:text-8xl">
            Community<span className="text-primary">.</span>
          </h1>
          <p className="mt-3 max-w-md text-sm text-muted-foreground">
            Ask questions or flex your progress. Verified trainer replies stand out.
          </p>
        </div>
        <Button
          size="lg"
          className="group h-auto self-start px-8 py-4 font-display text-2xl uppercase tracking-wide transition-transform hover:-skew-x-6 md:self-end"
          onClick={() =>
            signedIn ? setComposerOpen(true) : (window.location.href = "/auth")
          }
        >
          New Post <Plus className="ml-2 h-5 w-5 transition-transform group-hover:rotate-90" />
        </Button>
      </div>

      {/* Layout */}
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
        {/* Feed */}
        <div className="lg:col-span-8">
          {/* Search */}
          <div className="relative mb-5">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSuggestOpen(true);
                setActiveIdx(-1);
              }}
              onFocus={() => setSuggestOpen(true)}
              onBlur={() => setTimeout(() => setSuggestOpen(false), 120)}
              onKeyDown={onKeyDown}
              placeholder="Search posts, authors, #tags…"
              className="h-11 pl-9 pr-9"
              aria-label="Search community"
              aria-autocomplete="list"
              aria-expanded={suggestOpen && suggestions.length > 0}
            />
            {query && (
              <button
                onClick={() => {
                  setQuery("");
                  setSuggestOpen(false);
                }}
                className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            {suggestOpen && suggestions.length > 0 && (
              <ul
                role="listbox"
                className="absolute left-0 right-0 top-full z-20 mt-1 max-h-80 overflow-auto rounded-md border border-border bg-popover shadow-lg"
              >
                {suggestions.map((s, i) => {
                  const active = i === activeIdx;
                  return (
                    <li
                      key={`${s.kind}-${i}-${s.label}`}
                      role="option"
                      aria-selected={active}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        applySuggestion(s);
                      }}
                      onMouseEnter={() => setActiveIdx(i)}
                      className={`flex cursor-pointer items-center gap-3 border-b border-border/50 px-3 py-2 text-sm last:border-b-0 ${
                        active ? "bg-muted" : ""
                      }`}
                    >
                      {s.kind === "author" ? (
                        <UserAvatar
                          src={s.avatar}
                          name={s.label}
                          size="sm"
                          isTrainer={s.is_trainer}
                        />
                      ) : (
                        <span
                          className={`grid h-7 w-7 shrink-0 place-items-center rounded ${
                            s.kind === "tag"
                              ? "bg-primary/10 text-primary"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {s.kind === "tag" ? "#" : <Search className="h-3.5 w-3.5" />}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1 truncate font-medium">
                          <span className="truncate">{s.label}</span>
                          {s.kind === "author" && s.is_trainer && (
                            <BadgeCheck className="h-3 w-3 shrink-0 text-primary" />
                          )}
                        </p>
                        {"sub" in s && (
                          <p className="truncate text-[11px] text-muted-foreground">{s.sub}</p>
                        )}
                      </div>
                      <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {s.kind}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Tabs */}
          <nav className="mb-6 flex gap-6 border-b border-border">
            {([
              { value: "all", label: "All" },
              { value: "question", label: "Q&A" },
              { value: "flex", label: "Flex" },
              { value: "saved", label: "Saved" },
            ] as { value: Filter["kind"]; label: string }[]).map((o) => {
              const active = filter.kind === o.value;
              const count = o.value === "saved" ? bookmarks.size : null;
              return (
                <button
                  key={o.value}
                  onClick={() => setFilter((f) => ({ ...f, kind: o.value }))}
                  className={`-mb-px inline-flex items-center gap-2 border-b-2 pb-3 font-display text-sm uppercase tracking-widest transition-colors ${
                    active
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {o.label}
                  {count !== null && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${
                        active
                          ? "bg-primary/15 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Sort chips */}
          <div className="mb-8 flex flex-wrap gap-2">
            {(["new", "top", "trending"] as const).map((s) => {
              const active = filter.sort === s;
              return (
                <button
                  key={s}
                  onClick={() => setFilter((f) => ({ ...f, sort: s }))}
                  className={`rounded-full border px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest transition-colors ${
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>

          <section className="space-y-4">
            {q.isLoading ? (
              <div className="rounded-lg border border-border bg-card p-10 text-center text-sm text-muted-foreground">
                Loading…
              </div>
            ) : posts.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                {trimmed
                  ? `No results for “${query.trim()}”. Try a different keyword.`
                  : filter.kind === "saved"
                    ? "No saved posts yet. Tap the bookmark icon on any post to save it here."
                    : "No posts yet. Be the first to ask a question or flex your progress."}
              </div>
            ) : (
              posts.map((p) => (
                <PostCard
                  key={p.id}
                  post={p}
                  hasRespect={mine.has(p.id)}
                  signedIn={signedIn}
                  currentUserId={userId}
                />
              ))
            )}
          </section>
        </div>

        {/* Right Rail */}
        <aside className="space-y-6 lg:col-span-4">
          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="font-display text-2xl uppercase tracking-wide">
              LEER Stats
            </h3>
            <div className="mt-6 grid grid-cols-2 gap-4">
              <Stat label="Posts" value={stats.totalPosts} />
              <Stat label="Respect" value={stats.totalRespect} tone="primary" />
              <Stat label="Comments" value={stats.totalComments} />
              <Stat label="Answered" value={stats.trainerAnswered} tone="primary" />
            </div>
            <div className="mt-6 border-t border-border pt-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Trainer Response Rate
              </p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{
                    width: `${
                      stats.totalPosts
                        ? Math.min(
                            100,
                            Math.round((stats.trainerAnswered / stats.totalPosts) * 100),
                          )
                        : 0
                    }%`,
                  }}
                />
              </div>
              <p className="mt-2 text-right text-[10px] font-bold text-muted-foreground">
                {stats.totalPosts
                  ? Math.round((stats.trainerAnswered / stats.totalPosts) * 100)
                  : 0}
                % answered by trainers
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="font-display text-2xl uppercase tracking-wide">
              MVP Rebels
            </h3>
            <div className="mt-6 space-y-4">
              {topContributors.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No contributors yet.
                </p>
              ) : (
                topContributors.map((c, i) => (
                  <div
                    key={`${c.username ?? c.name}-${i}`}
                    className="flex items-center justify-between gap-3"
                  >
                    {c.username ? (
                      <Link
                        to="/trainers/$username"
                        params={{ username: c.username }}
                        className="group/contributor flex min-w-0 flex-1 items-center gap-3 transition-opacity hover:opacity-80"
                      >
                        <span className="w-6 shrink-0 font-display text-xl text-muted-foreground">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <UserAvatar
                          src={c.avatar}
                          name={c.name}
                          size="sm"
                          isTrainer={c.is_trainer}
                        />
                        <span className="inline-flex min-w-0 items-center gap-1 truncate text-xs font-bold uppercase tracking-tight transition-colors group-hover/contributor:text-primary">
                          <span className="truncate">{c.name}</span>
                          {c.is_trainer && (
                            <BadgeCheck className="h-3 w-3 shrink-0 text-primary" />
                          )}
                        </span>
                      </Link>
                    ) : (
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <span className="w-6 shrink-0 font-display text-xl text-muted-foreground">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <UserAvatar
                          src={c.avatar}
                          name={c.name}
                          size="sm"
                          isTrainer={c.is_trainer}
                        />
                        <span className="inline-flex min-w-0 items-center gap-1 truncate text-xs font-bold uppercase tracking-tight">
                          <span className="truncate">{c.name}</span>
                          {c.is_trainer && (
                            <BadgeCheck className="h-3 w-3 shrink-0 text-primary" />
                          )}
                        </span>
                      </div>
                    )}
                    <span className="shrink-0 text-[10px] font-black text-primary">
                      {c.xp} XP
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-5 text-xs italic leading-relaxed text-muted-foreground">
            <span className="mb-1 block font-display text-sm not-italic uppercase tracking-widest text-foreground">
              Pro Tip
            </span>
            Tag your Q&A clearly — verified trainers reply faster to specific,
            focused questions.
          </div>
        </aside>
      </div>

      <ComposeCommunityDialog open={composerOpen} onOpenChange={setComposerOpen} />
    </main>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "primary";
}) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-1 font-display text-3xl italic tracking-tight ${
          tone === "primary" ? "text-primary" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Seg<T extends string>({
  value,
  setValue,
  options,
}: {
  value: T;
  setValue: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex rounded-md border border-border bg-card p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => setValue(o.value)}
          className={`rounded px-3 py-1 text-xs font-display uppercase tracking-widest transition-colors ${
            value === o.value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function PostCard({
  post,
  hasRespect,
  signedIn,
  currentUserId,
}: {
  post: CommunityPost;
  hasRespect: boolean;
  signedIn: boolean;
  currentUserId: string | null;
}) {
  const qc = useQueryClient();
  const router = useRouter();
  const toggleFn = useServerFn(toggleCommunityRespect);
  const [open, setOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [bookmarked, setBookmarked] = useState(() => readBookmarks().has(post.id));
  useEffect(() => {
    const sync = () => setBookmarked(readBookmarks().has(post.id));
    sync();
    if (typeof window === "undefined") return;
    window.addEventListener(BOOKMARK_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(BOOKMARK_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [post.id]);
  const toggleBookmark = () => {
    if (typeof window === "undefined") return;
    try {
      const set = readBookmarks();
      const willSave = !set.has(post.id);
      if (willSave) set.add(post.id);
      else set.delete(post.id);
      window.localStorage.setItem(BOOKMARK_KEY, JSON.stringify([...set]));
      setBookmarked(willSave);
      window.dispatchEvent(
        new CustomEvent(BOOKMARK_EVENT, { detail: [...set] }),
      );
      if (willSave) toast.success("Bookmarked");
      else toast("Removed bookmark");
    } catch {
      toast.error("Could not save bookmark");
    }
  };

  const respectMut = useMutation({
    mutationFn: () => toggleFn({ data: { postId: post.id } }),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["community"] });
      const delta = hasRespect ? -1 : 1;
      const snapshots = qc.getQueriesData<CommunityPost[] | undefined>({
        queryKey: ["community"],
      });
      qc.setQueriesData<CommunityPost[] | undefined>(
        { queryKey: ["community"] },
        (list) =>
          list?.map((p) =>
            p.id === post.id
              ? { ...p, respect_count: Math.max(0, (p.respect_count ?? 0) + delta) }
              : p,
          ),
      );
      const mineKeys = qc.getQueriesData<string[] | undefined>({
        queryKey: ["community-my-respects"],
      });
      qc.setQueriesData<string[] | undefined>(
        { queryKey: ["community-my-respects"] },
        (ids) => {
          if (!ids) return ids;
          if (hasRespect) return ids.filter((x) => x !== post.id);
          return ids.includes(post.id) ? ids : [...ids, post.id];
        },
      );
      return { snapshots, mineKeys };
    },
    onError: (e: Error, _vars, ctx) => {
      ctx?.snapshots.forEach(([key, val]) => qc.setQueryData(key, val));
      ctx?.mineKeys.forEach(([key, val]) => qc.setQueryData(key, val));
      toast.error(e.message);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["community"] });
      qc.invalidateQueries({ queryKey: ["community-my-respects"] });
    },
  });

  return (
    <article className="group relative overflow-hidden rounded-lg border border-border bg-card transition-all hover:border-primary/50">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        aria-label={`Open post: ${post.title}`}
        className="cursor-pointer p-6 pb-4 outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
      >
      <header className="flex items-center gap-3 text-xs">
        {post.author?.username ? (
          <Link
            to="/trainers/$username"
            params={{ username: post.author.username }}
            onClick={(e) => e.stopPropagation()}
            className="group/author flex min-w-0 flex-1 items-center gap-3 transition-opacity hover:opacity-80"
          >
            <UserAvatar
              src={post.author?.avatar_url}
              name={post.author?.display_name ?? post.author?.username}
              size="md"
              isTrainer={post.author?.is_trainer}
            />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 truncate text-sm font-bold uppercase tracking-tight transition-colors group-hover/author:text-primary">
                <span className="truncate">
                  {post.author?.display_name ?? post.author?.username ?? "user"}
                </span>
                {post.author?.is_trainer && (
                  <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
                )}
              </p>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {new Date(post.created_at).toLocaleDateString()}
              </p>
            </div>
          </Link>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <UserAvatar
              src={post.author?.avatar_url}
              name={post.author?.display_name ?? post.author?.username}
              size="md"
              isTrainer={post.author?.is_trainer}
            />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 truncate text-sm font-bold uppercase tracking-tight">
                <span className="truncate">
                  {post.author?.display_name ?? post.author?.username ?? "user"}
                </span>
                {post.author?.is_trainer && (
                  <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
                )}
              </p>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {new Date(post.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        )}
        <span
          className={`ml-auto inline-flex shrink-0 items-center gap-1 rounded border px-2 py-1 text-[10px] font-black uppercase tracking-tighter ${
            post.kind === "question"
              ? "border-primary/20 bg-primary/10 text-primary"
              : "border-border bg-muted text-foreground"
          }`}
        >
          {post.kind === "question" ? (
            <>
              <HelpCircle className="h-3 w-3" /> Q&A
            </>
          ) : (
            <>
              <Trophy className="h-3 w-3" /> Flex
            </>
          )}
        </span>
      </header>
      <h2 className="mt-4 font-display text-2xl uppercase leading-tight tracking-tight transition-colors group-hover:text-primary">
        {post.title}
      </h2>
      {post.body && (
        <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">
          {post.body}
        </p>
      )}
      {post.media && post.media.length > 0 && (
        <div
          className={`mt-4 grid gap-2 ${
            post.media.length === 1
              ? "grid-cols-1"
              : post.media.length === 2
                ? "grid-cols-2"
                : "grid-cols-2 sm:grid-cols-3"
          }`}
        >
          {post.media.slice(0, 3).map((m, i) => {
            const isVid = /\.(mp4|webm|mov)$/i.test(m);
            return (
              <div
                key={m + i}
                className="relative aspect-video overflow-hidden rounded-md border border-border bg-muted"
              >
                {isVid ? (
                  <video src={m} className="h-full w-full object-cover" muted />
                ) : (
                  <img
                    src={sizedImageUrl(m, 480, { quality: 70 })}
                    srcSet={buildSrcSet(m, [240, 480, 720, 960], { quality: 70 })}
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 320px"
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                )}
                {i === 2 && post.media.length > 3 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/70 font-display text-2xl text-foreground">
                    +{post.media.length - 3}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {post.hashtags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {post.hashtags.map((h) => (
            <span
              key={h}
              className="rounded bg-primary/5 px-2 py-0.5 text-[11px] font-medium text-primary/80"
            >
              #{h}
            </span>
          ))}
        </div>
      )}
      </div>
      <footer className="mx-6 flex flex-wrap items-center gap-4 border-t border-border py-4 text-xs text-muted-foreground">
        <button
          onClick={() =>
            signedIn
              ? respectMut.mutate()
              : router.navigate({ to: "/auth" })
          }
          className={`inline-flex items-center gap-1.5 font-bold uppercase tracking-tight transition-colors ${
            hasRespect ? "text-primary" : "hover:text-primary"
          }`}
          aria-label="Like (Respect)"
          aria-pressed={hasRespect}
        >
          <Dumbbell className={`h-4 w-4 ${hasRespect ? "fill-primary" : ""}`} />
          {post.respect_count} Respect
        </button>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 font-bold uppercase tracking-tight hover:text-foreground"
          aria-label="Comments"
        >
          <MessageSquare className="h-4 w-4" />
          {post.comment_count} Comments
        </button>
        <button
          onClick={() =>
            signedIn ? toggleBookmark() : router.navigate({ to: "/auth" })
          }
          className={`inline-flex items-center gap-1.5 font-bold uppercase tracking-tight transition-colors ${
            bookmarked ? "text-primary" : "hover:text-primary"
          }`}
          aria-label="Bookmark"
          aria-pressed={bookmarked}
        >
          <Bookmark
            className={`h-4 w-4 ${bookmarked ? "fill-primary" : ""}`}
          />
          {bookmarked ? "Saved" : "Save"}
        </button>
        {post.trainer_answered && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/5 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-primary">
            <BadgeCheck className="h-3 w-3" /> Trainer Answered
          </span>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="More actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel>Post actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                signedIn ? toggleBookmark() : router.navigate({ to: "/auth" });
              }}
            >
              <Bookmark className="mr-2 h-4 w-4" />
              {bookmarked ? "Remove bookmark" : "Bookmark"}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={(e) => {
                e.preventDefault();
                signedIn
                  ? setReportOpen(true)
                  : router.navigate({ to: "/auth" });
              }}
            >
              <Flag className="mr-2 h-4 w-4" />
              Report post
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </footer>
      <CommentsDialog
        open={open}
        onOpenChange={setOpen}
        post={post}
        signedIn={signedIn}
        currentUserId={currentUserId}
      />
      <ReportPostDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        postId={post.id}
      />
    </article>
  );
}

function ReportPostDialog({
  open,
  onOpenChange,
  postId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  postId: string;
}) {
  const reportFn = useServerFn(submitReport);
  const [reason, setReason] = useState<ReportReason>("spam");
  const [details, setDetails] = useState("");
  const [confirmation, setConfirmation] = useState<
    { reason: ReportReason; duplicate: boolean } | null
  >(null);
  const mut = useMutation({
    mutationFn: () =>
      reportFn({
        data: {
          target_type: "community_post",
          target_id: postId,
          reason,
          details: details.trim() || undefined,
        },
      }),
    onSuccess: (r) => {
      toast.success(
        r.duplicate ? "Already reported — thanks" : "Report submitted",
      );
      setConfirmation({ reason, duplicate: r.duplicate });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const handleOpenChange = (v: boolean) => {
    if (mut.isPending) return;
    if (!v) {
      setDetails("");
      setReason("spam");
      setConfirmation(null);
    }
    onOpenChange(v);
  };
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {confirmation ? (
          <>
            <DialogHeader>
              <DialogTitle>
                {confirmation.duplicate ? "Already reported" : "Report submitted"}
              </DialogTitle>
              <DialogDescription>
                {confirmation.duplicate
                  ? "You've already flagged this post. Our moderators have it on the list."
                  : "Thanks — a moderator will review this shortly."}
              </DialogDescription>
            </DialogHeader>
            <div className="rounded border border-border bg-muted/30 p-4 space-y-2">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Reason recorded
              </p>
              <p className="text-sm font-bold uppercase tracking-tight text-primary">
                {confirmation.reason.replace("_", " ")}
              </p>
              {details.trim() && (
                <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                  “{details.trim()}”
                </p>
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => handleOpenChange(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
        <DialogHeader>
          <DialogTitle>Report post</DialogTitle>
          <DialogDescription>
            Help keep the community safe. Reports are reviewed by moderators.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-widest">Reason</Label>
            <div className="grid grid-cols-2 gap-2">
              {REPORT_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={`rounded border px-3 py-2 text-left text-xs font-bold uppercase tracking-tight transition-colors ${
                    reason === r
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  {r.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="report-details" className="text-xs uppercase tracking-widest">
              Details (optional)
            </Label>
            <Textarea
              id="report-details"
              value={details}
              onChange={(e) => setDetails(e.target.value.slice(0, 1000))}
              placeholder="Add context to help moderators…"
              rows={4}
            />
            <p className="text-[10px] text-muted-foreground">
              {details.length}/1000
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={mut.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={() => mut.mutate()}
            disabled={mut.isPending}
          >
            {mut.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Flag className="mr-2 h-4 w-4" />
            )}
            Submit report
          </Button>
        </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ComposeCommunityDialog({
  open,
  onOpenChange,
  targetTrainerId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  targetTrainerId?: string;
}) {
  const qc = useQueryClient();
  // (SortableAttachment defined below file scope)
  const router = useRouter();
  const createFn = useServerFn(createCommunityPost);
  const [kind, setKind] = useState<CommunityKind>("question");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [files, setFiles] = useState<
    { file: File; preview: string; kind: "image" | "video" }[]
  >([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const handleReorder = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setFiles((cur) => {
      const from = cur.findIndex((f) => f.preview === active.id);
      const to = cur.findIndex((f) => f.preview === over.id);
      if (from === -1 || to === -1) return cur;
      return arrayMove(cur, from, to);
    });
  };
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
    name: string;
  } | null>(null);

  const MAX_FILES = 4;
  const MAX_TAGS = 10;
  const MAX_SIZE = 15 * 1024 * 1024; // 15MB

  // Author preview (avatar + name) for the live preview panel
  const [me, setMe] = useState<{
    display_name: string;
    username: string | null;
    avatar_url: string | null;
    is_trainer: boolean;
  } | null>(null);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const u = data.user;
      if (!u) return;
      const { data: prof } = await supabase
        .from("profiles")
        .select("display_name, username, avatar_url")
        .eq("user_id", u.id)
        .maybeSingle();
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", u.id);
      if (!alive) return;
      setMe({
        display_name:
          (prof?.display_name as string) ??
          (prof?.username as string) ??
          (u.email?.split("@")[0] ?? "You"),
        username: (prof?.username as string | null) ?? null,
        avatar_url: (prof?.avatar_url as string | null) ?? null,
        is_trainer: !!roles?.some((r) => r.role === "trainer"),
      });
    })();
    return () => {
      alive = false;
    };
  }, [open]);

  const addTag = (raw: string) => {
    const cleaned = raw
      .trim()
      .replace(/^#/, "")
      .replace(/\s+/g, "-")
      .slice(0, 40);
    if (!cleaned) return;
    if (tags.includes(cleaned)) return;
    if (tags.length >= MAX_TAGS) {
      toast.error(`Up to ${MAX_TAGS} tags`);
      return;
    }
    setTags((t) => [...t, cleaned]);
  };
  const handleTagKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "," || e.key === " ") {
      e.preventDefault();
      if (tagInput) {
        addTag(tagInput);
        setTagInput("");
      }
    } else if (e.key === "Backspace" && !tagInput && tags.length) {
      setTags((t) => t.slice(0, -1));
    }
  };

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const next = [...files];
    for (const f of Array.from(list)) {
      if (next.length >= MAX_FILES) {
        toast.error(`Up to ${MAX_FILES} attachments`);
        break;
      }
      if (f.size > MAX_SIZE) {
        toast.error(`${f.name} exceeds 15MB`);
        continue;
      }
      const isImg = f.type.startsWith("image/");
      const isVid = f.type.startsWith("video/");
      if (!isImg && !isVid) {
        toast.error(`${f.name}: only images or video`);
        continue;
      }
      next.push({
        file: f,
        preview: URL.createObjectURL(f),
        kind: isVid ? "video" : "image",
      });
    }
    setFiles(next);
  };
  const removeFile = (i: number) => {
    setFiles((cur) => {
      const copy = [...cur];
      const [gone] = copy.splice(i, 1);
      if (gone) URL.revokeObjectURL(gone.preview);
      return copy;
    });
  };

  const reset = () => {
    files.forEach((f) => URL.revokeObjectURL(f.preview));
    setFiles([]);
    setTitle("");
    setBody("");
    setTags([]);
    setTagInput("");
  };

  const mut = useMutation({
    mutationFn: async () => {
      // Upload attachments first
      let mediaUrls: string[] = [];
      if (files.length) {
        setUploading(true);
        setUploadProgress({ current: 0, total: files.length, name: files[0].file.name });
        try {
          const { data: userData } = await supabase.auth.getUser();
          const uid = userData.user?.id;
          if (!uid) throw new Error("Not signed in");
          for (let i = 0; i < files.length; i++) {
            const item = files[i];
            setUploadProgress({ current: i, total: files.length, name: item.file.name });
            const ext = item.file.name.split(".").pop() || "bin";
            const path = `${uid}/community/${crypto.randomUUID()}.${ext}`;
            let upErrMsg: string | null = null;
            try {
              const res = await supabase.storage
                .from("post-media")
                .upload(path, item.file, { contentType: item.file.type });
              if (res.error) upErrMsg = res.error.message ?? "unknown error";
            } catch {
              throw new Error(
                `Network error uploading "${item.file.name}". Check your connection and try again.`,
              );
            }
            if (upErrMsg) {
              const isRls =
                /row-level security|policy|unauthorized|permission/i.test(upErrMsg);
              throw new Error(
                isRls
                  ? `Upload blocked for "${item.file.name}" — you don't have permission to upload here. Please sign in again.`
                  : `Failed to upload "${item.file.name}": ${upErrMsg}`,
              );
            }
            const { data: signed, error: signErr } = await supabase.storage
              .from("post-media")
              .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
            if (signErr || !signed?.signedUrl)
              throw new Error(
                `Could not generate URL for "${item.file.name}": ${signErr?.message ?? "unknown error"}`,
              );
            mediaUrls.push(signed.signedUrl);
            setUploadProgress({ current: i + 1, total: files.length, name: item.file.name });
          }
        } finally {
          setUploading(false);
          setUploadProgress(null);
        }
      }
      return createFn({
        data: {
          kind,
          title: title.trim(),
          body: body.trim(),
          hashtags: tags,
          media: mediaUrls,
          targetTrainerId,
        },
      });
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["community"] });
      const snapshots = qc.getQueriesData<CommunityPost[]>({ queryKey: ["community"] });
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id ?? "me";
      const optimistic: CommunityPost = {
        id: `optimistic-${crypto.randomUUID()}`,
        author_id: uid,
        kind,
        title: title.trim(),
        body: body.trim(),
        media: files.map((f) => f.preview),
        hashtags: tags,
        respect_count: 0,
        comment_count: 0,
        trainer_answered: false,
        created_at: new Date().toISOString(),
        author: me
          ? {
              username: me.username,
              display_name: me.display_name,
              avatar_url: me.avatar_url,
              is_trainer: me.is_trainer,
            }
          : null,
      };
      // Insert at top of every cached community list whose filter matches
      for (const [key, list] of snapshots) {
        const [, kFilter, sFilter] = key as [string, string, string];
        if (!Array.isArray(list)) continue;
        const kindMatch =
          kFilter === "all" ||
          (kFilter === "question" && kind === "question") ||
          (kFilter === "flex" && kind === "flex") ||
          kFilter === "unanswered" ||
          kFilter === "saved";
        if (!kindMatch) continue;
        if (kFilter === "unanswered" && kind !== "question") continue;
        if (sFilter === "new") {
          qc.setQueryData<CommunityPost[]>(key, [optimistic, ...list]);
        }
      }
      return { snapshots, optimisticId: optimistic.id };
    },
    onError: (e: Error, _v, ctx) => {
      if (ctx?.snapshots) {
        for (const [key, data] of ctx.snapshots) qc.setQueryData(key, data);
      }
      toast.error(e.message || "Could not publish post");
    },
    onSuccess: () => {
      toast.success("Posted to the community");
      onOpenChange(false);
      reset();
      qc.invalidateQueries({ queryKey: ["community"] });
      router.navigate({ to: "/community" });
    },
  });

  const busy = uploading || mut.isPending;
  const disabled = title.trim().length < 3 || busy;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && busy) return;
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-display uppercase">New Post</DialogTitle>
          <DialogDescription>
            Q&A to ask a question, FLEX to share progress.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-4">
          <Seg
            value={kind}
            setValue={setKind}
            options={[
              { value: "question", label: "Q&A" },
              { value: "flex", label: "FLEX" },
            ]}
          />
          <div className="space-y-1.5">
            <Label htmlFor="composer-title">Title</Label>
            <Input
              id="composer-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={140}
              placeholder={
                kind === "question"
                  ? "e.g. How do I fix my squat depth?"
                  : "e.g. First 100kg bench!"
              }
            />
            <p className="text-[10px] text-muted-foreground">
              {title.length}/140
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="composer-body">Details (optional)</Label>
            <Textarea
              id="composer-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              maxLength={4000}
            />
            <p className="text-[10px] text-muted-foreground">
              {body.length}/4000
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Attachments (optional)</Label>
            <DndContext
              sensors={dndSensors}
              collisionDetection={closestCenter}
              onDragEnd={handleReorder}
            >
              <SortableContext
                items={files.map((f) => f.preview)}
                strategy={rectSortingStrategy}
              >
                <div className="grid grid-cols-4 gap-2">
                  {files.map((f, i) => (
                    <SortableAttachment
                      key={f.preview}
                      id={f.preview}
                      file={f}
                      onRemove={() => removeFile(i)}
                      onOpen={() => setLightboxIndex(i)}
                      disabled={busy}
                    />
                  ))}
                  {files.length < MAX_FILES && (
                <label
                  htmlFor="composer-files"
                  className={`flex aspect-square cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary ${
                    busy ? "pointer-events-none opacity-50" : ""
                  }`}
                >
                  <ImagePlus className="h-5 w-5" />
                  <span className="mt-1 text-[10px] uppercase tracking-widest">
                    Add
                  </span>
                  <input
                    id="composer-files"
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    className="sr-only"
                    onChange={(e) => {
                      addFiles(e.target.files);
                      e.currentTarget.value = "";
                    }}
                  />
                </label>
                  )}
                </div>
              </SortableContext>
            </DndContext>
            <p className="text-[10px] text-muted-foreground">
              Up to {MAX_FILES} images/videos, 15MB each. Drag tiles to reorder.
            </p>
            {uploadProgress && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
                  <span className="truncate max-w-[70%]" title={uploadProgress.name}>
                    Uploading {uploadProgress.name}
                  </span>
                  <span>
                    {uploadProgress.current}/{uploadProgress.total}
                  </span>
                </div>
                <Progress
                  value={(uploadProgress.current / uploadProgress.total) * 100}
                  className="h-1.5"
                />
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="composer-tags">Hashtags (optional)</Label>
            <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-2 focus-within:ring-1 focus-within:ring-ring">
              {tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary"
                >
                  <Hash className="h-3 w-3" />
                  {t}
                  <button
                    type="button"
                    onClick={() => setTags((cur) => cur.filter((x) => x !== t))}
                    aria-label={`Remove ${t}`}
                    className="hover:text-primary/70"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                id="composer-tags"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKey}
                onBlur={() => {
                  if (tagInput) {
                    addTag(tagInput);
                    setTagInput("");
                  }
                }}
                placeholder={
                  tags.length ? "" : "squat, form, progress"
                }
                className="flex-1 min-w-[80px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              Press Enter, space, or comma to add. {tags.length}/{MAX_TAGS}
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button disabled={disabled} onClick={() => mut.mutate()}>
              {busy && (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              )}
              {uploading ? "Uploading…" : mut.isPending ? "Posting…" : "Post"}
            </Button>
          </div>
          </div>

          {/* Live preview */}
          <div className="hidden md:flex flex-col">
            <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Live preview
            </p>
            <ComposerPreview
              kind={kind}
              title={title}
              body={body}
              tags={tags}
              files={files}
              author={me}
              onOpenLightbox={(i) => setLightboxIndex(i)}
            />
          </div>
        </div>
      </DialogContent>
      <MediaLightbox
        items={files.map((f) => ({ src: f.preview, kind: f.kind }))}
        index={lightboxIndex}
        onIndexChange={setLightboxIndex}
        onClose={() => setLightboxIndex(null)}
      />
    </Dialog>
  );
}

function ComposerPreview({
  kind,
  title,
  body,
  tags,
  files,
  author,
  onOpenLightbox,
}: {
  kind: CommunityKind;
  title: string;
  body: string;
  tags: string[];
  files: { preview: string; kind: "image" | "video" }[];
  author: {
    display_name: string;
    username: string | null;
    avatar_url: string | null;
    is_trainer: boolean;
  } | null;
  onOpenLightbox?: (index: number) => void;
}) {
  const displayName = author?.display_name ?? "You";
  const handle = author?.username ? `@${author.username}` : "@you";
  return (
    <article className="flex-1 overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center gap-3 border-b border-border/60 p-4">
        <UserAvatar
          src={author?.avatar_url}
          name={displayName}
          size="md"
          isTrainer={author?.is_trainer}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-bold">{displayName}</p>
            {author?.is_trainer && (
              <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-primary">
                Trainer
              </span>
            )}
          </div>
          <p className="truncate text-[11px] text-muted-foreground">{handle}</p>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${
            kind === "question"
              ? "bg-muted text-foreground"
              : "bg-primary/15 text-primary"
          }`}
        >
          {kind === "question" ? (
            <>
              <HelpCircle className="h-3 w-3" /> Q&A
            </>
          ) : (
            <>
              <Trophy className="h-3 w-3" /> Flex
            </>
          )}
        </span>
      </div>

      <div className="space-y-3 p-4">
        <h4 className="font-display text-lg leading-tight">
          {title.trim() || (
            <span className="text-muted-foreground/60">
              Your title will appear here…
            </span>
          )}
        </h4>
        {body.trim() ? (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {body}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground/60">
            Add details to give your post context.
          </p>
        )}

        {files.length > 0 && (
          <div
            className={`grid gap-1.5 ${
              files.length === 1
                ? "grid-cols-1"
                : files.length === 2
                  ? "grid-cols-2"
                  : "grid-cols-2"
            }`}
          >
            {files.map((f, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onOpenLightbox?.(i)}
                className={`group relative cursor-zoom-in overflow-hidden rounded-md border border-border bg-muted transition hover:border-primary/60 ${
                  files.length === 1 ? "aspect-video" : "aspect-square"
                }`}
                aria-label="Preview full size"
              >
                {f.kind === "video" ? (
                  <video
                    src={f.preview}
                    className="h-full w-full object-cover"
                    muted
                    playsInline
                  />
                ) : (
                  <img
                    src={f.preview}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                )}
              </button>
            ))}
          </div>
        )}

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-0.5 rounded bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary"
              >
                <Hash className="h-3 w-3" />
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-5 border-t border-border/60 px-4 py-2.5 text-[11px] text-muted-foreground">
        <span>0 Respect</span>
        <span>0 Comments</span>
        <span className="ml-auto text-[10px] uppercase tracking-widest">
          Preview
        </span>
      </div>
    </article>
  );
}

function CommentsDialog({
  open,
  onOpenChange,
  post,
  signedIn,
  currentUserId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  post: CommunityPost;
  signedIn: boolean;
  currentUserId: string | null;
}) {
  const qc = useQueryClient();
  const router = useRouter();
  const { commentSort: commentSortRaw } = communityRouteApi.useSearch();
  const commentSort = normalizeCommentSort(commentSortRaw);
  const navigate = useNavigate({ from: "/community" });
  const setCommentSort = (next: CommentSort) =>
    navigate({
      search: (prev: { commentSort?: string }) => ({ ...prev, commentSort: next }),
      replace: true,
    });
  const addFn = useServerFn(addCommunityComment);
  const toggleFn = useServerFn(toggleCommunityRespect);
  const [text, setText] = useState("");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [replyingTo, setReplyingTo] = useState<{
    commentId: string;
    authorName: string;
  } | null>(null);
  const textareaRef = useState<HTMLTextAreaElement | null>(() => null);

  // Lazily load full post + comments only when opened
  const detailQ = useQuery({
    queryKey: ["community-post", post.id],
    queryFn: async () => {
      const { getCommunityPost } = await import("@/lib/community-functions");
      return getCommunityPost({ data: { id: post.id } });
    },
    enabled: open,
  });

  const detail = detailQ.data;
  const sortedComments = useMemo(() => {
    const list = detail?.comments ?? [];
    const arr = list.slice();
    if (commentSort === "old") {
      arr.sort((a, b) => a.created_at.localeCompare(b.created_at));
    } else if (commentSort === "top") {
      // Trainer replies first, then oldest — most substantive answers win.
      arr.sort((a, b) => {
        const at = a.author?.is_trainer ? 1 : 0;
        const bt = b.author?.is_trainer ? 1 : 0;
        if (at !== bt) return bt - at;
        return a.created_at.localeCompare(b.created_at);
      });
    } else {
      arr.sort((a, b) => b.created_at.localeCompare(a.created_at));
    }
    return arr;
  }, [detail?.comments, commentSort]);

  const addMut = useMutation({
    mutationFn: () =>
      addFn({
        data: {
          postId: post.id,
          body: text.trim(),
          ...(replyingTo ? { parentId: replyingTo.commentId } : {}),
        },
      }),
    onSuccess: () => {
      setText("");
      setReplyingTo(null);
      qc.invalidateQueries({ queryKey: ["community-post", post.id] });
      qc.invalidateQueries({ queryKey: ["community"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const media = detail?.post?.media ?? post.media ?? [];
  const lightboxItems = media.map((src) => ({
    src,
    kind: /\.(mp4|webm|mov)$/i.test(src) ? ("video" as const) : ("image" as const),
  }));
  const displayName =
    post.author?.display_name ?? post.author?.username ?? "user";

  const respectMut = useMutation({
    mutationFn: () => toggleFn({ data: { postId: post.id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["community"] });
      qc.invalidateQueries({ queryKey: ["community-my-respects"] });
      qc.invalidateQueries({ queryKey: ["community-post", post.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[100dvh] max-h-[100dvh] w-full max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 p-0 sm:h-[92vh] sm:max-h-[92vh] sm:max-w-3xl sm:rounded-lg sm:border lg:max-w-5xl"
        aria-label={`Post by ${displayName}: ${post.title}`}
        onEscapeKeyDown={() => onOpenChange(false)}
      >
        {/* Sticky header */}
        <DialogHeader className="shrink-0 space-y-0 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <UserAvatar
              src={post.author?.avatar_url}
              name={displayName}
              size="md"
              isTrainer={post.author?.is_trainer}
            />
            <div className="min-w-0 flex-1">
              <DialogTitle className="flex items-center gap-1 truncate text-sm font-bold uppercase tracking-tight">
                <span className="truncate">{displayName}</span>
                {post.author?.is_trainer && (
                  <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
                )}
              </DialogTitle>
              <DialogDescription className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {new Date(post.created_at).toLocaleString()}
              </DialogDescription>
            </div>
            <span
              className={`inline-flex shrink-0 items-center gap-1 rounded border px-2 py-1 text-[10px] font-black uppercase tracking-tighter ${
                post.kind === "question"
                  ? "border-primary/20 bg-primary/10 text-primary"
                  : "border-border bg-muted text-foreground"
              }`}
            >
              {post.kind === "question" ? (
                <><HelpCircle className="h-3 w-3" /> Q&A</>
              ) : (
                <><Trophy className="h-3 w-3" /> Flex</>
              )}
            </span>
          </div>
        </DialogHeader>

        {/* Body: two columns on lg when media present */}
        <div className={`flex min-h-0 flex-1 flex-col ${media.length > 0 ? "lg:flex-row" : ""}`}>
          {/* Media pane */}
          {media.length > 0 && (
            <div
              className="shrink-0 border-b border-border bg-black lg:w-3/5 lg:border-b-0 lg:border-r"
              role="region"
              aria-label="Post media"
            >
              <div className="relative flex h-64 items-center justify-center overflow-hidden sm:h-80 lg:h-full">
                {(() => {
                  const first = media[0];
                  const isVid = /\.(mp4|webm|mov)$/i.test(first);
                  return isVid ? (
                    <div className="relative h-full w-full">
                      <video
                        src={first}
                        className="h-full w-full object-contain"
                        controls
                        playsInline
                      />
                      <button
                        type="button"
                        onClick={() => setLightboxIndex(0)}
                        aria-label="Open full size"
                        className="absolute right-2 top-2 rounded-full bg-background/70 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-foreground backdrop-blur transition hover:bg-background"
                      >
                        Expand
                      </button>
                    </div>
                  ) : (
                     <button
                       type="button"
                       onClick={() => setLightboxIndex(0)}
                       className="h-full w-full cursor-zoom-in"
                       aria-label="Open full size"
                     >
                       <SmartImage
                         src={first}
                         widths={[480, 720, 960, 1280, 1600]}
                         sizes="(max-width: 640px) 100vw, (min-width: 1024px) 60vw, 90vw"
                         targetWidth={960}
                         quality={80}
                         fit="contain"
                         eager
                         className="h-full w-full"
                       />
                     </button>
                  );
                })()}
              </div>
              {media.length > 1 && (
                <div className="scrollbar-none flex gap-2 overflow-x-auto border-t border-border/40 bg-background/80 p-2">
                  {media.map((m, i) => {
                    const isVid = /\.(mp4|webm|mov)$/i.test(m);
                    return (
                      <button
                        key={m + i}
                        type="button"
                        onClick={() => setLightboxIndex(i)}
                        className="relative h-16 w-20 shrink-0 overflow-hidden rounded border border-border hover:border-primary"
                        aria-label={`Preview ${i + 1}`}
                      >
                        {isVid ? (
                          <video src={m} className="h-full w-full object-cover" muted />
                         ) : (
                           <SmartImage
                             src={m}
                             widths={[80, 160, 240]}
                             sizes="80px"
                             targetWidth={160}
                             quality={65}
                             className="h-full w-full"
                           />
                         )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Content + comments pane */}
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
              <h2
                id={`post-title-${post.id}`}
                className="font-display text-2xl uppercase leading-tight tracking-tight sm:text-3xl"
              >
                {post.title}
              </h2>
              {post.body && (
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                  {post.body}
                </p>
              )}
              {post.hashtags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {post.hashtags.map((h) => (
                    <span
                      key={h}
                      className="rounded bg-primary/5 px-2 py-0.5 text-[11px] font-medium text-primary/80"
                    >
                      #{h}
                    </span>
                  ))}
                </div>
              )}

              {/* Action bar */}
              <div className="mt-5 flex flex-wrap items-center gap-4 border-y border-border py-3 text-xs text-muted-foreground">
                <button
                  onClick={() =>
                    signedIn ? respectMut.mutate() : router.navigate({ to: "/auth" })
                  }
                  className={`inline-flex items-center gap-1.5 font-bold uppercase tracking-tight transition-colors ${
                    hasRespectFromDetail(detail, post, signedIn) ? "text-primary" : "hover:text-primary"
                  }`}
                  aria-label="Respect"
                >
                  <Dumbbell className="h-4 w-4" />
                  {detail?.post?.respect_count ?? post.respect_count} Respect
                </button>
                <span className="inline-flex items-center gap-1.5 font-bold uppercase tracking-tight">
                  <MessageSquare className="h-4 w-4" />
                  {detail?.comments.length ?? post.comment_count} Comments
                </span>
                {post.trainer_answered && (
                  <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/5 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-primary">
                    <BadgeCheck className="h-3 w-3" /> Trainer Answered
                  </span>
                )}
              </div>

              {/* Comments */}
              <section className="mt-4" aria-label="Comments">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Comments
                  </p>
                  <div
                    role="radiogroup"
                    aria-label="Sort comments"
                    className="inline-flex overflow-hidden rounded-full border border-border bg-card text-[10px] font-black uppercase tracking-widest"
                  >
                    {(["new", "top", "old"] as const).map((k) => {
                      const label = k === "new" ? "Newest" : k === "old" ? "Oldest" : "Top";
                      const active = commentSort === k;
                      return (
                        <button
                          key={k}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => setCommentSort(k)}
                          className={`px-3 py-1 transition-colors ${
                            active
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div
                  className="space-y-3"
                  role="log"
                  aria-live="polite"
                  aria-relevant="additions"
                  aria-busy={detailQ.isLoading}
                >
                  {detailQ.isLoading ? (
                    <div className="space-y-2">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="flex gap-3 rounded-md border border-border p-3">
                          <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-muted" />
                          <div className="flex-1 space-y-2">
                            <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                            <div className="h-3 w-full animate-pulse rounded bg-muted" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : sortedComments.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border py-10 text-center">
                      <MessageSquare className="mx-auto h-6 w-6 text-muted-foreground" />
                      <p className="mt-2 text-sm text-muted-foreground">
                        No comments yet. Be the first to reply.
                      </p>
                    </div>
                  ) : (
                    sortedComments
                      .filter((c) => !c.parent_id)
                      .map((c) => {
              const trainerLink = !!c.author?.is_trainer;
                      const cName =
                c.author?.display_name ?? c.author?.username ?? "user";
              const nameNode = (
                <span className="inline-flex items-center gap-1 font-medium">
                  {cName}
                  {c.author?.is_trainer && (
                    <BadgeCheck className="h-3 w-3 text-primary" />
                  )}
                </span>
              );

              // PRD: Only post owner can reply to trainer top-level comments
              const isTrainerComment = !!c.author?.is_trainer;
              const isPostOwner = currentUserId === post.author_id;
              const isCommentAuthor = currentUserId === c.author_id;
              const showReplyButton = signedIn && (!isTrainerComment || isPostOwner || isCommentAuthor);

              // Get replies for this comment
              const replies = sortedComments.filter((r) => r.parent_id === c.id);

              return (
                <div key={c.id} className="space-y-2">
                <div
                  className={`flex gap-3 rounded-md border p-3 text-sm ${
                    c.author?.is_trainer
                      ? "border-primary/30 bg-primary/5"
                      : "border-border bg-card"
                  }`}
                >
                  <UserAvatar
                    src={c.author?.avatar_url}
                    name={cName}
                    size="md"
                    isTrainer={c.author?.is_trainer}
                  />
                  <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 text-xs">
                    {trainerLink ? (
                      <Link
                        to="/trainers/$username"
                        params={{ username: c.author!.username ?? c.author!.user_id }}
                        className="hover:underline"
                      >
                        {nameNode}
                      </Link>
                    ) : (
                      nameNode
                    )}
                    <span className="text-muted-foreground">
                      · {new Date(c.created_at).toLocaleDateString()}
                    </span>
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">{c.body}</p>
                  {showReplyButton && (
                    <button
                      type="button"
                      className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-widest text-muted-foreground transition-colors hover:text-primary"
                      onClick={() => {
                        setReplyingTo({
                          commentId: c.id,
                          authorName: cName,
                        });
                        // Focus the textarea
                        const ta = document.querySelector<HTMLTextAreaElement>(
                          "[data-comment-input]"
                        );
                        ta?.focus();
                      }}
                    >
                      <CornerDownRight className="h-3 w-3" />
                      Reply
                    </button>
                  )}
                  </div>
                </div>

                {/* Nested replies */}
                {replies.length > 0 && (
                  <div className="ml-8 space-y-2 border-l-2 border-border/50 pl-3">
                    {replies.map((r) => {
                      const rTrainerLink = !!r.author?.is_trainer;
                      const rName = r.author?.display_name ?? r.author?.username ?? "user";
                      const rNameNode = (
                        <span className="inline-flex items-center gap-1 font-medium">
                          {rName}
                          {r.author?.is_trainer && (
                            <BadgeCheck className="h-3 w-3 text-primary" />
                          )}
                        </span>
                      );
                      return (
                        <div
                          key={r.id}
                          className={`flex gap-3 rounded-md border p-3 text-sm ${
                            r.author?.is_trainer
                              ? "border-primary/30 bg-primary/5"
                              : "border-border bg-card"
                          }`}
                        >
                          <UserAvatar
                            src={r.author?.avatar_url}
                            name={rName}
                            size="md"
                            isTrainer={r.author?.is_trainer}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="flex items-center gap-1 text-xs">
                              {rTrainerLink ? (
                                <Link
                                  to="/trainers/$username"
                                  params={{ username: r.author!.username ?? r.author!.user_id }}
                                  className="hover:underline"
                                >
                                  {rNameNode}
                                </Link>
                              ) : (
                                rNameNode
                              )}
                              <span className="text-muted-foreground">
                                · {new Date(r.created_at).toLocaleDateString()}
                              </span>
                            </p>
                            <p className="mt-1 whitespace-pre-wrap">{r.body}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                </div>
              );
            })
          )}
                </div>
              </section>
            </div>

            {/* Sticky composer */}
            <div className="shrink-0 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:px-6">
          {signedIn ? (
                <>
                <div className="flex items-end gap-2">
                <Textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={
                      replyingTo
                        ? `Replying to ${replyingTo.authorName}…`
                        : "Write a comment…"
                    }
                    data-comment-input
                    rows={1}
                    maxLength={2000}
                    className="min-h-[42px] resize-none"
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" &&
                        (e.metaKey || e.ctrlKey) &&
                        text.trim().length > 0 &&
                        !addMut.isPending
                      ) {
                        e.preventDefault();
                        addMut.mutate();
                      }
                    }}
                  />
                  <Button
                    disabled={text.trim().length === 0 || addMut.isPending}
                    onClick={() => addMut.mutate()}
                    size="sm"
                  >
                    {addMut.isPending && (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    )}
                    Post
                  </Button>
                </div>
                <p className="mt-1 text-right text-[10px] uppercase tracking-widest text-muted-foreground">
                  {text.length}/2000 · ⌘/Ctrl+Enter
                </p>
                {replyingTo && (
                  <button
                    type="button"
                    className="mt-1 inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground transition-colors hover:text-primary"
                    onClick={() => setReplyingTo(null)}
                  >
                    <X className="h-3 w-3" />
                    Cancel reply to {replyingTo.authorName}
                  </button>
                )}
                </>
          ) : (
            <div className="text-center text-sm text-muted-foreground">
              <Button
                size="sm"
                variant="outline"
                onClick={() => router.navigate({ to: "/auth" })}
              >
                Sign in to comment
              </Button>
            </div>
          )}
            </div>
          </div>
        </div>

        {lightboxItems.length > 0 && (
          <MediaLightbox
            items={lightboxItems}
            index={lightboxIndex}
            onIndexChange={setLightboxIndex}
            onClose={() => setLightboxIndex(null)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function hasRespectFromDetail(
  _detail: unknown,
  _post: CommunityPost,
  _signedIn: boolean,
) {
  return false;
}
function SortableAttachment({
  id,
  file,
  onRemove,
  onOpen,
  disabled,
}: {
  id: string;
  file: { preview: string; kind: "image" | "video" };
  onRemove: () => void;
  onOpen?: () => void;
  disabled?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : undefined,
    opacity: isDragging ? 0.85 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group/att relative aspect-square overflow-hidden rounded-md border bg-muted ${
        isDragging
          ? "border-primary shadow-lg ring-2 ring-primary/40"
          : "border-border"
      }`}
    >
      <button
        type="button"
        onClick={onOpen}
        disabled={disabled || !onOpen}
        aria-label="Preview full size"
        className="block h-full w-full cursor-zoom-in"
      >
        {file.kind === "video" ? (
          <video
            src={file.preview}
            className="pointer-events-none h-full w-full object-cover"
            muted
          />
        ) : (
          <img
            src={file.preview}
            alt=""
            className="pointer-events-none h-full w-full object-cover"
          />
        )}
      </button>
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="absolute left-1 top-1 cursor-grab rounded-full bg-background/80 p-1 text-foreground hover:bg-background active:cursor-grabbing"
        aria-label="Drag to reorder"
        disabled={disabled}
      >
        <GripVertical className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-1 top-1 rounded-full bg-background/80 p-1 text-foreground hover:bg-background"
        aria-label="Remove"
        disabled={disabled}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
