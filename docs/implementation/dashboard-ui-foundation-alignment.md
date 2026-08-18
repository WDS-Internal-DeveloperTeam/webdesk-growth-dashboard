# Dashboard UI Foundation Alignment — As-Built Record

**Status:** Built and fully validated on branch `dashboard-ui-foundation-alignment`. Not yet
code-reviewed, security-reviewed, gated, or merged — each remains a separate, not-yet-requested
next step per this project's standing discipline and this task package's own Git workflow section.

**Authorization:** `docs/task-packages/dashboard-ui-foundation-alignment.md`, built directly on the
explicit "Begin this work" instruction that followed the task package's own preparation. Approved
starting commit: `f99f5bc88e652d01b4186dde3db38e0c7877bafc` (verified zero code drift since that
commit before work began — only `CLAUDE.md` and the task-package doc itself had changed).

## Scope recap

Aligns the Phase 1F application shell, `packages/ui`'s component library, and its design tokens to
the approved Dashboard UI/UX Design System (`docs/design/dashboard-ui/`, approved 2026-08-17). Six
numbered scope items from the task package, all built:

1. Design tokens
2. Core component library (~30 new components)
3. Navigation and shell (collapse toggle, library clustering, tablet behavior, header additions)
4. Auth page re-skin (6 pages)
5. Accessibility test-coverage gap (test-only session bypass + new axe-core coverage)
6. Lightweight in-repo component documentation

## 1. Design tokens (`packages/ui/src/tokens.ts`)

- Added `statusBadgeTokens` — the 5-bucket business-record/workflow status palette (`healthy` /
  `attention` / `blocked` / `informational` / `neutral`, each `{text, background, dot}`),
  additive alongside the existing `statusTokens` (system/integration health, unchanged).
