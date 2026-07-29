import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Bell,
  CheckCheck,
  Loader2,
  Trash2,
  Settings,
  Sparkles,
  Check,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  listNotifications,
  unreadCount,
  markNotificationRead,
  toggleNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  clearReadNotifications,
} from "@/lib/notification-functions";
import { NotificationItem } from "@/components/notifications/notification-item";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type TabFilter = "all" | "unread" | "interactions" | "system";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const qc = useQueryClient();

  const listFn = useServerFn(listNotifications);
  const countFn = useServerFn(unreadCount);
  const markFn = useServerFn(markNotificationRead);
  const toggleFn = useServerFn(toggleNotificationRead);
  const markAllFn = useServerFn(markAllNotificationsRead);
  const deleteFn = useServerFn(deleteNotification);
  const clearReadFn = useServerFn(clearReadNotifications);

  // Audio chime play function for new notification arrival
  const playNotificationSound = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch {
      // Audio context might be restricted before user interaction
    }
  };

  // Real-time Supabase Postgres changes subscription for notifications
  useEffect(() => {
    let active = true;
    let createdChannel: ReturnType<typeof supabase.channel> | null = null;

    const setupRealtime = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const u = session?.user ?? null;
      if (!u || !active) return;

      const channelKey = `bell-notifs:${u.id}:${Date.now()}`;
      createdChannel = supabase.channel(channelKey);

      createdChannel
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${u.id}`,
          },
          (payload) => {
            qc.invalidateQueries({ queryKey: ["notifications"] });
            if (payload.eventType === "INSERT") {
              const newNotif = payload.new as { title?: string; body?: string };
              playNotificationSound();
              toast.info(newNotif.title || "New Notification", {
                description: newNotif.body || undefined,
                action: {
                  label: "View",
                  onClick: () => setOpen(true),
                },
              });
            }
          },
        )
        .subscribe();
    };

    setupRealtime();

    return () => {
      active = false;
      if (createdChannel) {
        supabase.removeChannel(createdChannel);
      }
    };
  }, [qc]);

  const countQ = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: () => countFn(),
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  const listQ = useQuery({
    queryKey: ["notifications", "list"],
    queryFn: () => listFn(),
    enabled: open,
  });

  const markMut = useMutation({
    mutationFn: async (id: string) => markFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const toggleMut = useMutation({
    mutationFn: async ({ id, is_read }: { id: string; is_read: boolean }) =>
      toggleFn({ data: { id, is_read: !is_read } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllMut = useMutation({
    mutationFn: async () => markAllFn(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Notification deleted");
    },
  });

  const clearReadMut = useMutation({
    mutationFn: async () => clearReadFn(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Read notifications cleared");
    },
  });

  const count = countQ.data ?? 0;
  const rawList = listQ.data ?? [];

  // Filter items by active tab
  const filteredList = rawList.filter((item) => {
    if (activeTab === "unread") return !item.is_read;
    if (activeTab === "system") return item.type === "system";
    if (activeTab === "interactions")
      return [
        "follow",
        "respect",
        "comment",
        "tip",
        "subscription",
        "coaching_message",
      ].includes(item.type);
    return true;
  });

  const hasReadItems = rawList.some((item) => item.is_read);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-border/80 bg-card/80 text-muted-foreground transition-all duration-200 hover:border-primary/50 hover:bg-card hover:text-foreground hover:shadow-md focus:outline-none"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4 transition-transform duration-200 hover:rotate-12" />
          {count > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground shadow-[0_0_10px_rgba(234,88,12,0.6)] animate-pulse">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-[380px] sm:w-[420px] p-0 rounded-2xl border border-border/80 bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden"
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-4 py-3">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-base font-semibold text-foreground">
              Notifications
            </h3>
            {count > 0 && (
              <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs font-semibold text-primary">
                {count} new
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
              disabled={markAllMut.isPending || count === 0}
              onClick={() => markAllMut.mutate()}
              title="Mark all as read"
            >
              <CheckCheck className="mr-1 h-3.5 w-3.5 text-primary" /> Mark read
            </Button>

            {hasReadItems && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                disabled={clearReadMut.isPending}
                onClick={() => clearReadMut.mutate()}
                title="Clear read notifications"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}

            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Notification preferences"
            >
              <Settings className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Quick Filter Tabs */}
        <div className="flex items-center gap-1 border-b border-border/60 bg-muted/20 px-3 py-1.5 overflow-x-auto no-scrollbar">
          {(
            [
              { id: "all", label: "All", badge: rawList.length },
              { id: "unread", label: "Unread", badge: count },
              {
                id: "interactions",
                label: "Social",
                badge: rawList.filter((i) =>
                  [
                    "follow",
                    "respect",
                    "comment",
                    "tip",
                    "subscription",
                    "coaching_message",
                  ].includes(i.type),
                ).length,
              },
              {
                id: "system",
                label: "System",
                badge: rawList.filter((i) => i.type === "system").length,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all duration-150 shrink-0",
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <span>{tab.label}</span>
              {tab.badge > 0 && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.2 text-[10px] font-bold",
                    activeTab === tab.id
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-muted-foreground/20 text-muted-foreground",
                  )}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Scrollable Items Container */}
        <div className="max-h-[380px] min-h-[160px] overflow-y-auto p-2 space-y-1.5">
          {listQ.isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
              <p className="text-xs font-medium">Fetching notifications...</p>
            </div>
          ) : filteredList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-[0_0_15px_rgba(234,88,12,0.2)]">
                <Sparkles className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold text-foreground">
                {activeTab === "unread"
                  ? "All caught up!"
                  : "No notifications found"}
              </p>
              <p className="text-xs text-muted-foreground max-w-[240px] mt-1">
                {activeTab === "unread"
                  ? "You have read all your latest updates and alerts."
                  : "New activity, follows, tips, and comments will show up here."}
              </p>
            </div>
          ) : (
            filteredList.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                compact
                onClickItem={() => setOpen(false)}
                onMarkRead={(id) => markMut.mutate(id)}
                onToggleRead={(id, isRead) =>
                  toggleMut.mutate({ id, is_read: isRead })
                }
                onDelete={(id) => deleteMut.mutate(id)}
              />
            ))
          )}
        </div>

        {/* Footer Link */}
        <div className="border-t border-border/60 bg-muted/20 p-2 text-center">
          <Link
            to="/notifications"
            onClick={() => setOpen(false)}
            className="block rounded-lg py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors"
          >
            View all notifications in Notifications Hub →
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}