import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getClasses } from "@/lib/class-functions";
import { ClassGrid } from "@/components/class-grid";
import { ClassFilter } from "@/components/class-filter";

const classesQueryOptions = queryOptions({
  queryKey: ["classes"],
  queryFn: () => getClasses(),
});

export const Route = createFileRoute("/classes/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(classesQueryOptions),
  head: () => ({
    meta: [
      { title: "Sports Classes — leersports" },
      { name: "description", content: "Browse and book sports classes. Swimming, cycling, martial arts, team sports and more." },
      { property: "og:title", content: "Sports Classes — leersports" },
      { property: "og:description", content: "Browse and book sports classes. Swimming, cycling, martial arts, team sports and more." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: ClassesPage,
  errorComponent: ClassesError,
  notFoundComponent: ClassesNotFound,
});

function ClassesPage() {
  const { data: classes } = useSuspenseQuery(classesQueryOptions);
  const [filter, setFilter] = useState("");

  const filtered = classes.filter((c) => {
    const q = filter.toLowerCase();
    return (
      c.title.toLowerCase().includes(q) ||
      c.instructor.toLowerCase().includes(q) ||
      (c.category?.toLowerCase().includes(q) ?? false) ||
      c.level.toLowerCase().includes(q)
    );
  });

  const counts: Record<string, number> = {};

  return (
    <main className="min-h-dvh bg-background py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 md:flex md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Sports classes
            </h1>
            <p className="mt-2 text-muted-foreground">
              Find your next training session and book your spot.
            </p>
          </div>
          <div className="mt-4 md:mt-0 md:w-80">
            <ClassFilter value={filter} onChange={setFilter} />
          </div>
        </div>
        <ClassGrid classes={filtered} counts={counts} />
      </div>
    </main>
  );
}

function ClassesError({ error }: { error: Error }) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 text-center">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Could not load classes</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      </div>
    </div>
  );
}

function ClassesNotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 text-center">
      <div>
        <h1 className="text-xl font-semibold text-foreground">No classes found</h1>
        <p className="mt-2 text-sm text-muted-foreground">Check back soon for new sessions.</p>
      </div>
    </div>
  );
}
