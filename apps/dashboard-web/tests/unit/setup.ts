import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";

// vitest.config.mts doesn't set `test.globals: true`, so @testing-library/react's
// own auto-cleanup registration (which relies on a global `afterEach`) is a no-op —
// register it explicitly so DOM from one test doesn't leak into the next
// (same fix as packages/ui/src/vitest.setup.ts).
afterEach(() => {
  cleanup();
});

// jsdom doesn't implement `window.matchMedia` — needed by `AppShell`'s tablet-range
// detection (`04-navigation-system.md` §1.5). Always reports "no match"; tests that
// need to exercise the tablet-range behavior override this per-test instead.
if (typeof window.matchMedia !== "function") {
  window.matchMedia = (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}
