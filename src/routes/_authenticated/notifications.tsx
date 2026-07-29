import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, useMemo } from "react";
import {
  Bell,
  CheckCheck,
  Loader2,
  Search,
  Trash2,
  Sparkles,
  Send,
  UserPlus,
  Flame,
  MessageSquare,
  DollarSign,
  Crown,
  Zap,
  Sliders,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  listNotifications,
  markNotificationRead,
  toggleNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  clearReadNotifications,
  sendTestNotification,
  getNotificationPreferences,
  setNotificationPreferences,
} from "@/lib/notification-functions";
import { NotificationItem } from "@/components/notifications/notification-item";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications Hub — LEER Sports" }] }),
  component: NotificationsPage,
});

const PREF_TYPES = [
  { key: "follow", label: "New Followers", icon: UserPlus, color: "text-blue-400" },
  { key: "respect", label: "Respects & Reactions", icon: Flame, color: "text-rose-400" },
  { key: "comment", label: "Post Comments", icon: MessageSquare, color: "text-emerald-400" },
  { key: "tip", label: "Tips Received", icon: DollarSign, color: "text-amber-400" },
  { key: "subscription", label: "Subscribers & Memberships", icon: Crown, color: "text-purple-400" },
  { key: "coaching_message", label: "Trainer & Coaching Alerts", icon: Zap, color: "text-indigo-400" },
  { key: "system", label: "System Announcements", icon: Bell, color: "text-teal-400" },
];

type CategoryTab = "all" | "unread" | "follows" | "tips" | "social" | "system";

