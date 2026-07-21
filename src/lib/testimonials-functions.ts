import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type Testimonial = {
  id: string;
  name: string;
  role: string;
  body: string;
  avatar_url: string | null;
};

/**
 * Static fallback used when the API is unreachable or returns no rows.
 * Kept in sync with the seed data in the testimonials migration so the
 * homepage carousel always renders something meaningful.
 */
export const STATIC_TESTIMONIALS: Testimonial[] = [
  {
    id: "static-1",
    name: "Leo M.",
    role: "Member · 8 months",
    body: "First platform where my coach actually watches my lifts. Video feedback beats any group chat.",
    avatar_url:
      "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=256&h=256&fit=crop&crop=faces&auto=format&q=75",
  },
  {
    id: "static-2",
    name: "Priya S.",
    role: "Member · 1 year",
    body: "I stopped bouncing between apps. Programs, community, and a real pro in one place.",
    avatar_url:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=256&h=256&fit=crop&crop=faces&auto=format&q=75",
  },
  {
    id: "static-3",
    name: "Diego R.",
    role: "Member · 6 months",
    body: "The verification is real. My coach is an ex-national athlete — not a random influencer.",
    avatar_url:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=256&h=256&fit=crop&crop=faces&auto=format&q=75",
  },
  {
    id: "static-4",
    name: "Amelia K.",
    role: "Member · 4 months",
    body: "Weekly form reviews reshaped my squat in two months. Nothing else has moved the needle like this.",
    avatar_url:
      "https://images.unsplash.com/photo-1541823709867-1b206113eafd?w=256&h=256&fit=crop&crop=faces&auto=format&q=75",
  },
  {
    id: "static-5",
    name: "Tomás E.",
    role: "Member · 10 months",
    body: "The community layer is quiet in a good way — actual athletes talking programming, not hype.",
    avatar_url:
      "https://images.unsplash.com/photo-1552058544-f2b08422138a?w=256&h=256&fit=crop&crop=faces&auto=format&q=75",
  },
  {
    id: "static-6",
    name: "Yuki N.",
    role: "Member · 5 months",
    body: "Multilingual captions on every drill mean my mum can follow the program too. Huge unlock.",
    avatar_url:
      "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=256&h=256&fit=crop&crop=faces&auto=format&q=75",
  },
];

export const listTestimonials = createServerFn({ method: "GET" }).handler(
  async (): Promise<Testimonial[]> => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return STATIC_TESTIMONIALS;

    try {
      const supabase = createClient<Database>(url, key, {
        auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        global: {
          fetch: (input, init) => {
            const h = new Headers(init?.headers);
            if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
              h.delete("Authorization");
            }
            h.set("apikey", key);
            return fetch(input, { ...init, headers: h });
          },
        },
      });

      const { data, error } = await supabase
        .from("testimonials")
        .select("id, name, role, body, avatar_url")
        .eq("published", true)
        .order("sort_order", { ascending: true })
        .limit(24);

      if (error || !data || data.length === 0) return STATIC_TESTIMONIALS;
      return data as unknown as Testimonial[];
    } catch {
      return STATIC_TESTIMONIALS;
    }
  },
);