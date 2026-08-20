# Business Knowledge Center — Backend (as-built)

**Status:** Built, fully validated, independently code-reviewed (9 of 10 findings fixed, 1 accepted
as tracked debt — see §8), not yet security-reviewed, gated, or merged. Branch
`module-business-knowledge-center`, off `main` at `621fed8`.

## 1. Why this exists, and what it isn't

Built directly on the explicit "start the business knowledge center now" instruction — the second
real business module built on the Phase 1F application shell / canonical module registry, after
Projects. See `docs/task-packages/module-business-knowledge-center.md` for the full scoping account
(pre-implementation verification, design decisions D1-D6, in/out-of-scope boundaries).

This is **backend only** — schema, API, RBAC wiring, tests. `dashboard-web` UI is a separate,
not-yet-requested next step, matching the Projects module's own backend-first precedent.

## 2. Key facts from scoping

- The canonical spec (`03_Detailed_Module_Specifications.md §3`) names 10 "primary records" and a
  5-value status vocabulary (`Mandatory | Advisory | Draft | Deprecated | Restricted`), but no
  field-level schema, no workflow doc, no wireframes exist for this module anywhere in the 7
  canonical documents.
- An advisory, reference-only roadmap note (`canonical-inputs/Recommended_Module_Roadmap.md:36`)
  proposed a Git-backed storage split not present in the canonical spec. Surfaced directly to the
  user (`AskUserQuestion`) rather than silently adopted; the user chose pure DB-backed CRUD, the
  same pattern as Projects, after confirming realistic storage sizing.
- The `business_knowledge` RBAC permission group and the `business_knowledge_center` module-registry
  row were both already fully seeded (Phase 1D-expanded / Phase 1F) — no new RBAC or registry
  migration needed for V1.

## 3. What exists

- **`packages/database/src/business-knowledge/`** — `entities.ts` (`BusinessKnowledgeRecordEntity`,
  `BusinessKnowledgeRecordType` — the 10 spec-named record types — and
  `BusinessKnowledgeRecordStatus`), `models.ts` (`getBusinessKnowledgeModels()`, memoized per
  connection, same pattern as `projects/models.ts`), `entity-mapping.ts` (local
  `toEntityWithIsoDates()` helper — every module in this package owns its own copy, no shared
  cross-module version exists by established precedent), `business-knowledge-record.repository.ts`
  (`create`/`findById`/`list` with `recordType`/`status` filters/`update` (content-only)/
  `updateStatus`), `index.ts` (barrel). Registered in **both** `packages/database/src/index.ts` and
  `index.cjs.ts` — the CommonJS barrel Vercel's Function bundler actually consumes in production,
  per this project's own standing caution (a missing export here caused a real production outage
  once before, 2026-08-12).
- **`packages/database/src/migrations/00047-create-business-knowledge-records.ts`** — one table,
  `business_knowledge_records`, no `project_id` column (org-wide, D3). Native Postgres `ENUM`s for
  `record_type` (10 values) and `status` (5 values); `created_by`/`updated_by` FK `users.id` with
  `ON DELETE SET NULL`; indexes on `record_type` and `status`.
- **`packages/database/src/migrations/00048-mark-business-knowledge-center-in-development.ts`** —
  updates the already-seeded `module_registry` row's `implementation_status` to `in_development`,
  same pattern as `00044-mark-projects-in-development.ts`.
- **`apps/dashboard-api/src/business-knowledge/`** — `business-knowledge.constants.ts` (DI token),
  `database.providers.ts`, `business-knowledge.dto.ts` (Zod schemas for list-query/create/update/
  status-change), `business-knowledge-records.service.ts`, `business-knowledge-records.controller.ts`,
  `business-knowledge.module.ts`. Registered in `apps/dashboard-api/src/app.module.ts`.

## 4. API surface

| Route                                         | Action    | Notes                                      |
| --------------------------------------------- | --------- | ------------------------------------------ |
| `GET /business-knowledge/records`             | `view`    | optional `?recordType=`/`?status=` filters |
| `GET /business-knowledge/records/:id`         | `view`    | 404 if missing                             |
| `POST /business-knowledge/records`            | `create`  | always starts `draft`                      |
| `POST /business-knowledge/records/:id/update` | `edit`    | title/content/notes only, never status     |
| `POST /business-knowledge/records/:id/status` | `approve` | the only way status ever changes           |

No `DELETE` route — matches ADR-0016's project-wide no-hard-delete policy; `deprecated` status is
the retirement mechanism.

## 5. The content-authoring vs. status-governance RBAC split (D4)

The RBAC matrix grants `marketing_editor` exactly `VCES` (view, create, edit, submit) and withholds
`R`/`A` (review, approve), while `owner_growth_approver`/`super_admin` hold the full set including
`A`. Content authoring (`create`/`update`) and status governance (`changeStatus`) are two separate
service methods gated on two separate actions (`create`/`edit` vs. `approve`) specifically so this
RBAC distinction is actually enforceable — a `marketing_editor` can draft and revise a record but
can never self-approve it into `mandatory`/`advisory`. Verified directly via e2e test: a
`marketing_editor` session gets `201`/`200` on create/update but `403` on the status route.

