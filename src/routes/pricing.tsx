import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckoutDialog, type CheckoutPlanId, type CheckoutAssumptions } from "@/components/checkout-dialog";
import {
  Check,
  Tag,
  Lock,
  MessageCircleQuestion,
  Crown,
  Zap,
  ChevronDown,
  ArrowRight,
  ShieldCheck,
  Wallet,
  Clock,
  Star,
  Trophy,
  Filter,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell as RCell,
  Legend,
} from "recharts";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing | LEER" },
      { name: "description", content: "Simple pricing for creators and fans on LEER. Monthly subscriptions, one-off post unlocks, and $300 paid Q&A dispatches with zero hidden fees." },
      { property: "og:title", content: "Pricing | LEER" },
      { property: "og:description", content: "Subscribe to creators, unlock premium posts one at a time, or send a paid Q&A." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PricingPage,
});

function PricingPage() {
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const annual = billing === "annual";
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<CheckoutPlanId>("subscription");
  const [checkoutAssumptions, setCheckoutAssumptions] = useState<CheckoutAssumptions | undefined>(undefined);

  function openCheckout(planId: CheckoutPlanId, assumptions?: CheckoutAssumptions) {
    setCheckoutPlan(planId);
    setCheckoutAssumptions(assumptions);
    setCheckoutOpen(true);
  }

  return (
    <main className="relative isolate overflow-hidden bg-[#000000] text-foreground">
      {/* Clean Solid Deep Black (#000000) background with subtle top spotlight */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[#000000]">
        <div
          className="absolute left-1/2 -top-40 -translate-x-1/2 h-[600px] w-[600px] rounded-full bg-premium/10 blur-[130px]"
        />
      </div>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pt-16 pb-10 text-center sm:px-6 sm:pt-28">
        <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-surface/60 px-3 py-1 text-xs uppercase tracking-[0.2em] text-muted-foreground backdrop-blur">
          <Tag className="h-3.5 w-3.5" /> Pricing
        </span>
        <h1 className="mt-6 font-serif text-4xl leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
          Pay only for what
          <br />
          you <span className="italic text-primary">actually</span> want.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
          Subscribe to a creator for their full library, unlock a single post, or send a paid question. No bundles, no lock-in, no course catalogs.
        </p>

        {/* Billing toggle */}
        <div className="mt-8 inline-flex items-center gap-1 rounded-full border border-border/60 bg-surface/60 p-1 backdrop-blur">
          <button
            type="button"
            onClick={() => setBilling("monthly")}
            className={
              "rounded-full px-4 py-1.5 text-sm font-medium transition " +
              (!annual ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")
            }
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setBilling("annual")}
            className={
              "inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition " +
              (annual ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")
            }
          >
            Annual
            <span
              className={
                "rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest " +
                (annual ? "bg-primary text-primary-foreground" : "bg-primary/15 text-primary")
              }
            >
              -20%
            </span>
          </button>
        </div>

        {/* Trust bar */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-primary" /> Encrypted checkout</span>
          <span className="inline-flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5 text-primary" /> No hidden fees</span>
          <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-primary" /> Cancel anytime</span>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => openCheckout("subscription")}
            className="group inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/25 transition hover:opacity-90"
          >
            Start checkout <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </button>
          <a
            href="#compare"
            className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/60 px-5 py-3 text-sm font-medium transition hover:bg-foreground/5"
          >
            Compare plans
          </a>
        </div>
      </section>

      {/* Three pricing tiers */}
      <section className="mx-auto grid max-w-6xl gap-5 px-4 pb-8 sm:px-6 sm:grid-cols-2 md:grid-cols-3 md:items-stretch">
        {/* Unlock */}
        <PricingCard
          icon={<Lock className="h-5 w-5" />}
          eyebrow="One-off"
          title="Post Unlock"
          price="from $1"
          priceSuffix="/ post"
          description="Buy access to a single premium post. Yours to view forever."
          features={[
            "Instant access after payment",
            "Full-resolution photo or video",
            "Kept in your Library",
            "No recurring charges",
          ]}
          cta={{ label: "Buy an unlock", onClick: () => openCheckout("unlock") }}
        />

        {/* Subscription — featured */}
        <PricingCard
          featured
          icon={<Crown className="h-5 w-5" />}
          eyebrow="Most popular"
          title="Creator Subscription"
          price={annual ? "$4–$40" : "$5–$50"}
          priceSuffix={annual ? "/ mo, billed yearly" : "/ month"}
          description="Unlock a creator's entire premium feed for as long as you're subscribed."
          features={[
            "Every current & future premium post",
            "Direct messages (when enabled)",
            "Priority on Q&A dispatches",
            annual ? "Save 20% vs monthly" : "Cancel anytime",
          ]}
          cta={{ label: "Subscribe now", onClick: () => openCheckout("subscription") }}
        />

        {/* Q&A */}
        <PricingCard
          icon={<MessageCircleQuestion className="h-5 w-5" />}
          eyebrow="Paid Q&A"
          title="Dispatch"
          price="$300"
          priceSuffix="/ question"
          description="Send any creator a direct question. If they don't answer in 48 hours, you're refunded."
          features={[
            "Guaranteed personal answer",
            "48-hour response window",
            "Auto-refund on expiry",
            "Private between you two",
          ]}
          cta={{ label: "Send a dispatch", onClick: () => openCheckout("dispatch") }}
        />
      </section>

      {/* Compare */}
      <section id="compare" className="mx-auto max-w-6xl px-4 pb-4 pt-8 scroll-mt-24 sm:px-6">
        <CompareTable onChoose={openCheckout} />
      </section>

      {/* Creator earnings */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-surface/40 p-6 backdrop-blur sm:p-12">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-60 blur-3xl"
            style={{ background: "color-mix(in oklch, var(--primary) 35%, transparent)" }}
          />
          <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
            <div className="max-w-lg">
              <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-primary">
                <Zap className="h-3.5 w-3.5" /> For creators
              </span>
              <h2 className="mt-4 font-serif text-3xl tracking-tight sm:text-4xl">
                Keep the majority of every dollar.
              </h2>
              <p className="mt-3 text-muted-foreground">
                LEER takes a flat platform fee on unlocks, subscriptions, and Q&A dispatches. Payment processing is passed through at cost with no hidden markup.
              </p>
              <Link
                to="/trainers"
                className="group mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 transition hover:opacity-90"
              >
                Become a creator
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>
            </div>
            <dl className="grid flex-1 grid-cols-3 gap-2 text-center sm:gap-4">
              <Stat label="Creator take" value="85%" />
              <Stat label="Platform fee" value="15%" />
              <Stat label="Payout cadence" value="Weekly" />
            </dl>
          </div>
        </div>
      </section>

      {/* Earnings calculator */}
      <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
        <EarningsCalculator onCheckout={openCheckout} />
      </section>

      {/* Testimonial */}
      <section className="mx-auto max-w-4xl px-4 pb-12 sm:px-6">
        <figure className="relative rounded-3xl border border-border/60 bg-surface/40 p-6 backdrop-blur sm:p-10">
          <div className="flex items-center gap-1 text-primary">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="h-4 w-4 fill-current" />
            ))}
          </div>
          <blockquote className="mt-4 font-serif text-xl leading-snug tracking-tight sm:text-3xl">
            “Pricing is refreshingly honest. I unlocked one post, loved it, and subscribed the next day with zero upsell games.”
          </blockquote>
          <figcaption className="mt-5 text-sm text-muted-foreground">
            Alex R. · Member since 2025
          </figcaption>
        </figure>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 pb-24 sm:px-6">
        <h2 className="text-center font-serif text-3xl tracking-tight sm:text-4xl">Common questions</h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">Straightforward answers. If we missed one, ping support.</p>
        <div className="mt-8 divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/60 bg-surface/40 backdrop-blur">
          {FAQ.map((item) => (
            <details key={item.q} className="group px-4 py-5 transition open:bg-background/30 sm:px-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-base font-medium [&::-webkit-details-marker]:hidden">
                <span>{item.q}</span>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border/60 text-muted-foreground transition group-open:rotate-180 group-open:border-primary/50 group-open:text-primary">
                  <ChevronDown className="h-4 w-4" />
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
            </details>
          ))}
        </div>

        {/* Final CTA */}
        <div className="mt-12 flex flex-col items-center gap-4 rounded-3xl border border-border/60 bg-gradient-to-br from-primary/10 via-surface/40 to-background/40 p-6 text-center backdrop-blur sm:p-10">
          <h3 className="font-serif text-3xl tracking-tight sm:text-4xl">Ready when you are.</h3>
          <p className="max-w-md text-sm text-muted-foreground">
            Start with a single unlock or dive into a full subscription. No credit card until checkout.
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => openCheckout("subscription")}
              className="group inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 transition hover:opacity-90"
            >
              Start checkout <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </button>
            <Link
              to="/trainers"
              className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/60 px-5 py-3 text-sm font-medium transition hover:bg-foreground/5"
            >
              Explore creators
            </Link>
          </div>
        </div>
      </section>

      <CheckoutDialog
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        initialPlan={checkoutPlan}
        billing={billing}
        assumptions={checkoutAssumptions}
      />
    </main>
  );
}

function PricingCard({
  icon,
  eyebrow,
  title,
  price,
  priceSuffix,
  description,
  features,
  cta,
  featured,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  price: string;
  priceSuffix: string;
  description: string;
  features: string[];
  cta: { label: string; to?: string; onClick?: () => void };
  featured?: boolean;
}) {
  const ctaClass =
    "group/cta mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-medium transition " +
    (featured
      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:opacity-90"
      : "border border-border/70 bg-background hover:border-foreground/40 hover:bg-foreground/5");
  return (
    <div
      className={
        "group relative flex flex-col rounded-3xl border p-6 backdrop-blur transition duration-300 hover:-translate-y-1 " +
        (featured
          ? "border-primary/40 bg-gradient-to-b from-primary/10 to-primary/[0.02] shadow-[0_0_0_1px_color-mix(in_oklch,var(--primary)_30%,transparent),0_30px_60px_-30px_color-mix(in_oklch,var(--primary)_45%,transparent)] md:scale-[1.02]"
          : "border-border/60 bg-surface/40 hover:border-foreground/30 hover:shadow-xl hover:shadow-black/5")
      }
    >
      {featured && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-foreground shadow-lg shadow-primary/30">
          {eyebrow}
        </span>
      )}
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
        <span
          className={
            "inline-flex h-9 w-9 items-center justify-center rounded-xl transition " +
            (featured
              ? "bg-primary/15 text-primary ring-1 ring-inset ring-primary/30"
              : "bg-foreground/5 text-foreground/80 group-hover:bg-foreground/10")
          }
        >
          {icon}
        </span>
        {!featured && eyebrow}
      </div>
      <h3 className="mt-5 font-serif text-2xl tracking-tight">{title}</h3>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="font-serif text-4xl tracking-tight sm:text-5xl">{price}</span>
        <span className="text-sm text-muted-foreground">{priceSuffix}</span>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{description}</p>
      <div className="my-6 h-px w-full bg-gradient-to-r from-transparent via-border to-transparent" />
      <ul className="space-y-3 text-sm">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-3">
            <span
              className={
                "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full " +
                (featured ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary")
              }
            >
              <Check className="h-3 w-3" strokeWidth={3} />
            </span>
            <span className="leading-snug">{f}</span>
          </li>
        ))}
      </ul>
      {cta.onClick ? (
        <button type="button" onClick={cta.onClick} className={ctaClass}>
          {cta.label}
          <ArrowRight className="h-4 w-4 transition group-hover/cta:translate-x-0.5" />
        </button>
      ) : (
        <Link to={cta.to!} className={ctaClass}>
          {cta.label}
          <ArrowRight className="h-4 w-4 transition group-hover/cta:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/50 p-4 backdrop-blur transition hover:border-primary/40">
      <dt className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</dt>
      <dd className="mt-2 font-serif text-3xl tracking-tight sm:text-4xl">{value}</dd>
    </div>
  );
}

