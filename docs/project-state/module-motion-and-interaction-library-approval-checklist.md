# Motion and Interaction Library Module Backend — Approval Checklist

**Status:** Code review complete (10 candidates surfaced across 8 finder angles, deduped to 3
survivors, 1 CONFIRMED and fixed, 1 PLAUSIBLE left as accepted tracked debt, 1 REFUTED). Security
review complete (0 findings above threshold). Migration numbers renumbered `00084`/`00085`/`00086`
→ `00086`/`00087`/`00088` after merging `main` (Wireframe Library, module #16, took `00084`/
`00085` while this branch was in progress) — independently re-verified after the renumber.
**Awaiting required second-role human review and gate decision** — neither has happened yet.

## Completion condition

Every item below must be genuinely true, verified against real evidence, before a gate decision
for this slice can be requested.

| #   | Item                                       | Status                                                                                                                                                                                                                                                                                                                                         |
| --- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Authorization to build                     | ✅ Explicit "start Motion & Interaction Library" instruction, presented as one of two "what's next" candidates from the module roadmap                                                                                                                                                                                                         |
| 2   | Genuine scoping decisions surfaced         | ✅ Two questions confirmed directly with the user via `AskUserQuestion` before building: the field set (category enum + 8 content fields, modeled on §18's bare taxonomy) and `relatedComponentIds` as a real, existence-validated relationship into Component Library rather than an unvalidated array                                        |
| 3   | Required tests pass                        | ✅ 1386/1386 `dashboard-api` unit tests (41 new), 620/620 `packages/database` integration tests (26 new), 625/625 `dashboard-api` e2e/integration tests (27 new) — all against a real disposable PostgreSQL 17 database, independently re-run after both the fix round and the renumbering, not just trusted from the build agent's own report |
| 4   | Full validation clean                      | ✅ typecheck/lint (`--max-warnings=0`)/prettier clean across `packages/database` and `apps/dashboard-api`; migration up/down/up round-trip clean (88 migrations); `validate:module-registry` unaffected (43 modules, 21 permission groups); `pnpm audit` 0 vulnerabilities                                                                     |
| 5   | Independent code review complete           | ✅ High-effort 8-angle finder pass — 3 candidates survived dedup and verification (1 CONFIRMED, 1 PLAUSIBLE, 1 REFUTED); the CONFIRMED finding fixed and re-validated, the PLAUSIBLE finding left as accepted, tracked debt                                                                                                                    |
| 6   | Security review complete                   | ✅ `security-review` skill run separately, against the fixed branch — 0 findings above threshold                                                                                                                                                                                                                                               |
| 7   | Known out-of-scope gaps flagged, not fixed | ✅ `updateMotionInteractionRecordSchema` hand-duplicating fields instead of deriving via `.omit()`/`.partial()` — real but matches 6 of 8 sibling modules' own dominant convention, not a rule this module uniquely broke                                                                                                                      |
| 8   | Documentation updated                      | ✅ `docs/implementation/module-motion-and-interaction-library.md` (Scope + As-built, this project's 2026-08-27 collapsed-template convention) and `docs/phase-plans/module-implementation-roadmap.md` (moved this module from Wave 1 to Wave 2)                                                                                                |
| 9   | Exact branch/commit verified and recorded  | ✅ Branch `module-motion-and-interaction-library`, latest commit `9d6a206` — merged with `main` (no conflicts), not yet pushed to `origin` or opened as a PR                                                                                                                                                                                   |

## Forbidden-actions check

- No `dashboard-web` UI built — backend only, matching every prior module's own precedent.
- No new RBAC/permission-group migration added — reuses the already-seeded `creative_design`
  permission group verbatim.
- No hard-delete route — matches ADR-0016's project-wide no-hard-delete policy.
- `@RequirePermission` is placed on every individual controller method, never at class level —
  independently confirmed by 3 separate finder angles (line-by-line scan, cross-file tracer,
  security review).
- `relatedComponentIds` existence validation goes through `ComponentsService.existingComponentIds()`
  — a narrow, read-only delegating method — not the write-capable component repository exported
  directly across the module boundary (the exact SERVICE_REPOSITORY-export mistake previously
  flagged for Persona Library, explicitly checked for here and confirmed not repeated).
- The one real, load-bearing finding (the seeded `module_registry.dependencies` omitting the real
  Component Library coupling this build introduces) was fixed via an additive migration, not
  silently left inconsistent with the roadmap doc's own dependency-derived wave computation.
- A second, unrelated real issue (a migration-number collision with Wireframe Library, which
  merged to `main` mid-build) was caught before it could reach `origin`, fixed via a clean rename
  - full re-verification against a fresh database, not assumed safe.

## Independent code review — summary

High effort, 8 finder angles (line-by-line scan, removed-behavior auditor, cross-file tracer,
reuse, simplification, efficiency, altitude, conventions), run via parallel subagents against
`git diff main...HEAD`. 5 angles returned 0 candidates (line-by-line, cross-file tracer, reuse,
efficiency, conventions) — every genuinely novel piece of this diff (the `relatedComponentIds`
existence-validation wiring, the CAS/transaction reuse in `changeApprovalStatus()`, RBAC decorator
placement) traced cleanly to the already-reviewed sibling pattern it was built to mirror. 3 angles
(simplification, altitude, removed-behavior) each independently surfaced the same "unused
speculative `existingRecordIds()`/`findByIds()`" candidate — deduped to one, then verified
**REFUTED**: unlike Page Template Library's own removed dead method (zero real callers, no
doc-comment rationale, orphaned tests), this one mirrors an established, already-realized
convention (Section and Pattern Library's identical `existingRecordIds()`, consumed by Page
Template Library once it needed it), ships with an explicit doc-comment rationale, and has real,
intentional test coverage.

**1 CONFIRMED, fixed:** the seeded `module_registry.dependencies` for
`motion_and_interaction_library` was `null` (migration `00035`), inconsistent with the real, hard
runtime dependency this build introduces on Component Library
(`ComponentsService.existingComponentIds()`, called on every `create()`/`update()`) — the
identical class of coupling `page_template_library`'s own seeded row already correctly records.
`docs/phase-plans/module-implementation-roadmap.md` computes its build-order "waves" by
mechanically transcribing this exact field, so leaving it stale risked a future maintainer
deprioritizing or decoupling Component Library from this module's build order without realizing
the real runtime coupling. Fixed with a new, additive migration
(`00088-add-motion-and-interaction-library-dependency.ts` — not an edit to `00035`, which had
already run against production) and the roadmap doc updated to move this module to Wave 2.

**1 PLAUSIBLE, accepted as tracked debt:** `updateMotionInteractionRecordSchema` hand-retypes its
8 shared optional fields from `createMotionInteractionRecordSchema` instead of deriving via
`.omit()`/`.partial()`. Content Template Library and Brand Library already fixed this exact shape,
but verification found 6 of 8 other sibling modules checked (including ones built after that fix
landed) still hand-duplicate the same way — a real but inconsistently-applied convention in this
codebase, not a rule this module uniquely broke.

## Security review — summary

Focused specifically on: RBAC decorator placement, whether `relatedComponentIds` existence
validation could leak component metadata to an unauthorized caller, SQL injection surface in the
repository's search/filter logic, `designReference` URL-scheme validation, migration raw-SQL
safety, and mass-assignment risk via `relatedComponentIds`. **0 findings above threshold** — every
area traced to the already-reviewed sibling pattern it mirrors: method-level `@RequirePermission`
throughout, `ComponentsService.existingComponentIds()` exposing only a `Set<string>` of ids (no
other field), fully parameterized Sequelize queries with `escapeLikePattern()` on search,
`safeHttpUrlSchema` reuse for `designReference` (the shared schema built specifically to close the
historical Projects `environment.url` stored-XSS gap), static migration SQL with no
user-influenced values, and an explicit field allowlist in every repository write path (no request
body ever spread directly into a Sequelize `create()`/`update()` call).
