import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  HelpCircle,
  Loader2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Heart,
  Send,
  MessageSquare,
  ChevronLeft,
  Video,
  DollarSign,
  Search,
  Filter,
  Sparkles,
  Lock,
  UserCheck,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import SLACountdown from "@/components/sla-countdown";
import { TranslateToggle } from "@/components/translate-toggle";
import { CoachingDisputeModal } from "@/components/coaching-dispute-modal";
import { CompletionTipModal } from "@/components/completion-tip-modal";
import { UserAvatar } from "@/components/user-avatar";
import { supabase } from "@/integrations/supabase/client";
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

function statusBadge(s: QADispatch["status"]) {
  switch (s) {
    case "completed":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-emerald-400 border border-emerald-500/30">
          <CheckCircle2 className="h-3 w-3" /> Completed
        </span>
      );
    case "answered":
    case "coached":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-blue-400 border border-blue-500/30">
          <CheckCircle2 className="h-3 w-3" /> Coached
        </span>
      );
    case "followup_pending":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-400 border border-amber-500/30">
          <Clock className="h-3 w-3 animate-pulse" /> Follow-Up Open
        </span>
      );
    case "pending":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-400 border border-amber-500/30">
          <Clock className="h-3 w-3" /> Pending SLA
        </span>
      );
    case "disputing":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-red-400 border border-red-500/30">
          <AlertTriangle className="h-3 w-3" /> Disputing
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-muted/40 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          <XCircle className="h-3 w-3" /> {s.toUpperCase()}
        </span>
      );
  }
}

