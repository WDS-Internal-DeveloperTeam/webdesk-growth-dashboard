# Threat Model — Phase 1E Operational Infrastructure

**Status:** Originally a self-review only, authored by the same agent that implemented these
slices — per `docs/security/threat-model-plan.md`'s procedure and ADR-0010's separation-of-duties
principle, this required review by a second, human role. **That review is now complete**: Jitesh D
reviewed the full findings disposition below (8 of 10 fixed, 2 accepted as tracked debt) and the 3
newest fixes' own diffs — decision **Approved as-is**, 2026-08-13, no disputes raised. See
`docs/project-state/phase-1e-approval-checklist.md`'s "Sign-off" section for the recorded decision.
**The Phase 1E gate (G4-1E) is now approved** on the strength of this completed review — WebDesk
Solution, decision CONFIRM, 2026-08-13, approved commit `6ae8a36116f70ed0f4d429af12774e05b2092e70`.

Covers all six Phase 1E architecture slices as a single pass, since they share one RBAC pattern
(reuse `system_settings`, zero-seeded new actions) and one audit-emission mechanism. **Update
2026-08-13: all six slices are now merged to `main`**, along with the 3 additional fixes via
PR #22 (`main`'s HEAD is `6ae8a36`) — see `docs/project-state/phase-1e-validation-report.md` §1
for exact merge commits. This document's own findings (below) are otherwise unchanged from the
original self-review; the "Summary of accepted gaps" section records which have since been fixed.

## Out of scope for this pass

The 21 real business-module CRUD endpoints, real SMTP delivery, real Vercel Cron/Queue wiring for
jobs and retention cleanup, real health probes — none of these exist as code yet in any Phase 1E
slice. Also out of scope: the independent code-review findings already reported separately via
`ReportFindings` during this same session's code-review pass (concurrency races, the migration-00019
immutability-trigger bug, etc.) — this document covers security properties specifically, cross-
referencing those findings only where they double as a security gap (see Repudiation, below).

---

## Spoofing (identity)

Verified: every controller across all six slices sources actor identity from the authenticated
session (`req.authUser!.id`), never from the client-supplied request body — `requestedByUserId`
(jobs), `checkedByUserId` (system-health), `createdByUserId`/`releasedByUserId` (retention),
`actorUserId` (contacts) are all session-sourced.

**Gap found:** `POST /retention/holds`'s `approvedByUserId` field is the one exception —
`retention.dto.ts`'s `createHoldSchema` accepts it from the client body, and
`RetentionHoldService.createHold()` persists it verbatim with no verification the named user ever
approved anything. A caller holding `retention_hold` can falsely attribute a legal-hold approval
to an arbitrary real user ID. **Accepted as an open gap** (see "Summary of accepted gaps" below) —
not fixed in this pass.

## Tampering (unauthorized modification)

No SQL-injection-style ID tampering found — every repository across all six slices uses
Sequelize's typed query builder, not raw `sequelize.query`/`literal()` for user input. No
mass-assignment gap in `operational-contacts`' update endpoint — `updateContactSchema` is an
explicit Zod allowlist matching the service's `UpdateContactInput` type exactly.

**Gap found:** `POST /notifications` accepts `recipientUserId`/`recipientContactId`/`projectId`
from the client with no existence or ownership check — `NotificationService.create()` persists
these IDs verbatim. Low severity today (zero-seeded grant, no real delivery adapter), but a real
IDOR/spam vector the moment `notifications_configure` is granted and a delivery adapter goes live.
**Accepted as an open gap.**

## Repudiation (missing/unreliable audit trail)

Built a full write-endpoint audit-coverage table across all six slices. Two real gaps with **zero**
audit emission (not merely fallible, per the separate code-review pass's findings on
audit-write-ordering):

