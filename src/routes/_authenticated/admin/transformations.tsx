import { createFileRoute } from "@tanstack/react-router";
import { AdminManagementTable } from "@/components/admin-management-table";

type Row = {
  id: string;
  author_id: string;
  caption: string | null;
  is_hidden: boolean | null;
  created_at: string;
  is_demo: boolean | null;
};

export const Route = createFileRoute("/_authenticated/admin/transformations")({
  head: () => ({ meta: [{ title: "Admin · Transformations" }] }),
  component: () => (
    <AdminManagementTable<Row>
      title="Transformations"
      subtitle="Body transformation submissions posted by trainees."
      table="transformation_posts"
      select="id, author_id, caption, is_hidden, created_at, is_demo"
      searchColumn="caption"
      hideToggleColumn={{ column: "is_hidden", on: true, off: false }}
      filters={[
        {
          column: "is_hidden",
          label: "Visibility",
          options: [
            { label: "Visible", value: "false" },
            { label: "Hidden", value: "true" },
          ],
        },
      ]}
      columns={[
        { key: "caption", label: "Caption", render: (r) => r.caption ?? "—" },
        {
          key: "is_hidden",
          label: "Status",
          render: (r) => (r.is_hidden ? "Hidden" : "Visible"),
        },
        {
          key: "created_at",
          label: "Created",
          render: (r) => new Date(r.created_at).toLocaleDateString(),
        },
      ]}
    />
  ),
});