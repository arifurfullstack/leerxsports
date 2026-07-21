import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, MailCheck, MailWarning, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { friendlyAuthError } from "@/lib/password-strength";

type Status = "checking" | "pending" | "verified" | "no-session";

export const Route = createFileRoute("/verify-email")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    email: typeof search.email === "string" ? search.email : "",
    source:
      search.source === "signup" || search.source === "reset"
        ? (search.source as "signup" | "reset")
        : "signup",
  }),
  head: () => ({
    meta: [
      { title: "Verify your email — leersports" },
      {
        name: "description",
        content:
          "Confirm your email address to activate your leersports account and start booking classes.",
      },
      { property: "og:title", content: "Verify your email — leersports" },
      {
        property: "og:description",
        content:
          "Confirm your email address to activate your leersports account and start booking classes.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const { email: initialEmail, source } = Route.useSearch();
  const router = useRouter();
  const [status, setStatus] = useState<Status>("checking");
  const [email, setEmail] = useState(initialEmail);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setStatus("checking");
    setError(null);
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (user?.email_confirmed_at) {
      setStatus("verified");
      return;
    }
    if (user?.email) {
      if (!email) setEmail(user.email);
      setStatus("pending");
      return;
    }
    setStatus(email ? "pending" : "no-session");
  };

  useEffect(() => {
    void refresh();
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "USER_UPDATED" || event === "SIGNED_IN") {
        if (session?.user?.email_confirmed_at) setStatus("verified");
      }
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setResendState("sending");
    setError(null);
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo:
            typeof window !== "undefined"
              ? `${window.location.origin}/verify-email?email=${encodeURIComponent(email)}&source=signup`
              : undefined,
        },
      });
      if (resendError) throw resendError;
      setResendState("sent");
    } catch (err) {
      setResendState("idle");
      setError(friendlyAuthError(err instanceof Error ? err.message : "Could not resend the email."));
    }
  };

  const heading =
    source === "reset" ? "Check your email to reset your password" : "Verify your email";
  const intro =
    source === "reset"
      ? "We just sent a password reset link. Open it from the same device to set a new password."
      : "We just sent a verification link to activate your account. Click it to finish signing up.";

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-sm">
        {status === "verified" ? (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-sport/10 text-sport">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold text-card-foreground">Email verified</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Your address {email && <span className="font-medium text-foreground">{email}</span>} is
              confirmed. You're all set.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <Button asChild className="w-full">
                <Link to="/">Go to homepage</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link to="/auth">Sign in</Link>
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-sport/10 text-sport">
                {status === "no-session" ? (
                  <MailWarning className="h-6 w-6" />
                ) : (
                  <MailCheck className="h-6 w-6" />
                )}
              </div>
              <h1 className="text-2xl font-bold text-card-foreground">{heading}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{intro}</p>
              {email && (
                <p className="mt-3 text-sm">
                  Sent to <span className="font-medium text-foreground">{email}</span>
                </p>
              )}
            </div>

            <ol className="mt-6 space-y-2 rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              <li>1. Open the email from leersports.</li>
              <li>2. Click the confirmation link — it opens back here.</li>
              <li>3. Once verified, you can sign in and start booking.</li>
            </ol>

            <p className="mt-4 text-xs text-muted-foreground">
              Can't find it? Check your spam folder, or resend the link below.
            </p>

            {source !== "reset" && (
              <form onSubmit={handleResend} className="mt-4 space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="resend-email">Email</Label>
                  <Input
                    id="resend-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                {resendState === "sent" && (
                  <p className="text-sm text-sport">Verification email sent — check your inbox.</p>
                )}
                <Button
                  type="submit"
                  variant="outline"
                  className="w-full"
                  disabled={resendState === "sending" || !email}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {resendState === "sending" ? "Sending..." : "Resend verification email"}
                </Button>
              </form>
            )}

            <div className="mt-4 flex flex-col gap-2">
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  void refresh();
                  router.invalidate();
                }}
              >
                I've clicked the link — check status
              </Button>
              <Button asChild variant="link" className="w-full">
                <Link to="/auth">Back to sign-in</Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}