import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  ADMIN_NAV_ORDER,
  ADMIN_PERMISSIONS,
  permissionForPath,
  permissionsForRole,
  firstAccessibleAdminPath,
} from "./admin-permissions";

const ROOT = join(process.cwd(), "src");
const SIDEBAR = readFileSync(
  join(ROOT, "components/admin-sidebar.tsx"),
  "utf8",
);

/** Extract every { to: "/admin/..." ... permission: "..." } entry from the sidebar. */
function extractSidebarItems(): { to: string; permission: string }[] {
  const re =
    /\{\s*to:\s*"([^"]+)"[\s\S]*?permission:\s*"([^"]+)"[\s\S]*?\}/g;
  const items: { to: string; permission: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(SIDEBAR)) !== null) {
    items.push({ to: m[1], permission: m[2] });
  }
  return items;
}

const SIDEBAR_ITEMS = extractSidebarItems();

/** Map a sidebar `to` path to its expected route file under src/routes. */
function routeFileFor(to: string): string {
  // "/admin" -> src/routes/_authenticated/admin/index.tsx
  // "/admin/foo" -> src/routes/_authenticated/admin/foo.tsx
  const rest = to.replace(/^\/admin\/?/, "");
  const leaf = rest === "" ? "index" : rest;
  return join(ROOT, "routes/_authenticated/admin", `${leaf}.tsx`);
}

describe("admin sidebar smoke", () => {
  it("has entries", () => {
    expect(SIDEBAR_ITEMS.length).toBeGreaterThan(20);
  });

  it.each(SIDEBAR_ITEMS)(
    "sidebar link %o points to an existing route file",
    ({ to }) => {
      const file = routeFileFor(to);
      expect(existsSync(file), `missing route file: ${file}`).toBe(true);
    },
  );

  it.each(SIDEBAR_ITEMS)(
    "sidebar link %o has a permission mapping and admins can access it",
    ({ to, permission }) => {
      const required = permissionForPath(to);
      expect(required, `no permissionForPath(${to})`).toBe(permission);
      const adminPerms = permissionsForRole("admin", true);
      expect(adminPerms).toContain(required!);
    },
  );

  it.each(SIDEBAR_ITEMS)(
    "sidebar link %o appears in ADMIN_NAV_ORDER",
    ({ to }) => {
      expect(ADMIN_NAV_ORDER.map((n) => n.path)).toContain(to);
    },
  );

  it("firstAccessibleAdminPath resolves for full-admin and moderator", () => {
    const admin = permissionsForRole("admin", true);
    const mod = permissionsForRole("moderator", false);
    expect(firstAccessibleAdminPath(admin)).toBe("/admin");
    expect(firstAccessibleAdminPath(mod)).toBeTruthy();
    expect(firstAccessibleAdminPath([])).toBeNull();
  });

  it("every ADMIN_PERMISSIONS entry is reachable from at least one nav path", () => {
    const covered = new Set(ADMIN_NAV_ORDER.map((n) => n.permission));
    for (const p of ADMIN_PERMISSIONS) {
      expect(covered.has(p), `permission ${p} not in ADMIN_NAV_ORDER`).toBe(
        true,
      );
    }
  });

  it("nested admin paths inherit parent permission", () => {
    expect(permissionForPath("/admin/classes/new")).toBe("manage_classes");
    expect(permissionForPath("/admin/users/123")).toBe("manage_users");
  });
});