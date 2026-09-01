import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import { ShieldCheck, Mail, Lock, Eye, EyeOff, Loader2, ArrowLeft, ArrowUpRight, Dumbbell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RedirectIfAuthed } from "@/components/redirect-if-authed";

const loginSearchSchema = z.object({
  redirect: z.string().optional().default(""),
  error: z.string().optional().default(""),
});

export const Route = createFileRoute("/login")({
  ssr: false,
  validateSearch: zodValidator(loginSearchSchema),
  head: () => ({
    meta: [
      { title: "Sign In — LEER Sports" },
      { name: "description", content: "Sign in to your LEER Sports account to access pro workouts, trainers, and community." },
      { property: "og:title", content: "Sign In — LEER Sports" },
      { property: "og:description", content: "Sign in to your LEER Sports account to access pro workouts, trainers, and community." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { redirect: redirectTarget, error: initialError } = Route.useSearch();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    initialError === "unauthorized" ? "Please sign in to continue." : null
  );

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage("Please enter both email and password.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error || !data.user) {
        throw new Error(error?.message || "Invalid email or password.");
      }

      // Check if user is admin - route them straight to /admin
      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id);
      const roles = (roleRows ?? []).map((r) => r.role);
      const isAdmin = roles.includes("admin") || roles.includes("moderator");

      if (isAdmin) {
        window.location.href = "/admin";
        return;
      }

      // Check onboarding status
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (!profile?.onboarding_completed) {
        window.location.href = "/onboarding";
        return;
      }

      const destination = redirectTarget && redirectTarget.startsWith("/") && !redirectTarget.startsWith("/login") && !redirectTarget.startsWith("/auth")
        ? redirectTarget
        : "/home";

      window.location.href = destination;
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to sign in. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  }

  async function handleOAuthLogin(provider: "google" | "apple") {
    try {
      setOauthLoading(provider);
      setErrorMessage(null);
      const redirectUrl = `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirectTarget || "/home")}`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: redirectUrl },
      });
      if (error) throw error;
    } catch (err: any) {
      setErrorMessage(err?.message || `Failed to sign in with ${provider}.`);
      setOauthLoading(null);
    }
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#070709] px-4 py-10 text-foreground selection:bg-sport selection:text-black">
      {!redirectTarget && <RedirectIfAuthed />}

      {/* Ambient background lighting */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-sport/15 blur-[160px]" />
        <div className="absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-sport/10 blur-[160px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(18,18,22,0.6)_0%,rgba(7,7,9,1)_100%)]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Top brand header */}
        <div className="mb-6 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-2 transition-transform hover:scale-105"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sport/30 bg-sport/10 text-sport shadow-[0_0_20px_-3px_hsl(var(--sport)/0.4)]">
              <Dumbbell className="h-5 w-5" />
            </div>
            <span className="font-display text-2xl font-black uppercase tracking-tight text-white">
              LEER<span className="text-sport">.</span>
            </span>
          </Link>
          <h1 className="mt-3 font-display text-2xl font-black uppercase tracking-tight text-white sm:text-3xl">
            Welcome Back
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Sign in to access your workout feed, coaches, and library.
          </p>
        </div>

        {/* Minimalist Card Box */}
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0f0f13]/90 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          {errorMessage && (
            <Alert variant="destructive" className="mb-5 border-destructive/40 bg-destructive/10 text-destructive text-xs">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          {/* Social OAuth buttons */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <button
              type="button"
              onClick={() => handleOAuthLogin("google")}
              disabled={!!oauthLoading || loading}
              className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-black/40 px-4 py-2.5 text-xs font-medium text-white transition-colors hover:border-white/25 hover:bg-white/5"
            >
              {oauthLoading === "google" ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.3 9 5 12 5z" />
                  <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z" />
                  <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.8s.2-2.1.4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z" />
                  <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.3-6.4-5.2L1.9 16c1.8 3.7 5.6 7 10.1 7z" />
                </svg>
              )}
              <span>Google</span>
            </button>

            <button
              type="button"
              onClick={() => handleOAuthLogin("apple")}
              disabled={!!oauthLoading || loading}
              className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-black/40 px-4 py-2.5 text-xs font-medium text-white transition-colors hover:border-white/25 hover:bg-white/5"
            >
              {oauthLoading === "apple" ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <svg className="h-4 w-4 fill-current text-white" viewBox="0 0 24 24">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.66-.8 1.1-1.92.98-3.04-.95.04-2.1.63-2.77 1.43-.59.69-1.11 1.83-.97 2.92 1.06.08 2.14-.54 2.76-1.31z" />
                </svg>
              )}
              <span>Apple</span>
            </button>
          </div>

          <div className="relative my-4 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <span className="relative bg-[#0f0f13] px-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              or continue with email
            </span>
          </div>

          {/* Form */}
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="login-email" className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                Email Address
              </Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="login-email"
                  type="email"
                  placeholder="athlete@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  autoComplete="username"
                  className="border-white/10 bg-black/40 pl-9 font-sans text-sm text-white placeholder:text-muted-foreground/40 focus-visible:border-sport focus-visible:ring-sport/20"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="login-password" className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  Password
                </Label>
                <Link
                  to="/reset-password"
                  className="text-[11px] text-muted-foreground hover:text-sport transition-colors"
                >
                  Forgot?
                </Link>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="border-white/10 bg-black/40 pl-9 pr-10 font-sans text-sm text-white placeholder:text-muted-foreground/40 focus-visible:border-sport focus-visible:ring-sport/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-white"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading || !!oauthLoading}
              className="mt-2 w-full font-display text-sm font-bold uppercase tracking-wider text-black bg-sport hover:bg-sport/90 shadow-[0_0_20px_-3px_hsl(var(--sport)/0.4)]"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing In...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          {/* Switch to Sign Up */}
          <div className="mt-6 border-t border-white/5 pt-4 text-center">
            <p className="text-xs text-muted-foreground">
              Don't have an account?{" "}
              <Link
                to="/signup"
                search={{ redirect: redirectTarget } as any}
                className="font-semibold text-sport hover:underline"
              >
                Create an account
              </Link>
            </p>
          </div>
        </div>

        {/* Footer links */}
        <div className="mt-6 flex items-center justify-between text-xs text-muted-foreground/60 px-2">
          <Link to="/" className="inline-flex items-center gap-1 hover:text-white transition-colors">
            <ArrowLeft className="h-3 w-3" /> Home
          </Link>
          <Link to="/admin/login" className="inline-flex items-center gap-1 hover:text-amber-400 transition-colors">
            Admin Portal <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </main>
  );
}
