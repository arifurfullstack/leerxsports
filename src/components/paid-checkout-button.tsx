import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Building2, CheckCircle2, CreditCard, Loader2, Wallet, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  createCheckoutOrder,
  listCheckoutGateways,
  type CheckoutProvider,
} from "@/lib/checkout-functions";
import { StripeEmbeddedCheckout } from "@/components/stripe-embedded-checkout";

type PaidCheckoutButtonProps = {
  kind: "unlock" | "tip" | "wallet_topup";
  amount: number;
  trainerId?: string;
  postId?: string;
  threadId?: string;
  message?: string;
  label: React.ReactNode;
  title: string;
  description: string;
  disabled?: boolean;
  className?: string;
  onPaid?: () => void;
};

const providerIcon = {
  wallet: Wallet,
  stripe: CreditCard,
  paypal: CreditCard,
  bank: Building2,
} satisfies Record<CheckoutProvider, typeof Wallet>;

export function PaidCheckoutButton({
  kind,
  amount,
  trainerId,
  postId,
  threadId,
  message,
  label,
  title,
  description,
  disabled,
  className,
  onPaid,
}: PaidCheckoutButtonProps) {
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<CheckoutProvider>("stripe");
  const [instructions, setInstructions] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [stripeSession, setStripeSession] = useState<{ clientSecret: string; publishableKey?: string | null } | null>(null);
  const queryClient = useQueryClient();
  const getGateways = useServerFn(listCheckoutGateways);
  const beginCheckout = useServerFn(createCheckoutOrder);

  const gateways = useQuery({
    queryKey: ["checkout-gateways"],
    queryFn: () => getGateways(),
    enabled: open,
    staleTime: 60_000,
  });
  // Wallet removed from MVP — only external gateways are available
  const methods = useMemo(() => gateways.data ?? [], [gateways.data]);

  // Auto-select: when only one gateway exists, pick it automatically
  useEffect(() => {
    if (methods.length === 1) {
      setProvider(methods[0].provider);
    } else if (!methods.some((method) => method.provider === provider)) {
      setProvider(methods[0]?.provider ?? "stripe");
    }
  }, [methods, provider]);

  // Auto-checkout: when only one gateway is available, start checkout immediately
  const autoCheckoutTriggered = useState(false);
  useEffect(() => {
    if (
      open &&
      methods.length === 1 &&
      !autoCheckoutTriggered[0] &&
      !stripeSession &&
      !instructions &&
      !checkout.isPending &&
      !isRedirecting
    ) {
      autoCheckoutTriggered[1](true);
      checkout.mutate();
    }
    if (!open) {
      autoCheckoutTriggered[1](false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, methods.length]);

  const handlePaidSuccess = () => {
    toast.success(kind === "wallet_topup" ? "Wallet funded." : "Payment complete.");
    setOpen(false);
    setStripeSession(null);
    onPaid?.();
  };

  const checkout = useMutation({
    mutationFn: () =>
      beginCheckout({
        data: {
          kind,
          provider,
          amount,
          trainerId,
          postId,
          threadId,
          message,
        },
      }),
    onSuccess: (result) => {
      if (result.status === "embedded" && result.clientSecret) {
        setStripeSession({
          clientSecret: result.clientSecret,
          publishableKey: result.publishableKey,
        });
        return;
      }
      if (result.status === "redirect" && result.redirectUrl) {
        setIsRedirecting(true);
        window.location.assign(result.redirectUrl);
        return;
      }
      if (result.status === "pending") {
        setInstructions(result.instructions);
        toast.success("Bank transfer order created.");
        return;
      }
      handlePaidSuccess();
    },
    onError: (error: Error) => {
      setIsRedirecting(false);
      toast.error(error.message);
    },
  });

  // Determine the current view
  const isCheckoutView = !!stripeSession;
  const isGatewaySelection = !isCheckoutView && !checkout.isPending && methods.length > 1;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setInstructions(null);
          setIsRedirecting(false);
          setStripeSession(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" disabled={disabled} className={className}>
          {label}
        </Button>
      </DialogTrigger>

      {/* Wider dialog when Stripe embedded checkout is active; standard width for gateway picker */}
      <DialogContent className={`${isCheckoutView ? "sm:max-w-xl" : "sm:max-w-md"} max-h-[90vh] overflow-y-auto`}>
        <DialogHeader>
          <DialogTitle>{isCheckoutView ? "Secure Checkout" : title}</DialogTitle>
          <DialogDescription>
            {isCheckoutView
              ? "Complete your payment securely via Stripe."
              : description}
          </DialogDescription>
        </DialogHeader>

        {/* ── Stripe Embedded Checkout (clean, full-width single view) ── */}
        {isCheckoutView ? (
          <div className="space-y-3">
            <div className="rounded-xl border bg-muted/30 p-3">
              <div className="flex items-end justify-between">
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  Secure payment
                </span>
                <span className="font-display text-2xl">${amount.toFixed(2)} USD</span>
              </div>
            </div>
            <StripeEmbeddedCheckout
              clientSecret={stripeSession.clientSecret}
              publishableKey={stripeSession.publishableKey}
              onComplete={handlePaidSuccess}
            />
            {methods.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs text-muted-foreground"
                onClick={() => setStripeSession(null)}
              >
                ← Choose different payment method
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* ── Amount display ── */}
            <div className="rounded-xl border bg-muted/30 p-4">
              <div className="flex items-end justify-between">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="font-display text-3xl">${amount.toFixed(2)} USD</span>
              </div>
            </div>

            {/* ── Gateway picker (only shown when multiple gateways are available) ── */}
            {methods.length > 1 && (
              <div className="grid gap-2">
                {methods.map((method) => {
                  const Icon = providerIcon[method.provider];
                  return (
                    <button
                      key={method.provider}
                      type="button"
                      onClick={() => setProvider(method.provider)}
                      className={`flex items-center justify-between rounded-xl border p-3 text-left ${
                        provider === method.provider
                          ? "border-primary bg-primary/10"
                          : "hover:border-primary/40"
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <Icon className="h-5 w-5" />
                        <span>
                          <span className="block text-sm font-medium">{method.displayName}</span>
                          <span className="block text-xs text-muted-foreground">
                            {`${method.mode} gateway`}
                          </span>
                        </span>
                      </span>
                      {provider === method.provider && <CheckCircle2 className="h-5 w-5 text-primary" />}
                    </button>
                  );
                })}
              </div>
            )}

            {/* ── Single-gateway auto-checkout loading ── */}
            {methods.length <= 1 && (checkout.isPending || gateways.isLoading) && (
              <div className="flex flex-col items-center gap-3 py-6">
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Preparing secure checkout…</p>
              </div>
            )}

            {/* ── No gateways warning ── */}
            {!gateways.isLoading && methods.length === 0 && (
              <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm">
                No payment gateway is enabled. Ask an administrator to enable one.
              </p>
            )}

            {/* ── Bank instructions ── */}
            {instructions && (
              <pre className="whitespace-pre-wrap rounded-xl border border-sky-500/30 bg-sky-500/10 p-3 text-xs">
                {instructions}
              </pre>
            )}

            {/* ── Pay button (only when multiple gateways require selection) ── */}
            {methods.length > 1 && (
              <Button
                onClick={() => checkout.mutate()}
                disabled={
                  checkout.isPending || isRedirecting || methods.length === 0 || !!instructions
                }
              >
                {checkout.isPending || isRedirecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isRedirecting ? "Connecting to payment gateway…" : "Preparing checkout…"}
                  </>
                ) : (
                  provider === "bank" ? "Create transfer order" : `Pay $${amount.toFixed(2)}`
                )}
              </Button>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
