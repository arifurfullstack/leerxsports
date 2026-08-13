import { createFileRoute } from "@tanstack/react-router";
import { AdminManagementTable } from "@/components/admin-management-table";

type Row = {
  id?: string;
  trainer_id: string;
  available_amount: number;
  pending_amount: number;
  frozen_amount: number;
  paid_out_amount: number;
  currency: string;
  updated_at: string;
};

export const Route = createFileRoute("/_authenticated/admin/earnings")({
  head: () => ({ meta: [{ title: "Admin · Trainer earnings" }] }),
  component: () => (
    <AdminManagementTable<Row>
      title="Trainer earnings"
      subtitle="Current available, pending, frozen, and paid-out balances per trainer."
      table="trainer_balances"
      select="trainer_id, available_amount, pending_amount, frozen_amount, paid_out_amount, currency, updated_at"
      orderBy="updated_at"
      searchColumn="trainer_id"
      allowDelete={false}
      columns={[
        {
          key: "trainer_id",
          label: "Trainer",
          render: (r) => r.trainer_id.slice(0, 8) + "…",
        },
        {
          key: "available_amount",
          label: "Available",
          render: (r) => `$${Number(r.available_amount ?? 0).toFixed(2)} ${r.currency ?? "USD"}`,
        },
        {
          key: "pending_amount",
          label: "Pending",
          render: (r) => `$${Number(r.pending_amount ?? 0).toFixed(2)}`,
        },
        {
          key: "frozen_amount",
          label: "Frozen",
          render: (r) => `$${Number(r.frozen_amount ?? 0).toFixed(2)}`,
        },
        {
          key: "paid_out_amount",
          label: "Paid Out",
          render: (r) => `$${Number(r.paid_out_amount ?? 0).toFixed(2)}`,
        },
        {
          key: "updated_at",
          label: "Last Updated",
          render: (r) => (r.updated_at ? new Date(r.updated_at).toLocaleDateString() : "—"),
        },
      ]}
    />
  ),
});