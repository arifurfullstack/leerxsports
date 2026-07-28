import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

// Reusable URL validators with friendly messages.
const IMAGE_EXT_RE = /\.(png|jpe?g|webp|svg|gif|ico|avif)(\?|#|$)/i;

function urlField(opts: {
  label: string;
  required?: boolean;
  imageOnly?: boolean;
  requireHttps?: boolean;
  allowRelative?: boolean;
  host?: RegExp; // e.g. must match twitter.com
  hostLabel?: string;
}) {
  const {
    label,
    required = false,
    imageOnly = false,
    requireHttps = false,
    allowRelative = true,
    host,
    hostLabel,
  } = opts;

  return z
    .string()
    .trim()
    .max(2048, { message: `${label} must be under 2048 characters.` })
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .superRefine((v, ctx) => {
      if (v === null) {
        if (required) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} is required.` });
        }
        return;
      }
      const isRelative = v.startsWith("/");
      const isData = v.startsWith("data:image/");
      if (isData) {
        if (!imageOnly) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} must be a URL, not a data URI.` });
        }
        return;
      }
      if (isRelative) {
        if (!allowRelative) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} must be a full URL starting with https://.` });
          return;
        }
        if (imageOnly && !IMAGE_EXT_RE.test(v)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} must point to an image file (.png, .jpg, .webp, .svg, .gif, .ico, .avif).` });
        }
        return;
      }
      let parsed: URL;
      try {
        parsed = new URL(v);
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} is not a valid URL. Include https:// at the start.` });
        return;
      }
      if (!/^https?:$/.test(parsed.protocol)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} must use http:// or https://.` });
        return;
      }
      if (requireHttps && parsed.protocol !== "https:") {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} must use https:// so social platforms accept it.` });
      }
      if (host && !host.test(parsed.hostname)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${label} must be a ${hostLabel ?? host.source} URL.`,
        });
      }
      if (imageOnly && !IMAGE_EXT_RE.test(parsed.pathname)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${label} must point to an image file (.png, .jpg, .webp, .svg, .gif, .ico, .avif).`,
        });
      }
    });
}

const optionalText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, { message: `${label} must be under ${max} characters.` })
    .transform((v) => (v === "" ? null : v))
    .nullable();

const requiredText = (label: string, min: number, max: number) =>
  z
    .string({ required_error: `${label} is required.` })
    .trim()
    .min(min, { message: `${label} is required.` })
    .max(max, { message: `${label} must be under ${max} characters.` });

export const siteSettingsSchema = z.object({
  site_name: requiredText("Website name", 1, 80),
  tagline: requiredText("Tagline", 1, 200),
  meta_title: requiredText("Meta title", 1, 70),
  meta_description: requiredText("Meta description", 1, 300),
  meta_keywords: optionalText("Meta keywords", 400),
  favicon_url: urlField({ label: "Favicon URL", imageOnly: true }),
  logo_url: urlField({ label: "Logo (light) URL", imageOnly: true }),
  logo_dark_url: urlField({ label: "Logo (dark) URL", imageOnly: true }),
  og_title: optionalText("OG title", 95),
  og_description: optionalText("OG description", 200),
  og_image_url: urlField({ label: "Open Graph image URL", imageOnly: true, requireHttps: true, allowRelative: false }),
  twitter_handle: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .refine((v) => v === null || /^@?[A-Za-z0-9_]{1,15}$/.test(v), {
      message: "Twitter handle must be 1-15 letters, numbers or underscores (e.g. @leersports).",
    }),
  theme_color: z
    .string({ required_error: "Theme color is required." })
    .trim()
    .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, {
      message: "Theme color must be a hex value like #0a0a0a.",
    }),
  support_email: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .refine((v) => v === null || z.string().email().safeParse(v).success, {
      message: "Support email must be a valid email address.",
    }),
  footer_text: optionalText("Footer text", 400),
  social_twitter: urlField({ label: "Twitter / X URL", allowRelative: false, host: /(^|\.)(twitter\.com|x\.com)$/i, hostLabel: "twitter.com or x.com" }),
  social_instagram: urlField({ label: "Instagram URL", allowRelative: false, host: /(^|\.)instagram\.com$/i, hostLabel: "instagram.com" }),
  social_youtube: urlField({ label: "YouTube URL", allowRelative: false, host: /(^|\.)(youtube\.com|youtu\.be)$/i, hostLabel: "youtube.com" }),
  social_tiktok: urlField({ label: "TikTok URL", allowRelative: false, host: /(^|\.)tiktok\.com$/i, hostLabel: "tiktok.com" }),
  social_facebook: urlField({ label: "Facebook URL", allowRelative: false, host: /(^|\.)(facebook\.com|fb\.com)$/i, hostLabel: "facebook.com" }),
  social_linkedin: urlField({ label: "LinkedIn URL", allowRelative: false, host: /(^|\.)linkedin\.com$/i, hostLabel: "linkedin.com" }),
  custom_head_html: optionalText("Custom head HTML", 4000).superRefine((v, ctx) => {
    if (!v) return;
    if (/<script[\s>]/i.test(v) && !/src\s*=/.test(v)) {
      // allow external analytics scripts, discourage inline <script> without src
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Inline <script> without a src is not allowed. Use an external analytics snippet with a src URL.",
      });
    }
  }),
});

