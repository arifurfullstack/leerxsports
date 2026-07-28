import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  getNotificationPreferences,
  setNotificationPreferences,
} from "@/lib/notification-functions";

type PrefKey =
  | "story_view"
  | "follow"
  | "respect"
  | "comment"
  | "subscription"
  | "tip"
  | "coaching_message";

const EVENTS: { key: PrefKey; label: string; description: string }[] = [
  { key: "story_view", label: "Story views", description: "When someone watches your story for the first time." },
  { key: "follow", label: "New followers", description: "When someone follows your profile." },
  { key: "respect", label: "Respects", description: "When someone respects your post." },
  { key: "comment", label: "Comments", description: "When someone comments on your post." },
  { key: "subscription", label: "Subscriptions", description: "When someone subscribes to you." },
  { key: "tip", label: "Tips", description: "When someone sends you a tip." },
  { key: "coaching_message", label: "Coaching messages", description: "New messages in a coaching thread." },
];

export function NotificationPreferencesCard() {
  const qc = useQueryClient();
  const getFn = useServerFn(getNotificationPreferences);
  const setFn = useServerFn(setNotificationPreferences);

  const q = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: () => getFn(),
  });

  const [inApp, setInApp] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (q.data) setInApp(q.data.in_app ?? {});
  }, [q.data]);

  const saveMut = useMutation({
    mutationFn: (next: Record<string, boolean>) => setFn({ data: { in_app: next } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notification-preferences"] });
      toast.success("Preferences saved");
    },
    onError: (e: Error) => toast.error(e.message || "Could not save"),
  });

  const toggle = (key: PrefKey, value: boolean) => {
    const next = { ...inApp, [key]: value };
    setInApp(next);
    saveMut.mutate(next);
  };

  if (q.isLoading) {
    return (
      <Card className="flex items-center justify-center p-6">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <div className="mb-1 font-medium">Notifications</div>
      <p className="mb-4 text-xs text-muted-foreground">
        Choose which in-app alerts you receive. Everything is on by default.
      </p>
      <ul className="divide-y divide-border">
        {EVENTS.map((ev) => {
          const enabled = inApp[ev.key] !== false;
          return (
            <li key={ev.key} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <div className="text-sm font-medium">{ev.label}</div>
                <p className="text-xs text-muted-foreground">{ev.description}</p>
              </div>
              <Switch
                checked={enabled}
                onCheckedChange={(v) => toggle(ev.key, v)}
                disabled={saveMut.isPending}
                aria-label={`Toggle ${ev.label}`}
              />
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const next = Object.fromEntries(EVENTS.map((e) => [e.key, true]));
            setInApp(next);
            saveMut.mutate(next);
          }}
          disabled={saveMut.isPending}
        >
          Enable all
        </Button>
      </div>
    </Card>
  );
}