- Added `layoutTokens.contentMaxWidthWide` (`1600px`) and `layoutTokens.drawerWidth` (`420px`).
- Wired `breakpointTokens`/`motionTokens` into a real enforcement mechanism: since CSS custom
  properties can't appear inside a `@media` condition, `apps/dashboard-web/scripts/check-css-tokens.mjs`
  scans every `.module.css` file for `@media (…px)` breakpoints and `transition`/`animation`
  durations, failing `pnpm lint` if a hardcoded value doesn't match one of the four approved
  breakpoints or three approved durations. Chained after ESLint in `package.json`'s `lint` script.
  **Known limitation, disclosed rather than silently accepted**: the regex-based scanner only
  reliably checks the first breakpoint clause in a compound `@media (min-width: …) and
(max-width: …)` query (confirmed empirically — it does not falsely pass a bad first value, it
  just doesn't independently re-validate a second clause lacking its own `@media` prefix). Not
  worth a full CSS parser for four approved values; flagged here for whoever next touches this
  script.
- Fixed the pre-existing `200ms ease` transition in `app-shell.module.css` to reference the real
  `motionTokens.easingStandard` curve (`cubic-bezier(0.4, 0, 0.2, 1)`) instead of a plain keyword.

## 2. Core component library (`packages/ui/src/components/`)

Five new files, ~30 components total, each with a matching `*.test.tsx` (RTL, following the
existing `states.test.tsx`/`page-shell.test.tsx` pattern) — 79 new/total `packages/ui` unit tests:

- `controls.tsx` — `Button`, `IconButton`, `AppLink`, `FieldWrapper`, `Input`, `Textarea`, `Select`
  (native, `multiple`-capable), `Checkbox`, `RadioGroup`, `Toggle`, `DateField`.
- `structural.tsx` — `Badge` (the real `statusBadgeTokens`-driven status badge), `Avatar`
  (initials-only — no photo-avatar capability exists anywhere in this app), `Card`, `Table`
  (generic/typed, real `<button>` sortable headers), `Tabs` (full WAI-ARIA roving-tabindex pattern),
  `Accordion`, `Pagination`.
- `overlay.tsx` — `Drawer`, `Modal` (both focus-trapped, close-on-`Escape`, focus-restored-on-close
  via a shared `useDialogBehavior` hook), `Tooltip` (hover **and** keyboard focus), `Dropdown`
  (optional non-interactive `header` slot), `CommandMenu` (the `⌘K`/`Ctrl+K` overlay pattern).
- `feedback.tsx` — `Alert`, `ToastProvider`/`useToast()`, `Progress`, `Timeline`,
  `VersionIndicator`.
- `domain.tsx` — `ApprovalBlock` (the single reusable approval surface per design prompt §11 —
  current/proposed version, submitter, reviewer, required approver(s), status, comments, date,
  collapsed previous-approvals, Approve/Request Revision/Reject actions with a required-reason
  confirmation for the latter two), `DiffViewer` (field-level, not code-diff), `FileAttachment`
  (references only, confidential-field-aware locked state), `RelationshipPicker`,
  `Stepper`, `Code` (the mono-font inline-text convention).

`controls.tsx` uses no React hooks beyond `forwardRef` and needs no `"use client"` directive;
`structural.tsx`, `overlay.tsx`, `feedback.tsx`, and `domain.tsx` all use `useState`/`useEffect`/
`useRef`/`useContext` and are marked `"use client"` — required because Next.js's RSC compiler
enforces this per-module, not just for `dashboard-web`'s own files, which surfaced as a real
`next build` failure the first time these were imported (see §7, Errors and fixes).

A real bug was caught by the component tests themselves during development: `ApprovalBlock`'s
"Previous approvals" disclosure initially used a static, always-collapsed `expandedIds={new Set()}`
with a no-op `onToggle` — the click handler existed but never actually expanded anything. Fixed by
giving `ApprovalBlock` its own `isPreviousExpanded` state.

## 3. Navigation and shell (`apps/dashboard-web/components/app-shell.tsx` + `.module.css`)

- **Desktop collapse toggle**: `layoutTokens.sidebarWidthCollapsed` (`64px`), previously defined
  but unused, is now wired to a real toggle (`IconButton`, persisted in `localStorage`). Collapsed
  mode renders each nav link as a 2-letter monogram wrapped in a real `Tooltip` (hover + focus),
  since no per-module icon field exists in the registry.
- **Library clustering**: the `libraries` navigation group's 25 modules are now sub-organized into
  5 non-interactive cluster headers (Strategy & Business, Case Studies & Portfolio, Design System,
  Content & Search, Agents & Knowledge), derived purely from each module's existing seeded
  `navigationOrder` (verified against migration `00035`'s real seed data) — display-layer only, no
  `module_registry` schema change. Hidden in icon-only/collapsed mode (no room for headers).
- **Tablet behavior**: a `window.matchMedia("(min-width: 768px) and (max-width: 1023.98px)")`
  listener forces icon-only rendering in the tablet range, with the manual collapse toggle hidden
  there (tablet gets the collapsed rail _by default_, no user override, avoiding a three-state
  toggle system disproportionate to this task's scope). Mobile (`<768px`) off-canvas behavior is
  unchanged.
- **Header additions**: a user-menu `Dropdown` (avatar/initials + name trigger, email header,
  "Sign out" — replacing the old plain "Sign out" link, which changed the account-menu unit test's
  interaction model from a direct link click to open-menu-then-click-menuitem), a Help icon
  (navigates to the `help_center` module's route when present in the caller's own navigation, else
  omitted entirely — never a dead link), an environment badge (shown only when `/health`'s
  `build.environment` is non-`"production"`), and a degraded-system-status badge (shown only when
  `/health`'s `status !== "ok"` — absence _is_ the all-clear state, never a routine green dot).
  `lib/server-session.ts` gained `fetchSystemStatus()` (bundled into the existing
  `getServerSession()` `Promise.all`, same never-throws/always-logs resilience pattern as the
  existing `fetchProjectSummaries()`) and a new `ServerSessionSystemStatus` field, threaded through
  as an optional `AppShellProps.systemStatus` (defaults to `{environment: null, isDegraded: false}`
  rather than being made a required prop, to avoid a 13-call-site test-file rewrite for a
  conditional, non-critical piece of header chrome).
- **Header search**: a `CommandMenu` populated from the caller's own already-fetched `navigation`
  list (client-side filter by module name), opened via the header search icon or `⌘K`/`Ctrl+K`.
  Deliberately **module-only** — not cross-record search, since no business-module search backend
  exists yet (confirmed by reading the actual `dashboard-api` route table before building this).
- **Header notifications**: a bell `IconButton` opening a `Drawer` that renders `NotConfiguredState`
  with an honest message. Deliberately **not** wired to `GET /notifications` as a real personal
  inbox — verified live that the endpoint is gated on `system_settings:notifications_view`, which is
  genuinely zero-seeded (no role holds it, not even Super Admin), and that its `list()` method has
  no per-caller `recipientUserId` filter (an admin-list endpoint, not a self-service inbox). Real
  wiring needs a new self-service endpoint plus an RBAC seed decision — both separate, not-yet-
  requested authorizations, exactly as flagged in the task package.

22 new/updated `dashboard-web` unit tests in `tests/unit/app-shell.test.tsx` cover all of the
above (collapse toggle, cluster headers appearing/hiding, search filter-and-navigate, help-icon
presence/absence, notifications drawer content, environment/degraded badge visibility).

## 4. Auth page re-skin (`apps/dashboard-web/app/auth/`)

All 6 pre-`packages/ui` pages (`sign-in`, `error`, `logout`, `session-expired`, `emergency`,
`emergency/totp`) re-skinned to the token system via a new shared `app/auth/auth.module.css` and,
for the two real forms, `@webdesk/ui`'s `Input`/`Button` components — with **zero change to actual
auth flow, field names/ids/`autoComplete` attributes, or submit logic**. Closes the confirmed
`#b00020` vs. `colorTokens.danger` (`#dc2626`) color drift named in the design system's own gap
analysis (`16-existing-shell-gap-analysis.md` §2).

A real accessibility regression was caught by the _existing_ `sign-in page has no
automatically-detectable violations` axe-core test during this re-skin: the muted-gray
"Emergency administrator access" link, now inside a `color: foregroundMuted` paragraph, failed
axe's `link-in-text-block` check (1.46:1 contrast, no distinguishing style) — an inline link needs
more than color alone to be distinguishable from surrounding body text. Fixed by making `.link`
always-underlined instead of underline-on-hover-only, not by chasing a higher-contrast blue (per
WCAG 2.2 SC 1.4.1, underline-or-sufficient-contrast, either satisfies the rule — underline was the
smaller, more broadly correct fix since it doesn't depend on the surrounding text color staying
fixed forever).

## 5. Accessibility test-coverage gap (`apps/dashboard-web/lib/e2e-test-session.ts`)

Closes a real, previously-undocumented-as-explicit gap: `tests/e2e/accessibility.spec.ts`'s
automated WCAG 2.2 AA suite covered exactly 3 unauthenticated routes before this — Phase 1C's
pre-provisioned-Google-SSO-only session model means Playwright can never complete a real login in
CI, so the entire authenticated application shell had zero automated accessibility coverage.

Built a test-only authenticated-session fixture, treated with the same security scrutiny as real
auth code per this task package's own explicit instruction — see `lib/e2e-test-session.ts`'s own
extensive doc comment for the full reasoning, summarized:

- Gated on **two** independent conditions, neither settable by a request: `process.env.NODE_ENV
!== "production"` (every real Vercel deployment, production and preview, runs `next build` +
  `next start` under `NODE_ENV=production` — fixed Next.js behavior, not this app's own
  configuration) **and** `process.env.PLAYWRIGHT_E2E_TEST_MODE === "1"` (set only in
  `playwright.config.ts`'s `webServer.env`, never in `.env.local` or any real deployment config).
- Even with both true, a request still needs an exact fixture cookie value — not a secret in
  itself, just keeps the bypass from firing on every request in a Playwright run.
- Wired into `getServerSession()` as the very first check, returning a fixed fixture session
  (representative navigation entries across all 10 approved nav groups, including enough
  `libraries` entries to exercise real cluster headers) — never touches `dashboard-api` or any real
  session-cookie logic.
- 8 new unit tests (`tests/unit/e2e-test-session.test.tsx`) prove the gate's exact boolean logic,
  including that the flag alone (without the `NODE_ENV` condition) is insufficient and vice versa.
- 2 new Playwright tests scan `/home` (the real rendered shell — header, sidebar, nav clustering)
  both expanded and collapsed.

**This new coverage immediately found 3 real, previously-undetected WCAG AA contrast violations**,
all pre-existing (none in code newly written by this task's own component work) and all fixed:

1. `apps/dashboard-web/app/(shell)/home/page.tsx` hardcoded `color: "#94a3b8"`
   (`colorTokens.foregroundSubtle`-equivalent) for each module card's status text — 2.56:1,
   under the 4.5:1 minimum. Fixed by switching to `colorTokens.foregroundMuted` (7.58:1) and, while
   already touching this file's 4 inline literals for the one that mattered, replacing the other 3
   hardcoded hex values with their real token equivalents (a pre-existing, separately-documented
   drift this task wasn't scoped to fully rewrite, but which sat directly next to the real fix).
2. `packages/ui/src/components/states.tsx`'s `badgeStyle()` calls for `ErrorState` (danger:
   4.41:1), `ForbiddenState`/`DegradedState` (warning: 3.07:1), and `NotConfiguredState` (info:
   3.84:1) — all under 4.5:1. `colorTokens.danger`/`warning`/`info` themselves were **not**
   changed (they're used elsewhere — buttons, icons — under different contrast rules and are used
   by already-shipped, already-reviewed code across four prior phases); instead these four call
   sites were pointed at the new `statusBadgeTokens.blocked.text` / `.attention.text` /
   `.informational.text` values, which happened to already be WCAG-safe darker shades of the exact
   same hues (confirmed by direct computation, not coincidence — both were derived from the same
   design-system color-scale reasoning).
3. `apps/dashboard-web/components/app-shell.module.css`'s pre-existing `.navGroupLabel` (and this
   task's own new `.clusterLabel`, sharing the same bug before it was caught) used
   `--webdesk-dashboard-color-foreground-subtle` at `0.75rem` — 2.45:1 against the sidebar surface,
   under 4.5:1. Fixed by switching both to `foreground-muted`.

All three fixes verified against the live axe-core run, not just visually — the full Playwright
suite (15/15) is green with both new authenticated-shell tests included.

## 6. Component documentation

`packages/ui/README.md` (new) — no Storybook (explicitly rejected as unjustified new tooling cost,
per the task package's own design decision). Documents every exported component by category,
cross-referenced to its test file for exact prop shapes, plus the token system and the conventions
new components should follow (token-only values, `"use client"` when hooks are used, dialog
focus-trap requirements, status encoded in form as well as color, WCAG verification before
shipping — the last one added directly because of what §5 above found).

## 7. Errors and fixes (chronological, beyond what's already covered above)

- **Missing `"use client"` directives**: the first `next build` after adding `overlay.tsx`,
  `structural.tsx`, `domain.tsx`, and `feedback.tsx` failed with "You're importing a module that
  depends on `useState`/`useRef`/`useEffect`/`createContext` into a React Server Component module."
  Fixed by adding `"use client"` to the top of all four files (not `controls.tsx`, which uses no
  such hooks and is correctly server-renderable).
- **`window.matchMedia` missing in jsdom**: `AppShell`'s new tablet-range detection crashed every
  existing `app-shell.test.tsx` test with `window.matchMedia is not a function` — jsdom doesn't
  implement it. Fixed with a minimal polyfill (always reports no-match) in
  `tests/unit/setup.ts`, not a per-test workaround.
- **Stale dev server masking the E2E test-mode flag**: the first attempt at the new authenticated
  a11y tests failed (`heading not found`, then a 30s timeout) — not a real bug, but Playwright's
  `webServer.reuseExistingServer` (true outside CI) had reused an already-running `next dev`
  process from before `PLAYWRIGHT_E2E_TEST_MODE` was added to `playwright.config.ts`, so the fixture
  bypass was never actually active. Fixed by killing the stale process before each Playwright run
  during development — no code change, a real operational lesson worth recording since it will
  recur for anyone iterating on this file locally.
- Several unit-test-authoring mistakes were self-caught and fixed before considering any component
  "done" (documented in each component's own test file, not repeated here): clicking a
  `role="option"` `<li>` doesn't trigger its inner `<button>`'s handler (`CommandMenu`,
  `RelationshipPicker` tests); native `<select>` and a custom `role="combobox"` both resolve to the
  ARIA `combobox` role, requiring `within(dialog)` scoping in the search test; `getByLabelText`
  needs a regex, not an exact string, when the label text includes a required-field `*` suffix.

## Validation summary

- `packages/ui`: 79/79 unit tests, typecheck clean, lint clean (including the new
  `statusBadgeTokens`/component exports), `tsc` build clean.
- `apps/dashboard-web`: 103/103 unit tests, typecheck clean, lint clean (including the new
  `check-css-tokens.mjs` script), `next build` clean, `pnpm exec prettier --check` clean.
- Playwright: 15/15 tests passing, including the 2 new authenticated-shell WCAG 2.2 AA checks.
- Manual contrast verification: all 5 `statusBadgeTokens` buckets computed directly (WCAG 2.1
  relative-luminance formula) against their own backgrounds — healthy 6.81:1, attention 6.84:1,
  blocked 7.60:1, informational 7.09:1, neutral 9.45:1, all comfortably over the 4.5:1 minimum for
  normal-size text.
- Files touched are confined to `apps/dashboard-web` and `packages/ui` — zero `packages/database`
  or `apps/dashboard-api` files touched (the task package allowed two narrow exceptions; neither
  was needed).

## Explicitly out of scope (unchanged from the task package)

Any of the 43 modules' business functionality; real cross-record global search; real per-user
notification delivery; dark mode; any RBAC/workflow-state/module-registry schema change; any new
component-library dependency; production deployment and merge.

## Next steps (each separate, not-yet-requested)

A security review (given the auth-adjacent test-mode bypass in §5); a review packet for the
required second-role human review (ADR-0010 — the implementing agent cannot also be its own
reviewer); a gate decision; merge authorization; production deployment. No business-module
implementation work starts automatically once this lands, per the task package's own explicit
instruction.

## Independent code review

This project's own `code-review` skill ran (high effort, 8 finder angles, 1-vote verification)
against the full branch diff (PR #33) — 10 findings survived: 8 CONFIRMED, 2 PLAUSIBLE. Per the
explicit "fix the confirmed findings" instruction, all 8 CONFIRMED findings were fixed; the 2
PLAUSIBLE findings were left unaddressed pending a separate decision (scope was literal — only
verdict-CONFIRMED findings were in scope for this fix pass).

Fixed:

1. **Tablet/mobile `@media` breakpoints overlapped at exactly 768px**
   (`components/app-shell.module.css`, `components/app-shell.tsx`) — the tablet range query
   (`min-width: 768px, max-width: 1023.98px`) and the mobile query (`max-width: 768px`) both
   matched at 768px itself (a real device width, e.g. iPad portrait), so the mobile off-canvas CSS
   and the JS tablet-icon-only state could both apply at once, producing an unintended combination
   (off-canvas drawer contents rendered as cramped icon-only tiles). Fixed by moving both
   boundaries to whole-pixel, non-overlapping values: mobile now `max-width: 767px`, tablet now
   `max-width: 1023px` (matching `TABLET_RANGE_QUERY` in `app-shell.tsx`).
2. **`check-css-tokens.mjs`'s breakpoint regex missed decimal values and only checked one clause
   per compound `@media` query** — `(\d+)px` never matched `1023.98px` (the exact value finding 1
   introduced), so the lint script silently passed a violating value; separately, a compound query
   with two `min-width`/`max-width` clauses only ever had one validated. Rewrote the check to
   extract the full `@media (...)` prelude first, then validate every `min-width`/`max-width`
   clause inside it against a decimal-aware regex, and to explicitly allow the "breakpoint minus
   one" exclusive-boundary pattern finding 1's fix now relies on (e.g. `767px` as the pixel just
   below the `768px` token).
3. **Dialog focus-trap effect re-ran on unrelated re-renders** (`packages/ui/src/components/
overlay.tsx`, `useDialogBehavior`) — every caller passes an inline arrow `onClose`, giving it a
   new identity on every parent render; the effect depended on `[isOpen, onClose]`, so any
   unrelated re-render while a dialog was open (e.g. the shell's tablet-detection `matchMedia`
   listener firing on a real viewport resize) tore down and re-ran the focus trap, yanking focus
   back to the trigger element. Fixed via the standard latest-ref pattern: `onClose` is now read
   through a ref kept fresh every render (no effect needed to update it), and the effect depends
   on `isOpen` alone.
4. **`ApprovalBlock`'s `reason` textarea leaked between the Reject and Request Revision modals**
   (`packages/ui/src/components/domain.tsx`) — both modals share one `reason` state, cleared only
   on successful submit, never on Cancel/Escape/backdrop-dismiss; a reason typed and abandoned in
   one modal reappeared pre-filled the next time either modal opened. Fixed by clearing `reason` on
   every path that opens or closes either modal (`openReject`/`openRevision`/`closeReject`/
   `closeRevision`, now also used by both `Modal`'s `onClose` and each Cancel button).
5. **`accessibility.spec.ts` hardcoded a second, independent copy of the e2e session cookie
   name/value** instead of importing them from `lib/e2e-test-session.ts` (which already exported
   the name and had the value as a private constant) — a silent-drift risk for a file this
   project's own task package flagged as needing the same review scrutiny as real auth code. Fixed
   by exporting `E2E_SESSION_COOKIE_VALUE` (documented as not itself a secret once both real gates
   hold — see that file's own doc comment) and importing both constants in the spec.
6. **`Progress` rendered `width: "NaN%"` at `max === 0`** (`packages/ui/src/components/
feedback.tsx`) — `(value / max) * 100` is `NaN`/`Infinity` at `max <= 0`, propagating through both
   clamps unguarded. Fixed with an explicit `max > 0` guard, rendering `0%` otherwise.
7. **`initialsFor()` was duplicated verbatim** between `components/app-shell.tsx` and
   `packages/ui/src/components/structural.tsx` (the latter already exported `Avatar`, which uses
   its own private copy internally) — `app-shell.tsx` already imported from `@webdesk/ui` in the
   same file, so a working import path existed but wasn't used. Fixed by exporting `initialsFor`
   from `packages/ui` (added to the barrel) and having `app-shell.tsx` import it instead of
   defining its own copy.
8. **Test fixture default-shape duplication had already drifted** — `lib/e2e-test-session.ts`'s
   `fixtureModule()` and `tests/unit/app-shell.test.tsx`'s `navEntry()` independently built the
   same ~19-field `ModuleRegistrySummary` default shape, and their `implementationStatus` defaults
   had already diverged (`"available"` vs. `"not_started"`) with no indication it was intentional.
   Fixed by exporting `fixtureModule()` from `e2e-test-session.ts` and having `navEntry()` delegate
   to it (passing its own `navigationGroup`/`navigationOrder`/`route` defaults as overrides),
   leaving one single source of truth for the shape.

Left unaddressed (PLAUSIBLE, not CONFIRMED — outside this fix pass's literal scope):

- The header "Sign out" menu item uses `onSelect: () => router.push("/auth/logout")` instead of a
  real `href` — the verifier confirmed the regression but downgraded it since `/auth/logout`'s own
  session-revocation call was already JS-only before this PR, and other new header controls in
  this same PR are already JS-only too.
- `structural.tsx`'s new `Badge` (business-status, `statusBadgeTokens`) and `page-shell.tsx`'s
  pre-existing `StatusBadge` (system-health, `statusTokens`) are structurally near-duplicate — the
  verifier found real mitigation already in place (differently-typed required props, explicit
  doc-comment cross-references in both files) and downgraded to PLAUSIBLE.

Re-validated after fixes: 79/79 `packages/ui` unit tests, 103/103 `dashboard-web` unit tests,
15/15 Playwright tests (including both authenticated-shell a11y checks, now importing the cookie
constants instead of hardcoding them), typecheck/lint/`next build`/`tsc` build clean across both
packages, `pnpm exec prettier --check` clean.
