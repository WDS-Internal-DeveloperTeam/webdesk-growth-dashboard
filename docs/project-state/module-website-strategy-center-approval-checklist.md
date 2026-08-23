# Website Strategy Center Module Backend — Approval Checklist

**Status:** Built, code review complete (5 candidates surfaced after dedup — 3 CONFIRMED, 2
REFUTED — all 3 fixed). Security review complete (1 CONFIRMED finding at 9/10 confidence, fixed;
0 findings above threshold on re-scan). **Required second-role human review complete — Jitesh D,
"Approved," no disputes raised.** Not yet gated, pushed, or merged.

## Completion condition

Every item below must be genuinely true, verified against real evidence, before a gate decision
for this slice can be requested.

| #   | Item                                       | Status                                                                                                                                                                                                                                                                              |
| --- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Authorization to build                     | ✅ Explicit "Start the Website Strategy Center" instruction, presented as the recommended next candidate per `Recommended_Module_Roadmap.md` (module #6)                                                                                                                            |
| 2   | Genuine scoping confirmed                  | ✅ Two design forks confirmed directly with the user (`AskUserQuestion`) before building: D1 (single generic table with a `recordType` enum, vs. 9 separate tables) and D2 (real multi-row version history, vs. a single mutable row) — both resolved to the recommended option     |
| 3   | Required tests pass                        | ✅ 596/596 `dashboard-api` unit tests (44 new across this module), 228/228 `packages/database` integration tests (21 new), 21/21 module e2e tests (23 counting all module coverage)                                                                                                 |
| 4   | Full validation clean                      | ✅ typecheck/lint (`--max-warnings=0`)/prettier all clean across `packages/database` and `apps/dashboard-api`; `pnpm audit` 0 vulnerabilities; a real migration up/down round-trip                                                                                                  |
| 5   | Independent code review complete           | ✅ This project's own `code-review` skill (high effort, 8-angle finder pass, 1-vote verification per surviving candidate) — 5 candidates after dedup, 3 CONFIRMED and fixed, 2 REFUTED                                                                                              |
| 6   | Security review complete                   | ✅ `security-review` skill run twice — once surfacing 1 CONFIRMED finding (9/10), fixed and re-validated; once more after the fix, confirming 0 findings above threshold                                                                                                            |
| 7   | Known out-of-scope gaps flagged, not fixed | ✅ None — every confirmed finding across both reviews was fixed, not deferred                                                                                                                                                                                                       |
| 8   | Live end-to-end verified                   | ✅ Real migration up/down round-trip against a local disposable PostgreSQL 17 database; full 3-tier submit/review/approve RBAC matrix verified over real HTTP; a real end-to-end test proving an approved record's edit forks a new version and approving it supersedes the old one |
| 9   | Documentation updated                      | ✅ `CLAUDE.md`'s Active tasks and the corresponding "Recent decisions" entries                                                                                                                                                                                                      |
| 10  | Exact branch/commit verified and recorded  | ✅ Branch `module-website-strategy-center`, commits `0033921` (build) → `b2333a5` (code-review fixes) → `087c2e5` (security-review fix) — not yet pushed to `origin`                                                                                                                |

## Forbidden-actions check

- No new RBAC/permission-group migration added — reuses the already-seeded `website_strategy`
  permission group verbatim, matching every prior module's own precedent.
- No hard-delete route or UI — matches ADR-0016's project-wide no-hard-delete policy; superseded/
  archived rows are never deleted, permanently readable via the version-history route.
- `approvalStatus`/`recordType`/`publicId` are never fields on the general `update()` route —
  `recordType`/`publicId` are immutable across a record's own version chain by design (D3), and
  `approvalStatus` may only change via the dedicated status-transition endpoint.
- The generic `TRANSITIONS` table's `approved -> superseded` edge was deliberately removed (not
  present in the 4 sibling modules' own identical copies) — a real, intentional deviation
  documented directly in the file's own comment, not an oversight.
- Both concurrency fixes (the CAS guard on `updateInPlace()`, applied to both branches of
  `update()`, and the unique-constraint catch on new-version creation) reuse the exact same
  compare-and-swap/catch-and-convert patterns this codebase already established for
  `updateApprovalStatus()`/`create()` — no new mechanism was invented.

## Independent code review — summary

Full record: this session's two `ReportFindings` calls. 8-angle finder pass (line-by-line,
removed-behavior, cross-file tracer, reuse, simplification, efficiency, altitude, conventions) —
5 candidates survived dedup after 1-vote verification:

1. **`update()`'s in-place-edit branch had no CAS guard on `approvalStatus`** — independently
   found by Angle A and Angle B. A concurrent approval (or an already-terminal archived/
   superseded row) could be silently mutated in place instead of forking a new version. **Fixed**:
   `updateInPlace()` gained an optional `expectedApprovalStatus` parameter; the non-approved
   branch passes `current.approvalStatus`; terminal states are rejected outright before either
   branch runs.
