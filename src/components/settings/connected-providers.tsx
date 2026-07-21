import { useEffect, useState } from "react";
import { Link, Unlink, Loader2, Mail, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

type Identity = {
  identity_id: string;
  id: string;
  user_id: string;
  provider: string;
  identity_data?: Record<string, unknown> | null;
  created_at?: string | null;
  last_sign_in_at?: string | null;
};

const PROVIDER_LABELS: Record<string, string> = {
  email: "Email & password",
  google: "Google",
  apple: "Apple",
};

function providerLabel(p: string) {
  return PROVIDER_LABELS[p] ?? p.charAt(0).toUpperCase() + p.slice(1);
}

function providerIdentityEmail(identity: Identity): string | null {
  const data = identity.identity_data ?? {};
  const email = (data as { email?: unknown }).email;
  return typeof email === "string" ? email : null;
}

export function ConnectedProviders() {
  const [identities, setIdentities] = useState<Identity[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.getUserIdentities();
      if (error) throw error;
      setIdentities((data?.identities ?? []) as Identity[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load connected providers");
      setIdentities([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const canUnlink = (identities?.length ?? 0) > 1;

  const handleUnlink = async (identity: Identity) => {
    if (!canUnlink) {
      toast.error("You need at least one sign-in method. Add another before unlinking this one.");
      return;
    }
    setBusy(identity.identity_id);
    try {
      const { error } = await supabase.auth.unlinkIdentity(identity as unknown as Parameters<typeof supabase.auth.unlinkIdentity>[0]);
      if (error) throw error;
      toast.success(`${providerLabel(identity.provider)} unlinked`);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not unlink this provider");
    } finally {
      setBusy(null);
    }
  };

  const handleLink = async (provider: "google" | "apple") => {
    setBusy(provider);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: `${window.location.origin}/settings`,
      });
      if (result.error) throw result.error;
      if (result.redirected) return;
      await refresh();
      toast.success(`${providerLabel(provider)} linked`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Could not link ${providerLabel(provider)}`);
    } finally {
      setBusy(null);
    }
  };

  const linkedProviders = new Set((identities ?? []).map((i) => i.provider));
  const availableToLink = (["google", "apple"] as const).filter((p) => !linkedProviders.has(p));

  return (
    <Card className="space-y-4 p-5">
      <div>
        <div className="flex items-center gap-2 font-medium">
          <ShieldCheck className="h-4 w-4" /> Connected sign-in methods
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Manage how you sign in. Email & password can't be unlinked while it's your only method.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : !identities || identities.length === 0 ? (
        <p className="text-sm text-muted-foreground">No sign-in methods found.</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {identities.map((identity) => {
            const email = providerIdentityEmail(identity);
            const isEmail = identity.provider === "email";
            const disable = !canUnlink || busy === identity.identity_id;
            return (
              <li
                key={identity.identity_id}
                className="flex items-center justify-between gap-3 p-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                    <Mail className="h-4 w-4" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{providerLabel(identity.provider)}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {email ?? (isEmail ? "Password login" : "Linked account")}
                      {identity.last_sign_in_at && (
                        <span className="ml-1">
                          · last used {new Date(identity.last_sign_in_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleUnlink(identity)}
                  disabled={disable}
                  title={
                    canUnlink
                      ? `Unlink ${providerLabel(identity.provider)}`
                      : "You must have at least one sign-in method"
                  }
                >
                  {busy === identity.identity_id ? (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Unlink className="mr-2 h-3.5 w-3.5" />
                  )}
                  Unlink
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {availableToLink.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium uppercase text-muted-foreground">Add a method</div>
          <div className="flex flex-wrap gap-2">
            {availableToLink.map((p) => (
              <Button
                key={p}
                variant="outline"
                size="sm"
                onClick={() => handleLink(p)}
                disabled={busy === p}
              >
                {busy === p ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Link className="mr-2 h-3.5 w-3.5" />
                )}
                Link {providerLabel(p)}
              </Button>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}