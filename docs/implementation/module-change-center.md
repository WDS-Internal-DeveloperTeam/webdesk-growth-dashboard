# Module: Change Center

Module #33 on the Recommended Module Roadmap. Its one real dependency is Scan Center
(`scan_center`), already live in production.

## Scope

Not started automatically — built directly on the "build the Change Center module backend"
instruction. Follows the 2026-08-27 standing rule collapsing the task-package + implementation-doc
pair into one file: this `## Scope` section was written before any code, the `## As-built` section
below was appended after the build finished.

### Table: `change_records`

A single table, project-scoped (`project_id`), tracking theme/plugin/core/database/integration/
SEO/analytics/security/accessibility/performance/redirect/asset change records through a real
accept/reject/merge/defer/apply/verify workflow (`05_Workflow_State_Machines.md §8`). Mirrors Scan
Center's own structural conventions closely (the two closest templates for this module are Scan
Center and Internal Linking Library).

Fields:

- `id`, `project_id` (FK → `projects`, `RESTRICT`), `public_id` (globally unique, never
  regenerated)
- `category` — a 14-value closed enum taken from the spec's own category list
- `severity` — reuses Scan Center's own `ScanFindingSeverity` value set
  (`critical`/`high`/`medium`/`low`/`info`) for consistency
- `status` — the 10-value bespoke workflow below, default `detected`
- `scan_finding_id` — nullable FK → `scan_findings` (`SET NULL`) — the real "source" link when a
  change was detected by a scan; `null` for a manually-created record
- `source` — free text, no canonical value list
- `target_module_key` / `target_id` — an optional polymorphic reference, mirroring Review and
  Approval Center's own `(targetModuleKey, targetId)` pattern exactly. Both columns are always
  either both null or both non-null (enforced at the DTO/service layer, not a DB CHECK). `target_id`
  is deliberately NOT a real foreign key (no single table it could reference) and its existence is
  NOT checked — mirrors Review and Approval Center's own restraint (no generic cross-module lookup
  capability exists). Only `target_module_key` is validated, via
  `AuthorizationService.isValidModuleKey()`.
- `record_label` — required, always present regardless of whether a polymorphic target exists —
  what renders in the Change Center list/table
- `before_value` / `after_value` — plain text, not HTML, not sanitized (raw detected/proposed data)
- `confidence` — nullable 0–100 integer, range enforced at the DTO layer
- `recommendation` — free text
- `assigned_to_user_id` — nullable FK → `users` (`SET NULL`), existence-validated via
  `UsersService.assertUserExists()`
- `decision_notes` — free text, settable on any status transition
- `decided_by_user_id` / `decided_at`, `applied_by_user_id` / `applied_at`,
  `verified_by_user_id` / `verified_at` — server-stamped only, by `ChangeRecordRepository.updateStatus()`
- `rollback_guidance` — settable only as part of a transition INTO `apply_failed`, rejected with a
  clean 400 when paired with any other target status
- `created_by` / `updated_by`, `created_at` / `updated_at`

Indexes: `project_id`, `scan_finding_id`, `(project_id, status)`, `(project_id, category)`, a
`pg_trgm` GIN trigram index on `record_label` for fuzzy search, and a unique index on `public_id`.

### Workflow

```
detected -> under_review
under_review -> accepted | rejected | deferred | manual_merge_required
manual_merge_required -> accepted | rejected | deferred
deferred -> under_review
accepted -> applying
applying -> applied | apply_failed
apply_failed -> applying
applied -> verified
```

`verified` and `rejected` are terminal.

### RBAC

