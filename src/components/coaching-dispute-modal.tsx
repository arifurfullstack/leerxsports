import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, Loader2, ShieldAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  openCoachingDispute,
  type DisputeReason,
} from "@/lib/dispute-functions";

const REASON_LABELS: Record<DisputeReason, string> = {
  unresponsive_trainer: "Trainer was unresponsive to SLA deadline",
  incomplete_coaching: "Incomplete video feedback or missing answer",
  inappropriate_behavior: "Inappropriate language or behavior",
  quality_dispute: "Substandard coaching quality or inaccurate advice",
  other: "Other issue",
};

export function CoachingDisputeModal({
  open,
  onOpenChange,
  threadId,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  threadId: string;
  onSuccess?: () => void;
}) {
  const [reason, setReason] = useState<DisputeReason>("unresponsive_trainer");
  const [details, setDetails] = useState("");
  const submitFn = useServerFn(openCoachingDispute);

  const mut = useMutation({
    mutationFn: () =>
      submitFn({
        data: {
          threadId,
          reason,
          details: details.trim(),
        },
      }),
    onSuccess: () => {
      toast.success("Coaching dispute opened. Sent to Admin for manual review.");
      onOpenChange(false);
      setDetails("");
      onSuccess?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display uppercase tracking-widest text-amber-500">
            <AlertTriangle className="h-5 w-5" /> Open Coaching Dispute
          </DialogTitle>
          <DialogDescription>
            If you are unsatisfied with your coaching response or the trainer failed to deliver quality video feedback, you can dispute this session. Admin will review the entire thread and render a verdict.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Reason for dispute
            </label>
            <div className="mt-1.5 grid gap-1.5">
              {(Object.keys(REASON_LABELS) as DisputeReason[]).map((r) => (
                <label
                  key={r}
                  className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                    reason === r
                      ? "border-amber-500 bg-amber-500/10 text-amber-500"
                      : "border-border hover:bg-accent"
                  }`}
                >
                  <input
                    type="radio"
                    name="dispute-reason"
                    value={r}
                    checked={reason === r}
                    onChange={() => setReason(r)}
                  />
                  {REASON_LABELS[r]}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Provide specific details
            </label>
            <Textarea
              placeholder="Describe what was missing or why you are disputing this coaching session..."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={4}
              className="mt-1 text-xs"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => mut.mutate()}
            disabled={mut.isPending || details.trim().length < 5}
          >
            {mut.isPending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <ShieldAlert className="mr-1 h-4 w-4" />
            )}
            Submit Dispute
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
