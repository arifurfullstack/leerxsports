import { createFileRoute } from "@tanstack/react-router";
import { AdminManagementTable } from "@/components/admin-management-table";

type Row = {
  id: string;
  actor_id: string | null;
  action: string;
  target_table: string | null;
  target_id: string | null;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/admin/audit-logs")({
  head: () => ({ meta: [{ title: "Admin · Audit logs" }] }),
  component: () => (
    <AdminManagementTable<Row>
      title="Audit logs"
      subtitle="Recorded admin and moderator actions."
      table="audit_logs"
      select="id, actor_id, action, target_table, target_id, created_at"
      searchColumn="action"
      allowDelete={false}
      columns={[
        { key: "action", label: "Action" },
        { key: "actor_id", label: "Actor", render: (r) => r.actor_id ?? "system" },
        { key: "target_table", label: "Table", render: (r) => r.target_table ?? "—" },
        { key: "target_id", label: "Target", render: (r) => r.target_id ?? "—" },
        {
          key: "created_at",
          label: "When",
          render: (r) => new Date(r.created_at).toLocaleString(),
        },
      ]}
    />
  ),
});