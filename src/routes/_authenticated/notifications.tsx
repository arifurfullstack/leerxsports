import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getNotificationPreferences,
  setNotificationPreferences,
} from "@/lib/notification-functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — LEER Sports" }] }),
  component: NotificationsPage,
});

const TYPES: Array<{ key: string; label: string }> = [
  { key: "follow", label: "New followers" },
  { key: "respect", label: "Respects on your posts" },
  { key: "comment", label: "Comments on your posts" },
  { key: "coaching_message", label: "Coaching messages" },
  { key: "subscription", label: "New subscribers" },
  { key: "tip", label: "Tips received" },
  { key: "system", label: "System announcements" },
];

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function NotificationsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listNotifications);
  const markFn = useServerFn(markNotificationRead);
  const markAllFn = useServerFn(markAllNotificationsRead);
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
  const markAllMut = useMutation({
    mutationFn: async () => markAllFn(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const savePrefs = useMutation({
    mutationFn: async () => setPrefsFn({ data: { in_app: inApp, email: email } }),
    onSuccess: () => {
      toast.success("Preferences saved");
      qc.invalidateQueries({ queryKey: ["notifications", "prefs"] });
    },
    onError: (e: Error) => toast.error(e.message ?? "Save failed"),
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl">Notifications</h1>
          <p className="text-sm text-muted-foreground">Stay on top of activity across LEER.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => markAllMut.mutate()} disabled={markAllMut.isPending}>
          <CheckCheck className="mr-2 h-4 w-4" /> Mark all read
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="p-0">
          {listQ.isLoading ? (
            <div className="flex items-center justify-center p-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : !listQ.data || listQ.data.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center text-muted-foreground">
              <Bell className="h-6 w-6" />
              <div className="text-sm">No notifications yet.</div>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {listQ.data.map((n) => {
                const inner = (
                  <div className={`flex flex-col gap-1 px-4 py-3 ${n.is_read ? "" : "bg-primary/5"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-sm font-medium">{n.title}</div>
                      <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(n.created_at)}</span>
                    </div>
                    {n.body && <div className="text-xs text-muted-foreground">{n.body}</div>}
                  </div>
                );
                const onClick = () => {
                  if (!n.is_read) markMut.mutate(n.id);
                };
                return (
                  <li key={n.id}>
                    {n.link ? (
                      <Link to={n.link} onClick={onClick} className="block hover:bg-muted/50">
                        {inner}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={onClick}
                        className="block w-full text-left hover:bg-muted/50"
                      >
                        {inner}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="h-max p-5">
          <h2 className="mb-3 font-display text-lg">Preferences</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Toggle in-app and email notifications per event type.
          </p>
          <div className="space-y-3">
            <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-border pb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <span></span>
              <span>In-app</span>
              <span>Email</span>
            </div>
            {TYPES.map((t) => (
              <div key={t.key} className="grid grid-cols-[1fr_auto_auto] items-center gap-3">
                <span className="text-sm">{t.label}</span>
                <Switch
                  checked={inApp[t.key] !== false}
                  onCheckedChange={(v) => setInApp((p) => ({ ...p, [t.key]: v }))}
                />
                <Switch
                  checked={email[t.key] === true}
                  onCheckedChange={(v) => setEmail((p) => ({ ...p, [t.key]: v }))}
                />
              </div>
            ))}
          </div>
          <Button
            className="mt-4 w-full"
            onClick={() => savePrefs.mutate()}
            disabled={savePrefs.isPending}
          >
            {savePrefs.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save preferences
          </Button>
        </Card>
      </div>
    </div>
  );
}