Reuses the already-seeded `change_center` RBAC group verbatim (no new RBAC migration) —
`06_Roles_and_Permissions.md`/`00013-seed-rbac-matrix.ts:226-234`. The group's five actions are
`view`/`create`/`edit`/`review`/`approve` (V/C/E/R/A — no `submit`/`publish`/`configure`/`export`
letters). `super_admin`/`owner_growth_approver` hold all five (`VCERA`); `marketing_editor`/
`designer_creative_reviewer`/`developer`/`qa_security_reviewer` hold only `VRA` (no `create`/
`edit` — mirrors Review and Approval Center's own "only two roles can create" shape);
`read_only` holds only `view`.

Action mapping: `create` gates the create route; `edit` gates in-place content edits
(`record_label`/notes/assignment) while the record is still `detected`/`under_review` — locked once
a real decision or apply/verify step has started; `review` gates every review/decision transition
(starting review, and every disposition out of `under_review`/`manual_merge_required`/`deferred`);
`approve` gates the entire apply+verify tail (`accepted -> applying -> applied/apply_failed -> ... ->
verified`) — there is no separate seeded "apply"/"verify" letter, so both halves share the one
grant, gated only on `view` at the route level, checked dynamically inside the service.

The `assigned_to_user_id`-based `assignedToMe` list filter is a pure app-level convenience, NOT
real object-level access control — matches this codebase's own already-established precedent
(Review and Approval Center's own identical `assignedToMe` filter; a role's "(assigned)" qualifier
in the matrix is a blanket role grant, not per-object enforcement).

No confidentiality mechanism — the module registry's own seeded `confidentialityLevel` for
`change_center` is `null`. No hard delete (ADR-0016).

### Design decision made on the fly, flagged explicitly

**`updateStatus()`'s actor-id stamping does NOT use the `COALESCE(column, NOW())` "stamp once,
never overwrite" literal pattern** that `InternalLinkRepository.updateStatus()`/
`ScanRunRepository.updateStatus()` both use for their own timestamp columns. That pattern needs
`literal()` with raw SQL text baked in, and this module's three actor-id columns
(`decided_by_user_id`/`applied_by_user_id`/`verified_by_user_id`) have no safe way to reach a
`literal()` call without string-interpolating `actorUserId` directly into raw SQL — no other
`COALESCE` use in this codebase interpolates anything but the fixed literal `NOW()`. `actorUserId`
is always a real, session-authenticated user id (never raw user input), so the practical injection
risk is low, but avoiding hand-built SQL entirely is safer and simpler than relying on that trust
boundary holding forever. Instead, `decided_by_user_id`/`decided_at`, `applied_by_user_id`/
`applied_at`, and `verified_by_user_id`/`verified_at` are all set as plain, Sequelize-parameterized
values, re-stamped on every entry into their target status rather than only the first — arguably
more correct for a workflow with real retries (`apply_failed -> applying -> applied`) and real
re-decisions (`deferred -> under_review -> accepted`), where the most recent actor/time is the
meaningful one. Flagged for review since it deviates from the two closest sibling repositories'
own literal `COALESCE` shape.

## As-built

Built directly, no delegation. Files touched:

- `packages/database/src/migrations/00105-create-change-center.ts`,
  `00106-mark-change-center-in-development.ts`
- `packages/database/src/change-center/{entities,models,entity-mapping,change-record.repository,index}.ts`
- `packages/database/src/index.ts`, `packages/database/src/index.cjs.ts` (both barrel exports
  updated — this project's own documented production-outage caution)
- `apps/dashboard-api/src/change-center/{change-center.constants,change-center.dto,database.providers,change-records.service,change-records.controller,change-center.module}.ts`
- `apps/dashboard-api/src/change-center/change-records.service.spec.ts` (22 unit tests)
- `apps/dashboard-api/src/app.module.ts` (wired `ChangeCenterModule`)
- `packages/database/test/module-change-center.integration.test.ts` (14 tests, real disposable
  PostgreSQL 17)
- `apps/dashboard-api/test/change-center.e2e-spec.ts` (16 tests, real disposable database + real
  seeded RBAC)

### Validation (all run for real against a local disposable PostgreSQL 17 database,

`webdesk_phase1b_dev`, `admin` role, `DATABASE_SSL=false`)

- `pnpm --filter @webdesk/database exec tsc --noEmit` — clean
- `pnpm --filter dashboard-api exec tsc --noEmit` — clean
- Migration round-trip: `up` → `down` (x2, to isolate this module's own two migrations) → `up` —
  clean, 106 migrations executed, 0 pending
- `pnpm --filter @webdesk/database test` — 6 files, 28 tests passing (unaffected)
- `pnpm --filter @webdesk/database test:integration` — 41 files, 813 tests passing, including the
  new 14-test Change Center integration file
- `pnpm --filter dashboard-api test` — 99 files, 1713 tests passing, including the new 22-test
  `ChangeRecordsService` unit spec
- `pnpm --filter dashboard-api test:integration test/change-center.e2e-spec.ts` — 16/16 passing
- `node dist/validate-module-registry.js` — 43 modules, 21 permission groups, all references
  resolve (unaffected)
- `pnpm exec eslint ... --max-warnings=0` on every touched file — clean
- `pnpm exec prettier --check` on every touched file — clean
- `pnpm audit` — 0 vulnerabilities (no new dependency added by this module)

Two real bugs were found and fixed during this module's own build, before any external review:

1. The `updateStatus()` repository method originally used `literal()` with `actorUserId`
   string-interpolated directly into raw SQL for the `COALESCE(...)` actor-id stamping — caught by
   inspection before committing, not by a test. Fixed as described in the Scope section's own
   "Design decision made on the fly" note above (switched to plain parameterized values).
2. The first draft of the e2e test's own `transition()` helper was declared `async`, so it returned
   a `Promise` instead of the chainable `supertest` `Test` object — every `.expect(...)` chained
   call site failed with `TypeError: transition(...).expect is not a function`. Fixed by making the
   helper a plain (non-`async`) function, matching `createDetectedRecord()`'s own working shape.
3. The e2e test's polymorphic-target tests originally used `targetModuleKey: "business_knowledge"`
   — the real seeded module key is `business_knowledge_center` (`00035-populate-module-registry-fields.ts:107`).
   Fixed by correcting the literal in the test.

### Independent code review

Run at high effort — 8 finder angles, 1-vote verification. 6 findings kept in the final report (5
CONFIRMED, 1 PLAUSIBLE), all fixed:

1. **Most severe.** `updateStatus()`'s "deliberate deviation" rationale for abandoning
   `COALESCE(column, NOW())` "stamp once" semantics was itself wrong — the doc comment claimed
   there was no safe way to reach a `literal()` call without string-interpolating `actorUserId`
   directly into raw SQL, but Sequelize's `fn("COALESCE", col(...), actorUserId)` binds the value
   as a real, parameterized query argument, never string-built SQL. Fixed by adopting `fn`/`col`
   for `decidedByUserId`/`appliedByUserId`/`verifiedByUserId` (paired with a real
   `COALESCE("column", NOW())` `literal()` for the timestamp half, matching
   `InternalLinkRepository.updateStatus()`'s own precedent) — restoring genuine stamp-once
   semantics, so a retry (`apply_failed -> applying -> applied`) or a re-decision
   (`deferred -> under_review -> accepted`) now preserves the ORIGINAL actor/time rather than
   silently overwriting it, matching `ChangeRecordEntity`'s own documented contract (which had been
   contradicted by the pre-fix implementation). Verified empirically, not just by inspection: a new
   integration test drives a record through two independent re-entries (a decision re-entered via
   `deferred`, an apply re-entered via `apply_failed`) with a different actor each time, and asserts
   the original actor/timestamp survived both.
2. `create()`'s and `update()`'s post-write `AuditService.record()` calls had no `try/catch`,
   unlike `changeStatus()`'s identical call, which is deliberately wrapped so a transient
   audit-write failure doesn't turn an already-committed DB write into an opaque 500. Fixed by
   wrapping both in the identical try/catch + `console.error` pattern; two new unit tests prove the
   create/update call still returns the real record when the audit call rejects.
3. `rollbackGuidance` could never be cleared through the API once set — the status-change DTO
   rejects any non-`undefined` `rollbackGuidance` value paired with a target status other than
   `apply_failed`, so a record recovering via `apply_failed -> applying -> applied -> verified` kept
   stale rollback instructions forever. Fixed in the repository's `updateStatus()`: leaving
   `apply_failed` for any other status without a fresh `rollbackGuidance` value now clears it to
   `null` automatically. A new integration test proves the field is `null` both immediately after
   the retry transition and after the record goes on to reach `applied`.
4. `severity` is a real, editable column per the repository's own `ChangeRecordUpdateFields` type
   (derived via `Omit<ChangeRecordContentFields, "publicId" | "projectId" | "category">` — severity
   isn't excluded), but `updateChangeRecordSchema` never exposed it, with no documented rationale
   unlike `category`/`publicId`'s deliberate create-only immutability. Fixed by adding it to the
   update DTO (a triager correcting an initial miscategorization now has a real API path); a new
   unit test proves it flows through to the repository call.
5. No index covered `assigned_to_user_id`, despite `assignedToMe`/`assignedToUserId` being a
   first-class, documented list filter (mirroring Review and Approval Center's own "my queue"
   concept). Fixed by adding a `(project_id, assigned_to_user_id)` composite index to migration
   `00105` (not yet deployed anywhere, so amended in place rather than via a new migration).
6. **PLAUSIBLE, fixed as part of the same pass.** `changeStatus()`'s
   `rollbackGuidance: nextStatus === "apply_failed" ? body.rollbackGuidance : undefined` ternary
   was redundant given the DTO's own `superRefine` already guarantees `rollbackGuidance` is
   `undefined` whenever `status` isn't `apply_failed` — inconsistent with the adjacent
   `decisionNotes: body.decisionNotes` pass-through one line below, which trusts the identical
   class of DTO guarantee directly. Simplified to a direct pass-through, now that finding #3's fix
   moved the actual clearing logic into the repository layer where it belongs.

Re-validated after the fix round, all against the same real disposable database: 815/815
`packages/database` integration tests (2 new), 1716/1716 `dashboard-api` unit tests (3 new),
804/804 `dashboard-api` e2e/integration tests (unchanged, confirming no regression), a fresh
migration round-trip (106 executed, 0 pending, with the new index present), module-registry
validation unaffected (43 modules, 21 permission groups), `eslint --max-warnings=0`/
`prettier --check` clean, `pnpm audit` 0 vulnerabilities.

### Not done in this pass

No `dashboard-web` UI exists yet for this module — a separate, not-yet-requested next step,
matching every prior module's own backend-first precedent. No push to `origin`, no PR opened, no
security review run, no gate requested, no merge — each remains a separate, not-yet-requested next
step, matching this project's standing "no auto-merge" discipline.
