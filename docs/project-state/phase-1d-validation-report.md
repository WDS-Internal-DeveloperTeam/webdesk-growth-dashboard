# Phase 1D Validation Report — RBAC / Authorization

**Status:** Real, reproducible command output captured below, following the same discipline as
`docs/project-state/phase-1a-validation-report.md` through `phase-1c-validation-report.md` —
nothing here is narrated or summarized without the underlying command actually being run.

**Environment:** Node.js 22.18.0 (nvm-managed), pnpm 11.20.0 via corepack. Same Node-version note
as every prior phase's report: this environment runs Node 22, not the project's pinned
`>=24.0.0 <25.0.0`; every command below shows pnpm's own `[WARN] Unsupported engine` line, expected
and not suppressed, and caused no failure in this report. Local PostgreSQL 17 (Homebrew,
`webdesk_phase1d_dev`), same disposable-database setup as every prior phase.

## 1. Scope actually implemented (matches `docs/task-packages/phase-1d-rbac-authorization.md`)

- **`packages/database`**: 5 new migrations (`00009`–`00013`) — `roles`, `modules`,
  `role_permissions`, `user_roles`, and a seed migration transcribing the real, already-approved
  7-role × 21-module matrix from `06_Roles_and_Permissions.md §3` (458 grant rows). Sequelize
  models and 4 repository classes (`packages/database/src/authz/*`), exported via the package's
  public `index.ts`.
- **`apps/dashboard-api`**: `AuthzModule` — `PermissionService` (deny-by-default evaluation),
  `PermissionGuard` + `@RequirePermission` decorator, and the "Users/roles" module's own HTTP
  surface (`RoleAssignmentController`/`RoleAssignmentService`) as the one real, self-consistent
  feature this phase builds to prove the framework. A reusable `SeparationOfDutiesService`
  (`apps/dashboard-api/src/auth/common/`) and a new `SessionGuard`
  (`apps/dashboard-api/src/auth/session/`) — both real Phase 1C gaps this phase filled in, since
  neither existed yet despite being needed by `RecoveryService`/this phase's own guards.
- **`packages/shared-types`**: `RoleSummary`, plus `"role_assigned"`/`"role_revoked"` added to
  `AuthEventType`.
- **`docs/security/threat-model-authorization-rbac.md`** — STRIDE pass for the "Authorization"
  area required by `docs/security/threat-model-plan.md`.
- **`docs/task-packages/phase-1d-rbac-authorization.md`** — the scope-of-record for this phase.

**Not implemented** (explicitly out of scope, per the task package): the 21 real business-module
CRUD endpoints (`project_configuration`, `business_knowledge`, etc. — they don't exist as code
yet, `PermissionGuard` is proven only against "Users/roles"); the confidential-field axis
(`view_confidential`/`edit_confidential` — deliberately not seeded); object-level "(assigned)"
scoping (Review Center, Change Center, Imports); the general ADR-0017 audit-log subsystem (Task 7);
user-management CRUD/admin UI beyond role assignment (Task 8).

## 2. Dependencies installed

None. This phase added no new npm dependency to any `package.json` — confirmed via
`git diff --stat` across the branch, zero `package.json` changes. `pnpm audit --audit-level=high`
shows 19 pre-existing findings (10 moderate, 8 high, 1 critical), unchanged in kind from
`docs/project-state/dependency-audit-2026-08-07.md` (`multer`/`vite`/`sharp`/`postcss`
transitives) — tracked separately under the `security/dependency-audit-fixes` branch, out of this
phase's scope.

## 3. Full monorepo validation suite

```
$ pnpm build
 Tasks:    9 successful, 9 total

$ pnpm lint
 Tasks:    14 successful, 14 total

$ pnpm typecheck
 Tasks:    14 successful, 14 total

$ pnpm format
All matched files use Prettier code style!
   (13 files needed `format:write` mid-session — see §7; re-ran clean afterward)

$ pnpm boundaries:check
  warn no-orphans: apps/dashboard-web/tests/unit/setup.ts
  warn no-orphans: apps/dashboard-web/lib/logger.ts
  warn no-orphans: apps/dashboard-web/lib/auth.ts
x 3 dependency violations (0 errors, 3 warnings). 179 modules, 402 dependencies cruised.

$ pnpm scan:secrets
Secret-pattern scan passed — 271 tracked files checked, no matches.
```

Zero errors on `boundaries:check` — the same 3 pre-existing orphan warnings as Phase 1C's report,
none new; `only-database-package-touches-sequelize` continues to hold, including the 4 new
`packages/database/src/authz/*` repository files.

## 4. `packages/database` — migrations, real disposable database

