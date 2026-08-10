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
  PostgreSQL (Vercel-provisioned, Neon excluded) + Sequelize; Vercel Queues/Workflows/Cron
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

- **Stage:** development **Current gate:** G4-1C (Phase 1C, passed 2026-08-07 **via OVERRIDE, not a
  clean CONFIRM** — see below) is the last recorded gate — see
  `outputs/webdesk-growth-dashboard/project.json`'s `gates[]`, authoritative.
  Phase 1D (below) is built and validated but **not yet approved** — no new gate has been recorded.
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
- **Active phase:** Phase 1D — RBAC and authorization (Task 6), **built, validated, and merged to
  `main`** via PR #8, **gate not yet approved** — see `docs/task-packages/phase-1d-rbac-authorization.md`
  and `docs/project-state/phase-1d-validation-report.md`. Deny-by-default `PermissionService`/
  `PermissionGuard`, the real seeded 7-role/21-module/458-grant matrix from
  `06_Roles_and_Permissions.md §3`, and the "Users/roles" module's own HTTP surface (proving the
  framework — the other 20 business modules' endpoints don't exist as code yet) — 146 unit + 63
  real-database integration/e2e tests, all passing.
- **Phase 1D-expanded** — the larger RBAC/permissions/separation-of-duties brief
  (`docs/task-packages/phase-1d-rbac-permissions-expanded.md`) — **built, validated, documented,
  and merged to `main`** via
  [PR #9](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/9) (merge
  commit `67a4955`, 2026-08-08), under explicit authorization at each step (including the merge
  itself), on top of PR #8's `AuthzModule`. **Gate not yet approved.** Centralizes grant logic into
  a new `AuthorizationService` (retires `PermissionService`), adds the 43-module registry,
  project-scoped role assignment (schema/repository only, no HTTP route yet), confidential-field
  actions (real, checked, zero seeded), the `authorization_actions` cross-request
  separation-of-duties foundation, and — closing the exact gap the original threat model flagged —
  **now blocks self-role-assignment outright**, per this brief's own explicit §21/§33 instruction.
  144 unit + 41 real-database integration + 37 real-database e2e tests, all passing. Before
  merging, the branch was rebased onto `main` (which by then included PR #10's dependency bumps)
  and fully re-validated — no conflicts, `pnpm audit` clean throughout. See
  `docs/project-state/phase-1d-validation-report.md`'s addendum,
  `docs/implementation/phase-1d-security-review.md`, and
  `docs/project-state/phase-1d-approval-checklist.md` (status: merged, security review complete,
  gate NOT yet approved — see below). **Does not include** the 21 real business modules, the
  general audit-log subsystem (Task 7), or user-management CRUD (Task 8) — all separate, later
  authorizations. Phase 1A, 1B, and 1C remain approved, each scoped to itself only (Phase 1C via
  OVERRIDE, see above).
- **Blocked on:** see `docs/project-state/setup-input-register.md` for standing setup-time inputs. The
  Postgres Marketplace provider is resolved (Supabase, `us-east-1`) but **not provisioned** — every test
  ran against a local/CI disposable database. Google Workspace OAuth client (blocks a real deployment,
  not any phase's own code completion), the real emergency-administrator account list, WordPress
  Application Password account, `dashboard-web`'s real deployed origin, and real timezone confirmation
  still block later tasks/a real deployment.

## Active tasks (this sprint)

1. Await explicit gate-approval decisions for both Phase 1D scopes: PR #8 (narrower scope) and
   PR #9 (the expansion) are both merged to `main`, and both required second-role security reviews
   are now complete (2026-08-10, WebDesk Solution — Jitesh D and Brijesh D, no issues raised on
   either `docs/security/threat-model-authorization-rbac.md` or
   `docs/implementation/phase-1d-security-review.md`). Completing the review is not itself gate
   approval — the approver still needs to be asked directly for a decision on each gate.
2. Resolve remaining setup inputs in `docs/project-state/setup-input-register.md` (GitHub App
   creation, Google Workspace OAuth client, the real emergency-administrator account list,
   WordPress Application Password account, `dashboard-web`'s real deployed origin).
3. Provision the actual Supabase database once a later task actually needs a live connection —
   not before, and not automatically.
4. Once both Phase 1D gates are approved: the 21 real business-module endpoints are the next
   candidate per `docs/phase-plans/phase-1-foundation-plan.md` — not started automatically.

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

## Open client blockers

- ~~Second-role human review of `docs/security/threat-model-authentication-session-handling.md`
  (Phase 1C)~~ — resolved 2026-08-07, reviewed and approved by WebDesk Solution. See
  `docs/project-state/phase-1c-approval-checklist.md`'s "Second-role security review".
- ~~Second-role human review of `docs/security/threat-model-authorization-rbac.md` (Phase 1D,
  PR #8)~~ — resolved 2026-08-10, reviewed and confirmed by WebDesk Solution (Jitesh D and
  Brijesh D), no issues raised. See `docs/project-state/phase-1d-approval-checklist.md`'s
  "Required second-role human reviews".
- ~~Second-role human review of `docs/implementation/phase-1d-security-review.md` (Phase
  1D-expanded, PR #9)~~ — resolved 2026-08-10, same reviewers, no issues raised. Neither Phase 1D
  gate is itself approved by this — that remains a separate, not-yet-requested decision.
- ~~First-login provisioning model (JIT vs. pre-provisioned)~~ — resolved 2026-08-07,
  pre-provisioned only. See profile `knowledge/05-google-workspace-sso-and-local-admin.md`.
- The real Google Workspace OAuth client (client ID, secret, authorized redirect URIs) — blocks a
  real deployment, not any phase's own code completion (built and tested against mocked/offline
  configuration). Owner: infrastructure owner.
- The real emergency-administrator account list — the provisioning _mechanism_ is built
  (`apps/dashboard-api/src/auth/scripts/provision-emergency-admin.ts`), but no real accounts exist
  yet. Owner: PM/security owner.
- `dashboard-web`'s real deployed origin (`WEB_APP_ORIGIN` on the `dashboard-api` side, CORS/CSRF
  allowlist) — every test uses a fixture origin. Owner: infrastructure owner.
- ~~Actual GitHub repository URL~~ — resolved 2026-08-06, registered in `project.json` and as
  the local `origin` remote; confirmed real and reachable (Phase 0 pushed to `origin/main`,
  Phase 1A branch pushed and PR #1 opened 2026-08-06, merged 2026-08-07). Still unconfirmed:
  whether branch protection is configured on `main` (`docs/repository-plan/branch-and-release-plan.md`).
- ~~Postgres provider vs. Neon exclusion~~ — resolved 2026-08-07, Supabase/`us-east-1` — see
  profile `knowledge/01-approved-architecture.md` "Database" stop-condition for the rule this
  satisfies. Not yet provisioned.

## Cautions

- Do NOT design `dashboard-worker` as a persistent process — resolved decision,
  see profile `knowledge/04-serverless-queues-workflows-and-cron.md`.
- Do NOT use ACF anywhere in the WordPress repository — absolute rule, WDS-001.
- Do NOT select Neon directly as the Postgres provider — WDS-002.
- Do NOT wire Resend or any transactional-email API — WDS-004, use Google Workspace SMTP only.
- Do NOT conflate the software-delivery agent roster with the dashboard's 15 business
  agents — see profile `SKILL.md §6`.
- Do NOT create `projects`, `users`, or any other business entity in `packages/database` without
  a separate, explicit authorization beyond Phase 1B's own approval — the task package's own
  §9/§24 two-tier gate. `_framework_probe` (test-only) is the only table that exists.
- Do NOT provision the actual Supabase database (create the real project/instance) — confirming
  the provider (`project.json`) is not provisioning it; every test so far used a local/CI
  disposable database.
- Do NOT begin the 21 real business-module endpoints, the general ADR-0017 audit-log subsystem
  (Task 7), or user-management CRUD beyond role assignment (Task 8) without a separate, explicit
  go-ahead — Phase 1D-expanded's own approval (once granted) covers this expansion only, per its
  task package's §32 out-of-scope list.
- Do NOT build a grant-editing endpoint for `view_confidential`/`edit_confidential`, a real
  project-scoped HTTP route, or any real confidential business field without a separate, explicit
  authorization — the underlying mechanisms are built and tested (Phase 1D-expanded), but
  activating them over HTTP was not requested by that brief's own endpoint list.
- Do NOT treat PR #9's merge (2026-08-08) or the second-role security review's completion
  (2026-08-10, both Phase 1D threat-model documents, no issues raised) as gate approval — each was
  its own explicit, separate authorization; the gate decision itself is still outstanding for both
  PR #8 and PR #9.
- Do NOT create a real Google OAuth client, and do NOT test the SSO flow against a real Google
  Workspace account — the OIDC implementation is tested against mocked/offline configuration for
  exactly this reason (`docs/contracts/google-workspace-auth-contract.md`).
- Do NOT wire a real SMTP send for emergency-admin login alerts — Google Workspace SMTP
  integration (`knowledge/09-google-workspace-smtp.md`) doesn't exist yet; the notifier interface
  (`apps/dashboard-api/src/auth/emergency/emergency-admin-login-notifier.ts`) exists specifically
  so a real implementation can be swapped in later without touching the login flow itself.
- Do NOT treat `docs/security/threat-model-authorization-rbac.md` (Phase 1D, PR #8)'s or
  `docs/implementation/phase-1d-security-review.md` (Phase 1D-expanded)'s completed second-role
  review (2026-08-10, WebDesk Solution — Jitesh D and Brijesh D) as gate approval — the review
  satisfies ADR-0010's separation-of-duties requirement, but the gate decision itself is a
  separate, still-outstanding, explicit authorization for both PR #8 and PR #9.
  `docs/security/threat-model-authentication-session-handling.md` (Phase 1C) is different: its
  second-role review completed 2026-08-07 (see "Recent decisions") — it may now be treated as
  reviewed.
- Do NOT treat `canonical-inputs/WebDesk_Service_SEO_Library_Templates_v4.xlsm` as approved
  business content — advisory sample data only, per WDS-014.

---

Last touched: 2026-08-10 · by Claude (Both required second-role security reviews for Phase 1D
completed — WebDesk Solution (Jitesh D and Brijesh D) confirmed
`docs/security/threat-model-authorization-rbac.md` (PR #8) and
`docs/implementation/phase-1d-security-review.md` (PR #9), no issues raised. Both Phase 1D scopes
are merged to `main` with `pnpm audit` clean and their required review complete, but **neither
gate has been approved yet** — that remains a separate, not-yet-requested decision. Phase 1C's
G4-1C gate approved via OVERRIDE, second-role review has since completed.)
