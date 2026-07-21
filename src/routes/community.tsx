import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
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
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

type Filter = { kind: CommunityKind | "all"; sort: CommunitySort };

function listQuery(f: Filter) {
  return queryOptions({
    queryKey: ["community", f.kind, f.sort],
    queryFn: () => listCommunityPosts({ data: { kind: f.kind, sort: f.sort } }),
  });
}

export const Route = createFileRoute("/community")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(listQuery({ kind: "all", sort: "new" })),
  head: () => ({
    meta: [
      { title: "Community — LEER Sports" },
      {
        name: "description",
        content:
          "Ask questions, share progress, and get answers from verified trainers on LEER Sports.",
      },
      { property: "og:title", content: "LEER Sports Community" },
      {
        property: "og:description",
        content: "Q&A and progress posts from athletes and verified trainers.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: CommunityPage,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="mx-auto max-w-2xl p-8 text-center">
        <h1 className="font-display text-2xl">Could not load community</h1>
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
  notFoundComponent: () => <div className="p-8">Not found</div>,
});

function CommunityPage() {
  const [filter, setFilter] = useState<Filter>({ kind: "all", sort: "new" });
  const first = useSuspenseQuery(listQuery({ kind: "all", sort: "new" }));
  const q = useQuery({ ...listQuery(filter), initialData: first.data });
  const posts = q.data ?? [];

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
  const postIds = useMemo(() => posts.map((p) => p.id), [posts]);
  const mineQ = useQuery({
    queryKey: ["community-my-respects", userId, postIds],
    queryFn: () => getMine({ data: { postIds } }),
    enabled: signedIn && postIds.length > 0,
  });
  const mine = new Set(mineQ.data ?? []);

  const [composerOpen, setComposerOpen] = useState(false);

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-4 py-10 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="font-display text-xs uppercase tracking-[0.3em] text-primary">
            Community
          </span>
          <h1 className="mt-1 font-display text-3xl uppercase tracking-tight">
            Athletes & Coaches
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ask questions or show your progress. Verified trainer replies stand out.
          </p>
        </div>
        <Button
          onClick={() =>
            signedIn
              ? setComposerOpen(true)
              : (window.location.href = "/auth")
          }
        >
          <Plus className="mr-1 h-4 w-4" /> New Post
        </Button>
      </header>

      <div className="mb-6 flex flex-wrap gap-2">
        <Seg
          value={filter.kind}
          setValue={(v) => setFilter((f) => ({ ...f, kind: v }))}
          options={[
            { value: "all", label: "All" },
            { value: "question", label: "Q&A" },
            { value: "flex", label: "FLEX" },
          ]}
        />
        <Seg
          value={filter.sort}
          setValue={(v) => setFilter((f) => ({ ...f, sort: v }))}
          options={[
            { value: "new", label: "New" },
            { value: "top", label: "Top" },
            { value: "trending", label: "Trending" },
          ]}
        />
      </div>

      <section className="space-y-3">
        {q.isLoading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            No posts yet. Be the first to ask a question or flex your progress.
          </div>
        ) : (
          posts.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              hasRespect={mine.has(p.id)}
              signedIn={signedIn}
            />
          ))
        )}
      </section>

      <ComposerDialog open={composerOpen} onOpenChange={setComposerOpen} />
    </main>
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
}: {
  post: CommunityPost;
  hasRespect: boolean;
  signedIn: boolean;
}) {
  const qc = useQueryClient();
  const router = useRouter();
  const toggleFn = useServerFn(toggleCommunityRespect);
  const [open, setOpen] = useState(false);

  const respectMut = useMutation({
    mutationFn: () => toggleFn({ data: { postId: post.id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["community"] });
      qc.invalidateQueries({ queryKey: ["community-my-respects"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <article className="rounded-lg border border-border bg-card p-5">
      <header className="flex items-center gap-2 text-xs">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted">
          {post.author?.avatar_url ? (
            <img
              src={post.author.avatar_url}
              alt=""
              className="h-full w-full rounded-full object-cover"
            />
          ) : (
            (post.author?.display_name ?? post.author?.username ?? "?")[0]?.toUpperCase()
          )}
        </span>
        <span className="font-medium">
          {post.author?.display_name ?? post.author?.username ?? "user"}
        </span>
        {post.author?.is_trainer && (
          <BadgeCheck className="h-3.5 w-3.5 text-primary" />
        )}
        <span className="text-muted-foreground">
          · {new Date(post.created_at).toLocaleDateString()}
        </span>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
          {post.kind === "question" ? (
            <>
              <HelpCircle className="h-3 w-3" /> Q&A
            </>
          ) : (
            <>
              <Trophy className="h-3 w-3" /> FLEX
            </>
          )}
        </span>
      </header>
      <h2 className="mt-3 font-display text-lg uppercase tracking-tight">
        {post.title}
      </h2>
      {post.body && (
        <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
          {post.body}
        </p>
      )}
      {post.hashtags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {post.hashtags.map((h) => (
            <span
              key={h}
              className="text-[11px] text-primary/80"
            >
              #{h}
            </span>
          ))}
        </div>
      )}
      <footer className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
        <button
          onClick={() =>
            signedIn
              ? respectMut.mutate()
              : router.navigate({ to: "/auth" })
          }
          className={`inline-flex items-center gap-1 transition-colors ${
            hasRespect ? "text-primary" : "hover:text-foreground"
          }`}
          aria-label="Respect"
        >
          <Dumbbell className="h-4 w-4" />
          {post.respect_count}
        </button>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1 hover:text-foreground"
          aria-label="Comments"
        >
          <MessageSquare className="h-4 w-4" />
          {post.comment_count}
        </button>
        {post.trainer_answered && (
          <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 px-2 py-0.5 text-[10px] uppercase tracking-widest text-primary">
            <BadgeCheck className="h-3 w-3" /> Trainer Answered
          </span>
        )}
      </footer>
      <CommentsDialog
        open={open}
        onOpenChange={setOpen}
        post={post}
        signedIn={signedIn}
      />
    </article>
  );
}

function ComposerDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const createFn = useServerFn(createCommunityPost);
  const [kind, setKind] = useState<CommunityKind>("question");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");

  const mut = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          kind,
          title: title.trim(),
          body: body.trim(),
          hashtags: tags
            .split(",")
            .map((t) => t.trim().replace(/^#/, ""))
            .filter(Boolean)
            .slice(0, 10),
          media: [],
        },
      }),
    onSuccess: () => {
      toast.success("Posted");
      onOpenChange(false);
      setTitle("");
      setBody("");
      setTags("");
      qc.invalidateQueries({ queryKey: ["community"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const disabled = title.trim().length < 3;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display uppercase">New Post</DialogTitle>
          <DialogDescription>
            Q&A to ask a question, FLEX to share progress.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Seg
            value={kind}
            setValue={setKind}
            options={[
              { value: "question", label: "Q&A" },
              { value: "flex", label: "FLEX" },
            ]}
          />
          <div>
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={140}
              placeholder={
                kind === "question"
                  ? "e.g. How do I fix my squat depth?"
                  : "e.g. First 100kg bench!"
              }
            />
          </div>
          <div>
            <Label>Details (optional)</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              maxLength={4000}
            />
          </div>
          <div>
            <Label>Hashtags (comma-separated, optional)</Label>
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="squat, form, progress"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button disabled={disabled || mut.isPending} onClick={() => mut.mutate()}>
              {mut.isPending && (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              )}
              Post
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CommentsDialog({
  open,
  onOpenChange,
  post,
  signedIn,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  post: CommunityPost;
  signedIn: boolean;
}) {
  const qc = useQueryClient();
  const router = useRouter();
  const addFn = useServerFn(addCommunityComment);
  const [text, setText] = useState("");

  // Lazily load full post + comments only when opened
  const detailQ = useQuery({
    queryKey: ["community-post", post.id],
    queryFn: async () => {
      const { getCommunityPost } = await import("@/lib/community-functions");
      return getCommunityPost({ data: { id: post.id } });
    },
    enabled: open,
  });

  const addMut = useMutation({
    mutationFn: () =>
      addFn({ data: { postId: post.id, body: text.trim() } }),
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["community-post", post.id] });
      qc.invalidateQueries({ queryKey: ["community"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display uppercase">
            {post.title}
          </DialogTitle>
          <DialogDescription className="whitespace-pre-wrap">
            {post.body}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {detailQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading comments…</p>
          ) : detailQ.data?.comments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No comments yet. Be the first to reply.
            </p>
          ) : (
            detailQ.data?.comments.map((c) => {
              const trainerLink = c.author?.is_trainer && c.author.username;
              const nameNode = (
                <span className="inline-flex items-center gap-1 font-medium">
                  {c.author?.display_name ?? c.author?.username ?? "user"}
                  {c.author?.is_trainer && (
                    <BadgeCheck className="h-3 w-3 text-primary" />
                  )}
                </span>
              );
              return (
                <div
                  key={c.id}
                  className={`rounded-md border p-3 text-sm ${
                    c.author?.is_trainer
                      ? "border-primary/30 bg-primary/5"
                      : "border-border bg-card"
                  }`}
                >
                  <p className="flex items-center gap-1 text-xs">
                    {trainerLink ? (
                      <Link
                        to="/trainers/$username"
                        params={{ username: c.author!.username! }}
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
                </div>
              );
            })
          )}
        </div>
        <div className="mt-2 border-t border-border pt-3">
          {signedIn ? (
            <>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Write a comment…"
                rows={3}
                maxLength={2000}
              />
              <div className="mt-2 flex justify-end">
                <Button
                  disabled={text.trim().length === 0 || addMut.isPending}
                  onClick={() => addMut.mutate()}
                  size="sm"
                >
                  {addMut.isPending && (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  )}
                  Post Comment
                </Button>
              </div>
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
      </DialogContent>
    </Dialog>
  );
}