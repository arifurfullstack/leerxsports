import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/dev/header-preview")({
  head: () => ({
    meta: [
      { title: "Header Preview — LEER Dev" },
      { name: "description", content: "Internal responsive preview of the LEER site header across common device widths." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Header Preview — LEER Dev" },
      { property: "og:description", content: "Internal responsive preview of the LEER site header across common device widths." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HeaderPreviewPage,
});

type Device = {
  label: string;
  width: number;
  height: number;
  category: "mobile" | "tablet" | "desktop";
};

const DEVICES: Device[] = [
  { label: "iPhone SE", width: 320, height: 200, category: "mobile" },
  { label: "iPhone 12/13 mini", width: 375, height: 200, category: "mobile" },
  { label: "iPhone 14 Pro", width: 393, height: 200, category: "mobile" },
  { label: "Pixel 7", width: 412, height: 200, category: "mobile" },
  { label: "iPhone 14 Plus", width: 428, height: 200, category: "mobile" },
  { label: "Small tablet", width: 640, height: 220, category: "tablet" },
  { label: "iPad portrait", width: 768, height: 220, category: "tablet" },
  { label: "iPad landscape", width: 1024, height: 220, category: "tablet" },
  { label: "Laptop", width: 1280, height: 240, category: "desktop" },
  { label: "Desktop", width: 1440, height: 240, category: "desktop" },
  { label: "Wide", width: 1920, height: 240, category: "desktop" },
];

const PATHS = ["/", "/browse", "/feed", "/community", "/pricing"] as const;

function HeaderPreviewPage() {
  const [path, setPath] = useState<(typeof PATHS)[number]>("/");
  const [drawer, setDrawer] = useState(false);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-col gap-4 border-b border-hairline pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-premium">Internal</p>
            <h1 className="mt-1 font-display text-3xl uppercase tracking-tight sm:text-4xl">
              Header Responsive Preview
            </h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Each frame loads the live site at a fixed CSS width so you can verify header spacing,
              overflow, and the mobile drawer across common breakpoints.
            </p>
          </div>

          <div className="flex flex-col gap-3 text-xs">
            <label className="flex items-center gap-2">
              <span className="uppercase tracking-[0.2em] text-muted-foreground">Route</span>
              <select
                value={path}
                onChange={(e) => setPath(e.target.value as (typeof PATHS)[number])}
                className="border border-hairline bg-surface-1 px-3 py-2 text-xs uppercase tracking-[0.15em] outline-none focus-visible:border-premium"
              >
                {PATHS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <label className="inline-flex items-center gap-2 uppercase tracking-[0.2em] text-muted-foreground">
              <input
                type="checkbox"
                checked={drawer}
                onChange={(e) => setDrawer(e.target.checked)}
                className="h-4 w-4 accent-[var(--premium)]"
              />
              Auto-open mobile drawer
            </label>
          </div>
        </header>

        {(["mobile", "tablet", "desktop"] as const).map((cat) => (
          <section key={cat} className="mb-12">
            <h2 className="mb-4 flex items-center gap-3 font-display text-xs font-bold uppercase tracking-[0.28em] text-muted-foreground">
              <span>{cat}</span>
              <span aria-hidden className="h-px flex-1 bg-hairline" />
            </h2>
            <div className="flex flex-wrap gap-6">
              {DEVICES.filter((d) => d.category === cat).map((d) => (
                <DevicePreview key={d.label} device={d} path={path} openDrawer={drawer} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}

function DevicePreview({
  device,
  path,
  openDrawer,
}: {
  device: Device;
  path: string;
  openDrawer: boolean;
}) {
  const src = `${path}${openDrawer ? (path.includes("?") ? "&" : "?") + "previewDrawer=1" : ""}`;
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="flex items-baseline justify-between gap-4 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        <span className="font-semibold text-foreground">{device.label}</span>
        <span>{device.width}px</span>
      </figcaption>
      <div
        className="overflow-hidden border border-hairline bg-surface-1 shadow-lg"
        style={{ width: device.width, height: device.height }}
      >
        <iframe
          title={`${device.label} header preview`}
          src={src}
          loading="lazy"
          style={{ width: device.width, height: device.height, border: 0 }}
        />
      </div>
    </figure>
  );
}