# HANDOFF — webdesk-growth-dashboard

- **Session ended:** 2026-08-15 (timezone: America/Toronto — confirmed default per `project.json`, not yet confirmed by the client; see `docs/project-state/setup-input-register.md`)
- **Session ID:** b6d0b96c-5964-4572-b360-842ea4eca533
- **Latest work:** Projects module backend built under explicit "begin implementation" authorization
  — schema (migrations `00036`-`00044`), API, RBAC wiring (including a real fix to a
  previously-flagged dormant `Op.in`/NULL bug in project-scoped permission queries, surfaced by
  this module's own e2e tests), and tests. Then this project's own `code-review` skill was run
  (high effort, explicit "run code review on the branch" instruction) — 9 CONFIRMED findings, most
  severe an IDOR letting a user authorized on one project mutate another project's sub-resources
  by ID — all 9 fixed under explicit "fix the confirmed findings" instruction: IDOR scoping across
  5 sub-resource repositories/services/controllers, a roadmap-item status-bypass fix,
  `setActivePhase()` wrapped in a real `withTransaction()`, an unused index removed and a missing
  one added, a speculative `provider` column and 4 dead `findById()` methods removed, and repository
  mapping duplication collapsed into a shared `entity-mapping.ts` helper. Full re-validation on a
  fresh local disposable database: 28 `packages/database` unit + 117 `packages/database`
  integration + 313 `dashboard-api` unit + 85 `dashboard-api` integration/e2e + 8 `dashboard-web`
  unit tests, all passing; typecheck/lint/format clean; migration round-trip clean; module-registry
  validation clean; `pnpm audit` 0 vulnerabilities; secret scan clean. Still on branch
  `module-projects-foundation`, pushed to PR #24, then CI's Lint/Formatting validation failed on a
  single inline-type-import eslint rule — fixed, all 14 checks green. "Merge PR #24" was then
  requested but held per this project's standing discipline (security review → second-role human
  review → gate decision, each separate, before merge). This project's own `security-review` skill
  then ran against the branch — 2 CONFIRMED findings, most severe a real privilege-escalation path
  letting any `owner_growth_approver` mint unlimited co-approvers via the new project-approver
  endpoint despite that role deliberately lacking `users_roles:edit` in the approved matrix — both
  fixed under explicit "fix those" instruction, plus new unit and real-database e2e coverage.
  Full re-validation: typecheck/lint/format clean; 315 `dashboard-api` unit + 87
  `dashboard-api` integration/e2e tests, all passing. A review packet (published as a Claude
  artifact — code-review + security-review findings, fixes, and validation evidence) was then
  prepared for the required second-role human review, since the implementing agent cannot also be
  its own reviewer (ADR-0010). **Jitesh D reviewed it and returned "Approved"** — recorded in the
  new `docs/project-state/module-projects-foundation-approval-checklist.md`. This satisfies the
  last precondition before a gate decision, but is not itself a gate decision or merge
  authorization. Still on branch `module-projects-foundation`,
  [PR #24](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/24) — **not
  merged, not deployed, no production migration run, no UI yet.** See the 2026-08-15 "Recent
  decisions" entries in `CLAUDE.md` for the full record.
- **Last active agent:** Backend role. Phase 1F (application shell, canonical 43-module registry extension, registry-driven navigation, observability foundation, accessibility, staging documentation, module-implementation roadmap) fully built, code-reviewed, security-reviewed, second-role human reviewed (Jitesh D and Brijesh D, Approved as-is), gated (G4-1F, WebDesk Solution, CONFIRM), and **merged to `main`** via [PR #23](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/23) (merge commit `1e8f343c4779237a4fe75c3c663716877990dc20`), under explicit "merge PR #23" authorization. Both `dashboard-web` and `dashboard-api` auto-deployed to production on the merge; **both verified live directly** (not just via CI's own Vercel status check) — `dashboard-api`'s `/health` returned `build.commitSha == 1e8f343...` and `environment == "production"`, confirming the exact merged commit is what's serving; `dashboard-web`'s `/` correctly redirected an unauthenticated visitor to `/auth/sign-in` via the new `(shell)` layout's session gate. **All 35 production database migrations are now applied** — the user ran `pnpm --filter @webdesk/database run migrate` (2026-08-14), which applied 17 pending migrations, independently confirmed via a separate `migrate:status` check (35 executed, 0 pending). This surfaced a previously-undocumented gap: only 2 of the 17 (`00034`/`00035`) were Phase 1F's own migrations — the other 15 (`00019`–`00033`) were the **entire remaining Phase 1E operational-infrastructure schema** (jobs, retention, notifications, operational contacts, system events/health), merged and gated on 2026-08-13 but never actually applied to production until this run. No production impact is known (no real user traffic yet).
- **Build context:** nodejs
- **Project type / profile:** custom-app-build / webdesk-growth-dashboard
- **Active phase:** Phase 1F — application shell, canonical module registry, navigation authorization, UI foundation, observability, CI/accessibility, staging documentation, and module-implementation planning artifacts, per the Phase 1F authorization brief. Built on branch `phase-1f-application-shell`, gated, and **merged to `main`** (merge commit `1e8f343c4779237a4fe75c3c663716877990dc20`). Builds zero business functionality for any of the 43 real modules (`module_registry.implementation_status = 'not_started'` for all 43) — shell/registry/observability plumbing only, per the brief's own explicit scope boundary. Phase 1E and all prior phases remain approved and unaffected. Production deployment happened automatically on merge (Vercel's standing auto-deploy-on-push-to-`main` behavior) and has been verified live; the production database is now fully migrated through `00035` (see above). Any Wave 1/module-implementation start, and the remaining Task 7 (audit query surface, retention-deletion job) and Task 9 (real background-worker/queue trigger) scope, remain separate, not-yet-requested next steps.
- **Current gate:** **G4-1F** (Phase 1F, approved 2026-08-14, clean CONFIRM) is now the last approved gate — approved commit `7d84f040bce67fa7cd1e92aa69e8512021b39b64` on branch `phase-1f-application-shell`, merged to `main` via PR #23 (merge commit `1e8f343c4779237a4fe75c3c663716877990dc20`). See `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (authoritative).

> Gate status is authoritative ONLY in `project.json.gates[]`. If this file and `project.json` ever disagree, `project.json` wins.

> **Phase 1F status as of 2026-08-14:** all planned work is built and fully validated on branch
> `phase-1f-application-shell` (13 commits: kickoff, module-registry extension, registry
> validation, navigation API, design-system/UI-state components, identity API, application shell,
> observability foundation, accessibility checks, staging documentation, module roadmap + task
> template, code-review fixes, implementation docs, security review). Full validation suite: 294
> `dashboard-api` unit + 108 database integration + 79 e2e + 9 Playwright (incl. 3 axe-core WCAG
> 2.2 AA checks, zero violations) all passing; migration up/down round trip clean (35 migrations);
> module-registry validation passing (43 modules, 21 permission groups); `pnpm audit` 0
> vulnerabilities; secret scan clean (530 files); production build clean. Independent code review
> (8-angle, high effort) surfaced 14 findings — 9 fixed (a dropped `font-family`, 5 unwired design-
> token groups, a triplicated version constant, alphabetical-instead-of-canonical nav ordering,
> duplicate/conflicting page headings, a silently-swallowed missing-env-var case matching a real
> prior production incident, an implicit-vs-explicit fetch-memoization gap, a weakened test
> assertion, and a narrowed security-header test), 5 recorded as tracked debt (Sentry's currently-
> inert unscrubbed exception forwarding — must fix before any real DSN — a narrow `/me` vs
> `/me/navigation` account-status asymmetry, `NavigationService` reimplementing capability logic
> inline instead of using `AuthorizationService`, a transient migration-gap type cast, and 43
> module keys hand-duplicated across 3 files). **Required second-role human review complete** —
> Jitesh D and Brijesh D reviewed the full code-review disposition and the full security review,
> decision **Approved as-is**, 2026-08-14, no disputes raised. **The Phase 1F gate (G4-1F) is
> approved** — WebDesk Solution, decision **CONFIRM** (clean pass, not an override, since the
> second-role review was already complete before the gate was requested), 2026-08-14, approved
> commit `7d84f040bce67fa7cd1e92aa69e8512021b39b64`. **PR #23 was then merged to `main`** under
> explicit "merge PR #23" authorization — merge commit `1e8f343c4779237a4fe75c3c663716877990dc20`,
> all 14 CI checks green before merge (Integration tests and Database migration test were waited
> on to completion). Both `dashboard-web` and `dashboard-api` auto-deployed to production on the
> merge and were **verified live directly** (not just via CI's own Vercel status check) —
> `dashboard-api`'s `/health` returned `build.commitSha == 1e8f343...`/`environment ==
"production"`, and `dashboard-web`'s `/` correctly redirected to `/auth/sign-in` via the new
> `(shell)` layout's session gate. **The production database is now fully migrated** — the user ran
> `pnpm --filter @webdesk/database run migrate` (2026-08-14), same "user runs it themselves" pattern
> as every prior phase's production migration, applying 17 pending migrations. Independently
> confirmed via a separate, later `pnpm --filter @webdesk/database run migrate:status` check:
> 35 executed, 0 pending. **This surfaced a previously-undocumented gap**: only `00034`/`00035`
> were Phase 1F's own migrations — the other 15 (`00019` through `00033`) were the entire remaining
> Phase 1E operational-infrastructure schema (audit-schema expansion, jobs/job_attempts/idempotency
> keys, retention_policies/retention_holds, notifications, operational_contacts/incident_severity_
> policies, system_events/system_components/system_health_checks). That schema was merged to `main`
> and gated (G4-1E, CONFIRM) on 2026-08-13, but had never actually been applied to the production
> database — the last production migration before this run was `00018` (`create-audit-events`, run
> 2026-08-12). Everything merged after that sat unapplied in production for roughly a day and a
> half. No production impact is known to have resulted, since this project has no real user traffic
> yet and none of the newly-migrated tables' endpoints had been exercised live. See
> `docs/project-state/phase-1f-validation-report.md` and
> `docs/project-state/phase-1f-approval-checklist.md`'s "Sign-off" section for the full Phase 1F
> record, and `outputs/webdesk-growth-dashboard/project.json`'s `audit_log` for the migration entry.

> **Phase 1E status as of 2026-08-13 (updated three times):** all six architecture slices are
> built, CI-green, and **now merged to `main`** — audit foundation (PR #11), audit schema-expansion
> (PR #13), job architecture (PR #14), notification foundation (PR #15), retention architecture
> (PR #16), operational contacts (PR #17), system events/health (PR #18). Three fix PRs (#20, #21,
> #22) closing findings surfaced during merge reconciliation and the security-review pass are also
> merged — `main`'s HEAD is `6ae8a36116f70ed0f4d429af12774e05b2092e70`. Every independent-code-review
> finding across all six slices has been fixed and re-validated. The user went through all 5
> security-review policy questions one by one, explicitly deciding each: notification recipient
> existence checks, contact-PII confidential gating, and `JobRetryService.manualRetry()`'s
> `maxAttempts` cap were decided "fix now" (commits `df07eb8`, `f632e96`, `a6305c1`, merged via
> PR #22). Retention-hold approver verification and the latent `projectId` query-filter scoping
> issue were decided "accept as tracked debt." **Final disposition: 8 of 10 security findings
> fixed, 2 accepted as debt.** **The required second-role security review is now complete** —
> Jitesh D reviewed the full code-review disposition, the full security-review disposition, and
> the 3 new fixes' own diffs, decision **Approved as-is**, 2026-08-13, no disputes raised. **The
> Phase 1E gate (G4-1E) is now approved** — WebDesk Solution, decision CONFIRM (clean pass, not an
> override, since the review above was already complete before the gate was requested), 2026-08-13,
> approved commit `6ae8a36116f70ed0f4d429af12774e05b2092e70`. See
> `docs/project-state/phase-1e-validation-report.md` for the full consolidated record and
> `docs/project-state/phase-1e-approval-checklist.md`'s "Sign-off" section for both recorded
> decisions. **Phase 1E is now closed.**

## Phase 1E — this session's actual current state (supersedes the Phase 1D sections below for "next tasks"/"blockers"/"session links" purposes)

**Next tasks (queued):**

1. ~~Push branch `fix-phase1e-security-review-policy-decisions`, open a PR, and get a separate
   merge authorization~~ — **done**, merged via PR #22.
2. ~~Second-role human review~~ — **done**. Jitesh D, Approved as-is, 2026-08-13, per
   `docs/project-state/phase-1e-approval-checklist.md`'s "Sign-off" section.
3. ~~A Phase 1E gate decision~~ — **done**. G4-1E approved (WebDesk Solution, CONFIRM, 2026-08-13).
   Phase 1E is closed. Phase 1F (application shell, canonical module registry, navigation,
   CI/staging foundation) is the next candidate per the authorization brief's own scope, but still
   requires its own separate, explicit authorization to begin.

**Client blockers (waiting on):** same as before Phase 1E work began — the real emergency-
administrator account list, the WordPress Application Password account (production/development),
real timezone confirmation. None of Phase 1E's own deliverables are blocked on these.

**Session links (Phase 1E):**

- [PR #11](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/11) audit foundation — **merged**
- [PR #13](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/13) audit schema expansion — **merged**
- [PR #14](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/14) job architecture — **merged**
- [PR #15](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/15) notification foundation — **merged**
- [PR #16](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/16) retention architecture — **merged**
- [PR #17](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/17) operational contacts — **merged**
- [PR #18](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/18) system events & health — **merged**
- [PR #20](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/20) fix: migration 00019 immutability-trigger bug — **merged**
- [PR #21](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/21) fix: SoD-audit / retention-category validation — **merged**
- [PR #22](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/22) fix: 3 security-review policy findings (notification recipients, contacts PII gating, manual-retry cap) — **merged**

## Phase 1D (prior phase) — historical record, unchanged below

The section below describes Phase 1D's own completion and is left as an accurate historical
record of that phase; it predates Phase 1E and is not the active phase anymore.

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

**The work was then committed (`9973b70`), pushed, and opened as PR #9** — under explicit "push and
open PR now" authorization. CI green on every real check (lint, typecheck, build, unit, integration,
migration test, formatting, boundary check, secret scan); the "Dependency vulnerability audit"
check showed the same pre-existing, `continue-on-error: true` finding as every prior PR at the time.

**The user then asked "why dependency vulnerabilities are not fix"** — explained the four groups
(multer/file-type/`@nestjs/core` pinned by NestJS 10.x with no patch in that line; postcss/sharp
pinned by Next.js 15.x with no patch in that line; `ajv` blocked by a prior failed override attempt;
vitest/vite requiring a 2.x→3.x major bump) and why each was deferred as its own risk-bearing
decision. **The user then asked to attempt all three major bumps.** On a fresh branch
(`security/major-dependency-upgrades`, off `main`, deliberately not mixed into PR #9's own scope):
Next.js 16.3.0 (fixes postcss/sharp — confirmed no patch existed anywhere in the 15.x line first),
NestJS 11.1.28 including the bundled Express 4→5 jump (audited every route decorator for
wildcard/deprecated-API usage beforehand, none found), and Vitest 3.2.7 (deliberately the minimal
safe version, not the newest available 4.x, given the fragile `unplugin-swc` DI wiring — verified
against the real NestJS DI container via the e2e suite, not just unit tests that bypass DI via
`new`). Two more findings surfaced and fixed during this pass: a bounded `uuid` override
(`sequelize`'s internal pin) and a bounded `vite` override (`vitest`'s own broad peer range kept an
unpatched version resolved). `ajv` turned out to resolve itself as a side effect of the NestJS
bump's newer `@angular-devkit` chain. `pnpm audit`: 19 → **0**. Committed, pushed, opened as PR #10
under explicit authorization at each step — see `docs/project-state/dependency-audit-2026-08-08.md`.

**The user then said "merge PR #10."** Verified CI green and `mergeStateStatus: CLEAN` first, then
merged (merge commit `a431427`).

**The user then asked to "rebase PR #9 onto main and re-run CI."** Rebased
`phase-1d-rbac-permissions-expanded` onto the post-PR-#10 `main` — no conflicts (`apps/dashboard-api/package.json`,
touched by both PRs, merged cleanly, carrying both the `bootstrap:super-admin` script and the
NestJS 11/Express 5/Vitest 3 versions). Re-ran the full validation suite before pushing: build/
lint/typecheck/boundaries/secrets/`pnpm audit` (clean) plus the real-database integration (41/41)
and e2e (37/37, including all 22 authz tests) suites. Force-pushed (`--force-with-lease`); CI
re-ran automatically and passed all 11 checks, including "Dependency vulnerability audit" for the
first time.

**The user then said "merge PR #9."** The first attempt was blocked by the session's own auto-mode
permission classifier — reported this honestly rather than working around it, and asked the user to
either merge it themselves or adjust the permission setting. **The user merged it directly on
GitHub.** Verified via `gh pr view`/`git fetch` (merge commit `67a4955`, 2026-08-08) — an initial
check right after the user's report showed the PR still open, which turned out to be GitHub API
propagation lag, not a failed merge; a follow-up check a few seconds later confirmed it.

The 21 real business-module endpoints, the general ADR-0017 audit-log subsystem (Task 7), and
user-management CRUD beyond role assignment (Task 8) remain explicitly out of scope for everything
shipped so far — Phase 1D-expanded's own §32 exclusion list.

**Separately, after both Phase 1D gates were approved, the user manually created two real Vercel
projects and began deploying `main` directly** (`webdesk-growth-dashboard` for `dashboard-web`,
`webdesk-growth-dashboard-7v1u` for `dashboard-api`) — not a formal Task 13 authorization, but real
deployment attempts that surfaced and needed real fixes, worked through live in the Vercel
dashboard (via Claude in Chrome, connected to the Mac mini's browser) alongside code changes:

- `dashboard-web` deploys and serves correctly once its Vercel project was pointed at
  `apps/dashboard-web` with Framework Preset `Next.js` (the initial attempt used Root Directory
  `./` with Framework Preset `Node`, which has no entrypoint at repo root — a Turborepo monorepo
  quirk, not a code bug).
- `dashboard-api` hit three real, previously-undetected bugs in sequence, each root-caused and
  fixed, committed, and re-verified via live deployment logs before moving to the next:
  1. **No Vercel Function entrypoint existed at all.** ADR-0003 anticipated `dashboard-api` running
     inside a Vercel Function handler, but nobody had built it — `main.ts` was only ever the
     local-dev/CI entry point (`nest start`/`app.listen()`). Added
     `apps/dashboard-api/api/index.ts` (a cached-across-invocations Nest bootstrap using
     `ExpressAdapter`, per `knowledge/03-nestjs-on-vercel.md`'s cold-start guidance — never calls
     `app.listen()`, Vercel owns the HTTP server) and `apps/dashboard-api/vercel.json`. Getting
     Vercel to actually recognize the Function took several iterations (zero-config `/api`
     detection didn't reliably trigger for this Root-Directory-scoped Turborepo monorepo
     combination — a real platform quirk, not something the docs fully explain); the working fix
     was an explicit `vercel.json#functions` declaration plus an empty placeholder `public/`
     directory (satisfies Vercel's literal "does a directory named `public` exist" check for the
     `Other` framework preset, with nothing sensitive inside it — `vercel.json`'s `rewrites` still
     routes all real traffic to the Function).
  2. **`@webdesk/configuration`/`database`/`shared-types`/`validation` are ESM-only** (`"type":
"module"`), and Vercel's Function bundler treats workspace packages as external `node_modules`
     dependencies rather than inlining them — the deployed Function crashed with `ERR_REQUIRE_ESM`
     at runtime (never surfaced locally or in CI, since Node 24's native `require(esm)` support
     apparently isn't available in Vercel's exact execution environment). Fixed by giving each of
     the 4 packages a second, CommonJS build (`dist-cjs/`, alongside the existing `dist/`),
     selected automatically per consumer via `package.json`'s conditional `exports` (`require` →
     `dist-cjs`, `import` → `dist`) — `dashboard-web` and every other ESM consumer are unaffected.
     Deliberately did **not** esbuild-bundle the NestJS app itself to solve this — verified against
     esbuild's own documentation first that it does not support TypeScript's
     `emitDecoratorMetadata`, which Nest's dependency injection relies on; bundling the app would
     have silently broken DI in production. `packages/database`'s CJS build specifically omits
     `buildMigrator`/`migrate.ts` (dead code for any CJS consumer — `dashboard-api` never calls it,
     only the ESM migration CLI does, and `migrate.ts`'s `import.meta.url`-based self-location
     can't be emitted for a CommonJS target) — verified the ESM migration CLI
     (`node dist/migrate.js`) and a real dynamic `import()` of `buildMigrator` both still work
     unchanged.
  3. **`openid-client@6.x` (Google OIDC) is also ESM-only** — same crash class, but a third-party
     dependency this session couldn't dual-build directly. Fixed by switching its two
     `dashboard-api` import sites (`auth-config.module.ts`'s `OIDC_CONFIGURATION` factory,
     `google-auth.service.ts`'s two methods) from a static `import * as client` to
     `await import("openid-client")`; type-only usages stayed a static `import type`, erased at
     compile time. Verified the full `dashboard-api` test suite (144/144, including
     `google-auth.service.spec.ts`'s `vi.mock("openid-client", ...)` mocking, which still
     intercepts correctly regardless of static/dynamic import) and a standalone `require()` of the
     compiled output both pass.

Each fix was verified with a full local `lint`/`typecheck`/`build`/`test` pass before pushing, and
then confirmed against the real, live Vercel deployment logs (not just "the build succeeded") —
including opening the actual deployed URL and reading `ERR_REQUIRE_ESM` stack traces down to the
exact file and line. **`dashboard-api`'s Function now deploys and bootstraps successfully into
NestJS**, reaching real business logic (instantiating `UserRepository`) before failing — on
`DATABASE_URL: Required`, i.e. the still-unprovisioned Supabase database, confirming the deployment
plumbing itself is solid and the only remaining blocker is the standing setup-input gap this
project has tracked all along. **This is real merged code on `main`, not a Task 13 execution** — no
staging environment, no PM sign-off, no smoke test; `docs/phase-plans/phase-1-foundation-plan.md`'s
Task 13 remains its own separate, not-yet-authorized item.

## Files committed this session

See each PR's own commit history (`main`'s log) for exact file lists — not duplicated here to
avoid drift between records. Merged PRs: #1 (Phase 1A foundation), #2 (Phase 1B task package), #3
(dependency-audit fixes), #4 (Postgres provider confirmation), #5 (Phase 1B database foundation),
#7 (Phase 1C authentication/session management), #8 (Phase 1D RBAC/authorization), #9 (Phase
1D-expanded — RBAC/permissions/separation-of-duties, merge commit `67a4955`), #10 (Next.js
16/NestJS 11/Vitest 3 dependency upgrades, merge commit `a431427`). Plus a working-tree-only update (not yet committed —
see below): `docs/project-state/phase-1c-approval-checklist.md` and the related doc updates
recording Phase 1C's G4-1C gate approval.

