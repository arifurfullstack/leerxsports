import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Building2,
  CheckCircle2,
  CreditCard,
  Loader2,
  Lock,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
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

type UnlockCheckoutDialogProps = {
  trainerId: string;
  creatorName: string;
  creatorUsername?: string;
  avatarUrl?: string;
  isVerified?: boolean;
  subscriptionPrice: number;
  monetizationEnabled: boolean;
  hasEnoughPublicPosts: boolean;
  publicFeedCount: number;
  minPublicPostsRequired: number;
  isSubscribed?: boolean;
  dmsEnabled?: boolean;
  triggerClassName?: string;
  triggerSize?: "default" | "sm" | "lg" | "icon";
  triggerVariant?: "default" | "outline" | "secondary" | "ghost";
  triggerLabel?: React.ReactNode;
};

const providerIcon = {
  wallet: Wallet,
  stripe: CreditCard,
  paypal: CreditCard,
  bank: Building2,
} satisfies Record<CheckoutProvider, typeof Wallet>;

export function UnlockCheckoutDialog({
  trainerId,
  creatorName,
  creatorUsername,
  avatarUrl,
  isVerified,
  subscriptionPrice,
  monetizationEnabled,
  hasEnoughPublicPosts,
  publicFeedCount,
  minPublicPostsRequired,
  isSubscribed,
  dmsEnabled = true,
  triggerClassName,
  triggerSize = "default",
  triggerVariant = "default",
  triggerLabel,
}: UnlockCheckoutDialogProps) {
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<CheckoutProvider>("stripe");
  const [bankInstructions, setBankInstructions] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const queryClient = useQueryClient();
  const getGateways = useServerFn(listCheckoutGateways);
  const beginCheckout = useServerFn(createCheckoutOrder);

  const gatewayQuery = useQuery({
    queryKey: ["checkout-gateways"],
    queryFn: () => getGateways(),
    enabled: open,
    staleTime: 60_000,
  });

  const methods = useMemo(
    () => gatewayQuery.data ?? [],
    [gatewayQuery.data],
  );

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
      !bankInstructions &&
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

  const total = Math.round(subscriptionPrice * 100) / 100;

  const handleCheckoutSuccess = () => {
    toast.success(`Full access to ${creatorName} is active.`);
    queryClient.invalidateQueries({ queryKey: ["subscription-info", trainerId] });
    queryClient.invalidateQueries({ queryKey: ["premium-urls", trainerId] });
    queryClient.invalidateQueries({ queryKey: ["follow-counts", trainerId] });
    setOpen(false);
  };

  const checkout = useMutation({
    mutationFn: () =>
      beginCheckout({
        data: {
          kind: "subscription",
          provider,
          trainerId,
          durationMonths: 1,
        },
      }),
    onSuccess: (result) => {
      if (result.status === "redirect" && result.redirectUrl) {
        setIsRedirecting(true);
        window.location.assign(result.redirectUrl);
        return;
      }
      if (result.status === "pending") {
        setBankInstructions(result.instructions);
        toast.success("Bank transfer order created.");
        return;
      }
      handleCheckoutSuccess();
    },
    onError: (error: Error) => {
      setIsRedirecting(false);
      toast.error(error.message);
    },
  });

  if (isSubscribed) {
    return (
      <Button
        size={triggerSize}
        variant="outline"
        className={
          triggerClassName ??
          "rounded-xl border-neutral-700 bg-neutral-900/90 px-4 font-semibold text-white"
        }
      >
        <Sparkles className="mr-2 h-4 w-4 text-amber-400" />
        Subscribed
      </Button>
    );
  }
  if (!monetizationEnabled) return null;

  const handleOpenCheck = (event: React.MouseEvent) => {
    if (hasEnoughPublicPosts) return;
    event.preventDefault();
    toast.info(
      `${creatorName} needs ${minPublicPostsRequired} public posts before accepting subscribers (${publicFeedCount}/${minPublicPostsRequired}).`,
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setBankInstructions(null);
          setIsRedirecting(false);
        }
      }}
    >
      <DialogTrigger asChild onClick={handleOpenCheck}>
        <Button
          size={triggerSize}
          variant={triggerVariant}
          className={
            triggerClassName ??
            "group rounded-xl border border-neutral-700 bg-neutral-900/90 px-4 font-bold uppercase tracking-wider text-white hover:border-white/60 hover:bg-neutral-800"
          }
        >
          {triggerLabel ?? (
            <>
              <Lock className="mr-2 h-4 w-4" />
              Unlock · ${subscriptionPrice.toFixed(2)}/mo
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-neutral-800 bg-neutral-950 text-white sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 font-display text-2xl uppercase">
            <span className="relative h-12 w-12 overflow-hidden rounded-full border border-white/20 bg-neutral-900">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="grid h-full place-items-center text-lg">
                  {creatorName.slice(0, 1).toUpperCase()}
                </span>
              )}
            </span>
            <span>
              Unlock {creatorName}
              {isVerified && <CheckCircle2 className="ml-2 inline h-5 w-5 text-sky-400" />}
            </span>
          </DialogTitle>
          <DialogDescription className="text-neutral-400">
            Premium feed, exclusive shorts, and direct subscriber access
            {creatorUsername ? ` from @${creatorUsername}` : ""}.
          </DialogDescription>
        </DialogHeader>

        {/* Pricing Plan Card */}
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
          <div className="flex items-end justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Monthly Subscription
              </span>
              <p className="mt-0.5 text-xs text-neutral-400">Auto-renews monthly · Cancel anytime</p>
            </div>
            <div className="text-right">
              <span className="font-display text-3xl font-bold">${total.toFixed(2)}</span>
              <span className="text-xs text-neutral-400">/mo</span>
            </div>
          </div>
          {methods.length > 1 && (
            <div className="mt-4 grid gap-2">
              {methods.map((method) => {
                const Icon = providerIcon[method.provider];
                return (
                  <button
                    key={method.provider}
                    type="button"
                    onClick={() => setProvider(method.provider)}
                    className={`flex items-center justify-between rounded-xl border p-3 text-left transition-all ${
                      provider === method.provider
                        ? "border-primary bg-primary/10"
                        : "border-neutral-800 hover:border-neutral-600"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <Icon className="h-5 w-5 text-primary" />
                      <span>
                        <span className="block text-sm font-semibold">{method.displayName}</span>
                        <span className="block text-[11px] text-neutral-500">
                          {`${method.mode} gateway`}
                        </span>
                      </span>
                    </span>
                    {provider === method.provider && (
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Single-gateway auto-checkout loading */}
          {methods.length <= 1 && (checkout.isPending || gatewayQuery.isLoading) && (
            <div className="mt-4 flex flex-col items-center gap-3 py-4">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
              <p className="text-sm text-neutral-400">Preparing secure checkout…</p>
            </div>
          )}

          {/* Redirecting indicator */}
          {isRedirecting && (
            <div className="mt-4 flex flex-col items-center gap-3 py-4">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
              <div className="flex items-center gap-1.5 text-sm text-neutral-400">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                Connecting to secure payment gateway…
              </div>
            </div>
          )}
        </div>

        {bankInstructions && (
          <pre className="whitespace-pre-wrap rounded-xl border border-sky-500/30 bg-sky-500/10 p-4 text-xs text-sky-100">
            {bankInstructions}
          </pre>
        )}

        <div className="grid gap-2 text-xs text-neutral-400">
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            Encrypted checkout. Access is activated immediately upon successful payment.
          </span>
          <span className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-sky-400" />
            {dmsEnabled
              ? "Subscriber direct messaging enabled."
              : "Messaging is disabled by this trainer."}
          </span>
        </div>

        {methods.length > 1 && (
          <Button
            className="w-full font-bold uppercase tracking-wider text-xs h-12"
            size="lg"
            disabled={checkout.isPending || isRedirecting || !!bankInstructions || methods.length === 0}
            onClick={() => checkout.mutate()}
          >
            {checkout.isPending || isRedirecting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isRedirecting ? "Connecting to payment gateway…" : "Preparing checkout…"}
              </>
            ) : (
              <>
                <Lock className="mr-2 h-4 w-4" />
                {provider === "bank" ? "Create Bank Transfer Order" : `Subscribe for $${total.toFixed(2)}/mo`}
              </>
            )}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