```
$ export DATABASE_URL="postgres://<local-user>@localhost:5432/webdesk_phase1d_dev"
$ export DATABASE_SSL="false"
$ pnpm --filter @webdesk/database migrate:test
Applied 13 migration(s): 00001-create-framework-probe ... 00013-seed-rbac-matrix
Reverted 1 migration(s): 00013-seed-rbac-matrix
```

Full up/down/up round-trip separately verified (all 13 migrations down to empty, then back up
clean) during development — 7 roles, 21 modules, 458 permission rows spot-checked directly via
`psql` against the real matrix, not assumed from the seed script's own logic.

```
$ pnpm --filter @webdesk/database test:integration
 ✓ test/database-foundation.integration.test.ts (8 tests)
 ✓ test/phase1c-auth.integration.test.ts (15 tests)
 ✓ test/phase1d-authz.integration.test.ts (12 tests)
 Test Files  3 passed (3)
      Tests  35 passed (35)
```

The 12 new tests, all against the live seeded database: seeded-role/module count assertions;
`RolePermissionRepository.hasGrant()` spot-checked against real matrix cells (e.g. `super_admin`
holds `users_roles:edit`, `owner_growth_approver` does not); `P`/`L` letter-code expansion verified
to produce exactly two actions each (`publish`+`unpublish`, `release`+`rollback`); an explicit
assertion that no `view_confidential`/`edit_confidential` grant exists for any role (proving the
seed migration's own documented scope decision, not just trusting its comment);
`UserRoleRepository` assign/revoke/idempotent-revoke/multi-role/unique-constraint behavior.

## 5. `apps/dashboard-api` — unit tests (mocked, no database required)

```
$ pnpm --filter @webdesk/dashboard-api test
 ✓ src/authz/permission.service.spec.ts (5)          ✓ src/authz/permission.guard.spec.ts (4)
 ✓ src/authz/role-assignment.service.spec.ts (11)     ✓ src/authz/role-assignment.controller.spec.ts (5)
 ✓ src/auth/common/separation-of-duties.service.spec.ts (3)
 ✓ src/auth/session/session.guard.spec.ts (3)
 (+ all 12 pre-existing Phase 1C suites, unchanged and still passing)
 Test Files  18 passed (18)
      Tests  115 passed (115)
```

Notable real behaviors proven, not just asserted: `permission.service.spec.ts` proves
`PermissionService.can()` short-circuits (never queries roles/grants) on an unknown module key or a
user holding zero roles — the "deny fast, don't leak query patterns to a downstream check" property
its own doc comment claims; `permission.guard.spec.ts` proves the guard fails closed with a 500 on
a genuinely missing `@RequirePermission` (developer error, not silent bypass) and independently
fails closed with 401 on a missing `authUser`, regardless of guard ordering;
`role-assignment.service.spec.ts` proves session revocation and the `role_assigned`/`role_revoked`
audit event fire only on an actual state change, never on the idempotent-no-op or conflict paths.

## 6. `apps/dashboard-api` — e2e tests, real disposable database

```
$ export DATABASE_URL="postgres://<local-user>@localhost:5432/webdesk_phase1d_dev"
$ export DATABASE_SSL="false"
$ pnpm --filter @webdesk/dashboard-api test:integration
 ✓ test/auth.e2e-spec.ts (10 tests)
 ✓ test/authz.e2e-spec.ts (13 tests)
 ✓ test/health.e2e-spec.ts (5 tests)
 Test Files  3 passed (3)
      Tests  28 passed (28)
```

`authz.e2e-spec.ts` boots a real Nest application (`AuthzModule`, importing `AuthModule`, with
`OIDC_CONFIGURATION` overridden the same way as `auth.e2e-spec.ts` — no network call), migrates a
real database seeded with the actual `06_Roles_and_Permissions.md` matrix, issues real sessions via
`SessionService.issue()` directly (the login HTTP flow itself is already covered by
`auth.e2e-spec.ts`, so this suite focuses on guard composition and real grants), and drives every
request through `supertest` against the **real seeded matrix**, not a mocked `PermissionService`:

- **`GET /authz/roles`**: no cookie → 401. `super_admin` (real `VCERM` grant) → 200, all 7 roles.
  `owner_growth_approver` (real `VM` grant, no `E`) → 200. `read_only` (holds **no** `users_roles`
  grant at all in the real seeded matrix) → 403 — proving deny-by-default against real seed data,
  not a mock returning `false`.
- **`GET /authz/users/:userId/roles`**: `super_admin` → 200; `read_only` → 403.
- **`POST /authz/users/:userId/roles`**: missing `Origin` header → 403, before permission is even
  checked (guard-ordering proof). `owner_growth_approver` (real grant has `V`+`M`, not `E`) → 403 —
  proving the matrix's own view/edit distinction is enforced, not just "has any grant at all".
  Non-UUID `roleId` → 400 at the Zod-validation layer. `super_admin` → 200, assigns the role,
  **and the target's pre-existing session cookie is now rejected with 401** on its next use — the
  role-change session-revocation property proven end-to-end, not just asserted in a unit test
  against a mocked `SessionService`. Re-assigning the same role → 409.
- **`DELETE /authz/users/:userId/roles/:roleId`**: `super_admin` → 200, revokes, and again
  invalidates the target's existing session. `owner_growth_approver` → 403.

**Two real bugs were caught and fixed here, not just the final passing state:**

1. **`@UsePipes` applied at method level runs the Zod schema against every parameter of the
   handler, not only `@Body()`.** `assignRole(@Param("userId") userId, @Body() body, @Req() req)`
   had `@UsePipes(new ZodValidationPipe(assignRoleSchema))` at the method level — NestJS ran the
   schema against `userId` (a plain string) as well, which always fails `{roleId: uuid()}`
   validation, so **every** `POST /authz/users/:userId/roles` request returned 400, masked in
   earlier manual testing only because guard checks (which run before pipes) had already rejected
   the request for an unrelated reason in every case tried by hand. `@Req()`/`@Res()` parameters
   are excluded from Nest's pipe execution by the framework itself, which is why the identical
   `@UsePipes` pattern on `EmergencyAuthController` (Phase 1C, `@Body()`+`@Req()`+`@Res()`) never
   surfaced this — `@Param()` is not excluded. Fixed by moving the pipe to the `@Body()` parameter
   directly (`@Body(new ZodValidationPipe(assignRoleSchema)) body`), matching the pipe to the one
   parameter it should validate. Caught only because the e2e test drove the actual success path
   (assign as `super_admin` with a real, valid role id) — every guard-rejection test around it
   passed regardless of this bug, since they never reached the pipe.
2. **`vitest.integration.config.mts` had no `fileParallelism: false`.** With only one e2e-spec
   file (Phase 1C), this was invisible; adding a second file (`authz.e2e-spec.ts`) that also runs
   its own full `migrator.up()`/`down({to:0})` against the *same* shared disposable database caused
   Vitest's default parallel-file execution to race two concurrent schema migrations, intermittently
   failing with a Postgres unique-constraint violation on the ENUM type Sequelize creates for
   `_framework_probe`. Fixed by setting `fileParallelism: false` in the integration config, with a
   comment explaining why. Verified by re-running the full `test:integration` suite (both spec
   files together) multiple times with no recurrence, and confirming the database is left in a
   clean, fully-reverted state (`\dt` shows only `SequelizeMeta`) after each run.

## 7. Formatting drift caught mid-session

`pnpm format` initially failed on 13 files — this phase's own new/modified source (the `authz/`
directory, `role-assignment.controller.ts`'s naming-collision fix, migration `00013`, the new
integration test) plus the STRIDE document and task package, none of which had been run through
Prettier before this validation pass. Ran `pnpm format:write`, reviewed the diff (whitespace/quote/
line-wrap only, confirmed via re-running `pnpm lint`/`pnpm typecheck`/the full test suite
afterward — all still green, zero semantic change), then re-ran `pnpm format` to confirm clean.

