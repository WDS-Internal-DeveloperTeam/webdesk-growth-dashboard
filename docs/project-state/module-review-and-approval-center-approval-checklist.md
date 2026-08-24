# Review and Approval Center backend — Approval Checklist

**Status:** Built, code review complete (8 candidates surfaced after dedup, 8 CONFIRMED, all 8
fixed). Security review complete (0 findings above threshold). Awaiting the required second-role
human review.

## Completion condition

Every item below must be genuinely true, verified against real evidence, before a gate decision
for this slice can be requested.

| #   | Item                                       | Status                                                                                                                                                                                                                                                                                                   |
| --- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Authorization to build                     | ✅ Explicit "Build a minimal, real approval system now" instruction, following an `AskUserQuestion` resolving a real conflict between the Recommended Module Roadmap and the module registry's own seeded `dependencies`                                                                                 |
| 2   | Genuine scoping confirmed                  | ✅ Full task package authored directly (`docs/task-packages/module-review-and-approval-center.md`), 10 design decisions (D1–D10) grounded in the canonical spec, the seeded RBAC matrix, or an established pattern elsewhere in this codebase                                                            |
| 3   | Required tests pass                        | ✅ 875/875 `dashboard-api` unit tests, 371/371 `packages/database` integration tests (real disposable PostgreSQL 17), 362/362 `dashboard-api` e2e tests (real disposable database + real seeded RBAC) — all independently re-run by the orchestrating session, not trusted from the build agent's report |
| 4   | Full validation clean                      | ✅ typecheck/lint (`--max-warnings=0`)/prettier all clean on both `packages/database` and `dashboard-api`; migration up→down→down→up round-trip clean (67/67 executed); `validate:module-registry` (43 modules, 21 permission groups); `pnpm audit` 0 vulnerabilities                                    |
| 5   | Independent code review complete           | ✅ This project's own `code-review` skill (high effort, 8-angle finder pass, 1-vote verification) — 8 candidates after dedup, all 8 CONFIRMED. All 8 fixed (most severe: `updateStatus()` had no terminal-status guard, letting a decided review be reversed)                                            |
| 6   | Security review complete                   | ✅ `security-review` skill run separately, against the fixed branch — 0 findings above threshold                                                                                                                                                                                                         |
| 7   | Known out-of-scope gaps flagged, not fixed | ✅ None — every CONFIRMED finding was fixed, no accepted-debt items on this branch                                                                                                                                                                                                                       |
| 8   | Live end-to-end verified                   | ✅ Independently re-verified: every high-risk file read directly (migration, all three CAS repository methods, RBAC decorator placement, the dynamic per-action check in `decide()`, both barrel files), every test suite re-run against a fresh local disposable database                               |
| 9   | Documentation updated                      | ✅ `CLAUDE.md`'s "Recent decisions" entries updated                                                                                                                                                                                                                                                      |
| 10  | Exact branch/commit verified and recorded  | ✅ Branch `module-review-and-approval-center`, commits `4c6abac` (schema/repository) → `17f0787` (service/controller) → `f8c6bf2` (tests) → `50ed6d1` (code-review fixes) — not yet pushed to `origin`                                                                                                   |

## Forbidden-actions check

- No new RBAC/permission-group migration added — reuses the already-seeded `review_center` group
  verbatim.
- No new npm dependency was added.
- No confidential-field/redaction mechanism was needed — this module has none (task package D8,
  matching the module registry's real seeded `confidentialityLevel: null`).
- No hard-delete route exists (task package D9).

## Independent code review — summary

Full record: this session's `ReportFindings` calls, and `50ed6d1`'s own commit message. 8-angle
finder pass — 8 candidates survived dedup after 1-vote verification, all 8 CONFIRMED:

1. **`updateStatus()` had no terminal-status CAS guard** (CONFIRMED, most severe) — a caller who
   observed a review as `approved`/`rejected` and replayed that as `expectedStatus` could reverse
   a supposedly-permanent decision. **Fixed**: reject a terminal `expectedStatus` up front.
2. **Non-atomic, unguarded `review_decisions` writes across `decide()`/`setPaused()`/`delegate()`**
   (CONFIRMED) — a transient failure after the CAS write committed left the review's new state
   durably persisted with zero record of who changed it; for `setPaused()`/`delegate()`, that
   local history is the sole record. **Fixed**: `withTransaction()` wrapping the CAS write and the
   decision write together, mirroring `ProjectService.setActivePhase()`'s own pattern.
3. **`updateAssignee()` had no CAS on the prior assignee** (CONFIRMED) — two concurrent
   `delegate()` calls could both "succeed," writing contradictory decision rows. **Fixed**: added
   `expectedAssignedToUserId` as a real CAS parameter.
4. **`review_decisions` was write-only, no `GET` route** (CONFIRMED) — `listByReview()` was fully
   implemented but genuinely unreachable by any HTTP client. **Fixed**: added
   `GET /reviews/:id/decisions`, gated on `view`.
5. **`assertAssigneeExists()` was a 4th independent hand-copy** (CONFIRMED) of an existence-check
   pattern already present in `ProjectService`/`ServicesService`/`InternalLinksService`. **Fixed**:
   extracted `UsersService.assertUserExists(userId, fieldName)`.
6. **CAS-outcome exception mapping triple-duplicated**, service and repository layers (CONFIRMED).
   **Fixed**: shared `unwrapCasResult()`/`casUpdate()` helpers.
7. **`create()` ran two independent checks sequentially** (CONFIRMED) — the same
   avoidable-sequential-checks class this project's prior reviews have caught repeatedly. **Fixed**:
   `Promise.all`.
8. **Duplicated "review exists" guard in `review-comments.service.ts`** (CONFIRMED). **Fixed**:
   extracted `assertReviewExists()`.

No findings left as accepted, tracked debt — every CONFIRMED finding on this branch was fixed.

## Independent security review — summary

Full record: this session's transcript, run separately from the code review, against the fixed
branch. **0 findings above threshold.** Focused on:

- The dynamic per-action RBAC check inside `decide()` — confirmed a TypeScript-exhaustive mapping
  over a Zod-validated enum, no bypass path.
- `SeparationOfDutiesService.assertDistinctActors()`'s enforcement ordering relative to the new
  `withTransaction()` wrapping — confirmed the check runs and can throw before the transaction is
  ever entered.
- The new `GET /reviews/:id/decisions` route's authorization — confirmed gated identically to
  reading the review itself.
- `AuthorizationService.isValidModuleKey()`'s SQL parameterization — confirmed fully parameterized
  via Sequelize, no injection surface.
- The new `expectedAssignedToUserId` CAS field — confirmed no enumeration oracle (the conflict
  message deliberately omits the row's actual current assignee).
- Input validation across every Zod schema — confirmed length caps, escaped search filter, safe
  boolean-query-param pattern.

## Required second-role human review — AWAITING

- [ ] Code-review findings (8 CONFIRMED, all 8 fixed) — reviewed by: **pending**
- [ ] Security-review findings (0 above threshold) — reviewed by: **pending**

Review packet:
[Review and Approval Center Review Packet](https://claude.ai/code/artifact/f76de1a4-6bc4-4758-833b-b47698143d31)
(published as a Claude artifact — code review + security review findings, fixes, and validation
evidence, with a decision section).

## Sign-off

**Second-role human review: awaiting.**

This gate approval, push/PR, and merge authorization each remain separate, not-yet-requested next
steps.
