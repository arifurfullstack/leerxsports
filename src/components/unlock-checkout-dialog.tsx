import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Lock,
  Loader2,
  Sparkles,
  CheckCircle2,
  MessageSquare,
  Video,
  HelpCircle,
  ShieldCheck,
  Wallet,
  CreditCard,
  Plus,
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
import { subscribeToTrainer } from "@/lib/subscription-functions";
import { getUserWalletBalance, topUpUserWallet } from "@/lib/wallet-functions";

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
  const [durationMonths, setDurationMonths] = useState<number>(1);
  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "payment_gateway">("wallet");

  const qc = useQueryClient();
  const subscribeFn = useServerFn(subscribeToTrainer);
  const getWalletFn = useServerFn(getUserWalletBalance);
  const topUpFn = useServerFn(topUpUserWallet);

  // Fetch live wallet balance
  const walletQuery = useQuery({
    queryKey: ["user-wallet"],
    queryFn: () => getWalletFn(),
    enabled: open,
  });

  const walletBalance = walletQuery.data?.balance ?? 150;

  // Top up mutation
  const topUpMut = useMutation({
    mutationFn: () => topUpFn({ data: { amount: 50 } }),
    onSuccess: (res) => {
      toast.success(`Added $50.00 to your wallet balance!`);
      qc.invalidateQueries({ queryKey: ["user-wallet"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Calculate pricing based on duration
  const discountMultiplier = durationMonths === 12 ? 0.8 : durationMonths === 3 ? 0.9 : 1.0;
  const pricePerMonth = subscriptionPrice * discountMultiplier;
  const totalPrice = Math.round(pricePerMonth * durationMonths * 100) / 100;

  const subMut = useMutation({
    mutationFn: () =>
      subscribeFn({
        data: {
          trainerId,
          paymentMethod,
          durationMonths,
        },
      }),
    onSuccess: () => {
      toast.success(`Unlocked full access to ${creatorName}!`);
      qc.invalidateQueries({ queryKey: ["subscription-info", trainerId] });
      qc.invalidateQueries({ queryKey: ["premium-urls", trainerId] });
      qc.invalidateQueries({ queryKey: ["follow-counts", trainerId] });
      qc.invalidateQueries({ queryKey: ["user-wallet"] });
      setOpen(false);
    },
    onError: (e: Error) => {
      toast.error(e.message);
    },
  });

  const formattedPrice = `$${subscriptionPrice.toFixed(2)}`;

  if (isSubscribed) {
    return (
      <Button
        size={triggerSize}
        variant="outline"
        className={
          triggerClassName ??
          "group rounded-xl border border-neutral-700 bg-neutral-900/90 px-4 font-semibold text-white transition-all duration-200 hover:border-neutral-500 hover:bg-neutral-800 shadow-xl"
        }
      >
        <Sparkles className="mr-2 h-4 w-4 text-amber-400" />
        Subscribed
      </Button>
    );
  }

  if (!monetizationEnabled) {
    return null;
  }

  const handleOpenCheck = (e: React.MouseEvent) => {
    if (!hasEnoughPublicPosts) {
      e.preventDefault();
      toast.info(
        `${creatorName} needs at least ${minPublicPostsRequired} public posts before accepting subscribers (${publicFeedCount}/${minPublicPostsRequired} uploaded).`
      );
    }
  };

  const isWalletInsufficient = paymentMethod === "wallet" && walletBalance < totalPrice;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild onClick={handleOpenCheck}>
        <Button
          size={triggerSize}
          variant={triggerVariant}
          className={
            triggerClassName ??
            "group rounded-xl border border-neutral-700 bg-neutral-900/90 px-4 font-bold uppercase tracking-wider text-white transition-all duration-200 ease-out hover:border-white/60 hover:bg-neutral-800 shadow-xl active:scale-95"
          }
          title={`Unlock full access for ${formattedPrice}/mo`}
        >
          {triggerLabel ?? (
            <>
              <Lock className="mr-2 h-4 w-4 text-neutral-300 transition-transform group-hover:scale-110 group-hover:text-white" />
              Unlock · {formattedPrice}/mo
            </>
          )}
        </Button>
      </DialogTrigger>

      <DialogContent className="border-neutral-800 bg-neutral-950 text-white sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-center sm:text-left">
          <DialogTitle className="flex items-center gap-3 font-display text-2xl uppercase tracking-tight text-white">
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-white/20 bg-neutral-900">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={creatorName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center font-display text-lg text-neutral-400">
                  {creatorName[0]?.toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span>Unlock {creatorName}</span>
                {isVerified && <ShieldCheck className="h-5 w-5 text-primary" />}
              </div>
              {creatorUsername && (
                <p className="text-xs font-normal text-neutral-400 lowercase">
                  @{creatorUsername}
                </p>
              )}
            </div>
          </DialogTitle>
          <DialogDescription className="text-neutral-400 pt-1">
            Get instant full access to all exclusive workout feed posts, video drills, and direct creator perks.
          </DialogDescription>
        </DialogHeader>

        {/* Duration Selection Options */}
        <div className="space-y-1.5 my-2">
          <label className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
            Select Pass Duration
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { months: 1, label: "1 Month", savings: null },
              { months: 3, label: "3 Months", savings: "10% OFF" },
              { months: 12, label: "1 Year", savings: "20% OFF" },
            ].map((opt) => (
              <button
                key={opt.months}
                type="button"
                onClick={() => setDurationMonths(opt.months)}
                className={`relative flex flex-col items-center justify-center rounded-xl border p-2.5 transition-all text-center ${
                  durationMonths === opt.months
                    ? "border-white bg-neutral-900 text-white ring-1 ring-white"
                    : "border-neutral-800 bg-neutral-900/40 text-neutral-400 hover:border-neutral-700 hover:text-white"
                }`}
              >
                {opt.savings && (
                  <span className="absolute -top-2 right-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">
                    {opt.savings}
                  </span>
                )}
                <span className="text-xs font-bold uppercase">{opt.label}</span>
                <span className="text-[11px] mt-0.5 font-mono text-neutral-300">
                  ${(subscriptionPrice * (opt.months === 12 ? 0.8 : opt.months === 3 ? 0.9 : 1.0)).toFixed(2)}/mo
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Pricing Summary Banner */}
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-3.5 text-center backdrop-blur-md">
          <div className="text-[11px] uppercase tracking-widest text-neutral-400 font-semibold">
            Total Charge ({durationMonths} {durationMonths === 1 ? "Month" : "Months"})
          </div>
          <div className="mt-0.5 font-display text-3xl text-white">
            ${totalPrice.toFixed(2)}
          </div>
          <div className="mt-0.5 text-[11px] text-neutral-400">
            Cancel anytime from your account settings.
          </div>
        </div>

        {/* Subscriber Perks Overview */}
        <div className="space-y-2 py-1">
          <div className="flex items-start gap-2.5 rounded-xl border border-neutral-800/60 bg-neutral-900/40 p-2.5">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            <div className="text-xs text-neutral-200">
              <span className="font-semibold text-white">Exclusive Content:</span> Unlock all blurred premium posts, workout logs, and breakdown videos.
            </div>
          </div>

          {dmsEnabled && (
            <div className="flex items-start gap-2.5 rounded-xl border border-neutral-800/60 bg-neutral-900/40 p-2.5">
              <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-white" />
              <div className="text-xs text-neutral-200">
                <span className="font-semibold text-white">Direct Messaging:</span> Send direct messages and chat 1-on-1 with {creatorName}.
              </div>
            </div>
          )}

          <div className="flex items-start gap-2.5 rounded-xl border border-neutral-800/60 bg-neutral-900/40 p-2.5">
            <Video className="mt-0.5 h-4 w-4 shrink-0 text-white" />
            <div className="text-xs text-neutral-200">
              <span className="font-semibold text-white">Exclusive Shorts & Drills:</span> Access subscriber-only athletic video technique shorts.
            </div>
          </div>

          <div className="flex items-start gap-2.5 rounded-xl border border-neutral-800/60 bg-neutral-900/40 p-2.5">
            <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <div className="text-xs text-neutral-200">
              <span className="font-semibold text-white">Priority Q&A:</span> Priority responses on direct Q&A dispatch requests.
            </div>
          </div>
        </div>

        {/* Payment Method Selection */}
        <div className="space-y-2 pt-1 border-t border-neutral-800">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
              Payment Method
            </label>
            <div className="flex items-center gap-1 text-xs text-neutral-300">
              <Wallet className="h-3.5 w-3.5 text-emerald-400" />
              <span>Balance: <strong className="text-white font-mono">${walletBalance.toFixed(2)}</strong></span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* Wallet Option */}
            <button
              type="button"
              onClick={() => setPaymentMethod("wallet")}
              className={`flex items-center gap-2.5 rounded-xl border p-3 text-left transition-all ${
                paymentMethod === "wallet"
                  ? "border-emerald-500/80 bg-emerald-950/30 text-white ring-1 ring-emerald-500/50"
                  : "border-neutral-800 bg-neutral-900/40 text-neutral-400 hover:border-neutral-700 hover:text-white"
              }`}
            >
              <Wallet className={`h-5 w-5 shrink-0 ${paymentMethod === "wallet" ? "text-emerald-400" : "text-neutral-400"}`} />
              <div>
                <div className="text-xs font-bold text-white">User Wallet</div>
                <div className="text-[10px] text-neutral-400">
                  ${walletBalance.toFixed(2)} available
                </div>
              </div>
            </button>

            {/* Payment Gateway Option */}
            <button
              type="button"
              onClick={() => setPaymentMethod("payment_gateway")}
              className={`flex items-center gap-2.5 rounded-xl border p-3 text-left transition-all ${
                paymentMethod === "payment_gateway"
                  ? "border-white bg-neutral-900 text-white ring-1 ring-white"
                  : "border-neutral-800 bg-neutral-900/40 text-neutral-400 hover:border-neutral-700 hover:text-white"
              }`}
            >
              <CreditCard className={`h-5 w-5 shrink-0 ${paymentMethod === "payment_gateway" ? "text-white" : "text-neutral-400"}`} />
              <div>
                <div className="text-xs font-bold text-white">Credit Card / Gateway</div>
                <div className="text-[10px] text-neutral-400">Stripe / Visa / MC</div>
              </div>
            </button>
          </div>

          {/* Insufficient Wallet Warning & Top Up */}
          {isWalletInsufficient && (
            <div className="flex items-center justify-between rounded-xl border border-amber-500/40 bg-amber-950/30 p-2.5 text-xs text-amber-300">
              <span>Insufficient wallet balance (${walletBalance.toFixed(2)} available).</span>
              <Button
                size="sm"
                variant="outline"
                disabled={topUpMut.isPending}
                onClick={() => topUpMut.mutate()}
                className="h-7 border-amber-500/50 bg-amber-900/40 text-amber-200 hover:bg-amber-800/60 text-[11px]"
              >
                {topUpMut.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <>
                    <Plus className="mr-1 h-3 w-3" /> Top Up $50
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="mt-2 pt-2 border-t border-neutral-800">
          <Button
            size="lg"
            disabled={subMut.isPending || isWalletInsufficient}
            onClick={() => subMut.mutate()}
            className={`w-full rounded-xl font-bold uppercase tracking-wider transition-all duration-200 active:scale-95 ${
              paymentMethod === "wallet"
                ? "bg-emerald-500 text-black hover:bg-emerald-400 shadow-lg shadow-emerald-500/20"
                : "bg-white text-black hover:bg-neutral-200 shadow-lg shadow-white/10"
            }`}
          >
            {subMut.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-black" />
                Unlocking...
              </>
            ) : (
              <>
                <Lock className="mr-2 h-4 w-4 text-black" />
                Pay ${totalPrice.toFixed(2)} with {paymentMethod === "wallet" ? "Wallet" : "Card"}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
