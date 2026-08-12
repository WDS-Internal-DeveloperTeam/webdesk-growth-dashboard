# CLAUDE.md — WebDesk Website Growth Dashboard

> Project memory. Read first at every session start. Keep it tight.

## Identity

- **Client:** WebDesk Solution (webdesk-growth-dashboard)
- **Project:** WebDesk Website Growth Dashboard
- **Build context:** nodejs
- **Project type:** custom-app-build
- **Project profile:** webdesk-growth-dashboard ← loads the profile at
  `webdesk-nodejs/skills/nodejs/projects/custom-app-build/profiles/webdesk-growth-dashboard/` after the base
  custom-app-build skill, per profile SKILL.md §2. **This file is the routing mechanism — the base
  orchestrator has no code that reads `project.project_profile` and auto-loads a matching profile.**
  If the "Required skill files" list below is ever removed or copied without the profile line, the
  profile stops loading silently.
- **Integration targets:** ["github", "wordpress", "google-workspace"]
- **Timezone:** America/Toronto (default — not yet confirmed by the client; see `docs/project-state/setup-input-register.md`) **Tenant:** per-client (single organization, no master/cross-client scope — see profile knowledge/05)
- **Host target:** vercel
- **Tech stack:** Node 24 + TypeScript + NestJS (Vercel Functions) + Next.js App Router;
  PostgreSQL (Vercel-provisioned; Neon, `us-east-1` — WDS-002's Neon exclusion explicitly
  overridden by project-owner decision 2026-08-11, see ADR-0007's resolution note) + Sequelize;
  Vercel Queues/Workflows/Cron
  (no permanent worker); Vercel Blob; Google Workspace SSO + SMTP; GitHub App; Turborepo + pnpm
- **State file:** `outputs/webdesk-growth-dashboard/project.json`

## Required skill files for this project ← MANDATORY. The context allow-list.

> Load ONLY these at session start. Loading anything outside this list risks the 200K
> context wall. Never load another project_type's KB, another profile, or an integration
> target not listed above. See `_spine/shared-knowledge/context-budget.md` and this
> profile's `SKILL.md` §2 loading hierarchy.

Always (Tier 0):

- `webdesk-nodejs/skills/_spine/persona.md`
- `webdesk-nodejs/skills/_spine/shared-knowledge/CONVENTIONS.md`
- `webdesk-nodejs/skills/_spine/shared-knowledge/context-budget.md`
- `webdesk-nodejs/skills/_spine/shared-knowledge/model-policy.md`
- `webdesk-nodejs/skills/_spine/orchestrator/SKILL.md`

Active agent (one at a time):

- `webdesk-nodejs/skills/_spine/{active-agent}/SKILL.md` (e.g. `pm-agent`, `architect-agent`, `qa-agent`, `delivery-head`)

Node arm + custom-app-build + this profile:

- `webdesk-nodejs/skills/nodejs/SKILL.md`
- `webdesk-nodejs/skills/nodejs/projects/custom-app-build/SKILL.md`
- `webdesk-nodejs/skills/nodejs/projects/custom-app-build/profiles/webdesk-growth-dashboard/SKILL.md`
- profile `knowledge/*.md` file(s) the active task needs — see profile `SKILL.md §8` for the index
- profile `integrations/github/*` (only if the task touches GitHub)
- profile `integrations/wordpress/*` (only if the task touches WordPress)
- profile `integrations/google-workspace/*` (only if the task touches SSO/SMTP)
- profile `integrations/vercel/*` (only if the task touches Functions/Queues/Workflows/Cron/Blob)

On demand (Tier 2 — Read when the task needs it; do NOT preload):

- `webdesk-dashboard-documentation-v1/*` (the canonical dashboard spec, by path per the active task)
- `docs/implementation/*` (the compatibility review — by path)
- `docs/architecture/decisions/*`, `docs/contracts/*`, `docs/repository-plan/*`, `docs/security/*`,
  `docs/traceability/*`, `docs/phase-plans/*` (Phase 0 foundation — by path per the active task)
- `canonical-inputs/*` (WordPress Technical Discovery, Owner Clarifications, Agent Specification Batch 1,
  Service/SEO Library workbook — by path; the workbook is advisory only, never approved business truth,
  per WDS-014, regardless of what its own internal "Approval Status" column says)
- `outputs/webdesk-growth-dashboard/{HANDOFF.md, project.json}`

Do NOT load: `webdesk-nodejs/skills/nodejs/integrations/{bigcommerce,shopify,erp}/*` (not this project's
integration targets — see `SKILL.md §5` "Excluded"); any other project_type arm; any other project profile.

## Current state

- **Stage:** development **Current gate:** G4-1D-EXP (Phase 1D-expanded, passed 2026-08-11, clean
  CONFIRM) is the last recorded gate — see `outputs/webdesk-growth-dashboard/project.json`'s
  `gates[]`, authoritative. Both Phase 1D gates (G4-1D for PR #8, G4-1D-EXP for PR #9) are now
  approved, each a clean CONFIRM since the required second-role security review was already
  complete before either gate was requested.
- **Approved:** Phase 1C — Authentication and session management (Tasks 4/5, combined) — merged to
  `main` via PR #7 at commit `102397d2f1aaf9fc5d374dd4bd58c764cb031ef9`, and the G4-1C gate
  approved 2026-08-07 — see `docs/project-state/phase-1c-approval-checklist.md`. **The gate
  approval was an explicit OVERRIDE, not a clean pass**, because the required second-role human
  review of `docs/security/threat-model-authentication-session-handling.md` (ADR-0010
  separation-of-duties) had not happened yet at that time — the human approver was asked directly
  and chose to approve the gate then anyway, with that review recorded as a still-outstanding open
  item, not silently marked complete. **That review has since been completed (2026-08-07)** —
  WebDesk Solution reviewed and approved the document; see
  `docs/project-state/phase-1c-approval-checklist.md`'s "Second-role security review" section and
  `project.json`'s `audit_log`. See `docs/task-packages/phase-1c-authentication-sessions.md` and
  `docs/project-state/phase-1c-validation-report.md` for the underlying work. Google Workspace
  OIDC, restricted emergency-administrator TOTP, session issuance/validation/revocation, DB-backed
  account lockout, CSRF defenses, an operator-run emergency-admin provisioning CLI, and 6
  `dashboard-web` auth pages — 115 unit + 15 real-database integration/e2e tests, all passing.
  First-login provisioning model resolved: **pre-provisioned only**, no JIT account creation.
- **Approved:** Phase 1D — RBAC and authorization (Task 6), **built, validated, merged to `main`**
  via PR #8, **G4-1D gate approved 2026-08-11 (clean CONFIRM)** — see
  `docs/task-packages/phase-1d-rbac-authorization.md` and
  `docs/project-state/phase-1d-validation-report.md`'s "Sign-off — G4-1D gate" section.
  Deny-by-default `PermissionService`/`PermissionGuard`, the real seeded 7-role/21-module/458-grant
  matrix from `06_Roles_and_Permissions.md §3`, and the "Users/roles" module's own HTTP surface
  (proving the framework — the other 20 business modules' endpoints don't exist as code yet) — 146
  unit + 63 real-database integration/e2e tests, all passing.
- **Approved:** Phase 1D-expanded — the larger RBAC/permissions/separation-of-duties brief
  (`docs/task-packages/phase-1d-rbac-permissions-expanded.md`) — **built, validated, documented,
  merged to `main`** via
  [PR #9](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/9) (merge
  commit `67a4955`, 2026-08-08), **G4-1D-EXP gate approved 2026-08-11 (clean CONFIRM)**, under
  explicit authorization at each step (including the merge and the gate approval itself), on top
  of PR #8's `AuthzModule`. Centralizes grant logic into a new `AuthorizationService` (retires
  `PermissionService`), adds the 43-module registry, project-scoped role assignment
  (schema/repository only, no HTTP route yet), confidential-field actions (real, checked, zero
  seeded), the `authorization_actions` cross-request separation-of-duties foundation, and —
  closing the exact gap the original threat model flagged — **now blocks self-role-assignment
  outright**, per this brief's own explicit §21/§33 instruction. 144 unit + 41 real-database
  integration + 37 real-database e2e tests, all passing. Before merging, the branch was rebased
  onto `main` (which by then included PR #10's dependency bumps) and fully re-validated — no
  conflicts, `pnpm audit` clean throughout. See `docs/project-state/phase-1d-validation-report.md`'s
  addendum, `docs/implementation/phase-1d-security-review.md`, and
  `docs/project-state/phase-1d-approval-checklist.md`'s "Sign-off" section. **Does not include** the
  21 real business modules, the general audit-log subsystem (Task 7), or user-management CRUD
  (Task 8) — all separate, later authorizations. Phase 1A, 1B, 1C, and both Phase 1D scopes remain
  approved, each scoped to itself only (Phase 1C via OVERRIDE, both Phase 1D gates via clean
  CONFIRM, see above).
- **Deployment infrastructure (2026-08-11, ad-hoc, NOT a formal Task 13 execution):** `dashboard-web`
  is now live on Vercel (project `webdesk-growth-dashboard`, Framework Preset Next.js, Root Directory
  `apps/dashboard-web`) — real requests serve correctly. `dashboard-api` (project
  `webdesk-growth-dashboard-7v1u`, Root Directory `apps/dashboard-api`) now **builds and deploys
  successfully as a Vercel Function** (`apps/dashboard-api/api/index.ts` + `vercel.json`, per
  ADR-0003) after fixing two real bugs surfaced only by the deployed environment, not by any local/CI
  test: (1) `@webdesk/configuration`/`database`/`shared-types`/`validation` are ESM-only packages
  that Vercel's Function bundler `require()`s as external deps rather than inlining — fixed by giving
  each package a dual ESM+CommonJS build (`dist/` + `dist-cjs/`, selected automatically per consumer
  via `package.json`'s conditional `exports`); (2) `openid-client@6.x` (Google OIDC) is also ESM-only
  — fixed by switching its two `dashboard-api` import sites to dynamic `import()`. Both fixes
  deliberately avoided esbuild-bundling the NestJS app itself (esbuild does not support
  `emitDecoratorMetadata`, which Nest's DI relies on — bundling would have silently broken it).
  **(2026-08-12 update — see below): `dashboard-api`'s Function is now fully live** — the
  `DATABASE_URL`/pg-driver/env-var blockers described below were all cleared by the user's own
  ad-hoc setup actions (Neon provisioned via Vercel Marketplace, `DATABASE_URL`/`GOOGLE_OAUTH_*`/
  `WEB_APP_ORIGIN`/`TOTP_ENCRYPTION_KEY` set as `dashboard-api` env vars) plus two more real bugs
  found and fixed the same way as the three above — see the 2026-08-12 "Recent decisions" entry
  for the full account. See `apps/dashboard-api/vercel.json`,
  `apps/dashboard-api/api/index.ts`, and the git history on `main` for the exact commits. **This is
  real merged code, not Task 13** — no staging environment exists, no PM sign-off was sought, no
  formal smoke-test pass has run (though `/health` and `/ready` were verified live, see below);
  Task 13 in `docs/phase-plans/phase-1-foundation-plan.md` remains its own separate, not-yet-
  authorized execution.
- **Blocked on (as of 2026-08-12):** see `docs/project-state/setup-input-register.md` for standing
  setup-time inputs. All of `DATABASE_URL`, the Postgres provisioning itself, `GOOGLE_OAUTH_*`,
  `WEB_APP_ORIGIN`, and `TOTP_ENCRYPTION_KEY` are now resolved (see 2026-08-12 decision entry) —
  what's left is the real emergency-administrator account list, the WordPress Application Password
  account, and real timezone confirmation. None of these block `dashboard-api`'s own liveness; they
  block specific features (emergency-admin login, WordPress integration, schedule-sensitive
  reporting) from being usable end-to-end.

## Active tasks (this sprint)

1. ~~Await explicit gate-approval decisions for both Phase 1D scopes~~ — **done 2026-08-11.** Both
   PR #8 (G4-1D) and PR #9 (G4-1D-EXP) gates approved via clean CONFIRM — see
   `docs/project-state/phase-1d-validation-report.md`'s "Sign-off — G4-1D gate" and
   `docs/project-state/phase-1d-approval-checklist.md`'s "Sign-off".
2. Resolve remaining setup inputs in `docs/project-state/setup-input-register.md` — GitHub App
   creation and Google Workspace OAuth client are both **done** (2026-08-12, see "Recent
   decisions"); still open: the real emergency-administrator account list and the WordPress
   Application Password account. (`WEB_APP_ORIGIN` also resolved 2026-08-12.)
3. Provision the actual Neon database once a later task actually needs a live connection —
   not before, and not automatically. **That need now concretely exists** — `dashboard-api`'s
   deployed Vercel Function fails at bootstrap on missing `DATABASE_URL` (see "Current state" —
   deployment infrastructure) — but provisioning still requires its own separate, explicit
   authorization; the Function failing is not itself that authorization.
4. The 21 real business-module endpoints are now the next candidate per
   `docs/phase-plans/phase-1-foundation-plan.md`, now that both Phase 1D gates are approved — not
   started automatically; still requires its own explicit authorization to begin.

## Recent decisions

- `[2026-08-05]` Skill-overlay build completed — see `docs/skill-build/project-skill-build-report.md`.
- `[2026-08-06]` Phase 0 foundation authored: 20 ADRs, 7 integration contracts, repository plan, requirements
  traceability, security foundation, Phase 1 plan — all formalizing already-resolved architecture, not new
  decisions. See `docs/project-state/phase-0-validation-report.md`.
- `[2026-08-06]` Phase 0 signed off (scope: Phase 1A only) and pushed to `origin/main`. Phase 1A repository/
  monorepo foundation built and validated under that authorization — see
  `docs/project-state/phase-1a-validation-report.md`.
- `[2026-08-07]` Phase 1A signed off (G1 gate passed, scope Phase 1A only) — see
  `docs/project-state/phase-1a-approval-checklist.md`'s "Sign-off". PR #1 merged 2026-08-07.
- `[2026-08-07]` Phase 1B database-foundation task package prepared and approved (PR #2, merged) —
  see `docs/task-packages/phase-1b-database-foundation.md`. Documentation/planning only; Phase 1B
  implementation itself remains unauthorized.
- `[2026-08-07]` 9 transitive dependency vulnerabilities patched via bounded `pnpm-workspace.yaml`
  overrides (PR #3, merged) — `pnpm audit` 35 → 18 findings. Two version-line decisions (NestJS
  10.x→11.x, Vitest 2.x→3.x) deferred pending review — see
  `docs/project-state/dependency-audit-2026-08-07.md`.
- `[2026-08-08]` The two deferred version-line decisions above (plus Next.js 15.x→16.x, needed for
  the same reason) executed under explicit user authorization, on branch
  `security/major-dependency-upgrades`: Next.js 16.3.0 (fixes postcss/sharp), NestJS 11.1.28 —
  including the bundled Express 4→5 jump, audited for wildcard-route/deprecated-API usage
  beforehand, none found (fixes multer/file-type/core CVE), Vitest 3.2.7 (fixes the critical
  Vitest-UI finding). Two more findings surfaced and fixed during this pass, not part of the
  original plan: a bounded `uuid` override (`sequelize`'s internal pin, verified only stable
  `v1`/`v4` calls before overriding) and a bounded `vite` override (`vitest@3.2.7`'s own broad
  peer range kept an unpatched `vite@5.4.21` otherwise). Every change re-verified against the real
  NestJS DI container (`@nestjs/testing`'s real e2e suite, not just unit tests that bypass DI via
  `new`) and real-database integration suites, not just a clean install — see
  `docs/project-state/dependency-audit-2026-08-08.md`. `pnpm audit`: 19 → **0**. Not yet committed,
  pushed, or PR'd at the time this entry was written.
- `[2026-08-07]` Postgres Marketplace provider confirmed: Supabase, `us-east-1` (N. Virginia) —
  satisfies ADR-0007 (North America East Coast + not Neon, WDS-002). Chosen over the other
  verified qualifying candidate, Amazon Aurora PostgreSQL, by explicit project-owner decision.
  Not yet provisioned. See `docs/project-state/setup-input-register.md`.
- `[2026-08-07]` Phase 1B database foundation built and validated, per explicit user
  authorization ("Execute Phase 1B now") to execute the already-approved task package. Real
  Sequelize connection, migration framework, transaction/repository/health foundations — 19 unit
  - 8 real-database integration tests, migration up/down verified via both the compiled CLI and
    the Vitest-direct execution path. No business entity created.
- `[2026-08-07]` Phase 1B signed off (G-Schema gate passed, scope Phase 1B only), approved commit
  `80bd118b252ba2292af40d2ac8cecd217257ebc4` — see
  `docs/project-state/phase-1b-approval-checklist.md`'s "Sign-off" and `project.json`'s
  `gates[]`/`audit_log`. PR #5 merged. Phase 1C implementation remains a separate, not-yet-granted
  authorization.
- `[2026-08-07]` First-login provisioning model resolved directly with the project owner:
  **pre-provisioned only** — Google SSO links/activates an existing admin-created `users` row
  matched by email; an unmatched login is rejected, never auto-creates a user. Clears ADR-0008's
  own blocking open item.
- `[2026-08-07]` Phase 1C (Google Workspace authentication, restricted emergency-local TOTP,
  session management) built and validated under explicit user authorization to begin —
  `docs/task-packages/phase-1c-authentication-sessions.md`,
  `docs/project-state/phase-1c-validation-report.md`. 7 new database entities/migrations, a full
  `dashboard-api` `AuthModule`, 6 `dashboard-web` auth pages, an operator-run emergency-admin
  provisioning CLI, and a STRIDE threat-model pass
  (`docs/security/threat-model-authentication-session-handling.md`, self-reviewed only — still
  needs a second-role human review). 115 unit + 15 real-database integration/e2e tests, all
  passing.
- `[2026-08-07]` Phase 1C merged to `main` via PR #7 at commit
  `102397d2f1aaf9fc5d374dd4bd58c764cb031ef9`, under explicit separate "merge the PR"
  authorization. Two real CI-only bugs found and fixed on the branch before merge: a
  `SequelizeStorage` migration-name mismatch between the compiled-CLI and Vitest-transformed-TS
  execution paths, and a CI "Integration tests" job missing both a build-order step and a
  database service container it newly needed.
- `[2026-08-07]` Phase 1D (RBAC/authorization) built and validated under explicit user
  authorization ("Begin RBAC (Task 6)") — `docs/task-packages/phase-1d-rbac-authorization.md`,
  `docs/project-state/phase-1d-validation-report.md`. 5 new migrations seeding the real, already-
  approved 7-role/21-module/458-grant matrix from `06_Roles_and_Permissions.md §3`, a
  deny-by-default `PermissionService`/`PermissionGuard`, and the "Users/roles" module's own real
  HTTP surface (the other 20 business modules don't exist as code yet). A STRIDE threat-model
  pass (`docs/security/threat-model-authorization-rbac.md`, self-reviewed only) flags one
  genuinely **unresolved** design gap: no separation-of-duties check on role self-assignment —
  surfaced explicitly for the required second-role reviewer's decision, not silently resolved
  either way. 146 unit + 63 real-database integration/e2e tests, all passing. Not yet
  approved/merged.
- `[2026-08-07]` Phase 1C's G4-1C gate approved by explicit **OVERRIDE** (not a clean CONFIRM) —
  see `docs/project-state/phase-1c-approval-checklist.md` and `project.json`'s `gates[]`/
  `audit_log`. Asked directly whether the second-role threat-model review had happened, was
  waited for, or should be skipped informally — the approver chose "approve the gate now, with
  the review recorded as a still-outstanding open item," the option that neither pretends the
  review happened nor leaves the gate itself unrecorded. This approval was recorded retroactively:
  PR #7 (Phase 1C) and PR #8 (Phase 1D, a separate, independently-authorized phase) had both
  already merged before this gate was formalized.
- `[2026-08-07]` Received a much larger "Phase 1D" brief (RBAC, fine-grained permissions,
  confidential-field access, centralized policy/authorization service, project-scoped
  authorization, separation-of-duties across many more scenarios) — recorded verbatim in
  `docs/task-packages/phase-1d-rbac-permissions-expanded.md`, explicitly **not started**. Asked
  directly: (1) whether the Phase 1C OVERRIDE-based approval satisfies this brief's own
  precondition of a completed security review — the user chose to wait for the real second-role
  review instead; (2) how this brief relates to the already-merged, narrower Phase 1D (PR #8) —
  the user chose "supersedes/expands," i.e. build on top of PR #8's `AuthzModule`, not rebuild it.
- `[2026-08-07]` The required second-role human review of
  `docs/security/threat-model-authentication-session-handling.md` (Phase 1C) — the open item from
  the G4-1C OVERRIDE — was completed: WebDesk Solution reviewed and approved the document. See
  `docs/project-state/phase-1c-approval-checklist.md`'s "Second-role security review" and
  `project.json`'s `audit_log`. The G4-1C gate's own historical record is left unmodified (it
  accurately reflects the state at approval time); this is recorded as a separate, later event.
  This satisfies one precondition of `docs/task-packages/phase-1d-rbac-permissions-expanded.md`
  but does not itself authorize starting that work.
- `[2026-08-07]` Explicit authorization received ("Begin Phase 1D expanded scope") to build
  `docs/task-packages/phase-1d-rbac-permissions-expanded.md` on top of PR #8's `AuthzModule`.
  **Built, validated, and documented in full this session**: centralized `AuthorizationService`
  (retires `PermissionService`), 43-module registry (migrations `00014`/`00015`), project-scoped
  role assignment (`user_roles.project_id`, migration `00016`, schema/repository-only), zero-seeded
  confidential-field actions, the `authorization_actions` cross-request separation-of-duties
  foundation (migration `00017`), Super Admin bootstrap CLI (verified via real end-to-end
  execution), `GET /me/capabilities`/`GET /authz/modules`/`GET /authz/module-registry`. 144 unit +
  41 real-database integration + 37 real-database e2e tests, all passing; lint/typecheck clean. 9
  required documents produced. Not yet committed, pushed, or gated — see
  `docs/project-state/phase-1d-approval-checklist.md`.
- `[2026-08-07]` Self-role-assignment separation-of-duties gap — flagged, not fixed, in the
  original `docs/security/threat-model-authorization-rbac.md`'s Elevation of Privilege table — is
  now **closed**: `RoleAssignmentService.assignRole`/`revokeRole` call
  `SeparationOfDutiesService.assertDistinctActors` before any other check, recording a
  `separation_of_duties_denied` auth event on denial. Closed under
  `docs/task-packages/phase-1d-rbac-permissions-expanded.md` §21/§33's own explicit instruction
  ("Do not allow self-assignment of privileged roles"), i.e. per the user's own direction on this
  brief, not a unilateral resolution of a gap the original document deliberately left open for the
  second-role reviewer. A resolution note was appended to that original document rather than
  rewriting its historical STRIDE row — see its own "Resolution note" section.
- `[2026-08-08]` PR #10 (`security/major-dependency-upgrades`) merged to `main` under explicit
  "merge" authorization — Next.js 16, NestJS 11, Vitest 3, `pnpm audit` 19 → 0. See
  `docs/project-state/dependency-audit-2026-08-08.md`.
- `[2026-08-08]` PR #9 (`phase-1d-rbac-permissions-expanded`) rebased onto the post-PR-#10 `main`
  (no conflicts), fully re-validated (144 unit + 41 integration + 37 e2e, `pnpm audit` clean), and
  merged to `main` under explicit "merge" authorization — merge commit `67a4955`. Both Phase 1D
  scopes (PR #8, PR #9) are now on `main`; **neither has an approved gate** — both still need their
  own second-role security review before a gate decision can be made.
- `[2026-08-08]` Second-role security reviewer assigned for both outstanding Phase 1D reviews
  (`docs/security/threat-model-authorization-rbac.md` for PR #8,
  `docs/implementation/phase-1d-security-review.md` for PR #9): WebDesk Solution — Jitesh D and
  Brijesh D. This resolves the "not yet assigned"/`assigned_team: TBD` blocker but is not itself a
  completed review — both documents still await their actual second-role sign-off.
- `[2026-08-10]` Both required second-role security reviews completed: WebDesk Solution (Jitesh D
  and Brijesh D) reviewed `docs/security/threat-model-authorization-rbac.md` (PR #8) and
  `docs/implementation/phase-1d-security-review.md` (PR #9), confirming both with no issues
  raised. Recorded in `docs/project-state/phase-1d-approval-checklist.md`'s "Required second-role
  human reviews" table and each document's own "Review status"/"Next steps" section. This
  satisfies ADR-0010's separation-of-duties requirement for both Phase 1D scopes but is not itself
  gate approval — that remains a separate, not-yet-requested decision for both PR #8 and PR #9.
- `[2026-08-11]` Both Phase 1D gates approved by explicit "Approve both Phase 1D gates now"
  instruction — G4-1D (PR #8, `docs/project-state/phase-1d-validation-report.md`'s "Sign-off —
  G4-1D gate" section) and G4-1D-EXP (PR #9, `docs/project-state/phase-1d-approval-checklist.md`'s
  "Sign-off" section). Both recorded as clean **CONFIRM** decisions, not overrides, since the
  required second-role security review for each was already complete (2026-08-10) before either
  gate was requested — unlike Phase 1C's G4-1C gate, which needed an OVERRIDE because its review
  was still outstanding at approval time. `project.json`'s `current_gate` updated to `G4-1D-EXP`.
- `[2026-08-11]` User manually created two Vercel projects and began deploying `main` directly
  (`webdesk-growth-dashboard` for `dashboard-web`, `webdesk-growth-dashboard-7v1u` for
  `dashboard-api`) — not a formal Task 13 authorization, but real deployment attempts needing real
  fixes. `dashboard-web` now deploys and serves correctly. `dashboard-api` hit three real,
  previously-undetected bugs in sequence, each fixed and pushed to `main`: (1) no Vercel Function
  entrypoint existed at all for a NestJS app (ADR-0003 anticipated this but nobody had built it) —
  added `apps/dashboard-api/api/index.ts` (cached-across-invocations Nest bootstrap, per
  `knowledge/03-nestjs-on-vercel.md`) and `vercel.json`; (2) `@webdesk/configuration`/`database`/
  `shared-types`/`validation` are ESM-only, and Vercel's Function bundler `require()`s workspace
  deps as external rather than inlining them — crashed with `ERR_REQUIRE_ESM` at runtime, fixed by
  giving each package a dual ESM+CommonJS build selected via conditional `exports` (NOT by
  esbuild-bundling the whole app, which would have silently broken NestJS's DI —
  `emitDecoratorMetadata` isn't esbuild-supported, verified against esbuild's own docs before
  choosing this approach); (3) `openid-client@6.x` (Google OIDC) is also ESM-only, same crash class
  — fixed via dynamic `import()` at its two `dashboard-api` call sites instead of downgrading the
  package or converting the whole app to ESM. All three fixes verified with full
  lint/typecheck/build/test passes (144/144 `dashboard-api` tests) before each push, plus live
  Vercel deployment logs confirmed each fix's actual effect. `dashboard-api`'s Function now deploys
  and bootstraps successfully, failing only on missing `DATABASE_URL` — the deployment plumbing
  itself is done; a working live API still needs the Neon database provisioned and the other
  env vars set (all separate, not-yet-granted authorizations). See "Current state" above.
- `[2026-08-11]` Postgres Marketplace provider **changed from Supabase to Neon**, `us-east-1` —
  explicit project-owner (WebDesk Solution) decision overriding WDS-002's Neon-exclusion rule
  specifically (the region requirement, the other half of WDS-002, still applies and was
  re-verified against Neon's own region list: `us-east-1`/`us-east-2` both offered). Recorded as
  an appended "Resolution note" on `docs/architecture/decisions/0007-database-provider-independence-east-coast.md`,
  not a rewrite — the original 2026-08-07 Supabase decision and WDS-002's own rule text are left
  unmodified as historical record. `project.json`'s `postgres_marketplace_provider` updated to
  `"neon"`, version 9 → 10. No database has been provisioned under either provider — this changes
  the confirmed provider/region choice only, not the standing "do not provision without separate
  authorization" rule (see Cautions).
- `[2026-08-12]` User provisioned the actual Neon database via Vercel's Storage → Marketplace flow
  themselves ("neon added and redeployed successfully") — their own ad-hoc action, same pattern as
  manually creating the two Vercel projects on 2026-08-11; the standing "do NOT provision" caution
  is about unprompted action on Claude's part, not a bar on the user doing their own infrastructure
  setup. This surfaced a new real bug, fixed and pushed same as the three 2026-08-11 fixes: Sequelize
  was internally `require("pg")`-ing based on the `dialect: "postgres"` string, which Vercel's
  static-import-tracing Function bundler missed even though `pg` is a real listed dependency
  ("Please install pg package manually" at runtime) — fixed via Sequelize's own `dialectModule`
  option with a real static `import pg from "pg"` (commit `5c954ce`). User then walked through
  creating a Google OAuth client and setting `GOOGLE_OAUTH_CLIENT_ID`/`_SECRET`/`_ISSUER_URL`/
  `_REDIRECT_URI`, `WEB_APP_ORIGIN` (dashboard-web's real deployed origin), and a freshly-generated
  `TOTP_ENCRYPTION_KEY` as `dashboard-api` Vercel env vars. Once those were set, the *same*
  `openid-client` `ERR_REQUIRE_ESM` class of error the 2026-08-11 dynamic-`import()` fix (`ddc951e`)
  was believed to have already fixed **resurfaced** — proving that fix was never actually exercised
  before (the `AUTH_ENV` provider throws on missing env vars *before* reaching the `dynamicImport`
  call, so the code path was untested until real Google OAuth env vars existed). Root cause this
  time, confirmed only by reading actual deployed runtime logs (local/compiled-output checks are
  insufficient — Vercel's Function bundler re-transpiles `apps/dashboard-api/src/` itself rather
  than consuming our compiled `dist/`): a plain `await import(specifier)` gets rewritten back into a
  broken `require()` by Vercel's own bundler, same failure mode as TypeScript's own CommonJS
  downlevel emit, just a second, independent instance of it. Fixed via an indirect,
  Function-constructor-based dynamic import (`apps/dashboard-api/src/common/dynamic-import.ts`) that
  is opaque to static AST rewriting (commit `5b4e6ed`) — which then broke Vitest's `vi.mock()`
  (needs a literal `import()` to instrument), fixed by branching on the `VITEST` env var Vitest sets
  automatically. That fix then surfaced a **second-order** problem: hiding the import from static
  analysis to dodge the harmful rewrite also hid it from Vercel's dependency tracer, so
  `openid-client` was silently dropped from the deployed bundle entirely
  (`ERR_MODULE_NOT_FOUND`) — fixed via `vercel.json`'s `includeFiles` (commit `3f38d30`), the
  documented Vercel mechanism for dependencies invisible to static tracing. That in turn surfaced a
  **third-order** version of the same problem one level deeper: `openid-client`'s own runtime
  dependencies (`jose`, `oauth4webapi`) live only as symlinks nested inside pnpm's virtual store,
  with no top-level symlink in `dashboard-api`'s own `node_modules` for `includeFiles` to target —
  fixed by declaring `jose`/`oauth4webapi` as direct `dashboard-api` dependencies (same version
  ranges `openid-client` itself already pins), which makes pnpm create real top-level symlinks in
  the same shape already proven to work for `openid-client` (commit `b40a06b`). **Verified against
  the live deployment, not just local checks, at every step** — each fix was pushed, the redeploy
  watched via real Vercel build/runtime logs, and only declared working once the deployed Function
  itself showed the expected behavior. Final state: `/health` and `/ready` return `200`, a
  known-nonexistent route (`/auth/google`) returns a proper NestJS JSON `404` (not a crash), and the
  runtime log timeline shows zero `500`s since this deployment — `dashboard-api` is genuinely live
  in production for the first time. Note: `/ready`'s `checks: {}` is still a Phase-1A-era stub (see
  `apps/dashboard-api/src/health/health.controller.ts`) that has never been wired to an actual
  database query, so a live Neon *query* succeeding is not independently proven by this — only that
  Sequelize's `dialectModule` fix works and nothing crashes at construction time.
- `[2026-08-12]` Live-verified the real Google SSO login flow end-to-end as far as safely possible
  without Claude entering credentials (per both this project's own standing caution and Claude's
  own never-enter-passwords rule): `GET /auth/google/start` correctly redirects to Google's real
  OAuth consent screen with correct `client_id`/`redirect_uri`/`scope`/PKCE `code_challenge`/
  `state`/`nonce`, and the consent screen correctly shows "webdesk-growth-dashboard" as the
  requesting app. User completed the actual sign-in themselves and hit a `500` at
  `/auth/google/callback` — diagnosed via live runtime logs as the first real database query ever
  executed against the freshly-provisioned Neon instance, which has never had migrations applied
  (every table `handleCallback()` touches — `users`, `external_auth_identities`, `sessions`, etc. —
  almost certainly doesn't exist yet). User was walked through running
  `pnpm --filter @webdesk/database run migrate` themselves, locally, with `DATABASE_URL` set only
  in their own terminal — Claude never saw the real connection string, consistent with credential-
  handling discipline. Outcome of that migration run not yet confirmed as of this entry.
- `[2026-08-12]` GitHub App creation completed and installed — App ID `153184504`, created under
  `@webdesksolution`, installed on `WDS-Internal-DeveloperTeam` (the repo's actual owner org).
  Installation initially failed silently (the org never appeared in the Install App picker) despite
  the user holding a confirmed Owner role there — diagnosed as the App's **Private** visibility
  setting, which restricts installation to the owning account only regardless of the installer's
  role on any other account (a GitHub Apps platform behavior, unrelated to org permissions). SAML
  SSO was also ruled out as a candidate cause along the way — this org isn't on GitHub Enterprise,
  and SSO enforcement doesn't exist below that plan tier. Fixed by transferring the App's ownership
  from `@webdesksolution` to `WDS-Internal-DeveloperTeam` directly (General settings → Danger Zone
  → Transfer ownership), which collapses the owner/installer mismatch entirely. Private key,
  installation ID, and target repository list not yet recorded — kept out of chat/docs as
  credentials; still need setting as `dashboard-api`'s GitHub integration env vars before any
  GitHub-dependent feature can use them.

## Open client blockers

- ~~Second-role human review of `docs/security/threat-model-authentication-session-handling.md`
  (Phase 1C)~~ — resolved 2026-08-07, reviewed and approved by WebDesk Solution. See
  `docs/project-state/phase-1c-approval-checklist.md`'s "Second-role security review".
- ~~Second-role human review of `docs/security/threat-model-authorization-rbac.md` (Phase 1D,
  PR #8)~~ — resolved 2026-08-10, reviewed and confirmed by WebDesk Solution (Jitesh D and
  Brijesh D), no issues raised. See `docs/project-state/phase-1d-approval-checklist.md`'s
  "Required second-role human reviews".
- ~~Second-role human review of `docs/implementation/phase-1d-security-review.md` (Phase
  1D-expanded, PR #9)~~ — resolved 2026-08-10, same reviewers, no issues raised. Both Phase 1D
  gates have since been approved (2026-08-11) — see "Current state" above.
- ~~First-login provisioning model (JIT vs. pre-provisioned)~~ — resolved 2026-08-07,
  pre-provisioned only. See profile `knowledge/05-google-workspace-sso-and-local-admin.md`.
- ~~The real Google Workspace OAuth client (client ID, secret, authorized redirect URIs)~~ —
  resolved 2026-08-12, user created the client and set `GOOGLE_OAUTH_CLIENT_ID`/`_SECRET`/
  `_ISSUER_URL`/`_REDIRECT_URI` as `dashboard-api` Vercel env vars; the deployed Function's real
  `client.discovery()` call against Google's OIDC issuer now succeeds at bootstrap (see 2026-08-12
  decision entry). Whether the SSO *login flow itself* works end-to-end for a real Workspace user
  is still unverified (see Cautions — testing that remains off-limits).
- The real emergency-administrator account list — the provisioning _mechanism_ is built
  (`apps/dashboard-api/src/auth/scripts/provision-emergency-admin.ts`), but no real accounts exist
  yet. Owner: PM/security owner.
- ~~`dashboard-web`'s real deployed origin (`WEB_APP_ORIGIN` on the `dashboard-api` side,
  CORS/CSRF allowlist)~~ — resolved 2026-08-12, user set it as a `dashboard-api` Vercel env var.
  Whether the current Vercel-assigned domain is the final one (vs. a custom domain later) is still
  an infrastructure-owner decision, but the value itself is set and live.
- ~~The real `DATABASE_URL` (Neon connection string) as a `dashboard-api` Vercel env var~~ —
  resolved 2026-08-12: user provisioned Neon via Vercel Marketplace and set `DATABASE_URL`; the
  deployed Function no longer fails at bootstrap on this. A live database *query* succeeding is
  still not independently proven (see 2026-08-12 decision entry's closing note) — only that
  Sequelize constructs without crashing.
- ~~Actual GitHub repository URL~~ — resolved 2026-08-06, registered in `project.json` and as
  the local `origin` remote; confirmed real and reachable (Phase 0 pushed to `origin/main`,
  Phase 1A branch pushed and PR #1 opened 2026-08-06, merged 2026-08-07). Still unconfirmed:
  whether branch protection is configured on `main` (`docs/repository-plan/branch-and-release-plan.md`).
- ~~Postgres provider vs. Neon exclusion~~ — resolved 2026-08-07, Supabase/`us-east-1` — see
  profile `knowledge/01-approved-architecture.md` "Database" stop-condition for the rule this
  satisfies. **Superseded 2026-08-11**: provider changed to Neon, `us-east-1`, by explicit
  project-owner decision overriding WDS-002's Neon-exclusion specifically — see ADR-0007's
  "Resolution note" and "Recent decisions" above. Not yet provisioned under either provider.

## Cautions

- Do NOT design `dashboard-worker` as a persistent process — resolved decision,
  see profile `knowledge/04-serverless-queues-workflows-and-cron.md`.
- Do NOT use ACF anywhere in the WordPress repository — absolute rule, WDS-001.
- ~~Do NOT select Neon directly as the Postgres provider — WDS-002.~~ **Overridden 2026-08-11** by
  explicit project-owner (WebDesk Solution) decision — the confirmed provider is now Neon,
  `us-east-1`. See ADR-0007's "Resolution note" for the full record. WDS-002's own rule text (in
  the Master Specification, outside this repo's control) is unchanged; this records that the
  project owner has explicitly chosen to override it for this specific decision.
- Do NOT wire Resend or any transactional-email API — WDS-004, use Google Workspace SMTP only.
- Do NOT conflate the software-delivery agent roster with the dashboard's 15 business
  agents — see profile `SKILL.md §6`.
- Do NOT create `projects`, `users`, or any other business entity in `packages/database` without
  a separate, explicit authorization beyond Phase 1B's own approval — the task package's own
  §9/§24 two-tier gate. `_framework_probe` (test-only) is the only table that exists.
- ~~Do NOT provision the actual Neon database (create the real project/instance)~~ — the user did
  this themselves 2026-08-12 via Vercel's own Storage → Marketplace flow (their own ad-hoc action,
  same pattern as manually creating the two Vercel projects on 2026-08-11). This caution is about
  Claude not doing it unprompted — it still stands for that; every automated test still uses a
  local/CI disposable database, and Claude has not run migrations or written data against the real
  Neon instance.
- Do NOT begin the 21 real business-module endpoints, the general ADR-0017 audit-log subsystem
  (Task 7), or user-management CRUD beyond role assignment (Task 8) without a separate, explicit
  go-ahead — Phase 1D-expanded's own approval (once granted) covers this expansion only, per its
  task package's §32 out-of-scope list.
- Do NOT build a grant-editing endpoint for `view_confidential`/`edit_confidential`, a real
  project-scoped HTTP route, or any real confidential business field without a separate, explicit
  authorization — the underlying mechanisms are built and tested (Phase 1D-expanded), but
  activating them over HTTP was not requested by that brief's own endpoint list.
- Both Phase 1D gates (G4-1D for PR #8, G4-1D-EXP for PR #9) are now approved (2026-08-11, clean
  CONFIRM — see "Current state"). Merging, completing the required review, and gate approval were
  each their own explicit, separate authorization throughout — a useful pattern to keep following
  for any future gate, not just a historical note.
- ~~Do NOT create a real Google OAuth client, and do NOT test the SSO flow against a real Google
  Workspace account~~ — the client was created 2026-08-12 (see "Recent decisions"), and the login
  flow was tested as far as Claude can safely go on its own (verified the real redirect to Google's
  consent screen; never entered credentials, per both this caution's original intent and Claude's
  own standing rule against entering passwords). The user then completed the actual sign-in
  themselves. The OIDC implementation's own automated test suite still tests against mocked/offline
  configuration only, unchanged (`docs/contracts/google-workspace-auth-contract.md`).
- Do NOT wire a real SMTP send for emergency-admin login alerts — Google Workspace SMTP
  integration (`knowledge/09-google-workspace-smtp.md`) doesn't exist yet; the notifier interface
  (`apps/dashboard-api/src/auth/emergency/emergency-admin-login-notifier.ts`) exists specifically
  so a real implementation can be swapped in later without touching the login flow itself.
- `docs/security/threat-model-authorization-rbac.md` (Phase 1D, PR #8),
  `docs/implementation/phase-1d-security-review.md` (Phase 1D-expanded, PR #9), and
  `docs/security/threat-model-authentication-session-handling.md` (Phase 1C) have all now received
  their required second-role human review and may be treated as reviewed — see each phase's own
  approval-checklist/validation-report "Sign-off"/"Second-role security review" section for the
  recorded decision.
- Do NOT treat `canonical-inputs/WebDesk_Service_SEO_Library_Templates_v4.xlsm` as approved
  business content — advisory sample data only, per WDS-014.

---

Last touched: 2026-08-12 · by Claude (Continuing the 2026-08-11 ad-hoc Vercel deployment
troubleshooting: the user provisioned the real Neon database via Vercel Marketplace and set the
remaining `dashboard-api` env vars (`DATABASE_URL`, `GOOGLE_OAUTH_*`, `WEB_APP_ORIGIN`,
`TOTP_ENCRYPTION_KEY`) themselves. That surfaced and required fixing four more real bugs in
sequence, each found only via live deployment logs and fixed/verified against the real deployment
(not local checks alone): Sequelize's internal `pg` require missed by Vercel's bundler (`pg`
dialectModule fix), `openid-client`'s dynamic `import()` getting rewritten to a broken `require()`
by Vercel's own bundler a second time in a different code path (indirect Function-constructor
import), that fix hiding the dependency from Vercel's tracer entirely (`vercel.json` `includeFiles`),
and `openid-client`'s own transitive deps (`jose`, `oauth4webapi`) being invisible to that same
`includeFiles` glob (promoted to direct `dashboard-api` dependencies). See the 2026-08-12 "Recent
decisions" entry for the full chain. **Result: `dashboard-api`'s Vercel Function is genuinely live
in production for the first time** — `/health` and `/ready` return `200`, unknown routes return a
proper NestJS `404`, zero `500`s since this deployment. `checks: {}` on `/ready` is still an
unwired Phase-1A-era stub, so a live Neon *query* succeeding is not independently proven — only
that nothing crashes at bootstrap or Sequelize construction. All previously-listed env-var
blockers (`DATABASE_URL`, `GOOGLE_OAUTH_*`, `WEB_APP_ORIGIN`, `TOTP_ENCRYPTION_KEY`) are now
resolved; remaining open blockers are the real emergency-administrator account list, the WordPress
Application Password account, and real timezone confirmation — none of which block
`dashboard-api`'s own liveness. Separately this same session: the real Google SSO login flow was
verified as far as Claude can safely go without entering credentials — `/auth/google/start`
correctly redirects to Google's real consent screen with correct OIDC params — then the user
completed sign-in themselves and hit a `500` at `/auth/google/callback`, diagnosed as the freshly-
provisioned Neon database never having had migrations applied; the user was walked through running
them locally, outcome not yet confirmed. Also this session: the GitHub App (App ID `153184504`) was
created and, after diagnosing a Private-visibility-vs-installer-account mismatch (not an org-
permissions or SSO issue), successfully installed on `WDS-Internal-DeveloperTeam` by transferring
the App's ownership there first. Next candidate work: the 21 real business-module endpoints, not
started automatically — still requires its own explicit authorization.)
