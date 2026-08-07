import { defineConfig } from "vitest/config";

/**
 * Integration tests require a real, disposable PostgreSQL database — never
 * staging/production (docs/contracts/database-contract.md's "Test
 * requirements"). Point DATABASE_URL at a throwaway database before
 * running: see packages/database/README.md for local setup, or CI's
 * `postgres:16` service container (.github/workflows/ci.yml).
 */
export default defineConfig({
  test: {
    include: ["test/**/*.integration.test.ts"],
    root: ".",
    testTimeout: 15_000,
    fileParallelism: false,
  },
});