2. **Concurrent new-version creation raced unhandled on the `(record_id, version_number)` unique
   index** — independently found by Angle A, Angle B, and Altitude (3-way convergence). Surfaced
   as a raw 500 instead of the clean 400/409 `create()` already demonstrates for the analogous
   race. **Fixed**: a `try/catch` mirroring `create()`'s own pattern, converting the collision to
   a 409.
3. **`approved -> superseded` was directly reachable via the generic status route** — found by
   Altitude, contradicting the module's own explicit design that supersede is exclusively an
   automatic side effect of a different version's own approval. **Fixed**: the edge was removed
   from the `TRANSITIONS` table.
4. **REFUTED** — a candidate that the automatic supersede side-effect goes unaudited. A dedicated
   verifier found this matches an already-accepted precedent (`ProjectService.setActivePhase()`'s
   own identical shape).
5. **REFUTED** — a candidate that `list()` lacks an index for its primary query pattern, given
   this module's unbounded historical-row growth. Empirically disproven with `EXPLAIN ANALYZE`
   against a real 53,770-row synthetic dataset in a disposable Postgres 17 database — the
   `public_id` partial unique index already serves the query via its implied predicate.

7 new regression tests added (6 unit, 1 integration/e2e split across both new HTTP-level
behaviors).

## Independent security review — summary

Full record: this session's transcript. Run twice — the first pass, focused on RBAC decorator
placement, the dynamic per-transition permission split, the CAS/terminal-state fixes'
authorization implications, and SQL-injection surface, surfaced 1 CONFIRMED finding:

- **The approved branch's own `updateInPlace()` call (the `isCurrent`-flip, not the content edit)
  was missing the identical CAS guard the code-review fix had just added to the non-approved
  branch.** An edit-only caller (holds `edit`, never `approve`) forking an approved record could,
  if a properly-authorized approver's concurrent `approved -> archived` transition committed
  first, still have the fork proceed — resurrecting a just-archived record into a fresh editable
  draft using only the edit grant for the resurrection half of the race, directly contradicting
  the module's own documented invariant that archived/superseded are permanently terminal.
  Confirmed at 9/10 confidence by an independent false-positive-filtering pass (reads the actual
  code, verifies the real seeded RBAC grant split, traces the exact write path, confirms no
  database-level constraint independently blocks it). **Fixed**: `current.approvalStatus` is now
  passed as the CAS guard on this call too; a null result throws `ConflictException`.

A second re-scan pass, focused specifically on whether the fix was complete and whether it
introduced any new issue, confirmed: the fix correctly closes the race; the `ConflictException`
message leaks no sensitive detail (only the caller-supplied `recordId`); transaction rollback
semantics are correct (the exception propagates untouched through the outer catch, which only
special-cases `SequelizeUniqueConstraintError`); and no remaining gap of the same class exists —
every `updateInPlace()`/`updateApprovalStatus()` call site in the file is now CAS-guarded, and
`changeApprovalStatus()`'s own CAS-then-supersede composition was already fully guarded before
this fix. **0 findings above threshold** on the re-scan.

Also confirmed clean on both passes: every `@RequirePermission` decorator is method-level, never
class-level; `changeApprovalStatus()`'s dynamic submit/review/approve split matches the real
seeded `website_strategy` RBAC matrix exactly; `escapeLikePattern()` is actually invoked in
`list()`, not merely imported; every route sits behind `SessionGuard` + `PermissionGuard`.

## Required second-role human review — COMPLETE

- [x] Code-review findings (3 CONFIRMED, all fixed) — reviewed by: **Jitesh D**, 2026-08-23,
      **Approved**.
- [x] Security-review findings (1 CONFIRMED at 9/10, fixed; 0 remaining above threshold) —
      reviewed by: **Jitesh D**, 2026-08-23, **Approved**.

Review packet:
[Website Strategy Center Review Packet](https://claude.ai/code/artifact/edaf8a33-7fc9-43e2-8fba-1eeacc939d55)
(published as a Claude artifact — code review + security review findings, fixes, and validation
evidence, with a decision section).

## Sign-off

**Second-role human review: complete.** No disputes raised — every confirmed finding across both
reviews had already been fixed and re-validated before this review, so there was no open item to
accept as tracked debt.

| Field                         | Value                                                                                                                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reviewer (second-role review) | Jitesh D                                                                                                                                                                  |
| Review date                   | 2026-08-23                                                                                                                                                                |
| Decision                      | Approved                                                                                                                                                                  |
| Scope reviewed                | Full code-review disposition (3 findings, all fixed) and full security-review disposition (1 finding fixed, 0 remaining above threshold), per the published review packet |
| Disputes raised               | None recorded                                                                                                                                                             |

A gate decision, push/PR, and merge authorization each remain separate, not-yet-requested next
steps, per this project's standing "no auto-merge" discipline.