| Slice                | Write endpoint                                                    | Audit coverage                                                                                                                                                                                                                             |
| -------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| jobs                 | `POST /jobs` (`JobService.create()`)                              | **None** — `JobService` has no `AuditService` dependency at all; no `job_created` event type exists                                                                                                                                        |
| jobs                 | `POST /jobs/:id/retry`, `POST /jobs/:id/cancel`                   | Covered (`job_retry_requested`, `job_cancellation_requested`)                                                                                                                                                                              |
| notifications        | `POST /notifications`, `POST /notifications/:id/attempt-delivery` | **None anywhere** — `NotificationService` has no `AuditService` dependency; `create`/`attemptDelivery`/`markFailed`/`confirmAccepted`/`confirmRejected` all mutate state with zero audit emission                                          |
| retention            | `POST /retention/holds`, `.../release`                            | Covered (`retention_hold_created`, `retention_hold_released`)                                                                                                                                                                              |
| operational-contacts | `POST /operational-contacts`, `.../update`, `.../deactivate`      | Covered (`operational_contact_created`, `operational_contact_updated`)                                                                                                                                                                     |
| system-operations    | `POST /system-health/checks`                                      | Covered, but conditional on `checkedByUserId` being truthy — harmless today since the controller always supplies it, but the service itself would silently skip audit emission for a future caller (e.g. an automated probe) that omits it |

**Gap found:** creating a job or a notification — both potentially significant operational actions
(a notification can be `severity: critical`; a job can target arbitrary `resourceType`/`resourceId`)
— currently leaves **no record at all** in the tamper-resistant `audit_events` trail. `jobs.created_at`/
`requested_by_user_id` exist on the row itself, but that's mutable application data, not the
DB-trigger-enforced-immutable audit table. **Accepted as an open gap**, consistent with each
slice's own task-package framing ("no real producer creates one of these yet — this proves the
framework"), but should be closed before any real producer is wired.

## Elevation of Privilege

Verified every write route across all six slices sits behind both `SessionGuard` and
`PermissionGuard`+`@RequirePermission`, and every read route is behind `PermissionGuard` too — no
route skips authorization. Traced every new action string (`jobs_view`/`jobs_create`/`jobs_retry`/
`jobs_cancel`, `notifications_view`/`notifications_configure`, `retention_view`/
`retention_configure`/`retention_hold`, `contacts_view`/`contacts_configure`/
`incident_severity_view`, `system_health_view`/`system_settings_configure`) against
`00013-seed-rbac-matrix.ts`'s literal seeded grants and confirmed none collide with an
already-seeded action string, and confirmed no later per-slice seed migration touches
`role_permissions` — deny-by-default genuinely holds for all six slices, proven directly in each
slice's own e2e suite (even `super_admin` denied 403 until a grant is seeded).

**Gap found:** none of these six controllers use a `:projectId` route param, so `PermissionGuard`
always evaluates at global scope only — but `GET /jobs` and `GET /notifications` both accept an
independent, unchecked `projectId` _query_ filter. Currently inert (zero grants exist for any
project-scoped role on these actions), but this is the same class of latent bug as the already-
tracked Phase 1D `RolePermissionRepository.hasGrant`'s `Op.in: [null, projectId]` finding — the
moment a project-scoped grant is ever seeded for `jobs_view`/`notifications_view`, this needs
re-verification that the query filter can't be used to read another project's records. **Accepted
as an open gap**, tracked as the same class of technical debt as the existing Phase 1D finding.

## Information Disclosure

**Gap found:** `operational_contacts` can store real PII (name/email/phone) for external contacts,
and `GET /operational-contacts` returns it in full to any caller holding only `contacts_view` — no
confidentiality gating comparable to Phase 1D-expanded's `view_confidential`/`edit_confidential`
mechanism used elsewhere in this codebase for exactly this kind of sensitive-field access.
`retention_holds` and `system_health_checks` have no comparable exposure (no PII, and `retention_holds`'
`reason`/`release_reason` free-text fields are already gated behind the same `retention_view` action
as everything else in that slice). The global `AllExceptionsFilter` and all six slices' own thrown
exceptions were checked and only echo back caller-supplied identifiers — no stack traces or
cross-user data leak in any error response. **Accepted as an open gap.**

## Denial of Service

**Gap found:** `OperationalContactRepository.list()`/`findActiveForArea()` and
`RetentionHoldRepository.listAll()` have no LIMIT/pagination cap, unlike every other list query in
these six slices (jobs/notifications/system-events all cap at 50 default / 200 max). Currently low
risk (zero-seeded grants, and both tables are operator-configured, not high-volume), but should be
brought in line with the pagination convention this project otherwise follows consistently.

