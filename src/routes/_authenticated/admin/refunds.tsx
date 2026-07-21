import { createFileRoute } from "@tanstack/react-router";
import { AdminManagementTable } from "@/components/admin-management-table";

type Row = {
  id: string;
  user_id: string | null;
  amount: number | null;
  currency: string | null;
  status: string | null;
  kind: string | null;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/admin/refunds")({
  head: () => ({ meta: [{ title: "Admin · Refunds" }] }),
  component: () => (
    <AdminManagementTable<Row>
      title="Refunds"
      subtitle="Transactions with a refunded status."
      table="transactions"
      select="id, user_id, amount, currency, status, kind, created_at"
      searchColumn="user_id"
      filters={[
        {
          column: "status",
          label: "Status",
          options: [
            { label: "Refunded", value: "refunded" },
            { label: "Partially refunded", value: "partial_refund" },
          ],
        },
      ]}
      columns={[
        { key: "user_id", label: "User", render: (r) => r.user_id ?? "—" },
        {
          key: "amount",
          label: "Amount",
          render: (r) =>
            r.amount != null ? `${r.amount} ${r.currency ?? ""}` : "—",
        },
        { key: "kind", label: "Kind", render: (r) => r.kind ?? "—" },
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