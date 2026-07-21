import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

// Leave empty so <loc> paths are relative until a custom domain is set.
const BASE_URL = "";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        // Only crawlable, public routes belong here — no auth, admin, or personal pages.
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/about", changefreq: "monthly", priority: "0.7" },
          { path: "/classes", changefreq: "daily", priority: "0.9" },
          { path: "/trainers", changefreq: "daily", priority: "0.9" },
          { path: "/explore", changefreq: "daily", priority: "0.8" },
          { path: "/browse", changefreq: "daily", priority: "0.9" },
          { path: "/community", changefreq: "daily", priority: "0.7" },
          { path: "/shorts", changefreq: "daily", priority: "0.6" },
          { path: "/feed", changefreq: "daily", priority: "0.6" },
          { path: "/search", changefreq: "weekly", priority: "0.4" },
        ];

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
