import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AdminManagementTable } from "@/components/admin-management-table";
import { adminUpdateRow } from "@/lib/admin-management-functions";

type Row = {
  id: string;
  subscriber_id: string;
  trainer_id: string;
  status: string | null;
  price_cents: number | null;
  current_period_end: string | null;
  created_at: string;
};

function SubsPage() {
  const updateFn = useServerFn(adminUpdateRow);
  return (
    <AdminManagementTable<Row>
      title="Subscriptions"
      subtitle="Trainee→trainer subscription state. Cancel to end access immediately."
      table="subscriptions"
      select="id, subscriber_id, trainer_id, status, price_cents, current_period_end, created_at"
      searchColumn="status"
      allowDelete={false}
      filters={[
        {
          column: "status",
          label: "Status",
          options: [
            { label: "Active", value: "active" },
            { label: "Canceled", value: "canceled" },
            { label: "Past due", value: "past_due" },
          ],
        },
      ]}
      extraActions={[
        {
          label: "Cancel",
          variant: "destructive",
          hidden: (r) => r.status === "canceled",
          onRun: (r) =>
            updateFn({
              data: {
                table: "subscriptions",
                id: r.id,
                patch: { status: "canceled" },
              },
            }).then(() => undefined),
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
          key: "current_period_end",
          label: "Period end",
          render: (r) =>
            r.current_period_end
              ? new Date(r.current_period_end).toLocaleDateString()
              : "—",
        },
        {
          key: "created_at",
          label: "Started",
          render: (r) => new Date(r.created_at).toLocaleDateString(),
        },
      ]}
    />
  );
}

export const Route = createFileRoute("/_authenticated/admin/subscriptions")({
  head: () => ({ meta: [{ title: "Admin · Subscriptions" }] }),
  component: SubsPage,
});