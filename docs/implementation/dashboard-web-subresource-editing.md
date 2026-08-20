# `dashboard-web` — Roadmap / Objectives / Environments / Repositories Editing (as-built)

**Status:** Records what was actually built for the Project Detail page's sub-resource editing, on
branch `dashboard-web-subresource-editing`, off `main` at `dc06bc6` (the commit closing out the
sidebar/module-grid spacing fix, PR #41).

## 1. Why this exists, and what it isn't

Built directly on the explicit "Let's scope and start sub-resource editing" instruction, closing
gap (4) from `CLAUDE.md` "Active tasks" item 13's remaining-Projects-module-gaps analysis: Roadmap
items, Objectives, Environments, and Repositories were all read-only lists on the Project Detail
page — no create/edit/delete UI for any of them, even though every backend endpoint for all four
already existed, already reviewed and gated under `module-projects-foundation`/
`module-projects-backend-closeout`. This branch is `dashboard-web` UI only — no backend changes.

Two scoping decisions were made directly with the user (`AskUserQuestion`) before building:

1. **Roadmap item `status`**: omit it from the edit form entirely, and instead add a "Set as active
   phase" action. Reason: `RoadmapItemsService.update()` (the backend's generic update route)
   silently strips any `status` field sent through it — only `ProjectService.setActivePhase()` is
   allowed to change a roadmap item's status, to protect the one-active-phase-per-project invariant.
   A status field on the generic edit form would have silently no-opped, misleading whoever used it.
2. **Build scope**: all four resources together, in one PR — matching the precedent set by the Team
   - Approvers management slice (`CLAUDE.md` item 18), which shipped both gaps in a single review
     cycle rather than one PR per resource.

## 2. What exists

- **`apps/dashboard-web/components/project-subresource-section.module.css`** (new) — shared CSS
  Module for all four new sections: row layout, inline edit-form layout, the always-visible
  dashed-border add-form, and action-button styling. Field-level input styling (`label`/`input`/
  `textarea`/`select`) composes from `project-form.module.css` rather than being redeclared, the
  same precedent `project-roster-section.module.css` already set for `.addButton`/`.error`.

- **`apps/dashboard-web/components/project-objectives-section.tsx`** (new, `"use client"`) —
  `ProjectObjectivesSection`. Full create/edit/delete for Objectives
  (`POST`/`POST .../:id/update`/`DELETE /projects/:projectId/objectives`). `status` (`open`/
  `complete`) is a real, working field in the edit form here — unlike roadmap items, it forwards
  straight through on update with no server-side stripping.

- **`apps/dashboard-web/components/project-environments-section.tsx`** (new, `"use client"`) —
  `ProjectEnvironmentsSection`. Full create/edit/delete for Environments (`name`/`url`/`notes`).
  Reuses the existing `isSafeHttpUrl()` guard before ever rendering a stored `url` as a clickable
  link — the same defense the read-only detail page already applied, now also applied to values a
  user enters through this form (the backend's `safeHttpUrlSchema` already restricts the scheme
  server-side; this is client-side defense-in-depth for anything stored before that schema
  existed).

- **`apps/dashboard-web/components/project-repositories-section.tsx`** (new, `"use client"`) —
  `ProjectRepositoriesSection`. Full create/edit/delete for Repositories (`repoOwner`/`repoName`/
  `defaultBranch`/`notes`). Client-side validates `repoOwner`/`repoName` against the backend's own
  `^[\w.-]+$` segment pattern before enabling Add/Save, with the same helper text the backend's
  validation error would otherwise explain after a round trip.

- **`apps/dashboard-web/components/project-roadmap-section.tsx`** (new, `"use client"`) —
  `ProjectRoadmapSection`. Create/edit (name/sequence only — see decision 1 above) /delete for
  Roadmap items, plus a real "Set as active phase" action per non-active row and a "Clear active
  phase" toolbar action once one is set, both calling `POST /projects/:projectId/active-phase`
  (previously unreachable from any `dashboard-web` UI). The Delete button is disabled for whichever
  item is currently the active phase — the backend already rejects that deletion, so this closes
  the loop with an explanatory `title` attribute instead of a round-trip error. Local `activePhaseId`
  state is seeded from and resynced against a new `initialActivePhaseId` prop (`project.activePhaseId`),
  independent of the roadmap items array itself.

- **`apps/dashboard-web/lib/status-badges.ts`** (new) — `projectStatusBadge`/
  `roadmapItemStatusBadge`/`objectiveStatusBadge`, moved out of `lib/projects.ts` into a file with
  zero non-type imports. See §3 below for why.

- **`apps/dashboard-web/lib/safe-http-url.ts`** (new) — `isSafeHttpUrl`, moved out of
  `lib/projects.ts` for the same reason.

- **`apps/dashboard-web/lib/projects.ts`** (edited) — the three badge functions and `isSafeHttpUrl`
  are now imported from the two new files and re-exported, so every existing server-side call site
  (`app/(shell)/home/page.tsx`, `app/(shell)/projects/page.tsx`, the Project Detail page itself) is
  unaffected. The now-unused `StatusToken` import was removed.

- **`apps/dashboard-web/app/(shell)/projects/[projectId]/page.tsx`** (edited) — the four bespoke
  read-only inline-JSX sections (hardcoded `style={...}` objects, no CSS Module) are replaced with
  the four new client components, passed `project.id` and the already-fetched sub-resource arrays
  from `getProjectDetail()` — no changes needed to that function itself, its existing fetch already
  returns everything the new components need. The now-dead `mutedInlineStyle`/`listStyle`/
  `listItemStyle`/`sequenceStyle`/`itemLabelStyle` style constants (only used by the removed
  sections) were deleted.

## 3. A real build-breaking bug found and fixed: the `next/headers` client-bundle trap, again

`lib/projects.ts` imports `cookies` from `next/headers` (needed by its server-only fetch helpers) —
a Server-Component-only API. `next build` failed the moment `ProjectRoadmapSection` and
`ProjectObjectivesSection` (both `"use client"`) tried to import `roadmapItemStatusBadge`/
`objectiveStatusBadge` directly from `@/lib/projects`: a **value** import of anything from that
module drags in the whole module, `next/headers` included, and Next.js refuses to bundle it for the
client.

This is the identical bug class `CLAUDE.md` item 18 already hit and fixed once (`formatTimestamp`
extracted into `lib/format-timestamp.ts`) — caught here by the real `next build` step, not by
typecheck, lint, or the unit test suite (Vitest's jsdom environment doesn't enforce the Server/
Client bundle boundary, so all three passed cleanly even with the bug in place). Fixed the same
way: `projectStatusBadge`/`roadmapItemStatusBadge`/`objectiveStatusBadge` moved to
`lib/status-badges.ts`, `isSafeHttpUrl` moved to `lib/safe-http-url.ts` — both files with zero
non-type imports, so a `"use client"` component can import the real functions directly.
`status-badges.ts` type-imports `ProjectStatusFilter` from `lib/projects.ts` (a compile-time-only
import that TypeScript/webpack elide, so it does not reintroduce the problem — the same pattern
`project-status-actions.tsx` already uses safely). `lib/projects.ts` re-exports both, so no existing
server-side call site changed.

## 4. Known, tracked, out-of-scope gaps (flagged, not fixed here)

- **No unique-constraint handling for duplicate repositories.**
  `apps/dashboard-api/src/projects/project-repositories.service.ts` has no handling for a duplicate
  `(project_id, repo_owner, repo_name)` submission — confirmed via direct code read and a repo-wide
  grep for `UniqueConstraintError`/`SequelizeUniqueConstraintError` (zero matches anywhere in
  `apps/dashboard-api/src`). A raw Sequelize error propagates uncaught, which
  `parseApiErrorMessage()`'s allowlist then reduces to the generic "Something went wrong" message
  instead of a clear "this repository is already linked" error. Fixing this means editing the
  already-reviewed, already-merged Projects module backend — out of scope for a branch declared
  frontend-only, matching this project's own established precedent (e.g. the environment-URL XSS
  fix, where the client-side guard shipped immediately and the backend schema tightening was a
  separate, later PR).
