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

## 6. Independent code review

Ran this project's own `code-review` skill (high effort, 8 finder angles, 1-vote verification)
against the full PR #42 diff. 13 candidates survived dedup; all 13 verified (12 CONFIRMED, 1
REFUTED and dropped — a claimed `sequenceStyle` `minWidth` regression, where the visual behavior
change is real but caused by the markup restructuring itself, not the dropped property, so
re-adding it would have changed nothing). 10 of the 12 CONFIRMED findings were kept for the final
report (ranked most-severe first, per the review's own cap); the 2 lowest-priority (a validation
regex/constants duplication finding and a defensive-guard-consistency finding) were left out under
the cap, not silently dropped from the review's own record.

**All 10 reported findings fixed**, per explicit "fix the confirmed findings" instruction:

1. **Roadmap active-phase badge staleness** — `handleSetActivePhase` previously updated only
   `activePhaseId`, never the affected items' own `status`, so the newly-active row briefly showed
   its old status badge next to the new "Active" label (and vice versa for the previously-active
   row) until `router.refresh()` resolved. Fixed by mirroring the backend's own transaction locally:
   the newly-active item's status is set to `"active"`, and the previously-active item's status
   (if it was `"active"`) is reset to `"not_started"`, in the same `setRoadmapItems` call.
2. **Repositories: clearing "Default branch" silently reset it to "main"** — the field had no
   `required` attribute and wasn't part of the Save button's validity check. Fixed by requiring the
   field and including it in `RepositoryEditForm`'s `isValid` check (matching Owner/Repository
   name's own treatment); `handleSaveEdit` no longer falls back to `"main"` on an edit (the
   create-time fallback in `handleAdd` is intentional and unchanged — an unset branch on a brand
   new repository legitimately defaulting to "main" was never the bug).
3. **NaN sequence silently serialized as `null`** — a non-empty but unparseable "Sequence" value
   produced `Number(...) === NaN`, which `JSON.stringify` turns into `null`, a value the backend's
   non-nullable optional schema rejects with an error the user couldn't trace back to the field.
   Fixed with a new `parseSequence()` helper that rejects a non-finite value with a clear
   client-side message before ever calling `fetch`.
4. **Active-phase response cast to the wrong shared type** — `handleSetActivePhase` cast the
   response as `ApiSuccessResponse<ProjectDetail>`, but the backend controller's declared return
   type is `ApiSuccessResponse<ProjectEntity>` (an unrelated, backend-only type); the two only
   coincidentally share an `activePhaseId` field. Fixed with a new, honest, narrow local
   `ActivePhaseResponseData` interface declaring only the one field this code actually reads.
5. **Open edit forms never resynced on a concurrent external update** — each `*EditForm`
   sub-component seeded its local state once at mount and never resynced if the underlying record
   changed while the row stayed open for editing, risking a silent lost-update on save. Fixed by
   adding a `useEffect` to all four `*EditForm` components, keyed on `(id, updatedAt)` — narrow
   enough that it doesn't fire (and wipe an in-progress unsaved edit) on every incidental
   background refresh that leaves this specific record unchanged, but does resync when the record
   is genuinely updated elsewhere.
6. **Item-label `min-width` floor dropped** — `.rowMain`'s `min-width: 0` let long names/
   descriptions be squeezed arbitrarily narrow on a narrow viewport instead of the whole row
   wrapping. Restored the old page's 10rem floor.
7. **Secondary text font-size shrank, undocumented** — `.secondaryText` used the `xs` token
   (0.75rem) instead of the old page's `sm` (0.875rem). Restored the `sm` token.
8. **`router.refresh()` over-fetching** — every mutation in all four new sections called
   `router.refresh()`, raising the number of client islands triggering the page's full
   ~7-9-request `getProjectDetail()` refetch from 3 to 7, including for changes nothing else on the
   page reads. Fixed by removing `router.refresh()` entirely from Objectives/Environments/
   Repositories (no other section ever reads their data) and from Roadmap's `handleAdd`/
   `handleDelete` (a new item is never active; the active item can never reach Delete); Roadmap's
   `handleSaveEdit` now refreshes only when the edited item is the current active phase (the one
   case Overview's "Active phase" Fact actually depends on); `handleSetActivePhase` keeps its
   refresh unconditionally, since it always changes what Overview shows.
9. **CRUD-handler architecture duplicated across (now) six components** — the `markPending`/
   pending-`Set` helper was reimplemented nearly verbatim in all four new components (on top of the
   same shape already existing twice in `project-team-section.tsx`/`project-approvers-section.tsx`).
   Extracted the pending-id-tracking piece into a new shared `apps/dashboard-web/lib/use-pending-ids.ts`
   hook (`usePendingIds()`), adopted by all four new components — deliberately scoped to just this
   piece, not the four components' full fetch/error-handling boilerplate, and deliberately not
   applied to the two pre-existing, already-reviewed/merged/live Team/Approvers sections (out of
   scope for a fix pass on this branch).
10. **`next/headers` client-bundle fix was reactive, with no guard against a third recurrence** —
    `lib/projects.ts` still had two more pure, `next/headers`-free exports
    (`parseProjectsSearchParams`/`buildProjectsHref`) that a future client component could need,
    which would trigger the identical `next build` failure again. Proactively extracted both (plus
    their supporting types/constants) into a new `apps/dashboard-web/lib/projects-query.ts`, the
    same zero-non-type-import pattern as `lib/format-timestamp.ts`/`lib/status-badges.ts`/
    `lib/safe-http-url.ts`; `lib/projects.ts` re-exports everything so no existing call site
    changed. `lib/status-badges.ts`'s `ProjectStatusFilter` type import was also repointed from
    `./projects` to `./projects-query` directly, removing even the type-level indirection.

24 new/updated regression tests added across the four test files (189/189 `dashboard-web` unit
tests passing overall, up from 186) — covering the active-phase status-sync fix (asserting the
StatusBadge, not just the indicator span, now reads "Active" too), the repositories empty-
default-branch guard, the edit-form resync-on-`updatedAt`-change behavior (and confirming it does
NOT fire on an unrelated re-render, preserving in-progress typing), and the conditional-refresh
logic for editing an active vs. non-active roadmap item. One planned regression test (the NaN-
sequence guard, reached via a real `<input type="number">`) was found to be unreproducible in
jsdom — verified directly that jsdom's own number-input value sanitization already clamps any
non-finite value to `""` at the DOM level (both a bare `"-"` and `"1e1000"` reduce to `""` the
moment `.value` is assigned), unlike the transient-typing behavior real browsers exhibit; the code
fix remains as defense-in-depth, confirmed correct at the code level during the review's own
verification pass, just not exercisable via `fireEvent.change` in this test environment — recorded
here rather than silently dropped.

Full re-validation: typecheck/lint/`check-css-tokens.mjs` (10 CSS Module files, unchanged since no
new file was added)/`next build`/`pnpm exec prettier --check` all clean. Live-rendered in the
Browser pane again after the fixes — unauthenticated redirect from `/projects/:id` still clean,
zero server-side errors.

Not yet security-reviewed, second-role human reviewed, gated, or merged — those remain each their
own separate, not-yet-requested next step, unchanged from this project's standing discipline.
