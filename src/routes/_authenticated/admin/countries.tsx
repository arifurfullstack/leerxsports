import { createFileRoute } from "@tanstack/react-router";
import { AdminManagementTable } from "@/components/admin-management-table";

type Row = {
  id: string;
  code: string;
  name: string;
  dial_code: string | null;
  is_enabled: boolean;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/admin/countries")({
  head: () => ({ meta: [{ title: "Admin · Countries" }] }),
  component: () => (
    <AdminManagementTable<Row>
      title="Countries"
      subtitle="Country list available across the platform."
      table="countries"
      select="id, code, name, dial_code, is_enabled, created_at"
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
        { key: "code", label: "Code" },
        { key: "dial_code", label: "Dial code", render: (r) => r.dial_code ?? "—" },
        {
          key: "is_enabled",
          label: "Enabled",
          render: (r) => (r.is_enabled ? "Yes" : "No"),
        },
      ]}
    />
  ),
});