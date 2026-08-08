# HANDOFF — webdesk-growth-dashboard

- **Session ended:** 2026-08-07 (timezone: America/Toronto — confirmed default per `project.json`, not yet confirmed by the client; see `docs/project-state/setup-input-register.md`)
- **Session ID:** b6d0b96c-5964-4572-b360-842ea4eca533
- **Last active agent:** Backend role (Phase 1D-expanded — RBAC/permissions/separation-of-duties — built, validated, and documented on branch `phase-1d-rbac-permissions-expanded`, under explicit "Begin Phase 1D expanded scope" authorization; **not yet committed, pushed, or gated**. PR #8's narrower Phase 1D remains merged with its own gate not yet approved. Phase 1C's second-role security review completed 2026-08-07)
- **Build context:** nodejs
- **Project type / profile:** custom-app-build / webdesk-growth-dashboard
- **Active phase:** Phase 1D-expanded — RBAC, fine-grained permissions, confidential-field authorization, separation-of-duties expansion (`docs/task-packages/phase-1d-rbac-permissions-expanded.md`), built on top of the already-merged PR #8 `AuthzModule` per the user's own "supersedes/expands" decision. **Implementation and validation complete; not yet committed to the branch, not yet pushed, no PR opened, no gate requested.** See `docs/project-state/phase-1d-approval-checklist.md` (status: NOT approved) and `docs/project-state/phase-1d-validation-report.md`'s addendum. PR #8's own narrower Phase 1D gate is also still not approved. Phase 1A, 1B, and 1C remain approved, each scoped to itself only.
- **Current gate:** G4-1C (Phase 1C) is the last _recorded_ gate — see `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (authoritative). Recorded as `status: "overridden"` / `decision: "OVERRIDE"` — that historical record is left unmodified, since it accurately reflects the state at approval time; the subsequent review completion is a separate, later `audit_log` entry, not a rewrite of the gate. No gate has been recorded for either Phase 1D (PR #8) or Phase 1D-expanded yet.

> Gate status is authoritative ONLY in `project.json.gates[]`. If this file and `project.json` ever disagree, `project.json` wins.

> **The expanded "Phase 1D" brief (RBAC, fine-grained permissions, confidential-field access, a
> centralized policy/authorization service, separation-of-duties across many more scenarios),
> recorded verbatim in `docs/task-packages/phase-1d-rbac-permissions-expanded.md`, was explicitly
> authorized to begin this session ("Begin Phase 1D expanded scope") and has been built,
> validated, and documented in full** — see "Where we left off" below for the complete summary.
> **It has not been committed, pushed, or opened as a PR yet**, and no gate has been requested —
> both remain the next concrete steps, each requiring its own separate explicit authorization per
> this project's standing discipline.

## Where we left off

Phase 1C (built and validated in the prior session/earlier this session) was pushed, opened as
PR #7, and — after explicit separate "merge the PR" authorization — merged to `main` at commit
`102397d2f1aaf9fc5d374dd4bd58c764cb031ef9`. Two real bugs surfaced by CI (not caught locally) were
fixed post-merge on the same branch before the merge completed: a `SequelizeStorage` migration-name
mismatch between the compiled-CLI and Vitest-transformed-TS execution paths, and a CI "Integration
tests" job that never built `@webdesk/database` first and provided no database container even
though the new e2e suite genuinely needs one.

The user then asked "what is the next step" (answered with options, no action taken) and gave
explicit authorization: **"Begin RBAC (Task 6)."**

**Phase 1D was then built and validated in full**, on branch `phase-1d-rbac-authorization`:

- `packages/database`: 5 new migrations (`roles`, `modules`, `role_permissions`, `user_roles`, and
  a seed migration transcribing the real, already-approved 7-role × 21-module matrix from
  `06_Roles_and_Permissions.md §3` — 458 grant rows), Sequelize models, and 4 repositories under
  `src/authz/`.
- `apps/dashboard-api`: `AuthzModule` — `PermissionService` (deny-by-default evaluation),
  `PermissionGuard` + `@RequirePermission`, and the "Users/roles" module's own real HTTP surface
  (`RoleAssignmentController`/`RoleAssignmentService`) as the one feature this phase builds to
  prove the framework — the other 20 business modules don't exist as code yet. Also filled two real
  Phase 1C gaps this phase needed: a `SessionGuard` (didn't exist) and a reusable
  `SeparationOfDutiesService` (previously inline-only in `RecoveryService`).
- `docs/security/threat-model-authorization-rbac.md`: the required STRIDE pass for "Authorization"
  — self-review only, and it flags one genuinely unresolved design gap: `RoleAssignmentService`
  performs no separation-of-duties check on self-targeting role changes (a Super Admin can freely
  re-role themselves with no second approver). Not silently fixed or silently left out — surfaced
  explicitly for the second-role reviewer's decision.

**146 unit tests + 63 real-database integration/e2e tests, all passing** (115+31 unit across
dashboard-api/database, 35 database integration + 28 dashboard-api e2e) — see
`docs/project-state/phase-1d-validation-report.md` for the full command-by-command record,
including 2 real bugs found and fixed during this work: `@UsePipes` at the method level on
`RoleAssignmentController.assignRole` ran the Zod body-schema against every handler parameter
including `@Param("userId")`, silently rejecting every real assignment with a 400 (fixed by scoping
the pipe to `@Body()` directly); and a missing `fileParallelism: false` in
`vitest.integration.config.mts` that let two e2e-spec files race concurrent database migrations
once a second one existed. Full monorepo validation suite (build/lint/typecheck/format/boundaries/
secrets/test/CI-equivalent integration commands) passes clean; `pnpm audit` shows the same 19
pre-existing findings as before (this phase added zero new npm dependencies).

**Phase 1D was then committed, pushed, opened as PR #8, and — after explicit separate "merge the
PR" authorization — merged to `main`.** CI's initial run on PR #8 caught a real gap not caught
locally: 3 docs (`phase-1d-validation-report.md`, the traceability matrix, `HANDOFF.md`) had been
written/edited after the session's last `prettier --write` pass and were never reformatted —
fixed on the branch and re-verified green before merging. The only remaining red check
("Dependency vulnerability audit") is the same pre-existing, `continue-on-error: true` finding
every prior PR has shown, not a regression.

**The user then said "Phase 1C approved."** Asked directly whether that meant the second-role
threat-model review had actually happened, should be waited for, or the approval should be
informal only, the user chose: **approve the G4-1C gate now, with the review recorded as a
still-outstanding open item** — not silently marked complete, not left unrecorded either.
`docs/project-state/phase-1c-approval-checklist.md` was authored to formalize this, and
`project.json`'s `gates[]`/`audit_log` recorded a `status: "overridden"` / `decision: "OVERRIDE"`
entry (not a clean `CONFIRM`) for exactly this reason. `CLAUDE.md`, this file, and
`docs/project-state/setup-input-register.md` were all updated to carry the same open item forward.

**The user then asked "Phase 1C do Completed security review."** Clarified first (given ADR-0010's
requirement that the reviewer be a human role distinct from the implementing agent — the model
itself cannot satisfy this by reviewing its own work again, no matter how thoroughly) what
"completed" meant; the user confirmed they had reviewed
`docs/security/threat-model-authentication-session-handling.md` themselves and asked for their
sign-off to be recorded. Updated: the threat model's own "Review status"/"Next steps" sections,
`docs/project-state/phase-1c-approval-checklist.md` (item 11 checked, new "Second-role security
review" section, the "Open condition" section marked resolved without deleting the original
historical record), `project.json` (new `audit_log` entry — the G4-1C gate's own historical entry
left unmodified, since it accurately reflects the state at approval time), `CLAUDE.md`, and this
file. The expanded Phase 1D brief's own precondition (the Phase 1C review) is now satisfied, but no
"begin" instruction has been given — it remains explicitly not started.

**The user then said "Begin Phase 1D expanded scope"** (pasting the same 34-section brief again in
full). This is the current, active, explicitly authorized work, built on branch
`phase-1d-rbac-permissions-expanded` (created from `main` at the same commit PR #8 merged to) on
top of the already-merged narrower `AuthzModule`, not rebuilding it:

- Centralized `AuthorizationService` retires `PermissionService` outright (deleted, not kept
  parallel) — `evaluate`/`can`/`canViewConfidential`/`canEditConfidential`/
  `getEffectiveCapabilities` (proven N+1-safe)/`recordAccessDenied`.
- 43-module registry (`module_registry`, migrations `00014`/`00015`) mapped to the existing
  21-row permission-group matrix — the mapping is this implementer's own reasoned cross-reference
  between two documents that don't cross-reference each other, explicitly flagged for the
  required second-role review.
- Project-scoped role assignment (`user_roles.project_id`, migration `00016`) — schema and
  repository layer fully proven against a real database; no HTTP route exercises it yet.
- Confidential-field actions (`view_confidential`/`edit_confidential`) real and checked, zero
  grants seeded for any role (deny-by-default preserved, "Configurable" ≠ "Yes").
- `authorization_actions` append-only table (migration `00017`) and
  `SeparationOfDutiesService.assertNoPriorConflictingAction` — the reusable cross-request
  separation-of-duties foundation; no business workflow calls it yet (none exists).
- **Self-role-assignment is now blocked** — `RoleAssignmentService.assignRole`/`revokeRole` call
  `SeparationOfDutiesService.assertDistinctActors` first, closing the exact gap the prior STRIDE
  pass flagged for the second-role reviewer's decision — closed under this brief's own explicit
  §21/§33 instruction, not a unilateral fix. Every denial now records a
  `separation_of_duties_denied` auth event (previously declared in the shared event vocabulary but
  never emitted).
- Super Admin bootstrap CLI (`bootstrap-super-admin.ts`), verified by real end-to-end execution
  against a disposable database (not just code review).
- `GET /me/capabilities`, `GET /authz/modules`, `GET /authz/module-registry`.
- Session/caching freshness strategy documented: no caching layer exists (every check resolves
  server-side per request), plus the pre-existing session-revocation-on-role-change behavior —
  both approved strategies from the brief's own §23/§24, not just one.
- 9 required documents produced (`docs/implementation/phase-1d-{permission-catalog,rbac-architecture,
role-permission-matrix,separation-of-duties,confidential-field-authorization,file-inventory,
security-review}.md`, `docs/project-state/phase-1d-validation-report.md`'s addendum, and
  `docs/project-state/phase-1d-approval-checklist.md`) plus a resolution note appended to the
  original `docs/security/threat-model-authorization-rbac.md` (historical rows left unmodified).

**144 unit tests + 41 real-database integration tests + 37 real-database e2e tests, all passing**
(up from PR #8's 146 unit + 63 integration/e2e — some Phase 1D unit tests were retired alongside
`PermissionService`'s deletion and replaced by `AuthorizationService`'s own suite; net new
coverage added for module registry, project-scoping, `authorization_actions`, privilege-escalation,
`/me/capabilities`, and the catalog endpoints). Two real bugs found and fixed during this work,
both via actually running tests against the real database rather than code review alone: a
migration `00015` row-count assertion (`!== 43`) caught an initial 44-row seed from an incorrectly
split "Import and Export Center" entry; and an integration test's own semantic assertion was
traced through and corrected (project-scoping the _assignment_ does not create a separate copy of
a role's own global grants — the corrected test now asserts `true`, not the initially-written
`false`). `eslint --max-warnings=0` and `tsc --noEmit` both clean; `pnpm format:write` applied to
all 9 new/edited docs and the reformatted `00015` migration, re-verified with a full lint/typecheck/
build/test pass afterward.

**Not yet done:** the branch has not been committed, pushed, or opened as a PR; no gate has been
requested from the human approver; `docs/traceability/phase-0-requirements-traceability.md` and
`docs/phase-plans/phase-1-foundation-plan.md` updates for the expanded scope, and this file's own
final state, are being written now as part of the same documentation pass.

The 21 real business-module endpoints, the general ADR-0017 audit-log subsystem (Task 7), and
user-management CRUD beyond role assignment (Task 8) remain explicitly out of scope for everything
shipped so far — Phase 1D-expanded's own §32 exclusion list.

## Files committed this session

See each PR's own commit history (`main`'s log) for exact file lists — not duplicated here to
avoid drift between records. Merged PRs: #1 (Phase 1A foundation), #2 (Phase 1B task package), #3
(dependency-audit fixes), #4 (Postgres provider confirmation), #5 (Phase 1B database foundation),
#7 (Phase 1C authentication/session management), #8 (Phase 1D RBAC/authorization, including a
follow-up formatting-fix commit CI caught). Plus a working-tree-only update (not yet committed —
see below): `docs/project-state/phase-1c-approval-checklist.md` and the related doc updates
recording Phase 1C's G4-1C gate approval.

## Files pending commit (work in progress)

| File                                                                                                                                                                                                                                                                                  | Status                                                                             | Blocker                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `docs/project-state/phase-1c-approval-checklist.md` (new), `project.json` (gate/audit_log/version), `CLAUDE.md`, this file, `docs/phase-plans/phase-1-foundation-plan.md`, `docs/project-state/setup-input-register.md` — all recording the Phase 1C G4-1C gate approval via OVERRIDE | Written, staged locally                                                            | None — pending commit in this session, on `main` directly (no open feature branch for this gate-recording work)       |
| All Phase 1D-expanded source, test, migration, and documentation files — see `docs/implementation/phase-1d-file-inventory.md` for the complete, git-status-derived list                                                                                                               | Written, all tests passing locally, on branch `phase-1d-rbac-permissions-expanded` | None — pending an explicit "commit and push" instruction, then a separate explicit "open a PR" instruction (no merge) |

## Next 3 tasks (queued)

1. Commit the Phase 1D-expanded work, push the branch, and open a PR (no merge without a separate
   explicit instruction) — task #140 in this session's own tracking, not yet done.
2. Obtain the required second-role human review of all three STRIDE-family documents:
   `docs/security/threat-model-authentication-session-handling.md` (Phase 1C, gate already
   approved via OVERRIDE pending this), `docs/security/threat-model-authorization-rbac.md` (PR #8's
   narrower Phase 1D), and `docs/implementation/phase-1d-security-review.md` (this expansion) —
   neither Phase 1D gate can be considered until its review happens or the approver makes an
   explicit override decision, as was done for Phase 1C.
3. Await explicit review/approval of both Phase 1D gates, then resolve the remaining setup inputs
   that block a real deployment (Google Workspace OAuth client, the real emergency-administrator
   account list, `dashboard-web`'s real deployed origin) before the 21 real business modules (which
   depend on Phase 1C's auth and both Phase 1D scopes) become the next candidate work.

## Client blockers (waiting on)

- ~~`[2026-08-07]` Second-role human review of `docs/security/threat-model-authentication-session-handling.md` (Phase 1C)~~ —
  **resolved 2026-08-07**, reviewed and approved by WebDesk Solution. See
  `docs/project-state/phase-1c-approval-checklist.md`'s "Second-role security review".
- `[2026-08-07]` — Second-role human review of `docs/security/threat-model-authorization-rbac.md`
  (Phase 1D, PR #8) — separate document, still outstanding once its own gate is reached. Blocked on
  a second, human role distinct from the implementing agent existing at all — `project.json`'s
  `assigned_team` is entirely `TBD`. Owner: to be assigned.
- `[2026-08-07]` — Second-role human review of `docs/implementation/phase-1d-security-review.md`
  (Phase 1D-expanded, this session's own new pass) — same blocker as above, same not-yet-assigned
  owner.
- `[2026-08-06]` — Timezone confirmation (currently defaulted to America/Toronto, not yet
  confirmed by the client). Owner: PM.
- `[2026-08-07]` — The real Google Workspace OAuth client (client ID, secret, authorized redirect
  URIs) — blocks a real deployment, not any phase's own code completion. Owner: infrastructure
  owner.
- `[2026-08-07]` — The real emergency-administrator account list — the provisioning mechanism is
  built and verified end-to-end; no real accounts exist yet. Owner: PM/security owner.
- `[2026-08-07]` — `dashboard-web`'s real deployed origin (needed for `WEB_APP_ORIGIN`'s CORS/CSRF
  allowlist). Owner: infrastructure owner.
- ~~`[2026-08-07]` First-login provisioning model (JIT vs. pre-provisioned)~~ — **resolved**,
  pre-provisioned only, confirmed directly by the project owner.
- ~~`[2026-08-06]` Postgres Marketplace provider confirmation~~ — **resolved 2026-08-07**:
  Supabase, `us-east-1`. Not yet provisioned.
- ~~`[2026-08-06]` Actual GitHub repository creation~~ — **resolved**, repository real and
  reachable, all prior PRs merged to `main` including Phase 1C (#7).

## Open failure modes captured this session

None outstanding — every bug found during this session's Phase 1D work (see "Where we left off"
above and `docs/project-state/phase-1d-validation-report.md` §6/§7 for the full detail) was fixed
and re-verified before this handoff was written, not merely worked around. One design gap remains
genuinely open by decision, not by oversight: see "Where we left off"'s note on the STRIDE pass's
flagged separation-of-duties finding.

## Decisions made this session

Format: `[YYYY-MM-DD] [ADR-id if applicable] — summary.` Also appended to `CLAUDE.md` "Recent decisions".

- `[2026-08-07]` Phase 1C merged to `main` via PR #7 at commit
  `102397d2f1aaf9fc5d374dd4bd58c764cb031ef9`, under explicit separate "merge the PR" authorization.
  Two real CI-only bugs found and fixed on the branch before merge (migration-name mismatch,
  integration-test job build-order/missing-database gaps).
- `[2026-08-07]` Phase 1D (RBAC/authorization) built and validated under explicit user
  authorization ("Begin RBAC (Task 6)") — see `docs/task-packages/phase-1d-rbac-authorization.md`
  and `docs/project-state/phase-1d-validation-report.md`. Not yet approved/merged.
- `[2026-08-07]` `docs/security/threat-model-authorization-rbac.md` — the required STRIDE pass for
  "Authorization" — authored as a self-review, flags one genuinely unresolved design gap
  (self-assignment separation-of-duties) for the second-role reviewer's decision, not silently
  resolved either way.
- `[2026-08-07]` Traceability (`docs/traceability/phase-0-requirements-traceability.md` REQ-R01–R05,
  REQ-005's note), `docs/phase-plans/phase-1-foundation-plan.md` (Task 6 marked complete, awaiting
  approval), and `CLAUDE.md` all updated to reflect Phase 1D.
- `[2026-08-07]` Phase 1D pushed and opened as PR #8; CI caught 3 unformatted docs (missed by a
  local `format:write` run before the last edits), fixed and re-verified green; merged under
  explicit separate "merge the PR" authorization.
- `[2026-08-07]` Phase 1C's G4-1C gate approved by explicit **OVERRIDE** — see
  `docs/project-state/phase-1c-approval-checklist.md`. Asked directly whether the second-role
  threat-model review had happened, should be waited for, or skipped informally, the approver
  chose to approve the gate now with the review recorded as a still-outstanding open item.
- `[2026-08-07]` Received a much larger "Phase 1D" brief (RBAC, fine-grained permissions,
  confidential-field access, centralized policy/authorization service, separation-of-duties across
  many more scenarios) — recorded verbatim in
  `docs/task-packages/phase-1d-rbac-permissions-expanded.md`, explicitly not started. Asked
  directly: (1) whether the Phase 1C OVERRIDE-based approval satisfies this brief's own
  precondition of a completed security review — the user chose to wait for the real second-role
  review instead; (2) how this brief relates to the already-merged, narrower Phase 1D (PR #8) —
  the user chose "supersedes/expands," build on top of PR #8's `AuthzModule`, not rebuild it.
- `[2026-08-07]` The second-role human review of `docs/security/threat-model-authentication-session-handling.md`
  (the open item from the G4-1C OVERRIDE, and the precondition the expanded Phase 1D brief above
  was waiting on) was completed: WebDesk Solution reviewed and approved the document. See
  `docs/project-state/phase-1c-approval-checklist.md`'s "Second-role security review" and
  `project.json`'s `audit_log`. This satisfies that one precondition but is not itself
  authorization to begin the expanded Phase 1D brief.
- `[2026-08-07]` Explicit authorization received ("Begin Phase 1D expanded scope") to build
  `docs/task-packages/phase-1d-rbac-permissions-expanded.md` on top of the already-merged PR #8
  `AuthzModule`. Built, validated, and documented in full this session — see "Where we left off"
  for the complete summary. Not yet committed, pushed, or gated.
- `[2026-08-07]` Self-role-assignment separation-of-duties gap (flagged, not fixed, in the original
  `docs/security/threat-model-authorization-rbac.md`) closed under the expanded brief's own
  explicit §21/§33 instruction — a resolution note was appended to that original document rather
  than rewriting its historical STRIDE row, and the closure is separately documented in full in
  `docs/implementation/phase-1d-security-review.md`.

## Token / context usage this session (optional)

- Not tracked precisely this session — see `docs/project-state/setup-input-register.md` for the
  standing budget-tracking gap (token_cap/hours_budget are zero-valued placeholders in
  `project.json` pending a real G1 estimate).

## What NOT to do on resume

- Do NOT design or scaffold `dashboard-worker` as a permanent process (resolved decision, profile
  `knowledge/04-serverless-queues-workflows-and-cron.md`, WDS-005).
- Do NOT load `nodejs/integrations/{bigcommerce,shopify,erp}/*` — not this project's scope.
- Do NOT begin the 21 real business-module endpoints, the general ADR-0017 audit-log subsystem
  (Task 7), or user-management CRUD beyond role assignment (Task 8) without a separate, explicit
  authorization — Phase 1D-expanded's own eventual approval covers this expansion only, per its
  task package's §32 out-of-scope list.
- Do NOT build a grant-editing endpoint for `view_confidential`/`edit_confidential`, a real
  project-scoped HTTP route, or any real confidential business field without a separate, explicit
  authorization — the underlying mechanisms are built and tested, but activating them over HTTP
  was not requested by this expansion's own endpoint list.
- Do NOT push to `origin` or open a PR for the Phase 1D-expanded branch without separate, explicit
  authorization for each of those two actions specifically.
- Do NOT create a real Google OAuth client, and do NOT test the SSO flow against a real Google
  Workspace account — deliberately tested against mocked/offline configuration only.
- Do NOT wire a real SMTP send for emergency-admin login alerts — logged only for now; Google
  Workspace SMTP integration doesn't exist yet.
- Do NOT provision the actual Supabase database — the provider/region are confirmed
  (`project.json`), but confirming is not provisioning; every test so far ran against a local/CI
  disposable instance.
- Do NOT treat either STRIDE threat-model pass (authentication/session or authorization) as a
  completed, approved security review — both are self-reviews only, pending the required
  second-role human review.
- Do NOT treat the Service/SEO Library workbook (`canonical-inputs/WebDesk_Service_SEO_Library_Templates_v4.xlsm`) as approved business content, even where its own internal "Approval Status" column says "Approved". See `knowledge/00-scope-and-precedence.md §4`.
- Do NOT push to `origin` without separate PM authorization for that specific push, and do NOT
  merge any PR without a separate, explicit "merge" instruction.

## Session links

- `main`'s tip is always the live answer (`git rev-parse HEAD` / `git ls-remote origin main`) —
  not restated here as a fixed SHA, since it trails whatever this session's own commits add.
- Staging URL: not yet provisioned
- Mockup preview URL (if active): none
- Merged PRs: [#1](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/1) (Phase 1A foundation), [#2](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/2) (Phase 1B task package), [#3](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/3) (dependency-audit fixes), [#4](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/4) (Postgres provider confirmation), [#5](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/5) (Phase 1B database foundation), [#7](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/7) (Phase 1C authentication/session management), [#8](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/8) (Phase 1D RBAC/authorization)
- Open PRs / issues: none currently open — the Phase 1C gate-approval doc update is uncommitted, working-tree-only, next step

---

Last touched: 2026-08-07 · by Claude (Phase 1D-expanded — RBAC/permissions/separation-of-duties —
built, validated, and documented on branch `phase-1d-rbac-permissions-expanded` under explicit
authorization; not yet committed, pushed, or gated. PR #8's narrower Phase 1D remains merged, gate
not yet approved. Phase 1C's G4-1C gate approved via OVERRIDE, second-role review has since
completed.)
