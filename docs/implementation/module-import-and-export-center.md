# Import and Export Center (module #34, key `import_and_export_center`)

## Scope

Built directly on the explicit "Start Import/Export Center" instruction — module #33/#34 on the
Recommended Module Roadmap (Wave 1, no dependencies per the module registry's own seeded `null`
`dependencies` value).

The canonical spec (`03_Detailed_Module_Specifications.md §34`) gives only:
"versioned schemas, template versions, dry-run preview, row-level errors, duplicate policy,
idempotency, file limits, partial success rules, rollback limitations, history, permissions."
`04_Data_Model_and_Ownership.md`'s "Imports and exports" section names five real tables:
`import_templates`, `import_runs`, `import_rows`, `import_errors`, `export_runs`, with
"Idempotency: source file checksum, template version, and row external ID."

Two genuine design forks were confirmed directly with the user first (`AskUserQuestion`):

1. **Build scope: record-keeping mechanism only, no real engine.** No generic bulk file-parsing
   or write-to-target-table infrastructure exists anywhere in this codebase. Matches the precedent
   already set by Scan Center (no scanner) and Ready for Claude Queue (no execution runtime) — a
   real data model, workflow, RBAC, and API surface for tracking templates/runs/rows/errors, with
   no actual file upload/parsing/target-table writer behind it yet. A future real importer/exporter
   consumes this same schema; it is not built here.
2. **Scope: organization-wide**, matching Business Knowledge Center/Service Library/Persona
   Library — an import template ("Keyword CSV v2") is reused across many projects' data, not tied
   to one project. `import_runs`/`export_runs` are likewise organization-wide (no `project_id`
   column on any of the five tables). `target_module_key` on both `import_templates` and
   `export_runs` names WHICH business module's data is being imported/exported into/from —
   validated against the real module registry via the already-existing
   `AuthorizationService.isValidModuleKey()` (the same narrow delegating method Review and Approval
   Center already established for its own polymorphic `targetModuleKey`), not a foreign key (the
   module registry is a lookup table, not a data table this module writes into).

### RBAC — two distinct groups, both already seeded, no new RBAC migration

The module registry's own seed comment (`00015-seed-module-registry.ts:113-117`) is explicit:
"Source module #34 covers both import and export; kept as ONE registry row... Gated here by
`imports` as its primary permission group — export-specific checks... must reference the
`exports` permission group directly." `import_templates`/`import_runs`/`import_rows`/
`import_errors` are gated on the real seeded `imports` group; `export_runs` is gated on the real
seeded, separate `exports` group.

