import { createFileRoute } from "@tanstack/react-router";
import { AdminManagementTable } from "@/components/admin-management-table";

type Row = {
  id: string;
  trainer_id: string;
  amount: number | null;
  currency: string | null;
  status: string | null;
  method: string | null;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/admin/payouts")({
  head: () => ({ meta: [{ title: "Admin · Payouts" }] }),
  component: () => (
    <AdminManagementTable<Row>
      title="Payouts"
      subtitle="Trainer payout requests and their status."
      table="payouts"
      select="id, trainer_id, amount, currency, status, method, created_at"
      searchColumn="trainer_id"
      filters={[
        {
          column: "status",
          label: "Status",
          options: [
            { label: "Pending", value: "pending" },
            { label: "Approved", value: "approved" },
            { label: "Paid", value: "paid" },
            { label: "Rejected", value: "rejected" },
          ],
        },
      ]}
      columns={[
        { key: "trainer_id", label: "Trainer" },
        {
          key: "amount",
          label: "Amount",
          render: (r) =>
            r.amount != null ? `${r.amount} ${r.currency ?? ""}` : "—",
        },
        { key: "method", label: "Method", render: (r) => r.method ?? "—" },
        { key: "status", label: "Status", render: (r) => r.status ?? "—" },
        {
          key: "created_at",
          label: "Created",
          render: (r) => new Date(r.created_at).toLocaleDateString(),
        },
      ]}
    />
  ),
});