export type SiteSettingsFieldErrors = Partial<Record<keyof z.infer<typeof siteSettingsSchema>, string>>;

export function collectFieldErrors(err: z.ZodError): SiteSettingsFieldErrors {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !out[key]) out[key] = issue.message;
  }
  return out as SiteSettingsFieldErrors;
}

export type SiteSettingsInput = z.infer<typeof siteSettingsSchema>;
export type UpdateSiteSettingsResult =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: SiteSettingsFieldErrors };

export const SITE_SETTINGS_DEFAULTS: SiteSettingsInput = {
  site_name: "LEER Sports",
  tagline: "Elite Fitness Creators & Private Coaching",
  meta_title: "LEER Sports — Elite Fitness Creators & Private Coaching",
  meta_description:
    "LEER Sports is the premium global platform for verified fitness creators.",
  meta_keywords: null,
  favicon_url: "/favicon.ico",
  logo_url: null,
  logo_dark_url: null,
  og_title: null,
  og_description: null,
  og_image_url: null,
  twitter_handle: "@leersports",
  theme_color: "#0a0a0a",
  support_email: null,
  footer_text: null,
  social_twitter: null,
  social_instagram: null,
  social_youtube: null,
  social_tiktok: null,
  social_facebook: null,
  social_linkedin: null,
  custom_head_html: null,
};

/**
 * Public read of site branding. Uses a server publishable client so that
 * unauthenticated visitors (and SSR without a bearer token) can still load
 * the branding for head tags. Falls back to defaults on any error so that
 * head rendering never blocks the shell.
 */
export const getPublicSiteSettings = createServerFn({ method: "GET" }).handler(
  async () => {
    try {
      const url = process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_PUBLISHABLE_KEY;
      if (!url || !key) return SITE_SETTINGS_DEFAULTS;
      const client = createClient<Database>(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
          fetch: (input, init) => {
            const h = new Headers(init?.headers);
            if (
              key.startsWith("sb_") &&
              h.get("Authorization") === `Bearer ${key}`
            ) {
              h.delete("Authorization");
            }
            h.set("apikey", key);
            return fetch(input, { ...init, headers: h });
          },
        },
      });
      const { data } = await client
        .from("site_settings")
        .select("*")
        .eq("id", true)
        .maybeSingle();
      if (!data) return SITE_SETTINGS_DEFAULTS;
      return { ...SITE_SETTINGS_DEFAULTS, ...data } as SiteSettingsInput;
    } catch {
      return SITE_SETTINGS_DEFAULTS;
    }
  },
);

export const getSiteSettingsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const isAdmin = await context.supabase
      .rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (isAdmin.error) throw new Error(isAdmin.error.message);
    if (!isAdmin.data) throw new Error("Forbidden");
    const { data, error } = await context.supabase
      .from("site_settings")
      .select("*")
      .eq("id", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { ...SITE_SETTINGS_DEFAULTS, ...(data ?? {}) } as SiteSettingsInput;
  });

