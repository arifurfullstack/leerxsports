import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";

export type AuthLogEvent =
  | "signup_attempt"
  | "signup_success"
  | "signup_failure"
  | "signin_attempt"
  | "signin_success"
  | "signin_failure"
  | "signup_autologin_success"
  | "signup_autologin_failure";

type Input = {
  event: AuthLogEvent;
  email?: string;
  userId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  provider?: string | null;
};

const ALLOWED: readonly AuthLogEvent[] = [
  "signup_attempt",
  "signup_success",
  "signup_failure",
  "signin_attempt",
  "signin_success",
  "signin_failure",
  "signup_autologin_success",
  "signup_autologin_failure",
];

// Mask emails so PII isn't stored raw. Keeps first char + domain.
function maskEmail(email?: string): string | null {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase().slice(0, 254);
  const at = trimmed.indexOf("@");
  if (at <= 0) return null;
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  const head = local.slice(0, 1);
  return `${head}${"*".repeat(Math.max(1, local.length - 1))}@${domain}`;
}

function truncate(v: string | null | undefined, max: number): string | null {
  if (!v) return null;
  const s = String(v);
  return s.length > max ? s.slice(0, max) : s;
}

export const logAuthEvent = createServerFn({ method: "POST" })
  .validator((data: Input) => {
    if (!data || typeof data !== "object") throw new Error("invalid payload");
    if (!ALLOWED.includes(data.event)) throw new Error("invalid event");
    return {
      event: data.event,
      email: typeof data.email === "string" ? data.email : undefined,
      userId: typeof data.userId === "string" ? data.userId : null,
      errorCode: truncate(data.errorCode ?? null, 120),
      errorMessage: truncate(data.errorMessage ?? null, 500),
      provider: truncate(data.provider ?? null, 40),
    };
  })
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import(
        "@/integrations/supabase/client.server"
      );
      const userAgent = truncate(getRequestHeader("user-agent") ?? null, 300);
      const ip = truncate(getRequestIP({ xForwardedFor: true }) ?? null, 64);
      const referer = truncate(getRequestHeader("referer") ?? null, 300);
      const metadata = {
        email_masked: maskEmail(data.email),
        error_code: data.errorCode,
        error_message: data.errorMessage,
        provider: data.provider,
        user_agent: userAgent,
        ip,
        referer,
        ts: new Date().toISOString(),
      };
      await supabaseAdmin.from("audit_logs").insert({
        actor_id: data.userId ?? null,
        action: `auth.${data.event}`,
        target_table: "auth.users",
        target_id: data.userId ?? null,
        metadata,
      });
      return { ok: true as const };
    } catch (err) {
      // Never let logging break auth flows.
      console.error("[auth-log] insert failed", err);
      return { ok: false as const };
    }
  });