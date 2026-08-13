import { createFileRoute } from "@tanstack/react-router";
import { AdminManagementTable } from "@/components/admin-management-table";

type Row = {
  id: string;
  trainer_id: string;
  caption: string | null;
  kind: string;
  is_premium: boolean;
  is_published: boolean;
  respect_count: number;
  view_count: number;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/admin/posts")({
  head: () => ({ meta: [{ title: "Admin · Posts" }] }),
  component: () => (
    <AdminManagementTable<Row>
      title="Posts"
      subtitle="Feed posts across the platform. Hide or delete abusive content."
      table="posts"
      select="id, trainer_id, caption, kind, is_premium, is_published, respect_count, view_count, created_at"
      searchColumn="caption"
      hideToggleColumn={{ column: "is_published", on: false, off: true, label: "Unpublish" }}
      filters={[
        {
          column: "kind",
          label: "Type",
          options: [
            { label: "Feed", value: "feed" },
            { label: "Short", value: "short" },
          ],
        },
        {
          column: "is_premium",
          label: "Access",
          options: [
            { label: "Free", value: "false" },
            { label: "Premium", value: "true" },
          ],
        },
      ]}
      columns={[
        { key: "caption", label: "Caption", render: (r) => r.caption ?? "—" },
        { key: "kind", label: "Type", render: (r) => r.kind.toUpperCase() },
        { key: "respect_count", label: "Respects" },
        { key: "view_count", label: "Views" },
        {
          key: "is_premium",
          label: "Access",
          render: (r) => (r.is_premium ? "Premium" : "Free"),
        },
        {
          key: "is_published",
          label: "Status",
          render: (r) => (r.is_published ? "Published" : "Hidden"),
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