function NotificationsPage() {
  const qc = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<CategoryTab>("all");

  const listFn = useServerFn(listNotifications);
  const markFn = useServerFn(markNotificationRead);
  const toggleFn = useServerFn(toggleNotificationRead);
  const markAllFn = useServerFn(markAllNotificationsRead);
  const deleteFn = useServerFn(deleteNotification);
  const clearReadFn = useServerFn(clearReadNotifications);
  const testNotifFn = useServerFn(sendTestNotification);

  const getPrefsFn = useServerFn(getNotificationPreferences);
  const setPrefsFn = useServerFn(setNotificationPreferences);

  const listQ = useQuery({ queryKey: ["notifications", "list"], queryFn: () => listFn() });
  const prefsQ = useQuery({ queryKey: ["notifications", "prefs"], queryFn: () => getPrefsFn() });

  const [inApp, setInApp] = useState<Record<string, boolean>>({});
  const [email, setEmail] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (prefsQ.data) {
      setInApp(prefsQ.data.in_app ?? {});
      setEmail(prefsQ.data.email ?? {});
    }
  }, [prefsQ.data]);

  const markMut = useMutation({
    mutationFn: async (id: string) => markFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const toggleMut = useMutation({
    mutationFn: async ({ id, is_read }: { id: string; is_read: boolean }) =>
      toggleFn({ data: { id, is_read: !is_read } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllMut = useMutation({
    mutationFn: async () => markAllFn(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("All notifications marked as read");
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Notification removed");
    },
  });

  const clearReadMut = useMutation({
    mutationFn: async () => clearReadFn(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Cleared read notifications");
    },
  });

  const testNotifMut = useMutation({
    mutationFn: async () => {
      const types = ["follow", "respect", "comment", "tip", "subscription", "system"];
      const randomType = types[Math.floor(Math.random() * types.length)];
      return testNotifFn({ data: { type: randomType } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Test notification created!");
    },
  });

  const savePrefs = useMutation({
    mutationFn: async () => setPrefsFn({ data: { in_app: inApp, email: email } }),
    onSuccess: () => {
      toast.success("Notification preferences saved successfully!");
      qc.invalidateQueries({ queryKey: ["notifications", "prefs"] });
    },
    onError: (e: Error) => toast.error(e.message ?? "Save failed"),
  });

  const rawList = listQ.data ?? [];
  const unreadCount = rawList.filter((n) => !n.is_read).length;

  // Filter list by category tab & search query
  const filteredList = useMemo(() => {
    return rawList.filter((item) => {
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = item.title?.toLowerCase().includes(q);
        const bodyMatch = item.body?.toLowerCase().includes(q);
        const actorMatch =
          item.actor?.display_name?.toLowerCase().includes(q) ||
          item.actor?.username?.toLowerCase().includes(q);
        if (!titleMatch && !bodyMatch && !actorMatch) return false;
      }

      // Category tab filter
      if (activeTab === "unread") return !item.is_read;
      if (activeTab === "follows") return item.type === "follow" || item.type === "subscription";
      if (activeTab === "tips") return item.type === "tip";
      if (activeTab === "social")
        return ["comment", "respect", "coaching_message"].includes(item.type);
      if (activeTab === "system") return item.type === "system";

      return true;
    });
  }, [rawList, activeTab, searchQuery]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Top Page Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-[0_0_20px_rgba(234,88,12,0.2)]">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Notifications Hub
              </h1>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Activity alerts, social interactions, tip receipts, and event triggers.
              </p>
            </div>
          </div>
        </div>

        {/* Top Control Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl border-border/80 text-xs font-medium hover:bg-card"
            onClick={() => testNotifMut.mutate()}
            disabled={testNotifMut.isPending}
          >
            {testNotifMut.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="mr-1.5 h-3.5 w-3.5 text-primary" />
            )}
            Test Notification
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="rounded-xl border-border/80 text-xs font-medium hover:bg-card"
            onClick={() => markAllMut.mutate()}
            disabled={markAllMut.isPending || unreadCount === 0}
          >
            <CheckCheck className="mr-1.5 h-3.5 w-3.5 text-primary" /> Mark all read
          </Button>

          {rawList.some((n) => n.is_read) && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl border-border/80 text-xs font-medium hover:text-destructive hover:bg-card"
              onClick={() => clearReadMut.mutate()}
              disabled={clearReadMut.isPending}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Clear read
            </Button>
          )}
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* Main Notifications Feed */}
        <div className="space-y-4">
          {/* Search & Filter Header Bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by title, handle, or comment..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 rounded-xl border-border/80 bg-card/60 text-xs text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/50"
              />
            </div>

            {/* Total items stats badge */}
            <div className="text-xs text-muted-foreground font-medium">
              Showing <span className="font-bold text-foreground">{filteredList.length}</span> of{" "}
              <span className="font-bold text-foreground">{rawList.length}</span> alerts
            </div>
          </div>

          {/* Category Tabs Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto rounded-2xl border border-border/60 bg-muted/20 p-1.5 no-scrollbar">
            {(
              [
                { id: "all", label: "All Activity", badge: rawList.length },
                { id: "unread", label: "Unread", badge: unreadCount },
                {
                  id: "follows",
                  label: "Follows & Subs",
                  badge: rawList.filter((i) => ["follow", "subscription"].includes(i.type)).length,
                },
                {
                  id: "tips",
                  label: "Tips & Earnings",
                  badge: rawList.filter((i) => i.type === "tip").length,
                },
                {
                  id: "social",
                  label: "Comments & Respect",
                  badge: rawList.filter((i) =>
                    ["comment", "respect", "coaching_message"].includes(i.type),
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
                  "flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium transition-all duration-150 shrink-0",
                  activeTab === tab.id
                    ? "bg-card text-foreground shadow-sm border border-border/80 font-bold"
                    : "text-muted-foreground hover:bg-card/50 hover:text-foreground",
                )}
              >
                <span>{tab.label}</span>
                {tab.badge > 0 && (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.2 text-[10px] font-extrabold",
                      activeTab === tab.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted-foreground/20 text-muted-foreground",
                    )}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Notifications Feed Cards Container */}
          <Card className="rounded-2xl border border-border/80 bg-card/60 backdrop-blur-md p-3 sm:p-4">
            {listQ.isLoading ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                <p className="text-sm font-medium">Loading Notifications Hub...</p>
              </div>
            ) : filteredList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 text-primary shadow-[0_0_20px_rgba(234,88,12,0.25)]">
                  <Sparkles className="h-8 w-8" />
                </div>
                <h3 className="text-base font-bold text-foreground">
                  {searchQuery ? "No matching notifications" : "No notifications yet"}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                  {searchQuery
                    ? `No notifications found matching "${searchQuery}". Try searching with a different keyword.`
                    : "When coaches, subscribers, or fans interact with your posts and profile, your alerts will show up here."}
                </p>
                {searchQuery && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 rounded-xl text-xs"
                    onClick={() => setSearchQuery("")}
                  >
                    Clear Search
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredList.map((n) => (
                  <NotificationItem
                    key={n.id}
                    notification={n}
                    onMarkRead={(id) => markMut.mutate(id)}
                    onToggleRead={(id, isRead) =>
                      toggleMut.mutate({ id, is_read: isRead })
                    }
                    onDelete={(id) => deleteMut.mutate(id)}
                  />
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right Sidebar: Notification Preferences & Controls */}
        <div className="space-y-6">
          <Card className="rounded-2xl border border-border/80 bg-card/60 backdrop-blur-md p-5 shadow-lg">
            <div className="flex items-center gap-2 mb-2">
              <Sliders className="h-4 w-4 text-primary" />
              <h2 className="font-display text-base font-bold text-foreground">
                Alert Preferences
              </h2>
            </div>
            <p className="mb-5 text-xs text-muted-foreground leading-relaxed">
              Configure which events trigger real-time in-app pushes or email digests.
            </p>

            <div className="space-y-3.5">
              {/* Header Titles */}
              <div className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-border/60 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <span>Event Type</span>
                <span>In-App</span>
                <span>Email</span>
              </div>

              {/* Preferences List */}
              {PREF_TYPES.map((t) => {
                const Icon = t.icon;
                return (
                  <div
                    key={t.key}
                    className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-1"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={cn("shrink-0 p-1.5 rounded-lg bg-muted/60", t.color)}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-xs font-medium text-foreground truncate">
                        {t.label}
                      </span>
                    </div>

                    <Switch
                      checked={inApp[t.key] !== false}
                      onCheckedChange={(v) =>
                        setInApp((prev) => ({ ...prev, [t.key]: v }))
                      }
                    />
                    <Switch
                      checked={email[t.key] === true}
                      onCheckedChange={(v) =>
                        setEmail((prev) => ({ ...prev, [t.key]: v }))
                      }
                    />
                  </div>
                );
              })}
            </div>

            <Button
              className="mt-6 w-full rounded-xl bg-primary text-xs font-bold text-primary-foreground shadow-[0_0_15px_rgba(234,88,12,0.3)] hover:bg-primary/90 transition-all duration-200"
              onClick={() => savePrefs.mutate()}
              disabled={savePrefs.isPending}
            >
              {savePrefs.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Save Preferences
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}