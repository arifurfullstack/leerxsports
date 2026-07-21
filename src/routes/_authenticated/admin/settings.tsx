import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: AdminSettingsPage,
  head: () => ({ meta: [{ title: "Admin · Settings" }] }),
});

function AdminSettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <p className="font-display text-xs uppercase tracking-[0.3em] text-primary">
          Admin
        </p>
        <h1 className="font-display text-3xl uppercase tracking-tight">
          Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Platform-wide administrative preferences. Only admins with the
          <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs">
            manage_settings
          </code>
          permission can access this page.
        </p>
      </div>

      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="font-display text-lg uppercase tracking-tight">
          General
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          General platform settings will appear here. For commission, payout,
          and dispute configuration, see the Payments page.
        </p>
      </section>
    </div>
  );
}