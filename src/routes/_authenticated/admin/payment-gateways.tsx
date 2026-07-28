import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Save,
  Landmark,
  CreditCard,
  Wallet,
  CheckCircle2,
  CircleDot,
  PlugZap,
  XCircle,
  History,
  User as UserIcon,
} from "lucide-react";
import {
  listPaymentGateways,
  updatePaymentGateway,
  testPaymentGateway,
  listPaymentGatewayAuditLogs,
  revealGatewaySecret,
  type TestConnectionResult,
  type GatewayAuditEntry,
  type PaymentGateway,
} from "@/lib/payment-gateways-functions";
import {
  getGatewayFields,
  resolvePlaceholder,
  validateGatewayField,
  validateGatewayConfigLive,
  type GatewayFieldDef,
} from "@/lib/gateway-config-schemas";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute(
  "/_authenticated/admin/payment-gateways",
)({
  head: () => ({ meta: [{ title: "Admin · Payment gateways" }] }),
  component: PaymentGatewaysPage,
});

const PROVIDER_META: Record<
  PaymentGateway["provider"],
  {
    icon: typeof Landmark;
    tagline: string;
    accent: string;
  }
> = {
  bank: {
    icon: Landmark,
    tagline: "Manual bank transfers with published account details.",
    accent: "from-sky-500/20 to-transparent",
  },
  stripe: {
    icon: CreditCard,
    tagline: "Cards, wallets and subscriptions via Stripe.",
    accent: "from-violet-500/20 to-transparent",
  },
  paypal: {
    icon: Wallet,
    tagline: "PayPal checkout & recurring billing.",
    accent: "from-amber-500/20 to-transparent",
  },
};

function PaymentGatewaysPage() {
  const listFn = useServerFn(listPaymentGateways);
  const { data, isLoading, error } = useQuery<PaymentGateway[]>({
    queryKey: ["admin", "payment-gateways"],
    queryFn: () => listFn(),
  });

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <header>
        <p className="font-display text-xs uppercase tracking-[0.3em] text-primary">
          Admin
        </p>
        <h1 className="font-display text-3xl uppercase tracking-tight">
          Payment gateways
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Enable, disable, and configure the payment providers available across
          Leer. Toggle a gateway off to instantly hide it from checkout.
        </p>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      ) : (
        <div className="grid gap-5">
          {(data ?? []).map((gw) => (
            <GatewayCard key={gw.provider} gateway={gw} />
          ))}
        </div>
      )}

      <AuditLogPanel />
    </main>
  );
}

