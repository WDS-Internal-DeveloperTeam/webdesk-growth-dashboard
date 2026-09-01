# Portfolio Library Module Backend — Approval Checklist

**Status:** Code review complete (8-angle finder pass, 8 candidates kept after dedup — 5 CONFIRMED
fixed, 1 attempted fix reverted after inspection showed the original order was intentional, 2 left
as accepted tracked debt matching an established sibling-module convention, plus 1 more accepted
debt item surfaced separately). Security review complete (0 findings above threshold). Required
second-role human review complete — WebDesk Solution, "Approve (CONFIRM)," no disputes raised.
Gate (G4-portfolio-library) approved. Not yet pushed to `origin`, opened as a PR, or merged.

## Completion condition

Every item below must be genuinely true, verified against real evidence, before a gate decision
for this slice can be requested.

| #   | Item                                       | Status                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Authorization to build                     | ✅ Explicit "start the portfolio library" instruction — module #25 on the Recommended Module Roadmap                                                                                                                                                                                                                                                                                                                                              |
| 2   | Genuine scoping decisions surfaced         | ✅ Four forks confirmed with the user via `AskUserQuestion` before building: screenshots as a real join into Asset Library vs. a plain array; proof as a real existence-validated `relatedProofIds` vs. an unvalidated array; `visibility`'s vocabulary (reused Case Study Studio's own 4-value enum); whether to build a real publish/unpublish mechanism for the seeded `P` RBAC grant — user chose the recommended (fuller) option in all four |
| 3   | Required tests pass                        | ✅ 52/52 `dashboard-api` unit tests, 33/33 `packages/database` integration tests, 31/31 `dashboard-api` e2e tests — all independently run by the orchestrating session against a real disposable PostgreSQL 17 database using credentials the user supplied directly, re-run again after the code-review fix round and again after merging in concurrent `origin/main` work (Case Study Library, migrations 00093/00094)                          |
| 4   | Full validation clean                      | ✅ `packages/database`/`dashboard-api` build clean; lint (`--max-warnings=0`)/`prettier --check` clean on every touched file; migration `up` round-trip clean (96 migrations total, including 00093–00096); `pnpm validate:module-registry` — 43 modules, 21 permission groups, all references resolve                                                                                                                                            |
| 5   | Independent code review complete           | ✅ High-effort 8-angle finder pass — 8 findings kept after dedup; see "Independent code review — summary" below                                                                                                                                                                                                                                                                                                                                   |
| 6   | Security review complete                   | ✅ Reviewed directly against the diff (guard/decorator placement, mass-assignment exclusions, IDOR scoping, input validation, raw-SQL safety) — 0 findings above threshold                                                                                                                                                                                                                                                                        |
| 7   | Known out-of-scope gaps flagged, not fixed | ✅ No `dashboard-web` UI in this pass, matching every prior module's own backend-first precedent — a separate, not-yet-requested next step                                                                                                                                                                                                                                                                                                        |
| 8   | Documentation updated                      | ✅ `docs/implementation/module-portfolio-library.md` (Scope + As-built + code review + security review sections, collapsed single-file format per the 2026-08-27 standing rule)                                                                                                                                                                                                                                                                   |
| 9   | Exact branch/commit verified and recorded  | ✅ Branch `module-portfolio-library`, commits (build, merge of `origin/main`, review-doc updates) — not yet pushed to `origin`                                                                                                                                                                                                                                                                                                                    |

## Forbidden-actions check

- No `dashboard-web` UI built — backend only, matching every prior module's own backend-first
  precedent.
- No new RBAC/permission-group migration added — reuses the already-seeded `portfolio` permission
  group verbatim.
- No hard-delete route on `portfolio_records` — matches ADR-0016's project-wide no-hard-delete
  policy (the seeded `portfolio` group has no `D` action). `portfolio_assets` link rows may be
  removed (unlinking a screenshot is not deleting business content).
- `@RequirePermission` is placed on every individual controller method, never at class level —
  confirmed directly and by the code review.
