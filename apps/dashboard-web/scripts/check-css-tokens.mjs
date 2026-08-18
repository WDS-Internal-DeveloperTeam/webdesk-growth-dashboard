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
// A `max-width` clause pairing with the NEXT breakpoint up needs to stop one pixel short of it
// (e.g. `max-width: 767px` to hand off cleanly to a `min-width: 768px` rule with no overlap at
// the boundary pixel) — allow exactly that "breakpoint minus 1" value for `max-width` only.
const APPROVED_MAX_WIDTH_EXCLUSIVE_PX = APPROVED_BREAKPOINTS_PX.map((value) => value - 1);
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

  // Each `@media (...)` prelude can hold more than one `min-width`/`max-width` clause (a
  // compound range query like `(min-width: 768px) and (max-width: 1023px)`) — extract the
  // full prelude first, then check every width clause inside it, not just the first/last match.
  for (const preludeMatch of contents.matchAll(/@media\s*([^{]+)\{/g)) {
    const prelude = preludeMatch[1];
    for (const widthMatch of prelude.matchAll(/(min|max)-width:\s*(\d+(?:\.\d+)?)px/g)) {
      const kind = widthMatch[1];
      const value = Number(widthMatch[2]);
      const approved =
        kind === "max"
          ? [...APPROVED_BREAKPOINTS_PX, ...APPROVED_MAX_WIDTH_EXCLUSIVE_PX]
          : APPROVED_BREAKPOINTS_PX;
      if (!approved.includes(value)) {
        violations.push(
          `${relative}: @media ${kind}-width ${value}px is not one of the approved breakpointTokens values (${approved.join(", ")})`,
        );
      }
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
