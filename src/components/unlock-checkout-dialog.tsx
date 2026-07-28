import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
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
import { getUserWalletBalance } from "@/lib/wallet-functions";

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
  const [durationMonths, setDurationMonths] = useState(1);
  const [provider, setProvider] = useState<CheckoutProvider>("wallet");
  const [bankInstructions, setBankInstructions] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const getWallet = useServerFn(getUserWalletBalance);
  const getGateways = useServerFn(listCheckoutGateways);
  const beginCheckout = useServerFn(createCheckoutOrder);

  const walletQuery = useQuery({
    queryKey: ["user-wallet"],
    queryFn: () => getWallet(),
    enabled: open,
  });
  const gatewayQuery = useQuery({
    queryKey: ["checkout-gateways"],
    queryFn: () => getGateways(),
    enabled: open,
    staleTime: 60_000,
  });

  const methods = useMemo(
    () => [
      { provider: "wallet" as const, displayName: "LEER Wallet", mode: "live" as const },
      ...(gatewayQuery.data ?? []),
    ],
    [gatewayQuery.data],
  );

  useEffect(() => {
    if (!methods.some((method) => method.provider === provider)) {
      setProvider(methods[0]?.provider ?? "wallet");
    }
  }, [methods, provider]);

  const total = Math.round(subscriptionPrice * durationMonths * 100) / 100;
  const walletBalance = walletQuery.data?.balance ?? 0;
  const walletInsufficient = provider === "wallet" && walletBalance < total;

  const checkout = useMutation({
    mutationFn: () =>
      beginCheckout({
        data: {
          kind: "subscription",
          provider,
          trainerId,
          durationMonths,
        },
      }),
    onSuccess: (result) => {
      if (result.status === "redirect" && result.redirectUrl) {
        window.location.assign(result.redirectUrl);
        return;
      }
      if (result.status === "pending") {
        setBankInstructions(result.instructions);
        toast.success("Bank transfer order created.");
        return;
      }
      toast.success(`Full access to ${creatorName} is active.`);
      queryClient.invalidateQueries({ queryKey: ["subscription-info", trainerId] });
      queryClient.invalidateQueries({ queryKey: ["premium-urls", trainerId] });
      queryClient.invalidateQueries({ queryKey: ["follow-counts", trainerId] });
      queryClient.invalidateQueries({ queryKey: ["user-wallet"] });
      setOpen(false);
    },
    onError: (error: Error) => toast.error(error.message),
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
        if (!next) setBankInstructions(null);
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
            Premium posts, private coaching, and future subscriber content
            {creatorUsername ? ` from @${creatorUsername}` : ""}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2">
          {[1, 3, 12].map((months) => (
            <button
              key={months}
              type="button"
              onClick={() => setDurationMonths(months)}
              className={`rounded-xl border p-3 text-sm font-semibold ${
                durationMonths === months
                  ? "border-primary bg-primary/10 text-white"
                  : "border-neutral-800 text-neutral-400"
              }`}
            >
              {months} {months === 1 ? "month" : "months"}
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
          <div className="flex items-end justify-between">
            <span className="text-sm text-neutral-400">Total due now</span>
            <span className="font-display text-3xl">${total.toFixed(2)}</span>
          </div>
          <div className="mt-4 grid gap-2">
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
                      : "border-neutral-800 hover:border-neutral-600"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Icon className="h-5 w-5" />
                    <span>
                      <span className="block text-sm font-semibold">{method.displayName}</span>
                      <span className="block text-[11px] text-neutral-500">
                        {method.provider === "wallet"
                          ? `${walletBalance.toFixed(2)} ${walletQuery.data?.currency ?? "USD"} available`
                          : `${method.mode} gateway`}
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
        </div>

        {walletInsufficient && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
            Insufficient wallet balance.{" "}
            <Link to="/wallet" className="font-semibold underline">
              Add verified funds
            </Link>
          </div>
        )}
        {bankInstructions && (
          <pre className="whitespace-pre-wrap rounded-xl border border-sky-500/30 bg-sky-500/10 p-4 text-xs text-sky-100">
            {bankInstructions}
          </pre>
        )}

        <div className="grid gap-2 text-xs text-neutral-400">
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            Provider-confirmed payment; access is never granted on an unverified charge.
          </span>
          <span className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-sky-400" />
            {dmsEnabled
              ? "Subscriber messaging enabled."
              : "Messaging is disabled by this trainer."}
          </span>
        </div>

        <Button
          className="w-full"
          size="lg"
          disabled={checkout.isPending || walletInsufficient || !!bankInstructions}
          onClick={() => checkout.mutate()}
        >
          {checkout.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Lock className="mr-2 h-4 w-4" />
          )}
          {provider === "bank" ? "Create bank transfer" : `Pay ${total.toFixed(2)} USD`}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
