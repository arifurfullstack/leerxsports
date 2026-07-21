import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Chrome, Apple } from "lucide-react";
import { friendlyAuthError } from "@/lib/password-strength";

export function SocialButtons({
  onError,
  onSignedIn,
  disabled,
}: {
  onError: (msg: string) => void;
  onSignedIn: () => void;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"google" | "apple" | null>(null);

  const signIn = async (provider: "google" | "apple") => {
    setBusy(provider);
    onError("");
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        onError(friendlyAuthError(result.error instanceof Error ? result.error.message : String(result.error)));
        return;
      }
      if (result.redirected) return;
      router.invalidate();
      onSignedIn();
    } catch (err) {
      onError(friendlyAuthError(err instanceof Error ? err.message : `${provider} sign-in failed`));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid gap-2">
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => signIn("google")}
        disabled={disabled || busy !== null}
      >
        <Chrome className="mr-2 h-4 w-4" />
        {busy === "google" ? "Connecting…" : "Continue with Google"}
      </Button>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => signIn("apple")}
        disabled={disabled || busy !== null}
      >
        <Apple className="mr-2 h-4 w-4" />
        {busy === "apple" ? "Connecting…" : "Continue with Apple"}
      </Button>
    </div>
  );
}