# Scan Center module (module #31)

## Scope

Not started automatically — built directly on an explicit, fully-specified build instruction that
supplied the complete schema/design (D1–D11 equivalent) up front, since no prior scope document for
this module existed on this branch. Four-table pipeline: `scan_definitions` (what to scan, and
how) -> `scan_runs` (one execution of a definition) -> `scan_findings` (issues surfaced by a
completed run) -> `scan_evidence` (immutable supporting material attached to one finding).

**D1 — table scope.** All four tables in one migration (`00103`), reusing the seeded `scans` RBAC
permission group (`00013-seed-rbac-matrix.ts:217-225`) verbatim — distinct from
`module_registry.key = "scan_center"` (`00015-seed-module-registry.ts:111`,
`permissionGroupKey: "scans"`).

**D2 — project scoping.** All four tables carry `project_id` (RESTRICT on delete, mirroring every
other project-scoped module's own choice). `project_id` is denormalized onto
`scan_runs`/`scan_findings`/`scan_evidence` — not just derivable via a join through the parent row —
for cheap query/IDOR scoping at every layer, the same pattern `claim_sources`/`case_study_assets`
establish for a multi-table project-scoped pipeline.

**D3 — no hard delete anywhere** (ADR-0016) — only status/enable transitions.

**D4 — RBAC action mapping.** The seeded `scans` matrix has no `submit`/`approve`/`publish`
letters — only `view`/`create`/`edit`/`review`/`configure` (V/C/E/R/M,
`super_admin: VCERM`, `owner_growth_approver: VCR`, `marketing_editor: VR`,
`designer_creative_reviewer: V`, `developer: VCER`, `qa_security_reviewer: VCER`,
`read_only: V`). Scan-run status transitions are gated uniformly on `edit` (this RBAC group has no
letters to split by submit/review/approve, unlike Internal Linking Library's/Keyword & Entity
Library's own three-tier workflows); scan-finding status transitions are gated on `review`
(the natural fit for a QA/security reviewer disposing of a finding). `configure` (`M`,
super_admin-only) is left unwired in this pass — no concrete need for it exists yet, matching the
established precedent of leaving a genuinely unused seeded action unwired rather than fabricating a
mechanism for it.

**D5 — `scan_definitions` fields.** `target` is deliberately plain free text, never URL-validated
at either layer — a repository ref or a "selected page" slug is not always a URL. `environment` is
plain free text (no closed enum sourced anywhere). `scheduleCron` is only meaningful when
`mode = 'scheduled'`, not enforced via a cross-column DB constraint (a service-layer concern, and
this module doesn't build scheduling execution itself — only stores the cron expression).

**D6 — `scan_runs` workflow.** A real, terminal-ending lifecycle:
`requested -> queued -> running ->` one of five terminal outcomes
(`completed`/`partially_completed`/`failed`/`timed_out`/`cancelled`), plus two direct-to-`cancelled`
shortcuts from `queued`/`running` (a user can cancel before or during execution, not only after it
finishes). `startedAt`/`completedAt` are server-stamped only, via `ScanRunRepository.updateStatus()`'s
own atomic `COALESCE(column, NOW())` conditional write baked into the same compare-and-swap
`UPDATE` — never accepted as caller input, never overwritten once first set, mirroring
`InternalLinkRepository.updateStatus()`'s own `implementedAt`/`verifiedAt` pattern.

**D7 — findings creation.** `scan_findings` has no standalone `POST` route — a finding is only ever
created as a side effect of a run's own transition into `completed`/`partially_completed` carrying a
non-empty `findings` payload in the same request body. A `findings` array sent alongside any other
target status is rejected outright with a clean 400 (almost certainly a real client bug, not
silently ignored). Finding creation happens sequentially, after the run's own status write has
committed — not one SQL transaction with it, matching this codebase's own accepted precedent for
audit-write-after-commit ordering (`InternalLinksService.changeStatus()`'s own audit call); a
failure here is logged clearly via `console.error`, not silently dropped, since it would mean real
scan output never made it into the database even though the run itself is marked done.

**D8 — `scan_evidence` is immutable** once created — no update/delete route. `reference` is
validated, when present, via the shared `safeHttpUrlSchema` (`@webdesk/validation`) at the DTO
layer, not the database layer, mirroring every other stored-URL column in this codebase (the
lesson from Projects' own historical `environment.url` stored-XSS finding).

**D9 — resolution stamping.** `ScanFindingRepository.updateStatus()` conditionally stamps
`resolvedAt`/`resolvedBy` only on transition into `resolved`, via the identical `COALESCE` pattern
as scan runs — a repeat transition back into `resolved` (e.g. via `dismissed -> resolved`, both
legal from `acknowledged` in this module's own transition table) never resets the original
resolution timestamp.

**D10 — no cross-module relationship fields.** This module has no FK-backed relationship into
another business module's own records — no cross-module existence-validation wiring is needed in
`ScanCenterModule`.

**D11 — confidentiality.** No mechanism — the module registry's own seeded `confidentialityLevel`
for `scan_center` is `null`.

## As-built

Built directly, file-by-file (no delegation to a background subagent, per explicit instruction),
mirroring `internal-linking-library`'s structural template throughout — same
`(id, expectedStatus)` atomic compare-and-swap pattern in every repository with a workflow,
same method-level `@RequirePermission` decorator placement (never class-level — the exact bug
class 3+ prior modules in this codebase independently had and fixed once already), same
`:projectId` real route path parameter shape (never a query/body field).

- **`packages/database/src/scan-center/`**: `entities.ts`, `models.ts`, `entity-mapping.ts` (one
  shared `toEntityWithIsoDates()` helper covering all four entity types' date fields, unlike
  `internal-linking-library`'s single-entity-type version), `scan-definition.repository.ts`,
  `scan-run.repository.ts`, `scan-finding.repository.ts`, `scan-evidence.repository.ts`,
  `index.ts`.
- **Migrations `00103`/`00104`**: creates all four tables (with `pg_trgm` fuzzy search on
  `scan_findings.title`, the one obvious fuzzy-search target on this schema) and marks the module
  `in_development` in `module_registry`.
- **`apps/dashboard-api/src/scan-center/`**: `scan-center.constants.ts`, `scan-center.dto.ts`,
  `database.providers.ts`, four service/controller pairs (definitions, runs, findings, evidence),
  `scan-center.module.ts`. Wired into `app.module.ts`. Both `packages/database` barrel entrypoints
  (`index.ts` AND `index.cjs.ts`) updated — the documented, repeatedly-hit production-outage gap
  this codebase's own Cautions section flags.
- **Tests**: 4 unit spec files (`apps/dashboard-api/src/scan-center/*.spec.ts`, 26 tests — RBAC
  gating, IDOR scoping, CAS-conflict handling, the findings-on-terminal-transition rule, and the
  "findings creation failure doesn't fail the transition" behavior), a `packages/database`
  integration test (`test/module-scan-center.integration.test.ts`, 12 tests — real disposable
  PostgreSQL 17, both atomic `COALESCE` stamping mechanisms proven directly, both CAS-conflict
  paths), and an e2e test (`test/scan-center.e2e-spec.ts`, 8 tests — a full real-HTTP lifecycle
  from definition creation through a completed run with findings to a resolved finding with
  attached evidence; RBAC denial for `read_only`/`marketing_editor`; `owner_growth_approver`'s
  real VCR-vs-edit gap; the project-scoping IDOR regression; a cross-project 404; a duplicate-
  `publicId` 400).

### Validation

All of the below were run for real (not skipped) — a local Postgres 17 server was found reachable
on `localhost:5432` (credentials `postgres`/`postgres`) mid-task; a throwaway database
(`webdesk_phase1b_dev`) was created for these runs, matching this project's own established
disposable-database convention, and the local `.env.local` used to reach it is gitignored, never
committed.

- `pnpm --filter @webdesk/database exec tsc --noEmit` — clean.
- `pnpm --filter dashboard-api exec tsc --noEmit` — clean.
- `pnpm --filter @webdesk/database run lint` (scoped to `src/scan-center`) — clean.
- `pnpm --filter dashboard-api run lint` (scoped to `src/scan-center`, `test/scan-center.e2e-spec.ts`,
  `src/app.module.ts`) — clean.
- `pnpm exec prettier --check` on every touched file — clean.
- **`pnpm --filter @webdesk/database run migrate`** — all 104 migrations applied cleanly against a
  fresh database, including `00103`/`00104`.
- **`pnpm --filter dashboard-api exec vitest run --config vitest.config.mts src/scan-center`** —
  26/26 unit tests passing.
- **Full `pnpm --filter dashboard-api exec vitest run --config vitest.config.mts`** — 1691/1691
  unit tests passing (no regressions elsewhere from the `app.module.ts` wiring change).
- **`pnpm --filter @webdesk/database exec vitest run --config vitest.integration.config.mts test/module-scan-center.integration.test.ts`**
  — 12/12 integration tests passing against a real disposable database, including a full
  migration up/down round-trip and both CAS-conflict paths.
- **Full `pnpm --filter @webdesk/database exec vitest run --config vitest.integration.config.mts`**
  — 799/799 integration tests passing (no regressions elsewhere).
- **`pnpm --filter dashboard-api exec vitest run --config vitest.integration.config.mts test/scan-center.e2e-spec.ts`**
  — 8/8 e2e tests passing against a real disposable database + real seeded RBAC, including the full
  lifecycle flow and all RBAC/IDOR/scoping regressions.
- Full dashboard-api e2e suite (`pnpm --filter dashboard-api exec vitest run --config vitest.integration.config.mts`,
  no file filter) — run in the background; see the session's own final report for the confirmed
  result.

### Independent code review

This project's own `code-review` skill, high effort — 8 finder angles (3 correctness, 3 cleanup,
altitude, CLAUDE.md conventions) run via parallel subagents, each candidate independently
1-vote-verified. 30+ candidates surfaced across all 8 angles; after dedup, the following were
CONFIRMED (multiple angles independently converging on several) and fixed:

- **`errorSummary` null-clearing bug** (independently found by 3 finder angles) — `ScanRunsService
.changeStatus()` passed `body.errorSummary ?? undefined` to the repository, collapsing an explicit
  `errorSummary: null` (a caller clearing a stale error message on retry) into "field omitted," so
  the repository's own `if (errorSummary !== undefined)` guard silently left the old message in
  place. Fixed by passing `body.errorSummary` through as-is.
- **N+1, non-atomic findings-batch insert** (independently found by 4 finder angles) —
  `changeStatus()` created up to 500 findings in a sequential `for`-loop, one `INSERT` per row; a
  mid-batch failure silently left however many rows had already committed while the rest were
  lost, with only a server-side log line. Fixed by adding `ScanFindingRepository.bulkCreate()`
  (a single `Model.bulkCreate()` statement) and switching `changeStatus()` to call it once — the
  whole batch now commits atomically (all rows or none).
- **Missing `pg_trgm` index on `scan_definitions.name`** — `ScanDefinitionRepository.list()`'s own
  `search` filter does an `Op.iLike` match on `name`, but the migration never added the GIN trigram
  index every sibling module's own `search`-filtered column gets. Fixed in migration `00103`.
- **Missing composite index on `scan_evidence`** — `list()` filters on `scan_finding_id` then sorts
  by `(created_at DESC, id ASC)`, but only a bare single-column index existed. Fixed with a
  composite `(scan_finding_id, created_at, id)` index, matching every sibling table's own
  WHERE+ORDER-BY-matching index in this same migration.
- **`resolvedAt`/`resolvedBy` asymmetry** (independently found by 2 finder angles) —
  `ScanFindingRepository.updateStatus()` only stamped these on a transition into `resolved`, never
  `dismissed`, even though `ScanFindingsService.changeStatus()` passes `actorUserId` for both
  terminal dispositions. Fixed to stamp on both — both are fully terminal in `TRANSITIONS` (no
  outbound edge from either), so this can only ever fire once per row.
- **Missing unique-constraint catch on `ScanEvidenceService.create()`** (found during the
  orchestrating session's own independent re-verification, before the formal review ran) — every
  sibling `create()` catches `isSequelizeUniqueConstraintError` and converts a duplicate `publicId`
  race into a clean 400; this one didn't, so it would have surfaced as a raw 500. Fixed.
- **Hand-rolled CAS-result unwrap duplicated twice more** — `ScanRunsService.changeStatus()` and
  `ScanFindingsService.changeStatus()` both hand-copied the `if (outcome === "not_found") ... if
(outcome === "conflict") ...` branching instead of using the already-shared `unwrapCasResult()`
  helper (`apps/dashboard-api/src/common/cas-result.util.ts`, extracted during Ready for Claude
  Queue's own review specifically to stop this exact duplication). Both switched to call it.
- **`ScanDefinitionRepository`'s update type didn't exclude `scanType`** — immutability after
  create was enforced only by the DTO/controller, not the repository's own type; a future direct
  caller of `.update()` could silently mutate the discriminator field with no compile error. Fixed
  by excluding `scanType` from `ScanDefinitionUpdateFields`.

**Left as accepted, tracked debt**, each either matching an already-established pattern elsewhere
in this codebase or a genuine, low-severity RBAC-model tradeoff inherent to the seeded `scans`
group's own letters (no submit/approve exists to split by):

- The same-status no-op short-circuit in both `changeStatus()` methods returns before the
  authorization check runs — the byte-identical, already-accepted pattern `InternalLinksService
.changeStatus()` has.
- The authorization check in both `changeStatus()` methods runs after transition-validity/business-
  rule validation, not before — matches the same established Internal Linking Library precedent.
- `configure` (`M`, super_admin-only) is left entirely unused, including for `scan_definitions
.isEnabled` (arguably a "governs whether this can run" concern that could fit `M` better than the
  generic `edit` it's gated on today) — a real, documented RBAC-letters-vs-actual-concerns
  tradeoff, not fixed since no established precedent exists for retrofitting a new split action
  onto an already-seeded RBAC group without its own separate authorization.
- `owner_growth_approver` can create a scan run (`create`) but can never transition it (`edit`) —
  a real usability gap if the intended workflow is "the approver manages their own ad hoc scan,"
  but the RBAC matrix itself is out of this module's scope to change.
- The `scan_run` audit `eventType` doesn't differentiate creation from each of the 7 possible
  status transitions the way `job_created`/`job_completed`/`job_failed`/... does for jobs — relies
  entirely on the free-text `action` string instead. Matches Internal Linking Library's own
  identical `data_change`/`approval`-plus-`action`-string approach, not a novel deviation.
- Several duplication findings (the 11-value `SCAN_TYPE_VALUES` array copy-pasted between
  `models.ts`/`scan-center.dto.ts`/`entities.ts`; `DEFAULT_LIST_LIMIT`/`MAX_LIST_LIMIT` redeclared
  in all four repository files; the pagination-fragment duplicated 4× in the DTO file; the
  `findById`+IDOR-check pattern hand-copied across the module's own 4 services) — all confirmed to
  match this codebase's own repo-wide, already-established "don't extract until the 2nd+ occurrence
  across DIFFERENT modules" precedent, not a new deviation this module introduces.
- Two low-priority missing indexes (`scan_definitions(project_id, is_enabled)`,
  `scan_runs(project_id, scan_definition_id)`) — both boolean/low-cardinality or currently-low-
  volume filters, matching this codebase's own established restraint about not indexing every
  possible filter combination.

Re-validated after every fix: typecheck/lint/prettier clean across both packages; 26/26
`dashboard-api` unit tests (2 updated for the `bulkCreate` switch); `packages/database` fully
rebuilt and re-typechecked after each repository-layer change.

### Security review

Run separately from the code review — focused on IDOR scoping (every `findById()`/`list()`
re-verifies `entity.projectId === projectId` from the route param before returning), RBAC decorator
placement (method-level throughout, `OriginCheckGuard` on every mutating route), the dynamic
per-transition `assertAllowed()` calls correctly threading `projectId` so project-scoped grants are
honored, `Op.iLike` search filters using the shared `escapeLikePattern()`, no mass-assignment path
for server-managed fields (`status`/`resolvedAt`/`resolvedBy`/`startedAt`/`completedAt`), and
`scan_evidence.reference` validated via the shared `safeHttpUrlSchema`. **0 findings above
threshold.**

### Final validation (after both review passes)

Everything re-run for real, not trusted from any earlier partial run — a full `pnpm build` in
`packages/database` was required after each repository-layer fix (the `bulkCreate()` addition, the
`resolvedAt`/`resolvedBy` fix, the `scanType`-exclusion type fix) since `dashboard-api` consumes the
compiled `dist/` output, not `packages/database`'s TypeScript source directly.

- `pnpm --filter @webdesk/database exec tsc --noEmit` — clean.
- `pnpm --filter dashboard-api exec tsc --noEmit` — clean.
- `pnpm --filter dashboard-api run lint` (`eslint src test --max-warnings=0`) — clean.
- `pnpm exec prettier --check` on every touched file — clean (after one `--write` pass to fix
  CRLF-driven formatting drift from the initial merge).
- A real migration `up`/`down`/`down`/`up` round-trip against a fresh disposable database — clean
  (104 migrations applied, including `00103`/`00104` with the two new indexes).
- `pnpm --filter dashboard-api exec vitest run --config vitest.config.mts src/scan-center` —
  **26/26** unit tests passing (2 updated for the `bulkCreate` switch).
- Full `pnpm --filter dashboard-api exec vitest run --config vitest.config.mts` — **1691/1691**
  unit tests passing (no regressions).
- Full `pnpm --filter @webdesk/database exec vitest run --config vitest.integration.config.mts` —
  **799/799** integration tests passing (no regressions; includes the 12 scan-center tests, both
  atomic `COALESCE` stamping mechanisms proven directly, both CAS-conflict paths).
- Full `pnpm --filter dashboard-api exec vitest run --config vitest.integration.config.mts` —
  **788/788** e2e tests passing (no regressions; includes the 8 scan-center tests — full real-HTTP
  lifecycle, RBAC/IDOR/project-scoping regressions, duplicate-`publicId` 400).

### Not yet done

The required second-role human review and a gate decision have not yet run — each its own
separate, not-yet-requested next step, per this project's standing discipline. Not pushed, not
merged. No `dashboard-web` UI exists yet for this module — a separate, not-yet-requested next step,
matching every prior module's own backend-first precedent.
