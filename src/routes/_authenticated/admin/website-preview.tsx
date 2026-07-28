import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, RefreshCw, Globe, Search, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  getSiteSettingsAdmin,
  SITE_SETTINGS_DEFAULTS,
  type SiteSettingsInput,
} from "@/lib/site-settings-functions";

export const Route = createFileRoute("/_authenticated/admin/website-preview")({
  component: WebsitePreviewPage,
  head: () => ({ meta: [{ title: "Admin · Website preview" }] }),
});

function WebsitePreviewPage() {
  const load = useServerFn(getSiteSettingsAdmin);
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin", "site-settings", "preview"],
    queryFn: () => load(),
  });

  const s: SiteSettingsInput = { ...SITE_SETTINGS_DEFAULTS, ...(data ?? {}) };
  const displayUrl = "leer.app";
  const canonical = `https://${displayUrl}/`;
  const ogTitle = (s.og_title || s.meta_title || s.site_name || "").trim();
  const ogDesc = (s.og_description || s.meta_description || "").trim();
  const twHandle = s.twitter_handle?.replace(/^@?/, "@") || "";

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Website preview</h1>
          <p className="text-sm text-muted-foreground">
            Live preview of your saved site name, SEO tags, favicon and social share cards.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button asChild size="sm" variant="secondary">
            <Link to="/admin/website">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to settings
            </Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-border/50 bg-card p-10 text-center text-sm text-muted-foreground">
          Loading current settings…
        </div>
      ) : (
        <div className="space-y-8">
          <PreviewCard
            icon={<Globe className="h-4 w-4" />}
            title="Browser tab & favicon"
            hint="How the tab looks in Chrome, Safari and Firefox."
          >
            <div className="rounded-t-md border border-border/60 bg-muted/40 p-2">
              <div className="flex items-center gap-2 rounded-md bg-background px-3 py-2 shadow-sm max-w-md">
                <FaviconImg src={s.favicon_url} alt="" />
                <span className="truncate text-xs font-medium">{s.meta_title || s.site_name}</span>
                <span className="ml-auto text-muted-foreground/60">×</span>
              </div>
              <div className="mt-2 flex items-center gap-2 rounded-md border border-border/60 bg-background px-3 py-1.5 text-xs text-muted-foreground">
                <span className="rounded bg-muted px-1.5 py-0.5">https</span>
                <span className="truncate">{canonical}</span>
              </div>
            </div>
          </PreviewCard>

          <PreviewCard
            icon={<Search className="h-4 w-4" />}
            title="Google search result"
            hint="Approximation of a desktop SERP listing."
          >
            <div className="rounded-md border border-border/60 bg-background p-4 font-[system-ui]">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <FaviconImg src={s.favicon_url} alt="" size={16} rounded />
                <div className="flex flex-col leading-tight">
                  <span className="text-foreground">{s.site_name}</span>
                  <span>{displayUrl}</span>
                </div>
              </div>
              <a
                href={canonical}
                className="mt-2 block truncate text-lg text-[#1a0dab] hover:underline dark:text-[#8ab4f8]"
                target="_blank" rel="noreferrer"
              >
                {truncate(s.meta_title || s.site_name, 60)}
              </a>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                {truncate(s.meta_description || s.tagline, 160)}
              </p>
            </div>
          </PreviewCard>

          <PreviewCard
            icon={<Share2 className="h-4 w-4" />}
            title="Facebook / LinkedIn (Open Graph)"
            hint="Large image card rendered when someone shares your URL."
          >
            <div className="max-w-md overflow-hidden rounded-md border border-border/60 bg-background">
              <OgImage src={s.og_image_url} alt={ogTitle} ratio="1.91/1" />
              <div className="border-t border-border/60 bg-muted/40 p-3">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{displayUrl}</div>
                <div className="mt-0.5 line-clamp-1 text-sm font-semibold">{truncate(ogTitle, 90)}</div>
                <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{truncate(ogDesc, 200)}</div>
              </div>
            </div>
          </PreviewCard>

          <PreviewCard
            icon={<Share2 className="h-4 w-4" />}
            title="X / Twitter (summary_large_image)"
            hint="Card shown in the timeline when your link is posted."
          >
            <div className="max-w-md overflow-hidden rounded-2xl border border-border/60 bg-background">
              <OgImage src={s.og_image_url} alt={ogTitle} ratio="1.91/1" />
              <div className="p-3">
                <div className="text-[11px] text-muted-foreground">{displayUrl}</div>
                <div className="mt-0.5 line-clamp-1 text-sm font-semibold">{truncate(ogTitle, 70)}</div>
                <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{truncate(ogDesc, 140)}</div>
                {twHandle ? (
                  <div className="mt-1 text-[11px] text-muted-foreground">via {twHandle}</div>
                ) : null}
              </div>
            </div>
          </PreviewCard>

          <PreviewCard
            icon={<Globe className="h-4 w-4" />}
            title="Homepage header"
            hint="How your brand identity reads on the home page hero."
          >
            <div
              className="overflow-hidden rounded-md border border-border/60 p-8"
              style={{ background: `linear-gradient(135deg, ${s.theme_color} 0%, #000 100%)` }}
            >
              <div className="flex items-center gap-3 text-white">
                {s.logo_url ? (
                  <img src={s.logo_url} alt="" className="h-8 w-auto object-contain" />
                ) : (
                  <FaviconImg src={s.favicon_url} alt="" size={32} rounded />
                )}
                <div>
                  <div className="text-lg font-semibold">{s.site_name}</div>
                  <div className="text-xs text-white/70">{s.tagline}</div>
                </div>
              </div>
            </div>
          </PreviewCard>

          <PreviewCard
            icon={<Search className="h-4 w-4" />}
            title="Raw meta tags"
            hint="Exactly what will be rendered into <head>."
          >
            <pre className="overflow-x-auto rounded-md border border-border/60 bg-muted/30 p-4 text-xs">
{`<title>${escapeHtml(s.meta_title || s.site_name)}</title>
<meta name="description" content="${escapeHtml(s.meta_description || "")}" />
<meta property="og:title" content="${escapeHtml(ogTitle)}" />
<meta property="og:description" content="${escapeHtml(ogDesc)}" />
<meta property="og:image" content="${escapeHtml(s.og_image_url || "")}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:site" content="${escapeHtml(twHandle)}" />
<meta name="theme-color" content="${escapeHtml(s.theme_color)}" />
<link rel="icon" href="${escapeHtml(s.favicon_url || "")}" />`}
            </pre>
          </PreviewCard>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Note: social platforms cache previews. After publishing, use each platform's link debugger
        (Facebook Sharing Debugger, X Card Validator, LinkedIn Post Inspector) to force a refresh.
      </p>
    </div>
  );
}

