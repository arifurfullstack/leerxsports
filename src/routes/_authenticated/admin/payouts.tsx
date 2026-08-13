import { createFileRoute } from "@tanstack/react-router";
import { AdminManagementTable } from "@/components/admin-management-table";

type Row = {
  id: string;
  trainer_id: string;
  amount: number;
  currency: string;
  status: string;
  method: string;
  requested_at: string;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/admin/payouts")({
  head: () => ({ meta: [{ title: "Admin · Payouts" }] }),
  component: () => (
    <AdminManagementTable<Row>
      title="Payouts"
      subtitle="Trainer payout requests and their status."
      table="payouts"
      select="id, trainer_id, amount, currency, status, method, requested_at, created_at"
      orderBy="requested_at"
      searchColumn="status"
      filters={[
        {
          column: "status",
          label: "Status",
          options: [
            { label: "Requested", value: "requested" },
            { label: "Approved", value: "approved" },
            { label: "Paid", value: "paid" },
            { label: "Rejected", value: "rejected" },
            { label: "Cancelled", value: "cancelled" },
          ],
        },
        {
          column: "method",
          label: "Method",
          options: [
            { label: "Stripe", value: "stripe" },
            { label: "Bank", value: "bank" },
            { label: "PayPal", value: "paypal" },
            { label: "Other", value: "other" },
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
          key: "amount",
          label: "Amount",
          render: (r) => `$${Number(r.amount).toFixed(2)} ${r.currency}`,
        },
        { key: "method", label: "Method" },
        { key: "status", label: "Status" },
        {
          key: "requested_at",
          label: "Requested",
          render: (r) => new Date(r.requested_at).toLocaleDateString(),
        },
      ]}
    />
  ),
});