function Cell({ v, highlight }: { v: string | boolean; highlight?: boolean }) {
  const cls = "px-3 py-4 text-center sm:px-5 " + (highlight ? "bg-primary/[0.04]" : "");
  if (typeof v === "boolean") {
    return (
      <div className={cls}>
        {v ? (
          <Check className={"mx-auto h-4 w-4 " + (highlight ? "text-primary" : "text-foreground/70")} strokeWidth={3} />
        ) : (
          <span className="text-muted-foreground/40">—</span>
        )}
      </div>
    );
  }
  return <div className={cls + " text-sm " + (highlight ? "text-foreground" : "text-muted-foreground")}>{v}</div>;
}

const PLATFORM_FEE = 0.15;
const FEE_PRESETS = [5, 10, 15, 20, 25, 30];

function fmt(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

type PresetKey = "starter" | "unlock" | "sub" | "qa" | "pro";

const PRESETS: {
  key: PresetKey;
  label: string;
  hint: string;
  values: { subPrice: number; subs: number; unlockPrice: number; unlocks: number; qas: number };
}[] = [
  {
    key: "starter",
    label: "Just starting",
    hint: "Small audience, testing the waters",
    values: { subPrice: 5, subs: 25, unlockPrice: 3, unlocks: 15, qas: 0 },
  },
  {
    key: "unlock",
    label: "Unlock-first",
    hint: "Premium posts, no subscription push",
    values: { subPrice: 8, subs: 40, unlockPrice: 6, unlocks: 250, qas: 1 },
  },
  {
    key: "sub",
    label: "Subscription creator",
    hint: "Recurring library revenue",
    values: { subPrice: 12, subs: 500, unlockPrice: 5, unlocks: 60, qas: 1 },
  },
  {
    key: "qa",
    label: "Dispatch-heavy",
    hint: "Expert Q&A is your main product",
    values: { subPrice: 15, subs: 120, unlockPrice: 5, unlocks: 30, qas: 8 },
  },
  {
    key: "pro",
    label: "Full-stack pro",
    hint: "All three streams firing",
    values: { subPrice: 20, subs: 1500, unlockPrice: 8, unlocks: 400, qas: 6 },
  },
];

function EarningsCalculator({
  onCheckout,
}: {
  onCheckout: (plan: CheckoutPlanId, assumptions?: CheckoutAssumptions) => void;
}) {
  const [preset, setPreset] = useState<PresetKey>("sub");
  const initial = PRESETS.find((p) => p.key === "sub")!.values;
  const [subPrice, setSubPrice] = useState(initial.subPrice);
  const [subs, setSubs] = useState(initial.subs);
  const [unlockPrice, setUnlockPrice] = useState(initial.unlockPrice);
  const [unlocks, setUnlocks] = useState(initial.unlocks);
  const [qas, setQas] = useState(initial.qas);
  const [feePct, setFeePct] = useState(Math.round(PLATFORM_FEE * 100));
  const fee = feePct / 100;

  function applyPreset(key: PresetKey) {
    const p = PRESETS.find((x) => x.key === key);
    if (!p) return;
    setPreset(key);
    setSubPrice(p.values.subPrice);
    setSubs(p.values.subs);
    setUnlockPrice(p.values.unlockPrice);
    setUnlocks(p.values.unlocks);
    setQas(p.values.qas);
  }

  const activePreset = PRESETS.find((p) => p.key === preset);
  const matchesPreset =
    activePreset &&
    activePreset.values.subPrice === subPrice &&
    activePreset.values.subs === subs &&
    activePreset.values.unlockPrice === unlockPrice &&
    activePreset.values.unlocks === unlocks &&
    activePreset.values.qas === qas;

  const { subGross, unlockGross, qaGross, gross, net, monthly } = useMemo(() => {
    const subGross = subPrice * subs;
    const unlockGross = unlockPrice * unlocks;
    const qaGross = 300 * qas;
    const gross = subGross + unlockGross + qaGross;
    const net = gross * (1 - fee);
    return { subGross, unlockGross, qaGross, gross, net, monthly: net };
  }, [subPrice, subs, unlockPrice, unlocks, qas, fee]);

  const bestPlan: { id: CheckoutPlanId; label: string; net: number } = useMemo(() => {
    const streams: { id: CheckoutPlanId; label: string; net: number }[] = [
      { id: "subscription", label: "Creator Subscription", net: subGross * (1 - fee) },
      { id: "unlock", label: "Post Unlock", net: unlockGross * (1 - fee) },
      { id: "dispatch", label: "Dispatch", net: qaGross * (1 - fee) },
    ];
    return streams.reduce((best, s) => (s.net > best.net ? s : best), streams[0]);
  }, [subGross, unlockGross, qaGross, fee]);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-surface/40 p-6 backdrop-blur sm:p-10">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 -bottom-24 h-72 w-72 rounded-full opacity-50 blur-3xl"
        style={{ background: "color-mix(in oklch, var(--primary) 30%, transparent)" }}
      />
      <div className="flex flex-col gap-2 text-center sm:text-left">
        <span className="inline-flex items-center justify-center gap-2 self-center rounded-full bg-primary/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-primary sm:self-start">
          <Zap className="h-3.5 w-3.5" /> Earnings calculator
        </span>
        <h2 className="mt-2 font-serif text-3xl tracking-tight sm:text-4xl">
          Estimate what you'd take home.
        </h2>
        <p className="text-sm text-muted-foreground">
          Move the sliders to model your creator income across all three revenue streams.
          Adjust the platform fee below to match your negotiated rate. Everything updates live.
        </p>
      </div>

      {/* Platform fee control */}
      <div className="mt-6 rounded-2xl border border-border/60 bg-background/30 p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Platform fee
            </div>
            <div className="mt-1 text-sm text-foreground">
              <span className="font-serif text-2xl tracking-tight text-primary">{feePct}%</span>
              <span className="ml-2 text-xs text-muted-foreground">
                creators keep {100 - feePct}%
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {FEE_PRESETS.map((p) => {
              const active = p === feePct;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setFeePct(p)}
                  aria-pressed={active}
                  className={
                    "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition " +
                    (active
                      ? "border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/30"
                      : "border-border/60 bg-background/50 text-muted-foreground hover:border-foreground/40 hover:text-foreground")
                  }
                >
                  {p}%
                </button>
              );
            })}
          </div>
        </div>
        <input
          type="range"
          min={0}
          max={50}
          step={1}
          value={feePct}
          onChange={(e) => setFeePct(Number(e.target.value))}
          aria-label="Platform fee percentage"
          className="mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-border accent-primary"
        />
        <div className="mt-1 flex justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
          <span>0%</span>
          <span>50%</span>
        </div>
      </div>

      {/* Preset chips */}
      <div className="mt-6 rounded-2xl border border-border/60 bg-background/30 p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Quick presets
          </div>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => {
              const active = matchesPreset && p.key === preset;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => applyPreset(p.key)}
                  aria-pressed={active}
                  title={p.hint}
                  className={
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition " +
                    (active
                      ? "border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/30"
                      : "border-border/60 bg-background/50 text-muted-foreground hover:border-foreground/40 hover:text-foreground")
                  }
                >
                  {active && <Check className="h-3 w-3" strokeWidth={3} />}
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
        {activePreset && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            {matchesPreset ? activePreset.hint : "Custom values. Tap a preset to reset."}
          </p>
        )}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6 rounded-2xl border border-border/60 bg-background/40 p-5 sm:p-6">
          <Slider label="Subscription price" value={subPrice} onChange={setSubPrice} min={1} max={50} step={1} suffix="/mo" />
          <Slider label="Active subscribers" value={subs} onChange={setSubs} min={0} max={5000} step={10} />
          <div className="h-px bg-border/60" />
          <Slider label="Unlock price" value={unlockPrice} onChange={setUnlockPrice} min={1} max={50} step={1} suffix="/post" />
          <Slider label="Unlocks per month" value={unlocks} onChange={setUnlocks} min={0} max={2000} step={5} />
          <div className="h-px bg-border/60" />
          <Slider label="Q&A dispatches per month" value={qas} onChange={setQas} min={0} max={30} step={1} suffix="× $300" />
        </div>

        <div className="flex flex-col justify-between gap-4 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 via-surface/40 to-background/30 p-5 sm:p-6">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Estimated monthly take-home</div>
            <div className="mt-2 font-serif text-5xl tracking-tight sm:text-6xl">{fmt(monthly)}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              ≈ {fmt(monthly * 12)} / year · from {fmt(gross)} gross
            </div>
          </div>
          <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3 lg:grid-cols-1">
            <Breakdown label="Subscriptions" value={fmt(subGross * (1 - fee))} sub={fmt(subGross) + " gross"} />
            <Breakdown label="Unlocks" value={fmt(unlockGross * (1 - fee))} sub={fmt(unlockGross) + " gross"} />
            <Breakdown label="Dispatches" value={fmt(qaGross * (1 - fee))} sub={fmt(qaGross) + " gross"} />
          </dl>
          <div className="rounded-xl border border-primary/40 bg-primary/10 p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-primary">
              <Trophy className="h-3 w-3" /> Best match
            </div>
            <div className="mt-1 text-sm text-foreground">
              <span className="font-medium">{bestPlan.label}</span> ({fmt(bestPlan.net)}/mo net)
            </div>
            <button
              type="button"
              onClick={() =>
                onCheckout(bestPlan.id, {
                  subPrice,
                  subs,
                  unlockPrice,
                  unlocks,
                  qas,
                  feePct,
                })
              }
              className="group/cta mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-md shadow-primary/25 transition hover:opacity-90"
            >
              Check out with {bestPlan.label}
              <ArrowRight className="h-4 w-4 transition group-hover/cta:translate-x-0.5" />
            </button>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Estimates only. Excludes taxes and payment processing pass-through. Actual results depend on your audience and activity.
          </p>
        </div>
      </div>

      <EarningsCharts
        subGross={subGross}
        unlockGross={unlockGross}
        qaGross={qaGross}
        monthlyNet={monthly}
        fee={fee}
      />
    </div>
  );
}

