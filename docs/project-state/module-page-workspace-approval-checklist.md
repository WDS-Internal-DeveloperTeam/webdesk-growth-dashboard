# Approval checklist — Page Workspace (module #12)

Branch `module-page-workspace` · commits `588f542`, `0a06a69`, `55ce505`
Task package: `docs/task-packages/module-page-workspace.md`

## Preconditions

| Item                                     | Status | Evidence                                                                                    |
| ---------------------------------------- | ------ | ------------------------------------------------------------------------------------------- |
| Dependency (`page_inventory`) live       | Yes    | Merged and verified in production 2026-08-23 (PR #58)                                       |
| Sequencing prerequisite (roadmap row 11) | Yes    | Review & Approval Center backend + UI live 2026-08-25 (PRs #65, #66)                        |
| RBAC migration required                  | No     | Reuses the already-seeded `page_content`/`creative_design`/`development_code`/`security_qa` |
| Scoping forks confirmed with owner       | Yes    | D1, D2, D4 each put to the project owner before any code was written                        |

## Independent code review

High effort, 8 finder angles. **7 findings — 6 CONFIRMED (all fixed), 1 PLAUSIBLE (accepted debt).**

| #   | Finding                                          | Disposition   |
| --- | ------------------------------------------------ | ------------- |
| 1   | Artifact row created outside the transaction     | Fixed         |
| 2   | Archiving a version permanently bricked its tab  | Fixed         |
| 3   | Content edits audited as a no-op status pair     | Fixed         |
| 4   | `approved_for_planning` misclassified            | Fixed         |
| 5   | `listForPage()` left the D2 boundary unenforced  | Fixed         |
| 6   | Duplicated artifact-in-page ownership guard      | Fixed         |
| 7   | Same-status return precedes the permission check | Accepted debt |

Finding 7 is left open deliberately: the identical ordering is already accepted debt in
`PagesService` and `KeywordsService`, and diverging here for no exploitable gain would leave this
module inconsistent with two live siblings. Six regression tests were added, one per fix.

## Security review

Run separately, after the code-review fixes. **0 findings at or above the reporting threshold.**

Cleared: the D2 dynamic authorization model (no caller-supplied module key reaches
`assertAllowed()`; `@RequirePermission` method-level on all seven routes; transition tables
indexed by Zod-validated enums, so no prototype-pollution path), the lifecycle resume edge
(cannot reach a stage the caller had not already occupied), IDOR scoping, injection,
stored XSS, mass assignment, and CSRF.

Three sub-threshold observations recorded, none treated as vulnerabilities — see the review
packet. The most substantive is a gate inconsistency on the lifecycle `GET` (~3/10): it returns
the full page record under `page_content:view` where Page Inventory uses `page_inventory:view`.
Verified against migration `00013` that all seven roles hold `view` on both, so no role reaches
data it could not already read. A least-privilege narrowing is available but was deliberately not
applied, since reshaping an endpoint's response exceeds the scope of a security fix.

## Validation

| Check                           | Result    | Notes                                                |
| ------------------------------- | --------- | ---------------------------------------------------- |
| `dashboard-api` unit tests      | 925 / 925 | 71 files; 47 new across the three commits            |
| Workspace build                 | 9 / 9     | includes both dual ESM/CJS package builds            |
| Lint                            | 15 / 15   | `--max-warnings=0`                                   |
| Prettier                        | clean     | scoped to changed files                              |
| `pnpm audit`                    | 0         | no known vulnerabilities                             |
| CJS entrypoint export check     | verified  | all three repositories confirmed exported at runtime |
| `packages/database` integration | NOT RUN   | requires a real disposable database                  |
| `dashboard-api` e2e             | NOT RUN   | requires a real disposable database                  |

### Outstanding gap — read before deciding

**The integration suite (356 lines) and the e2e suite (554 lines) have never been executed.**
Both are written, typecheck cleanly, and are committed, but the machine this work was done on
has PostgreSQL installed with no provisioned disposable database, and creating one requires a
superuser password the implementing agent should not hold.

This is a genuine departure from precedent: every prior module in this project reached
second-role review with a real disposable database behind it. The two unrun suites are precisely
what would substantiate this module's central claims — that migration `00068` round-trips, that
the compare-and-swap guards hold under concurrent writes, and that the per-artifact-type
authorization behaves correctly against genuinely seeded RBAC roles. That design is currently
argued and unit-tested against mocks, not demonstrated against a real database.

The alternative, if a local database is not wanted, is to push the branch and let CI's own
`postgres:16` service container run both suites — real validation, just remote. Pushing is its
own separate authorization in this project.

## Sign-off — required second-role human review

Per ADR-0010 the implementing agent cannot also be its own reviewer. Review packet published as
a Claude artifact: <https://claude.ai/code/artifact/ab538376-8610-477a-bb3e-c833060ad81f>

| Field    | Value        |
| -------- | ------------ |
| Reviewer | Jitesh D     |
| Decision | **Approved** |
| Date     | 2026-08-26   |
| Disputes | None raised  |

The implementer's recommendation was the narrower "Approved, pending test execution"; the
reviewer chose a plain **Approved** instead, accepting the branch as it stands. Recorded as
decided, not as recommended.

This approval therefore also accepts, as reviewed:

- the one open code-review finding (#7, same-status return preceding the permission check),
  left as tracked debt matching `PagesService`/`KeywordsService`;
- the three sub-threshold security observations, none actioned;
- **the outstanding gap above** — that the integration and e2e suites have still never been
  executed. The approval does not close that gap; it accepts the branch despite it. Anyone
  reading this later should not infer that a real database ever validated this module before
  sign-off.

## Gate — G4-page-workspace

Not yet requested. A gate decision is separate from the second-role review above, and neither
authorizes pushing the branch, opening a PR, or merging — each remains its own explicit step,
per this project's standing no-auto-merge rule.

| Field           | Value            |
| --------------- | ---------------- |
| Approver        | WebDesk Solution |
| Decision        | **CONFIRM**      |
| Approved commit | `0ee593d`        |
| Date            | 2026-08-26       |

Recorded as CONFIRM rather than OVERRIDE because the required second-role human review (Jitesh D,
"Approved") was complete **before** this gate was requested — the same basis every prior gate used,
and the specific thing whose absence made Phase 1C's G4-1C an override.

### Resolution note — the open item is now CLOSED (2026-08-26, after the gate)

Recorded as an addendum rather than by rewriting the sections below, which accurately describe
the state at the time the gate was approved.

Both suites have now been executed against a real database, and CI on `main` is fully green
(all 11 jobs, including Integration tests) at commit `edf82e7`:

| Suite                                      | Result    |
| ------------------------------------------ | --------- |
| `page-workspace` e2e                       | 22 / 22   |
| `dashboard-api` e2e (all 23 files)         | 384 / 384 |
| `packages/database` integration (23 files) | 389 / 389 |

Getting there surfaced three real defects that no earlier check could have caught:

1. **Two genuine e2e bugs** (commit `5722ce1`). No role holds both `submit` and `approve` in the
   same permission group — `super_admin` is `VCERAPX` on `page_content`, approve yes, submit no —
   so the test helper 403'd on its first transition. And every artifact was created on one shared
   page while three artifact types were created more than once, colliding on the real
   `(page_id, artifact_type)` unique index. Both were mistakes in the test; the module correctly
   implements the seeded matrix. A regression test now asserts the submit/approve separation
   directly.
2. **A syntax error** introduced by that same fix commit's bulk rename (four `const base = base;`
   lines), which made the file fail to parse — skipping all 22 tests and, because `afterAll` never
   ran, leaving the shared database dirty and taking all 21 other e2e suites down with it. Fixed
   in `edf82e7`.
3. **A pre-existing, repo-wide Windows bug** in `packages/database/src/migrate.ts` (fixed
   separately in `0c3193d`): `buildMigrationsGlob()` used `path.join`, and a backslash is an
   escape character in glob syntax, so the pattern matched nothing. umzug reported zero executed
   AND zero pending against 69 migration files, making `up()` a silent no-op while `migrate`
   printed success. **No one could run this repo's migrations or database tests on Windows at
   all.** Unrelated to this module; found only because reproducing the CI failure locally required
   a working migrator.

**A gap this closes in the tooling, worth acting on separately:** `apps/dashboard-api/tsconfig.json`
has `include: ["src"]`, so the entire `test/` directory is invisible to `pnpm typecheck`. That is
why a file containing a redeclaration passed local typecheck. Every e2e spec in this repo is
currently unchecked.

### Open item carried by this gate (as it stood at approval time)

This gate is nonetheless **the first in this project's history approved without real-database
validation.** All 50 prior gates cite real integration and e2e run counts; this one cannot, because
the two suites have never been executed (see the "Outstanding gap" section above).

That is recorded here and in `project.json`'s gate entry rather than absorbed silently, so the
record does not imply a level of verification that was never performed. What the gate does rest on:
925/925 unit tests, build 9/9, lint 15/15, prettier, `pnpm audit` clean, a runtime CJS export
check, a high-effort code review with all six confirmed findings fixed, and a security review with
zero findings above threshold.

Closing the gap remains straightforward and does not require re-gating: provision a local
disposable database and run both suites, or push the branch and let CI's own `postgres:16`
service container run them.
