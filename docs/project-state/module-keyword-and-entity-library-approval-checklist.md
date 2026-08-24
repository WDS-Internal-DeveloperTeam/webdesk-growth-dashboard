# Keyword & Entity Library Backend — Approval Checklist

**Status:** Built, code review complete (5 candidates surfaced after dedup — 4 CONFIRMED, 1
REFUTED — all 4 CONFIRMED fixed). Security review complete (0 findings above threshold). Required
second-role human review complete — Jitesh D, "Approves," no disputes raised. Awaiting a gate
decision.

## Completion condition

Every item below must be genuinely true, verified against real evidence, before a gate decision
for this slice can be requested.

| #   | Item                                       | Status                                                                                                                                                                                                                                                                                                                         |
| --- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Authorization to build                     | ✅ Explicit "Start Keyword & Entity Library" instruction, module #8 on the Recommended Module Roadmap, presented as the mechanically-correct next candidate (`docs/phase-plans/module-implementation-roadmap.md`, both dependencies already live)                                                                              |
| 2   | Genuine scoping confirmed                  | ✅ Two architectural forks confirmed directly with the user via `AskUserQuestion` — full 4-table relational model (chosen over a simplified single table), project-scoped (chosen over organization-wide). 8 further field-level decisions made directly, matching this project's own precedent                                |
| 3   | Required tests pass                        | ✅ 734/734 `dashboard-api` unit tests, 28/28 `packages/database` unit tests, 292/292 `packages/database` integration tests, 283/283 `dashboard-api` integration/e2e tests — all re-verified independently against a real disposable database after every fix round                                                             |
| 4   | Full validation clean                      | ✅ typecheck/lint/prettier all clean across `packages/database`, `apps/dashboard-api`, and `apps/dashboard-worker` (a third barrel consumer, checked as a safety net); migration up/down/up round-trip clean (61 migrations); `validate:module-registry` still 43 modules/21 permission groups; `pnpm audit` 0 vulnerabilities |
| 5   | Independent code review complete           | ✅ This project's own `code-review` skill (high effort, 8-angle finder pass, 1-vote verification) — 5 candidates after dedup, 4 CONFIRMED and fixed, 1 REFUTED (verified consistent with established precedent, not a new gap)                                                                                                 |
| 6   | Security review complete                   | ✅ `security-review` skill run separately, against the fixed branch — 0 findings above threshold                                                                                                                                                                                                                               |
| 7   | Known out-of-scope gaps flagged, not fixed | ✅ `page_inventory.pages.targetKeyword` (a pre-existing free-text field) is explicitly not reconciled with the new `page_keyword_assignments` join table in this pass (task package D10) — both coexist; reconciliation is a separate, not-yet-requested follow-up                                                             |
| 8   | Live end-to-end verified                   | ✅ Independently re-verified against a real local disposable PostgreSQL 17 database — every high-risk file (migration, RBAC decorator placement, CAS guard, cross-module wiring) read directly, every test suite re-run, not just trusted from the build's own report                                                          |
| 9   | Documentation updated                      | ✅ `CLAUDE.md`'s Active tasks / "Recent decisions" entries updated                                                                                                                                                                                                                                                             |
| 10  | Exact branch/commit verified and recorded  | ✅ Branch `module-keyword-and-entity-library`, commits `6f68895` (task package) → `ef7a97c` (schema/repository layer) → `8152d0d` (API layer) → `d9465d6` (tests) → `01b3b91` (code-review fixes) — not yet pushed to `origin`                                                                                                 |

## Forbidden-actions check

- No new RBAC/permission-group migration added — reuses the already-seeded `keyword_internal_links`
  permission group verbatim.
- No new npm dependency was added.
- `PagesService.existsInProject()` returns only a `boolean`, never a page record, and is not
  exported for any caller beyond `PageKeywordAssignmentsService` — the write-capable
  `PAGE_REPOSITORY` token is never crossed over the module boundary, matching this project's own
  standing precedent (closing the exact exposure class `module-persona-library`'s own security
  review once flagged for `SERVICE_REPOSITORY`).
- No confidential-field/redaction mechanism was built — the module registry's own seeded
  `confidentialityLevel` value describes the approval workflow, not an access-control tier (task
  package D4), matching Persona Library's and Proof and Claims Library's own identical precedent.

## Independent code review — summary

Full record: this session's `ReportFindings` call (commit `01b3b91`). 8-angle finder pass — 5
candidates survived dedup after 1-vote verification, 4 CONFIRMED and fixed:

