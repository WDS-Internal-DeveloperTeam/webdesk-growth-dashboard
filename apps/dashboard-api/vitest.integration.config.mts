import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

// Integration tests boot a real Nest application (via @nestjs/testing) and
// exercise it through supertest — no external services (no database, no
// third-party API) are required, per docs/contracts/*.md's Phase 1A scope.
export default defineConfig({
  test: {
    include: ["test/**/*.e2e-spec.ts"],
    root: ".",
  },
  plugins: [swc.vite()],
});
