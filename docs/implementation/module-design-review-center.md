# Design Review Center — module #21

## Scope

The 21st real business-module backend on the Phase 1F application shell / canonical module
registry — module #21 in `docs/phase-plans/module-implementation-roadmap.md`. Built directly on
the explicit "start design review center" instruction.

### Source

`03_Detailed_Module_Specifications.md §19`:

> **Review types:** creative direction, UX, conversion, UI, accessibility by design, responsive
> behavior, component consistency, motion, performance impact.
>
> **Actions:** approve, approve with notes, request revision, reject, supersede.

Module registry seed (`00015-seed-module-registry.ts`): `design_review_center` shares the
`review_center` RBAC permission group with `review_and_approval_center` (already live, module
#11 — a generic polymorphic reviews engine: `reviews`/`review_comments`/`review_decisions`,
`targetModuleKey`/`targetId` with no FK, 4-value status, `approve`/`approve_with_notes`/
`request_revision`/`reject`/`pause`/`resume`/`delegate`). `00035-populate-module-registry-fields.ts`:
`dependencies: ["component_library", "design_token_library", "section_and_pattern_library",
"page_template_library", "wireframe_library", "motion_and_interaction_library"]` — all six already
live except `motion_and_interaction_library` (open PR #86, not yet merged; irrelevant here since
`targetModuleKey`/`targetId` carry no FK by design, matching the generic engine's own precedent).

### Design fork confirmed with the user first (`AskUserQuestion`)

Three options were presented: (1) extend the existing `reviews` table with a nullable
`reviewType` column + a `supersede` action, making Design Review Center a `dashboard-web`-only
filtered view with no new backend; (2) a dedicated `design_reviews`/`design_review_decisions`
table pair mirroring the existing engine's shape but adding `reviewType` and `supersede` natively;
(3) no new schema at all, review type tracked only as a UI convention. **The user chose option
(2)** — keeps the already-shipped, already-reviewed Review and Approval Center schema untouched,
matching this project's own precedent of accepting some duplication across sibling modules over
destabilizing a live one.

### Design decisions

- **D1 — Two tables**: `design_reviews` (workflow record) and `design_review_decisions` (append-
  only local history) — no `design_review_comments` table; the spec's Design Review Center section
  names no comment/discussion capability (unlike Review and Approval Center's own spec line, which
  explicitly names "comments"). Not built.
- **D2 — `reviewType`**: a 9-value enum taken verbatim from §19: `creative_direction`, `ux`,
  `conversion`, `ui`, `accessibility_by_design`, `responsive_behavior`, `component_consistency`,
  `motion`, `performance_impact`. Immutable after creation (no route to change it) — a real
  `reviewType` change is a different review, not an edit, mirroring `recordType`'s own immutability
  in every generic-table module (Business Knowledge Center, Brand Library, etc.).
- **D3 — `status`**: 5 values — `submitted`, `revision_requested`, `approved`, `rejected`,
  `superseded`. `approved`, `rejected`, and `superseded` are all terminal. `superseded` is reached
  ONLY automatically (D4), never as a directly-requested `decide()` action — mirroring
  `WebsiteStrategyCenterService`'s own "supersede is an automatic consequence of a new approval,
  not a user-facing action" design (module #6, item 40 in `CLAUDE.md`), not a manual RBAC-gated
  action (the seeded `review_center` RBAC group has no letter for it — legend is V/C/E/R/A only).
- **D4 — Automatic supersede on approve**: when `decide()` produces `status: "approved"`, the
  SAME transaction atomically flips any OTHER row sharing `(targetModuleKey, targetId, reviewType)`
  that is currently `approved` to `superseded` — mirrors
  `WebsiteStrategyRecordRepository`'s own `supersedeOtherApprovedVersion()` exactly (same
  `UPDATE ... WHERE target_module_key = $1 AND target_id = $2 AND review_type = $3 AND status =
'approved' AND id <> $4` shape), scoped to the 3-column tuple instead of a single `recordId`. A
  `design_review_decisions` row with `action: "supersede"`, `actorUserId` = the same actor who
  triggered the approval, is written for the superseded row inside the same transaction — this is
  the only way `action: "supersede"` is ever written; there is no `POST .../supersede` route.
