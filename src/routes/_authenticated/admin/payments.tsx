import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, Save, X } from "lucide-react";
import {
  getPlatformSettings,
  updatePlatformSettings,
  type PlatformSettings,
} from "@/lib/payments-functions";
import {
  listPendingBankOrders,
  resolveBankPaymentOrder,
} from "@/lib/admin-payment-order-functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/admin/payments")({
  component: PaymentsPage,
  head: () => ({ meta: [{ title: "Admin · Payments" }] }),
});

function PaymentsPage() {
  const queryClient = useQueryClient();
  const getSettings = useServerFn(getPlatformSettings);
  const updateSettings = useServerFn(updatePlatformSettings);
  const getBankOrders = useServerFn(listPendingBankOrders);
  const resolveBankOrder = useServerFn(resolveBankPaymentOrder);
  const settings = useQuery<PlatformSettings>({
    queryKey: ["admin", "platform-settings"],
    queryFn: () => getSettings(),
  });
  const bankOrders = useQuery({
    queryKey: ["admin", "bank-payment-orders"],
    queryFn: () => getBankOrders(),
  });

  const [form, setForm] = useState<PlatformSettings | null>(null);
  useEffect(() => {
    if (settings.data) setForm(settings.data);
  }, [settings.data]);

  const save = useMutation({
    mutationFn: (input: Partial<PlatformSettings>) => updateSettings({ data: input }),
    onSuccess: () => {
      toast.success("Settings saved.");
      queryClient.invalidateQueries({ queryKey: ["admin", "platform-settings"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const resolve = useMutation({
    mutationFn: (input: { orderId: string; decision: "confirm" | "reject" }) =>
      resolveBankOrder({ data: input }),
    onSuccess: (result) => {
      toast.success(
        result.status === "paid"
          ? "Bank payment confirmed and order settled."
          : "Bank payment rejected.",
      );
      queryClient.invalidateQueries({ queryKey: ["admin", "bank-payment-orders"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (settings.isLoading || !form) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  const numberValue = (value: string) => (value === "" ? 0 : Number(value));

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <header>
        <p className="font-display text-xs uppercase tracking-[0.3em] text-primary">Admin</p>
        <h1 className="font-display text-3xl uppercase tracking-tight">Payments</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure the 80/20 split, payout limits, dispute windows, and manual bank-transfer
          settlement.
        </p>
      </header>

      <form
        onSubmit={(event) => {
          event.preventDefault();
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Commission (basis points)">
            <Input
              type="number"
              min={0}
              max={5000}
              value={form.commission_bps}
              onChange={(event) =>
                setForm({
                  ...form,
                  commission_bps: numberValue(event.target.value),
                })
              }
            />
            <p className="text-xs text-muted-foreground">
              {(form.commission_bps / 100).toFixed(2)}% platform /{" "}
              {(100 - form.commission_bps / 100).toFixed(2)}% trainer
            </p>
          </Field>
          <Field label="Base currency">
            <Input value={form.base_currency} disabled />
          </Field>
          <Field label="Minimum subscription">
            <Input
              type="number"
              step="0.01"
              value={form.min_subscription_price}
              onChange={(event) =>
                setForm({
                  ...form,
                  min_subscription_price: numberValue(event.target.value),
                })
              }
            />
          </Field>
          <Field label="Maximum subscription">
            <Input
              type="number"
              step="0.01"
              value={form.max_subscription_price}
              onChange={(event) =>
                setForm({
                  ...form,
                  max_subscription_price: numberValue(event.target.value),
                })
              }
            />
          </Field>
          <Field label="Minimum payout">
            <Input
              type="number"
              step="0.01"
              value={form.min_payout_amount}
              onChange={(event) =>
                setForm({
                  ...form,
                  min_payout_amount: numberValue(event.target.value),
                })
              }
            />
          </Field>
          <Field label="Dispute window (hours)">
            <Input
              type="number"
              value={form.dispute_window_hours}
              onChange={(event) =>
                setForm({
                  ...form,
                  dispute_window_hours: numberValue(event.target.value),
                })
              }
            />
          </Field>
          <Field label="Trainer SLA (hours)">
            <Input
              type="number"
              value={form.trainer_sla_hours}
              onChange={(event) =>
                setForm({
                  ...form,
                  trainer_sla_hours: numberValue(event.target.value),
                })
              }
            />
          </Field>
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

      <section className="rounded-lg border bg-card">
        <div className="border-b p-5">
          <h2 className="font-display text-xl uppercase">Pending bank transfers</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Confirm only after matching the reference and funds in the configured bank account.
          </p>
        </div>
        {bankOrders.isLoading ? (
          <div className="grid place-items-center p-10">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (bankOrders.data?.length ?? 0) === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            No pending bank transfers.
          </p>
        ) : (
          <div className="divide-y">
            {bankOrders.data?.map((order) => (
              <div key={order.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div>
                  <p className="text-sm font-semibold">
                    {order.payer_name ?? order.payer_id} · {order.kind}
                  </p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {order.provider_reference}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(order.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="mr-2 font-display text-xl">
                    {order.amount.toFixed(2)} {order.currency}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={resolve.isPending}
                    onClick={() => resolve.mutate({ orderId: order.id, decision: "reject" })}
                  >
                    <X className="mr-1 h-4 w-4" />
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    disabled={resolve.isPending}
                    onClick={() => resolve.mutate({ orderId: order.id, decision: "confirm" })}
                  >
                    <Check className="mr-1 h-4 w-4" />
                    Confirm
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