function AuditLogPanel() {
  const listFn = useServerFn(listPaymentGatewayAuditLogs);
  const { data, isLoading, error, refetch, isFetching } = useQuery<GatewayAuditEntry[]>({
    queryKey: ["admin", "payment-gateways", "audit"],
    queryFn: () => listFn({ data: { provider: "all", limit: 50 } }),
  });

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-display text-lg uppercase tracking-tight">Audit log</h2>
          <span className="text-xs text-muted-foreground">Every change to a payment gateway</span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="h-3 w-3 animate-spin" /> : "Refresh"}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <p className="mt-4 text-sm text-destructive">{(error as Error).message}</p>
      ) : !data || data.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No changes recorded yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-border/60">
          {data.map((entry) => {
            const changes = (entry.metadata?.changes ?? {}) as Record<string, { from: unknown; to: unknown }>;
            return (
              <li key={entry.id} className="py-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <Badge variant="outline" className="uppercase">
                    {String(entry.target_id ?? "—")}
                  </Badge>
                  <span className="text-muted-foreground">
                    {entry.action.replace("payment_gateway.", "")}
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <UserIcon className="h-3 w-3" />
                    {entry.actor_name ?? entry.actor_id?.slice(0, 8) ?? "system"}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {new Date(entry.created_at).toLocaleString()}
                  </span>
                </div>
                {Object.keys(changes).length > 0 && (
                  <ul className="mt-2 grid gap-1 text-xs">
                    {Object.entries(changes).map(([field, diff]) => (
                      <li
                        key={field}
                        className="flex flex-wrap items-center gap-2 rounded border border-border/40 bg-muted/30 px-2 py-1 font-mono"
                      >
                        <span className="text-foreground">{field}</span>
                        <span className="text-muted-foreground">{formatVal(diff.from)}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="text-foreground">{formatVal(diff.to)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function formatVal(v: unknown): string {
  if (v === null || v === undefined) return "∅";
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v);
}

function GatewayCard({ gateway }: { gateway: PaymentGateway }) {
  const qc = useQueryClient();
  const updateFn = useServerFn(updatePaymentGateway);
  const testFn = useServerFn(testPaymentGateway);
  const revealFn = useServerFn(revealGatewaySecret);
  const meta = PROVIDER_META[gateway.provider];
  const Icon = meta.icon;

  const [enabled, setEnabled] = useState(gateway.enabled);
  const [mode, setMode] = useState<"test" | "live">(gateway.mode);
  const [config, setConfig] = useState<Record<string, string>>(
    gateway.config ?? {},
  );
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  // Field key -> decrypted plaintext currently revealed to the admin.
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [revealing, setRevealing] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setEnabled(gateway.enabled);
    setMode(gateway.mode);
    setConfig(gateway.config ?? {});
    setTouched({});
    setRevealed({});
  }, [gateway]);

  // Auto-hide any revealed secret after 20s.
  useEffect(() => {
    const keys = Object.keys(revealed);
    if (keys.length === 0) return;
    const t = window.setTimeout(() => setRevealed({}), 20_000);
    return () => window.clearTimeout(t);
  }, [revealed]);

  async function toggleReveal(key: string) {
    if (revealed[key] !== undefined) {
      setRevealed((r) => {
        const next = { ...r };
        delete next[key];
        return next;
      });
      return;
    }
    setRevealing((r) => ({ ...r, [key]: true }));
    try {
      const { value } = await revealFn({
        data: { provider: gateway.provider, field: key },
      });
      if (!value) toast.info("No saved value for this field.");
      setRevealed((r) => ({ ...r, [key]: value }));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRevealing((r) => {
        const next = { ...r };
        delete next[key];
        return next;
      });
    }
  }

  const fieldErrors = useMemo(
    () => validateGatewayConfigLive(gateway.provider, mode, config),
    [gateway.provider, mode, config],
  );
  const hasErrors = Object.keys(fieldErrors).length > 0;

  const dirty = useMemo(() => {
    if (enabled !== gateway.enabled) return true;
    if (mode !== gateway.mode) return true;
    const keys = new Set([
      ...Object.keys(config),
      ...Object.keys(gateway.config ?? {}),
    ]);
    for (const k of keys) {
      if ((config[k] ?? "") !== ((gateway.config ?? {})[k] ?? "")) return true;
    }
    return false;
  }, [enabled, mode, config, gateway]);

  const save = useMutation({
    mutationFn: (payload: {
      enabled?: boolean;
      mode?: "test" | "live";
      config?: Record<string, string>;
    }) =>
      updateFn({
        data: { provider: gateway.provider, ...payload },
      }),
    onSuccess: () => {
      toast.success(`${gateway.display_name} saved`);
      qc.invalidateQueries({ queryKey: ["admin", "payment-gateways"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const test = useMutation({
    mutationFn: () => testFn({ data: { provider: gateway.provider } }),
    onSuccess: (res) => {
      setTestResult(res);
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
    },
    onError: (e: Error) => {
      setTestResult({ ok: false, message: e.message });
      toast.error(e.message);
    },
  });

  const toggleEnabled = (v: boolean) => {
    setEnabled(v);
    save.mutate({ enabled: v });
  };

  return (
    <section
      className={`relative overflow-hidden rounded-xl border border-border bg-card p-6 shadow-sm`}
    >
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b ${meta.accent}`}
      />
      <div className="relative flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg border border-border bg-background p-2.5">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-xl uppercase tracking-tight">
                {gateway.display_name}
              </h2>
              {enabled ? (
                <Badge className="gap-1 bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/20">
                  <CheckCircle2 className="h-3 w-3" /> Active
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 text-muted-foreground">
                  <CircleDot className="h-3 w-3" /> Disabled
                </Badge>
              )}
              <Badge variant="outline" className="uppercase">
                {mode}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{meta.tagline}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor={`enabled-${gateway.provider}`} className="text-xs text-muted-foreground">
            {enabled ? "Enabled" : "Disabled"}
          </Label>
          <Switch
            id={`enabled-${gateway.provider}`}
            checked={enabled}
            onCheckedChange={toggleEnabled}
          />
        </div>
      </div>

      <form
        className="relative mt-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate({ enabled, mode, config });
        }}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Environment</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as "test" | "live")}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="test">Test / Sandbox</SelectItem>
                <SelectItem value="live">Live</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {getGatewayFields(gateway.provider, mode).map((f: GatewayFieldDef) => {
            const isRevealed = f.secret && revealed[f.key] !== undefined;
            const savedHasSecret =
              f.secret &&
              typeof (gateway.config ?? {})[f.key] === "string" &&
              ((gateway.config ?? {})[f.key] as string).length > 0;
            const editedValue = config[f.key] ?? "";
            // Dirty user input always wins; otherwise show the revealed plaintext.
            const value = isRevealed && editedValue === ((gateway.config ?? {})[f.key] ?? "")
              ? revealed[f.key]
              : editedValue;
            const placeholder = resolvePlaceholder(f, mode);
            const error = fieldErrors[f.key];
            const showError = Boolean(error) && (touched[f.key] || value.length > 0);
            const commonProps = {
              id: `${gateway.provider}-${f.key}`,
              value,
              placeholder,
              "aria-invalid": showError || undefined,
              "aria-describedby": showError ? `${gateway.provider}-${f.key}-err` : undefined,
              onBlur: () => setTouched((t) => ({ ...t, [f.key]: true })),
              onChange: (
                e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
              ) => {
                setConfig({ ...config, [f.key]: e.target.value });
                if (isRevealed) {
                  setRevealed((r) => {
                    const next = { ...r };
                    delete next[f.key];
                    return next;
                  });
                }
              },
            };
            const invalidCls = showError
              ? "border-destructive focus-visible:ring-destructive/40"
              : "";
            return (
              <div
                key={f.key}
                className={f.type === "textarea" ? "md:col-span-2" : ""}
              >
                <Label htmlFor={commonProps.id}>
                  {f.label}
                  {f.required ? (
                    <span className="ml-1 text-destructive">*</span>
                  ) : null}
                  {f.secret ? (
                    <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                      secret
                    </span>
                  ) : null}
                </Label>
                {f.type === "textarea" ? (
                  <Textarea rows={3} className={`mt-1 ${invalidCls}`} {...commonProps} />
                ) : f.secret ? (
                  <div className="relative mt-1">
                    <Input
                      type={isRevealed ? "text" : "password"}
                      autoComplete="off"
                      className={`pr-10 font-mono ${invalidCls}`}
                      {...commonProps}
                    />
                    {savedHasSecret ? (
                      <button
                        type="button"
                        onClick={() => toggleReveal(f.key)}
                        disabled={revealing[f.key]}
                        aria-label={isRevealed ? `Hide ${f.label}` : `Reveal ${f.label}`}
                        aria-pressed={isRevealed}
                        title={
                          isRevealed
                            ? "Hide value"
                            : "Reveal saved value (audited, auto-hides in 20s)"
                        }
                        className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-50"
                      >
                        {revealing[f.key] ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : isRevealed ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <Input
                    type={f.type === "password" ? "password" : "text"}
                    autoComplete="off"
                    className={`mt-1 ${invalidCls}`}
                    {...commonProps}
                  />
                )}
                {showError ? (
                  <p
                    id={`${gateway.provider}-${f.key}-err`}
                    className="mt-1 flex items-center gap-1 text-xs text-destructive"
                  >
                    <AlertCircle className="h-3 w-3" />
                    {error}
                  </p>
                ) : isRevealed ? (
                  <p className="mt-1 text-xs text-amber-500">
                    Revealed — auto-hides in 20s. This action was logged.
                  </p>
                ) : f.helperText ? (
                  <p className="mt-1 text-xs text-muted-foreground">{f.helperText}</p>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            Last updated {new Date(gateway.updated_at).toLocaleString()}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={test.isPending || dirty}
              onClick={() => test.mutate()}
              title={dirty ? "Save changes before testing" : "Test connection"}
            >
              {test.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <PlugZap className="mr-2 h-4 w-4" />
              )}
              Test connection
            </Button>
            <Button type="submit" disabled={!dirty || save.isPending || hasErrors}>
              {save.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save changes
            </Button>
          </div>
        </div>

        {testResult ? (
          <div
            className={`rounded-lg border p-3 text-sm ${
              testResult.ok
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                : "border-destructive/40 bg-destructive/10 text-destructive"
            }`}
          >
            <div className="flex items-center gap-2 font-medium">
              {testResult.ok ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              {testResult.message}
            </div>
            {testResult.details ? (
              <dl className="mt-2 grid gap-1 text-xs text-foreground/80 sm:grid-cols-2">
                {Object.entries(testResult.details).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 border-t border-border/40 py-1">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="truncate font-mono">{String(v ?? "—")}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        ) : null}
      </form>
    </section>
  );
}