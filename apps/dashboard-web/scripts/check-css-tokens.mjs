#!/usr/bin/env node
/**
 * Enforces that every `@media (…px)` breakpoint and every `ms` transition/
 * animation duration in this app's CSS Modules matches one of
 * `@webdesk/ui`'s `breakpointTokens`/`motionTokens` values (design system
 * `05-dashboard-design-tokens.md` §6 — "a documented literal-value
 * convention with a lint rule enforcing it", since CSS custom properties
 * cannot appear inside a `@media` condition, so those tokens can't be
 * referenced directly from CSS). Run via `pnpm lint` (chained after
 * eslint) and in CI, so a hardcoded, un-tokenized value fails the build
 * instead of silently drifting from `packages/ui/src/tokens.ts`.
 *
 * Keep this file's literal number lists in sync with `tokens.ts` by hand —
 * there is no build-time import path from a `.mjs` lint script into the
 * TypeScript package without adding a compile step, which is disproportionate
 * to what this check needs.
 */
import { globSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const APPROVED_BREAKPOINTS_PX = [480, 768, 1024, 1280];
const APPROVED_DURATIONS_MS = [120, 200, 320];

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");

const files = globSync("**/*.module.css", { cwd: appRoot, exclude: ["**/node_modules/**"] }).map(
  (file) => path.join(appRoot, file),
);
const violations = [];

for (const file of files) {
  const contents = readFileSync(file, "utf8");
  const relative = path.relative(appRoot, file);

  for (const match of contents.matchAll(/@media[^{]*\(\s*(?:min|max)-width:\s*(\d+)px\s*\)/g)) {
    const value = Number(match[1]);
    if (!APPROVED_BREAKPOINTS_PX.includes(value)) {
      violations.push(
        `${relative}: @media breakpoint ${value}px is not one of the approved breakpointTokens values (${APPROVED_BREAKPOINTS_PX.join(", ")})`,
      );
    }
  }

  for (const match of contents.matchAll(/(?:transition|animation)[^;]*?(\d+)ms/g)) {
    const value = Number(match[1]);
    if (!APPROVED_DURATIONS_MS.includes(value)) {
      violations.push(
        `${relative}: transition/animation duration ${value}ms is not one of the approved motionTokens values (${APPROVED_DURATIONS_MS.join(", ")})`,
      );
    }
  }
}

if (violations.length > 0) {
  console.error("CSS token check failed — hardcoded values drift from @webdesk/ui's tokens:\n");
  for (const violation of violations) {
    console.error(`  - ${violation}`);
  }
  console.error(
    "\nUse one of breakpointTokens (mobile 480 / tablet 768 / laptop 1024 / desktop 1280) or " +
      "motionTokens (durationFast 120 / durationBase 200 / durationSlow 320) values instead.",
  );
  process.exit(1);
}

console.log(`CSS token check passed (${files.length} CSS Module file(s) checked).`);
