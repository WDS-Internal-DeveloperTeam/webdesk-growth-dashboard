# `dashboard-web` — Project Status Change / Archive Actions (as-built)

**Status:** Records what was actually built for the Project Detail page's status-transition
actions, on branch `dashboard-web-project-status-actions`, off `main` at `b889982` (the commit
closing out the Create/Edit Project form's own build-to-production arc).

## 1. Why this exists, and what it isn't

Built directly on the explicit "build the status change and archive UI" instruction — the last
named gap from the Projects module's own status review. `POST /projects/:projectId/status` has
existed on the backend since the Projects module's original build (`module-projects-foundation.md`,
merged via PR #24) but no `dashboard-web` UI has ever called it; this closes that specific gap.

D2's own state machine (`apps/dashboard-api/src/projects/project.service.ts`'s
`ALLOWED_TRANSITIONS`) is the single source of truth this UI mirrors:

```
active  -> [paused, archived]
paused  -> [active, archived]
archived -> []           // terminal — no way back through this endpoint
```

## 2. What exists

- **`apps/dashboard-web/components/project-status-actions.tsx`** (new, `"use client"`) —
  `ProjectStatusActions`, a small client island rendered inside the Project Detail page's header.
  Renders only the transitions actually valid from the project's current status (mirroring
  `ALLOWED_TRANSITIONS` by hand, the same approach every other client-side mirror of a backend
  contract in this app already uses) — so an invalid-transition response from the backend is
  unreachable through this UI in normal use; the endpoint's own validation remains the
  authoritative check regardless. Renders nothing at all once a project is `archived` (no button to
  press — the transition doesn't exist). Only the `archive` transition prompts a
  `window.confirm()` — it's the one transition the state machine can never reverse; pause/resume
  freely toggle and need no confirmation. Submits via a direct browser `fetch()` with
  `credentials: "include"`, the same pattern every mutation in this app already uses
  (`components/project-form.tsx`) — required for `dashboard-api`'s `OriginCheckGuard`. Reuses
  `lib/api-errors.ts`'s `parseApiErrorMessage()` for error display (no new error-handling code).
  On success, calls `router.refresh()` rather than navigating away — the user is already looking at
  the one page a status change is relevant to, unlike the create/edit form's `router.push()` to a
  different page after creating a new resource.
- **`apps/dashboard-web/components/project-status-actions.module.css`** (new) — token-derived
  styling: a neutral bordered style for Pause/Resume, a warning-toned style for Archive (not
  `danger` — archiving doesn't delete or destroy data, just moves the project to a terminal,
  read-mostly state, which is `warning` territory rather than `danger`).
- **`apps/dashboard-web/app/(shell)/projects/[projectId]/page.tsx`** — the header's
  `contextActions` slot now renders `<ProjectStatusActions>` alongside the existing "Edit" link
  (both wrapped in a fragment; `PageHeader`'s own `contextActions` container already lays out
  multiple children in a flex row, so no new layout code was needed). This is the second client
  component ever mounted on this page's own render tree, alongside none previously — the page
  itself stays a Server Component; only this one interactive island is client-rendered, matching
  the same "server-rendered by default, client islands only where genuinely needed" precedent the
  header Project Switcher already established for the shell.

## 3. Validation

- **Unit tests** (`apps/dashboard-web/tests/unit/project-status-actions.test.tsx`, new — 8 tests):
  correct button set per status (`active`/`paused`/`archived`), the Pause/Resume path posting the
  right body with no confirmation prompt, the Archive path prompting for confirmation and only
  proceeding when confirmed, and both error-surfacing paths (backend error message, network
  failure). Full suite: 65/65 `dashboard-web` unit tests passing (8 new).
- **E2E**: all 13 existing Playwright tests still pass unchanged — this slice adds no new route,
  only a new element on an already-covered page.
- Typecheck, lint, and `next build` all clean.
- A live dev-server check confirmed the detail page's own unauthenticated-redirect path (the only
  path exercisable without a real session in this environment) still renders with zero
  console/server errors.

## 4. Not yet reviewed or merged

Pushed as its own branch (`dashboard-web-project-status-actions`). Code review, security review,
second-role human review, a gate decision, and merge authorization are each their own separate,
not-yet-requested next step, unchanged from this project's standing discipline for every prior
slice.
