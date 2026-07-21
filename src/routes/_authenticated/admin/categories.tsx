import { createFileRoute } from "@tanstack/react-router";
import { AdminManagementTable } from "@/components/admin-management-table";

type Row = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  is_enabled: boolean;
  sort_order: number;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/admin/categories")({
  head: () => ({ meta: [{ title: "Admin · Fitness categories" }] }),
  component: () => (
    <AdminManagementTable<Row>
      title="Fitness categories"
      subtitle="Categories used to classify trainers, classes, and content."
      table="fitness_categories"
      select="id, slug, name, description, is_enabled, sort_order, created_at"
      searchColumn="name"
      orderBy="sort_order"
      filters={[
        {
          column: "is_enabled",
          label: "Enabled",
          options: [
            { label: "Enabled", value: "true" },
            { label: "Disabled", value: "false" },
          ],
        },
      ]}
      hideToggleColumn={{ column: "is_enabled", on: true, off: false, label: "Toggle" }}
      columns={[
        { key: "name", label: "Name" },
        { key: "slug", label: "Slug" },
        { key: "description", label: "Description", render: (r) => r.description ?? "—" },
        { key: "sort_order", label: "Order" },
        {
          key: "is_enabled",
          label: "Enabled",
          render: (r) => (r.is_enabled ? "Yes" : "No"),
        },
      ]}
    />
  ),
});