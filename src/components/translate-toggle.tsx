import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Languages, Loader2 } from "lucide-react";
import { translateText } from "@/lib/translation-functions";
import { toast } from "sonner";

type Props = {
  text: string;
  targetLang?: string;
  className?: string;
};

function getBrowserLang(): string {
  if (typeof navigator === "undefined") return "en";
  const l = navigator.language || "en";
  return l.split("-")[0];
}

export function TranslateToggle({ text, targetLang, className }: Props) {
  const [translated, setTranslated] = useState<string | null>(null);
  const [showing, setShowing] = useState(false);
  const fn = useServerFn(translateText);
  const target = targetLang ?? getBrowserLang();

  const mut = useMutation({
    mutationFn: async () => fn({ data: { text, target_lang: target } }),
    onSuccess: (r) => {
      setTranslated(r.translated_text);
      setShowing(true);
    },
    onError: (e: Error) => toast.error(e.message ?? "Translation failed"),
  });

  if (!text || text.trim().length === 0) return null;

  return (
    <div className={className}>
      {showing && translated ? (
        <div className="mt-2 rounded-md border border-border bg-muted/40 p-2 text-sm text-foreground">
          {translated}
          <button
            type="button"
            onClick={() => setShowing(false)}
            className="ml-2 inline-flex items-center text-xs text-muted-foreground hover:text-foreground"
          >
            Hide
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={mut.isPending}
          onClick={() => (translated ? setShowing(true) : mut.mutate())}
          className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          {mut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Languages className="h-3 w-3" />}
          See translation
        </button>
      )}
    </div>
  );
}