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

export const Route = createFileRoute("/_authenticated/admin/payments")({
  component: PaymentsPage,
  head: () => ({ meta: [{ title: "Admin · Payments" }] }),
});

function PaymentsPage() {
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
      toast.success("Settings saved");
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

  const num = (v: string) => (v === "" ? 0 : Number(v));

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <p className="font-display text-xs uppercase tracking-[0.3em] text-primary">Admin</p>
        <h1 className="font-display text-3xl uppercase tracking-tight">Payments</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure platform commission, payout limits, and dispute windows.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate({
            commission_bps: form.commission_bps,
            min_subscription_price: form.min_subscription_price,
            max_subscription_price: form.max_subscription_price,
            min_payout_amount: form.min_payout_amount,
            dispute_window_hours: form.dispute_window_hours,
            trainer_sla_hours: form.trainer_sla_hours,
          });
        }}
        className="space-y-4 rounded-lg border border-border bg-card p-6"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Commission (bps)</Label>
            <Input
              type="number"
              value={form.commission_bps}
              onChange={(e) => setForm({ ...form, commission_bps: num(e.target.value) })}
            />
            <p className="text-xs text-muted-foreground">
              {(form.commission_bps / 100).toFixed(2)}%
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Base currency</Label>
            <Input value={form.base_currency} disabled />
          </div>
          <div className="space-y-1.5">
            <Label>Min subscription price</Label>
            <Input
              type="number"
              step="0.01"
              value={form.min_subscription_price}
              onChange={(e) => setForm({ ...form, min_subscription_price: num(e.target.value) })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Max subscription price</Label>
            <Input
              type="number"
              step="0.01"
              value={form.max_subscription_price}
              onChange={(e) => setForm({ ...form, max_subscription_price: num(e.target.value) })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Min payout amount</Label>
            <Input
              type="number"
              step="0.01"
              value={form.min_payout_amount}
              onChange={(e) => setForm({ ...form, min_payout_amount: num(e.target.value) })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Dispute window (hours)</Label>
            <Input
              type="number"
              value={form.dispute_window_hours}
              onChange={(e) => setForm({ ...form, dispute_window_hours: num(e.target.value) })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Trainer SLA (hours)</Label>
            <Input
              type="number"
              value={form.trainer_sla_hours}
              onChange={(e) => setForm({ ...form, trainer_sla_hours: num(e.target.value) })}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save changes
          </Button>
        </div>
      </form>
    </div>
  );
}