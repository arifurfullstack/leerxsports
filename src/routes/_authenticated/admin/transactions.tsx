import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AdminManagementTable } from "@/components/admin-management-table";
import { adminUpdateRow } from "@/lib/admin-management-functions";

type Row = {
  id: string;
  user_id: string | null;
  trainer_id: string | null;
  kind: string | null;
  status: string | null;
  amount_cents: number | null;
  currency: string | null;
  created_at: string;
};

function TxPage() {
  const updateFn = useServerFn(adminUpdateRow);
  return (
    <AdminManagementTable<Row>
      title="Transactions"
      subtitle="Payments, tips, and payouts. Mark refunded to reverse a payment."
      table="transactions"
      select="id, user_id, trainer_id, kind, status, amount_cents, currency, created_at"
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
          ],
        },
        {
          column: "kind",
          label: "Kind",
          options: [
            { label: "Subscription", value: "subscription" },
            { label: "Tip", value: "tip" },
            { label: "Coaching", value: "coaching" },
            { label: "Payout", value: "payout" },
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
        { key: "kind", label: "Kind", render: (r) => r.kind ?? "—" },
        { key: "status", label: "Status", render: (r) => r.status ?? "—" },
        {
          key: "amount_cents",
          label: "Amount",
          render: (r) =>
            r.amount_cents != null
              ? `${(r.amount_cents / 100).toFixed(2)} ${r.currency ?? ""}`
              : "—",
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