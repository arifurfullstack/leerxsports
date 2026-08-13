import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { HelpCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { QA_PRICE, sendQADispatch } from "@/lib/qa-functions";

export function AskQuestionDialog({
  creatorId,
  creatorName,
  disabled,
}: {
  creatorId: string;
  creatorName: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const send = useServerFn(sendQADispatch);
  const queryClient = useQueryClient();
  const mut = useMutation({
    mutationFn: (question: string) =>
      send({ data: { creatorId, question } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-wallet"] });
      queryClient.invalidateQueries({ queryKey: ["qa-dispatches"] });
      toast.success(`Question sent to ${creatorName}. You'll be notified when they answer.`);
      setQ("");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const valid = q.trim().length >= 10 && q.trim().length <= 2000;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="default"
          variant="outline"
          disabled={disabled}
          className="group rounded-xl border border-neutral-800 bg-neutral-900/80 px-4 font-semibold text-white backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-neutral-600 hover:bg-neutral-800 hover:shadow-md"
          aria-label={`Ask ${creatorName} a question for $${QA_PRICE}`}
        >
          <HelpCircle className="mr-2 h-4 w-4 text-neutral-300 transition-transform duration-200 group-hover:scale-110 group-hover:rotate-12 group-hover:text-white" />
          Ask · ${QA_PRICE}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-premium" />
            Ask {creatorName} · ${QA_PRICE}
          </DialogTitle>
          <DialogDescription>
            Send a paid question. The creator has 48 hours to answer.
            If they don't respond, you're refunded automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Textarea
            placeholder="What do you want to ask? Be specific (programs, technique, mindset, career, etc)."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            rows={6}
            maxLength={2000}
            aria-label="Your question"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{q.trim().length < 10 ? "At least 10 characters." : "Looks good."}</span>
            <span>{q.length}/2000</span>
          </div>
          <p className="rounded-md border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
            Charged to your saved payment method. See{" "}
            <Link to="/qa" className="underline underline-offset-2">
              your questions
            </Link>{" "}
            for status.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            className="bg-premium ring-premium font-semibold uppercase tracking-widest"
            disabled={!valid || mut.isPending}
            onClick={() => mut.mutate(q.trim())}
          >
            {mut.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Send · ${QA_PRICE}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