function QAInbox() {
  const list = useServerFn(listMyQADispatches);
  const qc = useQueryClient();

  // Get current logged-in user to determine perspective (Trainer vs Trainee)
  const userQuery = useQuery({
    queryKey: ["current-user-qa"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user;
    },
  });
  const currentUserId = userQuery.data?.id;

  const { data: dispatches = [], isLoading, isError, error } = useQuery({
    queryKey: ["qa", "all"],
    queryFn: () => list({ data: { role: "all" } }),
  });

  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<"all" | "creator" | "fan">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");

  // Auto-select first thread when dispatches load
  useEffect(() => {
    if (dispatches.length > 0 && !activeThreadId) {
      setActiveThreadId(dispatches[0].id);
    }
  }, [dispatches, activeThreadId]);

  // Count overdue dispatches for trainer
  const overdueCount = useMemo(() => {
    return dispatches.filter((d) => {
      if (d.status !== "pending") return false;
      const deadline = new Date(d.created_at).getTime() + 48 * 60 * 60 * 1000;
      return Date.now() > deadline;
    }).length;
  }, [dispatches]);

  // Filtered threads list
  const filteredThreads = useMemo(() => {
    return dispatches.filter((d) => {
      if (!currentUserId) return true;
      if (roleFilter === "creator" && d.creator_id !== currentUserId) return false;
      if (roleFilter === "fan" && d.fan_id !== currentUserId) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const partnerName =
          d.creator_id === currentUserId
            ? (d.fan?.display_name ?? d.fan?.username ?? "").toLowerCase()
            : (d.creator?.display_name ?? d.creator?.username ?? "").toLowerCase();
        const qText = d.question.toLowerCase();
        return partnerName.includes(query) || qText.includes(query);
      }

      return true;
    });
  }, [dispatches, roleFilter, searchQuery, currentUserId]);

  const activeThread = useMemo(() => {
    return dispatches.find((d) => d.id === activeThreadId) ?? filteredThreads[0] ?? null;
  }, [dispatches, activeThreadId, filteredThreads]);

  const handleSelectThread = (id: string) => {
    setActiveThreadId(id);
    setMobileView("chat");
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      {/* Top Header */}
      <header className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-premium">
            <HelpCircle className="h-4 w-4" />
            <span className="text-xs uppercase tracking-[0.2em] font-semibold">Private Coaching Workspace</span>
          </div>
          <h1 className="mt-1 font-display text-3xl uppercase tracking-tight">Coaching Inbox</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            5-Step 1:1 Private Coaching sessions. Submit workout videos, receive HD video feedback, and 1 follow-up reply per session.
          </p>
        </div>

        {overdueCount > 0 && (
          <div className="flex items-center gap-2.5 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-xs text-red-400">
            <AlertTriangle className="h-4 w-4 shrink-0 animate-bounce" />
            <div>
              <span className="font-bold">{overdueCount} Pending SLA Overdue</span>
              <p className="text-[11px] opacity-90">Respond now to avoid automatic refund.</p>
            </div>
          </div>
        )}
      </header>

      {/* Main Chat Inbox Container */}
      <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl shadow-2xl overflow-hidden grid grid-cols-12 min-h-[680px] h-[calc(100vh-13rem)]">
        
        {/* Left Sidebar: Threads List */}
        <aside
          className={`col-span-12 md:col-span-4 lg:col-span-4 border-r border-border/60 flex flex-col bg-black/20 ${
            mobileView === "chat" ? "hidden md:flex" : "flex"
          }`}
        >
          {/* Filter Bar */}
          <div className="p-3.5 border-b border-border/60 space-y-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search coaching sessions…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-border/60 bg-muted/40 pl-9 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-premium"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center justify-between gap-1 rounded-lg bg-muted/30 p-1 text-xs">
              <button
                onClick={() => setRoleFilter("all")}
                className={`flex-1 rounded-md py-1.5 text-center font-medium transition-all ${
                  roleFilter === "all"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All ({dispatches.length})
              </button>
              <button
                onClick={() => setRoleFilter("creator")}
                className={`flex-1 rounded-md py-1.5 text-center font-medium transition-all ${
                  roleFilter === "creator"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Received
              </button>
              <button
                onClick={() => setRoleFilter("fan")}
                className={`flex-1 rounded-md py-1.5 text-center font-medium transition-all ${
                  roleFilter === "fan"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Sent
              </button>
            </div>
          </div>

          {/* Threads List */}
          <div className="flex-1 overflow-y-auto divide-y divide-border/30">
            {isLoading && (
              <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mb-2" />
                <span className="text-xs">Loading sessions…</span>
              </div>
            )}

            {isError && (
              <div className="p-6 text-center text-xs text-red-400">
                Failed to load dispatches: {(error as Error)?.message}
              </div>
            )}

            {!isLoading && !isError && filteredThreads.length === 0 && (
              <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                <MessageSquare className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-xs font-medium">No coaching sessions found</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {searchQuery ? "Try a different search query." : "Private coaching requests will appear here."}
                </p>
              </div>
            )}

            {filteredThreads.map((d) => {
              const isTrainer = currentUserId ? d.creator_id === currentUserId : false;
              const partner = isTrainer ? d.fan : d.creator;
              const partnerName = partner?.display_name ?? partner?.username ?? (isTrainer ? "Client" : "Coach");
              const isSelected = activeThread?.id === d.id;

              return (
                <button
                  key={d.id}
                  onClick={() => handleSelectThread(d.id)}
                  className={`w-full text-left p-3.5 transition-colors relative flex items-start gap-3 ${
                    isSelected
                      ? "bg-muted/50 border-l-4 border-premium"
                      : "hover:bg-muted/20"
                  }`}
                >
                  <UserAvatar
                    src={partner?.avatar_url}
                    name={partnerName}
                    size="md"
                    isTrainer={!isTrainer}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="text-xs font-semibold text-foreground truncate">
                        {partnerName}
                      </span>
                      <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                        ${Number(d.price).toFixed(0)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground font-semibold">
                        {isTrainer ? "Client Inquiry" : "Pro Coach"}
                      </span>
                      {statusBadge(d.status)}
                    </div>

                    <p className="text-xs text-muted-foreground truncate line-clamp-1">
                      {d.question}
                    </p>

                    {(d.status === "pending" || d.status === "followup_pending") && (
                      <div className="mt-1.5 flex items-center gap-1 text-[10px] text-amber-400">
                        <Clock className="h-3 w-3" />
                        <SLACountdown createdAt={d.created_at} deadlineHours={48} compact />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Right Main Area: Chat Window */}
        <section
          className={`col-span-12 md:col-span-8 lg:col-span-8 flex flex-col bg-background/40 ${
            mobileView === "list" ? "hidden md:flex" : "flex"
          }`}
        >
          {activeThread ? (
            <ChatThreadView
              d={activeThread}
              currentUserId={currentUserId}
              onBack={() => setMobileView("list")}
              onRefetch={() => qc.invalidateQueries({ queryKey: ["qa"] })}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
              <div className="h-16 w-16 rounded-full bg-muted/30 flex items-center justify-center mb-4">
                <MessageSquare className="h-8 w-8 text-premium opacity-80" />
              </div>
              <h3 className="font-display text-lg uppercase tracking-wide text-foreground">No Conversation Selected</h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1">
                Select a coaching session from the sidebar to review the workout question, trainer feedback, and follow-up replies.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function ChatThreadView({
  d,
  currentUserId,
  onBack,
  onRefetch,
}: {
  d: QADispatch;
  currentUserId?: string;
  onBack: () => void;
  onRefetch: () => void;
}) {
  const answer = useServerFn(answerQADispatch);
  const followupFn = useServerFn(submitQAFollowup);
  const qc = useQueryClient();

  const isTrainer = currentUserId ? d.creator_id === currentUserId : false;
  const partner = isTrainer ? d.fan : d.creator;
  const partnerName = partner?.display_name ?? partner?.username ?? (isTrainer ? "Client" : "Coach");

  const [responseText, setResponseText] = useState("");
  const [showDispute, setShowDispute] = useState(false);
  const [showTip, setShowTip] = useState(false);

  // Mutation for Trainer Answer
  const answerMut = useMutation({
    mutationFn: () => answer({ data: { dispatchId: d.id, answer: responseText } }),
    onSuccess: () => {
      toast.success("Feedback delivered successfully! Funds credited to your wallet.");
      setResponseText("");
      qc.invalidateQueries({ queryKey: ["user-wallet"] });
      qc.invalidateQueries({ queryKey: ["qa"] });
      onRefetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Mutation for Trainee Follow-Up
  const followupMut = useMutation({
    mutationFn: () => followupFn({ data: { dispatchId: d.id, question: responseText } }),
    onSuccess: () => {
      toast.success("Follow-up submitted!");
      setResponseText("");
      qc.invalidateQueries({ queryKey: ["qa"] });
      onRefetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createdDate = new Date(d.created_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Chat Workspace Top Header */}
      <div className="p-4 border-b border-border/60 bg-card/80 backdrop-blur-md flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            size="icon"
            variant="ghost"
            className="md:hidden h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
            onClick={onBack}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>

          <UserAvatar
            src={partner?.avatar_url}
            name={partnerName}
            size="md"
            isTrainer={!isTrainer}
          />

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground truncate">{partnerName}</h2>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-premium/10 text-premium border border-premium/30">
                {isTrainer ? "Client" : "Pro Trainer"}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground truncate">
              {isTrainer ? `Paid Coaching Request · $${Number(d.price).toFixed(2)}` : `1:1 Session with ${partnerName}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {statusBadge(d.status)}

          {d.status === "completed" && !isTrainer && (
            <Button
              size="sm"
              variant="outline"
              className="border-amber-500/50 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 text-xs gap-1 h-8"
              onClick={() => setShowTip(true)}
            >
              <Heart className="h-3.5 w-3.5 fill-current" /> Send Tip
            </Button>
          )}

          {d.status !== "disputing" && d.status !== "completed" && !isTrainer && (
            <Button
              size="sm"
              variant="ghost"
              className="text-xs text-muted-foreground hover:text-amber-400 gap-1 h-8 px-2"
              onClick={() => setShowDispute(true)}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Dispute</span>
            </Button>
          )}
        </div>
      </div>

      {/* SLA Status Bar if pending */}
      {(d.status === "pending" || d.status === "followup_pending") && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center justify-between text-xs text-amber-300 shrink-0">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 shrink-0 animate-pulse text-amber-400" />
            <span>Guaranteed 48h Response SLA Active</span>
          </div>
          <SLACountdown createdAt={d.created_at} deadlineHours={48} compact />
        </div>
      )}

      {/* Chat Messages Timeline Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        
        {/* Message Turn 1: Client Initial Question */}
        <div className="flex flex-col gap-2 max-w-2xl">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <UserAvatar
              src={d.fan?.avatar_url}
              name={d.fan?.display_name ?? d.fan?.username ?? "Client"}
              size="sm"
            />
            <span className="font-semibold text-foreground">
              {d.fan?.display_name ?? d.fan?.username ?? "Client"}
            </span>
            <span>·</span>
            <span>{createdDate}</span>
            <span className="ml-auto text-[10px] font-mono bg-premium/10 text-premium px-1.5 py-0.5 rounded border border-premium/20 font-bold">
              ${Number(d.price).toFixed(2)} PAID SESSION
            </span>
          </div>

          <div className="rounded-2xl rounded-tl-sm border border-border/60 bg-card p-4 text-sm text-foreground shadow-md space-y-3">
            <div className="flex items-center justify-between border-b border-border/40 pb-2">
              <span className="text-xs uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1.5">
                <HelpCircle className="h-3.5 w-3.5 text-premium" /> Workout Analysis Question
              </span>
              <TranslateToggle text={d.question} />
            </div>

            <p className="whitespace-pre-wrap leading-relaxed">{d.question}</p>

            {d.video_url && (
              <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center text-primary shrink-0">
                  <Video className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold text-foreground block">Attached Workout Video</span>
                  <a
                    href={d.video_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary hover:underline truncate block"
                  >
                    {d.video_url}
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Message Turn 2: Trainer Primary Feedback */}
        {d.answer && (
          <div className="flex flex-col gap-2 max-w-2xl ml-auto">
            <div className="flex items-center gap-2 text-xs text-muted-foreground justify-end">
              <span className="mr-auto text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                💰 Payout Released
              </span>
              <span>{d.answered_at ? new Date(d.answered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Delivered"}</span>
              <span>·</span>
              <span className="font-semibold text-foreground">
                {d.creator?.display_name ?? d.creator?.username ?? "Coach"}
              </span>
              <UserAvatar
                src={d.creator?.avatar_url}
                name={d.creator?.display_name ?? d.creator?.username ?? "Coach"}
                size="sm"
                isTrainer
              />
            </div>

            <div className="rounded-2xl rounded-tr-sm border border-primary/40 bg-primary/10 p-4 text-sm text-foreground shadow-lg space-y-3">
              <div className="flex items-center justify-between border-b border-primary/20 pb-2">
                <span className="text-xs font-bold uppercase tracking-widest text-premium flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> Trainer Primary Feedback
                </span>
                <TranslateToggle text={d.answer} />
              </div>

              <p className="whitespace-pre-wrap leading-relaxed">{d.answer}</p>
            </div>
          </div>
        )}

        {/* Message Turn 3: Trainee Follow-Up Question */}
        {d.followup_question && (
          <div className="flex flex-col gap-2 max-w-2xl">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <UserAvatar
                src={d.fan?.avatar_url}
                name={d.fan?.display_name ?? d.fan?.username ?? "Client"}
                size="sm"
              />
              <span className="font-semibold text-foreground">
                {d.fan?.display_name ?? d.fan?.username ?? "Client"}
              </span>
              <span>·</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                1 OF 1 ALLOWED FOLLOW-UP
              </span>
            </div>

            <div className="rounded-2xl rounded-tl-sm border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-foreground shadow-md space-y-3">
              <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
                <span className="text-xs font-bold uppercase tracking-widest text-amber-400">
                  Follow-Up Clarification
                </span>
                <TranslateToggle text={d.followup_question} />
              </div>

              <p className="whitespace-pre-wrap leading-relaxed">{d.followup_question}</p>
            </div>
          </div>
        )}

        {/* Message Turn 4: Trainer Final Response */}
        {d.followup_answer && (
          <div className="flex flex-col gap-2 max-w-2xl ml-auto">
            <div className="flex items-center gap-2 text-xs text-muted-foreground justify-end">
              <span className="font-semibold text-foreground">
                {d.creator?.display_name ?? d.creator?.username ?? "Coach"}
              </span>
              <UserAvatar
                src={d.creator?.avatar_url}
                name={d.creator?.display_name ?? d.creator?.username ?? "Coach"}
                size="sm"
                isTrainer
              />
            </div>

            <div className="rounded-2xl rounded-tr-sm border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-foreground shadow-lg space-y-3">
              <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
                <span className="text-xs font-bold uppercase tracking-widest text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Trainer Final Response
                </span>
                <TranslateToggle text={d.followup_answer} />
              </div>

              <p className="whitespace-pre-wrap leading-relaxed">{d.followup_answer}</p>
            </div>
          </div>
        )}

        {/* Completion & Locked Thread State Banner */}
        {d.status === "completed" && (
          <div className="my-6 rounded-xl border border-white/10 bg-black/60 p-4 text-center space-y-2 max-w-xl mx-auto shadow-xl">
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              <Lock className="h-4 w-4 text-emerald-400" />
              <span>Coaching Session Completed & Thread Locked</span>
            </div>
            <p className="text-xs text-muted-foreground">
              All 5 coaching steps have been fulfilled for this paid session.
            </p>

            {!isTrainer && (
              <div className="pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-amber-500/50 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 text-xs gap-1.5"
                  onClick={() => setShowTip(true)}
                >
                  <Heart className="h-3.5 w-3.5 fill-current" /> Send Tip to {partnerName}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Dispute Active Banner */}
        {d.status === "disputing" && (
          <div className="my-6 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-center space-y-1 max-w-xl mx-auto">
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              <span>Thread Under Admin Dispute Review</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Our moderation team is reviewing this coaching thread. Funds remain held securely.
            </p>
          </div>
        )}
      </div>

      {/* Bottom Interactive Reply Input Bar */}
      <div className="p-4 border-t border-border/60 bg-card/80 backdrop-blur-md shrink-0">
        
        {/* Case A: Trainer needs to send primary answer or final response */}
        {isTrainer && (d.status === "pending" || d.status === "followup_pending") && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-premium">
              <span>
                {d.status === "followup_pending"
                  ? "✍️ Final Response Required"
                  : "✍️ Write Your Coaching Analysis & Feedback"}
              </span>
              <span className="text-muted-foreground text-[11px] font-normal">
                {responseText.length} / 5000 chars
              </span>
            </div>

            <Textarea
              placeholder={
                d.status === "followup_pending"
                  ? "Write your final response to complete the session…"
                  : "Write detailed posture breakdown, rep adjustments, and video feedback analysis…"
              }
              value={responseText}
              onChange={(e) => setResponseText(e.target.value)}
              rows={3}
              maxLength={5000}
              className="bg-background/60 border-border/60 focus:ring-premium text-sm"
            />

            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">
                {d.status === "followup_pending"
                  ? "Submitting will mark this 1:1 session completed."
                  : `Submitting will credit $${Number(d.price).toFixed(2)} to your balance.`}
              </span>
              <Button
                className="bg-premium hover:bg-premium/90 text-white font-semibold uppercase tracking-wider text-xs gap-2"
                disabled={responseText.trim().length < 10 || answerMut.isPending}
                onClick={() => answerMut.mutate()}
              >
                {answerMut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                {d.status === "followup_pending"
                  ? "Final Answer · Complete Session"
                  : `Send Feedback · Release $${Number(d.price).toFixed(2)}`}
              </Button>
            </div>
          </div>
        )}

        {/* Case B: Trainee can ask 1 allowed follow-up question */}
        {!isTrainer && d.status === "coached" && !d.followup_question && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-amber-400">
              <span>⚡ Ask Your 1 Allowed Follow-Up Question</span>
              <span className="text-muted-foreground text-[11px] font-normal">
                {responseText.length} / 2000 chars
              </span>
            </div>

            <Textarea
              placeholder="Ask clarification on posture, reps, or program adjustments…"
              value={responseText}
              onChange={(e) => setResponseText(e.target.value)}
              rows={3}
              maxLength={2000}
              className="bg-background/60 border-border/60 focus:ring-amber-500 text-sm"
            />

            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">
                You have 1 follow-up question included in your $300 coaching package.
              </span>
              <Button
                className="bg-amber-500 hover:bg-amber-600 text-black font-bold uppercase tracking-wider text-xs gap-2"
                disabled={responseText.trim().length < 5 || followupMut.isPending}
                onClick={() => followupMut.mutate()}
              >
                {followupMut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                Submit 1 Follow-Up
              </Button>
            </div>
          </div>
        )}

        {/* Case C: Trainee waiting for Trainer response */}
        {!isTrainer && (d.status === "pending" || d.status === "followup_pending") && (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-center text-xs text-amber-300 flex items-center justify-center gap-2">
            <Clock className="h-4 w-4 animate-spin text-amber-400" />
            <span>
              {d.status === "followup_pending"
                ? `Waiting for ${partnerName}'s final reply…`
                : `Waiting for ${partnerName} to review your video & provide feedback…`}
            </span>
          </div>
        )}

        {/* Case D: Trainer waiting for Trainee follow-up */}
        {isTrainer && d.status === "coached" && !d.followup_question && (
          <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-3 text-center text-xs text-blue-300 flex items-center justify-center gap-2">
            <MessageSquare className="h-4 w-4 text-blue-400" />
            <span>Primary feedback delivered! Waiting to see if client sends their 1 allowed follow-up question.</span>
          </div>
        )}

        {/* Case E: Completed Session */}
        {d.status === "completed" && (
          <div className="rounded-xl bg-muted/40 border border-border/40 p-3 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
            <Lock className="h-3.5 w-3.5" />
            <span>This coaching session is complete and read-only.</span>
          </div>
        )}
      </div>

      {/* Modals */}
      <CoachingDisputeModal
        open={showDispute}
        onOpenChange={setShowDispute}
        threadId={d.id}
        onSuccess={onRefetch}
      />

      <CompletionTipModal
        open={showTip}
        onOpenChange={setShowTip}
        trainerName={partnerName}
        threadId={d.id}
      />
    </div>
  );
}

