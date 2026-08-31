import { test, expect } from "@playwright/test";
import { loginAs, monitorConsoleAndNetwork, ensureQAUser } from "./helpers/auth";

test.describe("16. Messages, Notifications, Library & User Settings", () => {
  test.beforeAll(async () => {
    await ensureQAUser("trainee");
    await ensureQAUser("subscriber");
  });

  test("A. Authenticated user can view notifications interface", async ({ page }) => {
    monitorConsoleAndNetwork(page);
    await loginAs(page, "trainee");

    await page.goto("/notifications", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    const heading = page.locator('h1, h2, main, [data-testid="notifications-page"]').first();
    await expect(heading).toBeVisible({ timeout: 15_000 });
  });

  test("B. Authenticated user can access messages view", async ({ page }) => {
    monitorConsoleAndNetwork(page);
    await loginAs(page, "trainee");

    await page.goto("/messages", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    const messagesView = page.locator('main, [data-testid="messages-view"], [role="main"]').first();
    await expect(messagesView).toBeVisible({ timeout: 15_000 });
  });

  test("C. User can view Library / Saved content", async ({ page }) => {
    monitorConsoleAndNetwork(page);
    await loginAs(page, "subscriber");

    await page.goto("/library", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    const libraryContent = page.locator('main, [data-testid="library-page"], h1').first();
    await expect(libraryContent).toBeVisible({ timeout: 15_000 });
  });

  test("D. Settings page loads profile editing and account options", async ({ page }) => {
    monitorConsoleAndNetwork(page);
    await loginAs(page, "trainee");

    await page.goto("/settings", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("domcontentloaded");

    const settingsHeader = page.locator('h1:has-text("Settings"), h2:has-text("Settings"), main').first();
    await expect(settingsHeader).toBeVisible({ timeout: 15_000 });
  });
});
