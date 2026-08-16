import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Mirrors tsconfig.json's "@/*" path mapping. Every prior "@/lib/..." import in this app has been
// type-only (erased before Vite ever sees it) or under a directory Next.js resolves at build time
// but Vitest doesn't — this alias was never actually exercised until a real (value) "@/lib/..."
// import needed it here.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    include: ["tests/unit/**/*.test.tsx"],
    setupFiles: ["./tests/unit/setup.ts"],
  },
});
