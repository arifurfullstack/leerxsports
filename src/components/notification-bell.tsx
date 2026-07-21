import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listNotifications,
  unreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/notification-functions";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

function timeAgo(iso: string): string {
  const d = new Date(iso).getTime();
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const listFn = useServerFn(listNotifications);
  const countFn = useServerFn(unreadCount);
  const markFn = useServerFn(markNotificationRead);
  const markAllFn = useServerFn(markAllNotificationsRead);

  const countQ = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: () => countFn(),
    refetchInterval: 60_000,
    staleTime: 30_000,
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

  const markAllMut = useMutation({
    mutationFn: async () => markAllFn(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const count = countQ.data ?? 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {count > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <div className="text-sm font-semibold">Notifications</div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={markAllMut.isPending || count === 0}
              onClick={() => markAllMut.mutate()}
            >
              <CheckCheck className="mr-1 h-3.5 w-3.5" /> Mark all
            </Button>
            <Link to="/notifications" onClick={() => setOpen(false)} className="text-xs text-primary hover:underline">
              All
            </Link>
          </div>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {listQ.isLoading ? (
            <div className="flex items-center justify-center p-6 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : !listQ.data || listQ.data.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">You're all caught up.</div>
          ) : (
            <ul className="divide-y divide-border">
              {listQ.data.map((n) => {
                const content = (
                  <div className={`flex flex-col gap-0.5 px-3 py-2.5 text-sm hover:bg-muted/60 ${n.is_read ? "" : "bg-primary/5"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium text-foreground">{n.title}</div>
                      <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(n.created_at)}</span>
                    </div>
                    {n.body && <div className="line-clamp-2 text-xs text-muted-foreground">{n.body}</div>}
                  </div>
                );
                const onClick = () => {
                  if (!n.is_read) markMut.mutate(n.id);
                  setOpen(false);
                };
                return (
                  <li key={n.id}>
                    {n.link ? (
                      <Link to={n.link} onClick={onClick} className="block">
                        {content}
                      </Link>
                    ) : (
                      <button type="button" onClick={onClick} className="block w-full text-left">
                        {content}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}