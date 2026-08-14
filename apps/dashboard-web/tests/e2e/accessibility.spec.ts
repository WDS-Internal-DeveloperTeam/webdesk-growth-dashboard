import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * WCAG 2.2 AA automated check (Phase 1F brief §17) via axe-core, run
 * against every page this CI environment can actually reach. The
 * authenticated application shell (home, nav, project context) is
 * deliberately NOT covered here — there is no test-only session bypass
 * (Phase 1C's session model is pre-provisioned-Google-SSO only, see
 * CLAUDE.md), so Playwright can never establish a real authenticated
 * session in CI. Manual verification of the authenticated shell is
 * required separately (see docs/implementation/phase-1f-accessibility.md)
 * — this suite never claims to cover more than it does.
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
