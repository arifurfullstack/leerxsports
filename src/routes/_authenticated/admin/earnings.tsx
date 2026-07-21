import { createFileRoute } from "@tanstack/react-router";
import { AdminManagementTable } from "@/components/admin-management-table";

type Row = {
  id: string;
  trainer_id: string;
  balance: number | null;
  pending: number | null;
  currency: string | null;
  updated_at: string | null;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/admin/earnings")({
  head: () => ({ meta: [{ title: "Admin · Trainer earnings" }] }),
  component: () => (
    <AdminManagementTable<Row>
      title="Trainer earnings"
      subtitle="Current available and pending balances per trainer."
      table="trainer_balances"
      select="id, trainer_id, balance, pending, currency, updated_at, created_at"
      searchColumn="trainer_id"
      allowDelete={false}
      columns={[
        { key: "trainer_id", label: "Trainer" },
        {
          key: "balance",
          label: "Available",
          render: (r) =>
            r.balance != null ? `${r.balance} ${r.currency ?? ""}` : "—",
        },
        {
          key: "pending",
          label: "Pending",
          render: (r) =>
            r.pending != null ? `${r.pending} ${r.currency ?? ""}` : "—",
        },
        {
          key: "updated_at",
          label: "Updated",
          render: (r) =>
            r.updated_at ? new Date(r.updated_at).toLocaleDateString() : "—",
        },
      ]}
    />
  ),
});