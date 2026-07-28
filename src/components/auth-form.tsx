import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { resolvePostAuthTarget } from "@/lib/auth-intent";
import { classifyAuthError, friendlyAuthError, PASSWORD_MIN_LENGTH } from "@/lib/password-strength";
import { SocialButtons } from "@/components/auth/social-buttons";
import { PasswordRuleHelper } from "@/components/auth/password-rule-helper";
import { ForgotPasswordDialog } from "@/components/auth/forgot-password-dialog";
import { logAuthEvent, type AuthLogEvent } from "@/lib/auth-log.functions";

function fireAuthLog(
  event: AuthLogEvent,
  payload: { email?: string; userId?: string | null; errorMessage?: string | null; errorCode?: string | null },
) {
  // Fire-and-forget; never block UI or surface logging errors.
  void logAuthEvent({ data: { event, ...payload } }).catch(() => {});
}

export function AuthForm({
  intent = "",
  redirect = "",
  mode,
  onModeChange,
  variant = "card",
}: {
  intent?: string;
  redirect?: string;
  mode?: "signin" | "signup";
  onModeChange?: (m: "signin" | "signup") => void;
  variant?: "card" | "embedded";
}) {
  const router = useRouter();
  const postAuthTarget = resolvePostAuthTarget({ intent, redirect });
  const hasExplicitTarget = Boolean(intent) || Boolean(redirect);

  const resolveTargetWithRole = async (userId: string | undefined | null): Promise<string> => {
    if (hasExplicitTarget || !userId) return postAuthTarget;
    try {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      if (data) return "/admin";
    } catch {
      // ignore — fall back to default target
    }
    return postAuthTarget;
  };
  const controlled = mode !== undefined;
  const [internalMode, setInternalMode] = useState<"signin" | "signup">("signin");
  const currentMode = controlled ? mode! : internalMode;
  const isLogin = currentMode === "signin";
  const setMode = (m: "signin" | "signup") => {
    if (!controlled) setInternalMode(m);
    onModeChange?.(m);
  };
  useEffect(() => {
    // Clear confirm field when mode flips (controlled or not).
    setConfirmPassword("");
    setError(null);
    setMessage(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMode]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  const confirmMismatch =
    !isLogin && confirmPassword.length > 0 && confirmPassword !== password;

  const showAuthErrorToast = (rawMessage: string, mode: "signin" | "signup") => {
    const info = classifyAuthError(rawMessage);
    const action =
      info.category === "already_registered" && !isLogin
        ? { label: "Sign in", onClick: () => { setMode("signin"); setError(null); } }
        : info.category === "invalid_credentials" && isLogin
        ? { label: "Reset password", onClick: () => setForgotOpen(true) }
        : info.category === "email_unconfirmed"
        ? { label: "Resend", onClick: () => {
            void supabase.auth.resend({ type: "signup", email }).then(() =>
              toast.success("Verification email sent", { description: `Sent to ${email}` }),
            );
          } }
        : undefined;
    toast.error(info.title, {
      description: `${info.description} ${info.retry}`,
      action,
    });
    setError(`${info.title} — ${info.retry}`);
    void mode;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isLogin) {
        fireAuthLog("signin_attempt", { email });
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        const { data: u } = await supabase.auth.getUser();
        fireAuthLog("signin_success", { email, userId: u.user?.id ?? null });
        const target = await resolveTargetWithRole(u.user?.id);
        router.invalidate();
        router.navigate({ to: target });
      } else {
        if (password.length < PASSWORD_MIN_LENGTH) {
          showAuthErrorToast(`Password should be at least ${PASSWORD_MIN_LENGTH} characters`, "signup");
          setLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          toast.error("Passwords don't match", {
            description: "Re-enter the same password in both fields.",
          });
          setError("Passwords don't match — re-enter the same password in both fields.");
          setLoading(false);
          return;
        }
        fireAuthLog("signup_attempt", { email });
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
          },
        });
        if (signUpError) throw signUpError;
        const { data: u1 } = await supabase.auth.getUser();
        fireAuthLog("signup_success", { email, userId: u1.user?.id ?? null });
        toast.success("Account created", { description: "You're signed in." });
        // Auto sign-in in case the session wasn't returned with signUp
        const { data: sess } = await supabase.auth.getSession();
        if (!sess.session) {
          const { error: autoErr } = await supabase.auth.signInWithPassword({ email, password });
          if (autoErr) {
            fireAuthLog("signup_autologin_failure", {
              email,
              errorMessage: autoErr.message,
              errorCode: (autoErr as { code?: string }).code ?? null,
            });
          } else {
            const { data: u2 } = await supabase.auth.getUser();
            fireAuthLog("signup_autologin_success", { email, userId: u2.user?.id ?? null });
          }
        }
        router.invalidate();
        const target2 = await resolveTargetWithRole((await supabase.auth.getUser()).data.user?.id);
        router.navigate({ to: target2 });
      }
    } catch (err) {
      setLoading(false);
      const raw = err instanceof Error ? err.message : "An error occurred";
      const code = (err as { code?: string } | null)?.code ?? null;
      fireAuthLog(isLogin ? "signin_failure" : "signup_failure", {
        email,
        errorMessage: raw,
        errorCode: code,
      });
      showAuthErrorToast(raw, isLogin ? "signin" : "signup");
      // Keep friendlyAuthError as a fallback reference for legacy callers.
      void friendlyAuthError;
    }
  };

  const embedded = variant === "embedded";
  const labelClass = embedded
    ? "text-[10px] font-bold uppercase tracking-[0.2em] text-white/50"
    : undefined;
  const inputClass = embedded
    ? "h-12 rounded-none border border-white/10 bg-white/[0.04] text-sm text-white placeholder:text-white/25 focus-visible:border-sport focus-visible:ring-1 focus-visible:ring-sport/50"
    : undefined;

  const loadingOverlay = loading ? (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center rounded-2xl bg-black/85 backdrop-blur-md p-6 text-center animate-in fade-in duration-200">
      <div className="relative mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-sport/20 text-sport ring-2 ring-sport/40">
        <Loader2 className="h-8 w-8 animate-spin text-sport" />
      </div>
      <p className="text-sm font-bold uppercase tracking-[0.24em] text-white">
        {isLogin ? "Signing in..." : "Creating account..."}
      </p>
      <p className="mt-1.5 text-xs text-white/60">
        Authenticating workspace &amp; verifying permissions...
      </p>
    </div>
  ) : null;

  const formInner = (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        {!isLogin && (
          <div className="space-y-1.5">
            <Label htmlFor="fullName" className={labelClass}>Full name</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required={!isLogin}
              autoComplete="name"
              className={inputClass}
            />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="email" className={labelClass}>Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder={embedded ? "name@domain.com" : undefined}
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className={labelClass}>Password</Label>
            {isLogin && (
              <button
                type="button"
                onClick={() => setForgotOpen(true)}
                className={
                  embedded
                    ? "text-[10px] font-bold uppercase tracking-[0.2em] text-white/50 transition-colors hover:text-sport"
                    : "text-xs font-medium text-sport hover:underline"
                }
              >
                Forgot password?
              </button>
            )}
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={isLogin ? 1 : PASSWORD_MIN_LENGTH}
              autoComplete={isLogin ? "current-password" : "new-password"}
              placeholder={embedded ? "••••••••" : undefined}
              className={inputClass ? `${inputClass} pr-10` : "pr-10"}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className={
                embedded
                  ? "absolute inset-y-0 right-0 flex items-center px-3 text-white/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sport"
                  : "absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-r-md"
              }
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {!isLogin && <PasswordRuleHelper password={password} />}
        </div>

        {!isLogin && (
          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword" className={labelClass}>Confirm password</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required={!isLogin}
                minLength={PASSWORD_MIN_LENGTH}
                autoComplete="new-password"
                placeholder={embedded ? "••••••••" : undefined}
                className={inputClass ? `${inputClass} pr-10` : "pr-10"}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
                aria-pressed={showConfirm}
                className={
                  embedded
                    ? "absolute inset-y-0 right-0 flex items-center px-3 text-white/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sport"
                    : "absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-r-md"
                }
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {confirmMismatch && (
              <p className="text-[11px] font-medium text-destructive">
                Passwords don't match.
              </p>
            )}
          </div>
        )}

        {error && (
          <p className="text-xs font-medium text-destructive">{error}</p>
        )}
        {message && (
          <p className="text-xs font-medium text-emerald-500">{message}</p>
        )}

        <Button
          type="submit"
          className={
            embedded
              ? "relative h-12 w-full overflow-hidden rounded-none bg-sport text-xs font-black uppercase tracking-[0.24em] text-white shadow-none transition-all hover:bg-sport/90 hover:shadow-[0_0_24px_hsl(var(--sport)/0.4)]"
              : "w-full"
          }
          disabled={loading || confirmMismatch}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isLogin ? "Signing in…" : "Signing up…"}
            </>
          ) : isLogin ? (
            "Sign In"
          ) : (
            "Sign Up"
          )}
        </Button>
      </form>

      <ForgotPasswordDialog
        open={forgotOpen}
        onOpenChange={setForgotOpen}
        defaultEmail={email}
      />
    </>
  );

  if (embedded) {
    return (
      <div className="relative w-full">
        {loadingOverlay}
        <div className="space-y-3">
          <SocialButtons
            disabled={loading}
            onError={(m) => setError(m || null)}
            onSignedIn={async () => {
              setLoading(true);
              const { data } = await supabase.auth.getUser();
              const target = await resolveTargetWithRole(data.user?.id);
              router.navigate({ to: target });
            }}
          />
        </div>
        <div className="my-6 flex items-center gap-4">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-[10px] uppercase tracking-[0.3em] text-white/30">or</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>
        {formInner}
      </div>
    );
  }

  return (
    <div className="relative mx-auto w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-sm">
      {loadingOverlay}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-card-foreground">
          {isLogin ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isLogin ? "Sign in to book classes and manage your schedule." : "Join leersports and start training today."}
        </p>
      </div>

      <div className="mt-6">
        <SocialButtons
          disabled={loading}
          onError={(m) => setError(m || null)}
          onSignedIn={async () => {
            setLoading(true);
            const { data } = await supabase.auth.getUser();
            const target = await resolveTargetWithRole(data.user?.id);
            router.navigate({ to: target });
          }}
        />
      </div>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">Or with email</span>
        </div>
      </div>

      {formInner}
    </div>
  );
}
