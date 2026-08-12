# Task Package — Phase 1E, Audit Foundation Slice

**Authorization:** "Start Phase 1E with the audit foundation first" (explicit, 2026-08-12), scoping
this task package to sections 5–8 of the larger Phase 1E specification (audit-event architecture,
immutability, retention classification, approval/separation-of-duties event linkage) only. The
other Phase 1E components named in that specification — operational jobs, notifications, the full
retention-deletion system, operational contacts, core system operations/health — are explicitly
**not** part of this slice and require their own separate authorization, consistent with the
user's own "audit foundation first" framing.

**Pre-implementation verification:** completed and recorded before this document —
`docs/project-state/phase-1e-pre-implementation-verification.md`. No blocking gap found.

## Grounding documents (read in full before design)

- `docs/architecture/decisions/0017-audit-event-immutability-retention.md` (ADR-0017) — append-only,
  database-layer-enforced, 7-year retention for audit/approval/deployment-audit records.
- `webdesk-nodejs/skills/nodejs/projects/custom-app-build/profiles/webdesk-growth-dashboard/knowledge/10-data-ownership-and-audit.md`
  — the `audit_events` field list and "what triggers an audit event."
- `webdesk-nodejs/skills/nodejs/projects/custom-app-build/profiles/webdesk-growth-dashboard/knowledge/11-retention-backup-and-operations.md`
  — the retention-category matrix and the (separately-authorized, not-built-here) retention-deletion
  job's own shape.
- `webdesk-nodejs/skills/nodejs/projects/custom-app-build/profiles/webdesk-growth-dashboard/contracts/audit-event.schema.json`
  — the approved JSON Schema formalizing the exact field list, including the `event_type` enum
  (which explicitly includes `account_recovery_request`/`account_recovery_decision`/
  `permission_change` — i.e. the schema itself anticipates these being the exact categories this
  slice wires in).

## Explicit distinction from `auth_events` (migration 00008)

`auth_events` (Phase 1C) is deliberately narrow — login-scoped only, app-level-convention
append-only, not the ADR-0017 subsystem (its own file doc-comment says so explicitly). This slice
adds the actual ADR-0017 general-purpose `audit_events` table as a **new, separate** table. It does
**not** remove, rename, or migrate any existing `auth_events` write — every existing `auth_events`
call site is left exactly as-is. The two tables coexist by design, matching each's own documented
scope.

## Scope of this slice

1. **`audit_events` migration** (`packages/database/src/migrations/00018-create-audit-events.ts`)
   — full field list per the contract schema. **Database-layer immutability**, not app convention:
   a Postgres trigger unconditionally rejects `UPDATE`, and rejects `DELETE` unless a
   transaction-local `audit.retention_delete_authorized` setting is explicitly set to `'on'` (the
   hook the not-yet-built retention-deletion job will use later — designing the hook now, per
   ADR-0017's own text, without building the job itself, which is out of this slice's scope).
   `legal_hold = true` rows are additionally protected: the trigger refuses the delete outright even
   with the setting on, so a future job's own `WHERE legal_hold = false` filter is backed by a
   second, independent enforcement layer, not just its own query correctness.
2. **`AuditEvent` model + `AuditEventRepository`** (`packages/database/src/audit/`) — exposes
   exactly one write method, `record`, plus read/query methods. No `update`/`delete` method is ever
   exposed, matching `AuthEventRepository`/`AuthorizationActionRepository`'s existing convention —
   here backed by a real DB-level guarantee in addition to the convention.
3. **`dashboard-api` `AuditModule`/`AuditService`** — the single shared emission point every other
   service calls to record a general audit event, instead of each caller writing its own ad-hoc
   insert. `retentionCategory` and `eventType` are validated against the schema's controlled value
   sets at the service boundary.
4. **Approval / separation-of-duties event linkage** — wires the new `AuditService` into two
   existing call sites, additively (no existing `auth_events` write is removed or altered):
   - `RoleAssignmentService.assignRole`/`revokeRole` — records `permission_change` on success, and
     `security_exception` (`action: separation_of_duties_denied`) on the self-targeting block.
   - `RecoveryService.createRequest`/`decide` — records `account_recovery_request` /
     `account_recovery_decision`. **Closes the specific gap** the Phase 1D independent code review
     and the Phase 1E pre-implementation verification (item 7) both flagged: `RecoveryService.decide`
     did not wrap its `assertDistinctActors` call the way `RoleAssignmentService` did, so a
     self-approval attempt on a recovery request was correctly _blocked_ but never _recorded_
     anywhere. Fixed by the same try/catch-then-record pattern already proven in
     `RoleAssignmentService`.

## Explicitly out of scope for this slice (deferred, not silently dropped)

- Migrating existing `auth_events` writes (login/session events) into the new `audit_events` table.
- The retention-deletion job itself (Vercel Cron handler) — the DB trigger's
  `audit.retention_delete_authorized` hook is designed for it, but no job code is written here.
- Confidential-field redaction logic for `before_state`/`after_state` — no caller in this slice
  passes either field; `apps/dashboard-api/src/authz/confidential-field.util.ts` is the existing
  tool a future caller must use before passing either field, per the schema's own redaction note.
- Operational jobs, notifications, operational contacts, core system health — separate,
  not-yet-authorized Phase 1E components.

## Test plan

- Unit: `AuditEventRepository` (via a real disposable DB, since repository logic is thin), the new
  `AuditService`'s validation of `eventType`/`retentionCategory` controlled values, and both updated
  call sites' new event-recording behavior (mocked repositories).
- Integration (real disposable database): migration up/down round-trip; `AuditEventRepository`
  create + query; **the DB-level immutability trigger itself** — attempt a raw `UPDATE` and a raw
  `DELETE` against an inserted row and assert both are rejected by Postgres, then assert a `DELETE`
  succeeds once `audit.retention_delete_authorized` is set for that transaction and fails again once
  `legal_hold = true` is also set.
- e2e/service-level: `RecoveryService.decide()` self-approval attempt now produces an `audit_events`
  row with `action: separation_of_duties_denied` (the specific gap being closed), verified against a
  real database.

## Git workflow

Dedicated feature branch `phase-1e-audit-foundation`, off `main` at `95b8c25`. No merge, no deploy —
per the Phase 1E brief's own git-workflow section and this project's standing discipline throughout
Phases 1A–1D.
