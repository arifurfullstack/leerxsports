import { ClassCard } from "./class-card";
import type { SportsClass } from "@/lib/schemas";

interface ClassGridProps {
  classes: SportsClass[];
  counts: Record<string, number>;
}

export function ClassGrid({ classes, counts }: ClassGridProps) {
  if (classes.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-12 text-center">
        <p className="text-lg text-muted-foreground">No classes found.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {classes.map((classItem) => (
        <ClassCard
          key={classItem.id}
          classItem={classItem}
          bookedCount={counts[classItem.id] ?? 0}
        />
      ))}
    </div>
  );
}