1. **`shortTextField` allowed up to 255 characters, but the 5 columns it validates
   (`keywordType`/`intent`/`funnelStage`/`country` on `keywords`, `entityType` on `entities`) are
   all `VARCHAR(100)`** (most severe) — a value between 101–255 characters passed Zod but crashed
   the actual INSERT/UPDATE with an unhandled Postgres "value too long" 500 instead of a clean 400. **Fixed**: tightened to `max(100)`, matching the real column width and
   `listKeywordsQuerySchema`'s own already-correct limit on the same fields' filter counterparts.
   4 new regression tests added.
2. **`PageKeywordAssignmentsService.create()` and `KeywordEntityRelationshipsService.create()` ran
   two independent existence checks sequentially** despite both sharing the same already-known
   `projectId` with no real data dependency — an avoidable extra DB round trip, the exact bug
   class a prior code review on Persona Library already caught and fixed once. **Fixed**: both now
   use `Promise.all`, mirroring `PersonasService.create()`'s own fix.
3. **Both join-table services independently declared an identical `UUID_PATTERN` regex** (the 4th
   and 5th copy codebase-wide) guarding `entityId`/`pageId` before a cross-module existence
   check — but unlike Persona Library's `relatedServiceIds` (a plain, unvalidated array),
   `entityId`/`pageId` are already `z.string().uuid()`-validated by `ZodValidationPipe` before
   either service method ever runs, so the guard was unreachable dead code on the only path that
   calls it. **Fixed**: removed from both files.
4. **`PageKeywordAssignmentsService.create()`'s `input` parameter was a hand-declared inline type**
   instead of the existing `CreatePageKeywordAssignmentDto`, unlike every sibling service in this
   module. **Fixed**: now imports and reuses the DTO type directly.
5. **REFUTED**: `EntityRepository.update()`'s `{id}`-only `WHERE` clause (no `projectId` scoping) —
   a dedicated verifier confirmed this is fully consistent with both `KeywordRepository.update()`'s
   own identical scoping and Page Inventory's own established `PageRepository.update()` precedent
   (both rely on the service-layer `findById(id, projectId)` pre-fetch, reserving repository-level
   `projectId` scoping for the destructive `remove()` path only) — not a new gap this branch
   introduces.

## Independent security review — summary

Full record: this session's transcript, run separately from the code review, against the fixed
branch (commit `01b3b91`). **0 findings above threshold.** Confirmed:

- All 4 controllers place `@RequirePermission` on every individual method, never class-level.
- The dynamic per-transition submit/review/approve gate in `KeywordsService.changeApprovalStatus()`
  correctly threads `projectId` into `AuthorizationService.assertAllowed()`, honoring a
  project-scoped-only grant.
- IDOR scoping is correct across all 4 tables, including both join tables — `remove()` on both
  scopes by `{id, keywordId}` at the DB layer, not just the caller-supplied `id`.
- `PagesService.existsInProject()` returns only a boolean, is not exposed via any route, and has
  exactly one caller.
- No SQL injection surface — all queries parameterized via Sequelize, search filters correctly use
  `escapeLikePattern()`.
- The code-review fix removing the malformed-UUID guard is genuinely sound — `ZodValidationPipe`
  rejects a non-UUID `entityId`/`pageId` before either controller method body ever executes, and
  neither service is reachable from any other caller.
- Response shapes contain only the columns the module's own schema defines — no extraneous data
  exposure.

## Required second-role human review — COMPLETE

- [x] Code-review findings (4 CONFIRMED and fixed, 1 refuted) — reviewed by: **Jitesh D**,
      2026-08-23, **Approves**.
- [x] Security-review findings (0 above threshold) — reviewed by: **Jitesh D**, 2026-08-23,
      **Approves**.

Review packet:
[Keyword & Entity Library Review Packet](https://claude.ai/code/artifact/9bfb497a-9d60-4177-a16e-d1e77e4ddd40)
(published as a Claude artifact — code review + security review findings, fixes, and validation
evidence, with a decision section).

## Sign-off

**Second-role human review: complete.** No disputes raised — every confirmed code-review finding
was already fixed, the 1 refuted finding was independently re-verified as consistent with
established precedent, and the security review found 0 findings above threshold — there was no
open item to accept as tracked debt.

| Field                         | Value                                                                                                                                                |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reviewer (second-role review) | Jitesh D                                                                                                                                             |
| Review date                   | 2026-08-23                                                                                                                                           |
| Decision                      | Approves                                                                                                                                             |
| Scope reviewed                | Full code-review disposition (4 findings fixed, 1 refuted) and full security-review disposition (0 above threshold), per the published review packet |
| Disputes raised               | None recorded                                                                                                                                        |

A gate decision, push/PR, and merge authorization each remain separate, not-yet-requested next
steps, per this project's standing "no auto-merge" rule.
