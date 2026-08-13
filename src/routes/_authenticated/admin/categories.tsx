import { createFileRoute } from "@tanstack/react-router";
import { AdminManagementTable } from "@/components/admin-management-table";

type Row = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_enabled: boolean;
  sort_order: number;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/admin/categories")({
  head: () => ({ meta: [{ title: "Admin · Content categories" }] }),
  component: () => (
    <AdminManagementTable<Row>
      title="Content categories"
      subtitle="Manage categories and taxonomy for fitness content and creators."
      table="fitness_categories"
      select="id, name, slug, description, is_enabled, sort_order, created_at"
      searchColumn="name"
      orderBy="sort_order"
      hideToggleColumn={{ column: "is_enabled", on: false, off: true, label: "Disable" }}
      columns={[
        { key: "name", label: "Category Name" },
        { key: "slug", label: "Slug" },
        { key: "description", label: "Description", render: (r) => r.description ?? "—" },
        {
          key: "is_enabled",
          label: "Status",
          render: (r) => (r.is_enabled ? "Active" : "Disabled"),
        },
        {
          key: "created_at",
          label: "Created",
          render: (r) => (r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"),
        },
      ]}
    />
  ),
});