export const updateSiteSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => input as unknown)
  .handler(async ({ data, context }): Promise<UpdateSiteSettingsResult> => {
    const isAdmin = await context.supabase
      .rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (isAdmin.error) throw new Error(isAdmin.error.message);
    if (!isAdmin.data) throw new Error("Forbidden");

    const parsed = siteSettingsSchema.safeParse(data);
    if (!parsed.success) {
      return {
        ok: false,
        message: "Please fix the highlighted fields.",
        fieldErrors: collectFieldErrors(parsed.error),
      };
    }

    // Best-effort remote image probe (og_image only): checks that the URL
    // resolves, is an image, and is under 5 MB. Non-blocking on network errors
    // so admins in restrictive environments can still save.
    const ogUrl = parsed.data.og_image_url;
    if (ogUrl && /^https?:\/\//i.test(ogUrl)) {
      const probe = await probeRemoteImage(ogUrl, 5 * 1024 * 1024);
      if (probe.status === "invalid") {
        return {
          ok: false,
          message: probe.message,
          fieldErrors: { og_image_url: probe.message },
        };
      }
    }

    // Normalize empty strings to null for optional columns.
    const patch: Record<string, unknown> = {
      id: true,
      updated_by: context.userId,
      updated_at: new Date().toISOString(),
    };
    for (const [k, v] of Object.entries(parsed.data)) {
      patch[k] = typeof v === "string" && v.trim() === "" ? null : v;
    }

    const { error } = await context.supabase
      .from("site_settings")
      .upsert(patch, { onConflict: "id" });
    if (error) {
      return { ok: false, message: `Couldn't save settings: ${error.message}` };
    }
    return { ok: true };
  });

async function probeRemoteImage(
  url: string,
  maxBytes: number,
): Promise<
  | { status: "ok" }
  | { status: "skipped" }
  | { status: "invalid"; message: string }
> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, { method: "HEAD", signal: controller.signal });
    clearTimeout(t);
    if (!res.ok) {
      return {
        status: "invalid",
        message: `Open Graph image URL responded with ${res.status}. Check the URL is public.`,
      };
    }
    const ct = res.headers.get("content-type") ?? "";
    if (ct && !ct.startsWith("image/")) {
      return {
        status: "invalid",
        message: `Open Graph image URL is not an image (content-type: ${ct}).`,
      };
    }
    const len = Number(res.headers.get("content-length") ?? "0");
    if (len && len > maxBytes) {
      return {
        status: "invalid",
        message: `Open Graph image is ${(len / 1024 / 1024).toFixed(1)} MB. Keep it under ${Math.round(maxBytes / 1024 / 1024)} MB for reliable previews.`,
      };
    }
    return { status: "ok" };
  } catch {
    // Network/CORS/HEAD-unsupported — skip gracefully.
    return { status: "skipped" };
  }
}

export const uploadSiteAssetServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({
        kind: z.enum(["favicon", "logo", "logo_dark", "og"]),
        filename: z.string(),
        contentType: z.string(),
        base64: z.string(),
      })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    const isAdmin = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (isAdmin.error) throw new Error(isAdmin.error.message);
    if (!isAdmin.data) throw new Error("Forbidden: admin access required");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const ext = (data.filename.split(".").pop() || "bin").toLowerCase();
    const path = `${data.kind}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const cleanBase64 = data.base64.replace(/^data:image\/[a-zA-Z+]+;base64,/, "");
    const buffer = Buffer.from(cleanBase64, "base64");

    const buckets = ["site-assets", "public", "avatars"];
    let uploadResultUrl: string | null = null;
    let lastError: Error | null = null;

    for (const b of buckets) {
      try {
        const { error: upErr } = await supabaseAdmin.storage
          .from(b)
          .upload(path, buffer, { contentType: data.contentType, upsert: true });

        if (!upErr) {
          const { data: pubData } = supabaseAdmin.storage.from(b).getPublicUrl(path);
          if (pubData?.publicUrl) {
            uploadResultUrl = pubData.publicUrl;
            break;
          }
        } else {
          lastError = new Error(upErr.message);
        }
      } catch (err) {
        lastError = err instanceof Error ? err : new Error("Storage upload error");
      }
    }

    if (!uploadResultUrl) {
      throw lastError || new Error("Failed to upload image asset to storage bucket.");
    }

    return { ok: true, url: uploadResultUrl };
  });