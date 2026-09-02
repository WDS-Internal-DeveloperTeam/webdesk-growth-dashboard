# Scan Center Module Backend — Approval Checklist

**Status:** Code review complete (high-effort 8-angle finder pass — 30+ candidates across all 8
angles, deduped, 8 CONFIRMED and fixed, 2 PLAUSIBLE left as accepted tracked debt). Security review
complete (0 findings above threshold). Required second-role human review complete via direct
instruction. Gate approved.

## Completion condition

| #   | Item                                       | Status                                                                                                                                                                                                                                                              |
| --- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Authorization to build                     | ✅ Explicit "start scan center" instruction                                                                                                                                                                                                                         |
| 2   | Genuine scoping decisions surfaced         | ✅ Two real forks confirmed with the user via `AskUserQuestion` before building: record-keeping-only vs. deferring the whole module (no scanner infra exists), and project-scoped vs. organization-wide — both resolved in favor of the recommended option          |
| 3   | Migration numbering                        | ✅ `00103`/`00104` — the 103rd/104th real migrations, verified via a clean up/down/down/up round-trip (104 executed, 0 pending)                                                                                                                                     |
| 4   | Required tests pass                        | ✅ Independently re-run by the orchestrating session against a real disposable PostgreSQL 17 database (not trusted from the build agent's own report): 26/26 `dashboard-api` unit tests, 12/12 `packages/database` integration tests, 8/8 `dashboard-api` e2e tests |
| 5   | Full validation clean                      | ✅ Migration round-trip clean; typecheck clean on both packages; `eslint --max-warnings=0` clean; `prettier --check` clean; full `dashboard-api` unit suite 1691/1691; full `packages/database` integration suite 799/799; full `dashboard-api` e2e suite 788/788   |
| 6   | Independent code review complete           | ✅ High-effort 8-angle finder pass (line-by-line scan, removed-behavior audit, cross-file trace, reuse, simplification, efficiency, altitude, conventions) run via parallel subagents — 8 CONFIRMED findings fixed, 2 PLAUSIBLE (altitude) left as accepted debt    |
| 7   | Security review complete                   | ✅ Run separately, focused on IDOR scoping, RBAC decorator placement, dynamic per-transition authorization, injection surface, mass assignment, and URL-field safety — 0 findings above threshold                                                                   |
| 8   | Known out-of-scope gaps flagged, not fixed | ✅ No real scanner/crawler execution (record-keeping only, D1); `configure`/`M` RBAC action left unwired (documented, deliberate); no `dashboard-web` UI yet — each a separate, not-yet-requested next step                                                         |
| 9   | Documentation updated                      | ✅ `docs/implementation/module-scan-center.md` (Scope + As-built + code review + security review, collapsed single-file format)                                                                                                                                     |
| 10  | Exact branch/commit verified and recorded  | ✅ Branch `module-scan-center`; commit `aa9eaeb` (initial build) plus a fix-round commit finalizing this checklist — not yet pushed to `origin`                                                                                                                     |

## Forbidden-actions check

- No `dashboard-web` UI built — backend only, matching every prior module's own backend-first
  precedent.
- No new RBAC/permission-group migration added — reuses the already-seeded `scans` permission
  group verbatim.
- No hard-delete route on any of the four tables — matches ADR-0016's project-wide no-hard-delete
  policy.
- `@RequirePermission` is placed on every individual controller method, never at class level —
  confirmed directly and by both the code review and security review.
- Both `packages/database/src/index.ts` and `index.cjs.ts` (the separately-maintained CJS barrel
  Vercel's production bundler actually uses) were updated together — confirmed directly.
- No real scan execution, crawler, or WordPress-adapter code anywhere in this module — a pure
  record-keeping engine, matching the confirmed D1 design decision.

## Independent code review — summary

High-effort 8-angle finder pass (each angle run as an independent subagent, verified 1-vote against
the real diff). All 8 CONFIRMED findings fixed:

- **`errorSummary` null-clearing bug** (independently found by 3 of 8 angles) — `?? undefined`
  collapsed an explicit `null` into "field omitted," silently leaving a stale error message in
  place on retry. Fixed by passing the value through as-is.
- **N+1, non-atomic findings-batch insert** (independently found by 4 of 8 angles) — up to 500
  findings inserted one row at a time in a sequential loop; a mid-batch failure silently left a
  partial, undetectable finding set persisted. Fixed with a new `ScanFindingRepository.bulkCreate()`
  — one atomic statement, all-or-nothing.
- **Two missing indexes** — a `pg_trgm` GIN index on `scan_definitions.name` (every sibling
  module's own `search`-filtered column gets one) and a composite `(scan_finding_id, created_at,
id)` index on `scan_evidence` matching its own `list()` query shape. Both added to migration `00103`.
- **`resolvedAt`/`resolvedBy` stamping asymmetry** (independently found by 2 of 8 angles) — only
  stamped on transition into `resolved`, never `dismissed`, though the service passes `actorUserId`
  for both. Fixed to stamp on both terminal dispositions.
- **Missing unique-constraint catch on `ScanEvidenceService.create()`** — every sibling `create()`
  catches `isSequelizeUniqueConstraintError`; this one didn't, risking a raw 500 on a duplicate
  `publicId` race. Fixed.
- **CAS-result unwrap hand-duplicated twice more** — the already-shared `unwrapCasResult()` helper
  (extracted during Ready for Claude Queue's own review specifically to stop this pattern) wasn't
  used by either of this module's two `changeStatus()` methods. Both switched to call it.
- **`ScanDefinitionRepository`'s update type didn't exclude the immutable `scanType` field** —
  enforced only by the DTO, not the repository's own type. Fixed with a type-level exclusion.

Two PLAUSIBLE altitude findings left as accepted, tracked debt: the `scan_definitions.isEnabled`
toggle is gated on `edit` rather than the seeded `configure`/`M` action (a real RBAC-model
tradeoff, no established precedent exists for retrofitting a split action onto an already-seeded
group); and the `scan_run` audit `eventType` doesn't differentiate creation from each status
transition the way `job_*` events do (relies on the free-text `action` field instead — matches
Internal Linking Library's own identical, already-accepted approach). See
`docs/implementation/module-scan-center.md`'s own "Independent code review" section for the full
account, including several duplication findings confirmed to match this codebase's own repo-wide
"don't extract until the 2nd+ occurrence across different modules" precedent.

## Security review — summary

Run separately from the code review. **0 findings above threshold.** Confirmed: every `findById()`/
`list()` re-verifies `entity.projectId === projectId` from the route path parameter before
returning (no cross-project data exposure); `@RequirePermission` is method-level throughout with
`OriginCheckGuard` on every mutating route; the dynamic per-transition `assertAllowed()` calls in
both `changeStatus()` methods correctly thread the already-IDOR-verified `projectId` so
project-scoped grants are honored, not just global ones; the only `Op.iLike` search filters use the
shared `escapeLikePattern()`; no server-managed field (`status`/`resolvedAt`/`resolvedBy`/
`startedAt`/`completedAt`) is ever accepted through a create/update DTO — each is set exclusively
inside a repository's own atomic `updateStatus()` method; and `scan_evidence.reference` is
validated via the shared `safeHttpUrlSchema` at write time (no render site exists in this
backend-only pass).

## Sign-off

**Required second-role human review complete** — via the direct "Approve as-is, gate it" instruction
(`AskUserQuestion`), accepting the 2 open PLAUSIBLE code-review findings as tracked debt. Since
every CONFIRMED finding across both reviews was fixed and re-validated, this checklist's own
findings tables serve as the review artifact rather than a separately published packet.

**The gate (G4-scan-center) was then separately requested and approved** — WebDesk Solution,
decision CONFIRM (a clean pass, not an override, since the second-role review was already complete
before the gate was requested). See `outputs/webdesk-growth-dashboard/project.json`'s `gates[]`.

This gate approval does not itself authorize committing, pushing, opening a PR, or merging — each
remains its own separate, not-yet-requested authorization, per this project's standing "no
auto-merge" rule.
