import { useEffect, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Menu,
  X,
  User as UserIcon,
  LogOut,
  Shield,
  Search,
  MessageSquare,
  Settings as SettingsIcon,
  Home,
  Newspaper,
  Compass,
  Clapperboard,
  Dumbbell,
  Users,
  LogIn,
  HelpCircle,
  BookMarked,
  LineChart,
  Tag,
  ChevronDown,
  LayoutDashboard,
  Wallet,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useProfileMode } from "@/lib/profile-mode-context";
import { Button } from "./ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { isAdmin } from "@/lib/auth-functions";
import { getUserWalletBalance } from "@/lib/wallet-functions";
import { NotificationBell } from "./notification-bell";
import { HeaderSearch } from "./header-search";
import { UserAvatar } from "./user-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { AvatarImage } from "./ui/avatar";

type NavLink = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  hover: string;
};

// Primary nav: the few most-important destinations. Keep this tight.
const HOVER = "hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0";
const BASE_PRIMARY_LINKS: NavLink[] = [
  { to: "/feed",      label: "Feed",      icon: Newspaper,    accent: "text-foreground/60", hover: HOVER },
  { to: "/explore",   label: "Explore",   icon: Compass,      accent: "text-foreground/60", hover: "hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0" },
  { to: "/trainers",  label: "Creators",  icon: Dumbbell,     accent: "text-foreground/60", hover: "hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0" },
  { to: "/shorts",    label: "Shorts",    icon: Clapperboard, accent: "text-foreground/60", hover: "hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0" },
  { to: "/community", label: "Community", icon: Users,        accent: "text-foreground/60", hover: "hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0" },
  { to: "/pricing",   label: "Pricing",   icon: Tag,          accent: "text-foreground/60", hover: HOVER },
];

function getPrimaryLinks(authed: boolean, isCreatorMode: boolean = false): NavLink[] {
  const base = isCreatorMode
    ? BASE_PRIMARY_LINKS.filter((l) => l.to !== "/pricing")
    : BASE_PRIMARY_LINKS;

  if (!authed) return base;
  return [
    { to: "/home", label: "Home", icon: Home, accent: "text-foreground/60", hover: HOVER },
    ...base,
  ];
}

// Secondary sub-nav: related pages that live one shelf below.
function getSecondaryLinks(authed: boolean): NavLink[] {
  const links: NavLink[] = [];
  if (authed) {
    links.push(
      { to: "/library",           label: "Library",  icon: BookMarked, accent: "text-foreground/60", hover: "hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0" },
      { to: "/qa",                label: "Paid Q&A", icon: HelpCircle, accent: "text-premium",       hover: "hover:bg-premium/10 hover:text-premium" },
      { to: "/creator/dashboard", label: "Earnings", icon: LineChart,  accent: "text-foreground/60", hover: "hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0" },
    );
  }
  return links;
}

