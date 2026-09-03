# Release Center — Approval Checklist

## Scope

Module backend: `release_center` (module #35 on the Recommended Module Roadmap; Wave 6, depending
on `ready_for_claude_queue`, `technical_center`, `review_and_approval_center` — all three live).
Project-scoped. Six tables sourced directly from the canonical spec's own 10-item field list:
`releases` (parent, a real 14-status workflow — `05_Workflow_State_Machines.md §10`),
`release_artifacts` ("repositories and SHAs, PRs"), `release_approvals` (an append-only decision
log, mirroring `case_study_approvals`), `deployments` (append-only deploy-attempt history),
`smoke_tests` (append-only), `rollback_records` ("rolled-back SHA, reason, replacement release" —
a literal field-for-field match). Reuses the already-seeded `releases` RBAC permission group
verbatim — no new RBAC migration. Migrations `00111`/`00112`.

Three design forks confirmed directly with the project owner before building (`AskUserQuestion`):

1. Approval routing — an inline, dynamically-gated `TRANSITIONS` map (chosen) vs. routing through
   Review and Approval Center.
2. Scope — project-scoped (chosen) vs. organization-wide.
3. Build timing — build now with no literal FK into Technical Center (chosen) vs. wait for
   Technical Center to merge (moot in practice — Technical Center merged during this build).

Built by a background agent with a fully-specified prompt naming Technical Center (project-scoped
controller/RBAC wiring) and Case Study Studio (inline dynamic-per-transition-action workflow +
approvals-log sub-resource) as the literal structural templates, then independently re-verified by
the orchestrating session.

## Independent verification

(orchestrating session, not trusted from the build agent's own report — a real local disposable
PostgreSQL 17 database was available and used throughout, unlike some prior modules)

- Read `releases.service.ts`'s full `TRANSITIONS` map, `release.repository.ts`'s CAS
  `updateStatus()` COALESCE-stamping logic, all 5 controllers' RBAC decorator placement, and the
  full migration content directly.
- Confirmed every `@RequirePermission` decorator is method-level, never class-level.
- Confirmed both `packages/database/src/index.ts` and `index.cjs.ts` were updated together.
- Re-ran `tsc --noEmit` directly for both `@webdesk/database` and `dashboard-api` — clean.
- Re-ran the module's own unit tests directly — 31/31 passing, matching the agent's own report.
- **Independently ran the migration up/down/up round-trip against a real local database** —
  112 migrations, 0 pending after.
- **Independently ran the `packages/database` integration suite** — 20/20 passing.
- **Independently ran the `dashboard-api` e2e suite** — 11/11 passing.
- Re-ran `eslint --max-warnings=0` and `prettier --check` directly — clean.
- Re-ran `validate:module-registry` — 43 modules, 21 permission groups, unaffected.
- Re-ran `pnpm audit` — 0 vulnerabilities.

## Independent code review

(this project's own `code-review` skill, high effort, 8-angle finder pass via 8 parallel agents,
1-vote self-verification)

10 findings kept in the final report (6 CONFIRMED, 4 PLAUSIBLE). **6 fixed**:

- Missing terminal-state guard on `deployments`/`smoke-tests` `create()` (could fabricate a
  governance record against an already-locked release) — fixed with a shared
  `RELEASE_TERMINAL_STATUSES` constant.
- `release_approvals.decision` hardcoded to `"approved"`, negative outcomes (rejections,
  hotfix-required) never logged despite "approvals" being the spec's own named field — fixed by
  restructuring the transition map's `approvalStage` into a bundled `approvalLog: {stage,
decision}`.
- The same restructuring closed a related type-safety gap (an optional field with nothing tying it
  to `action === "approve"`).
- 4 sub-resource repositories hand-typed their `create()` input instead of deriving via `Omit` from
  the entity — fixed.
- 5 speculative indexes with no matching query shape — removed (one uniqueness-constraint index on
  `rollback_records` kept, since it's load-bearing regardless of query pattern).

**4 PLAUSIBLE findings left as accepted, tracked debt** — each verified to match an already-shipped
sibling module's own identical pattern, not a novel deviation: a check-then-act race on content
`update()`/artifact `remove()` with no CAS (matches `CaseStudyRepository.update()`); no correction
path for a mistaken rollback (`rolled_back` has zero outbound `TRANSITIONS` edges — a real but
disproportionate-to-fix design limitation); the same-status no-op in `changeStatus()` returning
before the RBAC check (matches `ScanRunsService`/`TechnicalCheckRunsService`/`CaseStudiesService`);
and `RELEASE_CENTER_MODULE_KEY`'s misleading name (matches `TECHNICAL_CENTER_MODULE_KEY`'s own
already-established shape).

Re-validated after every fix, all against the real disposable database: 37/37 `dashboard-api` unit
tests (6 new), 20/20 `packages/database` integration tests, 11/11 `dashboard-api` e2e tests, a
fresh migration round-trip, `validate:module-registry` unaffected, typecheck/lint/prettier clean,
`pnpm audit` 0 vulnerabilities.

## Security review (separate `security-review` pass)

**0 findings above threshold.** Confirmed: method-level RBAC decorators throughout;
`OriginCheckGuard` on every mutating route; `ParseUUIDPipe` on every route param; correct IDOR
scoping via `ReleasesService.findById(id, projectId)` on every sub-resource read/write (a
cross-project record is always treated as not found); the dynamic per-transition RBAC gate in
`changeStatus()` runs before every mutating branch, with no path to reach the transaction without
it; `prUrl` validated via the shared `safeHttpUrlSchema` (closes the exact stored-XSS class
Projects' own `environment.url` finding established a precedent for); no mass-assignment path for
`status`, the 7 server-stamped timestamp columns, or `productionApproverUserId`; and no raw-SQL
string interpolation anywhere in `ReleaseRepository.updateStatus()`'s `literal()`/`fn()`/`col()`
usage.

## Sign-off

Required second-role human review, per ADR-0010 (the implementing agent cannot also be its own
reviewer): **Approved as-is**, WebDesk Solution, 2026-09-03 — accepting the 4 open tracked-debt
findings.

Gate `G4-release-center`: **CONFIRM** — WebDesk Solution, 2026-09-03, approved commit (pending
final commit hash) on branch `module-release-center`.

This gate approval does not itself authorize pushing the branch, opening a PR, or merging — each
remains its own separate, not-yet-requested authorization, per this project's standing "no
auto-merge" rule.
