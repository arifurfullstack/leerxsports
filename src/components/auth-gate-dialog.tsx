import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { Dumbbell, UserPlus, LogIn } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  closeAuthGate,
  initAuthGate,
  useAuthGateState,
} from "@/lib/auth-gate";

/**
 * Global "Sign in to continue" dialog. Rendered once at the app root;
 * opened by any interaction guarded with `requireAuth()`.
 */
export function AuthGateDialog() {
  const { dialogOpen, intent, redirectPath } = useAuthGateState();

  useEffect(() => initAuthGate(), []);

  const action = intent?.action ?? "continue";
  const title = intent?.title ?? `Sign in to ${action}`;
  const description =
    intent?.description ??
    "Create a free account to interact with creators to follow, like, save, comment, tip, and message.";

  const redirect = redirectPath || "/";

  return (
    <Dialog open={dialogOpen} onOpenChange={(o) => !o && closeAuthGate()}>
      <DialogContent className="max-w-md border-hairline bg-background/95 p-6 backdrop-blur-xl sm:rounded-xl">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-premium/30 bg-premium/10 text-premium shadow-[0_0_20px_-5px_var(--premium)]">
          <Dumbbell className="h-6 w-6" />
        </div>
        <DialogHeader className="space-y-2 text-center">
          <DialogTitle className="text-center font-display text-2xl uppercase tracking-wide text-foreground">
            {title}
          </DialogTitle>
          <DialogDescription className="text-center text-sm leading-relaxed text-muted-foreground">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6 flex flex-col gap-3">
          <Link
            to="/login"
            search={{ redirect } as never}
            onClick={closeAuthGate}
            className="group relative flex h-11 w-full items-center justify-center gap-2 rounded-md bg-foreground px-4 text-xs font-semibold uppercase tracking-[0.18em] text-background transition-all hover:bg-foreground/90 hover:shadow-[0_0_20px_-3px_rgba(255,255,255,0.2)]"
          >
            <LogIn className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" />
            <span>Sign In</span>
          </Link>

          <Link
            to="/signup"
            search={{ redirect } as never}
            onClick={closeAuthGate}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-md border border-hairline-strong bg-accent/40 px-4 text-xs font-semibold uppercase tracking-[0.18em] text-foreground transition-all hover:border-foreground/40 hover:bg-accent"
          >
            <UserPlus className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span>Create Free Account</span>
          </Link>

          <button
            type="button"
            onClick={closeAuthGate}
            className="mt-2 text-center text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Keep browsing as guest
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}