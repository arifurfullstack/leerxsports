import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SidebarBadges = {
  notifications: number;
  messages: number;
};

const ZERO: SidebarBadges = { notifications: 0, messages: 0 };

async function fetchCounts(userId: string): Promise<SidebarBadges> {
  const [notifRes, dmRes] = await Promise.all([
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false),
    supabase
      .from("direct_messages")
      .select("id, dm_threads!inner(user_a,user_b)", { count: "exact", head: true })
      .is("read_at", null)
      .neq("sender_id", userId)
      .or(`user_a.eq.${userId},user_b.eq.${userId}`, {
        foreignTable: "dm_threads",
      }),
  ]);
  return {
    notifications: notifRes.count ?? 0,
    messages: dmRes.count ?? 0,
  };
}

/**
 * Returns unread badge counts for the sidebar and keeps them in sync via
 * Supabase Realtime. Counts stay at 0 when the viewer is signed out.
 */
export function useSidebarBadges(userId: string | null | undefined): SidebarBadges {
  const [counts, setCounts] = useState<SidebarBadges>(ZERO);

  useEffect(() => {
    if (!userId) {
      setCounts(ZERO);
      return;
    }
    let cancelled = false;

    const refresh = () => {
      fetchCounts(userId)
        .then((next) => {
          if (!cancelled) setCounts(next);
        })
        .catch(() => {
          /* keep last known counts on transient errors */
        });
    };
    refresh();

    const channelKey = `${userId}:${Date.now().toString(36)}:${Math.random()
      .toString(36)
      .slice(2)}`;
    const notificationChannel = supabase.channel(`sidebar-badge-notifications:${channelKey}`);
    notificationChannel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`,
      },
      refresh,
    );
    notificationChannel.subscribe();

    const messageChannel = supabase.channel(`sidebar-badge-messages:${channelKey}`);
    messageChannel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "direct_messages" },
      refresh,
    );
    messageChannel.subscribe();

    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(notificationChannel);
      supabase.removeChannel(messageChannel);
    };
  }, [userId]);

  return counts;
}
