import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

// NestJS relies on emitDecoratorMetadata (design:paramtypes) for constructor
// injection — esbuild (vitest's default transform) does not emit this, so
// DI silently breaks under plain vitest. unplugin-swc transforms via SWC
// instead, which does emit it. This is NestJS's own documented fix for
// using Vitest (see https://docs.nestjs.com/recipes/swc#vitest).
export default defineConfig({
  test: {
    include: ["src/**/*.spec.ts"],
    root: ".",
  },
  plugins: [swc.vite()],
});
