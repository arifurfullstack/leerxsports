import { useState } from "react";
import { Heart } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { PaidCheckoutButton } from "@/components/paid-checkout-button";

export function TipModal({
  open,
  onOpenChange,
  trainerId,
  trainerName,
  presets,
  threadId,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  trainerId: string;
  trainerName: string;
  presets: number[];
  threadId?: string;
  onSuccess?: () => void;
}) {
  const [amount, setAmount] = useState(presets[1] ?? presets[0] ?? 5);
  const [message, setMessage] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display uppercase tracking-widest">
            Support {trainerName}
          </DialogTitle>
          <DialogDescription>
            Send a tip to show your support. The platform applies the configured revenue split only
            after payment confirmation.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-2">
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setAmount(preset)}
              className={`rounded-md border px-3 py-3 text-lg font-semibold transition-colors ${
                amount === preset
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:border-primary/50"
              }`}
            >
              ${preset}
            </button>
          ))}
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-widest text-muted-foreground">
            Custom amount
          </label>
          <Input
            type="number"
            min={1}
            max={10000}
            step="1"
            value={amount}
            onChange={(event) =>
              setAmount(Math.min(10000, Math.max(1, Number(event.target.value) || 0)))
            }
            className="mt-1"
          />
        </div>
        <Textarea
          placeholder="Optional note (up to 280 characters)"
          maxLength={280}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={3}
        />
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Maybe next time
          </Button>
          <PaidCheckoutButton
            kind="tip"
            amount={amount}
            trainerId={trainerId}
            threadId={threadId}
            message={message.trim() || undefined}
            disabled={amount < 1}
            title="Confirm coaching tip"
            description={`Choose a payment method for your tip to ${trainerName}.`}
            label={
              <>
                <Heart className="mr-1 h-4 w-4" />
                Continue · ${amount.toFixed(2)}
              </>
            }
            onPaid={() => {
              onOpenChange(false);
              onSuccess?.();
            }}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
