import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Copy,
  Facebook,
  Link2,
  Linkedin,
  Mail,
  MessageSquare,
  Send,
  Share2,
  Twitter,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { copyTextToClipboard } from "@/lib/clipboard";
import { cn } from "@/lib/utils";

export type ShareChannel =
  | "native"
  | "clipboard"
  | "twitter"
  | "facebook"
  | "whatsapp"
  | "linkedin"
  | "telegram"
  | "reddit"
  | "email";

type Channel = {
  key: ShareChannel;
  label: string;
  icon: React.ReactNode;
  /** tailwind class stack producing brand-tinted gradient tile */
  tone: string;
  run: () => void | Promise<void>;
};

export function ShareSheet({
  open,
  onOpenChange,
  url,
  title,
  description,
  onShared,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  url: string;
  title?: string;
  description?: string;
  onShared?: (channel: ShareChannel) => void;
}) {
  const shareTitle = title?.trim() || "LEER Sports";
  const enc = encodeURIComponent;
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  const openWindow = (href: string, channel: ShareChannel) => {
    window.open(href, "_blank", "noopener,noreferrer,width=680,height=680");
    onShared?.(channel);
    onOpenChange(false);
  };

  const copyLink = async () => {
    const ok = await copyTextToClipboard(url);
    if (ok) {
      setCopied(true);
      toast.success("Link copied", { description: url });
      onShared?.("clipboard");
      window.setTimeout(() => setCopied(false), 1800);
    } else {
      toast.error("Couldn't copy link", {
        description:
          "Your browser blocked clipboard access. Long-press the link to copy it manually.",
      });
    }
  };

  const nativeShare = async () => {
    try {
      await navigator.share?.({ title: shareTitle, url, text: description });
      onShared?.("native");
      onOpenChange(false);
    } catch {
      /* user cancelled */
    }
  };

  const canNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  const channels: Channel[] = useMemo(
    () => [
      {
        key: "twitter",
        label: "X",
        icon: <Twitter className="h-5 w-5" />,
        tone: "from-neutral-900 to-neutral-700 text-white",
        run: () =>
          openWindow(
            `https://twitter.com/intent/tweet?text=${enc(shareTitle)}&url=${enc(url)}`,
            "twitter",
          ),
      },
      {
        key: "facebook",
        label: "Facebook",
        icon: <Facebook className="h-5 w-5" />,
        tone: "from-[#1877F2] to-[#0b5fd1] text-white",
        run: () =>
          openWindow(
            `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`,
            "facebook",
          ),
      },
      {
        key: "whatsapp",
        label: "WhatsApp",
        icon: <MessageSquare className="h-5 w-5" />,
        tone: "from-[#25D366] to-[#128C7E] text-white",
        run: () =>
          openWindow(
            `https://wa.me/?text=${enc(`${shareTitle} ${url}`)}`,
            "whatsapp",
          ),
      },
      {
        key: "linkedin",
        label: "LinkedIn",
        icon: <Linkedin className="h-5 w-5" />,
        tone: "from-[#0A66C2] to-[#004182] text-white",
        run: () =>
          openWindow(
            `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`,
            "linkedin",
          ),
      },
      {
        key: "telegram",
        label: "Telegram",
        icon: <Send className="h-5 w-5" />,
        tone: "from-[#2AABEE] to-[#229ED9] text-white",
        run: () =>
          openWindow(
            `https://t.me/share/url?url=${enc(url)}&text=${enc(shareTitle)}`,
            "telegram",
          ),
      },
      {
        key: "reddit",
        label: "Reddit",
        icon: <Share2 className="h-5 w-5" />,
        tone: "from-[#FF4500] to-[#cc3700] text-white",
        run: () =>
          openWindow(
            `https://www.reddit.com/submit?url=${enc(url)}&title=${enc(shareTitle)}`,
            "reddit",
          ),
      },
      {
        key: "email",
        label: "Email",
        icon: <Mail className="h-5 w-5" />,
        tone: "from-muted to-muted text-foreground",
        run: () => {
          window.location.href = `mailto:?subject=${enc(shareTitle)}&body=${enc(url)}`;
          onShared?.("email");
          onOpenChange(false);
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [url, shareTitle],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md overflow-hidden border-border/60 bg-background/95 p-0 backdrop-blur"
        onClick={stop}
        onPointerDown={stop}
      >
        <div className="relative">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-primary/15 via-primary/5 to-transparent"
          />
          <DialogHeader className="relative space-y-1 px-6 pb-4 pt-6 text-left">
            <DialogTitle className="font-display text-xl uppercase tracking-widest">
              Share
            </DialogTitle>
            <DialogDescription className="line-clamp-2 text-xs text-muted-foreground">
              {description || "Send this to anyone, anywhere."}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Channel grid */}
        <div className="px-6">
          <div className="grid grid-cols-4 gap-3">
            {canNativeShare && (
              <ChannelTile
                label="More"
                icon={<Share2 className="h-5 w-5" />}
                tone="from-primary to-primary/70 text-primary-foreground"
                onClick={nativeShare}
              />
            )}
            {channels.map((c) => (
              <ChannelTile
                key={c.key}
                label={c.label}
                icon={c.icon}
                tone={c.tone}
                onClick={c.run}
              />
            ))}
          </div>
        </div>

        {/* Copy row */}
        <div className="mt-5 border-t border-border/60 bg-muted/30 px-6 py-4">
          <label className="mb-2 block text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            Page link
          </label>
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background p-1.5 pl-3">
            <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              value={url}
              readOnly
              onFocus={(e) => e.currentTarget.select()}
              className="h-8 flex-1 border-0 bg-transparent px-1 text-sm shadow-none focus-visible:ring-0"
              aria-label="Shareable link"
            />
            <Button
              type="button"
              size="sm"
              onClick={copyLink}
              className={cn(
                "h-8 gap-1.5 transition-colors",
                copied && "bg-emerald-500 text-white hover:bg-emerald-500",
              )}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" /> Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" /> Copy
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ChannelTile({
  label,
  icon,
  tone,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  tone: string;
  onClick: () => void | Promise<void>;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        void onClick();
      }}
      className="group flex flex-col items-center gap-1.5 focus-visible:outline-none"
    >
      <span
        className={cn(
          "grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br shadow-sm ring-1 ring-black/5 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:shadow-md group-focus-visible:ring-2 group-focus-visible:ring-ring",
          tone,
        )}
      >
        {icon}
      </span>
      <span className="text-[11px] font-medium text-foreground/80 group-hover:text-foreground">
        {label}
      </span>
    </button>
  );
}