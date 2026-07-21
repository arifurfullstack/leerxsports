import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Flag, Loader2 } from "lucide-react";
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
  submitReport,
  type ReportTarget,
  type ReportReason,
  REPORT_REASONS,
} from "@/lib/moderation-functions";

const REASON_LABELS: Record<ReportReason, string> = {
  nudity: "Nudity or sexual content",
  abuse: "Abuse or harassment",
  spam: "Spam or scam",
  misinformation: "Misinformation",
  ip_violation: "Copyright / IP violation",
  self_harm: "Self-harm or dangerous behavior",
  other: "Other",
};

export function ReportDialog({
  open,
  onOpenChange,
  targetType,
  targetId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  targetType: ReportTarget;
  targetId: string;
}) {
  const [reason, setReason] = useState<ReportReason>("spam");
  const [details, setDetails] = useState("");
  const report = useServerFn(submitReport);
  const mut = useMutation({
    mutationFn: () =>
      report({
        data: {
          target_type: targetType,
          target_id: targetId,
          reason,
          details: details.trim() || undefined,
        },
      }),
    onSuccess: (res) => {
      toast.success(
        res.duplicate ? "Already reported — thanks." : "Report submitted. Our team will review.",
      );
      onOpenChange(false);
      setDetails("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display uppercase tracking-widest">
            <Flag className="mr-1 inline h-4 w-4" /> Report content
          </DialogTitle>
          <DialogDescription>
            Reports are confidential. Our moderation team reviews every submission.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label className="text-[11px] uppercase tracking-widest text-muted-foreground">
            Reason
          </label>
          <div className="grid gap-1">
            {REPORT_REASONS.map((r) => (
              <label
                key={r}
                className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                  reason === r
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border"
                }`}
              >
                <input
                  type="radio"
                  name="report-reason"
                  value={r}
                  checked={reason === r}
                  onChange={() => setReason(r)}
                />
                {REASON_LABELS[r]}
              </label>
            ))}
          </div>
        </div>

        <Textarea
          placeholder="Add details (optional, up to 1000 chars)"
          maxLength={1000}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          rows={3}
        />

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => mut.mutate()}
            disabled={mut.isPending}
          >
            {mut.isPending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Flag className="mr-1 h-4 w-4" />
            )}
            Submit report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}