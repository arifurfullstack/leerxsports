import { Link, useRouter } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { isAdmin } from "@/lib/auth-functions";
import {
  Twitter,
  Instagram,
  Youtube,
  Github,
  Compass,
  Rss,
  Users,
  MessageSquare,
  Tag,
  LayoutDashboard,
  Settings,
  LogIn,
  ShieldCheck,
  Lock,
  FileText,
  Cookie,
  Mail,
  ArrowUpRight,
  Send,
  UserCircle2,
  Scale,
  Share2,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";

type FooterLink = { to: string; label: string; icon: LucideIcon };

const exploreLinks: FooterLink[] = [
  { to: "/browse", label: "Browse", icon: Compass },
  { to: "/feed", label: "Feed", icon: Rss },
  { to: "/trainers", label: "Creators", icon: Users },
  { to: "/community", label: "Community", icon: MessageSquare },
  { to: "/pricing", label: "Pricing", icon: Tag },
];

const legalLinks: FooterLink[] = [
  { to: "/privacy", label: "Privacy Policy", icon: Lock },
  { to: "/terms", label: "Terms of Service", icon: FileText },
  { to: "/cookies", label: "Cookie Policy", icon: Cookie },
  { to: "/contact", label: "Contact", icon: Mail },
];

const socials = [
  { href: "https://twitter.com", label: "Twitter", icon: Twitter },
  { href: "https://instagram.com", label: "Instagram", icon: Instagram },
  { href: "https://youtube.com", label: "YouTube", icon: Youtube },
  { href: "https://github.com", label: "GitHub", icon: Github },
];

const columnLinkClass =
  "group/link relative inline-flex min-h-11 w-full items-center gap-3 rounded-sm py-1.5 pl-1 pr-2 text-[11px] font-medium uppercase tracking-[0.18em] text-foreground/85 outline-none transition-colors hover:text-premium focus-visible:text-premium focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const columnHeadingClass =
  "flex items-center gap-2 font-display text-[10px] font-bold uppercase tracking-[0.28em] text-muted-foreground";

function FooterColumn({
  id,
  title,
  links,
  icon: HeadingIcon,
}: {
  id: string;
  title: string;
  links: FooterLink[];
  icon: LucideIcon;
}) {
  const [open, setOpen] = useState(false);
  const panelId = `${id}-panel`;
  return (
    <nav aria-labelledby={id}>
      <h4 id={id} className="m-0">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={panelId}
          className={`${columnHeadingClass} group/head flex w-full items-center gap-2 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:pointer-events-none sm:py-0`}
        >
          <span
            aria-hidden
            className="grid h-5 w-5 place-items-center border border-hairline bg-surface-1/60 text-premium"
          >
            <HeadingIcon className="h-3 w-3" strokeWidth={2} />
          </span>
          <span>{title}</span>
          <span aria-hidden className="ml-1 h-px flex-1 bg-hairline" />
          <ChevronDown
            aria-hidden
            className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform sm:hidden ${open ? "rotate-180 text-premium" : ""}`}
            strokeWidth={2}
          />
        </button>
      </h4>
      <div
        id={panelId}
        aria-hidden={!open}
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none sm:!grid-rows-[1fr] sm:!opacity-100 ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <ul className="min-h-0 space-y-4 overflow-hidden [&>li]:pt-0 sm:mt-6 sm:pt-0 pt-4">
          {links.map((l) => (
            <li key={l.to}>
              <Link
                to={l.to}
                tabIndex={open ? undefined : -1}
                className={`${columnLinkClass} sm:[tab-index:0]`}
              >
                <span
                  aria-hidden
                  className="grid h-7 w-7 shrink-0 place-items-center border border-hairline bg-surface-1/60 text-foreground/70 transition-colors group-hover/link:border-premium/60 group-hover/link:text-premium group-focus-visible/link:border-premium group-focus-visible/link:text-premium"
                >
                  <l.icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                </span>
                <span className="flex-1">{l.label}</span>
                <ArrowUpRight
                  aria-hidden
                  className="h-3 w-3 -translate-x-1 opacity-0 transition-all group-hover/link:translate-x-0 group-hover/link:opacity-100 group-focus-visible/link:translate-x-0 group-focus-visible/link:opacity-100"
                  strokeWidth={2}
                />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

export function Footer() {
  const year = new Date().getFullYear();
  const [user, setUser] = useState<User | null>(null);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const checkAdmin = useServerFn(isAdmin);

  const pathname = useRouter().state.location.pathname;
  const [isAdminRoute, setIsAdminRoute] = useState(() => {
    if (typeof window !== "undefined") {
      return window.location.pathname.startsWith("/admin");
    }
    return pathname.startsWith("/admin");
  });

  useEffect(() => {
    setIsAdminRoute(pathname.startsWith("/admin"));
  }, [pathname]);

  if (isAdminRoute) return null;

  useEffect(() => {
    let active = true;

    const syncAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const u = session?.user ?? null;
        if (!active) return;
        setUser(u);
        if (u) {
          try {
            const admin = await checkAdmin();
            if (active) setIsAdminUser(admin);
          } catch {
            if (active) setIsAdminUser(false);
          }
        } else {
          if (active) setIsAdminUser(false);
        }
      } catch {
        if (active) {
          setUser(null);
          setIsAdminUser(false);
        }
      }
    };

    syncAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        checkAdmin()
          .then((admin) => {
            if (active) setIsAdminUser(admin);
          })
          .catch(() => {
            if (active) setIsAdminUser(false);
          });
      } else {
        if (active) setIsAdminUser(false);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [checkAdmin]);

  const accountLinks = useMemo(() => {
    const links: FooterLink[] = [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/settings", label: "Settings", icon: Settings },
    ];

    if (!user) {
      links.push({ to: "/auth", label: "Sign in", icon: LogIn });
    }

    if (user && isAdminUser) {
      links.push({ to: "/admin", label: "Admin", icon: ShieldCheck });
    }

    return links;
  }, [user, isAdminUser]);

  return (
    <footer
      aria-labelledby="footer-heading"
      className="relative mt-16 bg-background text-foreground"
    >
      <h2 id="footer-heading" className="sr-only">
        Site footer
      </h2>

      {/* Top hairline mirrors the header's bottom edge */}
      <div aria-hidden className="border-t border-hairline-strong" />
      <div
        aria-hidden
        className="pointer-events-none h-px w-full bg-gradient-to-r from-transparent via-premium/50 to-transparent"
      />

      <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        {/* Newsletter row — split, hairline divider between copy and form */}
        <div className="grid grid-cols-1 border-b border-hairline lg:grid-cols-2">
          <div className="flex flex-col justify-center py-10 md:py-14 lg:pr-12">
            <h3 className="font-display text-[26px] uppercase leading-[0.95] tracking-tight text-foreground sm:text-3xl md:text-4xl">
              Join the <span className="text-premium">Inner Circle</span>
            </h3>
            <p className="mt-3 max-w-sm text-[12px] font-light leading-relaxed tracking-wide text-muted-foreground sm:text-[13px]">
              Weekly drills, coach picks, and platform updates delivered straight to your inbox.
            </p>
          </div>

          <div className="flex items-center border-t border-hairline py-8 md:py-14 lg:border-l lg:border-t-0 lg:pl-12">
            <form
              onSubmit={(e) => e.preventDefault()}
              aria-label="Subscribe to the newsletter"
              className="flex w-full flex-col gap-2.5 sm:flex-row sm:gap-3"
            >
              <label htmlFor="footer-email" className="sr-only">
                Email address
              </label>
              <input
                id="footer-email"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                placeholder="EMAIL ADDRESS"
                className="h-12 w-full min-w-0 flex-grow border border-hairline bg-surface-1 px-4 text-[11px] font-medium uppercase tracking-[0.18em] text-foreground placeholder:text-muted-foreground outline-none transition-colors hover:border-hairline-strong focus-visible:border-premium focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:px-5 sm:tracking-[0.2em]"
              />
              <button
                type="submit"
                className="group/sub inline-flex h-12 w-full shrink-0 items-center justify-center gap-2 whitespace-nowrap bg-premium px-6 text-[11px] font-bold uppercase tracking-[0.2em] text-premium-foreground outline-none transition-all hover:shadow-[0_0_24px_-4px_var(--premium)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-auto sm:px-8"
              >
                <span>Subscribe</span>
                <Send aria-hidden className="h-3.5 w-3.5 transition-transform group-hover/sub:translate-x-0.5" strokeWidth={2} />
              </button>
            </form>
          </div>
        </div>

        {/* Main link grid */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 py-10 sm:grid-cols-3 sm:gap-x-8 md:py-14 lg:grid-cols-5 lg:gap-x-12">
          {/* Brand column */}
          <div className="col-span-2 sm:col-span-3 lg:col-span-2">
            <Link
              to="/"
              aria-label="LEER home"
            className="group inline-flex items-baseline gap-0.5 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <span className="font-display text-[2.25rem] uppercase leading-none tracking-tight text-foreground sm:text-4xl">
                LEER
              </span>
              <span className="text-[2.25rem] leading-none text-premium sm:text-4xl">.</span>
            </Link>
            <p className="mt-5 max-w-xs text-[13px] leading-relaxed text-muted-foreground sm:mt-6">
              Engineered for the elite. Certified coaches, disciplined training, and a global
              community built one session at a time.
            </p>
            <h4 className="mt-7 flex items-center gap-2 font-display text-[10px] font-bold uppercase tracking-[0.28em] text-muted-foreground sm:mt-8">
              <span
                aria-hidden
                className="grid h-5 w-5 place-items-center border border-hairline bg-surface-1/60 text-premium"
              >
                <Share2 className="h-3 w-3" strokeWidth={2} />
              </span>
              <span>Follow</span>
              <span aria-hidden className="ml-1 h-px flex-1 bg-hairline" />
            </h4>
            <ul className="mt-4 flex flex-wrap gap-2.5 sm:gap-3" aria-label="Social links">
              {socials.map((s) => (
                <li key={s.label}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={`${s.label} (opens in a new tab)`}
                    className="grid h-11 w-11 place-items-center border border-hairline bg-surface-1/60 text-foreground/80 outline-none transition-colors hover:border-premium/60 hover:text-premium focus-visible:border-premium focus-visible:text-premium focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <s.icon aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <FooterColumn id="footer-explore" title="Explore" icon={Compass} links={exploreLinks} />
          <FooterColumn id="footer-account" title="Account" icon={UserCircle2} links={accountLinks} />
          <FooterColumn id="footer-legal" title="Legal" icon={Scale} links={legalLinks} />
        </div>

        {/* Bottom strip */}
        <div className="flex flex-col items-center justify-between gap-3 border-t border-hairline py-6 text-center md:flex-row md:gap-4 md:py-8 md:text-left">
          <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground sm:tracking-[0.3em]">
            © {year} LEER. All rights reserved.
          </p>
          <div className="flex items-center gap-2">
            <span className="h-1 w-1 rounded-full bg-premium shadow-[0_0_8px_var(--premium)]" />
            <p className="text-[10px] uppercase tracking-[0.25em] text-foreground/60 sm:tracking-[0.3em]">
              Engineered for the unrelenting
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