function initialsFrom(user: User | null): string {
  const src =
    (user?.user_metadata?.full_name as string | undefined) ||
    (user?.user_metadata?.name as string | undefined) ||
    user?.email ||
    "?";
  const parts = src.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const second = parts[1]?.[0] ?? "";
  return (first + second).toUpperCase();
}

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const checkAdmin = useServerFn(isAdmin);
  const getWallet = useServerFn(getUserWalletBalance);
  const { mode } = useProfileMode();

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

  const walletQuery = useQuery({
    queryKey: ["user-wallet"],
    queryFn: () => getWallet(),
    enabled: !!user,
  });

  const trainerStatusQuery = useQuery({
    queryKey: ["navbar-trainer-status", user?.id],
    queryFn: async () => {
      if (!user) return { isApproved: false, isPending: false };
      const [{ data: app }, { data: prof }, { data: role }] = await Promise.all([
        supabase
          .from("trainer_applications")
          .select("status")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("trainer_profiles")
          .select("user_id")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "trainer")
          .maybeSingle(),
      ]);
      const hasTrainerRole = !!role;
      const isApproved = hasTrainerRole || (app?.status === "approved" && !!prof);
      const isPending = app?.status === "pending" && !isApproved;
      return { isApproved, isPending };
    },
    enabled: !!user,
  });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close mobile drawer on Escape, and lock body scroll while open.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [mobileOpen]);

  // Close the drawer whenever the route changes.
  useEffect(() => {
    const unsub = router.subscribe("onResolved", () => setMobileOpen(false));
    return () => unsub();
  }, [router]);

  const handleAdminClick = (e: React.MouseEvent) => {
    if (!user) {
      e.preventDefault();
      const toastId = "admin-signin-required";
      toast.warning("Sign in required to access the admin panel.", {
        id: toastId,
        description: "Redirecting you to the sign-in page…",
        position: "top-center",
        duration: Infinity,
      });
      setMobileOpen(false);
      Promise.resolve(
        router.navigate({
          to: "/auth",
          search: { intent: "admin", redirect: "/admin" },
        }),
      )
        .then(async () => {
          await new Promise<void>((resolve) => {
            const check = () => {
              const s = router.state;
              if (
                s.location.pathname === "/auth" &&
                s.status === "idle" &&
                !s.isLoading &&
                !s.isTransitioning
              ) {
                resolve();
                return true;
              }
              return false;
            };
            if (check()) return;
            const unsub = router.subscribe("onResolved", () => {
              if (check()) unsub();
            });
          });
        })
        .finally(() => {
          toast.dismiss(toastId);
        });
    }
  };

  useQuery({
    queryKey: ["navbar-user"],
    queryFn: async () => {
      const {
        data: { user: u },
      } = await supabase.auth.getUser();
      setUser(u);
      if (u) {
        try {
          const admin = await checkAdmin();
          setIsAdminUser(admin);
        } catch {
          setIsAdminUser(false);
        }
        try {
          const { data: prof } = await supabase
            .from("profiles")
            .select("avatar_url, avatar_urls")
            .eq("user_id", u.id)
            .maybeSingle();
          const urls = (prof?.avatar_urls as { sm?: string; md?: string; lg?: string } | null) ?? null;
          const resolved =
            (prof?.avatar_url as string | null) ||
            urls?.sm ||
            urls?.md ||
            urls?.lg ||
            (u.user_metadata?.avatar_url as string | null) ||
            (u.user_metadata?.picture as string | null) ||
            null;
          setAvatarUrl(resolved);
        } catch {
          const fallback =
            (u.user_metadata?.avatar_url as string | null) ||
            (u.user_metadata?.picture as string | null) ||
            null;
          setAvatarUrl(fallback);
        }
      } else {
        setAvatarUrl(null);
      }
      return u;
    },
    staleTime: 1000 * 60,
  });

  const handleLogout = async () => {
    const { markManualSignOut } = await import("@/lib/session-lifecycle");
    markManualSignOut();
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    setUser(null);
    setIsAdminUser(false);
    router.navigate({ to: "/", replace: true });
  };

  const isTrainer = !!trainerStatusQuery.data?.isApproved;
  // Trainers are always in creator mode — no switching needed.
  const primary = getPrimaryLinks(!!user, isTrainer);
  const secondary = getSecondaryLinks(!!user);
  const initials = initialsFrom(user);
  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ||
    (user?.user_metadata?.name as string | undefined) ||
    user?.email ||
    "";

  return (
    <header
      data-scrolled={scrolled || mobileOpen ? "true" : "false"}
      className={`sticky top-0 z-50 w-full transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300 ease-out ${
        scrolled || mobileOpen
          ? "border-b border-hairline-strong bg-background/90 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.7)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/75"
          : "border-b border-hairline bg-background/60 backdrop-blur-md supports-[backdrop-filter]:bg-background/40"
      }`}
    >
      <div
        className={`pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-premium/70 to-transparent transition-opacity duration-300 ${
          scrolled ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Row 1: primary navbar */}
      <div
        className={`grid w-full grid-cols-[auto_1fr_auto] items-center gap-2 px-3 transition-[height] duration-300 ease-out sm:gap-4 sm:px-6 lg:px-10 xl:px-14 ${
          scrolled ? "h-14" : "h-16"
        }`}
      >
        {/* Logo */}
        <Link
          to={isAdminUser ? "/admin" : "/"}
          className="group flex min-w-0 shrink-0 items-center gap-2.5 text-foreground"
        >
          <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-foreground text-background transition-transform duration-300 motion-safe:group-hover:rotate-6">
            <span className="block h-3.5 w-3.5 rotate-45 bg-background" />
            <span className="pointer-events-none absolute -bottom-1 -right-1 h-1.5 w-1.5 rounded-full bg-premium shadow-[0_0_10px_var(--premium)]" />
          </span>
          <span className="font-display text-xl uppercase leading-none tracking-[0.02em] text-foreground sm:text-2xl">
            LEER {isAdminUser && <span className="ml-1.5 rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] lowercase tracking-normal text-primary">admin</span>}
          </span>
        </Link>

        {/* Primary desktop nav — kept tight. Shown at xl+ to avoid overlapping the logo on tablets and small laptops. */}
        <nav className="hidden min-w-0 items-center justify-center gap-0.5 xl:flex">
          {primary.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.to}
                to={link.to}
                activeProps={{
                  className:
                    "!text-foreground [&>span.nav-underline-marker]:scale-x-100 [&>span.nav-underline-marker]:opacity-100",
                }}
                activeOptions={{ exact: link.to === "/" }}
                className={`group relative flex items-center gap-1.5 rounded-sm px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/60 transition-colors duration-200 ${link.hover}`}
              >
                <Icon className="h-3.5 w-3.5 opacity-70 transition-opacity group-hover:opacity-100" />
                <span>{link.label}</span>
                <span
                  aria-hidden
                  className="nav-underline-marker pointer-events-none absolute inset-x-2 -bottom-0.5 h-[2px] origin-center scale-x-0 rounded-none bg-premium opacity-0 shadow-[0_0_8px_var(--premium)] transition-all duration-300"
                />
              </Link>
            );
          })}
        </nav>

        {/* Right cluster */}
        <div className="col-start-3 flex shrink-0 items-center justify-end gap-0.5 justify-self-end sm:gap-1.5">
          <HeaderSearch />

          {user ? (
            <>
              <NotificationBell />
              <Link
                to="/messages"
                aria-label="Messages"
                className="hidden h-9 w-9 items-center justify-center rounded-sm border border-hairline bg-accent/40 text-foreground/70 transition-colors hover:border-hairline-strong hover:bg-accent hover:text-foreground sm:flex"
              >
                <MessageSquare className="h-4 w-4" />
              </Link>
              <Link
                to="/wallet"
                aria-label="Wallet"
                className="hidden items-center gap-1.5 rounded-sm border border-hairline bg-accent/40 px-2.5 py-1 text-xs font-semibold text-foreground/80 transition-colors hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-500 sm:flex"
              >
                <Wallet className="h-4 w-4 text-emerald-500" />
                <span>
                  {walletQuery.data
                    ? `${walletQuery.data.currency === "USD" ? "$" : ""}${walletQuery.data.balance.toFixed(2)}`
                    : "Wallet"}
                </span>
              </Link>

              {/* User avatar dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="ml-0.5 hidden items-center gap-2 rounded-sm border border-hairline bg-accent/40 py-1 pl-1 pr-2 text-sm text-foreground transition-colors hover:border-hairline-strong hover:bg-accent sm:flex"
                    aria-label="Open user menu"
                  >
                    <UserAvatar src={avatarUrl} name={displayName || initials} size="sm" className="h-7 w-7" />
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  {/* ── Profile header ── */}
                  <DropdownMenuLabel className="flex items-center gap-3 py-2">
                    <UserAvatar src={avatarUrl} name={displayName || initials} size="md" className="h-9 w-9" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {isTrainer ? (
                          <span className="inline-flex items-center gap-1 rounded-sm bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-amber-500">
                            <Dumbbell className="h-2.5 w-2.5" /> Trainer
                          </span>
                        ) : trainerStatusQuery.data?.isPending ? (
                          <span className="inline-flex items-center gap-1 rounded-sm bg-amber-400/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-amber-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" /> Pending Review
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-sm bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-emerald-500">
                            <UserIcon className="h-2.5 w-2.5" /> Athlete
                          </span>
                        )}
                      </div>
                    </div>
                  </DropdownMenuLabel>

                  <DropdownMenuSeparator />

                  {/* ── Account (common for all) ── */}
                  <DropdownMenuLabel className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Account
                  </DropdownMenuLabel>
                  <DropdownMenuItem asChild>
                    <Link to={isTrainer ? "/creator/dashboard" : "/dashboard"} className="flex w-full items-center font-semibold text-foreground">
                      <LayoutDashboard className="mr-2 h-4 w-4 text-primary" />
                      {isTrainer ? "Creator Studio" : "My Dashboard"}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/profile" className="flex w-full items-center">
                      <UserIcon className="mr-2 h-4 w-4 text-premium" /> My Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/wallet" className="flex w-full items-center justify-between">
                      <div className="flex items-center">
                        <Wallet className="mr-2 h-4 w-4 text-emerald-500" /> Wallet
                      </div>
                      {walletQuery.data && (
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-500">
                          {walletQuery.data.currency === "USD" ? "$" : ""}
                          {walletQuery.data.balance.toFixed(2)}
                        </span>
                      )}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/messages" className="flex w-full items-center">
                      <MessageSquare className="mr-2 h-4 w-4 text-foreground/70" /> Messages
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/settings" className="flex w-full items-center">
                      <SettingsIcon className="mr-2 h-4 w-4 text-foreground/70" /> Settings
                    </Link>
                  </DropdownMenuItem>

                  {/* ── Trainer: Creator Studio section ── */}
                  {isTrainer ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-widest text-amber-500">
                        Creator Studio
                      </DropdownMenuLabel>
                      <DropdownMenuItem asChild>
                        <Link to="/creator/dashboard" className="flex w-full items-center">
                          <LineChart className="mr-2 h-4 w-4 text-amber-500" /> Earnings &amp; Payouts
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/qa" className="flex w-full items-center">
                          <HelpCircle className="mr-2 h-4 w-4 text-premium" /> Q&amp;A Inbox
                        </Link>
                      </DropdownMenuItem>
                    </>
                  ) : (
                    /* ── Trainee: Content section ── */
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        Content
                      </DropdownMenuLabel>
                      <DropdownMenuItem asChild>
                        <Link to="/library" className="flex w-full items-center">
                          <BookMarked className="mr-2 h-4 w-4 text-foreground/70" /> My Library
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/qa" className="flex w-full items-center">
                          <HelpCircle className="mr-2 h-4 w-4 text-premium" /> Paid Q&amp;A Inbox
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}

                  {isAdminUser && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        Staff
                      </DropdownMenuLabel>
                      <DropdownMenuItem asChild>
                        <Link to="/admin" onClick={handleAdminClick} className="flex w-full items-center">
                          <Shield className="mr-2 h-4 w-4 text-premium" /> Admin
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="text-premium focus:text-premium"
                  >
                    <LogOut className="mr-2 h-4 w-4" /> Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <div className="hidden items-center gap-1.5 sm:flex">
              <Link to="/auth">
                <Button variant="ghost" size="sm" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/70 hover:text-foreground">
                  <LogIn className="mr-1.5 h-4 w-4" /> Log in
                </Button>
              </Link>
              <Link to="/auth">
                <Button
                  size="sm"
                  className="relative overflow-hidden rounded-sm bg-premium px-4 text-[11px] font-bold uppercase tracking-[0.18em] text-premium-foreground shadow-none transition-all hover:bg-premium hover:shadow-[0_0_20px_-2px_var(--premium)]"
                >
                  Get started
                </Button>
              </Link>
            </div>
          )}

          {/* Mobile hamburger */}
          <button
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-hairline bg-accent/40 text-foreground transition-colors hover:border-hairline-strong hover:bg-accent xl:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav-drawer"
          >
            <Menu
              className={`absolute h-5 w-5 transition-all duration-300 ${
                mobileOpen ? "rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100"
              }`}
            />
            <X
              className={`absolute h-5 w-5 transition-all duration-300 ${
                mobileOpen ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-50 opacity-0"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Row 2: secondary sub-nav (desktop only) */}
      {/* Secondary links now live inside the user avatar dropdown to keep the header a single row. */}

      {/* Mobile drawer */}
      <div
        id="mobile-nav-drawer"
        aria-hidden={!mobileOpen}
        className={`absolute inset-x-0 top-full grid overflow-hidden transition-opacity duration-150 motion-safe:transition-[grid-template-rows,opacity] motion-safe:duration-300 xl:hidden ${
          mobileOpen ? "grid-rows-[1fr] opacity-100" : "pointer-events-none grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="min-h-0 max-h-[calc(100dvh-3.5rem)] overflow-y-auto overscroll-contain border-t border-hairline-strong bg-background/95 pb-[env(safe-area-inset-bottom)] shadow-[0_18px_40px_-18px_rgba(0,0,0,0.7)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/80">
          {user && (
            <div className="mx-auto flex max-w-7xl items-center gap-3 border-b border-hairline px-4 py-3 sm:px-6">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-foreground text-sm font-semibold text-background">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
                <p className="truncate text-xs text-muted-foreground">Signed in</p>
              </div>
            </div>
          )}

          <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">Main</p>
            <nav className="grid grid-cols-2 gap-2">
              {primary.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setMobileOpen(false)}
                    tabIndex={mobileOpen ? 0 : -1}
                    activeProps={{ className: "!bg-accent !text-foreground !border-premium/60" }}
                    activeOptions={{ exact: link.to === "/" }}
                    className={`group flex items-center gap-2.5 rounded-sm border border-hairline bg-accent/40 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/70 transition-colors ${link.hover}`}
                  >
                    <Icon className="h-4 w-4 shrink-0 opacity-70" />
                    <span className="truncate">{link.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {secondary.length > 0 && (
          <div className="mx-auto max-w-7xl border-t border-hairline px-4 py-3 sm:px-6">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">Explore more</p>
            <nav className="grid grid-cols-2 gap-2">
              {secondary.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setMobileOpen(false)}
                    tabIndex={mobileOpen ? 0 : -1}
                    activeProps={{ className: "!bg-accent !text-foreground !border-premium/60" }}
                    className={`group flex items-center gap-2.5 rounded-sm border border-hairline bg-accent/40 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/70 transition-colors ${link.hover}`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
                    <span className="truncate">{link.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
          )}

          <div className="mx-auto max-w-7xl border-t border-hairline px-4 py-3 sm:px-6">
            {user ? (
              <div className="grid grid-cols-2 gap-2">
                <Link to="/dashboard" onClick={() => setMobileOpen(false)} tabIndex={mobileOpen ? 0 : -1}>
                  <Button variant="outline" size="sm" className="w-full justify-start border-hairline bg-accent/40 text-foreground/80 hover:border-hairline-strong hover:bg-accent hover:text-accent-foreground">
                    <UserIcon className="mr-2 h-4 w-4 text-foreground/70" /> Dashboard
                  </Button>
                </Link>
                <Link to="/profile" onClick={() => setMobileOpen(false)} tabIndex={mobileOpen ? 0 : -1}>
                  <Button variant="outline" size="sm" className="w-full justify-start border-hairline bg-accent/40 text-foreground/80 hover:border-hairline-strong hover:bg-accent hover:text-accent-foreground">
                    <UserIcon className="mr-2 h-4 w-4 text-premium" /> My Profile
                  </Button>
                </Link>
                <Link to="/wallet" onClick={() => setMobileOpen(false)} tabIndex={mobileOpen ? 0 : -1}>
                  <Button variant="outline" size="sm" className="w-full justify-between border-hairline bg-accent/40 text-foreground/80 hover:border-hairline-strong hover:bg-accent hover:text-accent-foreground">
                    <span className="flex items-center">
                      <Wallet className="mr-2 h-4 w-4 text-emerald-500" /> Wallet
                    </span>
                    {walletQuery.data && (
                      <span className="text-xs font-bold text-emerald-500">
                        {walletQuery.data.currency === "USD" ? "$" : ""}
                        {walletQuery.data.balance.toFixed(2)}
                      </span>
                    )}
                  </Button>
                </Link>
                <Link to="/messages" onClick={() => setMobileOpen(false)} tabIndex={mobileOpen ? 0 : -1}>
                  <Button variant="outline" size="sm" className="w-full justify-start border-hairline bg-accent/40 text-foreground/80 hover:border-hairline-strong hover:bg-accent hover:text-accent-foreground">
                    <MessageSquare className="mr-2 h-4 w-4 text-foreground/70" /> Messages
                  </Button>
                </Link>
                <Link to="/settings" onClick={() => setMobileOpen(false)} tabIndex={mobileOpen ? 0 : -1}>
                  <Button variant="outline" size="sm" className="w-full justify-start border-hairline bg-accent/40 text-foreground/80 hover:border-hairline-strong hover:bg-accent hover:text-accent-foreground">
                    <SettingsIcon className="mr-2 h-4 w-4 text-foreground/70" /> Settings
                  </Button>
                </Link>
                {isAdminUser && (
                  <Link
                    to="/admin"
                    tabIndex={mobileOpen ? 0 : -1}
                    onClick={(e) => {
                      handleAdminClick(e);
                      setMobileOpen(false);
                    }}
                  >
                    <Button variant="outline" size="sm" className="w-full justify-start border-premium/40 bg-premium/[0.06] text-premium hover:border-premium/60 hover:bg-premium/10">
                      <Shield className="mr-2 h-4 w-4" /> Admin
                    </Button>
                  </Link>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  tabIndex={mobileOpen ? 0 : -1}
                  className="col-span-2 w-full justify-start border-premium/30 bg-premium/[0.04] text-premium hover:border-premium/60 hover:bg-premium/10"
                  onClick={() => {
                    setMobileOpen(false);
                    handleLogout();
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4" /> Log out
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Link to="/auth" onClick={() => setMobileOpen(false)} tabIndex={mobileOpen ? 0 : -1}>
                  <Button variant="outline" size="sm" className="w-full border-hairline bg-accent/40 text-foreground/80 hover:border-hairline-strong hover:bg-accent hover:text-accent-foreground">
                    <LogIn className="mr-2 h-4 w-4" /> Log in
                  </Button>
                </Link>
                <Link to="/auth" onClick={() => setMobileOpen(false)} tabIndex={mobileOpen ? 0 : -1}>
                  <Button
                    size="sm"
                    className="w-full rounded-sm bg-premium text-[11px] font-bold uppercase tracking-[0.18em] text-premium-foreground hover:bg-premium hover:shadow-[0_0_20px_-2px_var(--premium)]"
                  >
                    Get started
                  </Button>
                </Link>
                <Link
                  to="/admin"
                  className="col-span-2"
                  tabIndex={mobileOpen ? 0 : -1}
                  onClick={(e) => {
                    handleAdminClick(e);
                    setMobileOpen(false);
                  }}
                >
                  <Button variant="ghost" size="sm" className="w-full text-foreground/70 hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0">
                    <Shield className="mr-2 h-4 w-4" /> Go to Admin
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
