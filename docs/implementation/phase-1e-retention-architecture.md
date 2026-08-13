# Phase 1E — Retention Architecture (as-built)

**Status:** Describes what is actually built, not an aspirational design — every claim below is
backed by real source files, real migrations, and real-database/e2e tests referenced inline.
Covers brief §19–§23 plus the retention-specific portions of §26/§28/§29/§34. See
`docs/task-packages/phase-1e-retention-architecture.md` for the design decisions and their
rationale.

## 1. Schema (migrations `00019`–`00021`)

- **`retention_policies`** (`00019`, seeded by `00020`) — 25 rows, one per §20's approved
  category: `category_key` (unique), `display_name`, `retention_value`/`retention_unit` (real
  ENUM: `days`/`years`), `anchor` (descriptive — what the retention clock starts from, e.g.
  `finished_at` for jobs, `closed_at` for security findings), `description`,
  `applies_to_entity_type` (informational, unconstrained). Three category keys —
  `audit-7y`, `approval-audit-7y`, `security-log-1y` — intentionally match the literal
  `retention_category` strings `AuditService` has written onto `audit_events` since the original
  audit-foundation slice; this table is now the single source of truth those strings trace back
  to.
- **`retention_holds`** (`00021`) — generic, polymorphic: `scope` (real ENUM, `entity`/
  `category`), `resource_type`/`resource_id` (unconstrained, entity-scoped holds) or
  `category_key` (a real FK into `retention_policies`, category-scoped holds), `reason_category`,
  `reason`, `created_by_user_id` (FK → `users`), `approved_by_user_id`, `start_date`/`end_date`,
  `status` (real ENUM, `active`/`released`), `release_reason`, `released_by_user_id`,
  `released_at`. A real database CHECK constraint (`retention_holds_scope_shape`) enforces that an
  entity-scoped hold always has `resource_type`+`resource_id` and a category-scoped hold always
  has `category_key` — proven by a dedicated integration test issuing a raw `INSERT` that violates
  it.

## 2. Eligibility (§22 steps 1–5)

`RetentionEligibilityService.evaluate()`: look up the policy by category key → compute age from
the caller-supplied anchor date against the policy's threshold (years converted to days,
`value × 365`) → check for an active hold (entity-scoped first, then category-scoped) → check the
caller-supplied `hasActiveDependency` flag → return a decision with one of five reason codes
(`policy_not_found`/`not_yet_eligible`/`active_hold`/`active_dependency`/`eligible`). A generic
cross-table dependency check has no meaning without knowing what depends on what, so that check is
deliberately caller-supplied, not computed here.

## 3. Legal/retention holds (§21)

`RetentionHoldService.createHold()` validates the scope/shape match before writing (entity needs
both `resourceType`+`resourceId`; category needs `categoryKey`) and records a
`retention_hold_created` audit event. `releaseHold()` requires a non-empty `releaseReason` —
enforced at **two** layers: the service (`BadRequestException` on empty/missing) and the
repository (`RetentionHoldRepository.release()`'s own signature has no path that omits it) — so
"do not silently release a hold" has no code path around it, not just a validation the service
happens to add. Every release also records a `retention_hold_released` audit event.

## 4. Cleanup/deletion foundation (§22 steps 6–9)

`RetentionCleanupService.run(candidates, mode, executedByUserId, deleter?)`:

- `dry_run` — evaluates every candidate via `RetentionEligibilityService`, tallies
  eligible/ineligible counts, touches no data.
- `execute` — same evaluation, then calls `deleter.softDelete(candidate)` for each eligible
  candidate. Requires a `RetentionRecordDeleter` — throws if omitted.
- Every run records a `retention_run` audit event (the pre-existing event type from the original
  audit contract — its first real use) with the mode and counts in `after_state`.

**No `RetentionRecordDeleter` is ever DI-wired into `RetentionModule`** — the interface exists,
but the only implementation anywhere in this codebase lives in
`apps/dashboard-api/test/retention-cleanup.e2e-spec.ts`, targeting `_framework_probe` (the same
test-only table Phase 1B's own database foundation established for exactly this "prove the
mechanism, touch nothing real" purpose). That test proves the full 9-step process end-to-end
against a real disposable database: dry-run counts are correct and nothing is touched; execute
mode soft-deletes only the eligible row; an active hold blocks deletion even for an otherwise-
eligible row; releasing the hold restores eligibility and the row is then deleted. No HTTP route
in this slice can reach `RetentionCleanupService` at all — `RetentionController` deliberately has
no cleanup/execute endpoint.

## 5. RBAC integration (§29)

Reuses `system_settings` (every other Phase 1E permission addition has reused it too) with the
exact three action names §29 itself gives: `retention_view`, `retention_configure`,
`retention_hold`. **Zero `role_permissions` rows seeded.** Confirmed by
`test/retention.e2e-spec.ts`: a real `super_admin` session is denied 403 on
list-policies/create-hold/check-eligibility.

## 6. HTTP surface (§28)

`RetentionController` — `GET /retention/policies`, `GET /retention/holds`,
`POST /retention/holds`, `POST /retention/holds/:id/release`, `POST /retention/eligibility`
(read-only — evaluates but never deletes). No cleanup-execute route, by design (§4 above).

## 7. Soft deletion (§23) — no new work needed

Soft deletion already exists from Phase 1B: `SequelizeRepository.softDelete()`,
`BaseEntity.deletedAt`, Sequelize `paranoid` mode — available to any future business entity. This
slice adds nothing new here. `jobs` and `notifications` deliberately have no `deleted_at` column
(operational records, not "approved business records" in §23's sense); `audit_events` deliberately
still has none (append-only, immutable — §23's own instruction).

## 8. What this slice does NOT include

- No real deletion job wired to Vercel Cron/Workflows (§33 — separate, later authorization).
- No HTTP endpoint that can trigger a real deletion.
- No `deletion_runs` persistent log table — the `retention_run` audit event's `after_state` and
  `CleanupRunResult`'s return value are the record in this slice.
- No independent code review or dedicated security review of this slice.
- No traceability-matrix/HANDOFF/phase-plan update.

## 9. Test coverage

`packages/database/test/phase1e-retention.integration.test.ts` (real disposable database, 9
tests): all 25 seeded categories present; the real approved 7-year audit, 120-day failed-job, and
two 30-day (notification, soft-delete) values; entity- and category-scoped hold creation and
active-lookup; release requiring and storing a real reason; the scope-shape CHECK constraint
rejected at the database layer.

`apps/dashboard-api/src/retention/*.spec.ts` (18 unit tests): `RetentionEligibilityService` (all
five reason codes, including correct years→days conversion); `RetentionHoldService` (creation
validation, audit attribution, release guards — missing reason, not-found, already-released);
`RetentionCleanupService` (dry-run vs. execute, deleter-required guard, audit event with real
counts).

`apps/dashboard-api/test/retention.e2e-spec.ts` (4 tests) and
`apps/dashboard-api/test/retention-cleanup.e2e-spec.ts` (3 tests, both real disposable database):
401/403 deny-by-default proof, and the full 9-step cleanup proof against `_framework_probe`
(dry-run counts, execute-mode soft-deletion, hold-blocks-then-release-restores-eligibility).

Full validation run (this slice): typecheck/lint clean across all 9 workspace packages, 19/19 +
57/57 `packages/database` tests (unit + integration, including a full migration `00001`→`00021`
up/down round-trip), 167/167 + 46/46 `dashboard-api` tests (unit + e2e), `pnpm audit` 0
vulnerabilities, prettier clean.
