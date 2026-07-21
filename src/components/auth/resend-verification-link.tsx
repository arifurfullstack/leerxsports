import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { friendlyAuthError } from "@/lib/password-strength";

export function ResendVerificationLink({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const resend = async () => {
    if (!email) {
      setState("error");
      setError("Enter your email above first.");
      return;
    }
    setState("sending");
    setError(null);
    try {
      const { error: err } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo:
            typeof window !== "undefined"
              ? `${window.location.origin}/verify-email?email=${encodeURIComponent(email)}&source=signup`
              : undefined,
        },
      });
      if (err) throw err;
      setState("sent");
    } catch (err) {
      setState("error");
      setError(friendlyAuthError(err instanceof Error ? err.message : "Could not resend the email."));
    }
  };

  if (state === "sent") {
    return (
      <p className="text-center text-xs text-sport">
        Verification email sent to {email}.{" "}
        <Link
          to="/verify-email"
          search={{ email, source: "signup" }}
          className="font-medium underline"
        >
          See next steps
        </Link>
      </p>
    );
  }

  return (
    <div className="text-center text-xs text-muted-foreground">
      Didn't get the email?{" "}
      <button
        type="button"
        onClick={resend}
        disabled={state === "sending"}
        className="font-medium text-sport hover:underline disabled:opacity-60"
      >
        {state === "sending" ? "Sending…" : "Resend verification"}
      </button>
      {state === "error" && error && (
        <span className="mt-1 block text-destructive">{error}</span>
      )}
    </div>
  );
}