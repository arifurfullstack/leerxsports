import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import {
  getPlatformSettings,
  updatePlatformSettings,
  type PlatformSettings,
} from "@/lib/payments-functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/admin/payment-settings")({
  head: () => ({ meta: [{ title: "Admin · Payment settings" }] }),
  component: PaymentSettingsPage,
});

function PaymentSettingsPage() {
  const qc = useQueryClient();
  const getFn = useServerFn(getPlatformSettings);
  const updateFn = useServerFn(updatePlatformSettings);
  const { data, isLoading } = useQuery<PlatformSettings>({
    queryKey: ["admin", "platform-settings"],
    queryFn: () => getFn(),
  });
  const [form, setForm] = useState<PlatformSettings | null>(null);
  useEffect(() => {
    if (data) setForm(data);
  }, [data]);
  const save = useMutation({
    mutationFn: (input: Partial<PlatformSettings>) => updateFn({ data: input }),
    onSuccess: () => {
      toast.success("Payment settings saved");
      qc.invalidateQueries({ queryKey: ["admin", "platform-settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (isLoading || !form) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <header>
        <p className="font-display text-xs uppercase tracking-[0.3em] text-primary">Admin</p>
        <h1 className="font-display text-3xl uppercase tracking-tight">Payment settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Platform fee, minimum payout, and payout cadence.
        </p>
      </header>
      <form
        className="space-y-4 rounded-lg border border-border bg-card p-6"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(form);
        }}
      >
        <div>
          <Label htmlFor="fee">Commission (bps, 100 = 1%)</Label>
          <Input
            id="fee"
            type="number"
            value={form.commission_bps}
            onChange={(e) =>
              setForm({ ...form, commission_bps: Number(e.target.value) })
            }
          />
        </div>
        <div>
          <Label htmlFor="min">Minimum payout amount ({form.base_currency})</Label>
          <Input
            id="min"
            type="number"
            value={form.min_payout_amount}
            onChange={(e) =>
              setForm({ ...form, min_payout_amount: Number(e.target.value) })
            }
          />
        </div>
        <div>
          <Label htmlFor="dispute">Dispute window (hours)</Label>
          <Input
            id="dispute"
            type="number"
            value={form.dispute_window_hours}
            onChange={(e) =>
              setForm({ ...form, dispute_window_hours: Number(e.target.value) })
            }
          />
        </div>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save
        </Button>
      </form>
      <p className="text-xs text-muted-foreground">
        Advanced payment provider config is available on the Payments page.
      </p>
    </main>
  );
}