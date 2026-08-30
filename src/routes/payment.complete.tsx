import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, XCircle, ArrowRight, Home, Compass, BookOpen } from "lucide-react";
import { confirmPaymentReturn } from "@/lib/checkout-functions";
import { Button } from "@/components/ui/button";

type PaymentSearch = {
  order?: string;
  order_id?: string;
  session_id?: string;
  token?: string;
  cancelled?: string;
};

export const Route = createFileRoute("/payment/complete")({
  validateSearch: (search: Record<string, unknown>): PaymentSearch => ({
    order: search.order != null ? String(search.order) : undefined,
    order_id: search.order_id != null ? String(search.order_id) : undefined,
    session_id: search.session_id != null ? String(search.session_id) : undefined,
    token: search.token != null ? String(search.token) : undefined,
    cancelled: search.cancelled != null ? String(search.cancelled) : undefined,
  }),
  head: () => ({ meta: [{ title: "Payment Status | LEER" }] }),
  component: PaymentCompletePage,
});

function PaymentCompletePage() {
  const search = Route.useSearch();
  const confirm = useServerFn(confirmPaymentReturn);
  const isCancelled = search.cancelled === "1" || search.cancelled === "true";
  const [state, setState] = useState<"checking" | "success" | "cancelled" | "error">(
    isCancelled ? "cancelled" : "checking",
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (isCancelled) {
      setState("cancelled");
      return;
    }
    const reference = search.session_id ?? search.token;
    const orderId = search.order ?? search.order_id;
    if (!orderId || !reference) {
      setState("error");
      setMessage("The payment return link is missing session parameters.");
      return;
    }
    let active = true;
    confirm({
      data: {
        orderId,
        providerReference: reference,
      },
    })
      .then(() => {
        if (active) setState("success");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setState("error");
        setMessage(error instanceof Error ? error.message : "Payment verification failed.");
      });
    return () => {
      active = false;
    };
  }, [confirm, search.cancelled, search.order, search.order_id, search.session_id, search.token]);

  return (
    <main className="mx-auto flex min-h-[75vh] max-w-lg items-center px-4 py-16">
      <section className="w-full rounded-3xl border border-border/80 bg-card/90 p-8 text-center shadow-2xl backdrop-blur">
        {state === "checking" && (
          <div className="space-y-4">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
            <h1 className="font-display text-2xl uppercase tracking-tight sm:text-3xl">
              Verifying Payment
            </h1>
            <p className="text-sm text-muted-foreground">
              Please wait while Stripe confirms your payment transaction…
            </p>
          </div>
        )}

        {state === "success" && (
          <div className="space-y-4">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/30">
              <CheckCircle2 className="h-9 w-9" />
            </div>
            <h1 className="font-display text-2xl uppercase tracking-tight text-foreground sm:text-3xl">
              Payment Confirmed
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your transaction has been processed successfully. Your access, subscriber badges, and premium unlocks are now active.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button asChild className="rounded-xl px-5">
                <Link to="/home">
                  <Home className="mr-2 h-4 w-4" /> Go to Feed
                </Link>
              </Button>
              <Button variant="outline" asChild className="rounded-xl px-5">
                <Link to="/library">
                  <BookOpen className="mr-2 h-4 w-4" /> View Library
                </Link>
              </Button>
            </div>
          </div>
        )}

        {state === "cancelled" && (
          <div className="space-y-4">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/30">
              <XCircle className="h-9 w-9" />
            </div>
            <h1 className="font-display text-2xl uppercase tracking-tight sm:text-3xl">
              Payment Cancelled
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              No charge was made to your card. You can retry checkout at any time.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button asChild className="rounded-xl px-5">
                <Link to="/home">
                  <Home className="mr-2 h-4 w-4" /> Return to Feed
                </Link>
              </Button>
              <Button variant="outline" asChild className="rounded-xl px-5">
                <Link to="/explore">
                  <Compass className="mr-2 h-4 w-4" /> Explore Trainers
                </Link>
              </Button>
            </div>
          </div>
        )}

        {state === "error" && (
          <div className="space-y-4">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-destructive/10 text-destructive ring-1 ring-destructive/30">
              <XCircle className="h-9 w-9" />
            </div>
            <h1 className="font-display text-2xl uppercase tracking-tight text-destructive sm:text-3xl">
              Verification Issue
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {message || "We were unable to confirm this payment session. If your account was charged, please contact support."}
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button asChild variant="outline" className="rounded-xl px-5">
                <Link to="/home">
                  <Home className="mr-2 h-4 w-4" /> Return to Feed
                </Link>
              </Button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
