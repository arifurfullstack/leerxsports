import { Link } from "@tanstack/react-router";
import {
  Compass,
  GraduationCap,
  Info,
  LayoutGrid,
  LogIn,
  Mail,
  Shield,
  Sparkles,
  Twitter,
  Instagram,
  Youtube,
  Github,
  ArrowUpRight,
  Heart,
} from "lucide-react";

const exploreLinks = [
  { to: "/browse", label: "Browse", icon: Compass, accent: "text-sky-500", hover: "hover:text-sky-500" },
  { to: "/classes", label: "Classes", icon: LayoutGrid, accent: "text-fuchsia-500", hover: "hover:text-fuchsia-500" },
  { to: "/trainers", label: "Trainers", icon: GraduationCap, accent: "text-emerald-500", hover: "hover:text-emerald-500" },
  { to: "/about", label: "About", icon: Info, accent: "text-cyan-500", hover: "hover:text-cyan-500" },
] as const;

const accountLinks = [
  { to: "/dashboard", label: "Dashboard", icon: Sparkles, accent: "text-orange-500", hover: "hover:text-orange-500" },
  { to: "/settings", label: "Settings", icon: Shield, accent: "text-violet-500", hover: "hover:text-violet-500" },
  { to: "/auth", label: "Sign in", icon: LogIn, accent: "text-emerald-500", hover: "hover:text-emerald-500" },
  { to: "/admin", label: "Admin", icon: Shield, accent: "text-amber-500", hover: "hover:text-amber-500" },
] as const;

