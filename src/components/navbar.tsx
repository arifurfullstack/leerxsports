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
  Compass,
  LayoutGrid,
  Clapperboard,
  Dumbbell,
  Users,
  GraduationCap,
  Info,
  LogIn,
  Sparkles,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "./ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { isAdmin } from "@/lib/auth-functions";
import { NotificationBell } from "./notification-bell";

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const checkAdmin = useServerFn(isAdmin);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
          // Wait until the /auth route is mounted AND the router is idle
          // (loaders resolved, pending components flushed) before dismissing.
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
      }
      return u;
    },
    staleTime: 1000 * 60,
  });

  const handleLogout = async () => {
    // Sign-out hygiene: cancel in-flight queries → clear cache → sign out →
    // replace history so back-button can't restore protected shells.
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    setUser(null);
    setIsAdminUser(false);
    router.navigate({ to: "/auth", replace: true });
  };

  // Each link owns a coordinated hover palette: icon tint + soft background wash +
  // matching ring + colored glow. Kept as literal class strings so Tailwind's JIT
  // includes them at build time.
  // Base transition helpers.
  // `motion-safe:` scopes movement to users who haven't set prefers-reduced-motion.
  // Under reduced motion we still show hover *feedback* (color, bg, ring, shadow)
  // but skip transforms, gradient sweeps, and the drawer height animation.
  const navLinks = [
    {
      to: "/feed",
      label: "Feed",
      icon: Home,
      accent: "text-sky-500",
      hover:
        "hover:bg-sky-500/10 hover:text-sky-600 hover:ring-sky-500/25 motion-safe:hover:shadow-[0_6px_20px_-10px] motion-safe:hover:shadow-sky-500/60 dark:hover:text-sky-300",
    },
    {
      to: "/explore",
      label: "Explore",
      icon: Compass,
      accent: "text-fuchsia-500",
      hover:
        "hover:bg-fuchsia-500/10 hover:text-fuchsia-600 hover:ring-fuchsia-500/25 motion-safe:hover:shadow-[0_6px_20px_-10px] motion-safe:hover:shadow-fuchsia-500/60 dark:hover:text-fuchsia-300",
    },
    {
      to: "/browse",
      label: "Browse",
      icon: LayoutGrid,
      accent: "text-emerald-500",
      hover:
        "hover:bg-emerald-500/10 hover:text-emerald-600 hover:ring-emerald-500/25 motion-safe:hover:shadow-[0_6px_20px_-10px] motion-safe:hover:shadow-emerald-500/60 dark:hover:text-emerald-300",
    },
    {
      to: "/shorts",
      label: "Shorts",
      icon: Clapperboard,
      accent: "text-rose-500",
      hover:
        "hover:bg-rose-500/10 hover:text-rose-600 hover:ring-rose-500/25 motion-safe:hover:shadow-[0_6px_20px_-10px] motion-safe:hover:shadow-rose-500/60 dark:hover:text-rose-300",
    },
    {
      to: "/trainers",
      label: "Trainers",
      icon: Dumbbell,
      accent: "text-orange-500",
      hover:
        "hover:bg-orange-500/10 hover:text-orange-600 hover:ring-orange-500/25 motion-safe:hover:shadow-[0_6px_20px_-10px] motion-safe:hover:shadow-orange-500/60 dark:hover:text-orange-300",
    },
    {
      to: "/community",
      label: "Community",
      icon: Users,
      accent: "text-violet-500",
      hover:
        "hover:bg-violet-500/10 hover:text-violet-600 hover:ring-violet-500/25 motion-safe:hover:shadow-[0_6px_20px_-10px] motion-safe:hover:shadow-violet-500/60 dark:hover:text-violet-300",
    },
    {
      to: "/coaching",
      label: "Coaching",
      icon: GraduationCap,
      accent: "text-amber-500",
      hover:
        "hover:bg-amber-500/10 hover:text-amber-600 hover:ring-amber-500/25 motion-safe:hover:shadow-[0_6px_20px_-10px] motion-safe:hover:shadow-amber-500/60 dark:hover:text-amber-300",
    },
    {
      to: "/about",
      label: "About",
      icon: Info,
      accent: "text-cyan-500",
      hover:
        "hover:bg-cyan-500/10 hover:text-cyan-600 hover:ring-cyan-500/25 motion-safe:hover:shadow-[0_6px_20px_-10px] motion-safe:hover:shadow-cyan-500/60 dark:hover:text-cyan-300",
    },
  ];

  return (
    <header
      data-scrolled={scrolled || mobileOpen ? "true" : "false"}
      className={`sticky top-0 z-50 w-full transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300 ease-out ${
        scrolled || mobileOpen
          ? "border-b border-border/80 bg-background/85 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.25)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/70"
          : "border-b border-transparent bg-background/40 backdrop-blur-sm supports-[backdrop-filter]:bg-background/30"
      }`}
    >
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent transition-opacity duration-300 ${
          scrolled ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        className={`mx-auto flex max-w-7xl items-center gap-2 px-3 transition-[height] duration-300 ease-out sm:gap-4 sm:px-6 lg:px-8 ${
          scrolled ? "h-14" : "h-16"
        }`}
      >
        {/* Logo */}
        <Link
          to="/"
          className="group flex shrink-0 items-center gap-2.5 text-foreground"
        >
          <span className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-sky-500 via-fuchsia-500 to-orange-500 shadow-lg shadow-fuchsia-500/25 transition-[box-shadow,transform] duration-300 group-hover:shadow-fuchsia-500/50 motion-safe:group-hover:scale-105">
            <span className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-white/0 via-white/30 to-white/0 opacity-0 transition-opacity duration-500 motion-safe:group-hover:opacity-100" />
            <span className="relative font-display text-sm font-bold tracking-widest text-white">L</span>
          </span>
          <span className="hidden bg-gradient-to-r from-foreground via-foreground to-foreground/60 bg-clip-text font-display text-sm uppercase tracking-[0.28em] transition-all duration-300 group-hover:from-sky-500 group-hover:via-fuchsia-500 group-hover:to-orange-500 group-hover:text-transparent sm:inline">
            LEER Sports
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="mx-2 hidden flex-1 items-center justify-center gap-0.5 lg:flex">
          {navLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.to}
                to={link.to}
                activeProps={{
                  className:
                    "!text-foreground bg-primary/10 ring-1 ring-primary/25 shadow-sm",
                }}
                className={`group relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground ring-1 ring-transparent transition-[color,background-color,box-shadow,transform,border-color] duration-200 motion-safe:hover:-translate-y-0.5 ${link.hover}`}
              >
                <Icon
                  className={`h-4 w-4 transition-transform duration-200 ${link.accent} motion-safe:group-hover:scale-110 motion-safe:group-hover:rotate-[-4deg]`}
                />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Desktop actions */}
        <div className="ml-auto hidden shrink-0 items-center gap-1.5 lg:flex">
          <Link
            to="/search"
            aria-label="Search"
            className="group flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-sky-500 transition-[color,background-color,box-shadow,transform,border-color] duration-200 hover:border-sky-500/40 hover:bg-sky-500/10 motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-[0_6px_18px_-8px] motion-safe:hover:shadow-sky-500/60"
          >
            <Search className="h-4 w-4 transition-transform motion-safe:group-hover:scale-110" />
          </Link>
          {user ? (
            <>
              <NotificationBell />
              <Link
                to="/messages"
                aria-label="Messages"
                className="group flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-violet-500 transition-[color,background-color,box-shadow,transform,border-color] duration-200 hover:border-violet-500/40 hover:bg-violet-500/10 motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-[0_6px_18px_-8px] motion-safe:hover:shadow-violet-500/60"
              >
                <MessageSquare className="h-4 w-4 transition-transform motion-safe:group-hover:scale-110" />
              </Link>
              {isAdminUser && (
                <Link to="/admin" onClick={handleAdminClick}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="group text-amber-500 transition-[color,background-color,box-shadow,transform] hover:bg-amber-500/10 hover:text-amber-600 motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-[0_6px_18px_-8px] motion-safe:hover:shadow-amber-500/60"
                  >
                    <Shield className="mr-1.5 h-4 w-4" />
                    Admin
                  </Button>
                </Link>
              )}
              <Link to="/dashboard">
                <Button
                  variant="ghost"
                  size="sm"
                  className="group transition-[color,background-color,box-shadow,transform] hover:bg-emerald-500/10 hover:text-emerald-600 motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-[0_6px_18px_-8px] motion-safe:hover:shadow-emerald-500/60"
                >
                  <UserIcon className="mr-1.5 h-4 w-4 text-emerald-500" />
                  Dashboard
                </Button>
              </Link>
              <Link
                to="/settings"
                aria-label="Settings"
                className="group flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-[color,background-color,box-shadow,transform,border-color] duration-200 hover:border-foreground/30 hover:text-foreground motion-safe:hover:-translate-y-0.5"
              >
                <SettingsIcon className="h-4 w-4 transition-transform duration-500 motion-safe:group-hover:rotate-90" />
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="border-rose-500/30 text-rose-500 transition-[color,background-color,box-shadow,transform,border-color] hover:border-rose-500/60 hover:bg-rose-500/10 hover:text-rose-600 motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-[0_6px_18px_-8px] motion-safe:hover:shadow-rose-500/60"
              >
                <LogOut className="mr-1.5 h-4 w-4" />
                Log out
              </Button>
            </>
          ) : (
            <>
              <Link to="/admin" onClick={handleAdminClick}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-amber-500 transition-[color,background-color,box-shadow,transform] hover:bg-amber-500/10 hover:text-amber-600 motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-[0_6px_18px_-8px] motion-safe:hover:shadow-amber-500/60"
                >
                  <Shield className="mr-1.5 h-4 w-4" />
                  Admin
                </Button>
              </Link>
              <Link to="/auth">
                <Button variant="ghost" size="sm" className="transition-[color,background-color,transform] motion-safe:hover:-translate-y-0.5">
                  <LogIn className="mr-1.5 h-4 w-4" />
                  Log in
                </Button>
              </Link>
              <Link to="/auth">
                <Button
                  size="sm"
                  className="relative overflow-hidden bg-gradient-to-r from-sky-500 via-fuchsia-500 to-orange-500 bg-[length:200%_100%] bg-[position:0%_50%] text-white shadow-md shadow-fuchsia-500/30 transition-[background-position,transform,box-shadow] duration-500 hover:shadow-lg hover:shadow-fuchsia-500/50 motion-safe:hover:-translate-y-0.5 motion-safe:hover:bg-[position:100%_50%]"
                >
                  <Sparkles className="mr-1.5 h-4 w-4" />
                  Get started
                </Button>
              </Link>
            </>
          )}
        </div>

        {/* Mobile / tablet compact actions */}
        <div className="ml-auto flex items-center gap-1 lg:hidden">
          <Link
            to="/search"
            aria-label="Search"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-sky-500 transition-colors hover:bg-sky-500/10"
          >
            <Search className="h-4 w-4" />
          </Link>
          {user && (
            <>
              <NotificationBell />
              <Link
                to="/messages"
                aria-label="Messages"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-violet-500 transition-colors hover:bg-violet-500/10"
              >
                <MessageSquare className="h-4 w-4" />
              </Link>
            </>
          )}
          <button
            className="relative flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-accent"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav-drawer"
          >
            <Menu
              className={`absolute h-5 w-5 transition-opacity duration-200 motion-safe:transition-all motion-safe:duration-300 motion-reduce:transform-none ${
                mobileOpen ? "rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100"
              }`}
            />
            <X
              className={`absolute h-5 w-5 transition-opacity duration-200 motion-safe:transition-all motion-safe:duration-300 motion-reduce:transform-none ${
                mobileOpen ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-50 opacity-0"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Mobile drawer: absolute-positioned overlay so open/close never shifts page content.
          Animated via grid-rows [0fr] -> [1fr] with overflow hidden — a layout-safe
          height transition that works without measuring content. Under
          prefers-reduced-motion the drawer opens/closes instantly (opacity only,
          no height animation) via motion-safe:. */}
      <div
        id="mobile-nav-drawer"
        aria-hidden={!mobileOpen}
        className={`absolute inset-x-0 top-full grid overflow-hidden transition-opacity duration-150 motion-safe:transition-[grid-template-rows,opacity] motion-safe:duration-300 motion-safe:ease-out lg:hidden ${
          mobileOpen ? "grid-rows-[1fr] opacity-100" : "pointer-events-none grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="min-h-0 overflow-hidden border-t border-border bg-background/95 shadow-lg shadow-black/5 backdrop-blur-xl">
          <nav className="mx-auto grid max-w-7xl grid-cols-2 gap-2 px-4 py-4 sm:grid-cols-3 sm:px-6">
            {navLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileOpen(false)}
                  tabIndex={mobileOpen ? 0 : -1}
                  activeProps={{ className: "bg-primary/10 ring-1 ring-primary/30 text-foreground" }}
                  className={`group flex items-center gap-2.5 rounded-xl border border-border/60 bg-card px-3 py-2.5 text-sm font-medium text-muted-foreground transition-[color,background-color,box-shadow,border-color] duration-200 motion-safe:active:scale-[0.98] ${link.hover}`}
                >
                  <Icon className={`h-4 w-4 shrink-0 transition-transform duration-200 ${link.accent} motion-safe:group-hover:scale-110`} />
                  <span className="truncate">{link.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="mx-auto max-w-7xl border-t border-border/60 px-4 py-4 sm:px-6">
            {user ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Link to="/dashboard" onClick={() => setMobileOpen(false)} tabIndex={mobileOpen ? 0 : -1}>
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <UserIcon className="mr-2 h-4 w-4 text-emerald-500" />
                    Dashboard
                  </Button>
                </Link>
                <Link to="/settings" onClick={() => setMobileOpen(false)} tabIndex={mobileOpen ? 0 : -1}>
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <SettingsIcon className="mr-2 h-4 w-4" />
                    Settings
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
                    <Button variant="outline" size="sm" className="w-full justify-start border-amber-500/30 text-amber-600">
                      <Shield className="mr-2 h-4 w-4" />
                      Admin
                    </Button>
                  </Link>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  tabIndex={mobileOpen ? 0 : -1}
                  className="w-full justify-start border-rose-500/30 text-rose-500 hover:bg-rose-500/10"
                  onClick={() => {
                    setMobileOpen(false);
                    handleLogout();
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Link to="/auth" onClick={() => setMobileOpen(false)} tabIndex={mobileOpen ? 0 : -1}>
                  <Button variant="outline" size="sm" className="w-full">
                    <LogIn className="mr-2 h-4 w-4" />
                    Log in
                  </Button>
                </Link>
                <Link to="/auth" onClick={() => setMobileOpen(false)} tabIndex={mobileOpen ? 0 : -1}>
                  <Button
                    size="sm"
                    className="w-full bg-gradient-to-r from-sky-500 via-fuchsia-500 to-orange-500 text-white"
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
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
                  <Button variant="ghost" size="sm" className="w-full text-amber-500 hover:bg-amber-500/10">
                    <Shield className="mr-2 h-4 w-4" />
                    Go to Admin
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
