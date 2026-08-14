import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";

// vitest.config.mts doesn't set `test.globals: true`, so @testing-library/react's
// own auto-cleanup registration (which relies on a global `afterEach`) is a no-op —
// register it explicitly so DOM from one test doesn't leak into the next.
afterEach(() => {
  cleanup();
});
