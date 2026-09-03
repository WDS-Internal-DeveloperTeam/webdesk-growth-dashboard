# Release Center module

## Scope

Module key `release_center` (module #35 on the Recommended Module Roadmap; Wave 6 in
`docs/phase-plans/module-implementation-roadmap.md`, depending on `ready_for_claude_queue`
(live), `technical_center` (live, merged PR #108), and `review_and_approval_center` (live)).
Built directly on the explicit "Start Release Center" instruction.

Canonical source: `webdesk-dashboard-documentation-v1/03_Detailed_Module_Specifications.md §36`
("Release types: staging, production, hotfix, rollback. Fields: release ID, repositories and
SHAs, PRs, approvals, deployments, smoke tests, verification, rolled-back SHA, reason, replacement
release.") and `05_Workflow_State_Machines.md §10` (the real, named Release workflow — 10 happy-path
states plus 5 named failure/exception states, 14 distinct status values once
`deployment_failed` is folded into `verification_failed` per the design decision below).

Three design forks confirmed directly with the project owner first (`AskUserQuestion`):

- **D1 — Inline dynamic workflow, not routed through Review and Approval Center.** The seeded
  `releases` RBAC permission group (`06_Roles_and_Permissions.md`, `00013-seed-rbac-matrix.ts`)
  carries real `submit`/`review`/`approve`/`release`+`rollback` letters directly on it
  (`developer: VCESR`, `qa_security_reviewer: VRA`, `super_admin: VCERAL`,
  `owner_growth_approver: VCRAL` — no `E`), matching the exact shape every other module with its
  own submit/review/approve letters (Service Library, Persona Library, Website Strategy Center,
  Case Study Studio) has built as its own dynamically-gated `TRANSITIONS` map — not a Review record
  in the cross-cutting engine.
- **D2 — Project-scoped**, matching Change Center's/Scan Center's/Technical Center's own
  precedent — a release deploys a specific client's website; "repositories and SHAs" is
  meaningless without a project.
- **D3 — Build now, no literal FK into Technical Center.** `technical_center` is a listed
  dependency but the spec names no field linking a release to a specific technical-check run — the
  workflow's `Checks Running`/`Checks Failed` states are statuses a person sets directly (this
  module is record-keeping only, matching Scan Center's/Ready for Claude Queue's/Technical
  Center's own "no real execution engine yet" precedent), not an automated link. (Also: Technical
  Center has since merged to `main` — PR #108/#109 — so this is moot in practice, but the design
  reasoning stands regardless.)

### Schema — 6 tables, migration `00111`

Sourced directly from the spec's own 10-item field list, one table per named field group (the
same "spec field list -> literal table list" discipline Proof and Claims Library/Case Study Studio
both already established):

1. **`releases`** (parent) — `id`, `project_id`, `public_id`, `release_type`
   (`staging|production|hotfix|rollback`), `title`, `status` (the 14-value workflow enum below),
   `notes` (plain `TEXT`, not sanitized — no `dashboard-web` UI exists yet, matching Scan
   Center's/Technical Center's own "stay plain until a UI decision is made" precedent),
   `hotfix_reason` (nullable `TEXT`), `assigned_developer_user_id` (nullable FK `users`),
   `assigned_reviewer_user_id` (nullable FK `users`), `production_approver_user_id`
   (server-stamped only, on the `production_approval -> production_deployed` transition),
   `staging_deployed_at`/`staging_verified_at`/`production_deployed_at`/
   `production_verified_at`/`completed_at`/`hotfix_required_at`/`rolled_back_at` (server-stamped
   only, COALESCE "stamp once" semantics, mirroring `CaseStudyRepository.updateStatus()`'s own
   pattern), `created_by`/`updated_by`, timestamps.
