import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { AuthForm } from "@/components/auth-form";
import { RedirectIfAuthed } from "@/components/redirect-if-authed";

const indexSearchSchema = z.object({
  intent: z.string().optional().default(""),
  redirect: z.string().optional().default(""),
});

export const Route = createFileRoute("/")({
  ssr: false,
  validateSearch: zodValidator(indexSearchSchema),
  head: () => ({
    meta: [
      { title: "LEER Sports — Fitness Is The Only Law" },
      { name: "description", content: "Restricted area for elite creators and premium fans. Sign in to access your workspace." },
      { property: "og:title", content: "LEER Sports — Fitness Is The Only Law" },
      { property: "og:description", content: "Restricted area for elite creators and premium fans." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: IndexPage,
});

function IndexPage() {
  const { intent, redirect } = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const isLogin = mode === "signin";

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#000000] px-4 py-8 sm:py-12 lg:px-8">
      {!redirect && !intent && <RedirectIfAuthed />}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[#000000]">
        <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-sport/20 blur-[140px]" />
        <div className="absolute -bottom-40 -right-40 h-[520px] w-[520px] rounded-full bg-sport/10 blur-[140px]" />
      </div>

      <div className="relative z-10 grid w-full max-w-5xl grid-cols-1 overflow-hidden rounded-2xl border border-white/10 bg-black/90 shadow-[0_40px_120px_-40px_hsl(var(--sport)/0.4)] backdrop-blur-xl md:grid-cols-2">
        {/* LEFT — brand panel */}
        <aside className="relative hidden overflow-hidden bg-black p-10 md:flex md:flex-col md:justify-between lg:p-12 border-r border-white/10">
          <div aria-hidden className="absolute inset-0 opacity-40">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_25%,hsl(var(--sport))_0%,transparent_60%)]" />
          </div>
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(hsl(0_0%_100%/1)_1px,transparent_1px),linear-gradient(90deg,hsl(0_0%_100%/1)_1px,transparent_1px)] [background-size:40px_40px]"
          />

          <div className="relative z-10 space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-sport/40 bg-sport/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.32em] text-sport shadow-[0_0_12px_hsl(var(--sport)/0.3)]">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-sport shadow-[0_0_12px_hsl(var(--sport))]" />
              RESTRICTED AREA
            </span>
            <h1 className="text-6xl font-black leading-[0.88] tracking-tighter text-white lg:text-7xl font-display uppercase italic">
              LEER
            </h1>
            <p className="font-display text-lg uppercase tracking-widest text-sport italic font-bold">
              FITNESS IS THE ONLY LAW
            </p>
            <p className="max-w-[290px] text-xs leading-relaxed text-white/60">
              Exclusive space for verified pro creators and premium athletes. Access your workspace.
            </p>
          </div>

          <div className="relative z-10 space-y-4 pt-8">
            <blockquote className="border-l-2 border-sport pl-4 text-xs italic text-white/80">
              "Discipline is choosing between what you want now and what you want most."
            </blockquote>
            <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.28em] text-white/40">
              <span>LEER Sports</span>
              <span>v2.0 — Kinetic</span>
            </div>
          </div>
        </aside>

        {/* RIGHT — form panel */}
        <section className="relative flex flex-col bg-card p-6 sm:p-10 lg:p-12">
          <div className="mb-8 flex items-center justify-between md:hidden">
            <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-sport">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-sport" />
              LEER
            </span>
          </div>

          <div role="tablist" aria-label="Sign in or sign up" className="mb-8 flex gap-8 border-b border-white/5">
            {(["signin", "signup"] as const).map((m) => {
              const active = mode === m;
              return (
                <button
                  key={m}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setMode(m)}
                  className={`relative -mb-px pb-4 text-xs font-bold uppercase tracking-[0.24em] transition-colors ${
                    active ? "text-foreground" : "text-muted-foreground hover:text-foreground/80"
                  }`}
                >
                  {m === "signin" ? "Sign In" : "Sign Up"}
                  <span
                    aria-hidden
                    className={`absolute inset-x-0 -bottom-px h-0.5 bg-sport transition-transform duration-300 ${
                      active ? "scale-x-100" : "scale-x-0"
                    }`}
                  />
                </button>
              );
            })}
          </div>

          <div className="mb-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
              {isLogin ? "Welcome back" : "Create your account"}
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-foreground sm:text-3xl">
              {isLogin ? "Step back in." : "Join the standard."}
            </h2>
          </div>

          <AuthForm
            intent={intent}
            redirect={redirect}
            variant="embedded"
            mode={mode}
            onModeChange={setMode}
          />

          <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-8">
            <p className="text-xs text-muted-foreground">
              {isLogin ? "New here?" : "Already have an account?"}{" "}
              <button
                type="button"
                onClick={() => setMode(isLogin ? "signup" : "signin")}
                className="font-semibold uppercase tracking-widest text-sport hover:underline"
              >
                {isLogin ? "Sign up" : "Sign in"}
              </button>
            </p>
            <Link
              to="/admin"
              className="group inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground transition-colors hover:text-foreground"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Admin panel
              <ArrowUpRight className="h-3 w-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