**Gap found:** `JobRetryService.manualRetry()` never checks `attemptCount` against `maxAttempts`
before allowing a manual retry — a caller with `jobs_retry` can retry a job indefinitely, bypassing
the exponential-backoff/max-attempts safety cap that the _automatic_ retry path (`JobService`'s
internal retry logic) enforces. This is a policy gap (manual override vs. automatic cap), not
obviously a bug, but worth an explicit decision on whether manual retry should also respect
`maxAttempts` or is intentionally an escape hatch.

No recursive/unbounded-loop risk found in `RetentionCleanupService` (a bounded for-loop over
caller-supplied candidates, and not wired to any HTTP route in this slice regardless).

---

## Summary of accepted gaps

All ten gaps found above were originally **surfaced, not silently resolved** — consistent with
this project's standing pattern (e.g. Phase 1C's G4-1C OVERRIDE, Phase 1D's self-role-assignment
gap) of flagging an open item for the human reviewer's decision rather than the implementing agent
unilaterally deciding it's acceptable. **Update 2026-08-13:** the user went through all 5 genuine
policy questions explicitly, one by one — 3 were decided "fix now" and are fixed and re-validated
below; 2 were decided "accept as tracked debt," recorded as an explicit decision, not an
oversight:

1. Retention hold `approvedByUserId` is client-attributable, not verified (Spoofing). **Accepted
   as tracked debt** — no real legal-hold workflow exists yet and the permission is zero-seeded;
   revisit before one goes live.
2. Notification `recipientUserId`/`recipientContactId`/`projectId` accepted with no existence check
   (Tampering). **Fixed** — commit `df07eb8` (`recipientUserId`/`recipientContactId` existence now
   verified; `projectId` deliberately still unchecked — no `Project` entity exists yet).
3. `JobService.create()` has zero audit-trail coverage (Repudiation). **Fixed** — commit `e6306a8`.
4. `NotificationService` has zero audit-trail coverage across all five of its mutating methods
   (Repudiation). **Fixed** — commit `1c9e822`.
5. `SystemHealthService.recordCheck()`'s audit emission is conditional, not unconditional
   (Repudiation). **Fixed** — commit `eb4b916`.
6. `jobs`/`notifications` list endpoints accept an unchecked `projectId` query filter with no
   route-level project scoping — latent, same class as the existing Phase 1D `Op.in` finding
   (Elevation of Privilege). **Accepted as tracked debt** — matches the precedent already accepted
   for the identical Phase 1D finding; revisit the moment a project-scoped grant is ever seeded
   for these actions.
7. `operational_contacts` PII has no confidential-field gating, unlike the precedent set elsewhere
   in this codebase (Information Disclosure). **Fixed** — commit `f632e96`, gated behind the
   existing `view_confidential` action on the `system_settings` module key.
8. `OperationalContactRepository`/`RetentionHoldRepository` list queries have no pagination cap
   (Denial of Service). **Fixed** — commits `8db3bd7` (contacts), `79a265e` (retention holds).
9. `JobRetryService.manualRetry()` doesn't respect `maxAttempts` (Denial of Service — policy
   question). **Fixed** — commit `a6305c1`, now enforces the same cap the automatic retry path
   already applies.
10. All ten gaps interact with the correctness bugs already surfaced in this session's separate
    code-review pass (in particular the audit-write-ordering issues and the migration-00019
    immutability-trigger bug) — both classes of finding are now fixed; see
    `docs/project-state/phase-1e-validation-report.md` §3.

**Final disposition: 8 of 10 gaps fixed and re-validated; 2 accepted as tracked technical debt by
explicit human decision** (items 1 and 6 above) — a real decision made by the user, not something
this document or its author resolved unilaterally, same as every prior threat-model document in
this project.

## Not addressed by this pass

Real SMTP delivery, real Vercel Cron/Queue wiring, real health probes, and the 21 business-module
endpoints all remain out of scope — each will need its own extension of this threat model (or a
new one) once built, per the same pattern `threat-model-authorization-rbac.md` established for
Phase 1D's own "not yet built" scope boundary.
