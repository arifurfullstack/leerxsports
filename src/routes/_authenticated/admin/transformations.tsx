import { createFileRoute } from "@tanstack/react-router";
import { AdminManagementTable } from "@/components/admin-management-table";

type Row = {
  id: string;
  user_id: string;
  kind: string;
  notes: string | null;
  visibility: string;
  captured_on: string;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/admin/transformations")({
  head: () => ({ meta: [{ title: "Admin · Transformations" }] }),
  component: () => (
    <AdminManagementTable<Row>
      title="Transformations"
      subtitle="Body transformation submissions posted by trainees."
      table="transformation_posts"
      select="id, user_id, kind, notes, visibility, captured_on, created_at"
      searchColumn="notes"
      hideToggleColumn={{ column: "visibility", on: "private", off: "public", label: "Hide" }}
      filters={[
        {
          column: "kind",
          label: "Type",
          options: [
            { label: "Photo", value: "photo" },
            { label: "Video", value: "video" },
          ],
        },
        {
          column: "visibility",
          label: "Visibility",
          options: [
            { label: "Public", value: "public" },
            { label: "Subscribers", value: "subscribers" },
            { label: "Private", value: "private" },
          ],
        },
      ]}
      columns={[
        { key: "notes", label: "Notes", render: (r) => r.notes ?? "—" },
        { key: "kind", label: "Type", render: (r) => r.kind.toUpperCase() },
        { key: "visibility", label: "Visibility" },
        {
          key: "captured_on",
          label: "Captured",
          render: (r) => new Date(r.captured_on).toLocaleDateString(),
        },
        {
          key: "created_at",
          label: "Submitted",
          render: (r) => new Date(r.created_at).toLocaleDateString(),
        },
      ]}
    />
  ),
});