- **No way to reach `complete`/`skipped` roadmap-item status from any code path.** Confirmed via
  direct code read: `RoadmapItemsService.update()` strips `status`, and `setActivePhase()` only ever
  writes `"active"` (to the newly-active item) or leaves an item's status untouched when clearing
  the active phase. The `complete`/`skipped` enum values exist in the schema and in
  `roadmapItemStatusBadge()`'s own mapping, but no endpoint anywhere can set them. This predates this
  branch and is unrelated to the `status`-omission decision above (that decision is about this
  form specifically, not about the backend's own reachability gap) — recorded here since building
  this UI is what surfaced it directly.

## 5. Validation

- **162/162 → 186/186 `dashboard-web` unit tests** (24 new, across
  `project-objectives-section.test.tsx`, `project-environments-section.test.tsx`,
  `project-repositories-section.test.tsx`, `project-roadmap-section.test.tsx`) — empty states, the
  add/edit/delete request shape and body for each resource, error-message display, and — for
  roadmap specifically — that the edit form never renders a `status` field, that "Set active"/
  "Clear active phase" post the correct `{roadmapItemId}` body and update local state, and that
  Delete is disabled for the active item.
- Full package rebuild (`@webdesk/shared-types`), then `tsc --noEmit`, `eslint` +
  `check-css-tokens.mjs` (10 CSS Module files checked, up from 9), and `next build` (Turbopack) all
  clean — the last of these is what actually caught the `next/headers` bug in §3.
- `pnpm exec prettier --check` clean across every new/changed file.
- Live-rendered the dev server in the Browser pane: an unauthenticated visit to
  `/projects/11111111-1111-1111-1111-111111111111` redirects cleanly with zero browser console
  errors and zero server-side errors (`preview_logs`, error-level) — confirming the new
  component/page wiring boots correctly at runtime, not just at build time. Exercising the actual
  create/edit/delete/set-active-phase flows against a live backend was not done in this pass — no
  local `DATABASE_URL` is configured for `dashboard-api` in this environment, and standing up a
  disposable local Postgres, running all 46 migrations, and seeding a real project with sub-resource
  rows was judged disproportionate to this verification step given the 24 new unit tests already
  exercise every request/response shape and local-state update path for all four resources against
  mocked `fetch`. Flagged explicitly, not silently skipped.

Not yet reviewed, gated, or merged — code review, security review, second-role human review, a gate
decision, and merge authorization are each their own separate, not-yet-requested next step,
unchanged from this project's standing discipline.
