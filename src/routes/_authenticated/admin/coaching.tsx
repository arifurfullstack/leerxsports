import { createFileRoute } from "@tanstack/react-router";
import { AdminManagementTable } from "@/components/admin-management-table";

type Row = {
  id: string;
  subscriber_id: string;
  trainer_id: string;
  status: string | null;
  price_cents: number | null;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/admin/coaching")({
  head: () => ({ meta: [{ title: "Admin · Coaching" }] }),
  component: () => (
    <AdminManagementTable<Row>
      title="Coaching requests"
      subtitle="Private coaching sessions between trainees and trainers."
      table="coaching_requests"
      select="id, subscriber_id, trainer_id, status, price_cents, created_at"
      searchColumn="status"
      allowDelete={false}
      filters={[
        {
          column: "status",
          label: "Status",
          options: [
            { label: "Pending", value: "pending" },
            { label: "Accepted", value: "accepted" },
            { label: "Declined", value: "declined" },
            { label: "Completed", value: "completed" },
          ],
        },
      ]}
      columns={[
        { key: "status", label: "Status", render: (r) => r.status ?? "—" },
        {
          key: "price_cents",
          label: "Price",
          render: (r) =>
            r.price_cents != null ? `$${(r.price_cents / 100).toFixed(2)}` : "—",
        },
        {
          key: "subscriber_id",
          label: "Trainee",
          render: (r) => r.subscriber_id.slice(0, 8),
        },
        {
          key: "trainer_id",
          label: "Trainer",
          render: (r) => r.trainer_id.slice(0, 8),
        },
        {
          key: "created_at",
          label: "Created",
          render: (r) => new Date(r.created_at).toLocaleDateString(),
        },
      ]}
    />
  ),
});