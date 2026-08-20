import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Building2, CheckCircle2, CreditCard, Loader2, Wallet } from "lucide-react";
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

  useEffect(() => {
    if (!methods.some((method) => method.provider === provider)) {
      setProvider(methods[0]?.provider ?? "stripe");
    }
  }, [methods, provider]);

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

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setInstructions(null);
          setIsRedirecting(false);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" disabled={disabled} className={className}>
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {stripeSession ? (
          <div className="space-y-4">
            <StripeEmbeddedCheckout
              clientSecret={stripeSession.clientSecret}
              publishableKey={stripeSession.publishableKey}
              onComplete={handlePaidSuccess}
            />
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground"
              onClick={() => setStripeSession(null)}
            >
              Choose different payment method
            </Button>
          </div>
        ) : (
          <>
            <div className="rounded-xl border bg-muted/30 p-4">
              <div className="flex items-end justify-between">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="font-display text-3xl">${amount.toFixed(2)} USD</span>
              </div>
            </div>
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
              {!gateways.isLoading && methods.length === 0 && (
                <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm">
                  No payment gateway is enabled. Ask an administrator to enable one.
                </p>
              )}
            </div>
            {instructions && (
              <pre className="whitespace-pre-wrap rounded-xl border border-sky-500/30 bg-sky-500/10 p-3 text-xs">
                {instructions}
              </pre>
            )}
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
