import { createFileRoute } from "@tanstack/react-router";
import { AdminManagementTable } from "@/components/admin-management-table";

type Row = {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  status: string;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/admin/comments")({
  head: () => ({ meta: [{ title: "Admin · Comments" }] }),
  component: () => (
    <AdminManagementTable<Row>
      title="Comments"
      subtitle="Every comment on feed posts. Hide or delete as needed."
      table="comments"
      select="id, post_id, author_id, body, status, created_at"
      searchColumn="body"
      hideToggleColumn={{ column: "status", on: "hidden", off: "visible", label: "Hide" }}
      filters={[
        {
          column: "status",
          label: "Status",
          options: [
            { label: "Visible", value: "visible" },
            { label: "Hidden", value: "hidden" },
          ],
        },
      ]}
      columns={[
        {
          key: "body",
          label: "Comment",
          render: (r) => r.body.length > 80 ? r.body.slice(0, 80) + "…" : r.body,
        },
        {
          key: "status",
          label: "Status",
          render: (r) => r.status ?? "visible",
        },
        {
          key: "post_id",
          label: "Post",
          render: (r) => r.post_id.slice(0, 8) + "…",
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