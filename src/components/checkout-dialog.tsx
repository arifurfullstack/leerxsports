import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Check, CreditCard, ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { listCheckoutGateways } from "@/lib/checkout-functions";

export type CheckoutPlanId = "unlock" | "subscription" | "dispatch";

type PlanOption = {
  id: CheckoutPlanId;
  title: string;
  tagline: string;
  amount: number;
  cadence: string;
  features: string[];
};

const PLANS: PlanOption[] = [
  {
    id: "unlock",
    title: "Post Unlock",
    tagline: "Choose a premium post, then pay once for permanent access.",
    amount: 5,
    cadence: "typical starting price",
    features: ["Permanent library access", "Full-resolution media", "No recurring fee"],
  },
  {
    id: "subscription",
    title: "Creator Subscription",
    tagline: "Choose a trainer to unlock their complete premium experience.",
    amount: 19.99,
    cadence: "set by creator ($4.99–$499.99/mo)",
    features: ["Premium feed and shorts", "Subscriber coaching", "Cancel future renewal"],
  },
  {
    id: "dispatch",
    title: "Private Coaching",
    tagline: "Select a trainer before opening a subscriber-only coaching request.",
    amount: 300,
    cadence: "example premium service",
    features: ["Private media feedback", "One follow-up reply", "Completion and dispute tracking"],
  },
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
  assumptions,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  initialPlan?: CheckoutPlanId;
  billing?: Billing;
  assumptions?: CheckoutAssumptions;
}) {
  const [planId, setPlanId] = useState<CheckoutPlanId>(initialPlan);
  const listGateways = useServerFn(listCheckoutGateways);
  const gateways = useQuery({
    queryKey: ["checkout-gateways"],
    queryFn: () => listGateways(),
    enabled: open,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (open) setPlanId(initialPlan);
  }, [initialPlan, open]);

  const plan = useMemo(() => {
    const selected = PLANS.find((candidate) => candidate.id === planId)!;
    if (!assumptions) return selected;
    if (selected.id === "subscription") {
      return { ...selected, amount: assumptions.subPrice };
    }
    if (selected.id === "unlock") {
      return { ...selected, amount: assumptions.unlockPrice };
    }
    return selected;
  }, [assumptions, planId]);

  const destination = plan.id === "unlock" ? "/explore" : "/trainers";
  const action = plan.id === "unlock" ? "Choose premium content" : "Choose a trainer";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl uppercase tracking-tight">
            Start a verified checkout
          </DialogTitle>
          <DialogDescription>
            Price and entitlement are calculated from the trainer or post you select. No payment is
            created before a real product is chosen.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 sm:grid-cols-3">
          {PLANS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setPlanId(option.id)}
              className={`rounded-xl border p-4 text-left ${
                planId === option.id ? "border-primary bg-primary/10" : "hover:border-primary/40"
              }`}
            >
              <span className="block text-sm font-semibold">{option.title}</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {option.id === "subscription" ? "$4.99 – $499.99/mo" : `From $${option.amount.toFixed(2)}`}
              </span>
            </button>
          ))}
        </div>

        <section className="rounded-2xl border bg-muted/20 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="font-display text-2xl uppercase">{plan.title}</h3>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">{plan.tagline}</p>
            </div>
            <div className="text-right">
              <p className="font-display text-3xl">
                {plan.id === "subscription" && !assumptions ? "$4.99–$499.99" : `$${plan.amount.toFixed(2)}`}
              </p>
              <p className="text-xs text-muted-foreground">{plan.cadence}</p>
            </div>
          </div>
          <ul className="mt-5 grid gap-2 text-sm">
            {plan.features.map((feature) => (
              <li key={feature} className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-500" />
                {feature}
              </li>
            ))}
          </ul>
        </section>

        <div className="rounded-xl border p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CreditCard className="h-4 w-4 text-primary" />
            Payment methods synchronized with Admin
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Credit / Debit Card (Stripe)
            {(gateways.data ?? []).filter((g) => g.provider !== "stripe").map((gateway) => ` · ${gateway.displayName}`).join("")}
            {!gateways.isLoading && (gateways.data?.length ?? 0) === 0
              ? " · no external gateway currently enabled"
              : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            Access is granted immediately after secure provider confirmation.
          </span>
          <Button asChild onClick={() => onOpenChange(false)}>
            <Link to={destination}>
              {action}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