The status-transition graph (`ALLOWED_TRANSITIONS` in `business-knowledge-records.service.ts`) is a
proposed design choice, not spec-sourced (no workflow doc describes one) — `draft` is the entry
state for every new record, `deprecated` is terminal (mirroring `ProjectService`'s own
`archived`-is-terminal precedent), and `restricted` is treated as a reversible classification
overlay reachable from and back to either approved tier or draft. Flagged explicitly for the review
process to catch if the transition graph should be different.

Every status transition is audited via `AuditService.record()` — `eventType: "approval"` when
moving to `mandatory`/`advisory` (the genuinely approval-shaped transitions), `eventType:
"data_change"` for everything else (e.g. `→ deprecated`, `→ restricted`), `retentionCategory:
"audit-7y"`.

## 6. Known, out-of-scope gaps (flagged, not built)

- **Export** (`X` grant exists for `super_admin`/`owner_growth_approver`) — no format is specified
  anywhere (CSV/JSON/PDF unstated). Not built.
- **Module configuration** (`M` grant, `super_admin` only) — no configuration concept is described
  for this module anywhere. Not built.
- **A distinct "review" checkpoint** (`R` grant) — the 5-value status vocabulary has no "under
  review" state, and no workflow doc describes a review checkpoint. Not built; not silently absorbed
  into `approve` either.
- **`dashboard-web` UI** — separate, not-yet-requested next step.

## 7. Validation

- **11 new `dashboard-api` unit tests** (`business-knowledge-records.service.spec.ts`) — mocked
  repository, covering create/findById/list/update delegation, the `changeStatus` no-op/rejected-
  transition/allowed-transition/audit-event-type/disappeared-record paths.
- **7 new `packages/database` integration tests** (`module-business-knowledge.integration.test.ts`,
  real disposable Postgres) — create defaults to `draft`, `findById` hit/miss, `list()` filtering by
  `recordType` and `status`, `update()` never touches status, `update()`/`updateStatus()` miss
  paths, and a real DB-layer `ENUM` constraint rejection.
- **10 new `dashboard-api` e2e tests** (`business-knowledge.e2e-spec.ts`, real disposable Postgres,
  real seeded RBAC roles) — 401 with no session; `super_admin` full create/read/list/update path;
  `read_only` denied create (`403`) but allowed list; `marketing_editor` allowed create/update but
  denied the status route (`403`) — the core proof of D4's RBAC split; `super_admin` approving
  draft → mandatory; an invalid transition off a terminal `deprecated` status (`400`); a 404 for a
  nonexistent id; and `OriginCheckGuard` rejecting a mutating request with no `Origin` header.
- **Migration up/down round-trip** (`pnpm migrate:test`) clean — 48 migrations total, including the
  2 new ones.
- **Module-registry validation** (`pnpm validate:module-registry`) passes unchanged — 43 modules, 21
  permission groups, all references resolve (no new registry row added, only an existing row's
  `implementation_status` updated).
- Full re-validation: typecheck/lint clean on both `packages/database` and `apps/dashboard-api`;
  `pnpm audit --audit-level=high` — 0 vulnerabilities.
- One real lint/DI conflict found and fixed during the build: ESLint's `consistent-type-imports`
  autofix converted the controller's `BusinessKnowledgeRecordsService` import to `import type`,
  which would have broken NestJS's decorator-metadata-based constructor injection at runtime (no
  explicit `@Inject()` token is used for same-module service injection). Fixed with the same
  `eslint-disable-next-line` comment this codebase already uses for the identical, previously-hit
  case (`AuditService` injected into `RoadmapItemsService`).

## 8. Independent code review

This project's own `code-review` skill ran at high effort (8 finder angles, 1-vote verification)
against the full PR #43 diff. 12 candidates survived dedup; 1 (the `entity-mapping.ts`
"duplication" candidate) was REFUTED — verified against `projects/entity-mapping.ts`,
`audit/audit-event.repository.ts`, and 3 other modules that every module in this package
independently hand-rolls this exact helper, not a real deviation. 10 findings were reported
(9 CONFIRMED, 1 PLAUSIBLE); 2 lower-priority PLAUSIBLE reuse candidates (the `ALLOWED_TRANSITIONS`
shape resembling `ProjectService`'s own status-machine pattern, and the `record_type`/`status` enum
values being independently declared across `entities.ts`/`business-knowledge.dto.ts`) were dropped
under the 10-finding cap, both matching an already-accepted Projects-module precedent.

**All 9 CONFIRMED findings fixed** per the explicit "fix the confirmed findings" instruction:

1. **`restricted` status had no access enforcement** — `list()`/`findOne()`/`update()`/
   `changeStatus()` now resolve `AuthorizationService.canViewConfidential(userId, "business_knowledge")`
   and redact `content`/`notes` (never `title`/`status`/`recordType`) on any `restricted` record for
   a caller without that grant — mirroring `operational-contacts.controller.ts`'s own
   `CONFIDENTIAL_CONTACT_FIELDS`/`redactContact` pattern exactly. `view_confidential` is zero-seeded
   today (Phase 1D-expanded), so this currently redacts for every role, including `super_admin` —
   the same "no role holds it yet" state Operational Contacts' own PII fields already have.