## Files pending commit (work in progress)

| File                                                                                                                                                                                                                                                                                  | Status                  | Blocker                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| `docs/project-state/phase-1c-approval-checklist.md` (new), `project.json` (gate/audit_log/version), `CLAUDE.md`, this file, `docs/phase-plans/phase-1-foundation-plan.md`, `docs/project-state/setup-input-register.md` — all recording the Phase 1C G4-1C gate approval via OVERRIDE | Written, staged locally | None — pending commit in this session, on `main` directly (no open feature branch for this gate-recording work) |

All Phase 1D-expanded source, test, migration, and documentation files, and all dependency-upgrade
files, are merged to `main` — see `docs/implementation/phase-1d-file-inventory.md` and
`docs/project-state/dependency-audit-2026-08-08.md` for the complete file lists.

## Next 3 tasks (queued)

1. ~~Obtain the required second-role human review of all three STRIDE-family documents~~ — **done**,
   all three completed 2026-08-07/2026-08-10, both Phase 1D gates approved 2026-08-11 (clean
   CONFIRM). See "Where we left off" above.
2. ~~Resolve the remaining setup inputs that block a real working deployment~~ — **done 2026-08-12.**
   The user provisioned Neon and set `DATABASE_URL`/`GOOGLE_OAUTH_*`/`WEB_APP_ORIGIN`/
   `TOTP_ENCRYPTION_KEY` themselves; `dashboard-api`'s Function is now genuinely live (see "Where we
   left off"). Still open: the real emergency-administrator account list, the WordPress Application
   Password account, and real timezone confirmation — none block `dashboard-api`'s own liveness.
