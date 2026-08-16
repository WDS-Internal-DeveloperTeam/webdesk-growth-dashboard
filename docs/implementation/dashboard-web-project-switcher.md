# `dashboard-web` — Project Switcher (as-built)

**Status:** Records what was actually built for the header's Project Switcher, on branch
`dashboard-web-project-switcher`, off `main` at `03787e4` (the commit closing out the Projects
module's build-to-production arc — `CLAUDE.md`'s 2026-08-15 "Recent decisions" entries).

## 1. Why this exists

`module-projects-foundation` (merged 2026-08-15, PR #24) made `GET /projects` real for the first
time but explicitly scoped the header switcher itself out — design decision **D7** in
`docs/task-packages/module-projects-foundation.md`: "Project Switcher wiring: explicitly out of
scope, flagged as the next real gap... Recommend a small, focused follow-up authorization once
this package is approved." Phase 1F's own shell doc
(`docs/implementation/phase-1f-application-shell.md` §2) independently scoped "project switcher UI
beyond a minimal context read" out for the same reason. The only design reference anywhere in the
canonical documentation set is a single wireframe cell (`07_Low_Fidelity_Wireframes.md` §1):
`| Logo | Project Switcher | Search | Notifications | User |` — a label, not a spec.

Given the explicit "build the dashboard-web Project Switcher UI" instruction and no other sourced
design, this slice builds the smallest honest thing that label can mean: a header control that
lists the real projects a caller can see and lets them pick one as their "current project"
pointer. It deliberately does **not** invent a downstream "current project" context that other
modules read — no such context exists yet, and wiring one remains real, separate, still-undesigned
scope (unchanged from D7's own framing).

## 2. What exists

- **`packages/shared-types/src/index.ts`** — `ProjectSummary` (`id`, `publicId`, `name`, `status`):
  this file's header comment reserved business-module types "until their owning module is
  actually authorized and implemented" — now true for Projects. Deliberately a narrow projection
  of `ProjectEntity`, not the full backend entity (description, confidentiality, retention
  category, etc. stay server-side/module-page concerns).
- **`apps/dashboard-web/lib/server-session.ts`** — `getServerSession()` now also calls
  `GET /projects` in parallel with the existing `/me`/`/me/navigation` calls, returning
  `ServerSession.projects`. Every seeded role holds `project_configuration:view`
  (`06_Roles_and_Permissions.md §3`), so this should never 401 for an authenticated caller in
  practice — but unlike `/me`/`/me/navigation` (whose failure still throws, per the shell's own
  "an API outage must surface as an error" philosophy), a non-OK `/projects` response degrades to
  an empty list rather than crashing the whole shell: the switcher is header chrome, not an
  authentication gate.
- **`apps/dashboard-web/lib/current-project.ts`** — `CURRENT_PROJECT_COOKIE`, the one shared
  constant between the server (reading the initial value) and the client (writing a new one).
- **`apps/dashboard-web/components/project-switcher.tsx`** — a native `<select>` (full
  keyboard/screen-reader support for free; no approved visual design exists yet to justify a
  bespoke listbox, matching Phase 1F's own "neutral foundations where visual detail isn't yet
  approved" precedent). Renders "All projects" plus each visible project (paused/archived projects
  show a status suffix, never hidden — no source document says paused/archived projects should
  disappear from the switcher). Zero projects renders a disabled "No projects yet" control rather
  than an empty/broken-looking dropdown. Selecting an option updates local state and writes
  `CURRENT_PROJECT_COOKIE` (`path=/`, `SameSite=Lax`, 1-year expiry) — a plain client-side cookie
  write, not a server action, since nothing server-side reads it yet beyond the next page load's
  initial-value read.
- **`apps/dashboard-web/components/app-shell.tsx`** — renders `<ProjectSwitcher>` in the header
  between the brand link and the header actions, matching the wireframe's left-to-right order
  (`Logo | Project Switcher | ...`). New required props `projects`/`initialProjectId`.
- **`apps/dashboard-web/app/(shell)/layout.tsx`** — reads `CURRENT_PROJECT_COOKIE` server-side
  (via `cookies()`, the same primitive `getServerSession()` already uses) and passes it down as
  `initialProjectId`, so the switcher's initial selection renders correctly on first paint instead
  of flashing from "All projects" to the real selection after hydration. A cookie naming a project
  the caller can no longer see (deleted, or visibility changed) is not trusted blindly — the
  switcher itself falls back to "All projects" when `initialProjectId` doesn't match any project
  in the list it actually received.

## 2a. Test infrastructure fix required

`apps/dashboard-web/vitest.config.mts` had no `resolve.alias` for `@/*`, unlike `tsconfig.json`'s
matching `paths` entry. This was never exercised before because every prior `@/lib/...` import in
a component was type-only (erased before Vite ever sees it, e.g. `app-shell.tsx`'s
`ServerSessionProfile` import) — `project-switcher.tsx`'s `CURRENT_PROJECT_COOKIE` import is the
first real (value) cross-`@/` import a component has needed. Fixed by adding the matching alias to
`vitest.config.mts`.

## 2b. Code review — 4 CONFIRMED findings fixed

This project's own `code-review` skill ran (medium effort) against the branch and surfaced 6
findings — 4 CONFIRMED, 2 PLAUSIBLE. All 4 CONFIRMED findings were fixed:

- **`getServerSession()`'s `Promise.all` let a `/projects` network-level failure (not just a bad
  HTTP status) crash the whole session resolution.** `fetch()` rejects on genuine network errors
  rather than resolving with a bad status, so the `projectsResponse.ok` guard never ran for that
  class of failure — a transient `/projects`-only outage would take down `/me`/`/me/navigation`
  too, exactly the "broken shell" the switcher's own design comment said it wouldn't cause. Fixed
  by extracting a `fetchProjectSummaries()` helper that never rejects — it catches its own fetch
  and always resolves to either the real list or `[]`.
- **A genuine `/projects` backend failure degraded to an empty list with zero logging**, making a
  real outage indistinguishable from a caller who legitimately has no projects — the same blind
  spot class that caused the 2026-08-12 production incident this repo's `CLAUDE.md` documents
  (`tryGetApiBaseUrl()`, two functions above, exists specifically because that lesson was learned
  once already). Fixed: `fetchProjectSummaries()` now `console.error`s both failure paths (network
  exception and non-OK status).
- **`GET /projects` was called with no query params**, silently capped at the backend's
  `DEFAULT_LIST_LIMIT` of 50 — an org with more projects would have some missing from the switcher
  with no indication, and a caller's own previously-selected project falling outside that page
  would be wrongly treated as stale/deleted by the switcher's own fallback logic. Fixed by adding
  `?limit=200` (the backend's actual `MAX_LIST_LIMIT`) to the fetch — raises the threshold 4x,
  doesn't remove it; a real browse/search UI is the actual fix if project counts ever approach 200,
  and is out of scope here (same D7-adjacent undesigned-scope boundary as the rest of this slice).
- **The Home page's "Project context" section still said "the Projects module hasn't been built
  yet"** directly under the new, working header switcher on the same screen — a visible,
  user-facing contradiction. Fixed: reworded to state what's actually true (a switcher exists; no
  module yet reads the selection to scope its own data).

The 2 PLAUSIBLE findings (the switcher's `selectedId` not re-syncing if `initialProjectId`/
`projects` change after mount — currently unobservable, since only one page exists under `(shell)/`
today; and `getServerSession()` now carrying a business-domain fetch alongside its session-auth
concern, a naming/layering nit with a real documented rationale) were left as tracked, non-blocking
observations, not fixed in this pass.

## 3. What was deliberately not built

- Any downstream consumption of the selected project — no module reads `CURRENT_PROJECT_COOKIE`
  yet. Wiring a real request/session-scoped "current project" context other modules filter by
  remains separate, undesigned scope, unchanged from D7.
- Navigation on selection — no per-project pages exist yet (`GET /projects/:id`'s own UI, the 21
  real business-module endpoints), so there is nowhere for a click to usefully go. Adding a link
  that 404s would be worse than not linking.
- A bespoke visual design — no approved brand/visual pass exists for the shell yet (same
  `phase-1f-application-shell.md` precedent this reuses).
- A server-side cookie write (Server Action) — the selection has no server-side consumer yet, so a
  network round-trip to persist it would be premature.

## 4. Testing

- `apps/dashboard-web/tests/unit/app-shell.test.tsx` — 5 new tests (12 total, up from 7): the
  empty-state disabled control, project + status-suffix rendering with "All projects" default,
  honoring a valid `initialProjectId`, falling back on a stale/invalid one, and updating on
  selection.
- Full validation re-run on this branch: typecheck, lint, `next build`, and the existing
  unauthenticated Playwright smoke suite (`tests/e2e/smoke.spec.ts`, 6/6) all pass. The
  authenticated shell itself still has no Playwright coverage (`phase-1f-application-shell.md`'s
  own already-documented gap — no test-only session mechanism exists) — the switcher's rendering
  logic is proven by the unit suite instead, same as the rest of `AppShell`.
