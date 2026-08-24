# Internal Linking Library Backend — Approval Checklist

**Status:** Built, code review complete (10 candidates surfaced after dedup — 9 CONFIRMED, 1
REFUTED — 8 of 9 CONFIRMED fixed, 1 left as accepted tracked debt, recorded directly in code).
Security review complete (0 findings above threshold). Awaiting required second-role human review.

## Completion condition

Every item below must be genuinely true, verified against real evidence, before a gate decision
for this slice can be requested.

| #   | Item                                       | Status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Authorization to build                     | ✅ Explicit "Start Internal Linking Library" instruction, module #9 on the Recommended Module Roadmap, presented as the mechanically-correct next candidate                                                                                                                                                                                                                                                                                                                                                       |
| 2   | Genuine scoping confirmed                  | ✅ One genuine architectural fork confirmed directly with the user via `AskUserQuestion` — a bespoke 4-state workflow (proposed/approved/implemented/verified), chosen over the standard 8-value generic lifecycle every prior module reuses. 8 further field-level decisions made directly, matching this project's own precedent                                                                                                                                                                                |
| 3   | Required tests pass                        | ✅ 787/787 `dashboard-api` unit tests (42/42 for this module), 28/28 `packages/database` unit tests, 23/23 `packages/database` integration tests, 312/312 `dashboard-api` integration/e2e tests (29/29 for this module) — all re-verified independently against a real disposable database after every fix round                                                                                                                                                                                                  |
| 4   | Full validation clean                      | ✅ typecheck/lint/prettier all clean across `packages/database` and `apps/dashboard-api`; migration up/down/up round-trip clean (63 migrations, confirming the amended composite indexes); `validate:module-registry` still 43 modules/21 permission groups; `pnpm audit` 0 vulnerabilities                                                                                                                                                                                                                       |
| 5   | Independent code review complete           | ✅ This project's own `code-review` skill (high effort, 8-angle finder pass, 1-vote verification) — 10 candidates after dedup, 9 CONFIRMED and 8 fixed (1 left as accepted, documented tracked debt), 1 REFUTED                                                                                                                                                                                                                                                                                                   |
| 6   | Security review complete                   | ✅ `security-review` skill run separately, against the fixed branch — 0 findings above threshold                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 7   | Known out-of-scope gaps flagged, not fixed | ✅ `changeStatus()`'s same-status no-op short-circuit returns before the per-transition `assertAllowed()` check runs — the byte-identical, already-shipped ordering `PagesService.changeWorkflowStage()`/`KeywordsService.changeApprovalStatus()` both have, flagged directly in code for the second-role reviewer rather than fixed unilaterally. `relatedStrategyRecordId` remains a plain unvalidated UUID string (task package D8) — Website Strategy Center has no validation hook for this relationship yet |
| 8   | Live end-to-end verified                   | ✅ Independently re-verified against a real local disposable PostgreSQL 17 database — every high-risk file (migration, repository CAS/COALESCE mechanism, service, RBAC decorator placement, DTO, module wiring, barrel exports, app.module.ts wiring) read directly, every test suite re-run, not just trusted from the build's own report                                                                                                                                                                       |
| 9   | Documentation updated                      | ✅ `CLAUDE.md`'s Active tasks / "Recent decisions" entries to be updated after second-role review                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 10  | Exact branch/commit verified and recorded  | ✅ Branch `module-internal-linking-library`, commits `94bad01` (task package) → `5e70994` (schema/repository layer) → `1cbff23` (API layer) → `8afee06` (integration tests) → `633417a` (unit/e2e tests) → `2d2c4ed` (code-review fixes) — not yet pushed to `origin`                                                                                                                                                                                                                                             |

## Forbidden-actions check

- No new RBAC/permission-group migration added — reuses the already-seeded
  `keyword_internal_links` permission group verbatim (the same group Keyword & Entity Library
  uses, per task package §4 — not a coincidence).
- No new npm dependency was added.
- `PagesService.existsInProject()` returns only a `boolean`, never a page record; `UsersService.findById()`
  is the same already-reviewed helper `ProjectService.assertOwnerExists()` uses elsewhere. Neither
  module's write-capable repository token is exported across the module boundary — this module only
  imports each sibling's own service class.
- No confidential-field/redaction mechanism was built — the module registry's own seeded
  `confidentialityLevel` for `internal_linking_library` is `null`, matching Persona Library's/Proof
  and Claims Library's/Keyword & Entity Library's own identical precedent.

## Independent code review — summary

Full record: this session's `ReportFindings` calls (initial report, then re-reported with outcomes
after commit `2d2c4ed`). 8-angle finder pass — 10 candidates survived dedup after 1-vote
verification, 9 CONFIRMED, 1 REFUTED:

1. **Self-link rejection used case-sensitive `===` on UUID strings** (most severe) — Zod's
   `.uuid()` accepts mixed-case UUIDs unchanged, so two differently-cased representations of the
   identical page id passed validation but weren't `===`-equal, letting a genuine self-link through
   in both `create()` and `update()`. **Fixed**: extracted a shared `assertDistinctPages()` helper
   comparing case-insensitively, with new regression tests on both paths.
