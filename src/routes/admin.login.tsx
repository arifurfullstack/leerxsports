import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import { Shield, ShieldAlert, ShieldCheck, Lock, Mail, Eye, EyeOff, Loader2, ArrowLeft, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const adminLoginSearchSchema = z.object({
  redirect: z.string().optional(),
  error: z.string().optional(),
});

export const Route = createFileRoute("/admin/login")({
  ssr: false,
  validateSearch: zodValidator(adminLoginSearchSchema),
  head: () => ({
    meta: [
      { title: "Admin Portal Sign In — LEER Sports" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "description", content: "Restricted administrative portal for LEER Sports system operators." },
    ],
  }),
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const { redirect: redirectTarget = "/admin", error: initialError } = Route.useSearch();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    initialError === "unauthorized" ? "Access Denied: Administrative privileges required." : null
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage("Please enter both administrator email and password.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const { verifyAdminLogin } = await import("@/lib/auth-functions");
      const res = await verifyAdminLogin({
        data: {
          email: email.trim(),
          password,
        },
      });

      if (res?.session) {
        await supabase.auth.setSession({
          access_token: res.session.access_token,
          refresh_token: res.session.refresh_token,
        });
      }

      setSuccessMessage("Security clearance verified. Redirecting to Command Center...");

      setTimeout(() => {
        const dest = redirectTarget && redirectTarget.startsWith("/admin") ? redirectTarget : "/admin";
        window.location.href = dest;
      }, 300);
    } catch (err: any) {
      setErrorMessage(err?.message || "An unexpected authentication error occurred.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#0a0a0c] px-4 py-12 text-foreground selection:bg-amber-500 selection:text-black">
      {/* Background ambient lighting */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-[450px] w-[600px] rounded-full bg-amber-500/10 blur-[150px]" />
        <div className="absolute -bottom-32 left-1/2 -translate-x-1/2 h-[400px] w-[500px] rounded-full bg-red-600/10 blur-[150px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(20,20,25,0.7)_0%,rgba(5,5,8,1)_100%)]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Top brand header */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 shadow-[0_0_25px_-5px_rgba(245,158,11,0.3)]">
            <Shield className="h-7 w-7 text-amber-500" />
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-amber-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
            Restricted Security Gateway
          </span>
          <h1 className="mt-3 font-display text-3xl font-black uppercase tracking-tight text-white sm:text-4xl">
            LEER Command
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            System Administrators & Operations Command Portal
          </p>
        </div>

        {/* Card Box */}
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#121216]/90 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          {errorMessage && (
            <Alert variant="destructive" className="mb-5 border-destructive/40 bg-destructive/10 text-destructive">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle className="font-mono text-xs uppercase tracking-wider">Security Warning</AlertTitle>
              <AlertDescription className="text-xs">{errorMessage}</AlertDescription>
            </Alert>
          )}

          {successMessage && (
            <Alert className="mb-5 border-emerald-500/40 bg-emerald-500/10 text-emerald-400">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <AlertTitle className="font-mono text-xs uppercase tracking-wider">Authorized</AlertTitle>
              <AlertDescription className="text-xs">{successMessage}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="admin-email" className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                Admin Email
              </Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="admin-email"
                  type="email"
                  placeholder="admin@leersports.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  autoComplete="username"
                  className="border-white/10 bg-black/40 pl-9 font-sans text-sm text-white placeholder:text-muted-foreground/40 focus-visible:border-amber-500 focus-visible:ring-amber-500/20"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="admin-password" className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                Master Security Key / Password
              </Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="admin-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="border-white/10 bg-black/40 pl-9 pr-10 font-sans text-sm text-white placeholder:text-muted-foreground/40 focus-visible:border-amber-500 focus-visible:ring-amber-500/20"
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
              disabled={loading}
              className="mt-2 w-full font-display text-sm font-bold uppercase tracking-wider text-black bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-[0_0_20px_-3px_rgba(245,158,11,0.4)]"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  <KeyRound className="mr-2 h-4 w-4" />
                  Verify & Enter Command Center
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 border-t border-white/5 pt-4 text-center">
            <Link
              to="/home"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-white"
            >
              <ArrowLeft className="h-3 w-3" />
              Return to Public Platform
            </Link>
          </div>
        </div>

        {/* Security watermark footer */}
        <p className="mt-6 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">
          All administrative sessions are logged & monitored.
        </p>
      </div>
    </main>
  );
}
