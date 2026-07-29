import { Link } from "@tanstack/react-router";
import {
  UserPlus,
  Flame,
  MessageSquare,
  DollarSign,
  Crown,
  Zap,
  Bell,
  Check,
  CheckCheck,
  Trash2,
  ExternalLink,
  Eye,
  ShieldCheck,
  Award,
} from "lucide-react";
import { type Notification } from "@/lib/notification-functions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function timeAgo(iso: string): string {
  const d = new Date(iso).getTime();
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// Fallback avatar lookup for demo handles/names when actor avatar URL is missing
const DEMO_AVATAR_MAP: Record<string, string> = {
  kai: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&auto=format&fit=crop&q=80",
  nova: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
  "coach nova": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
  rhea: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
  "coach rhea": "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
  sable: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80",
  "coach sable": "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80",
  alex: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
  marcus: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
};

interface NotificationItemProps {
  notification: Notification;
  onMarkRead?: (id: string) => void;
  onToggleRead?: (id: string, currentRead: boolean) => void;
  onDelete?: (id: string) => void;
  onClickItem?: () => void;
  compact?: boolean;
}

export function NotificationItem({
  notification,
  onMarkRead,
  onToggleRead,
  onDelete,
  onClickItem,
  compact = false,
}: NotificationItemProps) {
  const meta = (notification.metadata ?? {}) as Record<string, any>;
  
  // 1. Resolve raw fields from DB hydration or metadata
  let actorAvatar =
    notification.actor?.avatar_url ||
    meta.viewer_avatar_url ||
    meta.actor_avatar_url ||
    meta.avatar_url ||
    null;

  let actorName =
    notification.actor?.display_name ||
    meta.viewer_name ||
    meta.actor_name ||
    null;

  let actorUsername =
    notification.actor?.username ||
    meta.viewer_username ||
    meta.actor_username ||
    null;

  // 2. If actorName is missing, try parsing first word from title (e.g., "Kai followed you" -> "Kai")
  if (!actorName && notification.title) {
    const match = notification.title.match(/^([A-[a-zA-Z0-9_\s]+?)\s+(followed|subscribed|sent|commented|flexed|viewed)/i);
    if (match && match[1]) {
      actorName = match[1].trim();
    }
  }

  // 3. Dynamic avatar fallback: match known demo user names or generate UI Avatars
  if (!actorAvatar && actorName) {
    const lowerName = actorName.toLowerCase();
    for (const key of Object.keys(DEMO_AVATAR_MAP)) {
      if (lowerName.includes(key)) {
        actorAvatar = DEMO_AVATAR_MAP[key];
        break;
      }
    }
    if (!actorAvatar) {
      actorAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(actorName)}&background=ea580c&color=fff&bold=true`;
    }
  }

  const type = notification.type;

  // 4. Dynamic Feature Icon & Color Badge per notification type
  const getTypeBadge = () => {
    switch (type) {
      case "follow":
        return {
          icon: UserPlus,
          label: "Follow",
          bg: "bg-blue-500/20 text-blue-400 border-blue-500/40",
          glow: "group-hover:shadow-[0_0_12px_rgba(59,130,246,0.4)]",
        };
      case "respect":
        return {
          icon: Flame,
          label: "Respect",
          bg: "bg-rose-500/20 text-rose-400 border-rose-500/40",
          glow: "group-hover:shadow-[0_0_12px_rgba(244,63,94,0.4)]",
        };
      case "comment":
        return {
          icon: MessageSquare,
          label: "Comment",
          bg: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
          glow: "group-hover:shadow-[0_0_12px_rgba(16,185,129,0.4)]",
        };
      case "tip":
        return {
          icon: DollarSign,
          label: "Tip",
          bg: "bg-amber-500/20 text-amber-400 border-amber-500/40",
          glow: "group-hover:shadow-[0_0_12px_rgba(245,158,11,0.4)]",
        };
      case "subscription":
        return {
          icon: Crown,
          label: "Subscriber",
          bg: "bg-purple-500/20 text-purple-400 border-purple-500/40",
          glow: "group-hover:shadow-[0_0_12px_rgba(168,85,247,0.4)]",
        };
      case "coaching_message":
        return {
          icon: Zap,
          label: "Coaching",
          bg: "bg-indigo-500/20 text-indigo-400 border-indigo-500/40",
          glow: "group-hover:shadow-[0_0_12px_rgba(99,102,241,0.4)]",
        };
      case "story_view":
        return {
          icon: Eye,
          label: "Story View",
          bg: "bg-pink-500/20 text-pink-400 border-pink-500/40",
          glow: "group-hover:shadow-[0_0_12px_rgba(236,72,153,0.4)]",
        };
      case "system":
        return {
          icon: ShieldCheck,
          label: "System",
          bg: "bg-teal-500/20 text-teal-400 border-teal-500/40",
          glow: "group-hover:shadow-[0_0_12px_rgba(20,184,166,0.4)]",
        };
      default:
        return {
          icon: Bell,
          label: "Alert",
          bg: "bg-primary/20 text-primary border-primary/40",
          glow: "group-hover:shadow-[0_0_12px_rgba(234,88,12,0.4)]",
        };
    }
  };

  const badgeConfig = getTypeBadge();
  const BadgeIcon = badgeConfig.icon;

  const handleClick = () => {
    if (!notification.is_read && onMarkRead) {
      onMarkRead(notification.id);
    }
    if (onClickItem) {
      onClickItem();
    }
  };

  // Determine link target or default profile/feed fallback
  const linkPath =
    notification.link ||
    (actorUsername
      ? `/profile`
      : type === "comment" || type === "respect"
      ? "/feed"
      : undefined);

  const cardContent = (
    <div
      className={cn(
        "group relative flex items-start gap-3 rounded-xl border transition-all duration-200",
        compact ? "p-2.5" : "p-3.5 sm:p-4",
        notification.is_read
          ? "border-transparent bg-background/40 hover:bg-muted/40"
          : "border-primary/25 bg-primary/5 hover:bg-primary/10 hover:border-primary/40",
      )}
    >
      {/* Unread indicator bar */}
      {!notification.is_read && (
        <span className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full bg-primary shadow-[0_0_8px_rgba(234,88,12,0.6)]" />
      )}

      {/* Dynamic Avatar & Feature Icon Badge */}
      <div className="relative shrink-0">
        {actorAvatar ? (
          <img
            src={actorAvatar}
            alt={actorName ?? "User"}
            className={cn(
              "rounded-full border border-border object-cover shadow-sm",
              compact ? "h-9 w-9" : "h-11 w-11",
            )}
          />
        ) : actorName ? (
          <div
            className={cn(
              "flex items-center justify-center rounded-full border border-border bg-gradient-to-br from-primary/20 to-primary/5 font-bold text-primary shadow-sm",
              compact ? "h-9 w-9 text-xs" : "h-11 w-11 text-sm",
            )}
          >
            {actorName.charAt(0).toUpperCase()}
          </div>
        ) : (
          <div
            className={cn(
              "flex items-center justify-center rounded-full border border-border bg-muted/60 text-muted-foreground",
              compact ? "h-9 w-9" : "h-11 w-11",
            )}
          >
            <BadgeIcon className={compact ? "h-4 w-4" : "h-5 w-5"} />
          </div>
        )}

        {/* Feature Icon Badge Overlay */}
        <div
          className={cn(
            "absolute -bottom-1 -right-1 flex items-center justify-center rounded-full border p-0.5 shadow-md transition-all duration-200 backdrop-blur-sm",
            badgeConfig.bg,
            badgeConfig.glow,
          )}
          title={badgeConfig.label}
        >
          <BadgeIcon className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
        </div>
      </div>

      {/* Main Body */}
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div className="text-xs font-semibold leading-snug text-foreground sm:text-sm">
            {actorName ? (
              <div className="flex flex-wrap items-center gap-x-1.5">
                <span className="font-bold text-foreground">{actorName}</span>
                {actorUsername && (
                  <span className="text-[11px] font-normal text-muted-foreground">
                    @{actorUsername}
                  </span>
                )}
              </div>
            ) : null}
            <div className={cn(actorName ? "font-normal text-muted-foreground" : "font-semibold text-foreground")}>
              {notification.title}
            </div>
          </div>
          <span className="shrink-0 text-[10px] text-muted-foreground/80 sm:text-xs">
            {timeAgo(notification.created_at)}
          </span>
        </div>

        {/* Body snippet */}
        {notification.body && (
          <p
            className={cn(
              "text-xs text-muted-foreground/90 leading-relaxed",
              compact ? "line-clamp-2" : "line-clamp-3",
            )}
          >
            {notification.body}
          </p>
        )}

        {/* Contextual Feature Action Buttons */}
        <div className="pt-1 flex items-center gap-2">
          {type === "follow" && (
            <Link
              to="/profile"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-400 hover:underline"
            >
              <UserPlus className="h-3 w-3" /> View profile & follow
            </Link>
          )}

          {(type === "comment" || type === "respect") && (
            <Link
              to="/feed"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" /> View post
            </Link>
          )}

          {(type === "tip" || type === "subscription") && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400 border border-amber-500/20">
              <Award className="h-3 w-3" /> Verified Supporter
            </span>
          )}
        </div>
      </div>

      {/* Hover Control Buttons (Mark read toggle / Delete) */}
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        {onToggleRead && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            title={notification.is_read ? "Mark as unread" : "Mark as read"}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleRead(notification.id, notification.is_read);
            }}
          >
            {notification.is_read ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <CheckCheck className="h-3.5 w-3.5 text-primary" />
            )}
          </Button>
        )}

        {onDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            title="Delete notification"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete(notification.id);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );

  if (linkPath) {
    const [path, qs] = linkPath.split("?");
    const search: Record<string, string> = {};
    if (qs) {
      for (const [k, v] of new URLSearchParams(qs)) search[k] = v;
    }
    return (
      <Link to={path} search={search} onClick={handleClick} className="block">
        {cardContent}
      </Link>
    );
  }

  return (
    <div onClick={handleClick} className="cursor-pointer">
      {cardContent}
    </div>
  );
}

