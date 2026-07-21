import { createFileRoute } from "@tanstack/react-router";
import { AdminManagementTable } from "@/components/admin-management-table";

type Row = {
  id: string;
  slug: string;
  title: string;
  version: string;
  published_at: string | null;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/admin/policies")({
  head: () => ({ meta: [{ title: "Admin · Agreements & policies" }] }),
  component: () => (
    <AdminManagementTable<Row>
      title="Agreements & policies"
      subtitle="Terms, privacy, and community guidelines shown to users."
      table="policies"
      select="id, slug, title, version, published_at, created_at"
      searchColumn="title"
      orderBy="title"
      columns={[
        { key: "title", label: "Title" },
        { key: "slug", label: "Slug" },
        { key: "version", label: "Version" },
        {
          key: "published_at",
          label: "Published",
          render: (r) =>
            r.published_at
              ? new Date(r.published_at).toLocaleDateString()
              : "Draft",
        },
      ]}
    />
  ),
});