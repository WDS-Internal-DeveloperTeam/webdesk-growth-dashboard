import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env["CI"],
    timeout: 60_000,
    // A fixture value only — no real dashboard-api runs in this smoke-test job.
    // Sufficient for /auth/sign-in to render (it only builds a link from this
    // value, no fetch) and for getServerSession() to short-circuit safely for
    // any request with no session cookie, which every fresh Playwright context
    // starts as, so no dashboard-api call is ever actually attempted here.
    //
    // PLAYWRIGHT_E2E_TEST_MODE: enables the test-only authenticated-session fixture
    // (lib/e2e-test-session.ts) so the accessibility suite can scan the real
    // authenticated shell — see that file's own doc comment for the full security
    // reasoning on why this can never activate outside a Playwright-run dev server.
    env: { NEXT_PUBLIC_API_BASE_URL: "http://localhost:3001", PLAYWRIGHT_E2E_TEST_MODE: "1" },
  },
});
