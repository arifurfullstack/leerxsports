import { createFileRoute } from "@tanstack/react-router";
import { AdminManagementTable } from "@/components/admin-management-table";

type Row = {
  id: string;
  trainer_id: string;
  reason: string;
  status: string;
  issued_by: string | null;
  expires_at: string | null;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/admin/strikes")({
  head: () => ({ meta: [{ title: "Admin · Trainer strikes" }] }),
  component: () => (
    <AdminManagementTable<Row>
      title="Trainer strikes"
      subtitle="Disciplinary strikes issued to trainers."
      table="trainer_strikes"
      select="id, trainer_id, reason, status, issued_by, expires_at, created_at"
      searchColumn="reason"
      orderBy="created_at"
      hideToggleColumn={{ column: "status", on: "revoked", off: "active", label: "Revoke" }}
      filters={[
        {
          column: "status",
          label: "Status",
          options: [
            { label: "Active", value: "active" },
            { label: "Revoked", value: "revoked" },
            { label: "Expired", value: "expired" },
          ],
        },
      ]}
      columns={[
        {
          key: "trainer_id",
          label: "Trainer",
          render: (r) => r.trainer_id.slice(0, 8) + "…",
        },
        {
          key: "reason",
          label: "Reason",
          render: (r) => r.reason.length > 60 ? r.reason.slice(0, 60) + "…" : r.reason,
        },
        { key: "status", label: "Status" },
        {
          key: "expires_at",
          label: "Expires",
          render: (r) => r.expires_at ? new Date(r.expires_at).toLocaleDateString() : "Never",
        },
        {
          key: "created_at",
          label: "Issued",
          render: (r) => new Date(r.created_at).toLocaleDateString(),
        },
      ]}
    />
  ),
});