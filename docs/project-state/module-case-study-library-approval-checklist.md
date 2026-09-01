# Case Study Library Module Backend — Approval Checklist

**Status:** Code review complete (8-angle finder pass, 10 candidates verified after dedup — 5
CONFIRMED fixed, 3 PLAUSIBLE accepted as tracked debt, 2 REFUTED). Security review complete (0
findings above threshold). Required second-role human review complete — "Approved as-is,"
accepting the 2 open tracked-debt items, no disputes raised. Gate (G4-case-study-library)
approved — WebDesk Solution, decision CONFIRM, approved commit `d6e88af` on branch
`module-case-study-library`. Not yet pushed to `origin`, opened as a PR, or merged.

## Completion condition

Every item below must be genuinely true, verified against real evidence, before a gate decision
for this slice can be requested.

| #   | Item                                       | Status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Authorization to build                     | ✅ Explicit "start Case Study Library" instruction — module #24 on the Recommended Module Roadmap                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2   | Genuine scoping decision surfaced          | ✅ One real fork confirmed with the user via `AskUserQuestion` before building: whether Case Study Library should be a fully separate table, a browse view over Case Study Studio with no new table, or an extension table FK'd to Studio — the project owner chose the extension-table approach (D1)                                                                                                                                                                                                                                                                                                                          |
| 3   | Required tests pass                        | ✅ 1494/1494 `dashboard-api` unit tests (30 new), 690/690 `packages/database` integration tests (16 new), 690/690 `dashboard-api` e2e tests (13 new) — all independently re-run by the orchestrating session against a real disposable PostgreSQL 17 database, not just trusted from the build agent's own report                                                                                                                                                                                                                                                                                                              |
| 4   | Full validation clean                      | ✅ typecheck/lint (`--max-warnings=0`)/prettier clean across `packages/database` and `apps/dashboard-api`; migration up/down/up round-trip clean (94 migrations); `pnpm validate:module-registry` unaffected (43 modules, 21 permission groups); `pnpm audit` 0 vulnerabilities                                                                                                                                                                                                                                                                                                                                                |
| 5   | Independent code review complete           | ✅ High-effort 8-angle finder pass — 10 candidates verified after dedup; 5 CONFIRMED, all fixed (missing terminal-state guard on `update()`; a TOCTOU race returning an inconsistent 409 instead of 400; an ambiguous conflict message; a cross-module RBAC-constant reuse deviation; an inherited, already-accepted error-precedence race left as-is); 3 PLAUSIBLE accepted as tracked debt (an org-wide page-existence check with no RBAC scoping of its own, tempered by the current seeded matrix; two low-value list()/update() efficiency notes, one of which was incidentally resolved by the terminal-state-guard fix) |
| 6   | Security review complete                   | ✅ `security-review` skill run separately against the fixed branch — 0 findings above threshold                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 7   | Known out-of-scope gaps flagged, not fixed | ✅ No `dashboard-web` UI in this pass, matching every prior module's own backend-first precedent — a separate, not-yet-requested next step                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 8   | Documentation updated                      | ✅ `docs/implementation/module-case-study-library.md` (Scope + As-built, collapsed single-file format per the 2026-08-27 standing rule)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 9   | Exact branch/commit verified and recorded  | ✅ Branch `module-case-study-library`, commits `c3a3711` (build) and `d6e88af` (review fixes) — not yet pushed to `origin`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

## Forbidden-actions check

- No `dashboard-web` UI built — backend only, matching every prior module's own backend-first
  precedent.
- No new RBAC/permission-group migration added — reuses the already-seeded `case_studies`
  permission group verbatim (declared as its own local constant, not imported cross-module — a
  code-review fix).
- No hard-delete route — matches ADR-0016's project-wide no-hard-delete policy (the seeded
  `case_studies` group has no `D` action either).
- No independent status-transition route — this record has no independent lifecycle (D1); status
  is always read from the joined parent case study.
- `@RequirePermission` is placed on every individual controller method, never at class level —
  confirmed directly and by both the code review and security review.
- Both `packages/database/src/index.ts` and `index.cjs.ts` (the separately-maintained CJS barrel
  Vercel's production bundler actually uses) were updated together — confirmed directly, not
  assumed, per this project's own documented 2026-08-12 production-outage caution.

## Independent code review — summary

Full record: `docs/implementation/module-case-study-library.md` and this session's
`ReportFindings` output. 8-angle finder pass (3 correctness angles, reuse, simplification,
efficiency, altitude, conventions) surfaced 5 CONFIRMED and 3 PLAUSIBLE findings kept after dedup
(2 REFUTED — a nullable-type-modeling nitpick judged over-cautious rather than risky, and a
duplicated-helper-pattern finding judged consistent with 20+ prior modules' own already-settled
precedent):

1. **`update()` had no terminal-state guard**, contradicting its own doc comment. Fixed — the
   parent case study is now fetched up front and edits to an already-`archived` case study's
   library record are rejected with a clean 400, mirroring every sibling module's own precedent.
2. **A TOCTOU race returned 409 for a duplicate `publicId` while the deterministic pre-check
   returned 400** for the identical condition. Fixed — both now consistently return 400, matching
   sibling `create()` methods.
3. **The same TOCTOU catch gave one ambiguous message for two distinct unique-index
   violations.** Fixed — the caught error's own `.fields` is now read (a safe property access, not
   an `instanceof` check) to report which one actually collided.
4. **`CASE_STUDY_LIBRARY_MODULE_KEY` was imported across the module boundary from Case Study
   Studio's own constants file** instead of being declared locally. Fixed — declared as its own
   independent constant with the same coincidentally-shared value, matching Persona Library's own
   precedent for an identical situation.
5. **(Accepted, inherited debt)** `create()`/`update()` race a 404 check against a 400 check via
   `Promise.all`, an already-accepted pattern replicated from `PersonasService.update()`.

## Security review — summary

`security-review` skill run separately against the fixed branch. **0 findings above the
confidence threshold.** Checked specifically: RBAC decorator placement (method-level throughout),
`OriginCheckGuard` on both mutating routes, Zod/`ParseUUIDPipe` input validation, SQL-injection
surface (parameterized queries, `escapeLikePattern()` on search), the TOCTOU catch's duck-typed
error handling (no direct `sequelize` import, per ADR-0006), the new `existingPageIds()`/
`findByIds()` pair (bare id `Set` only, no field/PII leakage, correctly avoids exporting a
write-capable repository across the module boundary), and confirmed no confidentiality/redaction
gap beyond what Case Study Studio's own already-accepted D9 precedent already establishes.

## Sign-off

Required second-role human review: **complete.** The review packet (published as a Claude
artifact — code review + security review findings, fixes, and validation evidence, with a
decision section) was reviewed and returned **"Approved as-is,"** accepting the 2 open
tracked-debt items (the org-wide page-existence check's own RBAC scoping, and `list()`'s
per-record enrichment cost) as recorded rather than requesting fixes. No disputes raised.

Gate decision: **G4-case-study-library approved** — WebDesk Solution, decision CONFIRM (clean
pass, not an override, since the second-role review was already complete before the gate was
requested), approved commit `d6e88af` on branch `module-case-study-library`. See
`outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
`G4-case-study-library`). This gate approval does not itself authorize pushing the branch,
opening a PR, or merging — each remains its own separate, not-yet-requested authorization, per
this project's standing "no auto-merge" rule.
