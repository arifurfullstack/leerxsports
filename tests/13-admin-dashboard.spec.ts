import { test, expect } from "@playwright/test";
import { loginAs, monitorConsoleAndNetwork, ensureQAUser } from "./helpers/auth";

test.describe("13. Admin Dashboard & Route Protection", () => {
  test.beforeAll(async () => {
    await ensureQAUser("admin");
    await ensureQAUser("trainee");
  });

  test("A. Admin user can log in and access /admin dashboard", async ({ page }) => {
    monitorConsoleAndNetwork(page);
    await loginAs(page, "admin");

    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    const adminHeading = page.locator('h1:has-text("Admin"), h1:has-text("Dashboard"), span:has-text("Admin")').first();
    await expect(adminHeading).toBeVisible({ timeout: 15_000 });
  });

  test("B. Non-admin user is redirected or blocked from /admin", async ({ page }) => {
    monitorConsoleAndNetwork(page);
    await loginAs(page, "trainee");

    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    const url = page.url();
    const isBlocked = !url.endsWith("/admin") || url.includes("/auth") || url.includes("/home");
    expect(isBlocked).toBe(true);
  });
});
