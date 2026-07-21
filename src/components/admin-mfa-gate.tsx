import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, ShieldCheck, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type State =
  | { kind: "loading" }
  | { kind: "ok" }
  | { kind: "challenge"; factorId: string; challengeId: string; label: string };

/**
 * Blocks admin content until the session is AAL2 when the user has a
 * verified TOTP factor. Users without MFA are passed through unchanged.
 */
export function AdminMfaGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function bootstrap() {
    setState({ kind: "loading" });
    const aal = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal.error) {
      // No auth session or unexpected error — let the parent gate handle it.
      setState({ kind: "ok" });
      return;
    }
    const { currentLevel, nextLevel } = aal.data;
    if (currentLevel === "aal2" || nextLevel !== "aal2") {
      setState({ kind: "ok" });
      return;
    }
    // Step-up required: pick the first verified factor and start a challenge.
    const list = await supabase.auth.mfa.listFactors();
    const factor = list.data?.totp?.find((f) => f.status === "verified");
    if (!factor) {
      setState({ kind: "ok" });
      return;
    }
    const chal = await supabase.auth.mfa.challenge({ factorId: factor.id });
    if (chal.error) {
      toast.error(chal.error.message);
      setState({ kind: "ok" });
      return;
    }
    setState({
      kind: "challenge",
      factorId: factor.id,
      challengeId: chal.data.id,
      label: factor.friendly_name || "Authenticator",
    });
  }

  useEffect(() => {
    void bootstrap();
  }, []);

  async function submit() {
    if (state.kind !== "challenge") return;
    setSubmitting(true);
    const { error } = await supabase.auth.mfa.verify({
      factorId: state.factorId,
      challengeId: state.challengeId,
      code: code.trim(),
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      setCode("");
      return;
    }
    setCode("");
    await bootstrap();
  }

  if (state.kind === "loading") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (state.kind === "challenge") {
    return (
      <main className="flex min-h-[70vh] items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-center font-display text-xl uppercase tracking-tight">
            Two-factor required
          </h1>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Enter the 6-digit code from <strong>{state.label}</strong> to unlock the admin
            panel for this session.
          </p>
          <form
            className="mt-5 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <div>
              <Label className="text-xs">Authentication code</Label>
              <Input
                autoFocus
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="mt-1 text-center text-lg tracking-[0.4em]"
                placeholder="000000"
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting || code.length !== 6}>
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="mr-2 h-4 w-4" />
              )}
              Verify & continue
            </Button>
            <div className="flex justify-between text-xs">
              <Link to="/dashboard" className="text-muted-foreground hover:text-foreground">
                Cancel
              </Link>
              <Link
                to="/settings"
                className="text-muted-foreground hover:text-foreground"
              >
                Lost your device?
              </Link>
            </div>
          </form>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}