import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getClasses } from "@/lib/class-functions";
import { AdminClassTable } from "@/components/admin-class-table";
import { AdminNav } from "@/components/admin-nav";

const classesQueryOptions = queryOptions({
  queryKey: ["classes"],
  queryFn: () => getClasses(),
});

export const Route = createFileRoute("/_authenticated/admin/classes")({
  loader: ({ context }) => context.queryClient.ensureQueryData(classesQueryOptions),
  head: () => ({
    meta: [
      { title: "Admin — Classes — leersports" },
      { name: "description", content: "Manage leersports classes." },
      { property: "og:title", content: "Admin — Classes — leersports" },
      { property: "og:description", content: "Manage leersports classes." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: AdminClassesPage,
  errorComponent: AdminClassesError,
  notFoundComponent: AdminClassesNotFound,
});

function AdminClassesPage() {
  const { data: classes } = useSuspenseQuery(classesQueryOptions);

  return (
    <main className="min-h-dvh bg-background py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="mb-6">
          <span className="font-display text-xs uppercase tracking-[0.3em] text-primary">
            Admin
          </span>
          <AdminNav />
        </header>
        <AdminClassTable classes={classes} />
      </div>
    </main>
  );
}

function AdminClassesError({ error }: { error: Error }) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 text-center">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Could not load classes</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      </div>
    </div>
  );
}

function AdminClassesNotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 text-center">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Page not found</h1>
      </div>
    </div>
  );
}