function EarningsCharts({
  subGross,
  unlockGross,
  qaGross,
  monthlyNet,
  fee,
}: {
  subGross: number;
  unlockGross: number;
  qaGross: number;
  monthlyNet: number;
  fee: number;
}) {
  const breakdown = useMemo(
    () => [
      { plan: "Subs", gross: Math.round(subGross), net: Math.round(subGross * (1 - fee)) },
      { plan: "Unlocks", gross: Math.round(unlockGross), net: Math.round(unlockGross * (1 - fee)) },
      { plan: "Dispatch", gross: Math.round(qaGross), net: Math.round(qaGross * (1 - fee)) },
    ],
    [subGross, unlockGross, qaGross, fee],
  );

  const cadence = useMemo(
    () => [
      { period: "Monthly", value: Math.round(monthlyNet) },
      { period: "Quarterly", value: Math.round(monthlyNet * 3) },
      { period: "Yearly", value: Math.round(monthlyNet * 12) },
    ],
    [monthlyNet],
  );

  const tickStyle = { fill: "hsl(var(--muted-foreground))", fontSize: 11 } as const;
  const gridStroke = "color-mix(in oklch, currentColor 10%, transparent)";
  const tooltipStyle = {
    background: "hsl(var(--background))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 12,
    fontSize: 12,
    color: "hsl(var(--foreground))",
  } as const;
  const fmtAxis = (n: number) => (n >= 1000 ? `$${Math.round(n / 100) / 10}k` : `$${n}`);
  const cadenceColors = ["oklch(0.72 0.16 25)", "oklch(0.68 0.19 25)", "oklch(0.62 0.22 25)"];

  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      <ChartCard title="Take-home over time" subtitle="Projected net earnings by cadence">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={cadence} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid stroke={gridStroke} vertical={false} />
            <XAxis dataKey="period" tick={tickStyle} axisLine={false} tickLine={false} />
            <YAxis tick={tickStyle} axisLine={false} tickLine={false} tickFormatter={fmtAxis} />
            <Tooltip
              contentStyle={tooltipStyle}
              cursor={{ fill: "color-mix(in oklch, var(--primary) 8%, transparent)" }}
              formatter={(v: number) => [fmt(v), "Net"]}
            />
            <Bar dataKey="value" radius={[8, 8, 0, 0]}>
              {cadence.map((_, i) => (
                <RCell key={i} fill={cadenceColors[i]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Gross vs net by stream" subtitle={`${Math.round(fee * 100)}% platform fee applied to each`}>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={breakdown} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid stroke={gridStroke} vertical={false} />
            <XAxis dataKey="plan" tick={tickStyle} axisLine={false} tickLine={false} />
            <YAxis tick={tickStyle} axisLine={false} tickLine={false} tickFormatter={fmtAxis} />
            <Tooltip
              contentStyle={tooltipStyle}
              cursor={{ fill: "color-mix(in oklch, var(--primary) 8%, transparent)" }}
              formatter={(v: number, name) => [fmt(v), name === "gross" ? "Gross" : "Net"]}
            />
            <Legend
              iconType="circle"
              wrapperStyle={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}
              formatter={(v) => (v === "gross" ? "Gross" : "Net")}
            />
            <Bar dataKey="gross" fill="color-mix(in oklch, var(--foreground) 20%, transparent)" radius={[6, 6, 0, 0]} />
            <Bar dataKey="net" fill="oklch(0.62 0.22 25)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/40 p-4 sm:p-5">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-foreground">{title}</div>
          <div className="text-[11px] text-muted-foreground">{subtitle}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

function Slider({
  label,
  value,
  onChange,
  min,
  max,
  step,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  step: number;
  suffix?: string;
}) {
  const display = suffix ? `${value.toLocaleString()} ${suffix}` : value.toLocaleString();
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label className="text-sm font-medium text-foreground">{label}</label>
        <span className="font-serif text-lg tracking-tight text-primary">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-border accent-primary"
        aria-label={label}
      />
      <div className="mt-1 flex justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
        <span>{min}</span>
        <span>{max.toLocaleString()}</span>
      </div>
    </div>
  );
}

function Breakdown({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="mt-1 font-serif text-xl tracking-tight">{value}</div>
      <div className="text-[10px] text-muted-foreground/70">{sub}</div>
    </div>
  );
}

type PlanKey = "unlock" | "sub" | "qa";

const PLAN_META: { key: PlanKey; label: string; id: CheckoutPlanId }[] = [
  { key: "unlock", label: "Unlock", id: "unlock" },
  { key: "sub", label: "Subscription", id: "subscription" },
  { key: "qa", label: "Dispatch", id: "dispatch" },
];

function hasFeature(v: string | boolean): boolean {
  if (typeof v === "boolean") return v;
  const s = v.trim().toLowerCase();
  return s !== "no" && s !== "n/a" && s !== "—" && s !== "";
}

function CompareTable({ onChoose }: { onChoose: (plan: CheckoutPlanId) => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (label: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });

  const activeRows = selected.size > 0 ? COMPARE.filter((r) => selected.has(r.label)) : COMPARE;

  // Score each plan by how many of the *selected* features it satisfies.
  const scores = PLAN_META.map((p) => {
    const basis = selected.size > 0 ? activeRows : COMPARE;
    const score = basis.reduce((n, row) => n + (hasFeature(row[p.key]) ? 1 : 0), 0);
    return { ...p, score };
  });
  const maxScore = Math.max(...scores.map((s) => s.score));
  const bestKey: PlanKey =
    selected.size === 0
      ? "sub"
      : (scores.find((s) => s.score === maxScore)?.key ?? "sub");

  return (
    <div className="space-y-4">
      {/* Filter chips */}
      <div className="flex flex-col gap-3 rounded-3xl border border-border/60 bg-surface/40 p-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <Filter className="h-3.5 w-3.5 text-primary" />
          Filter by what matters
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {COMPARE.map((row) => {
            const active = selected.has(row.label);
            return (
              <button
                key={row.label}
                type="button"
                onClick={() => toggle(row.label)}
                aria-pressed={active}
                className={
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition " +
                  (active
                    ? "border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/30"
                    : "border-border/60 bg-background/40 text-muted-foreground hover:border-foreground/40 hover:text-foreground")
                }
              >
                {active && <Check className="h-3 w-3" strokeWidth={3} />}
                {row.label}
              </button>
            );
          })}
          {selected.size > 0 && (
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-xs text-muted-foreground transition hover:text-foreground"
            >
              <X className="h-3 w-3" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-3xl border border-border/60 bg-surface/40 backdrop-blur">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-4 border-b border-border/60 bg-background/30 text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:text-xs">
            <div className="px-3 pt-7 pb-4 sm:px-5 flex items-end font-semibold">
              {selected.size > 0 ? `${activeRows.length} feature${activeRows.length === 1 ? "" : "s"}` : "Compare"}
            </div>
            {PLAN_META.map((p) => {
              const isBest = p.key === bestKey;
              const s = scores.find((x) => x.key === p.key)!;
              return (
                <div
                  key={p.key}
                  className={
                    "relative px-3 pt-7 pb-4 text-center transition sm:px-5 " +
                    (isBest ? "bg-primary/10 text-primary" : "")
                  }
                >
                  {isBest && (
                    <span className="absolute top-2 left-1/2 -translate-x-1/2 rounded-full bg-primary px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-primary-foreground shadow-md shadow-primary/30">
                      Best match
                    </span>
                  )}
                  <div className="flex items-center justify-center gap-1.5 font-bold">
                    {isBest && <Trophy className="h-3.5 w-3.5" />}
                    <span>{p.label}</span>
                  </div>
                  <div className="mt-1 text-[10px] normal-case tracking-normal opacity-70">
                    {s.score}/{selected.size > 0 ? activeRows.length : COMPARE.length} features
                  </div>
                </div>
              );
            })}
          </div>

        {activeRows.map((row, i) => (
          <div
            key={row.label}
            className={
              "grid grid-cols-4 items-center text-sm transition " +
              (i % 2 ? "bg-background/20" : "bg-transparent")
            }
          >
            <div className="px-3 py-4 text-sm text-muted-foreground sm:px-5">{row.label}</div>
            <Cell v={row.unlock} highlight={bestKey === "unlock"} />
            <Cell v={row.sub} highlight={bestKey === "sub"} />
            <Cell v={row.qa} highlight={bestKey === "qa"} />
          </div>
        ))}

        {/* Footer CTAs */}
        <div className="grid grid-cols-4 items-center border-t border-border/60 bg-background/30">
          <div className="px-3 py-4 text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:px-5 sm:text-xs">
            Pick one
          </div>
          {PLAN_META.map((p) => {
            const isBest = p.key === bestKey;
            return (
              <div key={p.key} className={"px-2 py-3 sm:px-3 " + (isBest ? "bg-primary/[0.06]" : "")}>
                <button
                  type="button"
                  onClick={() => onChoose(p.id)}
                  className={
                    "inline-flex w-full items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium transition " +
                    (isBest
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/25 hover:opacity-90"
                      : "border border-border/70 bg-background hover:border-foreground/40 hover:bg-foreground/5")
                  }
                >
                  Choose <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
       </div>
      </div>
    </div>
  );
}

const COMPARE: { label: string; unlock: string | boolean; sub: string | boolean; qa: string | boolean }[] = [
  { label: "Access to a single post", unlock: true, sub: true, qa: false },
  { label: "Full creator library", unlock: false, sub: true, qa: false },
  { label: "Direct messaging", unlock: false, sub: true, qa: true },
  { label: "Personal answer from creator", unlock: false, sub: false, qa: true },
  { label: "Recurring charge", unlock: "No", sub: "Monthly", qa: "No" },
  { label: "Refund if unanswered", unlock: "N/A", sub: "N/A", qa: "48 hours" },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "Do I need a subscription to unlock a single post?",
    a: "No. Every premium post can be bought as a one-off unlock. Subscriptions just include everything a creator posts while you're subscribed.",
  },
  {
    q: "What happens if a creator doesn't answer my Q&A?",
    a: "Your $300 is held, not paid out. If the creator doesn't respond within 48 hours the dispatch expires and you're automatically refunded.",
  },
  {
    q: "Can I cancel a subscription anytime?",
    a: "Yes. Cancel from your Library or the creator's profile. You keep access until the end of the current billing period.",
  },
  {
    q: "How do creators get paid?",
    a: "Earnings settle to your creator balance and pay out on a weekly cadence once you clear the minimum payout threshold.",
  },
  {
    q: "Are prices the same for every creator?",
    a: "No — creators set their own subscription price and per-post unlock price. Q&A dispatches are a flat $300 across the platform.",
  },
];