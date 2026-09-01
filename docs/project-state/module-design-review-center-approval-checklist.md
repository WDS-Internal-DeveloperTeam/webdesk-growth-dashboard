# Design Review Center Module Backend — Approval Checklist

**Status:** Code review complete (high-effort 8-angle finder pass — 5 candidates, 2 CONFIRMED
fixed, 3 PLAUSIBLE, 2 fixed and 1 accepted as tracked debt). Security review complete (0 findings
above threshold). Required second-role human review complete — Jitesh D, "Approved," no disputes
raised. Gate decision, push, and merge remain each a separate, not-yet-requested next step.

## Completion condition

Every item below must be genuinely true, verified against real evidence, before a gate decision
for this slice can be requested.

| #   | Item                                         | Status                                                                                                                                                                                                                                                                                                                       |
| --- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Authorization to build                       | ✅ Explicit "start design review center" instruction — module #21 on the canonical module registry, all 6 dependencies (component_library, design_token_library, section_and_pattern_library, page_template_library, wireframe_library, motion_and_interaction_library) already live                                         |
| 2   | Genuine scoping decision surfaced            | ✅ One real fork confirmed with the user via `AskUserQuestion` before building: extend the existing `reviews` table with a nullable `reviewType` column vs. a dedicated `design_reviews`/`design_review_decisions` table pair vs. no new schema at all. The user chose the dedicated table pair.                             |
| 3   | Migration numbering                          | ✅ Explicitly numbered `00089`/`00090`, past the still-open, unmerged PR #86/#87 (Motion and Interaction Library, which claimed `00086`–`00088`) per the user's own instruction to account for it even though not yet merged — confirmed no collision after the merge landed first.                                          |
| 4   | Required tests pass                          | ✅ Independently re-run by the orchestrating session against a real disposable PostgreSQL 17 database: 1372/1372 `dashboard-api` unit tests (26 new), 26/26 module integration tests (24 original + 2 new race-condition regression tests), 24/24 e2e tests — all solo runs against a freshly recreated database             |
| 5   | Full validation clean                        | ✅ Migration round-trip (87/87 applied, 0 pending, repeated 6+ times), `validate:module-registry` (43 modules, 21 permission groups), typecheck/lint (`--max-warnings=0`)/prettier clean across `packages/database` and `dashboard-api`, `pnpm audit` 0 vulnerabilities                                                      |
| 6   | Independent code review complete             | ✅ High-effort 8-angle finder pass — 5 candidates kept after dedup (2 CONFIRMED, 3 PLAUSIBLE). Most severe: a real race condition letting two concurrent approvals of different reviews for the same tuple both end up "approved" — fixed with a new `lockTupleForApproval()` `SELECT ... FOR UPDATE` lock + regression test |
| 7   | Security review complete                     | ✅ `security-review` skill run separately — 0 findings above threshold                                                                                                                                                                                                                                                       |
| 8   | Known accepted-debt items flagged, not fixed | ✅ 1 PLAUSIBLE finding left open: `unwrapCasResult()`/`casUpdate()` duplicated from the sibling `review-and-approval-center` module with no shared extraction — matches this project's own already-accepted duplication class for this pattern                                                                               |
| 9   | Documentation updated                        | ✅ `docs/implementation/module-design-review-center.md` (Scope + As-built, collapsed single-file format)                                                                                                                                                                                                                     |
| 10  | Exact branch/commit verified and recorded    | ✅ Branch `module-design-review-center`, commits `44faa4a` (build), `eaa08e1` (as-built doc), `43c272d` (code-review fixes), `dfbfead` (code-review doc), `5b7e6d1` (security-review doc) — not yet pushed to `origin`                                                                                                       |

## Forbidden-actions check

- No `dashboard-web` UI built — backend only, matching every prior module's own backend-first
  precedent.
- No new RBAC/permission-group migration added — reuses the already-seeded `review_center`
  permission group verbatim (shared with Review and Approval Center).