2. **`release_artifacts`** ("repositories and SHAs, PRs") — `id`, `release_id` FK, `project_id`
   (denormalized), `repo_owner`, `repo_name`, `commit_sha` (`VARCHAR(40)`), `pr_url` (nullable,
   `safeHttpUrlSchema`-validated, mirroring Projects' own `ProjectRepository` precedent),
   `created_by`, timestamps. Create/list/delete (delete gated on the release being non-terminal).
3. **`release_approvals`** ("approvals") — an append-only decision log, mirroring
   `case_study_approvals` file-for-file: `id`, `release_id` FK, `project_id`, `approval_stage`
   (`staging|production`), `decision` (`approved|rejected|hotfix_required`), `decided_by_user_id`,
   `decided_at`, `notes`. Auto-inserted inside the same transaction as the CAS status write
   whenever a transition's action is `approve`. Read-only via `GET .../releases/:id/approvals`.
4. **`deployments`** ("deployments") — an append-only history of deploy attempts (real re-deploys
   possible even after `staging_deployed_at`/`production_deployed_at` are first stamped — those
   columns record only the FIRST success, this table records every attempt): `id`, `release_id`
   FK, `project_id`, `environment` (`staging|production`), `outcome` (`succeeded|failed`),
   `deployed_by_user_id`, `deployed_at`, `notes`. Create/list only, no update/delete (ADR-0016).
5. **`smoke_tests`** ("smoke tests") — `id`, `release_id` FK, `project_id`, `environment`
   (`staging|production`), `name`, `result` (`passed|failed`), `ran_at`, `notes`. Create/list
   only.
6. **`rollback_records`** ("rolled-back SHA, reason, replacement release" — a literal, field-for-
   field match) — `id`, `release_id` FK (the release being rolled back), `project_id`,
   `rolled_back_sha` (`VARCHAR(40)`), `reason` (`TEXT`, required), `replacement_release_id`
   (nullable, self-referential FK into `releases`, existence-validated within the same project),
   `rolled_back_by_user_id`, `rolled_back_at`, timestamps. Auto-inserted inside the same
   transaction as the CAS status write on any `-> rolled_back` transition — `reason` is required
   in the transition request body on that transition specifically (mirroring
   `CaseStudiesService.changeStatus()`'s own `unpublishReason`-required-on-one-transition
   precedent).

Reuses the already-seeded `releases` RBAC permission group verbatim — no new RBAC migration.

### Workflow — 14 statuses (`05_Workflow_State_Machines.md §10`, verbatim happy path)

Happy path: `proposed -> checks_running -> ready_for_staging -> staging_deployed ->
staging_verification -> staging_approved -> production_approval -> production_deployed ->
production_verification -> completed`.

Failure/exception (named in the spec, no explicit recovery edges given — the edges below are this
build's own reasonable design, flagged as such, not spec-sourced): `checks_failed`,
`verification_failed`, `hotfix_required`, `rolled_back` (`deployment_failed` from the spec's own
list is folded into `verification_failed`/a `deployments.outcome = "failed"` row — no separate
status was judged necessary since a failed deploy attempt is already recorded in `deployments`
without needing its own release-level status distinct from `verification_failed`).

`TRANSITIONS` map (`${from}->${to}`: action), terminal states have no outbound edge except where
listed:

| From                    | To                      | Action  |
| ----------------------- | ----------------------- | ------- |
| proposed                | checks_running          | submit  |
| checks_running          | ready_for_staging       | review  |
| checks_running          | checks_failed           | review  |
| checks_failed           | checks_running          | submit  |
| checks_failed           | proposed                | submit  |
| ready_for_staging       | staging_deployed        | release |
| staging_deployed        | staging_verification    | review  |
| staging_verification    | staging_approved        | approve |
| staging_verification    | verification_failed     | review  |
| verification_failed     | staging_deployed        | release |
| verification_failed     | production_deployed     | release |
| staging_approved        | production_approval     | approve |
| production_approval     | production_deployed     | release |
| production_deployed     | production_verification | review  |
| production_verification | completed               | approve |
| production_verification | verification_failed     | review  |
| production_deployed     | hotfix_required         | review  |
| production_verification | hotfix_required         | review  |
| completed               | hotfix_required         | review  |
| staging_deployed        | rolled_back             | release |
| production_deployed     | rolled_back             | release |
| completed               | rolled_back             | release |
| hotfix_required         | rolled_back             | release |

`rolled_back` and (barring the one `-> hotfix_required` re-entry from `completed`) `completed` are
the only true terminal states; a real hotfix is a NEW `releases` row of `release_type = "hotfix"`,
linked back via `rollback_records.replacement_release_id` on the original release's own rollback
row — `hotfix_required` itself has no outbound edge back into the happy path, only into
`rolled_back` (matches `case_study_studio`'s own "archive from any state, gated at the approval
tier" convention, applied here to `L` instead of `A`).

### RBAC actions used

`view`, `create`, `edit` (content edits — gated the same way `CaseStudiesService.update()` gates
its own content edits; blocked once `status` is `completed`, `rolled_back`, or `checks_failed`
— the last one is genuinely terminal for THIS release cycle, since its only outbound edges are
`submit`, not `edit`, matching this module's own "content edits stop once you're past active
drafting" reading), `submit`, `review`, `approve`, `release` (covers the two seeded actions
`release`+`rollback` on the `L` letter — used for both `-> deployed` transitions and every `->
rolled_back` transition).

### Sub-resource endpoints

- `POST/GET /release-center/projects/:projectId/releases` — create/list.
- `GET/PATCH /release-center/projects/:projectId/releases/:id` — get/update (content only).
- `POST /release-center/projects/:projectId/releases/:id/status` — the one `changeStatus` route,
  dynamically gated per the `TRANSITIONS` map above (same layered pattern as
  `TechnicalCheckRunsController.changeStatus()` — route-level gate is just `view`).
- `GET /release-center/projects/:projectId/releases/:id/approvals` — read-only, `view`-gated.
- `POST/GET/DELETE .../releases/:id/artifacts[/:artifactId]` — `create`/`view`/`edit`-gated
  respectively; delete rejected once the release is `completed`/`rolled_back`.
- `POST/GET .../releases/:id/deployments` — `edit`/`view`-gated, append-only.
- `POST/GET .../releases/:id/smoke-tests` — `edit`/`view`-gated, append-only.
- `GET .../releases/:id/rollback` — read-only, `view`-gated (returns the rollback record if one
  exists for this release).

No `dashboard-web` UI in this pass — backend only, matching every prior module's own
backend-first precedent.

## As-built

Built by a background agent with a fully-specified prompt mirroring Technical Center's
project-scoped controller/RBAC wiring and Case Study Studio's inline dynamic-per-transition-action
workflow + approvals-log pattern, then independently re-verified in full by the orchestrating
session — every high-risk file (the `TRANSITIONS` map, the CAS `updateStatus()` COALESCE stamping,
RBAC decorator placement, both `packages/database` barrel exports, `app.module.ts` wiring) read
directly, and every validation command re-run fresh against a real local disposable PostgreSQL 17
database rather than trusted from the agent's own report: migration up/down/up round-trip clean
(112 migrations), 20/20 `packages/database` integration tests, 11/11 `dashboard-api` e2e tests,
31/31 `dashboard-api` unit tests, `validate:module-registry` (43 modules, 21 permission groups),
`pnpm audit` 0 vulnerabilities, typecheck/lint/prettier all clean.

**Independent code review then ran** (this project's own `code-review` skill, high effort, 8-angle
finder pass via parallel agents, 1-vote self-verification) — 10 findings kept in the final report
(6 CONFIRMED, 4 PLAUSIBLE). **6 fixed**:

- `deployments.service.ts`/`smoke-tests.service.ts` had NO terminal-state guard on `create()` at
  all, unlike `release-artifacts.service.ts`'s own `remove()` in the same diff — a caller could
  fabricate a "succeeded" deployment or "passed" smoke test against an already-`completed`/
  `rolled_back` release. Fixed with a shared `RELEASE_TERMINAL_STATUSES` constant, used uniformly
  across all three sub-resource write guards.
- `changeStatus()` only inserted a `release_approvals` row on `action === "approve"`, with
  `decision` hardcoded to the literal `"approved"` — the schema's own `"rejected"`/
  `"hotfix_required"` enum values were structurally unreachable, and a real rejection (e.g.
  `staging_verification -> verification_failed`) was never logged to the approvals history at all,
  despite "approvals" being the spec's own named field. Fixed by restructuring `ReleaseTransition`'s
  `approvalStage` into a bundled `approvalLog: {stage, decision}` object present only on
  transitions that represent a real governance decision — `staging_verification ->
verification_failed` now logs `rejected`; `production_deployed`/`production_verification`/
  `completed -> hotfix_required` now log `hotfix_required`.
- The old `approvalStage` field was a bare optional with nothing tying it to
  `action === "approve"`, letting a future transition silently skip the approvals insert. Closed by
  the same `approvalLog` restructuring above — every field required together, or none at all.
- The 4 sub-resource repositories (`release-artifact`/`deployment`/`smoke-test`/
  `rollback-record.repository.ts`) hand-typed their `create()` input instead of deriving it via
  `Omit<Entity, ...>` from the entity type, unlike `ReleaseRepository` itself. Fixed — all four now
  derive their input types from the corresponding entity.
- 5 speculative indexes (`(project_id)` or `(project_id, environment)` on `release_artifacts`/
  `release_approvals`/`deployments`/`smoke_tests`/`rollback_records`) had no matching query shape
  anywhere in the module — every repository only ever filters by `release_id`. Removed all 5;
  `rollback_records_release_id_unique` was kept, since it's a real uniqueness constraint, not just a
  lookup accelerator.

**4 PLAUSIBLE findings left as accepted, tracked debt**, each verified to match an already-accepted
pattern shared with sibling modules, not a novel deviation this diff introduces: a check-then-act
race on `update()`/artifact `remove()` with no CAS (the identical shape every sibling module's own
content `update()` has, e.g. `CaseStudyRepository.update()`); no correction path for a mistaken
rollback once `rolled_back` (a real design limitation — `rolled_back` has zero outbound
`TRANSITIONS` edges — but fixing it means a broader workflow change disproportionate to this pass);
the same-status no-op in `changeStatus()` returning before the RBAC check runs (the identical,
already-accepted pattern in `ScanRunsService`/`TechnicalCheckRunsService`/`CaseStudiesService`); and
`RELEASE_CENTER_MODULE_KEY`'s misleading name (holds the RBAC permission-group key `"releases"`,
not the module registry key `"release_center"` — the same already-established naming shape
`TECHNICAL_CENTER_MODULE_KEY`/`CASE_STUDY_STUDIO_MODULE_KEY` both have).

Re-validated after every fix, all against the real disposable database: 37/37 `dashboard-api`
unit tests (6 new — 2 proving the negative-decision approvals logging, 4 proving the new
terminal-state guards), 20/20 `packages/database` integration tests, 11/11 `dashboard-api` e2e
tests, a fresh migration down/down/up/up round-trip (112 migrations, 0 pending after),
`validate:module-registry` unaffected, typecheck/lint/prettier all clean, `pnpm audit` 0
vulnerabilities.

**A separate `security-review` pass then found 0 findings above threshold** — confirmed
method-level `@RequirePermission` on every controller, `OriginCheckGuard` on every mutating route,
`ParseUUIDPipe` on every route param, correct IDOR scoping via `ReleasesService.findById(id,
projectId)` on every sub-resource read/write, the dynamic per-transition RBAC gate in
`changeStatus()` runs before every mutating branch, `prUrl` validated via the shared
`safeHttpUrlSchema`, no mass-assignment path for `status`/the 7 server-stamped timestamps/
`productionApproverUserId`, and no raw-SQL string interpolation anywhere in
`ReleaseRepository.updateStatus()`'s `literal()`/`fn()`/`col()` usage (only fixed column-name
literals and a parameterized `actorUserId` argument).

**Required second-role human review complete** — WebDesk Solution, "Approve as-is," 2026-09-03,
accepting the 4 open tracked-debt findings. **The gate (G4-release-center) was then separately
requested and approved** — WebDesk Solution, decision CONFIRM, approved commit `c562586` on branch
`module-release-center` — see `outputs/webdesk-growth-dashboard/project.json`'s `gates[]`
(`current_gate` now `G4-release-center`) and
`docs/project-state/module-release-center-approval-checklist.md`'s "Sign-off" section. **"Push,
open a PR, and merge" was then separately requested and executed** — pushed to `origin`, opened as
[PR #112](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/112). A real
merge conflict against `main` surfaced (Decision and Activity Log module #37, PR #111, had merged
concurrently) — only `outputs/webdesk-growth-dashboard/project.json`'s `gates[]`/`audit_log` arrays
conflicted, resolved by keeping both sides' entries and re-sequencing version counters, fully
re-verified against a fresh local disposable database before pushing again (114 migrations clean,
1830/1830 `dashboard-api` unit tests, typecheck/lint/prettier all clean). All 14 CI checks then
confirmed green. Merged with a real merge commit (not squash/rebase) — merge commit
`87aac6b45104c9c84507f2e415256e31335a3f62`. Both Vercel projects auto-deployed on push to `main`
and were verified live directly, not just via CI's own Vercel status check — `dashboard-api`'s
`/health` returned `build.commitShaShort == 87aac6b`, confirming the exact merged commit is what's
serving; `GET /release-center/projects/:projectId/releases` returned a clean `401` (route live,
`SessionGuard` enforcing — not a `404`, which would mean the module never actually deployed); and
`dashboard-web`'s `/` resolves (via the intermediate `/home` hop) to `/auth/sign-in` for an
unauthenticated visitor, confirming the session gate is intact. **The Release Center module
backend is now genuinely live in production.** No `dashboard-web` UI exists yet for this module —
a separate, not-yet-requested next step, matching every prior module's own backend-first
precedent.

## `dashboard-web` UI

Closes this module's last named gap, following the backend's own build-to-production arc (PR #112
above). Built directly on the explicit "Release Center - Start the dashboard-web UI for it"
instruction. No approved wireframe/screen spec exists for this module — fields mirror
`createReleaseSchema`/`updateReleaseSchema`/`changeReleaseStatusSchema`/the four sub-resource
create DTOs directly, matching every sibling module's own "smallest honest reading" precedent for
an unsourced screen.

Four routes under `app/(shell)/release-center/`: list (project-scoped, header-cookie fallback per
the 2026-09-02 current-project-propagation fix), create, detail, edit. The detail page composes
six sections: Identity/Assignees (`assignedDeveloperUserId`/`assignedReviewerUserId`/
`productionApproverUserId`, resolved via `getUsersByIds()`), Content (`notes`/`hotfixReason`,
plain text), `ReleaseStatusActions` (the real 14-status/23-edge workflow, hand-mirrored from
`ReleasesService`'s own `TRANSITIONS` map, with `reason`/`rolledBackSha`/optional
`replacementReleaseId` fields that render and gate submission only when `rolled_back` is a legal
target), `ReleaseArtifactsSection` (add/list/real-HTTP-`DELETE`, client-side validated against the
backend's own `repoOwnerOrName` regex), `ReleaseApprovalsSection` (read-only, most-recent-first),
`ReleaseDeploymentsSection`/`ReleaseSmokeTestsSection` (append-only add/list), and a
rollback-record block (read-only, renders only when `GET .../rollback` returns a row).

`notes`/`hotfixReason`/status-transition `notes`/`reason` all stay plain `<textarea>`s, not
`RichTextEditor` — an explicit, documented exception to the 2026-08-22 standing rich-text rule,
since the backend DTOs explicitly state these fields are "deliberately plain, unsanitized text,"
and no paired backend sanitization change was made (out of scope for a frontend-only branch). New
`packages/shared-types` additions (`Release`/`ReleaseArtifact`/`ReleaseApproval`/`Deployment`/
`SmokeTest`/`RollbackRecord` and their enums) mirror `packages/database/src/release-center/entities.ts`
exactly. The two assignee `UserPicker` fields on `ReleaseForm` use the established owner/
`*Touched` data-loss-prevention pattern.

Built by a background agent with a fully-specified prompt naming Technical Center's list page and
Case Study Studio's bespoke status-actions component as the literal structural templates, then
independently re-verified in full by the orchestrating session — the full 23-edge `TRANSITIONS`
map diffed edge-for-edge against the real backend map (23/23 match), every mutating `fetch()` call
site diffed against the real controller routes/HTTP verbs (notably `POST .../releases/:id/update`,
not `PATCH`, and a real `DELETE .../artifacts/:artifactId`), typecheck/lint (`--max-warnings=0`)/
CSS-token-check (105 files)/1878 unit tests/production build (all 4 routes present)/prettier all
independently re-run and confirmed clean.

**Reviewed at light tier**, per the 2026-08-27 "right-size the review pipeline" standing rule — a
small, frontend-only UI slice consuming an already-reviewed, already-gated backend with no new
endpoint. A direct read-through pass found **0 findings**. Security review skipped per the same
standing rule — no new endpoint, no new RBAC/auth logic, no new sink. See
`docs/project-state/dashboard-web-release-center-approval-checklist.md`. **Required second-role
human review complete via the direct "Approve as-is, gate it and push the branch" instruction** —
the approval checklist's own findings summary served as the review artifact. **The gate
(G4-dashboard-web-release-center) was then approved** — WebDesk Solution, decision CONFIRM,
approved commit `a3e86c4` on branch `dashboard-web-release-center`.

**"Open a PR" was then separately requested and executed** — opened as
[PR #115](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/115). A real
merge conflict against `main` surfaced (Decision and Activity Log's own `dashboard-web` UI, PR
#113, and its limit-cap fix, PR #114, had both merged concurrently) — `packages/shared-types/src/index.ts`
(two independent new type blocks appended at the same point, both kept) and `project.json`'s own
`gates[]`/`audit_log` arrays conflicted, resolved by keeping both sides' entries and
re-sequencing version counters, fully re-verified (typecheck across all four packages, lint,
1896/1896 `dashboard-web` unit tests, production build with both `/release-center` and
`/decision-and-activity-log` routes present, prettier) before pushing again. All 14 CI checks then
confirmed green.

**"Merge PR #115" was then separately requested and executed** — merged with a real merge commit
(not squash/rebase), matching every prior merge in this project's history — merge commit
`24baf6559ebacc79e590e556f20b8e226113b616`. Both Vercel projects auto-deployed on push to `main`
and were verified live directly, not just via CI's own Vercel status check — `dashboard-api`'s
`/health` returned `build.commitSha == 24baf6559ebacc79e590e556f20b8e226113b616`, confirming the
exact merged commit is what's serving; `GET /release-center/projects/:projectId/releases` returned
a clean `401` (route live, `SessionGuard` enforcing — not a `404`, which would mean the route
never actually deployed); and `dashboard-web`'s `/release-center` correctly redirects (307) an
unauthenticated visitor to `/auth/sign-in`. **The `dashboard-web` Release Center UI is now
genuinely live in production**, closing out this slice's full build-to-production arc — backend
and now the full UI (list, detail, create/edit form, status actions, artifacts/approvals/
deployments/smoke-tests/rollback sub-resource sections) are both live for the Release Center
module.
