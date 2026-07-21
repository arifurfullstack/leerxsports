/**
 * Pure password strength + policy helpers. No dependencies.
 *
 * Client-side validation must match backend policy — Supabase Auth is
 * configured with HIBP breach checking, so leaked passwords are rejected
 * server-side even when they pass the client score.
 */

export interface PasswordCheck {
  score: 0 | 1 | 2 | 3 | 4; // 0 = terrible, 4 = strong
  label: "Too weak" | "Weak" | "Okay" | "Strong" | "Excellent";
  ok: boolean;
  issues: string[];
}

export const PASSWORD_MIN_LENGTH = 10;

const COMMON = new Set([
  "password",
  "12345678",
  "123456789",
  "qwerty",
  "letmein",
  "welcome",
  "iloveyou",
  "admin",
  "abc123",
  "password1",
]);

export function checkPassword(pw: string): PasswordCheck {
  const issues: string[] = [];
  const length = pw.length;
  const hasLower = /[a-z]/.test(pw);
  const hasUpper = /[A-Z]/.test(pw);
  const hasNumber = /[0-9]/.test(pw);
  const hasSymbol = /[^A-Za-z0-9]/.test(pw);
  const isCommon = COMMON.has(pw.toLowerCase());

  if (length < PASSWORD_MIN_LENGTH) {
    issues.push(`Use at least ${PASSWORD_MIN_LENGTH} characters`);
  }
  if (!(hasLower || hasUpper)) issues.push("Add at least one letter");
  if (!hasNumber) issues.push("Add at least one number");
  if (isCommon) issues.push("This password is too common");

  let raw = 0;
  if (length >= PASSWORD_MIN_LENGTH) raw += 1;
  if (length >= 14) raw += 1;
  const classes = [hasLower, hasUpper, hasNumber, hasSymbol].filter(Boolean).length;
  if (classes >= 2) raw += 1;
  if (classes >= 3) raw += 1;
  if (isCommon) raw = Math.min(raw, 1);
  if (length < PASSWORD_MIN_LENGTH) raw = Math.min(raw, 1);

  const score = Math.max(0, Math.min(4, raw)) as PasswordCheck["score"];
  const labels: PasswordCheck["label"][] = [
    "Too weak",
    "Weak",
    "Okay",
    "Strong",
    "Excellent",
  ];
  return {
    score,
    label: labels[score],
    ok: issues.length === 0,
    issues,
  };
}

/**
 * Map Supabase auth error messages to friendly, actionable copy.
 * Falls back to the raw message when unknown.
 */
export function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("pwned") || m.includes("compromised") || m.includes("leaked")) {
    return "This password has appeared in a public data breach. Please choose a different one.";
  }
  if (m.includes("weak") || m.includes("password should")) {
    return `Password is too weak. Use at least ${PASSWORD_MIN_LENGTH} characters with letters and numbers.`;
  }
  if (m.includes("invalid login") || m.includes("invalid credentials")) {
    return "Email or password is incorrect.";
  }
  if (m.includes("email not confirmed")) {
    return "Please confirm your email address before signing in — check your inbox.";
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (m.includes("user already registered") || m.includes("already been registered")) {
    return "An account with this email already exists. Try signing in instead.";
  }
  return message;
}