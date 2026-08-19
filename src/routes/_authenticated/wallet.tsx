import { createFileRoute, Link } from "@tanstack/react-router";
import { CreditCard, ShieldCheck, ArrowRight, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/wallet")({
  head: () => ({ meta: [{ title: "Wallet (Disabled) | LEER" }] }),
  component: WalletPage,
});

function WalletPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-primary/10 text-primary mb-6 shadow-inner">
        <CreditCard className="h-8 w-8" />
      </div>

      <p className="font-display text-xs uppercase tracking-[0.3em] text-primary">
        Payment System Notice
      </p>
      <h1 className="mt-2 font-display text-3xl sm:text-4xl uppercase tracking-tight">
        Direct Card Checkout Active
      </h1>
      <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
        LEER Wallet has been deactivated in this release. All subscriptions, premium content unlocks,
        coaching tips, and paid Q&A sessions are now processed directly and securely via Credit / Debit Card (Stripe).
      </p>

      <div className="mt-8 rounded-2xl border border-border/80 bg-card p-6 text-left space-y-3">
        <div className="flex items-center gap-3 text-sm font-semibold">
          <ShieldCheck className="h-5 w-5 text-emerald-500" />
          <span>Seamless Checkout</span>
        </div>
        <p className="text-xs text-muted-foreground">
          You no longer need to pre-fund a wallet balance. Simply click Subscribe, Unlock, Tip, or Ask on any trainer profile to checkout instantly.
        </p>
      </div>

      <div className="mt-8 flex justify-center gap-4">
        <Button asChild className="rounded-xl px-6">
          <Link to="/home">
            <Home className="mr-2 h-4 w-4" /> Return to Feed
          </Link>
        </Button>
        <Button asChild variant="outline" className="rounded-xl px-6">
          <Link to="/explore">
            Explore Trainers <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </main>
  );
}

