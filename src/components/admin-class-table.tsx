import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { adminDeleteClass } from "@/lib/admin-functions";
import { Button } from "./ui/button";
import { AdminClassForm } from "./admin-class-form";
import { Pencil, Trash2, Plus } from "lucide-react";
import type { SportsClass } from "@/lib/schemas";

interface AdminClassTableProps {
  classes: SportsClass[];
}

export function AdminClassTable({ classes }: AdminClassTableProps) {
  const [editing, setEditing] = useState<SportsClass | null>(null);
  const [creating, setCreating] = useState(false);
  const doDelete = useServerFn(adminDeleteClass);
  const queryClient = useQueryClient();
  const router = useRouter();

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this class? This cannot be undone.")) return;
    try {
      await doDelete({ data: { id } });
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      router.invalidate();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">Classes</h2>
        <Button onClick={() => setCreating(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New class
        </Button>
      </div>

      {creating && (
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-card-foreground">Create class</h3>
            <Button variant="ghost" size="sm" onClick={() => setCreating(false)}>
              Close
            </Button>
          </div>
          <AdminClassForm onDone={() => setCreating(false)} />
        </div>
      )}

      {editing && (
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-card-foreground">Edit class</h3>
            <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
              Close
            </Button>
          </div>
          <AdminClassForm classItem={editing} onDone={() => setEditing(null)} />
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Instructor</th>
              <th className="px-4 py-3 font-medium">Schedule</th>
              <th className="px-4 py-3 font-medium">Capacity</th>
              <th className="px-4 py-3 font-medium">Level</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {classes.map((classItem) => (
              <tr key={classItem.id}>
                <td className="px-4 py-3 font-medium text-card-foreground">{classItem.title}</td>
                <td className="px-4 py-3 text-muted-foreground">{classItem.instructor}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(classItem.schedule).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{classItem.capacity}</td>
                <td className="px-4 py-3 text-muted-foreground capitalize">{classItem.level}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" aria-label={`Edit ${classItem.title}`} onClick={() => setEditing(classItem)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${classItem.title}`}
                      onClick={() => handleDelete(classItem.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
