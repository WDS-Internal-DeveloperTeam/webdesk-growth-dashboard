# Task Package — Dashboard UI Foundation Alignment

**Status:** Scoped, not authorized to build. This document formalizes what the work would be, per
this project's standing pattern of writing a task package before implementation begins. Writing
this package is not itself authorization to start — see "Authorization" below.

## Authorization

**Authorized by:** Not yet. The design prompt's own §34 names this exact next step ("prepare a
separate implementation task package for Dashboard UI Foundation Alignment") as something that
follows design-direction approval, not something the approval itself authorizes. Direction
approval is recorded in `docs/design/dashboard-ui/17-dashboard-ui-approval-checklist.md` (WebDesk
Solution, CONFIRM equivalent — "Approve recommended direction as-is," 2026-08-17) and
`outputs/webdesk-growth-dashboard/project.json`'s `audit_log`. **A separate, explicit "begin this
work" instruction is required before any branch is created or any code is touched**, matching this
project's discipline for every prior phase.

**Scope:** Align the existing Phase 1F frontend foundation (`packages/ui`, `apps/dashboard-web`'s
shell) to the approved 18-document design system (`docs/design/dashboard-ui/00`–`17`). No business-
module functionality. No backend business logic beyond the two narrowly-scoped exceptions in §3.

## Approved starting commit

`f99f5bc88e652d01b4186dde3db38e0c7877bafc` — current `main` HEAD, the commit immediately after
[PR #32](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/32) (the
design-system documentation) merged and the approval was recorded. Verified: `git diff
800472e96a1478ff715edb00f2ad26b6fa2cd44b..f99f5bc88e652d01b4186dde3db38e0c7877bafc --stat` shows
only `CLAUDE.md` and `project.json` changed (recording the merge itself) — zero application code
drift since the design system's own merge commit.

## Required context — read in this order

1. `docs/design/dashboard-ui/17-dashboard-ui-approval-checklist.md` — confirms what was actually
   approved (Direction A + the scoped Direction B borrowing; dark mode deferred).
2. `docs/design/dashboard-ui/16-existing-shell-gap-analysis.md` — the authoritative gap list this
   whole task package is scoped against; every item in §3 below traces to a specific finding there.
3. `docs/design/dashboard-ui/05-dashboard-design-tokens.md`, `06-dashboard-component-system.md`,
   `04-navigation-system.md`, `07-page-patterns.md` through `14-accessibility-requirements.md` — the
   concrete specs this work implements.
4. `packages/ui/src/tokens.ts`, `components/page-shell.tsx`, `components/states.tsx` — the real,
   current foundation being extended, not assumed from the gap analysis's summary.
5. `apps/dashboard-web/components/app-shell.tsx` and `app-shell.module.css` — the real, current
   shell being extended.

## Pre-implementation verification (do this before writing any code)

- [ ] Confirm `docs/design/dashboard-ui/17-dashboard-ui-approval-checklist.md`'s decision is still
      current (no later change of direction recorded) — re-read at the time work actually starts,
      not assumed from this document's own point-in-time summary.
- [ ] Confirm no `packages/ui` or `apps/dashboard-web` file has changed since
      `f99f5bc88e652d01b4186dde3db38e0c7877bafc` (re-run the `git diff --stat` check above at
      start time) — if it has, re-verify this package's assumptions against the real current state
      rather than proceeding on stale information.
- [ ] Confirm the full test suite is green on `main` before branching (same standing discipline as
      every prior phase).
- [ ] Re-confirm the two backend-adjacent findings in §3's "Header search" and "Header
      notifications" bullets below are still accurate against live code
      (`apps/dashboard-api/src/notifications/notifications.controller.ts`'s real permission gate,
      and whether any global-search endpoint has been added since) — these determine how much of
      the header can be wired to real data versus UI-only.

## Scope

### 1. Design tokens (`05-dashboard-design-tokens.md`)

- Add the new `statusBadgeTokens` (5 semantic buckets: healthy/attention/blocked/informational/
  neutral, each `{text, background, dot}`) to `packages/ui/src/tokens.ts`, alongside — not
  replacing — the existing `statusTokens` (which stay as-is for system-health-style single-color
  use per `10-status-and-workflow-system.md` §13).
- Add `contentMaxWidthWide` (`1600px`) and `drawerWidth` (`420px`) to `layoutTokens`.
- Wire `breakpointTokens` and `motionTokens` into real, shared CSS constants (a small SCSS/
  PostCSS-level constant file or a documented literal convention + lint rule) so every future
  `@media`/transition rule in the app references one source instead of independently hardcoding
  `768px`/`200ms` per file, closing the drift risk `16-existing-shell-gap-analysis.md` §3 names.
