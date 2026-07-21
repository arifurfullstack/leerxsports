import { createFileRoute } from "@tanstack/react-router";
import { AdminManagementTable } from "@/components/admin-management-table";

type Row = {
  id: string;
  author_id: string;
  caption: string | null;
  is_hidden: boolean | null;
  respect_count: number | null;
  comment_count: number | null;
  created_at: string;
  is_demo: boolean | null;
};

export const Route = createFileRoute("/_authenticated/admin/posts")({
  head: () => ({ meta: [{ title: "Admin · Posts" }] }),
  component: () => (
    <AdminManagementTable<Row>
      title="Posts"
      subtitle="Feed posts across the platform. Hide or delete abusive content."
      table="posts"
      select="id, author_id, caption, is_hidden, respect_count, comment_count, created_at, is_demo"
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
        { key: "respect_count", label: "Respects" },
        { key: "comment_count", label: "Comments" },
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