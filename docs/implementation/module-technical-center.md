# Technical Center

## Scope

Module key: `technical_center`. Canonical spec
(`03_Detailed_Module_Specifications.md §35`, one line, no field list): "coding
standards, linting, automated tests, coverage, dependencies, vulnerabilities,
WordPress compatibility, PHP compatibility, code review, security,
accessibility, performance, browser and visual regression."

Seeded module registry data (`00015-seed-module-registry.ts` /
`00035-populate-module-registry-fields.ts`): `permissionGroupKey:
"development_code"`, `navigationGroup: "technical"`, `route:
"/technical-center"`, `dependencies: null` (Wave 1 — buildable with no
dependency wait).

Two design forks confirmed directly with the project owner before building
(`AskUserQuestion`):

1. **Schema shape** — a Scan-Center-style 3-level pipeline
   (`technical_check_definitions` → `technical_check_runs` →
   `technical_findings`) over a single generic table with a `reportType`
   discriminator. **Chosen: 3-level.** The spec's own ~13-category taxonomy
   reads as a "report run" + "report findings" shape, not a flat content
   library.
2. **Scope** — project-scoped (`project_id` on every table) over
   organization-wide. **Chosen: project-scoped**, matching Page
   Inventory's/Scan Center's/Change Center's own precedent — code quality and
   compatibility checks are inherently per-codebase/per-site.

Migration numbers: `00109`/`00110`, per explicit instruction — `00107`/`00108`
were reserved for the concurrently-built Import and Export Center module, not
because they were unavailable.

**Record-keeping only** — no real linter/test-runner/scanner execution engine
exists in this codebase, matching every prior "engine-shaped" module's own
precedent (Scan Center, Ready for Claude Queue, Import and Export Center).

## As-built

Built by a background agent with a fully-specified prompt naming Scan Center
(`packages/database/src/scan-center/`, `apps/dashboard-api/src/scan-center/`)
as the literal structural template, then independently re-verified in full by
the orchestrating session.

