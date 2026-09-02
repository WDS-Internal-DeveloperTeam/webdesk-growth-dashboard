# Technical Center — Approval Checklist

## Scope

Module backend: `technical_center`. A Scan-Center-style 3-level pipeline —
`technical_check_definitions` (what to check, and how) → `technical_check_runs`
(one execution of a definition) → `technical_findings` (issues surfaced by a
completed run) — project-scoped throughout (`project_id` on all three tables,
`:projectId` in every route path, matching Page Inventory's/Scan Center's own
precedent). No `technical_evidence` table. Reuses the already-seeded
`development_code` RBAC permission group verbatim — no new RBAC migration.
Migrations `00109`/`00110` (numbered from `00109` per explicit instruction;
`00107`/`00108` were reserved for the concurrently-built Import and Export
Center module).

Design forks confirmed directly with the project owner before building
(`AskUserQuestion`):

1. Schema shape — Scan-Center-style 3-level pipeline (chosen) vs. a single
   generic table with a `reportType` discriminator.
2. Scope — project-scoped (chosen) vs. organization-wide.

Built by a background agent with a fully-specified prompt naming Scan Center
as the literal structural template, then independently re-verified by the
orchestrating session.

## Independent verification

(orchestrating session, not trusted from the build agent's own report)

- Read the full migration content (`00109-create-technical-center.ts`) directly — table
  shapes, FKs (`RESTRICT` on `project_id`, matching Projects' own no-cascade
  rule), indexes, `pg_trgm` search support — consistent with Scan Center's own
  pattern.
- Confirmed every `@RequirePermission` decorator is method-level, never
  class-level, via direct `grep` across all three controllers.
- Confirmed both `packages/database/src/index.ts` and `index.cjs.ts` (the
  separately-maintained CommonJS barrel) were updated together.
- Re-ran `tsc --noEmit` directly for both `@webdesk/database` and
  `dashboard-api` — clean.
- Re-ran the module's own 25 unit tests directly (`vitest run
src/technical-center`) — 25/25 passing, matching the agent's own report.
- Re-ran `eslint --max-warnings=0` and `prettier --check` directly on every
  new file — clean.
- Read `TechnicalCheckRunRepository.updateStatus()`'s atomic compare-and-swap
  logic directly — sound, byte-for-byte consistent with
  `ScanRunRepository.updateStatus()`'s own already-reviewed pattern
  (`COALESCE(column, NOW())` stamping for `startedAt`/`completedAt`, correct
  not-found/conflict disambiguation).
- **Not independently re-run**: the DB-backed integration (`packages/database`,
  16/16 reported) and e2e (`apps/dashboard-api`, 10/10 reported, including
  per-role RBAC checks and a cross-project IDOR-scoping regression test) test
  suites — no local PostgreSQL instance was available in this environment.
  Relied on the agent's own reported real-database run, combined with direct
  code inspection of the CAS/atomic-transition and RBAC-scoping logic those
  suites exercise.

## Independent code review

(this project's own `code-review` skill, high effort, 8-angle finder pass)

1 low-severity finding kept — `TechnicalCheckRunRepository.findByPublicId()`
has zero callers, verified inherited verbatim from
`ScanRunRepository.findByPublicId()`, which is equally unused in the
already-shipped, already-reviewed Scan Center module. **Left as accepted,
tracked debt** — copied debt, not a new deviation this branch introduces.

## Security review (separate `security-review` skill run)

**0 findings above threshold.** Confirmed: method-level RBAC decorators
throughout; correct `:projectId` route-path scoping with an independent
`entity.projectId === projectId` IDOR check in every service's `findById()`;
no mass-assignment path for server-managed fields (`status`, `startedAt`,
`completedAt`, `resolvedAt`, `resolvedBy`); `escapeLikePattern()` reuse on
both search filters; the CAS methods' `literal()` calls are fixed,
hardcoded SQL strings with no interpolated input; and the RBAC letter-to-action
mapping (`development_code` group) correctly gates run-status transitions on
`edit` and finding-disposition transitions on `review`, with no role able to
bypass the intended gating.

## Sign-off

Required second-role human review, per ADR-0010 (the implementing agent
cannot also be its own reviewer): **Approved as-is**, WebDesk Solution,
2026-09-02 — accepting the 1 open low-severity tracked-debt finding.

Gate `G4-technical-center`: **CONFIRM** — WebDesk Solution, 2026-09-02,
approved commit `8975169` on branch `module-technical-center`.

This gate approval does not itself authorize pushing the branch, opening a
PR, or merging — each remains its own separate, not-yet-requested
authorization, per this project's standing "no auto-merge" rule.
