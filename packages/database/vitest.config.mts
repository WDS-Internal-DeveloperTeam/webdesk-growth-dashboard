import { defineConfig } from "vitest/config";

// Unit tests only — mocked models/connections, no real database required.
// Integration tests (test/**/*.integration.test.ts, a real disposable
// database required) run separately via vitest.integration.config.mts /
// `pnpm test:integration`, kept out of the default include so `pnpm test`
// never fails on a missing DATABASE_URL.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    root: ".",
  },
});
