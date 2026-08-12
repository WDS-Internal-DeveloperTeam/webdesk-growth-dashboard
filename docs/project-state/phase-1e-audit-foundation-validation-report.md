# Phase 1E — Audit Foundation Slice — Validation Report

**Scope:** sections 5–8 of the Phase 1E specification only (audit-event architecture,
immutability, retention classification, approval/separation-of-duties event linkage), per
`docs/task-packages/phase-1e-audit-foundation.md`. Built on branch `phase-1e-audit-foundation`,
off `main` at `95b8c25`. **Not merged, not deployed** — per this project's standing git-workflow
discipline (see `CLAUDE.md` Cautions).

## What was built

1. `packages/database/src/migrations/00018-create-audit-events.ts` — the ADR-0017 general-purpose
   `audit_events` table, distinct from Phase 1C's narrow `auth_events` (migration 00008). Database-
   layer immutability via a Postgres trigger: `UPDATE` is unconditionally rejected; `DELETE` is
   rejected unless the transaction has set `audit.retention_delete_authorized = 'on'`, and even
   then is refused for any row with `legal_hold = true`.
2. `packages/database/src/audit/` — `AuditEvent` Sequelize model + `AuditEventRepository`
   (`record`/`findByEntity`/`findRecentByActor`, no update/delete method ever exposed).
3. `apps/dashboard-api/src/audit/` — `AuditModule`/`AuditService`, the single shared emission
   point, validating `eventType` and `retentionCategory` against controlled value sets before
   delegating to the repository.
4. Additive wiring into two existing services (no existing behavior or existing `auth_events`
   write removed or altered):
   - `RoleAssignmentService.assignRole`/`revokeRole` — now also records a `permission_change`
     audit event on success and a `security_exception` audit event on the self-targeting SoD
     denial.
   - `RecoveryService.createRequest`/`decide` — now also records `account_recovery_request` /
     `account_recovery_decision` audit events, and **closes the specific gap** flagged by both the
     Phase 1D independent code review and `docs/project-state/phase-1e-pre-implementation-verification.md`
     item 7: a self-approval attempt on a recovery request is now recorded (`security_exception`,
     `action: separation_of_duties_denied`), not just blocked.

## Validation evidence (this session, real disposable local PostgreSQL 17)

| Check | Result |
| --- | --- |
| `pnpm --filter @webdesk/database run migrate:test` (up all 18, down 1 — round trip) | Clean, no errors |
| `pnpm --filter @webdesk/database run test:integration` | **48/48 passed** (includes the 7 new `phase1e-audit.integration.test.ts` tests: repository create/query, DB-level UPDATE rejection, DB-level DELETE rejection with no authorization, DELETE succeeding once `audit.retention_delete_authorized` is set, DELETE still refused for a `legal_hold = true` row even with authorization set, and the `git_commit_sha` CHECK constraint) |
| `pnpm --filter @webdesk/database run typecheck` | Clean |
| `pnpm --filter @webdesk/database run lint` | Clean |
| `pnpm --filter dashboard-api run typecheck` | Clean |
| `pnpm --filter dashboard-api run lint` | Clean |
| `pnpm --filter dashboard-api run test` (unit) | **148/148 passed** (144 previously + 4 new `AuditService` tests; `RoleAssignmentService`/`RecoveryService` specs updated with new audit-call assertions, all passing) |
| `pnpm --filter dashboard-api run test:integration` (e2e, real database) | **37/37 passed** — including `authz.e2e-spec.ts` (22 tests), proving the NestJS module graph with `AuditModule` newly imported into both `AuthModule` and `AuthzModule` boots and resolves with no DI errors |
| `pnpm audit` | 0 known vulnerabilities (no new dependencies added this slice) |
| `node scripts/scan-secrets.mjs` | Passed — 348 tracked files checked, no matches |

Disposable database (`webdesk_phase1e_dev`, local Postgres 17) dropped after validation, per this
project's standing test-database discipline.

## Explicitly out of scope (see task package for full list)

Migrating existing `auth_events` writes into `audit_events`; the retention-deletion job itself
(the DB trigger's `audit.retention_delete_authorized` hook is designed for it, not built here);
confidential-field redaction logic (no caller in this slice passes `before_state`/`after_state`);
operational jobs, notifications, full retention system, operational contacts, core system health —
all separate, not-yet-authorized Phase 1E components.

## Git workflow

Per this project's standing pattern (Phases 1A–1D-expanded all concluded their implementation
authorization with commit → push branch → open PR, review/merge/gate-approval each a separate,
later authorization) — commit, push `phase-1e-audit-foundation`, open a PR against `main`. No
merge, no deploy.
