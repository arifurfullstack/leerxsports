import { createFileRoute } from "@tanstack/react-router";
import { AdminManagementTable } from "@/components/admin-management-table";

type Row = {
  id: string;
  trainer_id: string;
  reason: string | null;
  severity: string | null;
  status: string | null;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/admin/strikes")({
  head: () => ({ meta: [{ title: "Admin · Trainer strikes" }] }),
  component: () => (
    <AdminManagementTable<Row>
      title="Trainer strikes"
      subtitle="Disciplinary strikes issued to trainers."
      table="trainer_strikes"
      select="id, trainer_id, reason, severity, status, created_at"
      searchColumn="trainer_id"
      columns={[
        { key: "trainer_id", label: "Trainer" },
        { key: "reason", label: "Reason", render: (r) => r.reason ?? "—" },
        { key: "severity", label: "Severity", render: (r) => r.severity ?? "—" },
        { key: "status", label: "Status", render: (r) => r.status ?? "—" },
        {
          key: "created_at",
          label: "Issued",
          render: (r) => new Date(r.created_at).toLocaleDateString(),
        },
      ]}
    />
  ),
});