import { QueryClient, QueryClientProvider, useQueryClient, useQuery } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Toaster } from "@/components/ui/sonner";
import { PerfOverlay } from "@/components/perf-overlay";
import { supabase } from "@/integrations/supabase/client";
import { SessionExpiryWatcher } from "@/components/session-expiry-watcher";
import { AuthGateDialog } from "@/components/auth-gate-dialog";
import { ProfileModeProvider } from "@/lib/profile-mode-context";
import { BecomeCreatorDialog } from "@/components/become-creator-dialog";
import {
  getPublicSiteSettings,
  SITE_SETTINGS_DEFAULTS,
} from "@/lib/site-settings-functions";

function NotFoundComponent() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  loader: async ({ context }) => {
    try {
      const s = await context.queryClient.ensureQueryData({
        queryKey: ["public", "site-settings"],
        queryFn: () => getPublicSiteSettings(),
        staleTime: 60_000,
      });
      return { siteSettings: s };
    } catch {
      return { siteSettings: SITE_SETTINGS_DEFAULTS };
    }
  },
  head: ({ loaderData }) => {
    const s = loaderData?.siteSettings ?? SITE_SETTINGS_DEFAULTS;
    const ogTitle = s.og_title || s.meta_title;
    const ogDesc = s.og_description || s.meta_description;
    const meta: Array<Record<string, string>> = [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: s.meta_title },
      { name: "description", content: s.meta_description },
      { name: "author", content: s.site_name },
      { name: "theme-color", content: s.theme_color },
      { property: "og:site_name", content: s.site_name },
      { property: "og:title", content: ogTitle },
      { property: "og:description", content: ogDesc },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/" },
      { name: "twitter:card", content: "summary_large_image" },
    ];
    if (s.meta_keywords) meta.push({ name: "keywords", content: s.meta_keywords });
    if (s.twitter_handle) meta.push({ name: "twitter:site", content: s.twitter_handle });
    if (s.og_image_url) {
      meta.push({ property: "og:image", content: s.og_image_url });
      meta.push({ name: "twitter:image", content: s.og_image_url });
    }
    const favicon = s.favicon_url || "/favicon.ico";
    return {
      meta,
      links: [
        { rel: "stylesheet", href: appCss },
        { rel: "canonical", href: "/" },
        { rel: "icon", href: favicon },
      ],
    };
  },
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function DynamicSiteFavicon() {
  const { data } = useQuery({
    queryKey: ["public", "site-settings"],
    queryFn: () => getPublicSiteSettings(),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!data?.favicon_url) return;
    let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.getElementsByTagName("head")[0].appendChild(link);
    }
    link.href = data.favicon_url;
  }, [data?.favicon_url]);

  return null;
}

function AppLayout() {
  const router = useRouter();
  const pathname = router.state.location.pathname;
  const isAdminRoute = pathname.startsWith("/admin");
  return (
    <>
      {!isAdminRoute && (
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
        >
          Skip to main content
        </a>
      )}
      <div className={isAdminRoute ? "min-h-dvh" : "flex min-h-dvh flex-col"}>
        {!isAdminRoute && <Navbar />}
        <main id="main-content" tabIndex={-1} className={isAdminRoute ? "min-h-dvh outline-none" : "flex-1 outline-none"}>
          <Outlet />
        </main>
        {!isAdminRoute && <Footer />}
      </div>
    </>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <ProfileModeProvider>
        <AuthStateSync />
        <SessionExpiryWatcher />
        <DynamicSiteFavicon />
        <AppLayout />
        <Toaster />
        <PerfOverlay />
        <AuthGateDialog />
        <BecomeCreatorDialog />
      </ProfileModeProvider>
    </QueryClientProvider>
  );
}

/**
 * Single global auth-state subscriber. Filters to identity transitions so we
 * don't thrash the router or query cache on every TOKEN_REFRESHED /
 * INITIAL_SESSION event. On SIGNED_OUT we intentionally skip
 * invalidateQueries to avoid a 401 storm against the cleared session — the
 * sign-out handler does the deliberate cache teardown.
 */
function AuthStateSync() {
  const router = useRouter();
  const queryClient = useQueryClient();
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);
  return null;
}
