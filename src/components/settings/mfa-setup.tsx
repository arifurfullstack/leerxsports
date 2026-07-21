import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldCheck, ShieldOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Factor = { id: string; friendly_name?: string | null; status: string; factor_type: string; created_at: string };

async function listFactors(): Promise<Factor[]> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  return (data?.totp ?? []) as Factor[];
}

export function MfaSetup() {
  const qc = useQueryClient();
  const factors = useQuery({ queryKey: ["mfa", "factors"], queryFn: listFactors });

  const [enrolling, setEnrolling] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [friendlyName, setFriendlyName] = useState("Admin authenticator");

  const startEnroll = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: friendlyName || `Authenticator ${Date.now()}`,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setEnrolling({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const verify = useMutation({
    mutationFn: async () => {
      if (!enrolling) throw new Error("No enrollment in progress");
      const chal = await supabase.auth.mfa.challenge({ factorId: enrolling.id });
      if (chal.error) throw chal.error;
      const { error } = await supabase.auth.mfa.verify({
        factorId: enrolling.id,
        challengeId: chal.data.id,
        code: code.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Two-factor authentication enabled");
      setEnrolling(null);
      setCode("");
      qc.invalidateQueries({ queryKey: ["mfa", "factors"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelEnroll = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
      if (error) throw error;
    },
    onSuccess: () => {
      setEnrolling(null);
      setCode("");
      qc.invalidateQueries({ queryKey: ["mfa", "factors"] });
    },
  });

  const unenroll = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Authenticator removed");
      qc.invalidateQueries({ queryKey: ["mfa", "factors"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const verified = (factors.data ?? []).filter((f) => f.status === "verified");
  const hasVerified = verified.length > 0;

  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-medium">
            {hasVerified ? (
              <ShieldCheck className="h-4 w-4 text-primary" />
            ) : (
              <ShieldOff className="h-4 w-4 text-muted-foreground" />
            )}
            Two-factor authentication (TOTP)
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Strongly recommended for admin accounts. Uses an authenticator app such as
            1Password, Authy, or Google Authenticator. When enabled, admin panel access
            requires a fresh 6-digit code.
          </p>
        </div>
      </div>

      {factors.isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : verified.length > 0 ? (
        <ul className="divide-y divide-border rounded-md border border-border">
          {verified.map((f) => (
            <li key={f.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <div>
                <div className="font-medium">{f.friendly_name || "Authenticator"}</div>
                <div className="text-xs text-muted-foreground">
                  Added {new Date(f.created_at).toLocaleDateString()}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (confirm("Remove this authenticator? Admin access will no longer require a code.")) {
                    unenroll.mutate(f.id);
                  }
                }}
                disabled={unenroll.isPending}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No authenticator enrolled.</p>
      )}

      {!enrolling ? (
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[180px]">
            <Label className="text-xs">Device label</Label>
            <Input
              value={friendlyName}
              onChange={(e) => setFriendlyName(e.target.value)}
              placeholder="e.g. iPhone Authy"
            />
          </div>
          <Button onClick={() => startEnroll.mutate()} disabled={startEnroll.isPending}>
            {startEnroll.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add authenticator
          </Button>
        </div>
      ) : (
        <div className="space-y-3 rounded-md border border-border bg-muted/30 p-4">
          <div className="text-sm font-medium">Scan this QR code</div>
          <div className="flex flex-wrap items-start gap-4">
            <div
              className="rounded bg-white p-2"
              // Supabase returns an inline SVG; safe to render.
              dangerouslySetInnerHTML={{ __html: enrolling.qr }}
            />
            <div className="text-xs text-muted-foreground">
              <div>Or enter this secret manually:</div>
              <code className="mt-1 block break-all rounded bg-background px-2 py-1 font-mono text-[11px]">
                {enrolling.secret}
              </code>
            </div>
          </div>
          <div>
            <Label className="text-xs">Enter the 6-digit code from your app</Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              className="mt-1 max-w-[160px] tracking-widest"
            />
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => verify.mutate()}
              disabled={verify.isPending || code.length !== 6}
            >
              {verify.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Verify & enable
            </Button>
            <Button
              variant="outline"
              onClick={() => cancelEnroll.mutate(enrolling.id)}
              disabled={cancelEnroll.isPending}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}