/**
 * Pure helpers for the auth redirect-back handshake.
 *
 * - resolveAuthIntent(pathname): named intent for well-known destinations
 *   (currently "admin"). Empty string for everything else.
 * - sanitizeRedirect(raw): only accept same-origin, absolute app paths.
 *   Rejects protocol-relative (`//host`), external URLs, and empty input.
 * - resolvePostAuthTarget({ intent, redirect }): where the auth form should
 *   navigate after a successful sign-in. An explicit sanitized redirect wins;
 *   otherwise a known intent maps to its landing; otherwise `/home`.
 */
export function resolveAuthIntent(pathname: string): "admin" | "" {
  return pathname.startsWith("/admin") ? "admin" : "";
}

export function sanitizeRedirect(raw: unknown): string {
  if (typeof raw !== "string") return "";
  if (!raw.startsWith("/")) return "";
  if (raw.startsWith("//")) return "";
  // Reject obvious injection attempts.
  if (raw.includes("\\") || raw.includes(" ")) return "";
  return raw;
}

export interface PostAuthTargetInput {
  intent?: string;
  redirect?: string;
}

export function resolvePostAuthTarget(input: PostAuthTargetInput | string = {}): string {
  // Back-compat: string arg is treated as intent.
  const { intent = "", redirect = "" } =
    typeof input === "string" ? { intent: input, redirect: "" } : input;
  const safe = sanitizeRedirect(redirect);
  if (safe) return safe;
  if (intent === "admin") return "/admin";
  return "/home";
}