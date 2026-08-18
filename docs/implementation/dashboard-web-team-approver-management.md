# `dashboard-web` Team Management + Approver Assignment — As-Built Record

**Status:** Built, fully validated, independently code-reviewed (10 findings, 9 fixed, 1 accepted
as out-of-scope debt), and security-reviewed (0 findings above threshold) on branch
`dashboard-web-team-approver-management`. A review packet has been published for the required
second-role human review. Not yet gated or merged — each remains a separate, not-yet-requested
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

## 5. Independent code review

Ran this project's own `code-review` skill (8-angle finder pass, high effort) against the full
branch diff. All 10 candidates that survived deduplication were CONFIRMED on verification. 9 of 10
fixed, per explicit "fix the confirmed findings" instruction:

1. **Crash on 403** — `getProjectDetail()` had no try/catch around team-identity resolution, and
   `getUser()` throws on any non-404 error, so a single 403 from `GET /users/:userId` crashed the
   whole page. Fixed: `getUsersByIds()` now uses `Promise.allSettled` with per-id error logging.
2. **Approver revoke ignored `revoked: false`** — `handleRemove` only checked `response.ok`, not
   the response body, so it reported success even when the backend found no matching row to
   revoke. Fixed: now checks `body.data.revoked` and shows an error otherwise.
3. **Team's `UserPicker` 403s on first keystroke for most roles** — rendered unconditionally
   despite needing `users_roles:view`. Fixed: new `canSearchUsers` prop, derived from the same
   signal the Approvers section already resolves.
4. **Shared `pendingRemoveId` raced across rows** — a single shared id, not per-row. Fixed: both
   roster components now track pending removals in a per-row `Set<string>`.
5. **Silent 403/5xx swallowing in `lib/roles.ts`** — no logging on the `!response.ok` branch.
   Fixed: both helpers now log the status.
6. **Roster state never resynced after `router.refresh()`** — `useState` initializers don't re-run
   on prop updates without a remount. Fixed: both components gained a resync `useEffect`.
7. **N+1 instead of the backend's batch endpoint** (`lib/users.ts`) — real, but fixing it needs a
   new `dashboard-api` route; this branch is declared UI-only. **Accepted as out-of-scope,
   tracked debt** — not fixed.
8. **Duplicated primary-button CSS** — `.addButton` retyped `.submitButton` byte-for-byte. Fixed:
   now `composes: submitButton from "./project-form.module.css"`.
9. **Unconditional approver-role-id fetch** — fired even when `ProjectApproversSection` (its only
   consumer) wouldn't render. Fixed: now only called after confirming `approvers !== null`.
10. **Team-identity resolution serialized behind unrelated fetches** — waited on the full 6-way
    `Promise.all` instead of chaining off just the team fetch. Fixed: new `resolveTeam()` helper
    chains directly off `teamPromise`, folded into the same concurrent pass.

Re-validated after fixes: 128/128 `dashboard-web` unit tests (7 new), 15/15 Playwright tests,
typecheck/lint/`next build`/prettier all clean.

## 6. Security review

Ran this project's own `security-review` skill separately from the code review. **0 findings above
threshold.** Checked and confirmed clean: no `dangerouslySetInnerHTML`/raw DOM manipulation (all
rendered fields are React-escaped JSX interpolation of backend-sourced data); no path-traversal-
relevant input reaches the fetch-URL interpolations (`projectId`/`userId`/`approverRoleId` are all
backend-sourced UUIDs); both new components rely entirely on the backend's
`PermissionGuard`/`OriginCheckGuard` for real enforcement, with the new `canSearchUsers` prop only
toggling UI visibility (a stale/tampered value can only over-restrict, never grant privilege); the
approver-revoke path always targets a fixed, server-resolved role id; new `console.error` calls log
only status codes/generic errors, no PII or secrets.

A review packet (code review + security review findings, fixes, and validation evidence, with a
decision section) was published as a Claude artifact for the required second-role human review,
since the implementing agent cannot also be its own reviewer (ADR-0010). See
`docs/project-state/dashboard-web-team-approver-management-approval-checklist.md`.

## Explicitly out of scope (deferred to a separate slice)

Sub-resource editing (roadmap items, objectives, environments, repositories remain read-only lists
on the detail page) and "current project" context propagation (the header switcher's cookie still
has no downstream reader) — both are the 2 remaining gaps from `CLAUDE.md` "Active tasks" item 13,
neither started here.
