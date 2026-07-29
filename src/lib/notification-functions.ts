import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type NotificationType =
  | "follow"
  | "respect"
  | "comment"
  | "coaching_message"
  | "subscription"
  | "tip"
  | "system";

export type NotificationActor = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export type Notification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  actor_id: string | null;
  target_type: string | null;
  target_id: string | null;
  link: string | null;
  metadata: Record<string, any> | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  actor?: NotificationActor | null;
};

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("notifications")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);

    const rawList = (data ?? []) as unknown as Notification[];
    if (rawList.length === 0) return [];

    // Hydrate actor profiles for items with actor_id
    const actorIds = Array.from(
      new Set(rawList.map((n) => n.actor_id).filter(Boolean) as string[]),
    );

    let actorMap = new Map<string, NotificationActor>();
    if (actorIds.length > 0) {
      const { data: profiles } = await context.supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url")
        .in("user_id", actorIds);

      if (profiles && profiles.length > 0) {
        for (const p of profiles as any[]) {
          actorMap.set(p.user_id, {
            id: p.user_id,
            username: p.username ?? null,
            display_name: p.display_name ?? null,
            avatar_url: p.avatar_url ?? null,
          });
        }
      }
    }

    return rawList.map((item) => ({
      ...item,
      actor: item.actor_id ? actorMap.get(item.actor_id) ?? null : null,
    }));
  });

export const unreadCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { count, error } = await context.supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .eq("is_read", false);
    if (error) throw new Error(error.message);
    return count ?? 0;
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => z.object({ id: z.string().uuid(), is_read: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("notifications")
      .update({ is_read: data.is_read, read_at: data.is_read ? new Date().toISOString() : null })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markAllNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("user_id", context.userId)
      .eq("is_read", false);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("notifications")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const clearReadNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("notifications")
      .delete()
      .eq("user_id", context.userId)
      .eq("is_read", true);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendTestNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => z.object({ type: z.string().optional() }).parse(input))
  .handler(async ({ data, context }) => {
    const notifType = data.type ?? "system";
    
    const mockActors: Record<string, { name: string; username: string; avatar: string }> = {
      follow: {
        name: "Coach Nova",
        username: "coach_nova",
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
      },
      respect: {
        name: "Alex Vance",
        username: "alex_fit",
        avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
      },
      comment: {
        name: "Coach Rhea",
        username: "coach_rhea",
        avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
      },
      tip: {
        name: "Coach Sable",
        username: "coach_sable",
        avatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80",
      },
      subscription: {
        name: "Kai Miller",
        username: "kai_sports",
        avatar: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&auto=format&fit=crop&q=80",
      },
      coaching_message: {
        name: "Head Coach Marcus",
        username: "marcus_pro",
        avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
      },
      system: {
        name: "LEER System",
        username: "system",
        avatar: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80",
      },
    };

    const actor = mockActors[notifType] ?? mockActors.system;

    const titles: Record<string, string> = {
      follow: `${actor.name} started following you!`,
      respect: `${actor.name} flexed respect on your workout video 🔥`,
      comment: `${actor.name} commented: 'Awesome form, keep pushing!'`,
      tip: `${actor.name} sent you a $10.00 tip! 💰`,
      subscription: `${actor.name} subscribed to your VIP membership tier! 👑`,
      coaching_message: `${actor.name} sent a new workout breakdown schedule.`,
      system: "System update: New training features and Notifications Hub live! 🎉",
    };

    const bodies: Record<string, string> = {
      follow: "Tap to view profile and follow back.",
      respect: "Your post is trending in the community feed.",
      comment: "'Awesome form, keep pushing!'",
      tip: "Received $10.00 for your latest workout breakdown.",
      subscription: "You unlocked exclusive creator perks for Kai.",
      coaching_message: "Your weekly workout schedule has been updated.",
      system: "Explore the newly updated Notifications Hub and interactive features.",
    };

    const links: Record<string, string> = {
      follow: "/profile",
      respect: "/feed",
      comment: "/feed",
      tip: "/profile",
      subscription: "/profile",
      coaching_message: "/notifications",
      system: "/notifications",
    };

    const { error } = await context.supabase.from("notifications").insert({
      user_id: context.userId,
      type: notifType,
      title: titles[notifType] ?? "New Notification",
      body: bodies[notifType] ?? "This is a notification payload.",
      link: links[notifType] ?? "/notifications",
      metadata: {
        actor_name: actor.name,
        actor_username: actor.username,
        actor_avatar_url: actor.avatar,
      },
      is_read: false,
      created_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getNotificationPreferences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("notification_preferences")
      .select("in_app, email")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      in_app: (data?.in_app ?? {}) as Record<string, boolean>,
      email: (data?.email ?? {}) as Record<string, boolean>,
    };
  });

export const setNotificationPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({
        in_app: z.record(z.string(), z.boolean()).optional(),
        email: z.record(z.string(), z.boolean()).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const payload: { user_id: string; updated_at: string; in_app?: Record<string, boolean>; email?: Record<string, boolean> } = {
      user_id: context.userId,
      updated_at: new Date().toISOString(),
    };
    if (data.in_app) payload.in_app = data.in_app;
    if (data.email) payload.email = data.email;
    const { error } = await context.supabase
      .from("notification_preferences")
      .upsert(payload as any, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });