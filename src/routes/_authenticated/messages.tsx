import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MessageSquare, Send, PencilLine, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  listDmThreads,
  listDmMessages,
  sendDmMessage,
  openDmThread,
  listMessageableTrainers,
} from "@/lib/dm-functions";
import { TranslateToggle } from "@/components/translate-toggle";
import { toast } from "sonner";

const searchSchema = z.object({
  thread: z.string().uuid().optional(),
  to: z.string().uuid().optional(),
});

export const Route = createFileRoute("/_authenticated/messages")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({ meta: [{ title: "Messages — LEER Sports" }] }),
  component: MessagesPage,
});

function MessagesPage() {
  const { thread, to } = Route.useSearch();
  const navigate = useNavigate({ from: "/messages" });
  const qc = useQueryClient();
  const listFn = useServerFn(listDmThreads);
  const msgFn = useServerFn(listDmMessages);
  const sendFn = useServerFn(sendDmMessage);
  const openFn = useServerFn(openDmThread);
  const listTrainersFn = useServerFn(listMessageableTrainers);
  const [text, setText] = useState("");
  const [me, setMe] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeQuery, setComposeQuery] = useState("");
  const [composingWith, setComposingWith] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
  }, []);

  const threadsQ = useQuery({ queryKey: ["dm-threads"], queryFn: () => listFn() });
  const trainersQ = useQuery({
    queryKey: ["dm-messageable-trainers"],
    queryFn: () => listTrainersFn(),
    enabled: composeOpen,
  });

  const filteredTrainers = (trainersQ.data ?? []).filter((t) => {
    const q = composeQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      (t.display_name ?? "").toLowerCase().includes(q) ||
      (t.username ?? "").toLowerCase().includes(q)
    );
  });

  const startThreadWith = async (userId: string) => {
    setComposingWith(userId);
    try {
      const r = await openFn({ data: { userId } });
      setComposeOpen(false);
      setComposeQuery("");
      navigate({ search: { thread: r.threadId, to: undefined }, replace: true });
      qc.invalidateQueries({ queryKey: ["dm-threads"] });
    } catch (e: any) {
      toast.error(e.message ?? "Cannot open thread");
    } finally {
      setComposingWith(null);
    }
  };

  // If "to" is provided, open/create thread and redirect to thread=id
  useEffect(() => {
    if (!to || thread) return;
    (async () => {
      try {
        const r = await openFn({ data: { userId: to } });
        navigate({ search: { thread: r.threadId, to: undefined }, replace: true });
        qc.invalidateQueries({ queryKey: ["dm-threads"] });
      } catch (e: any) {
        toast.error(e.message ?? "Cannot open thread");
        navigate({ search: {}, replace: true });
      }
    })();
  }, [to, thread]);

  const activeThread = thread ?? null;
  const messagesQ = useQuery({
    queryKey: ["dm-messages", activeThread],
    queryFn: () => msgFn({ data: { threadId: activeThread! } }),
    enabled: !!activeThread,
    refetchInterval: activeThread ? 15_000 : false,
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messagesQ.data?.length]);

  const sendMut = useMutation({
    mutationFn: async () => sendFn({ data: { threadId: activeThread!, text: text.trim() } }),
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["dm-messages", activeThread] });
      qc.invalidateQueries({ queryKey: ["dm-threads"] });
    },
    onError: (e: Error) => toast.error(e.message ?? "Send failed"),
  });

  const activeThreadInfo = threadsQ.data?.find((t) => t.id === activeThread);
  const showCoachingBanner = false; // Placeholder: could be enabled based on trainer subscription

  return (
    <div className="mx-auto flex h-[calc(100vh-64px)] max-w-6xl">
      {/* Thread list */}
      <aside className="hidden w-72 shrink-0 flex-col border-r border-border md:flex">
        <div className="flex items-center justify-between gap-2 border-b border-border p-3">
          <span className="font-display text-sm uppercase tracking-widest">Inbox</span>
          <Button size="sm" variant="outline" onClick={() => setComposeOpen(true)}>
            <PencilLine className="mr-1 h-3.5 w-3.5" />
            New
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {threadsQ.isLoading ? (
            <div className="p-6 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></div>
          ) : !threadsQ.data || threadsQ.data.length === 0 ? (
            <div className="space-y-3 p-6 text-center text-sm text-muted-foreground">
              <div>No conversations yet.</div>
              <Button size="sm" variant="secondary" onClick={() => setComposeOpen(true)}>
                <PencilLine className="mr-1 h-3.5 w-3.5" />
                Message a trainer
              </Button>
            </div>
          ) : (
            <ul>
              {threadsQ.data.map((t) => (
                <li key={t.id}>
                  <button
                    className={`flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-muted/50 ${activeThread === t.id ? "bg-muted" : ""}`}
                    onClick={() => navigate({ search: { thread: t.id, to: undefined } })}
                  >
                    {t.other_avatar_url ? (
                      <img src={t.other_avatar_url} className="h-9 w-9 rounded-full object-cover" alt="" loading="lazy" decoding="async" />
                    ) : (
                      <div className="h-9 w-9 rounded-full bg-muted" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">{t.other_display_name ?? t.other_username}</span>
                        {t.unread_count > 0 && (
                          <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                            {t.unread_count}
                          </span>
                        )}
                      </div>
                      <div className="line-clamp-1 text-xs text-muted-foreground">{t.last_text ?? "No messages yet"}</div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Message a trainer</DialogTitle>
            <DialogDescription>
              Trainers you're subscribed to who have DMs enabled.
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={composeQuery}
              onChange={(e) => setComposeQuery(e.target.value)}
              placeholder="Search trainers..."
              className="pl-8"
              autoFocus
            />
          </div>
          <div className="max-h-80 overflow-y-auto">
            {trainersQ.isLoading ? (
              <div className="p-6 text-center">
                <Loader2 className="mx-auto h-4 w-4 animate-spin" />
              </div>
            ) : filteredTrainers.length === 0 ? (
              <div className="space-y-2 p-6 text-center text-sm text-muted-foreground">
                <div>No trainers available to message.</div>
                <div className="text-xs">
                  Subscribe to a trainer with DMs enabled to start a conversation.
                </div>
                <Link
                  to="/trainers"
                  className="inline-block text-primary hover:underline"
                  onClick={() => setComposeOpen(false)}
                >
                  Browse trainers →
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {filteredTrainers.map((t) => (
                  <li key={t.user_id}>
                    <button
                      className="flex w-full items-center gap-3 px-2 py-2.5 text-left hover:bg-muted/50 disabled:opacity-60"
                      disabled={composingWith === t.user_id}
                      onClick={() => startThreadWith(t.user_id)}
                    >
                      {t.avatar_url ? (
                        <img
                          src={t.avatar_url}
                          className="h-9 w-9 rounded-full object-cover"
                          alt=""
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <div className="h-9 w-9 rounded-full bg-muted" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">
                          {t.display_name ?? t.username ?? "Trainer"}
                        </div>
                        {t.username && (
                          <div className="truncate text-xs text-muted-foreground">
                            @{t.username}
                          </div>
                        )}
                      </div>
                      {composingWith === t.user_id && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Message pane */}
      <section className="flex min-w-0 flex-1 flex-col">
        {!activeThread ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
            <MessageSquare className="h-8 w-8" />
            <div>Select a conversation to start messaging.</div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              {activeThreadInfo?.other_avatar_url ? (
                <img src={activeThreadInfo.other_avatar_url} className="h-8 w-8 rounded-full object-cover" alt="" loading="lazy" decoding="async" />
              ) : (
                <div className="h-8 w-8 rounded-full bg-muted" />
              )}
              <div className="font-medium">
                {activeThreadInfo?.other_display_name ?? activeThreadInfo?.other_username ?? "Conversation"}
              </div>
            </div>

            {showCoachingBanner && (
              <div className="border-b border-border bg-primary/10 px-4 py-2 text-xs">
                Need in-depth coaching?{" "}
                <Link to="/trainers" className="font-semibold text-primary hover:underline">
                  Book a coaching session
                </Link>{" "}
                — DMs are for quick check-ins.
              </div>
            )}

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {messagesQ.isLoading ? (
                <Loader2 className="mx-auto h-4 w-4 animate-spin" />
              ) : (
                (messagesQ.data ?? []).map((m) => {
                  const mine = m.sender_id === me;
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${
                          mine ? "bg-primary text-primary-foreground" : "bg-muted"
                        }`}
                      >
                        {m.text && <div className="whitespace-pre-wrap">{m.text}</div>}
                        {!mine && m.text && <TranslateToggle text={m.text} />}
                        <div className={`mt-1 text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                          {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <form
              className="flex items-end gap-2 border-t border-border p-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (text.trim()) sendMut.mutate();
              }}
            >
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type a message..."
                rows={1}
                className="min-h-[44px] resize-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (text.trim()) sendMut.mutate();
                  }
                }}
              />
              <Button type="submit" disabled={sendMut.isPending || !text.trim()}>
                {sendMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}