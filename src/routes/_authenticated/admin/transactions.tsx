import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AdminManagementTable } from "@/components/admin-management-table";
import { adminUpdateRow } from "@/lib/admin-management-functions";

type Row = {
  id: string;
  payer_id: string | null;
  trainer_id: string | null;
  kind: string;
  status: string;
  gross: number;
  platform_fee: number;
  trainer_amount: number;
  currency: string;
  created_at: string;
};

function TxPage() {
  const updateFn = useServerFn(adminUpdateRow);
  return (
    <AdminManagementTable<Row>
      title="Transactions"
      subtitle="Payments, tips, and payouts. Mark refunded to reverse a payment."
      table="transactions"
      select="id, payer_id, trainer_id, kind, status, gross, platform_fee, trainer_amount, currency, created_at"
      searchColumn="kind"
      allowDelete={false}
      filters={[
        {
          column: "status",
          label: "Status",
          options: [
            { label: "Succeeded", value: "succeeded" },
            { label: "Pending", value: "pending" },
            { label: "Refunded", value: "refunded" },
            { label: "Failed", value: "failed" },
            { label: "Frozen", value: "frozen" },
          ],
        },
        {
          column: "kind",
          label: "Kind",
          options: [
            { label: "Subscription", value: "subscription" },
            { label: "Tip", value: "tip" },
            { label: "Refund", value: "refund" },
            { label: "Adjustment", value: "adjustment" },
          ],
        },
      ]}
      extraActions={[
        {
          label: "Mark refunded",
          variant: "outline",
          hidden: (r) => r.status === "refunded",
          onRun: (r) =>
            updateFn({
              data: {
                table: "transactions",
                id: r.id,
                patch: { status: "refunded" },
              },
            }).then(() => undefined),
        },
      ]}
      columns={[
        { key: "kind", label: "Kind", render: (r) => r.kind },
        { key: "status", label: "Status" },
        {
          key: "gross",
          label: "Gross",
          render: (r) => `$${Number(r.gross).toFixed(2)} ${r.currency}`,
        },
        {
          key: "trainer_amount",
          label: "Trainer Gets",
          render: (r) => `$${Number(r.trainer_amount).toFixed(2)}`,
        },
        {
          key: "created_at",
          label: "Date",
          render: (r) => new Date(r.created_at).toLocaleDateString(),
        },
      ]}
    />
  );
}

export const Route = createFileRoute("/_authenticated/admin/transactions")({
  head: () => ({ meta: [{ title: "Admin · Transactions" }] }),
  component: TxPage,
});