`imports` matrix (`00013-seed-rbac-matrix.ts:235-242`): `super_admin`/`owner_growth_approver` hold
`VCERAX`; the four mid-tier roles (`marketing_editor`/`designer_creative_reviewer`/`developer`/
`qa_security_reviewer`) hold `VCSEX`; `read_only` holds `V`. Decoded: view, create, edit, submit,
review, approve, export. Unlike Scan Center's `scans` group (no submit/review/approve letters at
all), `imports` has a real two-tier separation: mid-tier roles can create/submit; only
`super_admin`/`owner_growth_approver` can review/approve — mirrors the submit/review/approve
dynamic-per-transition pattern already established by Service Library/Persona Library/Website
Strategy Center, not Scan Center's uniform-`edit` pattern. The seeded matrix has no `configure`/M
action for either group — none is fabricated here. The `imports` group's `X` (export) letter is
left deliberately unwired in this pass (no route currently requires it) — matches the established
precedent of leaving a genuinely unused seeded action unwired (Scan Center's own `configure`/M).

`exports` matrix (`00013-seed-rbac-matrix.ts:244-252`): every role holds `VX` (view, export);
`read_only` holds `V`. No `create` letter — creating an export run IS the `export` action, mirrors
`imports`' own `X` semantics for exactly this reason.

Both modules' own doc comments flag `(assigned)` qualifiers (object-level "only records assigned
to me" scoping) as explicitly NOT encoded — that remains a future feature's own responsibility,
matching Review Center's/Change Center's own already-accepted precedent.

### Confidentiality

The module registry's own seeded `confidentialityLevel` for `import_and_export_center` is
`"export excludes confidential fields unless separately authorized"` — not `null`. This module
has no confidential BUSINESS fields of its own to redact (it stores metadata about import/export
operations, not the underlying business records). The constraint instead shapes `export_runs`:
`excludesConfidentialFields` is a real, non-nullable boolean column, always `true` at creation
(not a caller-settable field on the create DTO) — there is no mechanism anywhere in this codebase
today that would let an export actually include a confidential field, so nothing here claims
otherwise. A future, separately-authorized capability to set it `false` is out of scope.

### Schema (migration, five tables)

- **`import_templates`** — `id`, `public_id` (unique), `name`, `target_module_key` (validated
  against the real module registry, not a FK), `column_mapping` (JSONB — source-column → target-
  field pairs; free-form, no schema imposed since the target module's own field shape varies),
  `duplicate_strategy_default` (enum: `skip` / `overwrite` / `create_new`), `file_format` (enum:
  `csv` / `xlsx` / `json`), `version` (server-managed integer, atomically incremented on every
  update via a `literal("version + 1")` write — mirrors Persona Library's own `version` handling,
  `returning: true`, no read-then-write race), `is_active` (boolean, default `true`),
  `created_by`/`updated_by` (nullable FK → `users`, `SET NULL`), timestamps.
- **`import_runs`** — `id`, `public_id` (unique), `import_template_id` (FK → `import_templates`,
  `RESTRICT`), `template_version` (integer, a snapshot of the template's `version` at run-creation
  time — NOT a live join, since a template can be edited after a run references it and the run
  must record what version it actually validated against), `is_dry_run` (boolean),
  `duplicate_strategy` (enum, nullable — falls back to the template's own
  `duplicate_strategy_default` when omitted), `source_file_reference` (text, nullable — plain,
  NOT URL-validated, mirroring `ScanDefinition.target`'s own precedent: no file-storage
  infrastructure is wired to this module, so this is an opaque caller-supplied identifier, not
  necessarily a URL), `source_checksum` (text, nullable — a SHA-256 or similar, the idempotency
  material the spec names), `status` (a real bespoke workflow, below), `total_rows`/
  `success_count`/`error_count`/`skipped_count` (integers, default `0` — **server-computed** via a
  `GROUP BY` count over `import_rows` after each bulk row-insert, never trusted from caller input),
  `error_summary` (text, nullable), `rollback_notes` (text, nullable — captures why/how a rollback
  happened; no real reversal logic exists, matching the "record-keeping only" scope — this column
  exists so the record of a rollback decision isn't lost, not to claim an automated undo happened),
  `started_at`/`completed_at` (server-stamped only, atomic `COALESCE` writes exactly mirroring
  `ScanRunRepository.updateStatus()`), `requested_by` (nullable FK → `users`, `SET NULL`),
  timestamps.
- **`import_rows`** — `id`, `import_run_id` (FK → `import_runs`, `RESTRICT`), `row_number`
  (integer), `external_id` (text, nullable — the row's own natural identifier from the source
  data; the row-level half of the idempotency triple the spec names), `raw_data` (JSONB, nullable
  — the row's source values as submitted), `status` (enum: `pending` / `valid` / `invalid` /
  `imported` / `skipped` / `failed`), `resolution` (enum, nullable: `created` / `overwritten` /
  `skipped_duplicate` — which duplicate-policy outcome actually applied to this row, only set once
  a row is processed). No `public_id` — a row is identified by `(import_run_id, row_number)` or
  its own `id`, matching the "no public identity" precedent for the deepest sub-resource in a
  pipeline (`claim_sources`, `case_study_assets`), not `scan_findings`' own choice to give a
  bulk-created child a `public_id`. Timestamps.
- **`import_errors`** — `id`, `import_run_id` (FK → `import_runs`, `RESTRICT`), `import_row_id`
  (FK → `import_rows`, `RESTRICT`, **nullable** — a run-level error, e.g. "file not found" or "file
  exceeds the configured size limit," has no specific row), `error_code` (text, nullable),
  `message` (text), `field_name` (text, nullable — which mapped column/field the error concerns,
  when row-specific). Timestamps, no `updated_at` needed (append-only, never edited).
- **`export_runs`** — `id`, `public_id` (unique), `target_module_key` (validated against the
  module registry, same mechanism as `import_templates`), `filter_criteria` (JSONB, nullable — an
  opaque caller-supplied filter description; no schema imposed, mirrors `column_mapping`'s own
  reasoning), `format` (enum: `csv` / `xlsx` / `json`), `status` (a simple 5-state workflow,
  below), `row_count` (integer, nullable), `file_reference` (text, nullable — plain, unvalidated,
  same reasoning as `import_runs.source_file_reference`), `excludes_confidential_fields` (boolean,
  NOT NULL, always `true` at creation — see "Confidentiality" above), `error_summary` (text,
  nullable), `started_at`/`completed_at` (server-stamped, same atomic pattern), `requested_by`
  (nullable FK → `users`, `SET NULL`), timestamps.

None of the five tables ever support a hard delete (ADR-0016) — only status transitions.

### Workflow — `import_runs.status`

A real two-tier submit/review/approve gate BEFORE any mechanical validation/execution — sourced
directly from the `imports` RBAC matrix's own real V/C/E/S/R/A/X letter set (mid-tier holds
create/submit; only `super_admin`/`owner_growth_approver` hold review/approve), the same
dynamic-per-transition-action pattern Service Library/Persona Library/Website Strategy Center
already established, NOT Scan Center's uniform-`edit` pattern (whose `scans` RBAC group has no
S/R/A letters to split on).

```
draft --submit--> submitted
draft --edit-->    cancelled
submitted --review--> rejected            (terminal)
submitted --approve--> approved
approved --edit--> validating
validating --edit--> dry_run_completed    (only when is_dry_run = true)
validating --edit--> importing            (only when is_dry_run = false)
validating --edit--> failed
dry_run_completed --edit--> importing     ("promote" a dry run into a real import)
importing --edit--> completed
importing --edit--> partially_completed
importing --edit--> failed
{draft, submitted, approved, validating, importing} --edit--> cancelled
{completed, partially_completed} --approve--> rolled_back   (terminal; approve-gated —
    a rollback DECISION is significant enough to require the same tier that approves the import
    itself; `rollback_notes` records the human account of what was actually reversed, since no
    automated reversal exists)
```

Every terminal state (`rejected`, `failed`, `cancelled`, `completed`, `partially_completed` once
rolled back, `rolled_back`) has no further outbound edge except the two explicit rollback edges
above. `completed`/`partially_completed` themselves stay open to the rollback edge only — no other
outbound edge. Same-status no-op short-circuits before the transition-table/action check, matching
the accepted, tracked-debt pattern already established by `InternalLinksService.changeStatus()`
and repeated by every module since (`ScanRunsService`, `ChangeRecordsService`, etc.) — not a new
deviation introduced here.

**Row/error submission**: rows (and any run-level errors) are submitted in the body of the
`validating -> dry_run_completed` or `validating -> importing` transition, mirroring
`ScanRunsService.changeStatus()`'s own `body.findings` bulk-create-on-transition pattern exactly —
NOT a standalone create route for `import_rows`/`import_errors`. After the bulk insert,
`total_rows`/`success_count`/`error_count`/`skipped_count` on the run are recomputed via a real
`GROUP BY status, COUNT(*)` query over `import_rows` (a new `ImportRowRepository.countByStatus()`
method) — never trusted from client-supplied numbers.

### Workflow — `export_runs.status`

Simple, no approval gate (the `exports` RBAC group has no S/R/A letters — `export` itself already
functions as the create-gate). All mutating actions (create AND every status transition) require
the `export` action, mirroring `imports`' own `X`-as-create-gate reasoning and Scan Center's own
uniform-single-letter-for-every-mutation precedent where a group has no richer letter set to split
on.

```
requested --export--> processing --export--> completed | failed | cancelled
requested --export--> cancelled
```

### What is explicitly NOT built (record-keeping only, matching the confirmed scope)

- No file upload endpoint, no CSV/XLSX/JSON parser, no schema-mapping engine, no actual write into
  any target module's own table, no real duplicate-detection query, no real rollback/reversal
  execution. Every one of these is a real, separate, not-yet-authorized future capability that
  would consume this same schema.
- No Vercel Blob wiring — `source_file_reference`/`file_reference` are opaque text, matching this
  project's own standing note that no Blob store is provisioned in this environment.
- No `dashboard-web` UI — backend only, matching every prior module's own backend-first precedent.

## As-built

Built directly on this scope doc, mirroring Scan Center's file-layout/CAS-repository pattern and
Review and Approval Center's/Change Center's org-wide, dynamic-per-transition-action controller
pattern. On branch `module-import-and-export-center` (already checked out; not pushed, not opened
as a PR, not committed).

### Files created

`packages/database`:

- `src/migrations/00107-create-import-and-export-center.ts` — all five tables, indexes (unique
  `public_id` on `import_templates`/`import_runs`/`export_runs`; `(updated_at, id)` on those same
  three; a `pg_trgm` GIN index on `import_templates.name`; FK indexes on every FK column;
  `(import_run_id, row_number)` and `(import_run_id, status)` on `import_rows`; `status`/
  `target_module_key`/`is_active` indexes where useful), a real `down()` dropping all five tables
  and every auto-created ENUM type.
- `src/migrations/00108-mark-import-and-export-center-in-development.ts` — mirrors
  `00106-mark-change-center-in-development.ts` exactly.
- `src/import-and-export-center/entities.ts`, `models.ts`, `entity-mapping.ts`,
  `import-template.repository.ts`, `import-run.repository.ts`, `import-row.repository.ts`,
  `import-error.repository.ts`, `export-run.repository.ts`, `index.ts`.
- `src/index.ts`/`src/index.cjs.ts` — both barrels updated (this project's own documented
  production-outage lesson about the separately-maintained CJS build).

`apps/dashboard-api/src/import-and-export-center/`:

- `import-and-export-center.constants.ts` (DI tokens, `IMPORTS_MODULE_KEY`/`EXPORTS_MODULE_KEY`
  with the full RBAC-letter-set doc comment), `database.providers.ts`,
  `import-and-export-center.dto.ts` (all Zod schemas), `import-and-export-center.module.ts`.
- Five services: `import-templates.service.ts`, `import-runs.service.ts` (the `TRANSITIONS` table
  with per-transition required action, the `is_dry_run` branch validation, the
  rollbackNotes-only-on-rolled_back guard, the rows/runErrors-only-on-{dry_run_completed,importing}
  guard, bulk row/error creation, and the row-count recompute), `import-rows.service.ts` (read-only,
  `importRunId`-scoped IDOR check), `import-errors.service.ts` (read-only, immutable,
  `importRunId`-scoped IDOR check), `export-runs.service.ts` (the simpler 5-state `TRANSITIONS`
  table, uniform `export` action).
- Matching controllers: `import-templates.controller.ts` (`import-and-export-center/templates`),
  `import-runs.controller.ts` (`import-and-export-center/runs`), `import-rows.controller.ts`
  (`import-and-export-center/runs/:runId/rows`, `@RequirePermission` method-level throughout),
  `import-errors.controller.ts` (`import-and-export-center/runs/:runId/errors`, method-level),
  `export-runs.controller.ts` (`import-and-export-center/exports`).
- Five `*.service.spec.ts` unit test files (34 new tests total), covering create/list/findById,
  RBAC-denied paths (via `assertAllowed` call assertions), invalid-transition rejection, CAS
  conflict (409), the dry-run branch validation, the rollbackNotes/rows-payload gating, bulk row/
  error creation, and the row-count recompute (including the "logged, not rethrown" failure path).

`apps/dashboard-api/src/app.module.ts` — `ImportAndExportCenterModule` imported and registered
(alphabetically, between `DesignTokenLibraryModule` and `InternalLinkingLibraryModule`).

### Deviations from the scope doc

- The scope doc's row/error bulk-input body shape is described narratively; the concrete DTO
  (`importRowInputSchema`/`importRunErrorInputSchema`/`changeImportRunStatusSchema`) caps `rows` at
  500 → widened to 5000 (a real import file can legitimately carry thousands of rows, unlike Scan
  Center's own findings cap) and caps `runErrors` at 200 — both new design choices not dictated by
  the scope doc, recorded here rather than silently invented.
- `ImportRunsService.changeStatus()`'s row-count recompute is nested inside the SAME try/catch as
  the row/error bulk-insert (not a second, independent try block) — a genuine correction found
  while writing this module's own unit tests: an unconditional second try block meant a failed row
  insert still triggered a `countByStatus()`/`applyRowCounts()`/refetch pass that could, in a real
  race, momentarily return stale data. Nesting them means the recompute only runs when the insert
  it's counting actually succeeded.
- Audit events for this module use `eventType: "import_run"`/`"export_run"` uniformly (both already
  real values in `AUDIT_EVENT_TYPES`) rather than switching between a generic type and `"approval"`
  the way `ChangeRecordsService` does — a deliberate, simpler choice given `import_run`/`export_run`
  are already domain-specific event types; `retentionCategory` still switches to
  `"approval-audit-7y"` for the two `approve`-gated transitions (`submitted -> approved`,
  `{completed,partially_completed} -> rolled_back`).
- `ImportTemplatesController.update()`/`.create()` use `@Patch`/`@Post` respectively, matching the
  `@Patch(":id")` convention found in `case-study-library.controller.ts`/
  `ready-for-claude-tasks.controller.ts` (the scope doc doesn't specify HTTP verbs).

### Validation — commands run and their real results

All run directly by this session, not delegated to a background agent.

```
$ pnpm --filter @webdesk/database exec tsc --noEmit          → clean, 0 errors
$ pnpm --filter dashboard-api exec tsc --noEmit               → clean, 0 errors
$ pnpm --filter dashboard-api exec eslint src/import-and-export-center --max-warnings=0   → clean, 0 problems
$ pnpm --filter @webdesk/database exec eslint src/import-and-export-center src/migrations/00107-*.ts src/migrations/00108-*.ts src/index.ts src/index.cjs.ts --max-warnings=0   → clean, 0 problems
$ pnpm --filter dashboard-api exec eslint src/app.module.ts --max-warnings=0   → clean, 0 problems
$ pnpm --filter dashboard-api test -- import-and-export-center
    → Test Files  104 passed (104); Tests  1750 passed (1750)
      (34 of those tests are new: import-templates.service.spec.ts (6),
      import-runs.service.spec.ts (14), import-rows.service.spec.ts (4),
      import-errors.service.spec.ts (4), export-runs.service.spec.ts (6))
$ pnpm exec prettier --check <every touched file>              → "All matched files use Prettier code style!"
```

**Real local disposable PostgreSQL 17 database** — `webdesk_import_export_dev`, created and
dropped by this session (not the project's `prod-db.env`/production credentials, never touched):

- `pnpm run migrate` (`DATABASE_URL=postgres://admin@localhost:5432/webdesk_import_export_dev
DATABASE_SSL=false`) — all 108 migrations applied cleanly, including the two new ones, in
  0.044s/0.003s.
- A real `down` → `down` → `up` round trip on the two new migrations specifically (reverting
  `00108` then `00107`, then re-applying both) — `migrate:status` confirmed `Executed (108) ...
Pending (0): none` afterward. `down()` correctly drops all five tables (in FK order) and every
  ENUM type with no error.
- `pnpm run validate:module-registry` — "Module-registry validation passed — 43 modules, 21
  permission groups, all references resolve."
- A dedicated, throwaway Node script (run against the compiled `dist/index.js`, deleted
  immediately after — never committed) exercised every repository method directly against the
  real database: created a template (version 1), updated it (version → 2, confirming the atomic
  `literal("version + 1")` write), created a run snapshotting `templateVersion: 2`, walked it
  through `draft → submitted → approved → validating → importing` (confirming `startedAt` gets
  stamped on `importing`), confirmed a stale-`expectedCurrentStatus` retry correctly returns
  `{outcome: "conflict"}`, bulk-created 5 rows (2 imported / 2 invalid / 1 skipped) and 2 paired
  errors in one statement each, ran the real `GROUP BY status, COUNT(*)` aggregate via
  `countByStatus()` (confirmed it returns all 6 `ImportRowStatus` keys, non-present ones as `0`),
  applied the counts via `applyRowCounts()` and confirmed the refetched run showed
  `totalRows=5, successCount=2, errorCount=2, skippedCount=1` exactly as derived, transitioned
  `importing → completed` (confirming `completedAt` stamped) then `completed → rolled_back` with
  `rollbackNotes` persisted, and separately created/transitioned an `export_runs` row through
  `requested → processing → completed` (confirming `excludesConfidentialFields` defaults `true`,
  `startedAt`/`completedAt` stamp correctly, and `rowCount` persists). Every step printed its real
  result inline; all matched the expected values.

### Not verified

- No real e2e/integration test suite (`*.e2e-spec.ts`/`*.integration.spec.ts`) was written for
  this module — only the required unit tests plus the ad hoc verification script above (which
  covers the same repository-layer ground an integration suite would, but isn't a committed,
  repeatable test). Writing real Nest e2e tests (controller + guards + real RBAC seed data) was
  out of this task's explicit required scope; a follow-up task could add them mirroring
  `scan-center`'s/`change-center`'s own `*.e2e-spec.ts` files.
- No independent code review or security review has been run on this branch — not requested as
  part of this task.
- Not pushed to `origin`, no PR opened, nothing committed — per the task's own explicit
  instructions.

### Independent re-verification (orchestrating session, not the build agent)

Every claim above was independently re-run and re-checked directly, not trusted from the build
agent's own report, per this project's own standing discipline. `tsc --noEmit`/`eslint --max-
warnings=0`/`pnpm --filter dashboard-api test -- import-and-export-center` (1750/1750, confirmed
twice — before and after the fix below) / `prettier --check` were all re-run and matched. The
migration was independently re-applied against a fresh, separate disposable database
(`webdesk_iec_verify`, created/dropped by this session), including a real `down → down → up`
round-trip (`migrate:status` confirmed 108 executed / 0 pending), `validate:module-registry`
re-run clean, and every repository method was independently re-exercised end-to-end via a second,
separate throwaway script (template version-increment, CAS transitions with timestamp stamping, a
real stale-CAS conflict, bulk row/error creation, the `GROUP BY` count aggregate, and count
application) — all matched expected values.

**One real correctness bug found and fixed during this independent pass**: in
`ImportRunsService.changeStatus()`, the row-specific errors built from `body.rows[].errorMessage`
were created with no `importRowId` set at all — `ImportRowRepository.bulkCreate()` returns the
created rows in the same order as its input array (a real, already-available correlation), but the
service discarded that return value entirely when building `rowErrorInputs`, so every row-specific
error was silently stored as if it were a run-level error, contradicting both the migration's own
doc comment ("nullable — a run-level error... has no specific row," implying a row-specific one
DOES get it set) and the whole reason `import_errors.field_name`/`import_row_id` exist as separate
concepts. Fixed by capturing `bulkCreate()`'s return value and correlating by array index to set
`importRowId: createdRow?.id ?? null`. The existing unit test covering this path
(`"bulk-creates rows and recomputes counts when transitioning to importing"`) was tightened to
assert the real `importRowId` value (`"row-2"`) instead of only `objectContaining({importRunId,
message})`, which had let the bug pass silently — re-run and confirmed it fails against the
pre-fix code and passes against the fix.
