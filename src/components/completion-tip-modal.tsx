import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Heart, DollarSign, Sparkles, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PRESET_TIERS = [
  { amount: 5, label: "Bronze", desc: "Thanks for the feedback!" },
  { amount: 10, label: "Silver", desc: "Great coaching response!" },
  { amount: 25, label: "Gold", desc: "Exceptional analysis!" },
];

export function CompletionTipModal({
  open,
  onOpenChange,
  trainerName,
  threadId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  trainerName: string;
  threadId: string;
}) {
  const [selectedAmount, setSelectedAmount] = useState<number | null>(10);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [isCustom, setIsCustom] = useState<boolean>(false);

  const handleDismiss = () => {
    try {
      localStorage.setItem(`leer_tip_dismissed_${threadId}`, "true");
    } catch {}
    onOpenChange(false);
  };

  const handleSendTip = () => {
    const amount = isCustom ? Number(customAmount) : selectedAmount;
    if (!amount || amount <= 0 || isNaN(amount)) {
      toast.error("Please select or enter a valid tip amount.");
      return;
    }
    toast.success(`Thank you! \$${amount} tip sent to ${trainerName}.`);
    handleDismiss();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-500 ring-4 ring-amber-500/20">
            <Sparkles className="h-6 w-6" />
          </div>
          <DialogTitle className="mt-2 font-display text-xl uppercase tracking-wider">
            Show Appreciation
          </DialogTitle>
          <DialogDescription className="text-xs">
            Your coaching session with <strong className="text-foreground">{trainerName}</strong> is completed. If you enjoyed the video analysis, send a tip to show appreciation!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="grid grid-cols-3 gap-2">
            {PRESET_TIERS.map((tier) => (
              <button
                key={tier.amount}
                type="button"
                onClick={() => {
                  setSelectedAmount(tier.amount);
                  setIsCustom(false);
                }}
                className={`flex flex-col items-center justify-center rounded-lg border p-3 text-center transition-all ${
                  !isCustom && selectedAmount === tier.amount
                    ? "border-amber-500 bg-amber-500/10 text-amber-500 shadow-sm ring-1 ring-amber-500"
                    : "border-border hover:bg-accent"
                }`}
              >
                <span className="font-display text-lg font-bold">${tier.amount}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider">
                  {tier.label}
                </span>
              </button>
            ))}
          </div>

          <div className="pt-1">
            <button
              type="button"
              onClick={() => setIsCustom(!isCustom)}
              className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              {isCustom ? "Select preset tier" : "Or enter custom tip amount"}
            </button>

            {isCustom && (
              <div className="mt-2 relative">
                <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  placeholder="Enter amount in USD"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  className="pl-8 text-sm"
                  min="1"
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            onClick={handleSendTip}
            className="w-full bg-amber-500 text-black hover:bg-amber-400 font-semibold"
          >
            <Heart className="mr-1.5 h-4 w-4 fill-current" />
            Send Tip ${isCustom ? customAmount || "0" : selectedAmount}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="w-full text-xs text-muted-foreground"
          >
            No thanks, skip tip
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