function PreviewCard({
  icon, title, hint, children,
}: { icon: React.ReactNode; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border/50 bg-card p-5">
      <div className="mb-3 flex items-start gap-2">
        <span className="mt-0.5 text-muted-foreground">{icon}</span>
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function FaviconImg({
  src, alt, size = 16, rounded,
}: { src?: string | null; alt: string; size?: number; rounded?: boolean }) {
  if (!src) {
    return (
      <div
        className={`inline-block bg-muted ${rounded ? "rounded-full" : "rounded-sm"}`}
        style={{ width: size, height: size }}
        aria-hidden
      />
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={rounded ? "rounded-full object-cover" : "rounded-sm object-cover"}
      style={{ width: size, height: size }}
    />
  );
}

function OgImage({ src, alt, ratio }: { src?: string | null; alt: string; ratio: string }) {
  if (!src) {
    return (
      <div
        className="flex items-center justify-center bg-muted text-xs text-muted-foreground"
        style={{ aspectRatio: ratio }}
      >
        No og:image set — hosting will inject a fallback preview.
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className="w-full object-cover"
      style={{ aspectRatio: ratio }}
    />
  );
}

function truncate(v: string | null | undefined, n: number) {
  const s = (v || "").trim();
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function escapeHtml(v: string | null | undefined) {
  return (v || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}