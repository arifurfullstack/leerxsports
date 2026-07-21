import { createFileRoute } from "@tanstack/react-router";
import { AdminManagementTable } from "@/components/admin-management-table";

type Row = {
  id: string;
  author_id: string;
  title: string | null;
  body: string | null;
  status: string | null;
  respect_count: number | null;
  comment_count: number | null;
  trainer_answered: boolean | null;
  created_at: string;
  is_demo: boolean | null;
};

export const Route = createFileRoute("/_authenticated/admin/community")({
  head: () => ({ meta: [{ title: "Admin · Community" }] }),
  component: () => (
    <AdminManagementTable<Row>
      title="Community"
      subtitle="Q&A and progress-sharing threads posted to the community."
      table="community_posts"
      select="id, author_id, title, body, status, respect_count, comment_count, trainer_answered, created_at, is_demo"
      searchColumn="title"
      hideToggleColumn={{ column: "status", on: "hidden", off: "visible" }}
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
        { key: "title", label: "Title", render: (r) => r.title ?? "—" },
        { key: "status", label: "Status", render: (r) => r.status ?? "visible" },
        {
          key: "trainer_answered",
          label: "Answered",
          render: (r) => (r.trainer_answered ? "Yes" : "No"),
        },
        { key: "respect_count", label: "Respects" },
        {
          key: "created_at",
          label: "Created",
          render: (r) => new Date(r.created_at).toLocaleDateString(),
        },
      ]}
    />
  ),
});