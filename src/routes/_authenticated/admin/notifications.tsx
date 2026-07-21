import { createFileRoute } from "@tanstack/react-router";
import { AdminManagementTable } from "@/components/admin-management-table";

type Row = {
  id: string;
  user_id: string;
  type: string | null;
  title: string | null;
  body: string | null;
  is_read: boolean | null;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/admin/notifications")({
  head: () => ({ meta: [{ title: "Admin · Notifications" }] }),
  component: () => (
    <AdminManagementTable<Row>
      title="Notifications"
      subtitle="Recent in-app notification deliveries across all users."
      table="notifications"
      select="id, user_id, type, title, body, is_read, created_at"
      searchColumn="title"
      filters={[
        {
          column: "is_read",
          label: "Read",
          options: [
            { label: "Unread", value: "false" },
            { label: "Read", value: "true" },
          ],
        },
      ]}
      columns={[
        { key: "title", label: "Title", render: (r) => r.title ?? "—" },
        { key: "type", label: "Type", render: (r) => r.type ?? "—" },
        {
          key: "is_read",
          label: "Read",
          render: (r) => (r.is_read ? "Yes" : "No"),
        },
        {
          key: "created_at",
          label: "Sent",
          render: (r) => new Date(r.created_at).toLocaleDateString(),
        },
      ]}
    />
  ),
});