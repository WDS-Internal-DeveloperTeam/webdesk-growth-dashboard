# Phase 1E — Retention Architecture (task package)

**Authorization:** "Continue to retention next" — the fourth slice of Phase 1E's own
authorization brief, following the audit-foundation slice (PR #11, merged), the audit-schema-
expansion, job-architecture, and notification-foundation slices (all pushed, not merged). Covers
brief §19–§23 (retention-policy foundation, approved retention values, legal/retention holds,
cleanup/deletion foundation, soft deletion) plus the retention-specific portions of §26/§28/§29/
§34/§37.

## Branch base

Off `main`, not off any of the other three still-unmerged Phase 1E branches — same independent-
slice reasoning as job-architecture and notification-foundation. This is now the **fourth**
consecutive Phase 1E branch to independently claim migration number `00019` (alongside
audit-schema-expansion, job-architecture, notification-foundation) — expected, same rebase-on-
merge friction already flagged three times over.

## Design decisions

1. **The retention _values_ are seeded, real, approved data — not a pending business decision
   like RBAC grants.** §20's 25-category matrix is given directly and explicitly in the brief as
   "Approved retention values," distinct in kind from the 458-grant RBAC matrix's own "which role
   gets which permission" business judgment call. `retention_policies` is created **and seeded**
   in this slice with all 25 real categories and their real values — unlike every previous Phase
   1E permission addition (zero-seeded by design), there is nothing to wait on here; the numbers
   are already decided. Category keys reuse existing vocabulary where one already exists
   (`audit-7y`, `approval-audit-7y`, `security-log-1y` already appear as literal
   `audit_events.retention_category` values from the original audit-foundation slice) so the
   policy table becomes the single source of truth those strings should trace back to.

2. **`retention_holds` is generic and polymorphic** (§21) — `resource_type`/`resource_id`
   (unconstrained, same `audit_events.entity_id` precedent) for a hold on one specific record, or
   a `category_key` FK into `retention_policies` for a hold on an entire category. "Do not
   silently release a hold" (§21) is enforced structurally: `release_reason` is a required field
   on the release call, not optional — there is no code path that clears `status` without one.

3. **RBAC uses the exact three action names §29 itself gives**: `retention_view`,
   `retention_configure`, `retention_hold` (translated from the brief's dotted
   `retention.view`/`retention.configure`/`retention.hold` to this codebase's underscore
   convention). Reuses `system_settings`, same module every other Phase 1E permission addition
   has reused — zero `role_permissions` rows seeded, same "real, checked, zero seeded" precedent.

4. **The cleanup/deletion service is real and proven end-to-end, but not exposed over HTTP in
   this slice.** §22 asks for "an interface/service for future retention cleanup" and explicitly
   forbids executing destructive production cleanup this phase ("Use safe test fixtures"). Rather
   than build an HTTP endpoint that accepts arbitrary resource references to delete — a real risk
   surface for an under-scoped foundation slice — `RetentionCleanupService` is proven entirely at
   the service layer, including a real-database integration test that exercises its full 9-step
   process (determine policy → age → hold → dependency → eligibility → dry-run counts → execution
   mode → deletion result → audit event) against `_framework_probe`, the same "test-only, proves
   the mechanism, never a real business entity" table Phase 1B's own database foundation
   established for exactly this purpose. No HTTP route can trigger a real deletion in this slice.

5. **Two new audit event types**: `retention_hold_created`, `retention_hold_released` — hold
   actions are genuinely human-initiated and actor-attributable, same reasoning that justified
   `job_retry_requested`/`job_cancellation_requested` on the job-architecture branch. The
   pre-existing `retention_run` event type (present since the original audit contract) is used by
   `RetentionCleanupService.execute()` for the cleanup-run summary itself — its first real use.

6. **No `deletion_runs` persistent log table.** `CleanupService.execute()`'s return value plus the
   `retention_run` audit event (which carries eligible/ineligible/deleted counts in its
   `after_state`) are the record of what happened in this slice. A dedicated `deletion_runs` table
   is a reasonable future enhancement once a real, scheduled, production cleanup job actually
   exists — building it now, before any real deletion job runs, would be speculative schema
   design against nothing, the same reasoning that kept `related_task/review/release_id`
   unwidened on `audit_events`.

7. **§23 (soft deletion) needs no new work.** Soft deletion already exists from Phase 1B
   (`SequelizeRepository.softDelete()`, `BaseEntity.deletedAt`, Sequelize `paranoid` mode) —
   available to any future business entity that needs it. No new table is added here; `jobs` and
   `notifications` deliberately don't get a `deleted_at` column (operational records, not the kind
   of "approved business record" §23 means), and `audit_events` deliberately still has none
   (append-only, immutable — §23's own instruction: "audit records themselves are not soft
   deleted").

## What this slice does NOT include

- No real deletion job wired to Vercel Cron/Workflows (§33 territory — separate, later
  authorization).
- No HTTP endpoint that can trigger a real deletion (see decision 4).
- No `deletion_runs` persistent log table (see decision 6).
- No independent code review or dedicated security review of this slice.
- No traceability-matrix/HANDOFF/phase-plan update.

## Testing plan (§34's Retention checklist)

Correct policy lookup by category key; an eligible record (age past the policy threshold, no
hold, no dependency); a not-yet-eligible record (age below threshold); a hold blocking deletion;
a released hold restoring eligibility; the seeded 7-year audit-retention value; the seeded
120-day failed-job value; the seeded 30-day notification value; the seeded 30-day soft-delete
value. Plus: `RetentionCleanupService.execute()` proven end-to-end against `_framework_probe` in
dry-run mode (no rows touched, correct counts) and execute mode (real soft-deletion of eligible
fixture rows only, hold-protected rows left untouched) in a real-database integration test.
RBAC enforcement (zero seeded grants, denied even for `super_admin`).