- Both `packages/database/src/index.ts` and `index.cjs.ts` (the separately-maintained CJS barrel
  Vercel's production bundler actually uses) were updated together — confirmed directly, and
  re-verified after the merge conflict resolution against `origin/main`'s own concurrent
  `case-study-library` barrel addition.

## Independent code review — summary

Full record: `docs/implementation/module-portfolio-library.md`. 8-angle finder pass (3 correctness
angles, reuse, simplification, efficiency, altitude, conventions) surfaced 8 findings kept after
dedup:

1. **`update()` races `findById()` (404) against `assertProofIdsExist()` (400) via `Promise.all`**,
   making the response status nondeterministic for a nonexistent record with an invalid
   `relatedProofIds` entry. Left as accepted, tracked debt — byte-for-byte inherited from
   `PersonasService.update()`'s/`ServicesService.update()`'s own identical, already-shipped shape.
2. **`changeApprovalStatus()`'s same-status no-op returns before the RBAC check runs**, letting a
   caller with only baseline `view` "succeed" a self-transition. Left as accepted, tracked debt —
   matches Content Template Library's/Brand Library's own identical ordering.
3. **`relatedProofIds` was validated with a generic free-text schema instead of a UUID array.**
   Fixed — retyped to `z.array(z.string().uuid())` at the DTO layer, ahead of the service's own
   `UUID_PATTERN` filter (kept as defense-in-depth).
4. **`publish()` ran `findById()`/`assertAllowed()` sequentially when they looked independent.**
   Attempted fix (parallelize via `Promise.all`) broke an existing unit test and, on inspection, the
   sequential order is deliberate — a non-approved record must fail with the more specific 400
   without needing "publish" permission at all. Reverted; no change made.
5. **`PortfolioAssetsService.remove()` had a redundant manual IDOR pre-check** duplicating the
   already-scoped repository call's own compound `WHERE` clause. Fixed — the manual check removed,
   with one unit test updated to match (the scoped repository call is now the sole enforcement
   point, verified by the test asserting it's still invoked with the correct arguments and that a
   mismatch still 404s).
6. **A duplicated empty-patch `.refine()` validator** appeared in two schemas. Fixed — extracted
   into a shared `rejectEmptyPatch()` helper.
7. **A triplicated "log, don't throw" audit try/catch** appeared across three methods. Fixed —
   extracted into a shared `recordAuditSafely()` private method.
8. **`updatePublishState()`'s two adjacent boolean parameters** risk transposition at a future call
   site. Left as accepted, tracked debt — matches
   `ContentTemplateRepository.updatePublishState()`'s own identical signature verbatim.

Re-validated after every fix: 52/52 `dashboard-api` unit tests, 33/33 `packages/database`
integration tests, 31/31 `dashboard-api` e2e tests, `validate:module-registry` clean.

## Security review — summary

Reviewed directly against the diff. `SessionGuard`/`PermissionGuard`/`OriginCheckGuard` correctly
placed on every route (method-level `@RequirePermission`, never class-level), `ParseUUIDPipe` on
every path param, `ZodValidationPipe` on every body, no mass-assignment path (`approvalStatus`/
`isPublished`/`publishedAt`/`version` all excluded from the create/update DTOs), IDOR scoping on
the `portfolio_assets` sub-resource enforced by the repository's own compound `WHERE` clause, `url`
validated via the shared `safeHttpUrlSchema`, search routed through `escapeLikePattern()`, and both
raw `sequelize.query()` calls in the migration are static SQL with no interpolated input. No new
attack surface — this module reuses every security-relevant mechanism already vetted across 10+
sibling modules. **0 findings above threshold.**

## Sign-off

- **Required second-role human review**: WebDesk Solution reviewed the code-review and
  security-review summaries above and returned **"Approve (CONFIRM),"** no disputes raised —
  accepting the 3 open tracked-debt findings (items 1, 2, 8) as-is.
- **Gate decision**: **G4-portfolio-library approved** — WebDesk Solution, decision CONFIRM (clean
  pass, not an override, since the second-role review was already complete before the gate was
  requested).
- **This gate approval does not itself authorize pushing the branch, opening a PR, or merging** —
  each remains its own separate, not-yet-requested authorization, per this project's standing
  "no auto-merge" rule.
