import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { E2E_SESSION_COOKIE_NAME, E2E_SESSION_COOKIE_VALUE } from "../../lib/e2e-test-session.js";

/**
 * WCAG 2.2 AA automated check (Phase 1F brief §17) via axe-core, run
 * against every page this CI environment can actually reach, including —
 * since the Dashboard UI Foundation Alignment pass added a test-only
 * authenticated-session fixture (`lib/e2e-test-session.ts`) — the real
 * authenticated application shell. Before that fixture existed, Phase
 * 1C's pre-provisioned-Google-SSO-only session model meant Playwright
 * could never complete a real login here, so the entire authenticated
 * shell had zero automated a11y coverage; this suite now closes that gap
 * for the shell itself (see the "authenticated shell" describe block
 * below). See `lib/e2e-test-session.ts`'s own doc comment for why this
 * fixture can never activate outside a Playwright-run dev server.
 */
test.describe("WCAG 2.2 AA automated checks (axe-core)", () => {
  test("sign-in page has no automatically-detectable violations", async ({ page }) => {
    await page.goto("/auth/sign-in");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test("health page has no automatically-detectable violations", async ({ page }) => {
    await page.goto("/health");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test("not-found page has no automatically-detectable violations", async ({ page }) => {
    await page.goto("/this-route-does-not-exist");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});

test.describe("WCAG 2.2 AA automated checks (axe-core) — authenticated shell", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().addCookies([
      {
        name: E2E_SESSION_COOKIE_NAME,
        value: E2E_SESSION_COOKIE_VALUE,
        url: "http://localhost:3000",
      },
    ]);
  });

  test("home page (application shell: header, sidebar nav, library clustering) has no automatically-detectable violations", async ({
    page,
  }) => {
    await page.goto("/home");
    await expect(page.getByRole("heading", { name: /Welcome,/ })).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test("home page with the sidebar collapsed has no automatically-detectable violations", async ({
    page,
  }) => {
    await page.goto("/home");
    await page.getByRole("button", { name: "Collapse sidebar" }).click();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