- **Run every `statusBadgeTokens` text/background pair through a real contrast-checking tool**
  before shipping — `05-dashboard-design-tokens.md` §1.2 explicitly flags this as unverified, not
  assumed-safe.

### 2. Core component library (`06-dashboard-component-system.md` §2–§6)

Build the ~30 net-new components: `Button`, `Icon button`, `Link`, `Input`, `Textarea`, `Select`,
`Multi-select`, `Checkbox`, `Radio`, `Toggle`, `Date field`, `Badge`, `Avatar` (core controls);
`Card`, `Table`, `Tabs`, `Accordion`, `Pagination` (structural); `Drawer`, `Modal`, `Tooltip`,
`Dropdown`, `Command/action menu` (navigation/overlay); `Alert`, `Toast`, `Progress` (feedback);
`Timeline`, `Version indicator`, `Approval block`, `Diff viewer`, `File attachment`, `Relationship
picker`, `Stepper` (domain-specific), plus the `<Code>` inline convention. Each ships with its own
unit test (RTL, matching `states.test.tsx`/`page-shell.test.tsx`'s existing pattern) and consumes
only the token set from §1 — no component introduces a new color, spacing value, or literal
outside `packages/ui/src/tokens.ts`.

**Build order** (dependency-driven, not arbitrary): tokens (§1) → core controls → structural →
navigation/overlay → feedback → domain-specific — later categories in this list depend on earlier
ones (e.g. `Approval block` composes `Button`, `Badge`, `Avatar`, `Textarea`).

### 3. Navigation and shell (`04-navigation-system.md`)

- Desktop sidebar collapse toggle (`sidebarWidthCollapsed`, currently unused — wire it up).
- The 5-cluster library sub-grouping inside the `libraries` nav group (display-layer only, a
  client-side lookup table keyed by module `key` — no `module_registry` schema change).
- Tablet-specific nav behavior (auto-collapsed sidebar at 768–1024px, currently identical to
  desktop).
- Header additions: real user-menu dropdown (replacing the current plain text + link), help icon
  (links to the Help Center module route), environment indicator (conditional on non-production
  `build.environment`, already exposed via `/health`), system-status indicator (conditional on
  degraded state — links to `/health` until the System Health module exists).
- **Header search** — build as **module-only** search (client-side, over the already-fetched `GET
/me/navigation` list), not cross-record search. `03-information-architecture.md` §6's
  cross-record global search needs a real backend search endpoint that doesn't exist for any
  business module yet (only Projects has real records, and it already has its own in-page search)
  — building a header search box that promises to find "records" it can't actually find would
  violate this project's own no-fabrication principle. Scope the `⌘K` command menu to module
  navigation only; re-scope to real cross-record search once enough business modules exist to make
  it meaningful.
- **Header notifications** — build the `Drawer` UI and the bell icon/badge component, but **do not
  wire it to `GET /notifications` as a personal inbox** without a separate, explicit authorization.
  Verified live: that endpoint is gated on `system_settings:notifications_view`, a **zero-seeded**
  action per this project's own Phase 1E record — no role currently holds it, so even a Super
  Admin session would get a real `403` today. It's also not scoped to "the current user's own
  notifications" (no self-service recipient filter in the controller) — it's an admin-facing list
  endpoint, not a personal-inbox one. Wiring a real per-user notification drawer needs a new
  self-service endpoint and an RBAC seed decision, both out of scope here per this project's
  standing "RBAC schema/seed changes are their own separate authorization" rule. Ship the drawer
  component with `NotConfiguredState` (matching this project's own honesty principle) until that
  follow-up work is separately authorized.

### 4. Re-skin the 6 pre-`packages/ui` auth pages (`16-existing-shell-gap-analysis.md` §2)

`app/auth/sign-in`, `/emergency`, `/emergency/totp`, `/error`, `/logout`, `/session-expired` —
replace hand-rolled inline styles (including the confirmed `#b00020` vs. `colorTokens.danger`
`#dc2626` drift) with the token system and new `Input`/`Button`/`Alert` components. No change to
any page's actual auth flow, fields, or logic — visual/markup only.

### 5. Accessibility test-coverage gap (`14-accessibility-requirements.md` §14)

Build a test-only session-establishment path so Playwright's `@axe-core/playwright` suite can
finally cover the authenticated shell (currently only 3 unauthenticated routes are checked). This
touches authentication-adjacent code even though it's test-only — **treat this specific piece with
the same security scrutiny as real auth code**, not as routine test scaffolding: it must be
genuinely inert outside test runs (e.g. gated on the same `VITEST`/CI-only environment check
pattern already used elsewhere in this codebase, never reachable from a production request path),
and should get its own explicit callout in code review when this work is actually reviewed, given
what a mistake here could expose.

### 6. Component documentation

A lightweight, in-repo reference (not a new tool/dependency like Storybook — no case has been made
for that cost yet) showing each component's variants, consistent with this project's existing
`docs/implementation/*.md` as-built pattern rather than introducing new tooling.

## Explicitly out of scope

- **Any of the 43 modules' business functionality** — this task builds the foundation the modules
  will be built on top of, not the modules themselves. Confirmed separately by the design prompt's
  own §34 ordering: Projects (already built) → Business Knowledge Center → Service Library →
  Persona Library → Proof & Claims Library → remaining dependency-based modules, each its own,
  later, separate authorization.
- **Real cross-record global search** (needs business-module data to search) and **real per-user
  notification delivery** (needs a new self-service endpoint + RBAC seed decision) — both flagged
  above as concrete, verified blockers, not assumptions.
- **Dark mode** — per `02-recommended-direction.md`'s own recommendation, still not V1. The token
  architecture stays structured to make this a future token-value swap, but no dark palette is
  built now.
- **Any RBAC, workflow-state, or module-registry schema change** — this is a frontend-presentation
  task; every permission check, status name, and navigation-group assignment referenced throughout
  the approved design package is already real, seeded data, used as-is.
- **A new component-library dependency** (Tailwind, a UI framework, etc.) — every new component
  builds on the existing token/React foundation per `06-dashboard-component-system.md`'s own
  governance note; introducing one would need design prompt §28's own separate approval process.
- **Production deployment and merge** — building, testing, and opening a PR only; merge is always
  its own separate, later authorization in this project.

## Design decisions

1. **`statusBadgeTokens` are additive, not a replacement for `statusTokens`.** The two serve
   different contexts (badge palette vs. system-health single-color states per
   `10-status-and-workflow-system.md` §13) — collapsing them into one token group would force an
   artificial choice between "calm, everywhere" and "the health-check-specific hard invariant that
   unknown must never render as healthy." Keeping both avoids that conflict.
2. **Notifications and global search ship as honest partial UI, not fake-complete features.** This
   follows directly from Principle 2.7 (`00-dashboard-design-principles.md`) — better to ship a
   `Drawer` that says "not yet available" than one that silently 403s or searches nothing while
   looking like it works.
3. **No Storybook or component-catalog tool.** ~30 components is real growth, but this project's
   standing minimalism discipline (`CLAUDE.md`'s own "don't add tooling without justified need")
   argues for a plain markdown reference first; revisit only if the component count or team size
   later makes that insufficient.
4. **The accessibility test-bypass is scoped as a security-adjacent change**, not routine test
   infrastructure, given it necessarily touches how a test process can obtain an authenticated
   session — see §5's own callout.

## Validation checklist (run before requesting review)

- [ ] `pnpm typecheck` / `pnpm lint` / `pnpm format` clean across `packages/ui` and
      `apps/dashboard-web`
- [ ] Every new component has a passing RTL unit test
- [ ] Existing Playwright suite still green; new authenticated-route axe-core coverage added and
      passing (§5)
- [ ] Manual contrast verification of every `statusBadgeTokens` pair recorded with real numbers,
      not asserted
- [ ] `next build` clean
- [ ] No `packages/database` or `dashboard-api` business-logic file touched except the two
      explicitly-scoped, narrow exceptions in §3 (if any — prefer zero backend changes if the
      notification/search scoping above is followed as written)
- [ ] Full monorepo test suite still green (a shared package was touched)

## Documentation deliverables

- `docs/implementation/dashboard-ui-foundation-alignment.md` — as-built record, same shape as
  every prior phase's implementation docs
- Validation report
- `outputs/webdesk-growth-dashboard/HANDOFF.md` update

## Git workflow

Dedicated branch off `main` at `f99f5bc88e652d01b4186dde3db38e0c7877bafc` (re-verify this is still
current `main` HEAD when work actually starts). No direct push to `main`. Independent code review
and (given §5's auth-adjacent test infrastructure) a security review before any gate/merge request
— same discipline as every prior phase, not skipped just because this is "just UI." No auto-merge,
no production deploy, no business-module work started automatically once this lands.
