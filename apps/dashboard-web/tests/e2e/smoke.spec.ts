import { expect, test } from "@playwright/test";

test.describe("Phase 1F application-shell smoke test", () => {
  test("an unauthenticated visit to / redirects to sign-in, never shows shell content", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/auth\/sign-in$/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in with Google Workspace" })).toBeVisible();
  });

  test("an unauthenticated visit to a shell route also redirects to sign-in", async ({ page }) => {
    await page.goto("/home");
    await expect(page).toHaveURL(/\/auth\/sign-in$/);
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
    const response = await page.goto("/health");
    expect(response?.headers()["x-frame-options"]).toBe("DENY");
    expect(response?.headers()["x-content-type-options"]).toBe("nosniff");
  });

  test("secure default headers are also present on the real page an unauthenticated visit lands on", async ({
    page,
  }) => {
    // "/" redirects to "/auth/sign-in" — the actual page a signed-out visitor's browser renders.
    // A header-matcher regression that only broke the redirect target wouldn't be caught by the
    // /health-only check above, since /health is never in that redirect chain.
    const response = await page.goto("/");
    expect(response?.headers()["x-frame-options"]).toBe("DENY");
    expect(response?.headers()["x-content-type-options"]).toBe("nosniff");
  });
});
