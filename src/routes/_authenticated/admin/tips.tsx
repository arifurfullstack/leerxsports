import { createFileRoute } from "@tanstack/react-router";
import { AdminManagementTable } from "@/components/admin-management-table";

type Row = {
  id: string;
  from_user_id: string | null;
  to_trainer_id: string | null;
  amount: number | null;
  currency: string | null;
  message: string | null;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/admin/tips")({
  head: () => ({ meta: [{ title: "Admin · Tips" }] }),
  component: () => (
    <AdminManagementTable<Row>
      title="Tips"
      subtitle="Tips sent from supporters to trainers."
      table="tips"
      select="id, from_user_id, to_trainer_id, amount, currency, message, created_at"
      searchColumn="to_trainer_id"
      columns={[
        { key: "from_user_id", label: "From", render: (r) => r.from_user_id ?? "—" },
        { key: "to_trainer_id", label: "Trainer", render: (r) => r.to_trainer_id ?? "—" },
        {
          key: "amount",
          label: "Amount",
          render: (r) =>
            r.amount != null ? `${r.amount} ${r.currency ?? ""}` : "—",
        },
        { key: "message", label: "Message", render: (r) => r.message ?? "—" },
        {
          key: "created_at",
          label: "Sent",
          render: (r) => new Date(r.created_at).toLocaleDateString(),
        },
      ]}
    />
  ),
});