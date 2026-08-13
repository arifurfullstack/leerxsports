import React from "react";
import { Sparkles } from "lucide-react";
import { useFreshContentTracker } from "@/lib/fresh-content-tracker";

type BadgeProps = {
  postId: string;
  createdAt: string;
  className?: string;
  onSeen?: () => void;
};

export function NewContentBadge({ postId, createdAt, className = "", onSeen }: BadgeProps) {
  const { isFresh, markSeen } = useFreshContentTracker();

  if (!isFresh(postId, createdAt)) return null;

  return (
    <span
      onClick={() => {
        markSeen(postId);
        onSeen?.();
      }}
      className={`inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-[0_0_12px_rgba(245,158,11,0.5)] animate-pulse ${className}`}
    >
      <Sparkles className="h-3 w-3 fill-current" />
      <span>NEW</span>
    </span>
  );
}

export function NewContentAvatarRing({
  postId,
  createdAt,
  children,
}: {
  postId: string;
  createdAt: string;
  children: React.ReactNode;
}) {
  const { isFresh } = useFreshContentTracker();

  if (!isFresh(postId, createdAt)) {
    return <>{children}</>;
  }

  return (
    <div className="relative p-0.5 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 animate-pulse shadow-[0_0_12px_rgba(245,158,11,0.6)]">
      {children}
      <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500 text-[8px] font-black text-black ring-2 ring-background shadow">
        ★
      </span>
    </div>
  );
}
