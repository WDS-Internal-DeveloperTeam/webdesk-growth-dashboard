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
- **Approved (with an open condition):** Phase 1C — Authentication and session management (Tasks 4/5,
  combined) — merged to `main` via PR #7 at commit `102397d2f1aaf9fc5d374dd4bd58c764cb031ef9`, and
  the G4-1C gate approved 2026-08-07 — see `docs/project-state/phase-1c-approval-checklist.md`.
  **The approval was an explicit OVERRIDE, not a clean pass**: the required second-role human
  review of `docs/security/threat-model-authentication-session-handling.md` (ADR-0010
  separation-of-duties) has **not** happened — the human approver was asked directly and chose to
  approve the gate now anyway, with that review recorded as a still-outstanding open item (see
  "Open client blockers" below), not silently marked complete. See
  `docs/task-packages/phase-1c-authentication-sessions.md` and
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
  real-database integration/e2e tests, all passing. STRIDE pass flags one genuinely **unresolved**
  design gap: no separation-of-duties check on role self-assignment — see
  `docs/security/threat-model-authorization-rbac.md`. **Does not include** the 21 real business
  modules, the confidential-field axis, the general audit-log subsystem (Task 7), or
  user-management CRUD (Task 8) — all separate, later authorizations. Phase 1A, 1B, and 1C remain
  approved, each scoped to itself only (Phase 1C via OVERRIDE, see above).
- **Blocked on:** see `docs/project-state/setup-input-register.md` for standing setup-time inputs. The
  Postgres Marketplace provider is resolved (Supabase, `us-east-1`) but **not provisioned** — every test
  ran against a local/CI disposable database. Google Workspace OAuth client (blocks a real deployment,
  not any phase's own code completion), the real emergency-administrator account list, WordPress
  Application Password account, `dashboard-web`'s real deployed origin, and real timezone confirmation
  still block later tasks/a real deployment.

## Active tasks (this sprint)

1. Obtain the required second-role human review of
   `docs/security/threat-model-authentication-session-handling.md` (Phase 1C) — outstanding since
   before the G4-1C gate was approved via explicit OVERRIDE; see
   `docs/project-state/phase-1c-approval-checklist.md`'s "Open condition".
2. Await explicit review/approval of Phase 1D, including a decision on the flagged
   self-assignment separation-of-duties gap (`docs/security/threat-model-authorization-rbac.md`)
   and, separately, the required second-role review of that same document.
3. Resolve remaining setup inputs in `docs/project-state/setup-input-register.md` (GitHub App
   creation, Google Workspace OAuth client, the real emergency-administrator account list,
   WordPress Application Password account, `dashboard-web`'s real deployed origin).
4. Provision the actual Supabase database once a later task actually needs a live connection —
   not before, and not automatically.
5. Once Phase 1D is approved: the 21 real business-module endpoints are the next candidate per
   `docs/phase-plans/phase-1-foundation-plan.md` — not started automatically.

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

## Open client blockers

- Second-role human review of `docs/security/threat-model-authentication-session-handling.md`
  (Phase 1C) — the G4-1C gate was approved via explicit OVERRIDE 2026-08-07 with this review
  recorded as a still-outstanding open item, not completed. See
  `docs/project-state/phase-1c-approval-checklist.md`. Owner: a second, human role distinct from
  the implementing agent (ADR-0010 separation-of-duties) — not yet assigned; `project.json`'s
  `assigned_team` is entirely `TBD`.
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
- Do NOT begin the 21 real business-module endpoints, the confidential-field axis
  (`view_confidential`/`edit_confidential`), the general ADR-0017 audit-log subsystem (Task 7), or
  user-management CRUD beyond role assignment (Task 8) without a separate, explicit go-ahead —
  Phase 1D's own approval (once granted) covers Phase 1D only, per its task package's out-of-scope
  list.
- Do NOT unilaterally resolve the flagged self-assignment separation-of-duties gap in
  `RoleAssignmentService` (a Super Admin can currently re-role themselves with no second
  approver) — it is an open design decision for the second-role reviewer, documented in
  `docs/security/threat-model-authorization-rbac.md`'s Elevation of Privilege table, not a bug to
  silently patch or silently leave without flagging.
- Do NOT create a real Google OAuth client, and do NOT test the SSO flow against a real Google
  Workspace account — the OIDC implementation is tested against mocked/offline configuration for
  exactly this reason (`docs/contracts/google-workspace-auth-contract.md`).
- Do NOT wire a real SMTP send for emergency-admin login alerts — Google Workspace SMTP
  integration (`knowledge/09-google-workspace-smtp.md`) doesn't exist yet; the notifier interface
  (`apps/dashboard-api/src/auth/emergency/emergency-admin-login-notifier.ts`) exists specifically
  so a real implementation can be swapped in later without touching the login flow itself.
- Do NOT treat either `docs/security/threat-model-authentication-session-handling.md` or
  `docs/security/threat-model-authorization-rbac.md` as a completed, approved security review —
  both are explicitly self-reviews only, pending the required second-role human review per
  ADR-0010's separation-of-duties principle.
- Do NOT treat `canonical-inputs/WebDesk_Service_SEO_Library_Templates_v4.xlsm` as approved
  business content — advisory sample data only, per WDS-014.

---

Last touched: 2026-08-07 · by Claude (Phase 1C's G4-1C gate approved via OVERRIDE, second-role review still outstanding; Phase 1D built, validated, and merged, not yet approved)
