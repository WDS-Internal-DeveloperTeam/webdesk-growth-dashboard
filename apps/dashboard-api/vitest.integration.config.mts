import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

// Integration tests boot a real Nest application (via @nestjs/testing) and
// exercise it through supertest — no external services (no database, no
// third-party API) are required, per docs/contracts/*.md's Phase 1A scope.
export default defineConfig({
  test: {
    include: ["test/**/*.e2e-spec.ts"],
    root: ".",
    // Every e2e-spec file runs its own full migrate-up/migrate-down cycle
    // against the SAME shared disposable database (packages/database/README.md) —
    // running files in parallel races two concurrent schema migrations against
    // one database and fails non-deterministically. Sequential is correct here.
    fileParallelism: false,
  },
  plugins: [swc.vite()],
});
