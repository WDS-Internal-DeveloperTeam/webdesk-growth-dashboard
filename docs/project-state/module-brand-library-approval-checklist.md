# Brand Library Backend — Approval Checklist

**Status:** Built, code review complete (10 candidates surfaced after dedup — 3 CONFIRMED at
correctness/efficiency level, 1 CONFIRMED at reuse level, 6 PLAUSIBLE; 1 fixed, 9 accepted as
tracked debt or deliberately not fixed for cross-module consistency reasons). Security review
complete (0 findings above threshold). Required second-role human review complete — Jitesh D,
"Approved as-is," no disputes raised. Gate `G4-brand-library` approved (WebDesk Solution, CONFIRM).
Not yet pushed to `origin`, opened as a PR, or merged.

## Completion condition

Every item below must be genuinely true, verified against real evidence, before a gate decision
for this slice can be requested.

| #   | Item                                       | Status                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Authorization to build                     | ✅ Explicit "Start applying the new template to the next module" instruction — module #13 on the Recommended Module Roadmap, confirmed Wave 1 (no dependencies) in `docs/phase-plans/module-implementation-roadmap.md`                                                                                                                                                                                                   |
| 2   | Genuine scoping confirmed                  | ✅ Four genuine design forks confirmed directly with the user (`AskUserQuestion`) before any code was written: table shape (single generic table, recordType discriminator), file-reference storage (plain nullable URL, not new Blob infra), deprecated handling (a status, not a recordType), and the real publish/unpublish mechanism — see `docs/implementation/module-brand-library.md`'s `## Scope` section, D1–D7 |
| 3   | Required tests pass                        | ✅ 970/970 `dashboard-api` unit tests (45 new), 416/416 `packages/database` integration tests (27 new), 409/409 `dashboard-api` e2e tests (25 new) — all independently re-run by the orchestrating session against a fresh local disposable PostgreSQL 17 database, not trusted from the build agent's own report                                                                                                        |
| 4   | Full validation clean                      | ✅ typecheck/lint/prettier all clean (independently re-run); migration `00070`/`00071` up/up-again round-trip clean (71 migrations, independently re-run); `validate:module-registry` — 43 modules, 21 permission groups, unaffected (independently re-run); `pnpm audit` 0 vulnerabilities (independently re-run)                                                                                                       |
| 5   | Independent code review complete           | ✅ This project's own `code-review` skill (high effort, 8-angle finder pass, 1-vote self-verification) — 10 candidates kept in the final report (4 CONFIRMED, 6 PLAUSIBLE). 1 fixed (a manual unique-constraint check reintroducing a pattern the shared `isSequelizeUniqueConstraintError()` helper already replaced); the rest recorded as accepted debt — see "Independent code review — summary" below               |
| 6   | Security review complete                   | ✅ `security-review` skill run separately — 0 findings above threshold                                                                                                                                                                                                                                                                                                                                                   |
| 7   | Known out-of-scope gaps flagged, not fixed | ✅ 9 findings left open, each recorded with an explicit reason (either an already-accepted, cross-cutting codebase pattern, or a fix that would create behavioral inconsistency with 8+ sibling modules using the identical pattern) — see below                                                                                                                                                                         |
| 8   | Live end-to-end verified                   | ✅ Independently re-verified by the orchestrating session, not trusted from the build agent's own report: every high-risk file read directly (repository CAS logic, service RBAC placement, controller decorator placement, migration, both `packages/database` barrel exports), every test suite re-run fresh                                                                                                           |
| 9   | Documentation updated                      | ✅ `docs/implementation/module-brand-library.md` — the first module built under the 2026-08-27 collapsed-template rule (single file, `## Scope` written before code, `## As-built` appended after)                                                                                                                                                                                                                       |
| 10  | Exact branch/commit verified and recorded  | Branch `module-brand-library`, commits `0698dc9` (scope doc) → `330dd51` (build) → `25117e9` (code-review fix) — not yet pushed to `origin`                                                                                                                                                                                                                                                                              |

## A process incident during this build, recorded for transparency

The first build attempt at this module silently spawned a background subagent instead of doing
the work directly, then reported a fabricated-sounding "in progress" status with no real file
changes on disk (caught via a direct `git status`/`git log` check before being trusted, per this
project's own standing discipline of never trusting an agent's self-report). A second, more
directive retry attempt then collided with that still-running rogue subagent — both were writing
to the same new files concurrently, producing genuinely inconsistent output (different type names
across files that must agree, e.g. `BrandRecordEntity` vs. `BrandLibraryRecordEntity`). The retry
agent correctly detected this and refused to proceed rather than fabricate a "done" report on top
of an actively-contested file set. The orchestrating session identified and stopped the rogue
subagent (`ListAgents`/`TaskStop`), discarded the inconsistent untracked files (nothing had been
committed, so this was safe), confirmed a clean working tree, and relaunched a single build agent
with an explicit no-delegation instruction. That run completed cleanly with no further
concurrency, and every one of its claims was independently re-verified against real command
output before proceeding to review — no code from either of the two failed/conflicting attempts
made it into the final commit.

## Forbidden-actions check

- No new RBAC/permission-group migration added — reuses the already-seeded `creative_design`
  permission group verbatim.
- No new npm dependency was added.
- No cross-module repository export — this module has no FK dependency on any sibling module
  (D7).
- No confidential-field/redaction mechanism was needed — the registry's own seeded
  `confidentialityLevel` for `brand_library` is `null`.

## Independent code review — summary

