# Design Token Library Module Backend — Approval Checklist

**Status:** Code review complete (7 candidates verified after dedup, 5 CONFIRMED and 2 REFUTED, 3
fixed and 2 accepted as tracked debt). Security review complete (0 findings above threshold).
Required second-role human review: pending.

## Completion condition

Every item below must be genuinely true, verified against real evidence, before a gate decision
for this slice can be requested.

| #   | Item                                       | Status                                                                                                                                                                                                                                                                       |
| --- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Authorization to build                     | ✅ Explicit "start Design Token Library" instruction — module #14 on the Recommended Module Roadmap                                                                                                                                                                        |
| 2   | Genuine scoping decisions surfaced         | ✅ Three questions confirmed directly with the user via `AskUserQuestion` before building: real multi-row version history (mirroring Website Strategy Center), the standard `ArtifactApprovalStatus` workflow, `usageReferences` as a plain unvalidated array           |
| 3   | Required tests pass                        | ✅ 1059/1059 `dashboard-api` unit tests (44 new for this module), 467/467 `packages/database` integration tests (25 new), 457/457 `dashboard-api` e2e/integration tests (22 new) — all independently re-run by the orchestrating session against a real disposable PostgreSQL database, not just trusted from the build agent's own report |
| 4   | Full validation clean                      | ✅ typecheck/lint (`--max-warnings=0`)/prettier clean across `packages/database` and `apps/dashboard-api`; migration up/down/up round-trip clean (75 migrations); `pnpm validate:module-registry` unaffected (43 modules, 21 permission groups); `pnpm audit` 0 vulnerabilities |
| 5   | Independent code review complete           | ✅ High-effort 8-angle finder pass — 12 candidates after dedup, 7 kept for verification (5 CONFIRMED, 2 REFUTED), 3 CONFIRMED findings fixed and re-validated with new unit + real-database integration regression tests; 2 CONFIRMED findings left as accepted, tracked debt, one of which was separately confirmed with the user |
| 6   | Security review complete                   | ✅ `security-review` skill run separately — 0 findings above threshold                                                                                                                                                                                                    |
| 7   | Known out-of-scope gaps flagged, not fixed | ✅ The `group` field's invented 15-value taxonomy (confirmed with the user directly, kept as-is) and `list()`'s missing supporting sort index (inherited from Website Strategy Center's own already-reviewed migration) are both recorded as accepted, tracked debt      |
| 8   | Documentation updated                      | ✅ `docs/implementation/module-design-token-library.md` (Scope + As-built, collapsed single-file format per the 2026-08-27 standing rule)                                                                                                                                 |
| 9   | Exact branch/commit verified and recorded  | ✅ Branch `module-design-token-library`, latest commit `31b7c18` — not yet pushed to `origin`                                                                                                                                                                              |

## Forbidden-actions check

- No `dashboard-web` UI built — backend only, matching every prior module's own backend-first
  precedent.
- No new RBAC/permission-group migration added — reuses the already-seeded `creative_design`
  permission group verbatim.
- No hard-delete route — matches ADR-0016's project-wide no-hard-delete policy.
- `@RequirePermission` is placed on every individual controller method, never at class level —
  confirmed directly and by both the code review and security review.
- The most severe code-review finding (the `usageReferences` null-to-clear regression, which would
  have thrown a raw crash at the repository layer had only the DTO been widened) was a genuine gap
  caught only by independent review, not silently left unaddressed — fixed across all three layers
  (DTO, service, repository) and re-validated with new regression tests, not just asserted fixed.
- The two accepted-debt findings were both recorded explicitly, and the more consequential one
  (the invented `group` taxonomy) was separately surfaced to and confirmed by the user, not
  silently accepted by the implementing agent alone.

## Independent code review — summary

Full record: `docs/implementation/module-design-token-library.md` and this session's
`ReportFindings` output. 8-angle finder pass (3 correctness angles, reuse, simplification,
efficiency, altitude, CLAUDE.md conventions) surfaced 12 candidates after dedup; 7 were selected
for 1-vote verification (5 CONFIRMED, 2 REFUTED):

1. **`usageReferences` used `.optional()` instead of `.nullish()`**, unlike every other nullable
   field in the same DTO, regressing a bug shape this codebase already fixed once (Persona
   Library). Most severe — an explicit `null` would have been rejected with a 400, and had the DTO
   alone been widened without a matching fix, the repository's `updateInPlace()` would have thrown
   on `[...null]`. **Fixed** across all three layers (DTO, service's approved-fork branch,
   repository's `updateInPlace()`), with 2 new unit tests and 2 new real-database integration
   tests added.
2. **Two hand-rolled `error.name === "SequelizeUniqueConstraintError"` checks** reintroduced the
   exact pattern the shared `isSequelizeUniqueConstraintError()` helper (`@webdesk/validation`)
   was extracted to stop — the two most recently built sibling modules (Brand Library, Design
   Reference Library) both correctly use it. **Fixed** at both call sites.
3. **`create()`/`createNewVersion()`'s two independently-maintained ~13-field row builders**
   (inherited from the Website Strategy Center template) risked a field added later being dropped
   on whichever builder was missed. **Fixed**: consolidated into one shared `buildVersionRow()`
   private repository method.
4. **The `group` field's 15-value enum collapses the canonical spec's own finer-grained, unfixed
   token-group taxonomy** — an invented content-architecture decision never separately confirmed
   with the user the way the three other design decisions were. **Accepted, tracked debt** — the
   finding was presented directly to the user via `AskUserQuestion`, who chose to keep the enum
   as-is, treating it as a routine implementation-level judgment call.
5. **`list()`'s `WHERE is_current = true` + `ORDER BY updated_at DESC, id ASC` query has no
   supporting composite index.** **Accepted, tracked debt** — inherited byte-for-byte from Website
   Strategy Center's own already-reviewed migration, where a prior review's `EXPLAIN ANALYZE`
   against a 53,770-row synthetic dataset found real-world impact modest.

Two candidates were REFUTED: a redundant pre-`create()` SELECT (matches an already-accepted,
repo-wide TOCTOU-handling convention, byte-for-byte identical to the explicit template) and a
`DesignTokenListFilter`/`ListDesignTokensQueryDto` cross-package type duplication (matches an
already-accepted convention shared by every sibling module, not a boundary-rule violation).

## Independent security review — summary

Full record: this session's transcript. **0 findings above threshold.** Confirmed:

- Every `@RequirePermission` decorator is method-level, never class-level.
- The status-transition route is gated on `view` at the route level, but
  `AuthorizationService.assertAllowed()` performs real, throwing enforcement inside the service
  before any write — not bypassable via the route-level grant alone.
- The search filter's `escapeLikePattern()` is correctly applied before interpolation into the
  `Op.iLike` clause.
- All queries go through Sequelize's object `where`/`update` API — no string-built clauses; the
  migration's raw `sequelize.query()` calls are fixed-literal DDL only, no interpolated values.
- No `project_id` scoping and no confidentiality-redaction mechanism — matches the module
  registry's own seeded `confidentialityLevel: null`, the same as Persona Library/Proof and Claims
  Library/Website Strategy Center, not an oversight.
- CAS/concurrency guards throughout are atomic compare-and-swap, consistent with the
  already-reviewed pattern from every sibling artifact-workflow module.

## Required second-role human review — PENDING

- [ ] Code-review findings (7 kept — 3 CONFIRMED fixed, 2 accepted as tracked debt, 2 REFUTED) —
      pending review.
- [ ] Security-review findings (0 above threshold) — pending review.

Review packet:
[Design Token Library Review Packet](https://claude.ai/code/artifact/792dcab3-682b-4396-a4ab-f411c74e4770)
(published as a Claude artifact — code review + security review findings, fixes, and validation
evidence, with a decision section).

## Sign-off

_(pending)_
