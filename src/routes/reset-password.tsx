import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordRuleHelper } from "@/components/auth/password-rule-helper";
import { friendlyAuthError, PASSWORD_MIN_LENGTH } from "@/lib/password-strength";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reset Password — leersports" },
      { name: "description", content: "Set a new password for your leersports account." },
      { property: "og:title", content: "Reset Password — leersports" },
      { property: "og:description", content: "Set a new password for your leersports account." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    setIsRecovery(hash.includes("type=recovery"));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(`Use at least ${PASSWORD_MIN_LENGTH} characters. Weak passwords are allowed after that.`);
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setSuccess(true);
    } catch (err) {
      setError(friendlyAuthError(err instanceof Error ? err.message : "Failed to reset password"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-card-foreground">Reset password</h1>

        {!isRecovery && !success && (
          <p className="mt-4 text-sm text-destructive">
            This page is only valid through a password reset email. Please request a new reset link.
          </p>
        )}

        {success ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-sport">
              Your password has been updated. You can now sign in.
            </p>
            <Button asChild className="w-full">
              <Link to="/auth">Go to sign-in</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={PASSWORD_MIN_LENGTH}
                disabled={!isRecovery}
                autoComplete="new-password"
              />
              <PasswordRuleHelper password={password} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                disabled={!isRecovery}
                autoComplete="new-password"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading || !isRecovery}>
              {loading ? "Updating..." : "Update password"}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
