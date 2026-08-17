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

## 3. Code review — 8 findings, 7 fixed

This project's own `code-review` skill ran (8-angle, medium effort) against the branch and
surfaced 9 candidates, of which 8 survived 1-vote verification (1 REFUTED — a claimed duplicate of
`lib/action-link-style.ts`'s `primaryActionLinkStyle`, which turned out technically unable to
support the `:disabled`/`:focus-visible` states real `<button>` elements need, so it wasn't real
duplication). 7 of the 8 survivors were fixed; 1 recorded as accepted, tracked debt:

- **Buttons re-enabled before the page had actually refreshed (CONFIRMED, fixed).**
  `router.refresh()` returns `void` and isn't awaited, so the old `finally` block's
  `setPending(null)` ran immediately after firing it — re-enabling every button while the
  component still rendered the pre-transition status, a real window for a rushed or
  double-clicking user to fire a since-invalid transition. Fixed by having the component own a
  local `status` state (seeded from the `status` prop) and calling `setStatus(nextStatus)` in the
  same synchronous continuation as `setPending(null)` — React batches both into a single
  re-render, so the button set the user sees is never stale relative to whether it's enabled.
  `router.refresh()` still runs afterward to reconcile everything else the page renders
  server-side (the header's status badge, in particular).
- **Unguarded `ALLOWED_TRANSITIONS[status]` lookup could crash on an unknown status (PLAUSIBLE,
  fixed).** Not reachable today (status is a real Postgres ENUM and the only write path is
  Zod-validated to the same 3 values), but the same latent-risk shape this codebase has already
  accepted as tracked debt for `roadmapItemStatusBadge`/`objectiveStatusBadge`. Fixed with a
  `?? []` fallback — an unrecognized status now renders no actions instead of throwing.
- **Network-failure `catch` block logged nothing (CONFIRMED, fixed).** Reintroduced the exact
  silent-failure blind spot this codebase explicitly fixed once already (the Project Switcher's
  2026-08-16 review, citing the 2026-08-12 production incident that went undiagnosed for the same
  reason) — inherited from `project-form.tsx`'s own unfixed copy of the same gap, not a fresh
  regression, but real. Fixed with a `console.error` call before the generic user-facing message.
- **This page's own doc comment contradicted itself (CONFIRMED, fixed).** One sentence still
  claimed "no client component, no JS required" while a later sentence correctly described the new
  client island. Reworded to state accurately that the page's sections stay free of client state
  while the header now carries one client island.
- **`docs/implementation/dashboard-web-project-detail.md` left stale after this PR (CONFIRMED,
  fixed).** That page's own as-built doc (written before this PR existed) still claimed zero
  client JS and no status actions. Not rewritten — an addendum section was appended instead,
  preserving that document's own historical accuracy about what it built and why.
- **New `.error` CSS class duplicated `project-form.module.css`'s almost verbatim (CONFIRMED,
  fixed).** Extracted the shared properties into `components/error-message.module.css`; both
  `project-form.module.css` and `project-status-actions.module.css` now `composes` from it and
  keep only their own differing `padding`/`width`.
- **Local `type ProjectStatus = Project["status"]` duplicated the existing `ProjectStatusFilter`
  export from `lib/projects.ts` (PLAUSIBLE, fixed).** Weak finding — deriving directly from
  `Project["status"]` was arguably the more correct source of truth — but reusing the sibling
  export removes one of the two names for the same concept, so it was applied anyway.
- **`router.refresh()` re-fetches far more than the changed field (CONFIRMED, accepted as tracked
  debt, not fixed).** A status transition only changes one row's `status` column, but
  `router.refresh()` re-runs Server Components for the whole route — the page's own
  `getProjectDetail()` (6 requests) plus the `(shell)` layout's `getServerSession()` (3 more,
  since its `cache()` only dedupes within one render pass and can't survive a fresh refresh) — and
  the mutation's own response body (which already has the updated project) goes unread. The
  race-condition fix above removes this component's own need for the refresh to complete
  correctly, but the header's status badge is still server-rendered from the page's `project`
  prop, so _some_ server reconciliation remains necessary. Eliminating the refresh entirely would
  mean lifting `status` into a shared client wrapper both the badge and the actions read from —
  the reviewer's own assessment ("a real architectural step up, not a one-line swap") — which is
  out of proportion for a review-fix pass and not something this slice's own scope calls for.
  Tracked as follow-up, not blocking.

## 4. Validation

- **Unit tests** (`apps/dashboard-web/tests/unit/project-status-actions.test.tsx` — 8 original + 3
  added during the code-review fix round): correct button set per status
  (`active`/`paused`/`archived`), the Pause/Resume path posting the right body with no
  confirmation prompt, the Archive path prompting for confirmation and only proceeding when
  confirmed, both error-surfacing paths (backend error message, network failure), a successful
  transition rendering the new status's button set immediately (regression test for the
  re-enable-before-refresh race), an out-of-union status rendering nothing instead of throwing
  (regression test for the unguarded lookup), and a network failure logging via `console.error`
  (regression test for the silent-catch finding).
- **E2E**: all 13 existing Playwright tests still pass unchanged — this slice adds no new route,
  only a new element on an already-covered page.
- Typecheck, lint, and `next build` all clean.
- A live dev-server check confirmed the detail page's own unauthenticated-redirect path (the only
  path exercisable without a real session in this environment) still renders with zero
  console/server errors.

## 5. Not yet reviewed or merged

Code review is complete and its fixes are pushed (§3 above). Security review, second-role human
review, a gate decision, and merge authorization are each their own separate, not-yet-requested
next step, unchanged from this project's standing discipline for every prior slice.
