import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { BadgeCheck, Loader2, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { listFollowConnections } from "@/lib/trainer-functions";

export type FollowListKind = "followers" | "following" | "subscribers";

const TITLES: Record<FollowListKind, { title: string; empty: string }> = {
  followers: { title: "Followers", empty: "No followers yet." },
  following: { title: "Following", empty: "Not following anyone yet." },
  subscribers: { title: "Subscribers", empty: "No subscribers yet." },
};

export function FollowListDialog({
  open,
  onOpenChange,
  userId,
  kind,
  onNavigate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  kind: FollowListKind;
  onNavigate?: () => void;
}) {
  const listFn = useServerFn(listFollowConnections);
  const q = useQuery({
    queryKey: ["follow-list", userId, kind],
    queryFn: () => listFn({ data: { userId, kind, limit: 100 } }),
    enabled: open,
    staleTime: 15_000,
  });
  const rows = q.data ?? [];
  const meta = TITLES[kind];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 sm:max-w-md">
        <DialogHeader className="border-b border-border/60 px-5 py-4">
          <DialogTitle className="flex items-center gap-2 font-display text-base uppercase tracking-widest">
            <Users className="h-4 w-4 text-primary" /> {meta.title}
          </DialogTitle>
          <DialogDescription className="sr-only">List of {meta.title.toLowerCase()}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto px-2 py-2">
          {q.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : q.isError ? (
            <p className="px-4 py-10 text-center text-sm text-destructive">
              Could not load list.
            </p>
          ) : rows.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              {meta.empty}
            </p>
          ) : (
            <ul className="divide-y divide-border/50">
              {rows.map((u) => (
                <li key={u.user_id}>
                  {u.username ? (
                    <Link
                      to="/trainers/$username"
                      params={{ username: u.username }}
                      onClick={() => {
                        onOpenChange(false);
                        onNavigate?.();
                      }}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition hover:bg-muted/40"
                    >
                      <UserRow u={u} />
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 px-3 py-2.5 opacity-70">
                      <UserRow u={u} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function UserRow({
  u,
}: {
  u: {
    user_id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
    is_verified: boolean;
  };
}) {
  const initial = (u.display_name ?? u.username ?? "?")[0]?.toUpperCase() ?? "?";
  return (
    <>
      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted">
        {u.avatar_url ? (
          <img src={u.avatar_url} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm font-medium text-muted-foreground">
            {initial}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span className="truncate text-sm font-semibold">
            {u.display_name ?? u.username ?? "Unknown"}
          </span>
          {u.is_verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-primary" />}
        </div>
        {u.username && (
          <p className="truncate text-xs text-muted-foreground">@{u.username}</p>
        )}
      </div>
    </>
  );
}