/**
 * Pure password strength + policy helpers. No dependencies.
 *
 * Weak passwords are allowed by product choice. This helper only enforces
 * the backend's 6-character minimum and uses the rest as guidance.
 */

export interface PasswordCheck {
  score: 0 | 1 | 2 | 3 | 4; // 0 = terrible, 4 = strong
  label: "Too weak" | "Weak" | "Okay" | "Strong" | "Excellent";
  ok: boolean;
  issues: string[];
}

export const PASSWORD_MIN_LENGTH = 6;

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
  if (m.includes("weak") || m.includes("password should") || m.includes("at least 6")) {
    return `Use at least ${PASSWORD_MIN_LENGTH} characters. Weak passwords are allowed after that.`;
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

export type AuthErrorCategory =
  | "password_breached"
  | "password_too_short"
  | "password_weak_rejected"
  | "invalid_credentials"
  | "email_unconfirmed"
  | "rate_limited"
  | "already_registered"
  | "invalid_email"
  | "network"
  | "clipboard"
  | "unknown";

export interface AuthErrorInfo {
  category: AuthErrorCategory;
  title: string;
  description: string;
  retry: string;
}

export function classifyAuthError(message: string): AuthErrorInfo {
  const m = (message || "").toLowerCase();

  if (m.includes("pwned") || m.includes("compromised") || m.includes("leaked")) {
    return {
      category: "password_breached",
      title: "Password found in a breach",
      description: "This password has appeared in a public data breach.",
      retry: "Choose a different password and try again.",
    };
  }
  if (m.includes("at least 6") || m.includes("password should") || m.includes("too short")) {
    return {
      category: "password_too_short",
      title: "Password too short",
      description: `Passwords must be at least ${PASSWORD_MIN_LENGTH} characters.`,
      retry: `Add ${PASSWORD_MIN_LENGTH}+ characters and submit again.`,
    };
  }
  if (m.includes("weak")) {
    return {
      category: "password_weak_rejected",
      title: "Password rejected",
      description: "The server rejected this password as too weak.",
      retry: "Try a longer password or mix in a number or symbol.",
    };
  }
  if (m.includes("invalid login") || m.includes("invalid credentials")) {
    return {
      category: "invalid_credentials",
      title: "Email or password is incorrect",
      description: "We couldn't sign you in with those details.",
      retry: "Double-check your email and password, or reset your password.",
    };
  }
  if (m.includes("email not confirmed")) {
    return {
      category: "email_unconfirmed",
      title: "Confirm your email first",
      description: "Your account exists but hasn't been verified yet.",
      retry: "Open the verification email we sent, or resend it below.",
    };
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return {
      category: "rate_limited",
      title: "Too many attempts",
      description: "You've tried this a lot in a short window.",
      retry: "Wait about a minute, then try again.",
    };
  }
  if (m.includes("user already registered") || m.includes("already been registered") || m.includes("already exists")) {
    return {
      category: "already_registered",
      title: "Account already exists",
      description: "An account with this email is already registered.",
      retry: "Switch to Sign in, or reset the password if you've forgotten it.",
    };
  }
  if (m.includes("invalid") && m.includes("email")) {
    return {
      category: "invalid_email",
      title: "Email looks invalid",
      description: "The email address wasn't accepted.",
      retry: "Check for typos (missing @ or domain) and try again.",
    };
  }
  if (m.includes("fetch") || m.includes("network") || m.includes("failed to")) {
    return {
      category: "network",
      title: "Network error",
      description: "We couldn't reach the server.",
      retry: "Check your connection and try again.",
    };
  }
  if (m.includes("clipboard")) {
    return {
      category: "clipboard",
      title: "Clipboard blocked",
      description: "Your browser blocked clipboard access.",
      retry: "Copy the text manually, or allow clipboard permissions and retry.",
    };
  }
  return {
    category: "unknown",
    title: "Something went wrong",
    description: message || "An unexpected error occurred.",
    retry: "Please try again in a moment.",
  };
}