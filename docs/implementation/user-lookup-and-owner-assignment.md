# User Lookup Capability + Project Owner Assignment (as-built)

**Status:** Records what was actually built for the minimal, read-only user-lookup capability and
its first real consumer (owner assignment in the Projects create/edit form), on branch
`user-lookup-owner-assignment`, off `main` at `fdf7594` (the commit registering the Recommended
Module Roadmap).

## 1. Why this exists, and what it isn't

Built directly on the explicit "start with the blockers" instruction, following up on the
"Remaining Projects module gaps" entry recorded in `CLAUDE.md` on 2026-08-17: owner assignment,
team management, and approver assignment all share the same real blocker — no user-lookup/picker
capability existed anywhere in this app. Before writing any code, the user was asked to confirm
scope directly (`AskUserQuestion`), since this sits right on the project's own standing caution —
_"Do NOT begin the 21 real business-module endpoints or user-management CRUD beyond role
assignment (Task 8) without a separate, explicit go-ahead."_ The user chose the **minimal
read-only lookup** option (not a fuller Users/Roles/Permissions admin surface — module #39 on the
recommended roadmap remains its own, separate, not-yet-authorized scope) and **owner assignment**
as the first feature to unblock.

This is deliberately **not**:

- Task 8's user-management CRUD — no endpoint here creates, edits, or deactivates a user. Every
  new backend method is read-only (`search`, `findById`).
- Module #39 (Users/Roles/Permissions) from the Recommended Module Roadmap — that remains its own,
  separate, not-yet-authorized admin surface; this is a narrow picker-support capability only.
- Team management or approver-assignment UI — both backends already existed before this branch
  (`POST/GET/DELETE /projects/:projectId/team`, `POST /projects/:projectId/approvers`, both built
  and reviewed as part of `module-projects-foundation`) and both remain unbuilt on the frontend;
  the new `UserPicker` component is built to be reusable for them, but wiring them in is a
  separate, not-yet-requested next step.

## 2. What exists

### Backend (`apps/dashboard-api`)

- **`packages/database/src/auth/user.repository.ts`** — a new `search()` method: `Op.or` `ILIKE`
  across `email`/`displayName`, always filtered to `accountStatus: "active"` (a picker should
  never offer a disabled/offboarded user), ordered by `displayName`, same 20-default/200-max
  limit-bound style as every other list method in this codebase. No new migration — no schema
  change, no new index (the dataset is small; a `pg_trgm` index was judged premature for this
  scope).
- **`apps/dashboard-api/src/users/`** (new `UsersModule`) —
  - `GET /users?search=&limit=&offset=` — returns `UserSummary[]` (`id`/`displayName`/`email`
    only, deliberately narrower than the full `UserEntity` — no `accountStatus`/`lastLoginAt`/
    timestamps reach the response).
  - `GET /users/:userId` — resolves a single, already-known id to the same summary shape (used by
    the edit form to show the current owner before any search happens); 404s for a nonexistent or
    disabled user, same treat-disabled-as-not-found convention `search()` already established.
  - Both routes gated on `users_roles:view` — the same grant that already lets
    `super_admin`/`owner_growth_approver` view role assignments. Verified this is the right fit,
    not a scope mismatch: those are exactly the two roles that can ever reach a project owner
    picker in the first place, since every other role is view-only on `project_configuration`.
  - `UsersModule` imports `AuthModule` (for `SessionGuard`) and `AuthzModule` (for
    `PermissionGuard`), and provides its own `USER_REPOSITORY` binding rather than importing it
    from `AuthModule` (which doesn't export it) — the same "re-declare, don't cross-import"
    pattern `AuthModule` itself already uses for `AUTHORIZATION_ACTION_REPOSITORY`.
  - Registered in `app.module.ts`.

### Shared types (`packages/shared-types`)

- **`UserSummary`** — `{ id, displayName, email }`. The first real user-lookup type in this app;
  its own doc comment records that `Project`/`ProjectDetail`'s prior "no user-lookup endpoint
  exists yet" reasoning for omitting owner identity is now only true for the list/detail pages
  (unchanged by this branch), not the create/edit form.

### Frontend (`apps/dashboard-web`)

- **`components/user-picker.tsx`** (new) — a reusable, debounced search-and-select control against
  `GET /users`. Client-side, direct `fetch()` + `credentials: "include"`, the same pattern every
  mutation/query in this app already uses. Two states: a search input with a dropdown of matches
  (300ms debounce), or — once a user is selected — a summary chip with a "Remove" action.
  Deliberately built generic enough (`id`/`label`/`value`/`onChange` props) to be reused as-is for
  team management and approver assignment once those are built.
- **`lib/users.ts`** (new) — `getUser(userId)`, server-side only (mirrors `lib/projects.ts`'s
  `getProject()`'s null-on-404/UUID-short-circuit contract exactly), for the edit page to resolve
  an existing owner to a display summary before the picker ever renders — avoids a flash of empty
  state or a second client-side round trip.
- **`components/project-form.tsx`** — gained a real `owner` field via `UserPicker`, wired into both
  create and edit payloads as `ownerUserId`. The backend schema (`createProjectSchema`/
  `updateProjectSchema`) already accepted `ownerUserId` since the Projects module's original
  build — this branch is purely what finally lets a person set it.
- **`app/(shell)/projects/[projectId]/edit/page.tsx`** — now calls `getUser(project.ownerUserId)`
  alongside `getProject()` and passes the resolved summary as `initial.owner`.

## 3. Validation

- **Unit tests**: `apps/dashboard-web/tests/unit/user-picker.test.tsx` (7, new),
  `apps/dashboard-web/tests/unit/users.test.tsx` (4, new — `getUser()`'s null/throw/success paths),
  `project-form.test.tsx` (2 new — owner search-and-submit, and edit-mode remove-and-submit) — 81/81
  `dashboard-web` unit tests passing.
- `apps/dashboard-api/src/users/users.service.spec.ts` (4, new) — 321/321 `dashboard-api` unit
  tests passing.
- **Integration**: `packages/database/test/phase1c-auth.integration.test.ts` gained a `search()`
  suite (4 new tests: substring/case-insensitive match, disabled-account exclusion, default
  ordering, limit/offset) against a real disposable database — 121/121 `packages/database`
  integration tests passing.
- **E2E**: `apps/dashboard-api/test/users.e2e-spec.ts` (new, 5 tests) — real session/RBAC
  end-to-end coverage: 401 with no session, a real `super_admin` session searching and resolving a
  user, a 404 for a nonexistent id, and a `read_only` session correctly denied with 403 (no
  `users_roles` grant at all). 92/92 `dashboard-api` e2e/integration tests passing.
- Typecheck, lint, `next build`, and `nest build` all clean on both apps; `pnpm exec prettier
--check` clean across the whole repo.

## 4. Not yet reviewed or merged

Pushed as its own branch (`user-lookup-owner-assignment`). Code review, security review,
second-role human review, a gate decision, and merge authorization are each their own separate,
not-yet-requested next step, unchanged from this project's standing discipline for every prior
slice.
