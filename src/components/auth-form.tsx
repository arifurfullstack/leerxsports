import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { resolvePostAuthTarget } from "@/lib/auth-intent";
import { checkPassword, friendlyAuthError, PASSWORD_MIN_LENGTH } from "@/lib/password-strength";
import { SocialButtons } from "@/components/auth/social-buttons";
import { PasswordStrengthMeter } from "@/components/auth/password-strength-meter";
import { ForgotPasswordDialog } from "@/components/auth/forgot-password-dialog";
import { ResendVerificationLink } from "@/components/auth/resend-verification-link";

export function AuthForm({
  intent = "",
  redirect = "",
}: {
  intent?: string;
  redirect?: string;
}) {
  const router = useRouter();
  const postAuthTarget = resolvePostAuthTarget({ intent, redirect });
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [forgotOpen, setForgotOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isLogin) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        router.invalidate();
        router.navigate({ to: postAuthTarget });
      } else {
        const strength = checkPassword(password);
        if (!strength.ok) {
          setError(strength.issues[0] ?? "Please choose a stronger password.");
          setLoading(false);
          return;
        }
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo:
              typeof window !== "undefined"
                ? `${window.location.origin}/verify-email?email=${encodeURIComponent(email)}&source=signup`
                : undefined,
          },
        });
        if (signUpError) throw signUpError;
        setMessage("Almost there — check your inbox and click the confirmation link to activate your account.");
        router.navigate({
          to: "/verify-email",
          search: { email, source: "signup" },
        });
      }
    } catch (err) {
      setError(friendlyAuthError(err instanceof Error ? err.message : "An error occurred"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-sm">
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
          onSignedIn={() => router.navigate({ to: postAuthTarget })}
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

      <form onSubmit={handleSubmit} className="space-y-4">
        {!isLogin && (
          <div className="space-y-2">
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required={!isLogin}
              autoComplete="name"
            />
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            {isLogin && (
              <button
                type="button"
                onClick={() => setForgotOpen(true)}
                className="text-xs font-medium text-sport hover:underline"
              >
                Forgot password?
              </button>
            )}
          </div>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={isLogin ? 1 : PASSWORD_MIN_LENGTH}
            autoComplete={isLogin ? "current-password" : "new-password"}
          />
          {!isLogin && <PasswordStrengthMeter password={password} />}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {message && <p className="text-sm text-sport">{message}</p>}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Please wait..." : isLogin ? "Sign in" : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
        <button
          type="button"
          onClick={() => {
            setIsLogin(!isLogin);
            setError(null);
            setMessage(null);
          }}
          className="font-medium text-sport hover:underline"
        >
          {isLogin ? "Sign up" : "Sign in"}
        </button>
      </p>

      <div className="mt-4 border-t border-border pt-4">
        <ResendVerificationLink email={email} />
      </div>

      <ForgotPasswordDialog
        open={forgotOpen}
        onOpenChange={setForgotOpen}
        defaultEmail={email}
      />
    </div>
  );
}
