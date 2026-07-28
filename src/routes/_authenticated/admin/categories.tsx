import { createFileRoute } from "@tanstack/react-router";
import { AdminManagementTable } from "@/components/admin-management-table";

type Row = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/admin/categories")({
  head: () => ({ meta: [{ title: "Admin · Content categories" }] }),
  component: () => (
    <AdminManagementTable<Row>
      title="Content categories"
      subtitle="Manage categories and taxonomy for fitness content and creators."
      table="categories"
      select="id, name, slug, description, created_at"
      searchColumn="name"
      orderBy="name"
      columns={[
        { key: "name", label: "Category Name" },
        { key: "slug", label: "Slug" },
        { key: "description", label: "Description", render: (r) => r.description ?? "—" },
        {
          key: "created_at",
          label: "Created",
          render: (r) => (r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"),
        },
      ]}
    />
  ),
});