const socials = [
  { href: "https://twitter.com", label: "Twitter", icon: Twitter, hover: "hover:border-sky-500/50 hover:bg-sky-500/10 hover:text-sky-500" },
  { href: "https://instagram.com", label: "Instagram", icon: Instagram, hover: "hover:border-fuchsia-500/50 hover:bg-fuchsia-500/10 hover:text-fuchsia-500" },
  { href: "https://youtube.com", label: "YouTube", icon: Youtube, hover: "hover:border-rose-500/50 hover:bg-rose-500/10 hover:text-rose-500" },
  { href: "https://github.com", label: "GitHub", icon: Github, hover: "hover:border-foreground/40 hover:bg-foreground/5 hover:text-foreground" },
];

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer
      aria-labelledby="footer-heading"
      className="relative isolate mt-16 overflow-hidden border-t border-border/60 bg-background"
    >
      <h2 id="footer-heading" className="sr-only">
        Site footer
      </h2>
      {/* Ambient gradient glows */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 left-1/4 h-72 w-72 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="absolute -top-24 right-1/4 h-72 w-72 rounded-full bg-fuchsia-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-64 w-[60%] -translate-x-1/2 rounded-full bg-orange-500/5 blur-3xl" />
      </div>
      {/* Top gradient hairline */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />

      <div className="mx-auto max-w-7xl px-5 pb-8 pt-12 sm:px-6 sm:pb-10 sm:pt-14 lg:px-8 lg:pt-16">
        {/* Newsletter / CTA card */}
        <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/70 p-5 shadow-sm backdrop-blur-sm sm:rounded-3xl sm:p-8">
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gradient-to-br from-sky-500/20 via-fuchsia-500/20 to-orange-500/20 blur-2xl" />
          <div className="relative grid gap-5 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-2.5 py-1 text-[11px] font-medium text-muted-foreground sm:gap-2 sm:px-3 sm:text-xs">
                <Sparkles aria-hidden="true" className="h-3.5 w-3.5 text-fuchsia-500" />
                Stay in the loop
              </div>
              <h3 className="mt-3 font-display text-xl font-bold leading-tight tracking-tight sm:text-2xl lg:text-3xl">
                <span className="bg-gradient-to-r from-sky-500 via-fuchsia-500 to-orange-500 bg-clip-text text-transparent">
                  Level up
                </span>{" "}
                your training routine
              </h3>
              <p
                id="footer-newsletter-desc"
                className="mt-2 max-w-lg text-[13px] leading-relaxed text-muted-foreground sm:text-sm"
              >
                Weekly drills, coach picks, and platform updates — straight to your inbox.
              </p>
            </div>
            <form
              onSubmit={(e) => e.preventDefault()}
              aria-label="Subscribe to the newsletter"
              aria-describedby="footer-newsletter-desc"
              className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto"
            >
              <label htmlFor="footer-email" className="sr-only">
                Email address
              </label>
              <div className="relative w-full sm:flex-1 lg:w-72 lg:flex-none">
                <Mail
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  id="footer-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  required
                  placeholder="you@example.com"
                  className="h-11 w-full rounded-full border border-border bg-background/80 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-[box-shadow,border-color] focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                />
              </div>
              <button
                type="submit"
                className="group inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-sky-500 via-fuchsia-500 to-orange-500 bg-[length:200%_100%] bg-[position:0%_50%] px-5 text-sm font-semibold text-white shadow-md shadow-fuchsia-500/30 outline-none transition-[background-position,transform,box-shadow] duration-500 hover:shadow-lg hover:shadow-fuchsia-500/50 focus-visible:ring-2 focus-visible:ring-fuchsia-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-auto motion-safe:hover:-translate-y-0.5 motion-safe:hover:bg-[position:100%_50%]"
              >
                <span>Subscribe</span>
                <ArrowUpRight
                  aria-hidden="true"
                  className="h-4 w-4 transition-transform motion-safe:group-hover:translate-x-0.5 motion-safe:group-hover:-translate-y-0.5"
                />
              </button>
            </form>
          </div>
        </div>

        {/* Main grid */}
        <div className="mt-10 grid gap-8 sm:mt-12 sm:grid-cols-2 sm:gap-10 lg:grid-cols-12">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-5">
            <Link
              to="/"
              aria-label="leersports home"
              className="group inline-flex items-center gap-2.5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <span className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-sky-500 via-fuchsia-500 to-orange-500 shadow-lg shadow-fuchsia-500/25 transition-[box-shadow,transform] duration-300 group-hover:shadow-fuchsia-500/50 motion-safe:group-hover:scale-105">
                <span className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-white/0 via-white/30 to-white/0 opacity-0 transition-opacity duration-500 motion-safe:group-hover:opacity-100" />
                <span className="relative font-display text-base font-bold tracking-widest text-white">L</span>
              </span>
              <span className="bg-gradient-to-r from-foreground via-foreground to-foreground/60 bg-clip-text font-display text-sm uppercase tracking-[0.28em] transition-all duration-300 group-hover:from-sky-500 group-hover:via-fuchsia-500 group-hover:to-orange-500 group-hover:text-transparent">
                leersports
              </span>
            </Link>
            <p className="mt-4 max-w-md text-[13px] leading-relaxed text-muted-foreground sm:text-sm">
              Learn sports from certified coaches. Book classes, track progress, join a global
              community, and level up your game — one session at a time.
            </p>
            <ul className="mt-5 flex flex-wrap gap-2.5" aria-label="Social links">
              {socials.map((s) => (
                <li key={s.label}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={`${s.label} (opens in a new tab)`}
                    className={`group flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground outline-none transition-[color,background-color,border-color,transform,box-shadow] duration-200 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-safe:hover:-translate-y-0.5 ${s.hover}`}
                  >
                    <s.icon aria-hidden="true" className="h-4 w-4 transition-transform motion-safe:group-hover:scale-110" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Explore column */}
          <nav aria-labelledby="footer-explore" className="lg:col-span-3">
            <h4
              id="footer-explore"
              className="font-display text-[11px] font-semibold uppercase tracking-[0.22em] text-foreground/80 sm:text-xs"
            >
              Explore
            </h4>
            <ul className="mt-4 space-y-3 text-[13px] sm:space-y-2.5 sm:text-sm">
              {exploreLinks.map((l) => (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    className={`group inline-flex items-center gap-2 rounded-sm text-muted-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${l.hover}`}
                  >
                    <l.icon aria-hidden="true" className={`h-4 w-4 ${l.accent} transition-transform motion-safe:group-hover:scale-110 motion-safe:group-hover:-rotate-6`} />
                    <span className="relative">
                      {l.label}
                      <span className="absolute inset-x-0 -bottom-0.5 h-px origin-left scale-x-0 bg-current transition-transform duration-300 motion-safe:group-hover:scale-x-100" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Account column */}
          <nav aria-labelledby="footer-account" className="lg:col-span-2">
            <h4
              id="footer-account"
              className="font-display text-[11px] font-semibold uppercase tracking-[0.22em] text-foreground/80 sm:text-xs"
            >
              Account
            </h4>
            <ul className="mt-4 space-y-3 text-[13px] sm:space-y-2.5 sm:text-sm">
              {accountLinks.map((l) => (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    className={`group inline-flex items-center gap-2 rounded-sm text-muted-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${l.hover}`}
                  >
                    <l.icon aria-hidden="true" className={`h-4 w-4 ${l.accent} transition-transform motion-safe:group-hover:scale-110 motion-safe:group-hover:-rotate-6`} />
                    <span className="relative">
                      {l.label}
                      <span className="absolute inset-x-0 -bottom-0.5 h-px origin-left scale-x-0 bg-current transition-transform duration-300 motion-safe:group-hover:scale-x-100" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Legal column */}
          <nav aria-labelledby="footer-legal" className="sm:col-span-2 lg:col-span-2">
            <h4
              id="footer-legal"
              className="font-display text-[11px] font-semibold uppercase tracking-[0.22em] text-foreground/80 sm:text-xs"
            >
              Legal
            </h4>
            <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-[13px] sm:grid-cols-4 sm:gap-y-2.5 sm:text-sm lg:grid-cols-1 lg:space-y-0">
              {(
                [
                  { to: "/privacy", label: "Privacy" },
                  { to: "/terms", label: "Terms" },
                  { to: "/cookies", label: "Cookies" },
                  { to: "/contact", label: "Contact" },
                ] as const
              ).map((l) => (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    className="inline-block rounded-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border/60 pt-6 text-center sm:mt-12 sm:flex-row sm:gap-4 sm:text-left">
          <p className="text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
            © {year} leersports. All rights reserved.
          </p>
          <p className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground sm:text-xs">
            Crafted with
            <Heart aria-hidden="true" className="h-3.5 w-3.5 fill-rose-500 text-rose-500 motion-safe:animate-pulse" />
            <span className="sr-only">love</span>
            for athletes worldwide
          </p>
        </div>
      </div>
    </footer>
  );
}
