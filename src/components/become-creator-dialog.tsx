import { Link } from "@tanstack/react-router";
import { Sparkles, Zap, DollarSign, MessageSquare, ArrowRight, ShieldCheck } from "lucide-react";
import { useProfileMode } from "@/lib/profile-mode-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export function BecomeCreatorDialog() {
  const { becomeCreatorOpen, setBecomeCreatorOpen } = useProfileMode();

  return (
    <Dialog open={becomeCreatorOpen} onOpenChange={setBecomeCreatorOpen}>
      <DialogContent className="max-w-md border-hairline bg-card/95 backdrop-blur-xl">
        <DialogHeader className="text-center sm:text-left">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white shadow-lg sm:mx-0">
            <Sparkles className="h-6 w-6" />
          </div>
          <DialogTitle className="font-display text-2xl font-bold uppercase tracking-tight text-foreground">
            Become a LEER Creator
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Unlock your Creator Studio to publish premium content, offer paid Q&As, and earn from your athletic community.
          </DialogDescription>
        </DialogHeader>

        <div className="my-3 space-y-3">
          <div className="flex items-start gap-3 rounded-xl border border-hairline bg-muted/40 p-3">
            <DollarSign className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
            <div>
              <p className="text-sm font-semibold text-foreground">Monetize Content & Reels</p>
              <p className="text-xs text-muted-foreground">Publish free or locked premium posts & shorts directly to fans.</p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-hairline bg-muted/40 p-3">
            <MessageSquare className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-semibold text-foreground">Paid Fan Q&A Inbox</p>
              <p className="text-xs text-muted-foreground">Earn payouts by answering personalized advice and coaching questions.</p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-hairline bg-muted/40 p-3">
            <Zap className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <div>
              <p className="text-sm font-semibold text-foreground">Monthly Fan Subscriptions</p>
              <p className="text-xs text-muted-foreground">Build recurring monthly income with dedicated fan subscriptions.</p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="ghost"
            onClick={() => setBecomeCreatorOpen(false)}
            className="w-full sm:w-auto"
          >
            Maybe Later
          </Button>
          <Button
            asChild
            onClick={() => setBecomeCreatorOpen(false)}
            className="w-full font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-md sm:w-auto"
          >
            <Link to="/onboarding" search={{ resume: false, source: "creator_switch_modal" }}>
              Apply to Become a Creator <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