## 8. Threat model — one flagged, unresolved design decision

`docs/security/threat-model-authorization-rbac.md`'s STRIDE pass identified that
`RoleAssignmentService.assignRole`/`revokeRole` perform **no separation-of-duties check** on
self-targeting role changes — unlike `RecoveryService` (Phase 1C), which already calls the
`SeparationOfDutiesService` primitive this same phase built. A Super Admin can freely change their
own roles with no second approver. This is not a privilege-escalation-from-nothing bug (the actor
must already hold `users_roles:edit`), but is flagged as an open decision for the required
second-role reviewer rather than silently left unaddressed or unilaterally "fixed" without
authorization beyond this phase's own scope — see that document's Elevation of Privilege table and
"Summary of accepted gaps" for the full reasoning.

## What this validation does NOT claim

Confirms deny-by-default permission evaluation, guard composition (`SessionGuard` →
`OriginCheckGuard`/`PermissionGuard`), and the "Users/roles" module's own HTTP surface work
end-to-end against a real (if disposable) PostgreSQL instance seeded with the actual, approved
7-role/21-module/458-grant matrix, and a real in-process Nest application. It does **not** claim:
the 21 real business-module endpoints exist or have been proven against `PermissionGuard` (only
"Users/roles" has); the confidential-field axis is implemented; the self-assignment
separation-of-duties gap (§8) has been resolved — it hasn't, and is an open decision, not an
oversight; or that the STRIDE threat-model pass
(`docs/security/threat-model-authorization-rbac.md`) has received its required second-role human
review — it has not, and that document says so explicitly.