2. **`changeStatus()`'s same-status no-op short-circuit returns before the per-transition
   `assertAllowed()` RBAC check runs** — a caller holding only the route's baseline `view` grant
   gets a 200 re-requesting the link's own current status, without the transition-specific
   authorization check a real transition would require. **Left as accepted, tracked debt**,
   flagged directly in code: no state mutation occurs and the response is identical to what
   `GET /:id` already permits under the same grant; this is the byte-identical, already-shipped
   ordering `PagesService.changeWorkflowStage()`/`KeywordsService.changeApprovalStatus()` both
   have, and fixing only this new module would diverge from two already-live siblings for a fix
   whose correct shape isn't specified anywhere.
3. **The "call `existsInProject`, throw `BadRequestException` if false" pattern was hand-copied 4
   times** (sourcePageId/targetPageId in both `create()` and `update()`) instead of reusing the
   exact private-helper convention the file already establishes via `assertApproverExists()`.
   **Fixed**: extracted `assertPageExists()`, used by all 4 call sites.
4. **`update()`'s conditional field-revalidation built a mutable `checks` array** with 3
   conditional `.push()` calls plus a length guard, where the sibling `ServicesService.update()`
   solves the identical problem with one `Promise.all([cond ? assertX() : Promise.resolve(), ...])`
   literal. **Fixed**: rewritten to match — same behavior, less code, no mutable state.
5. **The RBAC `MODULE_KEY` string literal was independently declared in both
   `internal-links.service.ts` and `internal-links.controller.ts`** instead of the module's own
   already-existing `internal-linking-library.constants.ts`. **Fixed**: promoted to a single
   exported `INTERNAL_LINKING_LIBRARY_MODULE_KEY` constant, imported by both files.
6. **No composite index covered `(project_id, source_page_id)`/`(project_id, target_page_id)`**,
   even though `project_id` is mandatory on every `list()` call and both page ids are real,
   client-reachable optional filters. **Fixed**: migration `00062` amended (not superseded — it
   hadn't shipped anywhere yet) to replace the bare single-column indexes with composite ones led
   by `project_id`.
7. **The "source must not equal target" invariant check was independently re-implemented in both
   `create()` and `update()`** with byte-identical exception type/message. **Fixed**: folded into
   the same `assertDistinctPages()` extraction as finding 1.
8. **`update()`'s `targetPageId` re-validation branch had zero test coverage anywhere**, unlike
   the structurally identical `sourcePageId` branch (positive + negative test). **Fixed**: added
   the mirrored pair.
9. **`update()`'s cross-project page-existence check was only ever exercised against a mocked
   `pages.existsInProject` boolean**, never against a real database with a genuinely
   different-project page id — unlike `create()`, which has a dedicated e2e test for exactly this
   scenario. **Fixed**: added the real-database e2e counterpart.
10. **REFUTED**: no DB-level `CHECK` constraint for `source_page_id <> target_page_id` — a
    dedicated verifier confirmed the task package's own D4 decision explicitly considered and
    rejected a database-layer constraint here, and the three cited "sibling precedents" are not
    actually comparable in kind (single-column bound checks / completeness checks / format
    checks, not a same-table self-referential inequality between two FK columns) — not an
    oversight this branch introduces.

## Independent security review — summary

Full record: this session's transcript, run separately from the code review, against the fixed
branch (commit `2d2c4ed`). **0 findings above threshold.** Confirmed:

- `@RequirePermission` is placed on every individual controller method, never class-level.
- `changeStatus()` correctly threads `link.projectId` (itself already IDOR-verified via the prior
  `findById(id, projectId)` call) into `assertAllowed(actorUserId, MODULE_KEY, requiredAction, link.projectId)`,
  honoring a project-scoped-only grant — closing the exact gap Page Inventory's own code review
  caught once.
- IDOR scoping is correct — `findById()` compares `link.projectId !== projectId` and 404s on
  mismatch before every mutation reaches the repository.
- The recently-fixed `assertDistinctPages()`/`assertPageExists()` helpers introduce no residual
  bypass — the case-insensitive comparison runs before either page-existence check, so no
  cross-case duplicate self-link can slip through.
- The search filter correctly reuses the shared, already-audited `escapeLikePattern()` helper — no
  SQL injection surface.
- The COALESCE-based conditional timestamp stamping in `updateStatus()` is a fixed string literal
  with no interpolated user input, baked into the same atomic `UPDATE` as the CAS guard — no
  authorization-bypass or data-integrity gap.
- `relatedStrategyRecordId` is Zod-validated as a UUID at the boundary and never interpolated into
  any SQL string, URL, or file path anywhere in the diff — purely inert stored data, consistent
  with its documented "no FK, no validation" design decision.
- Both `packages/database/src/index.ts` and `index.cjs.ts` barrels were updated in lockstep,
  avoiding the previously-documented production-outage class of bug from earlier in this project's
  history.

## Required second-role human review — PENDING

- [ ] Code-review findings (8 CONFIRMED and fixed, 1 accepted as tracked debt, 1 refuted) — not
      yet reviewed.
- [ ] Security-review findings (0 above threshold) — not yet reviewed.

Review packet:
[Internal Linking Library Review Packet](https://claude.ai/code/artifact/23e6cd36-4c08-4dcf-af1d-d74cd5ebcb72)
(published as a Claude artifact — code review + security review findings, fixes, and validation
evidence, with a decision section).

A gate decision, push/PR, and merge authorization each remain separate, not-yet-requested next
steps, per this project's standing "no auto-merge" rule.
