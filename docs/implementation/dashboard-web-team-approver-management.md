# `dashboard-web` Team Management + Approver Assignment — As-Built Record

**Status:** Built and fully validated on branch `dashboard-web-team-approver-management`. Not yet
code-reviewed, security-reviewed, gated, or merged — each remains a separate, not-yet-requested
next step, matching this project's standing discipline for every prior slice.

**Authorization:** Not started automatically — built directly on the user's explicit choice
("Team + Approver UI first") among 4 scoping options presented for the remaining Projects module
gaps (`CLAUDE.md` "Active tasks" item 13). Both backends (team roster CRUD, approver
list/assign/revoke) already existed, already reviewed and gated under
`module-projects-foundation`/`module-projects-backend-closeout` — this slice is `dashboard-web`
UI only, reusing them exactly as built.

## Scope

1. **Team roster management** — add/remove members on the Project Detail page's new "Team"
   section, replacing the previous headcount-only display.
2. **Approver assignment** — a new "Approvers" section on the same page, visible only to viewers
   who can actually see the underlying data.

Both reuse the existing `UserPicker` component (built for the create/edit project form's owner
field, explicitly documented there as reusable for exactly this) and the existing mutation
pattern every other mutation in this app already uses: a direct `fetch()` call with
`credentials: "include"`.

## 1. The missing capability: resolving a team roster to real identities

`GET /projects/:projectId/team` has always returned `ProjectUserEntity[]` — `{id, projectId,
userId, addedAt, addedBy}` — but `ProjectTeamEntry` (the frontend type) only ever carried `id`,
because no batch-resolve endpoint existed and N sequential `GET /users/:userId` calls felt
premature before a real UI needed them. That UI now exists, so:

- **`packages/shared-types`**: `ProjectTeamEntry` widened to `{id, userId, addedAt}` — still
  omitting `addedBy` (operational metadata, matching `Project`'s own precedent).
- **`apps/dashboard-web/lib/users.ts`**: new `getUsersByIds(userIds)` — deduplicates ids, resolves
  each via the existing `getUser()` in parallel (`Promise.all`, not sequential), and returns a
  `Map<id, UserSummary>`. An id that fails to resolve (disabled/deleted account) is simply absent
  from the map rather than throwing — the roster stays fully rendered, with a per-entry fallback.
- **`apps/dashboard-web/lib/projects.ts`**: `getProjectDetail()` now resolves the team roster's
  identities as part of its existing concurrent sub-resource fetch, returning `team: readonly
ResolvedTeamMember[]` (`{id, addedAt, user: UserSummary | null}`) instead of the old `teamCount:
number`. Also fetches `GET /projects/:projectId/approvers` directly (already returns
  `UserSummary[]`, no extra resolution needed) into a new `approvers: readonly UserSummary[] |
null` field — `null` specifically means "the viewer lacks `users_roles:view`" (the permission that
  endpoint itself requires), via a new `fetchProjectApprovers()` helper that degrades to `null` on
  any non-OK response instead of throwing (a 403 here is a routine, expected outcome for most
  roles, not a real failure — same reasoning `fetchProjectSummaries()`'s own degrade-on-failure
  precedent already established elsewhere in this app).

A real cross-boundary bug surfaced and was fixed while wiring this up: `project-team-section.tsx`
needed `formatTimestamp()`, a real (value) import from `lib/projects.ts` — but that file also
imports `next/headers` (server-only), and Next.js's bundler traces the _whole module_ for any real
import, not just the used export, so the client build failed with "You're importing a module that
depends on 'next/headers'... in the Pages Router." Fixed by extracting `formatTimestamp()` into a
new zero-dependency file, `lib/format-timestamp.ts`, which `lib/projects.ts` re-exports (every
existing server-side call site unaffected) and which `project-team-section.tsx` now imports
directly. `project-status-actions.tsx`'s own precedent (type-only imports from `lib/projects.ts`)
never hit this because it only ever imported a `type`, which the bundler erases entirely — this is
the first client component in this app that needed a real function from that file.

## 2. `lib/roles.ts` — resolving the approver role's id

Revoking an approver reuses the general role-assignment endpoint,
`DELETE /authz/users/:userId/roles/:roleId?projectId=` — there's no approver-specific revoke
route. That endpoint needs the seeded `owner_growth_approver` role's real `id`, which the frontend
never had a reason to know until now. New `getApproverRoleId()`: fetches `GET /authz/roles`
(gated on `users_roles:view`, the same permission the approvers list itself requires) and finds
the role keyed `owner_growth_approver`. Degrades to `null` — not a thrown error — on any non-OK
response or network failure, exactly like `getApproverRoleId`'s sibling degrade-on-failure helpers
elsewhere in this app.

## 3. New components

- **`components/project-team-section.tsx`** (`"use client"`) — renders the resolved roster (name,
  email, "Added <date>", a Remove button per row) plus a `UserPicker` + Add button below. Posts
  `{userId}` to `POST /projects/:projectId/team` on add, and calls `DELETE
/projects/:projectId/team/:teamEntryId` on remove; both update local state optimistically and
  call `router.refresh()` on success.
- **`components/project-approvers-section.tsx`** (`"use client"`) — same shape, posting to
  `POST /projects/:projectId/approvers` and reusing the role-assignment `DELETE` for removal. The
  Remove button is disabled (not hidden — the list itself is still real, useful information) when
  `approverRoleId` couldn't be resolved.
- **`components/project-roster-section.module.css`** — shared CSS module for both components
  (row layout, remove/add button styling) rather than duplicating near-identical rules per
  component, matching this app's own established `error-message.module.css`-style sharing
  precedent.

Both components render unconditionally rather than checking the viewer's own capabilities
client-side first — this app's standing pattern (`ProjectForm`'s "Edit" link,
`ProjectStatusActions`) is that the backend's `PermissionGuard` is the only real enforcement
point; an unauthorized viewer simply sees a real 403 message on submit via the existing
`lib/api-errors.ts` allowlist, the same degrade every other mutation control in this app already
accepts.

## 4. Project Detail page wiring

`app/(shell)/projects/[projectId]/page.tsx`: removed the old headcount-only `Fact label="Team"`
row from Overview (now redundant — a full Team section exists below it); added a "Team" section
(always rendered) and an "Approvers" section (rendered only when `detail.approvers !== null`).
`getApproverRoleId()` is fetched in parallel with `getProjectDetail()` via `Promise.all`, then
passed down to `ProjectApproversSection`.

## Validation

- `packages/shared-types`: `tsc` build clean.
- `apps/dashboard-web`: 123/123 unit tests (18 new: 5 `ProjectTeamSection`, 5
  `ProjectApproversSection`, 4 `getApproverRoleId`, 4 `getUsersByIds`, plus 2 updated + 2 new
  `getProjectDetail` tests covering team-identity resolution and the approvers-null-on-403 case),
  typecheck clean, lint clean, `next build` clean, `pnpm exec prettier --check` clean.
- Playwright: 15/15 tests passing (unaffected — no new route, the Project Detail page's
  unauthenticated-redirect smoke test still covers it).

## Explicitly out of scope (deferred to a separate slice)

Sub-resource editing (roadmap items, objectives, environments, repositories remain read-only lists
on the detail page) and "current project" context propagation (the header switcher's cookie still
has no downstream reader) — both are the 2 remaining gaps from `CLAUDE.md` "Active tasks" item 13,
neither started here.