2. **`create()`/`update()` were never audited** — both now call `AuditService.record()`
   (`eventType: "data_change"`, `action: "create"`/`"update"`), matching `ProjectService.create()`/
   `update()`'s own call shape. Only `changeStatus()` was ever audited before this fix.
3. **TOCTOU race in `changeStatus()`** — `BusinessKnowledgeRecordRepository.updateStatus()` is now
   an atomic compare-and-swap (`WHERE id = ? AND status = ?`), mirroring
   `IdempotencyKeyRepository.reserve()`'s own conditional-`UPDATE` pattern, returning a discriminated
   `UpdateStatusResult` (`"updated" | "not_found" | "conflict"`). The service now throws
   `ConflictException` (409) on the race-loser path instead of silently reporting false success.
4. **A malformed record id crashed with a raw 500 instead of a clean 404/400** — all three `:id`
   routes now apply `ParseUUIDPipe`, converting a malformed id into a `400` before it ever reaches
   the repository. This is the first use of `ParseUUIDPipe` anywhere in `apps/dashboard-api` — every
   other `:id` route in this codebase still has the identical latent gap; fixing it here doesn't fix
   it project-wide, deliberately scoped to this module's own PR.
5. **`list()` had no pagination cap** — added `DEFAULT_LIST_LIMIT` (50) / `MAX_LIST_LIMIT` (200)
   clamping, mirroring `ProjectRepository.list()`'s exact pattern; `limit`/`offset` are now accepted
   on `GET /business-knowledge/records` and threaded through the DTO/service/repository.
6. **`retentionCategory` was always `"audit-7y"` even for an approval-shaped transition** — now
   `"approval-audit-7y"` when `nextStatus` is `mandatory`/`advisory` (a real, already-seeded value in
   `AUDIT_RETENTION_CATEGORIES`, already used by `RecoveryService`/`RetentionHoldService`/
   `RoleAssignmentService`/`OperationalContactService`), `"audit-7y"` otherwise.
7. **The audit write was not transactional with the status write** — confirmed via research that
   `AuditService.record()` doesn't currently accept a `transaction` parameter, so true atomicity
   would mean extending `AuditService`'s own signature — a larger, cross-cutting change out of
   proportion for this fix pass, and this exact non-atomic ordering is already the accepted,
   shipped pattern in `ProjectService.changeStatus()`. The proportionate fix applied instead: the
   audit call is now wrapped in try/catch, logging a clear `console.error` if it fails after the
   status write already committed, so the gap is visible instead of silently swallowed.
8. **`ALLOWED_TRANSITIONS` was asymmetric** — `mandatory`/`advisory` could only reach `draft` via the
   `restricted` detour, while `restricted` could reach `draft` directly. Both now include `draft`
   directly, matching `restricted`'s own symmetry.
9. **The task package falsely claimed `packages/shared-types` additions were delivered** — §3/§9
   corrected to state explicitly that no shared-types changes exist in this backend-only pass,
   matching the Projects module's own precedent of deferring them to the UI-building slice.

**The 1 PLAUSIBLE finding was left unfixed, as accepted/tracked debt**: no invariant limits how many
`mandatory`/`advisory` records can exist per `record_type` simultaneously. Its own verifier
concluded the "correct" invariant is genuinely record-type-dependent — some types (`competitor`,
`persona_icp`) plausibly need many simultaneously-approved records, others (`company_profile`,
`vto`) plausibly want exactly one — and the canonical spec states no rule either way. Flagged here
explicitly for the human review process to weigh in on, rather than guessed at silently.

Re-validation after all fixes, against a fresh local disposable PostgreSQL 17 database: 14/14
`dashboard-api` unit tests (3 new: audit-on-create, audit-on-update, conflict/409, audit-failure
resilience — replacing the old 3-arg `updateStatus` assertions), 389/389 `dashboard-api` unit tests
overall; 11/11 `packages/database` integration tests (4 new: `not_found`/`conflict` split, the
oversized-limit clamp, and a real limit/offset pagination proof); 11/11 `dashboard-api` e2e tests
(2 new: the malformed-id 400, and the restricted-record redaction proof across `findOne`/`update`/
`changeStatus`/`list`); migration up/down round-trip clean (48 migrations); module-registry
validation unaffected (43 modules, 21 permission groups); typecheck/lint/prettier clean across both
packages; `pnpm audit --audit-level=high` — 0 vulnerabilities.

`ReportFindings` was called again with all 10 findings' `outcome` set (`fixed` ×9, `skipped` ×1 for
the accepted-debt PLAUSIBLE finding).

Not yet security-reviewed, gated, or merged — a security review, the required second-role human
review, a gate decision, and merge authorization are each their own separate, not-yet-requested
next step, unchanged from this project's standing discipline.