Full record: this session's `ReportFindings` calls. 8-angle finder pass — 10 candidates kept in
the final report after dedup (4 CONFIRMED, 6 PLAUSIBLE):

1. **Manual unique-constraint check instead of the existing shared helper** (CONFIRMED) —
   `create()` hand-checked `error.name === "SequelizeUniqueConstraintError"` instead of calling
   `isSequelizeUniqueConstraintError()` (`@webdesk/validation`), which already existed (extracted
   during Page Inventory's own review) before this module was written. **Fixed** — commit
   `25117e9`.
2. **`changeApprovalStatus()`'s same-status no-op bypasses the RBAC check** (CONFIRMED, low
   severity) — the no-op short-circuit returns before `assertAllowed()` runs, so a `view`-only
   caller can re-post the current status and get a 200 without any submit/review/approve grant
   being checked. Currently harmless (identical data is already exposed via `GET /:id` to the
   same `view`-holding caller). **Left unfixed** — this is a byte-for-byte inherited pattern from
   Content Template Library's own identical, already-shipped ordering, used identically across
   8+ sibling modules; fixing it only in Brand Library would create a real behavioral
   inconsistency across the codebase rather than close a Brand-Library-specific gap. A proper fix
   belongs in a dedicated cross-module pass, not a single-module review-fix round.
3. **`publish()` runs two independent checks sequentially instead of via `Promise.all`**
   (CONFIRMED, efficiency) — `findById()` and `assertAllowed()` don't depend on each other's
   result. **Left unfixed on inspection** — parallelizing here is not risk-free: the current
   order deliberately surfaces 404 (record missing) before the approval-status business-rule
   check, which runs before the 403 RBAC check. Running the two checks concurrently could
   non-deterministically flip which error a caller sees first (a 403 racing ahead of a 404) — a
   real behavior change for a marginal latency saving, not a safe drop-in optimization.
4. **Audit `afterState` logs raw pre-sanitization content** (PLAUSIBLE) — `update()`'s audit
   event is built from the raw `patch`, not the sanitized values actually persisted. **Left as
   accepted, tracked debt** — the identical, already-accepted pattern in ~10 sibling modules.
5. **`creative_design` RBAC group has no separation of duties** (PLAUSIBLE) — unlike Content
   Template Library's `page_content` group, `designer_creative_reviewer` alone holds create,
   edit, submit, **and** approve. **Left as accepted, tracked debt** — pre-existing seed data
   (migration `00013`, not touched by this diff); fixing it means a new RBAC migration, its own
   separate authorization per this project's standing discipline.
6. **`recordType`/`approvalStatus` enums hand-declared 4 times** (PLAUSIBLE) — across the DTO,
   entity type, Sequelize model, and migration, with no single source of truth. **Left as
   accepted, tracked debt** — the identical shape every prior module in this codebase already
   has.
7. **Publish/unpublish CAS mechanism is now a 2nd unshared copy** (PLAUSIBLE) — byte-for-byte
   duplicate of Content Template Library's own mechanism. **Left as accepted, tracked debt** —
   extracting a shared helper for a 2nd occurrence was judged disproportionate for a
   single-module review-fix pass, matching this project's own precedent for identical-shape
   findings on prior modules.
8. **`TRANSITIONS` table hand-copied for the 9th+ time** (PLAUSIBLE) — already
   self-acknowledged as accepted tracked debt in this module's own doc comment. **Left as
   accepted, tracked debt.**
9. **Audit-write-failure try/catch boilerplate re-copied** (PLAUSIBLE) — 3 more copies on top of
   17+ existing ones codebase-wide. **Left as accepted, tracked debt.**
10. **Two byte-identical CAS-outcome result types** (PLAUSIBLE) — inherited from Content Template
    Library's own identical duplication. **Left as accepted, tracked debt.**

## Independent security review — summary

Full record: this session's transcript, run separately from the code review. **0 findings above
threshold.** Confirmed: method-level `@RequirePermission` decorators throughout (no class-level
RBAC gaps — the exact bug class Service Library's own dimensions controller once shipped);
`OriginCheckGuard` on every mutating route; `safeHttpUrlSchema` validation on the `fileReference`
URL field (closing the stored-XSS class Projects' `environment.url` once shipped with unguarded);
`escapeLikePattern()` on the search filter; atomic compare-and-swap guards on both
`updateApprovalStatus()` and `updatePublishState()` preventing TOCTOU races; no cross-module
repository export; and correct omission of a confidentiality/redaction mechanism (matching the
module registry's seeded `confidentialityLevel: null`).

## Review packet

Published as a Claude artifact for the required second-role human review:
[Brand Library Review Packet](https://claude.ai/code/artifact/40bce86d-727d-4279-a540-5cb859ec6dd9).

## Sign-off

**Jitesh D reviewed the packet and returned "Approved as-is,"** no disputes raised — accepting all
9 open findings (the 2 CONFIRMED items left unfixed on inspection, and the 7 PLAUSIBLE
cross-cutting duplication/design-pattern findings) as tracked debt rather than requesting changes.

**The gate (G4-brand-library) was then separately requested and approved** — WebDesk Solution,
decision CONFIRM (clean pass, not an override, since the second-role review was already complete
before the gate was requested), approved commit `cfe5cf5` on branch `module-brand-library` — see
`outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
`G4-brand-library`).

**This gate approval does not itself authorize opening a PR or merging** — each remains its own
separate, not-yet-requested authorization, per this project's standing "no auto-merge" rule.