- No hard-delete route — matches ADR-0016's project-wide no-hard-delete policy; `decide()`/
  `create()` are the only mutation paths.
- `@RequirePermission` is placed on every individual controller method, never at class level —
  confirmed directly and by both the code review and security review.
- Both `packages/database/src/index.ts` and `index.cjs.ts` (the separately-maintained CJS barrel
  Vercel's production bundler actually uses) were updated together — confirmed directly, not
  assumed.

## Independent code review — summary

High-effort 8-angle finder pass, plus a dedicated verification pass on the most severe candidate.
5 candidates kept after dedup (2 CONFIRMED, 3 PLAUSIBLE). **3 fixed**:

1. **[CONFIRMED, HIGH]** Two concurrent `decide(approve)` calls on two different pre-existing
   reviews sharing the same `(targetModuleKey, targetId, reviewType)` tuple could both commit
   `"approved"` under Postgres's default READ COMMITTED isolation — `supersedeOtherApproved()`'s
   scan only sees data committed before its own statement started. Independently verified: no
   isolation-level override, no row-spanning lock, no unique constraint on the tuple existed to
   prevent it, and the sibling `WebsiteStrategyRecordRepository.supersedeOtherApprovedVersion()`
   this pattern was modeled on has the identical structural gap (not a regression unique to this
   module). Fixed with a new `DesignReviewRepository.lockTupleForApproval()` — a
   `SELECT ... FOR UPDATE` lock on the whole tuple, acquired before the CAS update whenever
   `decide()` would produce `"approved"` — serializing concurrent approvers. A new regression test
   races two reviews for the same tuple via `Promise.all` and proves exactly one ends up
   `approved`/the other `superseded`, never both.
2. **[CONFIRMED, efficiency]** `DesignReviewRepository.list()`'s standalone `?reviewType=` filter
   had no supporting index (only a 3-column composite led by `target_module_key`/`target_id`).
   Fixed with a dedicated `review_type` index.
3. **[PLAUSIBLE, efficiency]** The 2-column `(target_module_key, target_id)` index was a strict,
   unused prefix of the 3-column composite added right after it. Dropped alongside fix #2.

**2 PLAUSIBLE findings left as accepted, tracked debt**: `supersedeOtherApproved()` returning full
mapped entities when the service layer only ever reads `.id`; and `unwrapCasResult()`/
`casUpdate()` being a 2nd hand-copied instance of the identical CAS-conflict-resolution helper
already in the sibling `review-and-approval-center` module, with no shared extraction — both match
this project's own already-accepted duplication/efficiency debt class for this pattern.

## Security review — summary

`security-review` skill run separately. **0 findings above threshold.** Confirmed: every RBAC
decorator is method-level (never class-level), `decide()`'s dynamic action-to-permission mapping
is exhaustive over the Zod-validated closed action enum (no path to a weaker-than-intended
permission), `SeparationOfDutiesService.assertDistinctActors()` runs unconditionally before every
approval-shaped write, the module's organization-wide scope matches its seeded `module_registry`
entry (not a deviation from the already-reviewed sibling module), `sanitizeNullableRichText()`
covers the only rich-text field (`notes`) on every write path, no raw SQL string interpolation
exists anywhere (including the new `lockTupleForApproval()`, which uses parameterized Sequelize
`where` clauses, not raw SQL), and the concurrent-approval race the code review found is now
closed by that same lock. No secrets present.

## Sign-off

Required second-role human review: **complete.** The review packet (published as a Claude
artifact — scope, design decisions, code review + security review results, and validation
evidence, with a decision section, at
https://claude.ai/code/artifact/6e881b3c-032f-4703-9e3f-b5a0d96b34ff) was reviewed, since the
implementing agent cannot also be its own reviewer (ADR-0010). **Jitesh D reviewed it and returned
"Approved,"** no disputes raised — both open PLAUSIBLE findings (accepted as tracked debt) and the
one CONFIRMED efficiency finding were left as recorded.

Gate decision, push, and merge: each remains its own separate, not-yet-requested next step.