3. The 21 real business-module endpoints (depend on Phase 1C's auth and both Phase 1D scopes) are
   the next candidate work per `docs/phase-plans/phase-1-foundation-plan.md` — not started
   automatically, still requires its own explicit authorization.

## Client blockers (waiting on)

- ~~`[2026-08-07]` Second-role human review of `docs/security/threat-model-authentication-session-handling.md` (Phase 1C)~~ —
  **resolved 2026-08-07**, reviewed and approved by WebDesk Solution. See
  `docs/project-state/phase-1c-approval-checklist.md`'s "Second-role security review".
- ~~`[2026-08-07]` Second-role human review of `docs/security/threat-model-authorization-rbac.md`
  (Phase 1D, PR #8)~~ — **resolved 2026-08-10**, reviewed and confirmed by WebDesk Solution
  (Jitesh D and Brijesh D), no issues raised. See
  `docs/project-state/phase-1d-approval-checklist.md`'s "Required second-role human reviews".
- ~~`[2026-08-07]` Second-role human review of `docs/implementation/phase-1d-security-review.md`
  (Phase 1D-expanded, PR #9)~~ — **resolved 2026-08-10**, same reviewers, no issues raised.
  Neither Phase 1D gate is approved by this alone — that remains a separate, not-yet-requested
  decision.
- `[2026-08-06]` — Timezone confirmation (currently defaulted to America/Toronto, not yet
  confirmed by the client). Owner: PM.
- ~~`[2026-08-07]` The real Google Workspace OAuth client (client ID, secret, authorized redirect
  URIs)~~ — **resolved 2026-08-12**, user created the client and set the four env vars; the
  deployed Function's real `client.discovery()` call against Google's OIDC issuer now succeeds at
  bootstrap. The SSO login flow itself against a real Workspace user is still untested (remains
  off-limits per Cautions).
- `[2026-08-07]` — The real emergency-administrator account list — the provisioning mechanism is
  built and verified end-to-end; no real accounts exist yet. Owner: PM/security owner.
- ~~`[2026-08-07]` `dashboard-web`'s real deployed origin (needed for `WEB_APP_ORIGIN`'s CORS/CSRF
  allowlist)~~ — **resolved 2026-08-12**, user set it as a `dashboard-api` Vercel env var.
- ~~`[2026-08-07]` First-login provisioning model (JIT vs. pre-provisioned)~~ — **resolved**,
  pre-provisioned only, confirmed directly by the project owner.
- ~~`[2026-08-06]` Postgres Marketplace provider confirmation~~ — **resolved 2026-08-07**: Neon
  (changed from Supabase 2026-08-11), `us-east-1`. **Provisioned 2026-08-12** — user did this
  themselves via Vercel's Storage → Marketplace flow; `DATABASE_URL` is set and the deployed
  Function no longer fails at bootstrap on it. A live database _query_ succeeding is still not
  independently proven (`/ready`'s health check is an unwired stub) — only that Sequelize
  constructs without crashing.
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
- `[2026-08-08]` PR #10 (`security/major-dependency-upgrades`) merged to `main` under explicit
  "merge" authorization — Next.js 16, NestJS 11, Vitest 3, `pnpm audit` 19 → 0.
- `[2026-08-12]` User provisioned the real Neon database via Vercel's own Storage → Marketplace flow
  (their own ad-hoc action) and set `GOOGLE_OAUTH_*`/`WEB_APP_ORIGIN`/`TOTP_ENCRYPTION_KEY` as
  `dashboard-api` Vercel env vars. This surfaced and required fixing 4 more real bugs, each found
  and verified only via live deployment logs: Sequelize's internal `pg` require missed by Vercel's
  bundler (`5c954ce`); `openid-client`'s dynamic `import()` getting rewritten to a broken
  `require()` by Vercel's own bundler in a second, independent code path from the one the
  2026-08-11 fix addressed (indirect Function-constructor import, `5b4e6ed`); that fix hiding the
  dependency from Vercel's tracer entirely (`vercel.json` `includeFiles`, `3f38d30`); and
  `openid-client`'s own transitive deps (`jose`, `oauth4webapi`) needing the same
  visible-to-`includeFiles` treatment one level deeper (`b40a06b`). See "Where we left off" for the
  full diagnostic chain. **Result: `dashboard-api`'s Vercel Function is genuinely live in
  production** — `/health`/`/ready` return `200`, zero `500`s since this deployment.
- `[2026-08-08]` PR #9 rebased onto the post-PR-#10 `main` (no conflicts), re-validated, and merged
  to `main` under explicit "merge" authorization — merge commit `67a4955`. The first merge attempt
  was blocked by the session's own permission classifier; the user merged it directly on GitHub.
- `[2026-08-08]` Second-role security reviewer assigned for both outstanding Phase 1D reviews
  (`docs/security/threat-model-authorization-rbac.md` for PR #8,
  `docs/implementation/phase-1d-security-review.md` for PR #9): WebDesk Solution — Jitesh D and
  Brijesh D. Resolves the `assigned_team: TBD` blocker; the actual reviews themselves are still
  outstanding — assigning an owner is not a completed review.
- `[2026-08-08]` Mid-session, the project directory became completely inaccessible (`EPERM` on
  every file read, `git status`, even `ls` on `~/Documents`/`~/Desktop`/`~/Downloads`) — diagnosed
  as a macOS Files-and-Folders privacy permission (TCC) revocation for the host app, not a project
  or git issue. Reported the diagnosis and exact remediation steps rather than attempting to work
  around it; the user restored access via macOS System Settings and confirmed via `git status`.
- `[2026-08-10]` Both required second-role security reviews completed: WebDesk Solution (Jitesh D
  and Brijesh D) reviewed and confirmed `docs/security/threat-model-authorization-rbac.md` (PR #8)
  and `docs/implementation/phase-1d-security-review.md` (PR #9), no issues raised on either.
  Recorded in `docs/project-state/phase-1d-approval-checklist.md`'s reviewer table and each
  document's own "Review status" section. Satisfies ADR-0010's separation-of-duties requirement
  for both Phase 1D scopes; does not itself constitute gate approval for either PR #8 or PR #9 —
  that remains a separate, not-yet-requested decision.
- `[2026-08-11]` Both Phase 1D gates approved via explicit "Approve both Phase 1D gates now"
  instruction — clean CONFIRM for both. See `CLAUDE.md`'s "Recent decisions" for the full record.
- `[2026-08-11]` User manually created two real Vercel projects and began deploying `main` directly
  — not a Task 13 authorization, but real deployment troubleshooting worked through live (via
  Claude in Chrome, connected browser) alongside code fixes, each pushed directly to `main` under
  the user's own explicit "commit and push" instructions per fix (not through a PR — a deliberate
  deviation from the feature-branch/PR workflow used for Phase 1B–1D, appropriate here since these
  were small, independently-verified deployment-plumbing fixes, not new business logic).
  `dashboard-web` now deploys and serves correctly. `dashboard-api` needed three real fixes before
  it would even build/run: a missing Vercel Function entrypoint (`api/index.ts` + `vercel.json`,
  plus a `public/` placeholder to satisfy a Vercel platform quirk around Output Directory detection
  for this Root-Directory-scoped Turborepo monorepo); dual ESM+CommonJS builds for
  `@webdesk/configuration`/`database`/`shared-types`/`validation` (all ESM-only, causing
  `ERR_REQUIRE_ESM` when Vercel's Function bundler externalizes them as `require()`d node_modules
  deps); and switching `openid-client`'s two `dashboard-api` import sites to dynamic `import()`
  (same ESM-only class of bug, third-party dependency). Deliberately avoided esbuild-bundling the
  NestJS app itself for any of this — verified against esbuild's own docs that it doesn't support
  `emitDecoratorMetadata`, which would have silently broken Nest's DI. `dashboard-api`'s Function
  deployed and bootstrapped, failing only on the still-unprovisioned database's `DATABASE_URL`.

**2026-08-12 continuation.** The user provisioned the real Neon database themselves via Vercel's
Storage → Marketplace flow ("neon added and redeployed successfully") — their own ad-hoc action,
not a Claude-initiated one; the standing "do not provision" caution is about unprompted action on
Claude's part, not a bar on the user's own infrastructure setup. This immediately surfaced a new
runtime error ("Please install pg package manually") — Sequelize's internal `require("pg")`
(computed from the `dialect: "postgres"` string) was invisible to Vercel's static-import-tracing
Function bundler even though `pg` is a real, listed dependency. Fixed via Sequelize's own
`dialectModule` option with a real static `import pg from "pg"` (commit `5c954ce`), verified against
live deployment logs showing the connection error clear and progress to the next missing env var.

The user then asked to be walked through obtaining the Google OAuth credentials, which agent to
create the OAuth client from, and how to find the `email`/`profile` OIDC scopes in the Google Cloud
Console UI — all answered directly, no code changes. Once `GOOGLE_OAUTH_CLIENT_ID`/`_SECRET`/
`_ISSUER_URL`/`_REDIRECT_URI`, `WEB_APP_ORIGIN` (dashboard-web's real live origin), and a
freshly-generated `TOTP_ENCRYPTION_KEY` were all set as `dashboard-api` env vars and redeployed, the
**same class of `openid-client` `ERR_REQUIRE_ESM` error the 2026-08-11 fix (`ddc951e`) was believed
to have already resolved reappeared** — proving that fix had never actually been exercised: the
`AUTH_ENV` provider throws on missing env vars before the code ever reaches the `dynamicImport` call,
so the path was untested until real Google OAuth env vars existed to let it run.

Root cause this time was confirmed only by reading the actual deployed runtime logs — a hard lesson
learned mid-diagnosis: local `tsc`-compiled output and standalone `node -e` checks are **not**
sufficient proof a fix works in the deployed Function, since Vercel's own Function bundler
re-transpiles `apps/dashboard-api/src/` itself rather than consuming the repo's compiled `dist/`
output. The actual cause: a plain `await import(specifier)` was getting rewritten back into a broken
`require()` by Vercel's own bundler — the same failure mode TypeScript's own CommonJS downlevel emit
causes, just a second, independent instance of it in a different code path (the `AuthConfigModule`'s
`OIDC_CONFIGURATION` provider factory and `GoogleAuthService`'s two call sites, as opposed to
wherever the first fix was actually exercised).

Fixed via an indirect, `Function`-constructor-based dynamic import
(`apps/dashboard-api/src/common/dynamic-import.ts`) — a string passed to `new Function(...)` is
opaque to static AST rewriting in either toolchain, so the `import()` inside survives untouched
(commit `5b4e6ed`). This broke Vitest's `vi.mock()` interception (Vite's SSR module runner needs a
literal `import()` to instrument), fixed by branching on the `VITEST` env var Vitest sets
automatically — tests get a plain, mockable `import()`; production gets the indirect version. Full
`lint typecheck build test` suite (144/144) verified before push.

Pushing and watching the redeploy revealed this fix, while curing the `ERR_REQUIRE_ESM`, caused a
**second-order** problem: hiding the import from static analysis to dodge the harmful rewrite also
hid it from Vercel's own dependency tracer, so `openid-client` was silently dropped from the
deployed bundle entirely (`ERR_MODULE_NOT_FOUND: Cannot find package 'openid-client'`). Fixed via
`vercel.json`'s `includeFiles` (commit `3f38d30`) — the documented Vercel mechanism for exactly this
class of dependency, invisible to static tracing but needed at runtime.

Redeploying again revealed a **third-order** version of the same problem one level deeper:
`openid-client` itself now loaded correctly, but its own runtime dependencies (`jose`,
`oauth4webapi`) live only as symlinks nested inside pnpm's virtual store
(`.pnpm/openid-client@6.8.4/node_modules/{jose,oauth4webapi}`), with no top-level symlink in
`dashboard-api`'s own `node_modules` for `includeFiles`' glob to reach. Fixed by declaring
`jose`/`oauth4webapi` as direct `dashboard-api` dependencies at the same version ranges
`openid-client` itself already pins — this makes pnpm materialize real top-level symlinks in the
exact shape already proven to work for `openid-client`, then extending `includeFiles` to cover them
too (commit `b40a06b`).

**Every fix in this chain was verified against the live deployment, not just local checks** — each
was pushed, the redeploy watched via real Vercel build/runtime logs, and only declared working once
the deployed Function itself showed the expected behavior; this discipline is what caught the
"proved insufficient the first time" gap in the `ddc951e` fix in the first place. Final verification:
`GET /health` → `{"status":"ok",...}`, `GET /ready` → `{"status":"ok",...,"checks":{}}`, `GET
/auth/google` (a route that doesn't exist at that exact path) → a proper NestJS JSON `404`, not a
crash — and the runtime log timeline shows zero `500`s since deployment `b40a06b`/`F3h5YS1RE` went
live. Caveat carried forward honestly: `/ready`'s `checks: {}` is still an unwired Phase-1A-era stub
(`apps/dashboard-api/src/health/health.controller.ts`) that has never checked an actual database
query — so a live Neon _query_ succeeding is not independently proven by any of this, only that
Sequelize constructs without crashing at bootstrap.

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
- Do NOT treat PR #9's or PR #10's merge (both 2026-08-08) as a Phase 1D gate approval — each
  merge was its own separate, already-given explicit authorization; the second-role security
  review and gate decision for both Phase 1D scopes are still outstanding.
- ~~Do NOT create a real Google OAuth client~~ — the user did this themselves 2026-08-12; the client
  exists and is set as `dashboard-api` env vars. Do NOT test the actual SSO login flow against a
  real Google Workspace account, though — that remains untested by design.
- Do NOT wire a real SMTP send for emergency-admin login alerts — logged only for now; Google
  Workspace SMTP integration doesn't exist yet.
- ~~Do NOT provision the actual Neon database~~ — the user did this themselves 2026-08-12 via
  Vercel's own Storage → Marketplace flow. This caution is about Claude not doing it unprompted —
  that still stands; every automated test still runs against a local/CI disposable instance, and
  Claude has not run migrations or written data against the real Neon instance.
- Do NOT treat the 2026-08-11/2026-08-12 Vercel deployment fixes (Function entrypoint, dual ESM/CJS
  builds, the `openid-client` dynamic-import chain, the `pg` dialectModule fix) as a Task 13
  ("Staging deployment foundation") execution or sign-off — real code, merged to `main`,
  `dashboard-api` is now genuinely live, but no staging environment, PM approval, or formal smoke
  test exists. Task 13 remains its own separate, not-yet-authorized item.
- Do NOT treat either STRIDE threat-model pass (authentication/session or authorization) as a
  completed, approved security review — both are self-reviews only, pending the required
  second-role human review.
- Do NOT treat the Service/SEO Library workbook (`canonical-inputs/WebDesk_Service_SEO_Library_Templates_v4.xlsm`) as approved business content, even where its own internal "Approval Status" column says "Approved". See `knowledge/00-scope-and-precedence.md §4`.
- Do NOT push to `origin` without separate PM authorization for that specific push, and do NOT
  merge any PR without a separate, explicit "merge" instruction.

## Session links

- `main`'s tip is always the live answer (`git rev-parse HEAD` / `git ls-remote origin main`) —
  not restated here as a fixed SHA, since it trails whatever this session's own commits add.
- Staging URL: not formally provisioned (Task 13 not started), but `dashboard-web` is live and
  serving on Vercel (project `webdesk-growth-dashboard`, `https://webdesk-growth-dashboard-theta.vercel.app`)
  and `dashboard-api`'s Vercel Function (project `webdesk-growth-dashboard-7v1u`,
  `https://webdesk-growth-dashboard-7v1u-beta.vercel.app`) is now genuinely live — `/health` and
  `/ready` return `200` — see "Where we left off" above. Vercel-assigned domains may change; check
  the Vercel dashboard for the current ones if these stop resolving.
- Mockup preview URL (if active): none
- Merged PRs: [#1](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/1) (Phase 1A foundation), [#2](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/2) (Phase 1B task package), [#3](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/3) (dependency-audit fixes), [#4](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/4) (Postgres provider confirmation), [#5](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/5) (Phase 1B database foundation), [#7](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/7) (Phase 1C authentication/session management), [#8](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/8) (Phase 1D RBAC/authorization), [#9](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/9) (Phase 1D-expanded, merge commit `67a4955`), [#10](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/10) (Next.js 16/NestJS 11/Vitest 3 dependency upgrades, merge commit `a431427`). Phase 1E's PRs (#11, #13–#22) and Phase 1F's [#23](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/23) (application shell/module registry/observability, merge commit `1e8f343c4779237a4fe75c3c663716877990dc20`) are also merged — this list itself had gone stale before Phase 1F; see `project.json`'s `gates[]`/`audit_log` for the authoritative merge record of every phase.
- Direct-to-`main` commits (2026-08-11/2026-08-12, deployment troubleshooting, no PR — see
  "Decisions made this session"): README additions, the Vercel Function entrypoint
  (`api/index.ts`/`vercel.json`), the dual ESM/CommonJS package builds, the `pg` dialectModule fix
  (`5c954ce`), and the `openid-client` dynamic-import chain (`ddc951e`, `5b4e6ed`, `3f38d30`,
  `b40a06b`). Each pushed under the user's own explicit "commit and push" instruction per fix.
- Open PRs / issues: none currently open. Both Phase 1D gates (PR #8, PR #9) are approved (clean
  CONFIRM, 2026-08-11) — see `CLAUDE.md`'s "Current state".

---

Last touched: 2026-08-12 · by Claude (Both Phase 1D gates approved (clean CONFIRM), 2026-08-11.
Continuing ad-hoc real-Vercel-deployment troubleshooting — not a formal Task 13 execution, no PR,
pushed directly to `main` under explicit per-fix authorization: the user provisioned the real Neon
database and set all remaining `dashboard-api` env vars themselves 2026-08-12, surfacing and
requiring 4 more real bug fixes (Sequelize's `pg` require, `openid-client`'s dynamic import getting
bundler-rewritten a second time in a different code path, that fix hiding the dependency from
Vercel's tracer, and `openid-client`'s own transitive deps needing the same treatment) — each found
and verified only via live deployment logs, never local checks alone. **Result: `dashboard-api`'s
Vercel Function is genuinely live in production for the first time** — `/health`/`/ready` return
`200`, zero `500`s since deployment `b40a06b`. `/ready`'s `checks: {}` remains an unwired stub, so a
live Neon _query_ succeeding is not independently proven — only that Sequelize constructs without
crashing. All previously-listed env-var blockers are now resolved; remaining open items are the
real emergency-administrator account list, the WordPress Application Password account, and real
timezone confirmation, none of which block `dashboard-api`'s own liveness. See "Where we left off"
for the full technical detail.)
