import { expect, test } from "@playwright/test";

test.describe("Phase 1A smoke test", () => {
  test("home page loads and shows the placeholder shell", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "WebDesk Growth Dashboard" })).toBeVisible();
  });

  test("health page shows ok status", async ({ page }) => {
    await page.goto("/health");
    await expect(page.getByRole("heading", { name: "Service Health" })).toBeVisible();
    await expect(page.getByText("ok")).toBeVisible();
  });

  test("an unknown route renders the not-found page", async ({ page }) => {
    await page.goto("/this-route-does-not-exist");
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  });

  test("secure default headers are present", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.headers()["x-frame-options"]).toBe("DENY");
    expect(response?.headers()["x-content-type-options"]).toBe("nosniff");
  });
});
