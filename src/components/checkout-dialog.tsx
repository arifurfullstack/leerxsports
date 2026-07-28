import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ArrowRight, Check, CreditCard, Lock, ShieldCheck, KeyRound, Crown, HelpCircle, Calculator, TrendingUp, Loader2 } from "lucide-react";
import { toast } from "sonner";

export type CheckoutPlanId = "unlock" | "subscription" | "dispatch";

type PlanOption = {
  id: CheckoutPlanId;
  title: string;
  tagline: string;
  amount: number; // USD baseline
  cadence: string;
};

const PLANS: PlanOption[] = [
  { id: "unlock", title: "Post Unlock", tagline: "One post, yours forever.", amount: 5, cadence: "one-time" },
  { id: "subscription", title: "Creator Subscription", tagline: "Full library, every drop.", amount: 15, cadence: "per month" },
  { id: "dispatch", title: "Q&A Dispatch", tagline: "A personal answer, guaranteed.", amount: 300, cadence: "one-time" },
];

type Billing = "monthly" | "annual";

export type CheckoutAssumptions = {
  subPrice: number;
  subs: number;
  unlockPrice: number;
  unlocks: number;
  qas: number;
  feePct: number;
};

export function CheckoutDialog({
  open,
  onOpenChange,
  initialPlan = "subscription",
  billing = "monthly",
  assumptions,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialPlan?: CheckoutPlanId;
  billing?: Billing;
  assumptions?: CheckoutAssumptions;
}) {
  const [step, setStep] = useState(0);
  const [planId, setPlanId] = useState<CheckoutPlanId>(initialPlan);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // form state
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [country, setCountry] = useState("US");
  const [postal, setPostal] = useState("");
  const [card, setCard] = useState("");
  const [exp, setExp] = useState("");
  const [cvc, setCvc] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setStep(0);
      setPlanId(initialPlan);
      setDone(false);
      setSubmitting(false);
      setErrors({});
    }
  }, [open, initialPlan]);

  const plan = useMemo(() => {
    const base = PLANS.find((p) => p.id === planId)!;
    if (!assumptions) return base;
    if (base.id === "subscription") return { ...base, amount: assumptions.subPrice };
    if (base.id === "unlock") return { ...base, amount: assumptions.unlockPrice };
    return base; // dispatch stays $300
  }, [planId, assumptions]);
  const isSub = plan.id === "subscription";
  const annualDiscount = isSub && billing === "annual";
  const quantity = assumptions
    ? plan.id === "subscription"
      ? Math.max(1, assumptions.subs)
      : plan.id === "unlock"
      ? Math.max(1, assumptions.unlocks)
      : Math.max(1, assumptions.qas || 1)
    : 1;
  const perUnit = annualDiscount ? Math.round(plan.amount * 12 * 0.8) : plan.amount;
  const unitAmount = perUnit * quantity;
  const cadenceLabel = isSub ? (annualDiscount ? "/ year" : "/ month") : "";
  const tax = Math.round(unitAmount * 0.08 * 100) / 100;
  const total = Math.round((unitAmount + tax) * 100) / 100;

  function validateBilling(): boolean {
    const e: Record<string, string> = {};
    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email.trim())) {
      e.email = "Enter a valid email address";
    }
    if (fullName.trim().length < 2) e.fullName = "Enter your full name";
    if (postal.trim().length < 3) e.postal = "Enter a postal code";
    const digits = card.replace(/\s+/g, "");
    if (!/^\d{13,19}$/.test(digits)) e.card = "Enter a valid card number";
    if (!/^(0[1-9]|1[0-2])\s*\/\s*\d{2}$/.test(exp)) e.exp = "MM/YY";
    if (!/^\d{3,4}$/.test(cvc)) e.cvc = "3–4 digits";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit() {
    setSubmitting(true);
    try {
      const { createPaymentIntent } = await import("@/lib/payments-functions");
      const res = await createPaymentIntent({
        data: {
          amount: total,
          currency: "usd",
          kind: planId,
          metadata: { email, fullName, country, postal },
        },
      });
      setSubmitting(false);
      setDone(true);
      if (res.isMock) {
        toast.success("Payment confirmed", {
          description: `${plan.title} activated. (Development Mode)`,
        });
      } else {
        toast.success("Payment successful!", {
          description: `${plan.title} activated via Stripe.`,
        });
      }
    } catch (err: any) {
      setSubmitting(false);
      toast.error("Payment failed", {
        description: err?.message || "Could not process payment. Please try again.",
      });
    }
  }

  const steps = ["Plan", "Billing", "Review"] as const;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg overflow-hidden p-0 sm:max-w-xl">
        {/* Header */}
        <div className="relative border-b border-border/60 bg-surface/40 px-6 pt-6 pb-5">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-50 blur-3xl"
            style={{ background: "color-mix(in oklch, var(--primary) 40%, transparent)" }}
          />
          <DialogHeader className="space-y-1 text-left">
            <DialogTitle className="font-serif text-2xl tracking-tight">
              {done ? "You're all set." : "Complete your checkout"}
            </DialogTitle>
            <DialogDescription>
              {done ? "A receipt is on its way to your inbox." : "Three quick steps. Cancel anytime."}
            </DialogDescription>
          </DialogHeader>

          {/* Stepper */}
          {!done && (
            <div className="mt-5 flex items-center gap-2">
              {steps.map((label, i) => {
                const active = i === step;
                const complete = i < step;
                return (
                  <div key={label} className="flex flex-1 items-center gap-2">
                    <div
                      className={
                        "grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold transition " +
                        (complete
                          ? "bg-primary text-primary-foreground"
                          : active
                          ? "bg-foreground text-background ring-4 ring-primary/20"
                          : "bg-foreground/10 text-muted-foreground")
                      }
                    >
                      {complete ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
                    </div>
                    <span
                      className={
                        "hidden text-xs font-medium uppercase tracking-[0.18em] sm:inline " +
                        (active ? "text-foreground" : "text-muted-foreground")
                      }
                    >
                      {label}
                    </span>
                    {i < steps.length - 1 && (
                      <div className="ml-1 h-px flex-1 bg-gradient-to-r from-border to-transparent" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="max-h-[65vh] overflow-y-auto px-6 py-6">
          {done ? (
            <SuccessBody
              plan={plan.title}
              total={total}
              planId={plan.id}
              perUnit={perUnit}
              quantity={quantity}
              assumptions={assumptions}
            />
          ) : step === 0 ? (
            <PlanStep planId={planId} setPlanId={setPlanId} billing={billing} assumptions={assumptions} />
          ) : step === 1 ? (
            <BillingStep
              email={email}
              setEmail={setEmail}
              fullName={fullName}
              setFullName={setFullName}
              country={country}
              setCountry={setCountry}
              postal={postal}
              setPostal={setPostal}
              card={card}
              setCard={setCard}
              exp={exp}
              setExp={setExp}
              cvc={cvc}
              setCvc={setCvc}
              errors={errors}
              assumptions={assumptions}
            />
          ) : (
            <ReviewStep
              plan={plan}
              unitAmount={unitAmount}
              perUnit={perUnit}
              quantity={quantity}
              cadenceLabel={cadenceLabel}
              tax={tax}
              total={total}
              email={email}
              fullName={fullName}
              card={card}
              assumptions={assumptions}
            />
          )}
        </div>

        {/* Footer */}
        {!done && (
          <div className="flex items-center justify-between gap-3 border-t border-border/60 bg-surface/30 px-6 py-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              Encrypted · PCI-compliant
            </div>
            <div className="flex items-center gap-2">
              {step > 0 && (
                <button
                  type="button"
                  onClick={() => setStep((s) => s - 1)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background px-4 py-2 text-sm font-medium transition hover:bg-foreground/5"
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
              )}
              {step < 2 ? (
                <button
                  type="button"
                  onClick={() => {
                    if (step === 1 && !validateBilling()) return;
                    setStep((s) => s + 1);
                  }}
                  className="group inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/25 transition hover:opacity-90"
                >
                  Continue <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={submit}
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/25 transition hover:opacity-90 disabled:opacity-70"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Processing…
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4" /> Pay ${total.toFixed(2)}
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        {done && (
          <div className="flex justify-end gap-2 border-t border-border/60 bg-surface/30 px-6 py-4">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/25 transition hover:opacity-90"
            >
              Done
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PlanStep({
  planId,
  setPlanId,
  billing,
  assumptions,
}: {
  planId: CheckoutPlanId;
  setPlanId: (v: CheckoutPlanId) => void;
  billing: Billing;
  assumptions?: CheckoutAssumptions;
}) {
  const overrideAmount = (id: CheckoutPlanId): number | null => {
    if (!assumptions) return null;
    if (id === "subscription") return assumptions.subPrice;
    if (id === "unlock") return assumptions.unlockPrice;
    return null;
  };
  const qtyFor = (id: CheckoutPlanId): number | null => {
    if (!assumptions) return null;
    if (id === "subscription") return assumptions.subs;
    if (id === "unlock") return assumptions.unlocks;
    return assumptions.qas;
  };
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Choose what you want to purchase today.</p>
      {assumptions && <AssumptionsCard a={assumptions} />}
      {PLANS.map((p) => {
        const active = p.id === planId;
        const isSub = p.id === "subscription";
        const base = overrideAmount(p.id) ?? p.amount;
        const amount = isSub && billing === "annual" ? Math.round(base * 12 * 0.8) : base;
        const cadence = isSub ? (billing === "annual" ? "/ year" : "/ month") : "one-time";
        const qty = qtyFor(p.id);
        const PlanIcon =
          p.id === "unlock"
            ? KeyRound
            : p.id === "subscription"
              ? Crown
              : HelpCircle;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => setPlanId(p.id)}
            className={
              "group relative flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition " +
              (active
                ? "border-primary/60 bg-primary/[0.06] shadow-[0_0_0_1px_color-mix(in_oklch,var(--primary)_35%,transparent)]"
                : "border-border/60 bg-surface/30 hover:border-foreground/30")
            }
          >
            <span
              className={
                "grid h-10 w-10 shrink-0 place-items-center rounded-xl " +
                (active ? "bg-primary text-primary-foreground" : "bg-foreground/10 text-foreground/80")
              }
            >
              <PlanIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium">{p.title}</p>
                {p.id === "subscription" && (
                  <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-primary">
                    Popular
                  </span>
                )}
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {p.tagline}
                {qty != null && qty > 0 && (
                  <span className="ml-1 text-primary/80">
                    · × {qty.toLocaleString()} from calculator
                  </span>
                )}
              </p>
            </div>
            <div className="text-right">
              <p className="font-serif text-xl leading-none tracking-tight">${amount}</p>
              <p className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">{cadence}</p>
            </div>
            <span
              className={
                "ml-1 grid h-5 w-5 shrink-0 place-items-center rounded-full border transition " +
                (active ? "border-primary bg-primary text-primary-foreground" : "border-border")
              }
            >
              {active && <Check className="h-3 w-3" strokeWidth={3} />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Field({
  id,
  label,
  error,
  children,
  className = "",
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={"space-y-1.5 " + className}>
      <Label htmlFor={id} className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function AssumptionsCard({ a }: { a: CheckoutAssumptions }) {
  const rows = [
    { label: "Sub price", value: `$${a.subPrice}/mo` },
    { label: "Subscribers", value: a.subs.toLocaleString() },
    { label: "Unlock price", value: `$${a.unlockPrice}` },
    { label: "Unlocks / mo", value: a.unlocks.toLocaleString() },
    { label: "Dispatches / mo", value: a.qas.toLocaleString() },
    { label: "Platform fee", value: `${a.feePct}%` },
  ];
  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/[0.06] p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-primary">
        <Calculator className="h-3 w-3" /> From your calculator
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs sm:grid-cols-3">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-2">
            <dt className="text-muted-foreground">{r.label}</dt>
            <dd className="font-medium text-foreground">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}


function BillingStep(props: {
  email: string; setEmail: (v: string) => void;
  fullName: string; setFullName: (v: string) => void;
  country: string; setCountry: (v: string) => void;
  postal: string; setPostal: (v: string) => void;
  card: string; setCard: (v: string) => void;
  exp: string; setExp: (v: string) => void;
  cvc: string; setCvc: (v: string) => void;
  errors: Record<string, string>;
  assumptions?: CheckoutAssumptions;
}) {
  const { errors } = props;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {props.assumptions && (
        <div className="sm:col-span-2">
          <AssumptionsCard a={props.assumptions} />
        </div>
      )}
      <Field id="email" label="Email" error={errors.email} className="sm:col-span-2">
        <Input id="email" type="email" placeholder="you@example.com" value={props.email} onChange={(e) => props.setEmail(e.target.value)} />
      </Field>
      <Field id="fullName" label="Full name" error={errors.fullName} className="sm:col-span-2">
        <Input id="fullName" placeholder="Ada Lovelace" value={props.fullName} onChange={(e) => props.setFullName(e.target.value)} />
      </Field>

      <Field id="country" label="Country">
        <select
          id="country"
          value={props.country}
          onChange={(e) => props.setCountry(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {["US","CA","UK","AU","DE","FR","ES","IT","NL","IN","JP","BR","MX","AE","SG"].map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </Field>
      <Field id="postal" label="Postal code" error={errors.postal}>
        <Input id="postal" placeholder="94103" value={props.postal} onChange={(e) => props.setPostal(e.target.value)} />
      </Field>

      <Field id="card" label="Card number" error={errors.card} className="sm:col-span-2">
        <div className="relative">
          <Input
            id="card"
            inputMode="numeric"
            placeholder="4242 4242 4242 4242"
            value={props.card}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 19);
              const grouped = v.replace(/(.{4})/g, "$1 ").trim();
              props.setCard(grouped);
            }}
            className="pr-10"
          />
          <CreditCard className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
      </Field>
      <Field id="exp" label="Expiry" error={errors.exp}>
        <Input
          id="exp"
          placeholder="MM/YY"
          value={props.exp}
          onChange={(e) => {
            let v = e.target.value.replace(/\D/g, "").slice(0, 4);
            if (v.length >= 3) v = v.slice(0, 2) + "/" + v.slice(2);
            props.setExp(v);
          }}
        />
      </Field>
      <Field id="cvc" label="CVC" error={errors.cvc}>
        <Input id="cvc" inputMode="numeric" placeholder="123" value={props.cvc} onChange={(e) => props.setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))} />
      </Field>
    </div>
  );
}

function ReviewStep({
  plan, unitAmount, perUnit, quantity, cadenceLabel, tax, total, email, fullName, card, assumptions,
}: {
  plan: PlanOption; unitAmount: number; perUnit: number; quantity: number; cadenceLabel: string; tax: number; total: number;
  email: string; fullName: string; card: string;
  assumptions?: CheckoutAssumptions;
}) {
  const last4 = card.replace(/\s+/g, "").slice(-4) || "••••";
  return (
    <div className="space-y-4">
      {assumptions && <AssumptionsCard a={assumptions} />}
      <div className="rounded-2xl border border-border/60 bg-surface/40 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Plan</p>
            <p className="mt-1 font-medium">{plan.title}</p>
            {quantity > 1 && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {quantity.toLocaleString()} × ${perUnit.toFixed(2)}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="font-serif text-2xl tracking-tight">${unitAmount}</p>
            {cadenceLabel && <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{cadenceLabel}</p>}
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-border/60 bg-surface/40 p-4 text-sm">
        <Row label="Billed to" value={fullName || "—"} />
        <Row label="Email" value={email || "—"} />
        <Row label="Card" value={`•••• ${last4}`} />
      </div>
      <div className="rounded-2xl border border-border/60 bg-background/40 p-4 text-sm">
        <Row label="Subtotal" value={`$${unitAmount.toFixed(2)}`} />
        <Row label="Tax (est.)" value={`$${tax.toFixed(2)}`} />
        <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3">
          <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Total due today</span>
          <span className="font-serif text-2xl tracking-tight">${total.toFixed(2)}</span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        By continuing you agree to our terms and confirm this charge. This is a demo checkout — no card is actually charged.
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
      <span className="truncate pl-4 text-right">{value}</span>
    </div>
  );
}

function SuccessBody({
  plan,
  total,
  planId,
  perUnit,
  quantity,
  assumptions,
}: {
  plan: string;
  total: number;
  planId: CheckoutPlanId;
  perUnit: number;
  quantity: number;
  assumptions?: CheckoutAssumptions;
}) {
  const projection = (() => {
    if (!assumptions) return null;
    const fee = assumptions.feePct / 100;
    const grossMonthly =
      planId === "subscription"
        ? assumptions.subPrice * assumptions.subs
        : planId === "unlock"
        ? assumptions.unlockPrice * assumptions.unlocks
        : 300 * assumptions.qas;
    const netMonthly = grossMonthly * (1 - fee);
    return {
      grossMonthly,
      netMonthly,
      netYearly: netMonthly * 12,
      feePct: assumptions.feePct,
    };
  })();

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-6 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30">
        <Check className="h-7 w-7" strokeWidth={3} />
      </div>
      <h3 className="font-serif text-2xl tracking-tight">{plan} activated</h3>
      <p className="max-w-sm text-sm text-muted-foreground">
        We charged <span className="font-medium text-foreground">${total.toFixed(2)}</span> and emailed your receipt. You can manage this from your Library at any time.
      </p>

      {projection && (
        <div className="mt-2 w-full max-w-sm rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-surface/40 to-background/30 p-4 text-left">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-primary">
            <TrendingUp className="h-3 w-3" /> Projected take-home
          </div>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Monthly
              </div>
              <div className="font-serif text-2xl tracking-tight">
                ${Math.round(projection.netMonthly).toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Yearly
              </div>
              <div className="font-serif text-2xl tracking-tight">
                ${Math.round(projection.netYearly).toLocaleString()}
              </div>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Based on {quantity.toLocaleString()} × ${perUnit} for {plan}, net of a {projection.feePct}% platform fee (${Math.round(projection.grossMonthly).toLocaleString()} gross / mo).
          </p>
        </div>
      )}
    </div>
  );
}