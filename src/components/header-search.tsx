import { useEffect, useRef, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Search, X } from "lucide-react";

/**
 * Compact header search shortcut.
 * - Desktop (md+): inline compact input, submit navigates to /search?q=
 * - Mobile: icon button that expands to a full-width input in place; submit or Esc collapses.
 * No menus, no modals.
 */
export function HeaderSearch() {
  const navigate = useNavigate();
  const routerState = useRouterState();
  const currentQ =
    (routerState.location.pathname === "/search"
      ? ((routerState.location.search as { q?: string })?.q ?? "")
      : "") || "";

  const [q, setQ] = useState(currentQ);
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setQ(currentQ);
  }, [currentQ]);

  useEffect(() => {
    if (mobileOpen) mobileInputRef.current?.focus();
  }, [mobileOpen]);

  const submit = (value: string) => {
    const trimmed = value.trim();
    navigate({
      to: "/search",
      search: { q: trimmed || undefined },
    });
    setMobileOpen(false);
  };

  return (
    <>
      {/* Desktop / tablet: inline compact input */}
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          submit(q);
        }}
        className="hidden sm:flex"
      >
        <label className="group relative flex h-9 w-44 items-center rounded-full border border-border bg-card pl-8 pr-2 text-sm text-foreground transition-[width,border-color,background-color] duration-200 focus-within:w-64 focus-within:border-sky-500/50 focus-within:bg-background lg:w-56 lg:focus-within:w-72">
          <Search className="pointer-events-none absolute left-2.5 h-4 w-4 text-sky-500" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search LEER…"
            aria-label="Search LEER"
            className="h-full w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label="Clear search"
              className="ml-1 rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </label>
      </form>

      {/* Mobile: icon expands inline */}
      <div className="relative sm:hidden">
        {!mobileOpen ? (
          <button
            type="button"
            aria-label="Search"
            onClick={() => setMobileOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-sky-500 transition-colors hover:border-sky-500/40 hover:bg-sky-500/10"
          >
            <Search className="h-4 w-4" />
          </button>
        ) : (
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              submit(q);
            }}
            className="fixed inset-x-3 top-[9px] z-50 flex items-center gap-2 rounded-full border border-border bg-background/95 px-3 py-1 shadow-lg backdrop-blur"
          >
            <Search className="h-4 w-4 shrink-0 text-sky-500" />
            <input
              ref={mobileInputRef}
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setMobileOpen(false);
              }}
              placeholder="Search LEER…"
              aria-label="Search LEER"
              className="h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <button
              type="button"
              aria-label="Close search"
              onClick={() => setMobileOpen(false)}
              className="rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </form>
        )}
      </div>
    </>
  );
}