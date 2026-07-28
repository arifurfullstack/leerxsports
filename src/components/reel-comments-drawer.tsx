import { useEffect, useMemo, useRef, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useServerFn } from "@tanstack/react-start";
import {
  listComments,
  addComment,
  type CommentNode,
} from "@/lib/engagement-functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";

function timeAgo(iso: string) {
  try {
    return formatDistanceToNowStrict(new Date(iso), { addSuffix: true });
  } catch {
    return "";
  }
}

export function ReelCommentsDrawer({
  open,
  onOpenChange,
  postId,
  onCountChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  postId: string | null;
  onCountChange?: (postId: string, delta: number) => void;
}) {
  const [items, setItems] = useState<CommentNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [me, setMe] = useState<{
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const listFn = useServerFn(listComments);
  const addFn = useServerFn(addComment);

  // Load viewer profile once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) {
        if (!cancelled) setMe(null);
        return;
      }
      const { data: p } = await supabase
        .from("profiles")
        .select("username, display_name, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!cancelled)
        setMe({
          id: user.id,
          username: p?.username ?? null,
          display_name: p?.display_name ?? null,
          avatar_url: p?.avatar_url ?? null,
        });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load comments when opened
  useEffect(() => {
    if (!open || !postId) return;
    let cancelled = false;
    setLoading(true);
    listFn({ data: { postId } })
      .then((rows) => {
        if (!cancelled) setItems(rows);
      })
      .catch((e) => toast.error(e?.message ?? "Failed to load comments"))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, postId, listFn]);

  // Realtime subscription to new comments for this post
  useEffect(() => {
    if (!open || !postId) return;
    const channel = supabase
      .channel(`reel-comments:${postId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "comments",
          filter: `post_id=eq.${postId}`,
        },
        async (payload) => {
          const r = payload.new as {
            id: string;
            post_id: string;
            author_id: string;
            parent_id: string | null;
            body: string;
            status: string;
            created_at: string;
          };
          if (r.status !== "visible") return;
          setItems((prev) => {
            if (prev.some((c) => c.id === r.id)) return prev;
            // If this is our own comment, an optimistic entry will get reconciled;
            // avoid duplicating if a temp entry from the same author with same body exists.
            if (
              me &&
              r.author_id === me.id &&
              prev.some(
                (c) =>
                  c.id.startsWith("tmp-") &&
                  c.author_id === me.id &&
                  c.body === r.body,
              )
            ) {
              return prev.map((c) =>
                c.id.startsWith("tmp-") &&
                c.author_id === me.id &&
                c.body === r.body
                  ? { ...c, id: r.id, created_at: r.created_at }
                  : c,
              );
            }
            return [
              ...prev,
              {
                id: r.id,
                post_id: r.post_id,
                author_id: r.author_id,
                parent_id: r.parent_id,
                body: r.body,
                status: r.status as CommentNode["status"],
                created_at: r.created_at,
                author: {
                  username: null,
                  display_name: null,
                  avatar_url: null,
                },
              },
            ];
          });
          // Hydrate author profile lazily
          const { data: p } = await supabase
            .from("profiles")
            .select("username, display_name, avatar_url")
            .eq("user_id", r.author_id)
            .maybeSingle();
          if (p) {
            setItems((prev) =>
              prev.map((c) =>
                c.id === r.id
                  ? {
                      ...c,
                      author: {
                        username: p.username ?? null,
                        display_name: p.display_name ?? null,
                        avatar_url: p.avatar_url ?? null,
                      },
                    }
                  : c,
              ),
            );
          }
          // Only bump count for comments not authored by me (mine bumped optimistically)
          if (!me || r.author_id !== me.id) {
            onCountChange?.(postId, 1);
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, postId, me, onCountChange]);

  // Auto-scroll to bottom on new items
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [items.length]);

  const canPost = useMemo(
    () => !!me && body.trim().length > 0 && body.trim().length <= 2000 && !posting,
    [me, body, posting],
  );

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!postId || !me || !canPost) return;
    const text = body.trim();
    const tempId = `tmp-${Date.now()}`;
    const optimistic: CommentNode = {
      id: tempId,
      post_id: postId,
      author_id: me.id,
      parent_id: null,
      body: text,
      status: "visible",
      created_at: new Date().toISOString(),
      author: {
        username: me.username,
        display_name: me.display_name,
        avatar_url: me.avatar_url,
      },
    };
    setItems((prev) => [...prev, optimistic]);
    setBody("");
    setPosting(true);
    onCountChange?.(postId, 1);
    try {
      const saved = await addFn({ data: { postId, body: text } });
      setItems((prev) =>
        prev.some((c) => c.id === saved.id)
          ? prev.filter((c) => c.id !== tempId)
          : prev.map((c) => (c.id === tempId ? saved : c)),
      );
    } catch (err) {
      setItems((prev) => prev.filter((c) => c.id !== tempId));
      setBody(text);
      onCountChange?.(postId, -1);
      toast.error(err instanceof Error ? err.message : "Failed to post comment");
    } finally {
      setPosting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full max-w-md flex-col gap-0 p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b border-border/60 px-4 py-3 text-left">
          <SheetTitle className="text-base font-bold">
            Comments {items.length > 0 && (
              <span className="ml-1 text-xs font-medium text-muted-foreground">
                ({items.length})
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        <div
          ref={listRef}
          role="log"
          aria-live="polite"
          className="flex-1 overflow-y-auto px-4 py-3"
        >
          {loading ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
              <p className="text-sm font-semibold">No comments yet</p>
              <p className="text-xs text-muted-foreground">
                Be the first to leave one.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {items.map((c) => {
                const name =
                  c.author.display_name || c.author.username || "User";
                return (
                  <li key={c.id} className="flex gap-2.5">
                    <UserAvatar
                      src={c.author.avatar_url}
                      name={name}
                      size="sm"
                      className="h-8 w-8 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="truncate text-sm font-semibold">
                          {name}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {timeAgo(c.created_at)}
                        </span>
                        {c.id.startsWith("tmp-") && (
                          <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
                            sending…
                          </span>
                        )}
                      </div>
                      <p className="whitespace-pre-wrap break-words text-sm text-foreground/90">
                        {c.body}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          className="border-t border-border/60 bg-background/95 px-3 py-2.5 backdrop-blur"
        >
          {me ? (
            <div className="flex items-end gap-2">
              <UserAvatar
                src={me.avatar_url}
                name={me.display_name || me.username || "You"}
                size="sm"
                className="h-8 w-8 shrink-0"
              />
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder="Add a comment…"
                rows={1}
                maxLength={2000}
                className="max-h-32 min-h-9 flex-1 resize-none py-2"
              />
              <Button
                type="submit"
                size="icon"
                disabled={!canPost}
                aria-label="Post comment"
              >
                {posting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          ) : (
            <p className="py-2 text-center text-xs text-muted-foreground">
              Sign in to join the conversation.
            </p>
          )}
        </form>
      </SheetContent>
    </Sheet>
  );
}
