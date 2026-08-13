import { createFileRoute } from "@tanstack/react-router";
import { AdminManagementTable } from "@/components/admin-management-table";

type Row = {
  id: string;
  payer_id: string | null;
  gross: number;
  currency: string;
  status: string;
  kind: string;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/admin/refunds")({
  head: () => ({ meta: [{ title: "Admin · Refunds" }] }),
  component: () => (
    <AdminManagementTable<Row>
      title="Refunds"
      subtitle="Transactions with a refunded status."
      table="transactions"
      select="id, payer_id, gross, currency, status, kind, created_at"
      searchColumn="kind"
      filters={[
        {
          column: "status",
          label: "Status",
          options: [
            { label: "Refunded", value: "refunded" },
            { label: "Succeeded", value: "succeeded" },
          ],
        },
      ]}
      columns={[
        {
          key: "payer_id",
          label: "Payer",
          render: (r) => (r.payer_id ? r.payer_id.slice(0, 8) + "…" : "—"),
        },
        {
          key: "gross",
          label: "Amount",
          render: (r) => `$${Number(r.gross).toFixed(2)} ${r.currency}`,
        },
        { key: "kind", label: "Kind", render: (r) => r.kind },
        { key: "status", label: "Status", render: (r) => r.status },
        {
          key: "created_at",
          label: "Created",
          render: (r) => new Date(r.created_at).toLocaleDateString(),
        },
      ]}
    />
  ),
});