**Schema** (migration `00109`): `technical_check_definitions` (`project_id`,
`public_id`, `name`, `check_type` — a closed 13-value enum sourced directly
from the spec's own taxonomy — `mode`, `target`, `environment`,
`schedule_cron`, `is_enabled`); `technical_check_runs` (`project_id`
denormalized from the parent definition, `public_id`,
`technical_check_definition_id`, `status`, `trigger_type`, `started_at`,
`completed_at`, `error_summary`, `requested_by`); `technical_findings`
(`project_id` denormalized from the parent run, `public_id`,
`technical_check_run_id`, `category`, `severity`, `title`, `description`,
`location`, `status`, `resolved_by`, `resolved_at`). `project_id` uses
`onDelete: RESTRICT` throughout (no cascading deletion into a business-record
table, per the Projects module's own established rule). No hard delete on any
of the three tables (ADR-0016). Migration `00110` marks the module
`implementation_status = 'in_development'`.

**Workflow** — `technical_check_runs.status` mirrors Scan Center's
`ScanRunStatus`/`TRANSITIONS` exactly: `requested → queued → running →` one
of `completed`/`partially_completed`/`failed`/`timed_out`/`cancelled`, plus
direct-to-`cancelled` shortcuts from `requested`/`queued`/`running`. Findings
are created only through the run's own `completed`/`partially_completed`
transition, atomically (`bulkCreate()`, not a per-row loop) — no standalone
create route for findings, matching `scan_findings`' own precedent exactly.
`technical_findings.status` mirrors `scan_findings`' own lightweight
disposition lifecycle: `open`/`acknowledged`/`resolved`/`dismissed`.

**CAS repositories** — both `TechnicalCheckRunRepository.updateStatus()` and
`TechnicalFindingRepository.updateStatus()` use an atomic compare-and-swap on
`(id, status)`, conditionally stamping `startedAt`/`completedAt`/`resolvedAt`
via a `COALESCE(column, NOW())` SQL literal baked into the same atomic
`UPDATE` — "stamp once, never overwrite" stays atomic with the CAS guard
itself, mirroring `ScanRunRepository`'s own already-reviewed pattern. Both
`create()` methods use `isSequelizeUniqueConstraintError()`
(`@webdesk/validation`) for the TOCTOU `public_id` race, not a hand-rolled
check.

**RBAC** — reuses the seeded `development_code` group verbatim, no new
migration. The group's letter legend was read directly from
`00013-seed-rbac-matrix.ts` before wiring `@RequirePermission`: V=view,
C=create, E=edit, S=submit, R=review, A=approve, L=release/rollback. Seeded
grants: `super_admin` VCERL, `owner_growth_approver` VRL, `marketing_editor`
V, `designer_creative_reviewer` V, `developer` VCES, `qa_security_reviewer`
VRA, `read_only` V. Applied mirroring Scan Center's own gating exactly: run
status transitions → `edit`; finding disposition transitions → `review`
(both dynamically checked inside the service; the route-level guard only
requires `view`). `submit`/`approve`/`release`/`rollback` were deliberately
left unwired — no natural third gate exists in either workflow without
inventing one the spec never named, matching Scan Center's own precedent of
leaving a genuinely-unused seeded action (there, `configure`) unwired rather
than fabricating a use for it. `@RequirePermission` is method-level on every
route, never class-level (independently confirmed via direct `grep`).

**Validation** (agent-reported, real disposable PostgreSQL 17 database):
25/25 `dashboard-api` unit tests (independently re-run and confirmed by the
orchestrating session), 16/16 `packages/database` integration tests
(including CAS/atomic-transition coverage), 10/10 `dashboard-api` e2e tests
(per-role RBAC checks across 5 tested roles, plus a cross-project
IDOR-scoping regression test), a full migration up/down/up round-trip,
`validate:module-registry` unchanged (43 modules / 21 permission groups),
`pnpm audit` — no new vulnerabilities, typecheck/`eslint
--max-warnings=0`/`nest build`/prettier all clean. Full repo `dashboard-api`
unit suite re-run by the agent: 1781/1781, nothing else broke.

Independently re-verified by the orchestrating session (not trusted from the
agent's report alone): migration content read directly, RBAC decorator
placement confirmed via `grep`, both `packages/database` barrel files
(`index.ts`/`index.cjs.ts`) confirmed updated together, `tsc --noEmit`
re-run directly for both packages (clean), the module's own 25 unit tests
re-run directly (25/25), `eslint --max-warnings=0`/`prettier --check` re-run
directly on every new file (clean), and the CAS repository logic read
directly. No local PostgreSQL instance was available in this environment to
independently re-run the DB-backed integration/e2e suites — that portion
relies on the agent's own reported run plus direct code inspection.

**Design judgment calls**: no `technical_evidence` table — no genuine
"supporting artifact" need was identified for this module's own findings.
Audit events use `eventType: "data_change"` throughout (no dedicated
`"technical_check_run"` enum value exists in `AuditService`'s fixed enum,
unlike Scan Center's own `"scan_run"` value — `data_change` is the same
fallback several other non-scan modules already use).

## Independent code review

High effort, 8-angle finder pass. 1 low-severity finding kept:
`TechnicalCheckRunRepository.findByPublicId()` has zero callers — verified
inherited verbatim from `ScanRunRepository.findByPublicId()`, equally unused
in the already-shipped Scan Center module. **Left as accepted, tracked
debt** — copied debt, not a new deviation. Reuse/simplification/efficiency
and conventions angles otherwise found nothing real — the module was noted as
unusually clean, fixing (rather than repeating) two bug classes prior module
reviews had to catch after the fact (the `resolvedAt`/`resolvedBy` stamping
asymmetry Scan Center's own review found; sequential-await existence checks
in `create()`, now `Promise.all`).

## Security review

Separate `security-review` skill run. **0 findings above threshold.**
Confirmed: no SQL injection surface (search filters use
`escapeLikePattern()`; CAS `literal()` calls are fixed strings with no
interpolated input); RBAC decorators method-level throughout; correct
`:projectId` route-path scoping with an independent IDOR check
(`entity.projectId === projectId`) in every service; no mass-assignment path
for server-managed fields; no PII/secret exposure in logged data or error
messages; and the RBAC letter-to-action mapping correctly gates both
transition classes with no bypass path for a view-only role.

## Sign-off

Required second-role human review (ADR-0010): **Approved as-is**, WebDesk
Solution, 2026-09-02.

Gate `G4-technical-center`: **CONFIRM**, WebDesk Solution, 2026-09-02,
approved commit `8975169` on branch `module-technical-center`. See
`docs/project-state/module-technical-center-approval-checklist.md`.

This gate approval does not itself authorize pushing the branch, opening a
PR, or merging.
