import { createFileRoute } from "@tanstack/react-router";
import { AdminManagementTable } from "@/components/admin-management-table";

type Row = {
  id: string;
  code: string;
  name: string;
  native_name: string | null;
  is_enabled: boolean;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/admin/languages")({
  head: () => ({ meta: [{ title: "Admin · Languages" }] }),
  component: () => (
    <AdminManagementTable<Row>
      title="Languages"
      subtitle="Languages supported by the platform."
      table="languages"
      select="id, code, name, native_name, is_enabled, created_at"
      searchColumn="name"
      orderBy="name"
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
        { key: "native_name", label: "Native", render: (r) => r.native_name ?? "—" },
        { key: "code", label: "Code" },
        {
          key: "is_enabled",
          label: "Enabled",
          render: (r) => (r.is_enabled ? "Yes" : "No"),
        },
      ]}
    />
  ),
});