import { useEffect, useRef, useState } from "react";
import { Loader2, ShieldCheck, AlertCircle } from "lucide-react";

declare global {
  interface Window {
    Stripe?: (publishableKey: string) => any;
  }
}

let stripeScriptPromise: Promise<boolean> | null = null;

function loadStripeScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Stripe) return Promise.resolve(true);

  if (!stripeScriptPromise) {
    stripeScriptPromise = new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://js.stripe.com/v3/";
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => {
        console.error("Failed to load Stripe.js script");
        resolve(false);
      };
      document.head.appendChild(script);
    });
  }

  return stripeScriptPromise;
}

interface StripeEmbeddedCheckoutProps {
  clientSecret: string;
  publishableKey?: string | null;
  onComplete?: () => void;
  className?: string;
}

export function StripeEmbeddedCheckout({
  clientSecret,
  publishableKey,
  onComplete,
  className = "",
}: StripeEmbeddedCheckoutProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let embeddedCheckout: any = null;

    async function setupCheckout() {
      try {
        setIsLoading(true);
        setError(null);

        const loaded = await loadStripeScript();
        if (!active) return;
        if (!loaded || !window.Stripe) {
          throw new Error("Unable to load secure Stripe payment system. Please check your connection.");
        }

        const pk = publishableKey || "pk_test_placeholder";
        const stripe = window.Stripe(pk);

        embeddedCheckout = await stripe.initEmbeddedCheckout({
          clientSecret,
          onComplete: () => {
            if (onComplete) onComplete();
          },
        });

        if (!active) {
          embeddedCheckout?.destroy?.();
          return;
        }

        if (mountRef.current) {
          mountRef.current.innerHTML = "";
          embeddedCheckout.mount(mountRef.current);
        }
        setIsLoading(false);
      } catch (err: any) {
        if (active) {
          console.error("Embedded Stripe checkout initialization failed:", err);
          setError(err.message || "Failed to initialize Stripe checkout.");
          setIsLoading(false);
        }
      }
    }

    if (clientSecret) {
      setupCheckout();
    }

    return () => {
      active = false;
      if (embeddedCheckout) {
        try {
          embeddedCheckout.destroy?.();
        } catch {
          // ignore cleanup errors
        }
      }
    };
  }, [clientSecret, publishableKey, onComplete]);

  return (
    <div className={`relative min-h-[360px] w-full rounded-2xl bg-card text-foreground overflow-hidden ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-card/90 backdrop-blur-sm z-10">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
          <div className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-muted-foreground font-semibold">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span>Loading In-App Stripe Checkout...</span>
          </div>
        </div>
      )}

      {error && (
        <div className="p-6 text-center text-sm text-destructive flex flex-col items-center gap-2">
          <AlertCircle className="h-6 w-6" />
          <p className="font-medium">{error}</p>
          <p className="text-xs text-muted-foreground">
            Please ensure valid Stripe test credentials are configured in Admin Payment Settings.
          </p>
        </div>
      )}

      <div ref={mountRef} className="w-full" />
    </div>
  );
}
