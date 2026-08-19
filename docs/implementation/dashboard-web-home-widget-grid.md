# `dashboard-web` Home Widget Grid (as-built)

**Status:** Built and fully validated. Closes a real, previously-undocumented gap: the Home page
(`/home`) never got wired up to the approved "Clean Enterprise" design system or the `packages/ui`
component library built for it (PR #33) — it was still hand-rolled `<ul><li>` markup with inline
`style={{ border: ... }}`, the exact pattern `docs/design/dashboard-ui/16-existing-shell-gap-
analysis.md` §2 flags by name. Not started automatically — built directly on the user's explicit
"wire up what already exists" instruction, after they reported the live Home page looked "very
very simple" (screenshot attached) and a scoping investigation confirmed the design system and
component library already existed and were simply never applied to this page.

## 1. What was wrong

The user's screenshot showed a plain, undesigned page: flat-bordered `<li>` cards with just a
title and grey status text, a bare sidebar with no visual weight, and almost no color beyond a
single pale-blue pill. Investigation (a dedicated research agent reading the Home page source, the
`packages/ui` component inventory, and the design system's own gap-analysis doc) found:

- The Home page imported only `ContentContainer`, `PageHeader`, `NotConfiguredState`, and
  `colorTokens` from `@webdesk/ui` — none of the ~30 components PR #33 added (`Card`, `Badge`,
  `EmptyState`, etc.).
- `docs/design/dashboard-ui/15-representative-screen-specifications.md` §1 already specifies
  exactly what this screen should be — a widget grid of `Card`s (Project Health, My Work, Critical
  Findings, Git/Release Status), the one screen given "extra editorial care" per the approved
  design direction — but that spec was written and approved, never implemented.
- The design system's own gap-analysis doc (`16-existing-shell-gap-analysis.md` §2) already flags
  `app/(shell)/home/page.tsx` (and `app/(shell)/projects/page.tsx`) as inline-style-only pages
  using idioms distinct from `packages/ui`'s token/component system.

So this was a "wire up what's already built and already approved" task, not new design work.

## 2. What was built

### Widget grid (`app/(shell)/home/page.tsx`)

Four `Card`-based widgets per the approved §15.1 spec, each rendering real data where a source
exists and `EmptyState` (never a fabricated number, per `00-dashboard-design-principles.md` §2.7)
where none does yet:

- **Project Health** — real counts of `session.projects` by status (active/paused/archived), shown
  as three `Badge`s (`healthy`/`attention`/`neutral` buckets). A note explains that page/approval/
  Ready-for-Claude health (the spec's own named sub-widgets) will appear once those modules exist.
  `EmptyState` when there are zero projects.
- **My Work** — `EmptyState`. No per-user task-assignment data source exists in any module yet.
- **Critical Findings** — `EmptyState`. No scan/security-findings module exists yet.
- **Git/Release Status** — real deploy metadata (version, short commit SHA, deploy timestamp,
  environment, operational/degraded `Badge`) sourced from `dashboard-api`'s `/health` endpoint,
  which `getServerSession()` already fetched but previously discarded everything except
  `environment`/`isDegraded`. `EmptyState` when `/health` returns no `build` block.

The "Project context" `NotConfiguredState` section is unchanged in meaning (the Project Switcher
still filters nothing yet) — only its surrounding page now uses real components.

### Module grid

The "Available to you (N modules)" grid now renders each module as a `Card` with a `Badge` showing
its real `implementationStatus`, instead of a bare bordered `<li>` with plain grey text. A new
`moduleImplementationStatusBadge()` helper (`lib/modules.ts`) maps the real 9-value
`implementationStatus` enum onto the existing 5-bucket status vocabulary
(`docs/design/dashboard-ui/10-status-and-workflow-system.md` §1) — the same "assign a visual
bucket to a real status, invent nothing" discipline `projectStatusBadge`/`roadmapItemStatusBadge`
already establish in `lib/projects.ts`. The badge label always reflects `implementationStatus` (the
same field driving the bucket color); a module's separate `featureStatus` string, when present, is
shown as a secondary muted caption rather than overriding the badge label — pairing an unrelated
free-form string with a color driven by a different field would risk a misleading combination.

### `lib/server-session.ts` — `systemStatus.release`

`ServerSessionSystemStatus` gained a new `release` field (`version`/`commitShaShort`/`deployedAt`,
or `null`), parsed from `/health`'s existing `build` block — no new backend endpoint, no new
network call, just no-longer-discarding data the session resolver already fetched. `null` only
when `/health` returns no `build` block at all (predates build-metadata wiring, or the E2E test
fixture). The E2E fixture session and `AppShell`'s own default both updated to satisfy the widened
type.

## 3. What was deliberately not touched

- `/projects` (also flagged by the gap-analysis doc) — the user's report and the approved scope
  were specifically the Home page; `/projects` remains its own, separate, not-yet-requested
  follow-up.
- No new backend endpoint, no new RBAC action, no change to what data any role can see — this is a
  presentation-layer change over data `getServerSession()` already fetched.
- No dark mode (still not V1, per the approved design direction).
- Per-module sidebar icons — no real icon set is specified anywhere in the design system; the
  sidebar's existing initials-based icon-only collapsed state is unaffected.

## 4. Validation

- `pnpm --filter @webdesk/dashboard-web run typecheck` — clean.
- `pnpm --filter @webdesk/dashboard-web run lint` — clean (0 warnings, `--max-warnings=0`).
- `pnpm --filter @webdesk/dashboard-web run test -- --run` — 157/157 passing (3 new: a
  `moduleImplementationStatusBadge()` unit test covering all 9 real `implementationStatus` values,
  and two `systemStatus.release` parsing tests in `server-session.test.tsx`).
- `pnpm --filter @webdesk/dashboard-web run build` (`next build`) — clean, `/home` still correctly
  listed as a dynamic (`ƒ`) route.
- `pnpm exec prettier --check` — clean on all changed files.
- **Live-rendered verification**: the authenticated shell was actually rendered in the Browser pane
  using this project's own sanctioned test-only session bypass
  (`apps/dashboard-web/lib/e2e-test-session.ts`, the same mechanism the automated WCAG suite uses,
  gated on `NODE_ENV !== "production"` and `PLAYWRIGHT_E2E_TEST_MODE=1` — inert in every real
  deployment) — not just typechecked/built blind. Confirmed: real `Card`-based widgets with
  shadows/borders, colored `Badge` pills (green "1 Active" / amber "0 Paused" / grey "0 Archived"),
  honest `EmptyState`s for My Work/Critical Findings/Git-Release-Status (no `/health` build block
  in the fixture environment), and the module grid rendering 15 fixture modules as `Card`s with
  green "Available" badges. No console errors beyond an expected local dev-server HMR WebSocket
  message (a sandboxed-proxy artifact, not an application error).

## 5. Files changed

- `apps/dashboard-web/app/(shell)/home/page.tsx` — full rewrite.
- `apps/dashboard-web/lib/modules.ts` — new file, `moduleImplementationStatusBadge()`.
- `apps/dashboard-web/lib/server-session.ts` — `ServerSessionSystemStatus.release`.
- `apps/dashboard-web/lib/e2e-test-session.ts`, `apps/dashboard-web/components/app-shell.tsx` —
  updated fixture/default to satisfy the widened type.
- `apps/dashboard-web/tests/unit/modules.test.tsx` — new file.
- `apps/dashboard-web/tests/unit/server-session.test.tsx` — new `systemStatus.release` coverage.
- `apps/dashboard-web/tests/unit/app-shell.test.tsx` — 3 existing fixtures updated for the widened
  type.