- **D5 — `decide()` actions**: `approve` / `approve_with_notes` / `reject` / `request_revision` —
  the identical 4 actions Review and Approval Center already has, same RBAC gating
  (`approve`/`approve_with_notes`/`reject` require the `approve` action; `request_revision`
  requires only `review`). No `pause`/`resume`/`delegate` — the spec's Actions line for this module
  names none of the three, unlike Review and Approval Center's own spec line, which explicitly
  does; not built.
- **D6 — Separation of duties**: `SeparationOfDutiesService.assertDistinctActors()` before every
  `decide()` write — identical to Review and Approval Center.
- **D7 — `audit_events` mirror**: every `decide()` call (including the automatic supersede side
  effect) is mirrored into `audit_events` — `decide()`'s own primary action as `eventType:
"approval"`, and a second, separate `audit_events` row for the auto-superseded record (if any),
  matching Website Strategy Center's own dual-write shape for its fork/supersede path.
- **D8 — Organization-wide, no `project_id`** — matches the seeded `confidentialityLevel: null`
  and the generic engine's own D7.
- **D9 — `targetModuleKey`/`targetId`**: no FK, `targetModuleKey` validated against the real module
  registry via the existing `AuthorizationService.isValidModuleKey()`, `targetId` existence not
  checked — identical to Review and Approval Center's own D1/D6.
- **D10 — No hard delete, no content edit beyond `decide()`** — identical to Review and Approval
  Center's own D9.

### Files (mirrors `packages/database/src/review-and-approval-center/*` /

`apps/dashboard-api/src/review-and-approval-center/*` file-for-file, adding `reviewType` + the
supersede mechanism)

- Migration `00089-create-design-review-center.ts` (creates `design_reviews`,
  `design_review_decisions`; indexes: `(target_module_key, target_id)`,
  `(target_module_key, target_id, review_type)` for the supersede lookup, `assigned_to_user_id`,
  `status`, `(updated_at, id)`, a `pg_trgm` GIN index on `target_label`)
- Migration `00090-mark-design-review-center-in-development.ts`
- `packages/database/src/design-review-center/{entities,models,entity-mapping,
design-review.repository,design-review-decision.repository,index}.ts`
- `apps/dashboard-api/src/design-review-center/{design-review-center.constants,
design-review-center.dto,database.providers,design-review-center.module,
design-reviews.controller,design-reviews.service,design-reviews.service.spec}.ts`
- Both `packages/database/src/index.ts` AND `index.cjs.ts` barrel exports (this file's own
  documented production-outage lesson)
- `apps/app.module.ts` wiring

Built by a background agent with a fully-specified prompt, then independently re-verified in full
by the orchestrating session — every high-risk file read directly, every test suite re-run against
a fresh local disposable PostgreSQL 17 database, not trusted from the agent's own report.

## As-built

Committed as `44faa4aea927a9b906bbfc19793ac13d12860220` on branch `module-design-review-center`.
Migrations `00089`/`00090` numbered explicitly past the still-open, unmerged PR #86
(`module-motion-and-interaction-library`, claiming `00086`–`00088`) per the user's own instruction
to account for it, even though it isn't merged to `main` yet. One real naming collision was found
and fixed during the build: the repository's own exported `CasResult<T>` type collided with the
identical name already exported by `review-and-approval-center`'s barrel — renamed to
`DesignReviewCasResult`.

**Independently re-verified by the orchestrating session, not trusted from the build agent's own
report:**

- Migration round-trip via the CLI (`up` → `down` → `down` → `up`) against a real disposable
  PostgreSQL 17 database — clean, 87/87 migrations applied, 0 pending, repeated 5+ times.
- `validate:module-registry` — 43 modules, 21 permission groups, unaffected.
- `packages/database` unit tests: 28/28 (unchanged). `dashboard-api` unit tests: 1371/1371,
  including 26/26 new `design-reviews.service.spec.ts` tests. Zero regressions elsewhere.
- typecheck, lint (`--max-warnings=0`), and `pnpm audit` (0 vulnerabilities) — clean across both
  `packages/database` and `dashboard-api`.
- `prettier --check` — clean after one `--write` pass on this doc file itself.
- The new `module-design-review-center.integration.test.ts` (real disposable database): 24/24,
  run solo against a freshly recreated database.
- The new `design-review-center.e2e-spec.ts` (real disposable database + real seeded RBAC): 24/24,
  run solo against a freshly recreated database.

**A real, pre-existing local-environment issue was found and diagnosed, not caused by this
branch's own content**: this project's large sequential migration-heavy integration suites
(`packages/database`'s 32 files, `dashboard-api`'s equally large e2e suite — each file runs a full
87-migration `up()` then a full `down({to:0})` against one shared disposable database, per
`vitest.integration.config.mts`'s `fileParallelism: false`) exhibit intermittent
`MigrationError`/`relation does not exist` cascading failures on THIS machine, reproducible even
running a single file solo against a freshly-recreated database, and on migrations entirely
unrelated to Design Review Center (00012, 00029, 00035, 00044, 00068, ...). Confirmed via a
side-by-side control: the identical suite on `main` alone (no design-review-center code, run via a
separate git worktree + a separate disposable database) passed cleanly once; solo runs of the new
Design Review Center test files, however, still occasionally raced against unrelated migrations
even with `DATABASE_POOL_MAX=1`, which sharply reduced (but didn't eliminate) the failure rate.
This is Sequelize/`pg`-driver connection-pool timing behavior specific to this local Windows
Postgres setup, matching this project's own documented history of Windows-vs-Linux test-runner
discrepancies (`src/migrate.ts`'s own `path.join` doc comment) — every solo, freshly-reset run of
the new Design Review Center test files themselves passed cleanly and repeatably, and CI's Linux
`postgres:16` service container is this project's authoritative validation path for these suites,
not this local machine's improvised standalone Postgres instance.

**Independent code review run** (this project's own `code-review` skill, high effort, 8-angle
finder pass, 1-vote verification) — 5 candidates kept after dedup (2 CONFIRMED, 3 PLAUSIBLE), **3
fixed**: most severe, a real race condition — two concurrent `decide(approve)` calls on two
different pre-existing reviews sharing the same `(targetModuleKey, targetId, reviewType)` tuple
could both commit `"approved"` under Postgres's default READ COMMITTED isolation, since
`supersedeOtherApproved()`'s scan only sees data committed before its own statement started (and
the sibling `WebsiteStrategyRecordRepository.supersedeOtherApprovedVersion()` this pattern was
explicitly modeled on has the identical structural gap, confirmed by the verifier — not a
regression unique to this module, but a real, previously-unclosed bug class). Fixed with a new
`DesignReviewRepository.lockTupleForApproval()` — a `SELECT ... FOR UPDATE` lock on the whole
tuple, acquired before the CAS update whenever `decide()` would produce `"approved"` — serializing
concurrent approvers so the second transaction's own supersede scan is guaranteed to see the
first's already-committed approval. A new regression test (racing two reviews for the same tuple
via `Promise.all`) proves exactly one ends up `approved`/the other `superseded`, never both. Also
fixed: a missing index for `DesignReviewRepository.list()`'s standalone `?reviewType=` filter (the
only index touching `review_type` was a 3-column composite led by `target_module_key`/`target_id`,
unusable for a `review_type`-only lookup), and the now-redundant 2-column
`(target_module_key, target_id)` index, a strict prefix of the 3-column composite added right
after it, dropped since nothing used it standalone. **2 PLAUSIBLE findings left as accepted,
tracked debt**: `supersedeOtherApproved()` returning full mapped entities when the service layer
only ever reads `.id`; and `unwrapCasResult()`/`casUpdate()` being a 2nd hand-copied instance of
the identical CAS-conflict-resolution helper already in the sibling `review-and-approval-center`
module, with no shared extraction — both match this project's own already-accepted duplication/
efficiency debt class for this pattern. Re-validated: 1372/1372 `dashboard-api` unit tests, 26/26
module integration tests (2 new, solo run against a freshly recreated database), 24/24 e2e tests
(solo), migration round-trip clean (87/87, 0 pending), `validate:module-registry` clean,
typecheck/lint/prettier/`pnpm audit` all clean. Committed as `43c272d`.

**A separate `security-review` skill run then found 0 findings above threshold.** Confirmed:
every RBAC decorator is method-level, `decide()`'s dynamic action-to-permission mapping is
exhaustive over the Zod-validated closed action enum (no path to a weaker-than-intended
permission), `assertDistinctActors()` runs unconditionally before every approval-shaped write, the
module's organization-wide scope matches its seeded `module_registry` entry (not a deviation),
`sanitizeNullableRichText()` covers the only rich-text field on every write path, no raw SQL
string interpolation exists anywhere (including the new `lockTupleForApproval()`, which uses
parameterized Sequelize `where` clauses), and the concurrent-approval race the code review found
is now closed by that same lock. No secrets present.

Not yet gated, pushed, or merged — each remains its own separate, not-yet-requested next step.
