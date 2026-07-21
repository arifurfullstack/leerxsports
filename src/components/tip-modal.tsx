import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Heart } from "lucide-react";
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
import { sendTip } from "@/lib/payments-functions";

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
  onOpenChange: (v: boolean) => void;
  trainerId: string;
  trainerName: string;
  presets: number[];
  threadId?: string;
  onSuccess?: () => void;
}) {
  const [amount, setAmount] = useState<number>(presets[1] ?? presets[0] ?? 5);
  const [message, setMessage] = useState("");
  const tip = useServerFn(sendTip);
  const mut = useMutation({
    mutationFn: () =>
      tip({
        data: {
          trainerId,
          amount,
          threadId,
          message: message.trim() || undefined,
        },
      }),
    onSuccess: () => {
      toast.success(`Sent ${amount} to ${trainerName}`);
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display uppercase tracking-widest">
            Send a Tip
          </DialogTitle>
          <DialogDescription>
            Show appreciation to {trainerName} for the coaching.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-2">
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setAmount(p)}
              className={`rounded-md border px-3 py-3 text-lg font-semibold transition-colors ${
                amount === p
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:border-primary/50"
              }`}
            >
              ${p}
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
            step="1"
            value={amount}
            onChange={(e) => setAmount(Math.max(1, Number(e.target.value) || 0))}
            className="mt-1"
          />
        </div>
        <Textarea
          placeholder="Optional note (up to 280 chars)"
          maxLength={280}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
        />
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Skip
          </Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || amount < 1}>
            {mut.isPending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Heart className="mr-1 h-4 w-4" />
            )}
            Send ${amount}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}