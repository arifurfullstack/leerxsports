import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { confirmPaymentReturn } from "@/lib/checkout-functions";
import { Button } from "@/components/ui/button";

type PaymentSearch = {
  order?: string;
  session_id?: string;
  token?: string;
  cancelled?: string;
};

export const Route = createFileRoute("/payment/complete")({
  validateSearch: (search: Record<string, unknown>): PaymentSearch => ({
    order: typeof search.order === "string" ? search.order : undefined,
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
    token: typeof search.token === "string" ? search.token : undefined,
    cancelled: typeof search.cancelled === "string" ? search.cancelled : undefined,
  }),
  head: () => ({ meta: [{ title: "Payment status | LEER" }] }),
  component: PaymentCompletePage,
});

function PaymentCompletePage() {
  const search = Route.useSearch();
  const confirm = useServerFn(confirmPaymentReturn);
  const [state, setState] = useState<"checking" | "success" | "cancelled" | "error">(
    search.cancelled === "1" ? "cancelled" : "checking",
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (search.cancelled === "1") return;
    const reference = search.session_id ?? search.token;
    if (!search.order || !reference) {
      setState("error");
      setMessage("The payment return link is incomplete.");
      return;
    }
    let active = true;
    confirm({
      data: {
        orderId: search.order,
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
  }, [confirm, search.cancelled, search.order, search.session_id, search.token]);

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl items-center px-4 py-16">
      <section className="w-full rounded-3xl border border-border bg-card p-8 text-center shadow-2xl">
        {state === "checking" && (
          <>
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
            <h1 className="mt-5 font-display text-3xl uppercase tracking-tight">
              Verifying payment
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Keep this page open while the provider confirms your order.
            </p>
          </>
        )}
        {state === "success" && (
          <>
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
            <h1 className="mt-5 font-display text-3xl uppercase tracking-tight">
              Payment complete
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Your access and balances have been updated.
            </p>
          </>
        )}
        {state === "cancelled" && (
          <>
            <XCircle className="mx-auto h-12 w-12 text-amber-500" />
            <h1 className="mt-5 font-display text-3xl uppercase tracking-tight">
              Payment cancelled
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Nothing was charged. You can return and choose another method.
            </p>
          </>
        )}
        {state === "error" && (
          <>
            <XCircle className="mx-auto h-12 w-12 text-destructive" />
            <h1 className="mt-5 font-display text-3xl uppercase tracking-tight">
              Verification failed
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {message || "We could not verify this payment."}
            </p>
          </>
        )}
        {state !== "checking" && (
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link to="/library">Open library</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/trainers">Browse trainers</Link>
            </Button>
          </div>
        )}
      </section>
    </main>
  );
}
