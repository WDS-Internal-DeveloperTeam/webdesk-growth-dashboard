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

- **Stage:** development **Current gate:** G4-1E (Phase 1E, approved 2026-08-13, clean CONFIRM) is
  the last recorded gate — see `outputs/webdesk-growth-dashboard/project.json`'s `gates[]`,
  authoritative. Phase 1D's two gates (G4-1D for PR #8, G4-1D-EXP for PR #9) and Phase 1E's gate
  (G4-1E) are all approved, each a clean CONFIRM since the required second-role security review
  was already complete before the respective gate was requested.
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
- **The production database schema is now confirmed migrated (2026-08-12)** — all 17 migrations
  applied, all 15 expected tables verified present via a genuinely read-only check (see the
  "Recent decisions" entry for the full diagnostic chain). This was the last unverified piece of
  `dashboard-api`'s liveness claim; it's now closed.
- **Blocked on (as of 2026-08-12):** see `docs/project-state/setup-input-register.md` for standing
  setup-time inputs. All of `DATABASE_URL`, the Postgres provisioning itself, `GOOGLE_OAUTH_*`,
  `WEB_APP_ORIGIN`, and `TOTP_ENCRYPTION_KEY` are now resolved (see 2026-08-12 decision entry) —
  what's left is the real emergency-administrator account list, the WordPress Application Password
  account, and real timezone confirmation. None of these block `dashboard-api`'s own liveness; they
  block specific features (emergency-admin login, WordPress integration, schedule-sensitive
  reporting) from being usable end-to-end.
- **Approved: Phase 1E — six operational-infrastructure architecture slices, built, merged,
  reviewed, and gated (2026-08-13).** Audit foundation (real ADR-0017 `audit_events` table with
  database-layer-enforced immutability), audit schema expansion, job architecture (jobs,
  job_attempts, idempotency_keys), notification-record foundation, retention architecture
  (retention_policies, retention_holds), operational-contact foundation (with PII confidential-field
  gating), and system-events/health foundation — all six slices merged to `main` (PRs #11, #13,
  #14, #15, #16, #17, #18), plus two code-review fix PRs (#20, #21) and one security-review
  policy-fix PR (#22, closing notification-recipient existence checks, contacts PII gating, and
  `JobRetryService.manualRetry()`'s `maxAttempts` cap). 279/279 unit + 108/108 real-database
  integration + 72/72 e2e tests, all passing. Every one of 23 independent-code-review findings
  fixed and re-validated. The STRIDE security review (`docs/security/threat-model-phase-1e-
operational-infrastructure.md`) surfaced 10 gaps; the user decided each of the 5 genuine policy
  questions individually — 8 of 10 fixed, 2 accepted as tracked technical debt (retention-hold
  approver verification, `projectId` query-filter scoping — both latent, zero-seeded grants).
  **Required second-role security review complete** — Jitesh D, decision "Approved as-is",
  2026-08-13, no disputes. **G4-1E gate approved 2026-08-13 (clean CONFIRM)** — WebDesk Solution,
  approved commit `6ae8a36116f70ed0f4d429af12774e05b2092e70` (PR #22 merge) — see
  `docs/project-state/phase-1e-approval-checklist.md`'s "Sign-off" section and `project.json`'s
  `gates[]`. **Phase 1E is closed.** Does not include the 21 real business-module endpoints, the
  remaining Task 7 audit scope (migrating existing `auth_events` writes, a query HTTP surface, the
  retention-deletion job), or Phase 1F — each a separate, not-yet-requested authorization.
- **Approved: Phase 1F — application shell, canonical module registry, navigation authorization,
  observability, and CI/accessibility/staging foundations, built, reviewed, and gated
  (2026-08-14).** Extends the existing 43-module `module_registry` with the full field set the
  shell reads (migrations `00034`/`00035`); registry-driven, permission-aware navigation
  (`GET /me/navigation`, `GET /me`); the `dashboard-web` authenticated application shell; a shared
  design-system/UI-state foundation (`packages/ui`); an observability foundation (redaction
  coverage, safe build/release metadata, a Sentry integration built and tested but deliberately
  inert — no real `SENTRY_DSN` exists); automated WCAG 2.2 AA accessibility checks (axe-core, zero
  violations); staging-environment documentation stopped at the provisioning boundary (no resource
  provisioned); and planning-only module-implementation roadmap/task-package-template artifacts.
  Builds **zero business functionality** for any of the 43 real modules
  (`module_registry.implementation_status = 'not_started'` for all 43). 294 unit + 108 real-
  database integration + 79 e2e + 9 Playwright tests, all passing. Independent code review
  (8-angle, high effort) surfaced 14 findings — 9 fixed, 5 recorded as tracked technical debt
  (most notably: Sentry's exception forwarding needs `beforeSend` scrubbing before any real
  `SENTRY_DSN` is ever set — currently zero exposure since none exists). A right-sized security
  review (no new business data model this phase, so not a full STRIDE document) found no
  Critical/High finding. **Required second-role human review complete** — Jitesh D and Brijesh D,
  decision "Approved as-is", 2026-08-14, no disputes. **G4-1F gate approved 2026-08-14 (clean
  CONFIRM)** — WebDesk Solution, approved commit `7d84f040bce67fa7cd1e92aa69e8512021b39b64` on
  branch `phase-1f-application-shell` — see `docs/project-state/phase-1f-approval-checklist.md`'s
  "Sign-off" section and `project.json`'s `gates[]`. **PR #23 was then merged to `main`** under
  explicit "merge PR #23" authorization — merge commit `1e8f343c4779237a4fe75c3c663716877990dc20`,
  all 14 CI checks green before merge. Both `dashboard-web` and `dashboard-api` auto-deployed to
  production on the merge and were verified live directly (`/health`'s `build.commitSha` matches
  the merge commit; `dashboard-web`'s `/` correctly redirects to `/auth/sign-in`). **All 35
  production migrations are now applied (2026-08-14)** — see the dedicated "Recent decisions" entry
  below; this run also retroactively applied all of Phase 1E's remaining operational-infrastructure
  schema, which had never been migrated to production despite being merged/gated a day and a half
  earlier. Does not include the 21 real business-module endpoints, the remaining Task 7 audit scope,
  or any module-implementation wave — each a separate, not-yet-requested authorization.

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
5. ~~Phase 1E (all six operational-infrastructure slices)~~ — **done 2026-08-13.** All six slices
   merged, code review and security review both complete and dispositioned, second-role security
   review complete (Jitesh D, Approved as-is), **G4-1E gate approved** (WebDesk Solution, CONFIRM)
   — see "Current state" above and `docs/project-state/phase-1e-approval-checklist.md`'s
   "Sign-off". Phase 1E is closed. The remaining Task 7 audit scope (migrating existing
   `auth_events` writes into the new `audit_events` table, a query HTTP surface, the
   retention-deletion job) and Phase 1F are separate, not-yet-authorized next candidates.
6. ~~Phase 1F (application shell, module registry, navigation, observability, CI/accessibility,
   staging documentation, module roadmap)~~ — **done 2026-08-14.** Built, code-reviewed,
   security-reviewed, second-role human reviewed (Jitesh D and Brijesh D, Approved as-is),
   **G4-1F gate approved** (WebDesk Solution, CONFIRM), and **merged to `main`** via
   [PR #23](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/23) (merge
   commit `1e8f343c4779237a4fe75c3c663716877990dc20`) — see "Current state" above and
   `docs/project-state/phase-1f-approval-checklist.md`'s "Sign-off". Both `dashboard-web` and
   `dashboard-api` auto-deployed to production on the merge and were verified live. **All 35
   production database migrations run 2026-08-14** (see "Recent decisions"). Remaining: the Task 7
   audit scope, the 21 real business-module endpoints, and any module-implementation wave (see
   `docs/phase-plans/module-implementation-roadmap.md`) — each separate, not-yet-authorized next
   candidates.
7. ~~Projects module task package prepared, awaiting human approval~~ — **backend built,
   independently code-reviewed, security-reviewed, second-role human reviewed, gated, merged, and
   deployed with its production migration run — 2026-08-15.**
   `docs/task-packages/module-projects-foundation.md` was prepared, then explicit "begin
   implementation" authorization was given directly (see "Recent decisions"). Schema, API, RBAC
   wiring, and tests were built and validated, then this project's own `code-review` skill was run
   (high effort) — 9 CONFIRMED findings, most severe an IDOR letting a user authorized on one
   project mutate another project's sub-resources by ID — all 9 fixed. "Merge PR #24" was then
   requested but held per this project's standing discipline (security review → second-role human
   review → gate decision, each separate, before merge); this project's own `security-review`
   skill was then run — 2 CONFIRMED findings, most severe a real privilege-escalation path in the
   new project-approver endpoint — both fixed and re-validated. A review packet (published as a
   Claude artifact — code-review + security-review findings, fixes, validation evidence) was
   prepared for the required second-role human review, since the implementing agent cannot also be
   its own reviewer (ADR-0010). **Jitesh D reviewed it and returned "Approved."** **The gate
   (G4-projects) was then separately requested and approved** — WebDesk Solution, decision
   CONFIRM. **"Merge PR #24" was then separately requested and executed** — merge commit
   `9ee540e67d50a471a4897d5af03cf5ccca01813f`, both Vercel projects auto-deployed and were verified
   live directly. **The production migration was then run** — user ran
   `pnpm --filter @webdesk/database run migrate` themselves (same credential-handling discipline as
   every prior production migration), applying the 9 pending migrations (`00036`–`00044`),
   independently confirmed via a separate `migrate:status` check (44 executed, 0 pending). See
   `docs/project-state/module-projects-foundation-approval-checklist.md`'s "Sign-off" section and
   `project.json`'s `gates[]`/`audit_log` for the full record. **The Projects module backend is now
   genuinely live in production.** No full UI yet (dashboard-web) — the header Project Switcher
   itself is now built (2026-08-16, see item 8 and "Recent decisions" below), but wiring a real
   downstream "current project" context other modules read remains separate, undesigned scope.
8. **`dashboard-web` Project Switcher — built, reviewed, gated, merged, and live in production
   (2026-08-16).** `docs/implementation/dashboard-web-project-switcher.md` records the full account;
   `docs/project-state/dashboard-web-project-switcher-approval-checklist.md` records the review
   sign-off. Not started automatically — built directly on the explicit "build the dashboard-web
   Project Switcher UI" instruction, since D7 already named this as the specific next follow-up
   once the Projects module backend landed. Independent code review (medium effort — 6 findings, 4
   CONFIRMED, all fixed) and a separate security review (0 findings above threshold) both ran on
   [PR #25](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/25); a
   review packet was published as a Claude artifact for the required second-role human review,
   since the implementing agent cannot also be its own reviewer (ADR-0010). **Jitesh D reviewed it
   and returned "Approved."** **The gate (G4-project-switcher) was then separately requested and
   approved** — WebDesk Solution, decision CONFIRM. **"Merge PR #25" was then separately requested
   and executed** — merge commit `598f4d11c7b37626925de2d818c09cdb4948001b`, both Vercel projects
   auto-deployed and were verified live directly: `dashboard-api`'s `/health` returned
   `build.commitSha == 598f4d11c7b37626925de2d818c09cdb4948001b`, and `dashboard-web`'s `/` resolves
   (via the intermediate `/home` hop) to `/auth/sign-in` for an unauthenticated visitor. **The
   Project Switcher is now genuinely live in production.**
9. **`dashboard-web` Projects list page (`/projects`) — built, reviewed, gated, merged, and live in
   production (2026-08-16).** `docs/implementation/dashboard-web-projects-list.md` records the full
   account; `docs/project-state/dashboard-web-projects-list-approval-checklist.md` records the
   review sign-off. Not started automatically — built directly on the explicit "build the Projects
   list page UI" instruction. No approved wireframe or spec exists for this screen (confirmed
   against `07_Low_Fidelity_Wireframes.md` and `03_Detailed_Module_Specifications.md`); renders
   exactly what `GET /projects` actually returns and supports — name, status, public ID,
   updated-at, search, status filter, column sort, offset pagination — deliberately omitting
   "active phase"/"owner" columns from `module-projects-foundation.md`'s own unapproved proposal,
   since those are bare foreign keys with no name-resolution endpoint. Fully server-rendered, no
   client component. Independent code review (medium effort — 7 findings, 6 CONFIRMED, the 2
   highest-severity fixed) and a separate security review (0 findings above threshold) both ran on
   [PR #26](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/26); a
   review packet was published as a Claude artifact for the required second-role human review,
   since the implementing agent cannot also be its own reviewer (ADR-0010). **Jitesh D reviewed it
   and returned "Approved."** **The gate (G4-projects-list) was then separately requested and
   approved** — WebDesk Solution, decision CONFIRM. **"Merge PR #26" was then separately requested
   and executed** — merge commit `b6d0b601db1025d6c175afae4309aa406281ff39`, both Vercel projects
   auto-deployed and were verified live directly: `dashboard-api`'s `/health` returned
   `build.commitSha == b6d0b601db1025d6c175afae4309aa406281ff39`, and `dashboard-web`'s `/` resolves
   (via the intermediate `/home` hop) to `/auth/sign-in` for an unauthenticated visitor. **The
   Projects list page is now genuinely live in production.**

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
  `TOTP_ENCRYPTION_KEY` as `dashboard-api` Vercel env vars. Once those were set, the _same_
  `openid-client` `ERR_REQUIRE_ESM` class of error the 2026-08-11 dynamic-`import()` fix (`ddc951e`)
  was believed to have already fixed **resurfaced** — proving that fix was never actually exercised
  before (the `AUTH_ENV` provider throws on missing env vars _before_ reaching the `dynamicImport`
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
  database query, so a live Neon _query_ succeeding is not independently proven by this — only that
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
  handling discipline. **Confirmed complete, verified via two new read-only tools built for exactly
  this**: `pnpm --filter @webdesk/database run migrate:status` (Umzug's own `executed()`/`pending()`,
  pure reads) hit a real `pg_type` catalog duplicate-key error on its internal
  `CREATE TABLE IF NOT EXISTS "SequelizeMeta"` sync step — a known Postgres/Sequelize race quirk,
  most likely triggered by a stale connection from an earlier interrupted attempt during the
  `DATABASE_URL`-wrangling session (zsh smart-quote and multi-line-paste issues delayed getting a
  working connection string by many turns). Built a second, genuinely zero-DDL tool
  (`pnpm --filter @webdesk/database run list-tables`, a single `SELECT` against `pg_tables`) to
  sidestep that failure mode entirely — it showed only the empty `SequelizeMeta` bookkeeping table,
  confirming the database really had never been migrated. User then ran the real
  `pnpm --filter @webdesk/database run migrate`, which applied all 17 pending migrations cleanly;
  `list-tables` re-run afterward confirmed all 15 expected tables now exist (14 table-creating
  migrations + `SequelizeMeta` — the other 3 of the 17 are seed-only/`ALTER TABLE` migrations with
  no new table). Production database schema is now genuinely live for the first time.
- `[2026-08-12]` `dashboard-web`'s own `/auth/sign-in` page crashed with a `500` (React error #441
  in the browser console) the first time it was actually loaded — a previously-undiscovered gap
  distinct from every `dashboard-api` fix above. Root cause: `apps/dashboard-web/lib/auth.ts`'s
  `getApiBaseUrl()` throws a plain `Error` if `NEXT_PUBLIC_API_BASE_URL` isn't set, crashing the
  page's Server Component render; `dashboard-web`'s Vercel project had only ever had `WORDPRESS_APP`
  configured, never this var. Fixed, with the user's explicit go-ahead to act directly in the
  already-authenticated Vercel session: added `NEXT_PUBLIC_API_BASE_URL=https://webdesk-growth-
dashboard-7v1u-beta.vercel.app` (Production and Preview, not marked Sensitive since it's a public
  URL that Next.js inlines into the client bundle regardless) and triggered a redeploy — required
  specifically for `NEXT_PUBLIC_*` vars, which Next.js bakes in at build time, not read at runtime.
  Verified against the live page afterward: renders correctly, and the "Sign in with Google
  Workspace" link's actual `href` resolves to `dashboard-api`'s real `/auth/google/start` endpoint.
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
- `[2026-08-12]` A staging-environment WordPress Application Password credential set as
  `WORDPRESS_APP` on Vercel — user confirmed this is staging-only, not production. Per-environment
  separation is a hard requirement (`docs/contracts/wordpress-integration-contract.md`), so
  production/development credentials remain outstanding. Regardless, this can't be exercised or
  verified yet — no WordPress adapter code exists in `packages/integrations`, and the env var name
  was never formalized in docs/code before now; whoever eventually builds the adapter should
  confirm the name and that it carries both a username and the Application Password (WordPress
  Basic Auth needs both).
- `[2026-08-12]` First real `users` row and Super Admin role provisioned in production, under
  explicit authorization, confirming the same Workspace org will be used at go-live (just a
  different primary domain later — a same-org domain switch is a simple `GOOGLE_WORKSPACE_ALLOWED_
DOMAINS` env var change, not an OAuth client rebuild). Neither existing operator script fit:
  `provision-emergency-admin.ts` bundles a local password+TOTP credential (wrong for a normal SSO
  user), and `bootstrap-super-admin.ts` requires the user to already exist. Added
  `provision:user` (`apps/dashboard-api/src/auth/scripts/provision-user.ts`), smoke-tested against
  a fresh local disposable database before use. User ran it for `jitesh@webdeskinc.com`, then
  `bootstrap:super-admin` — both succeeded against the real production database. **Google SSO
  login still failed afterward** with the same generic `access_denied` redirect as before — proving
  the rejection isn't the missing-user case anymore, but the specific remaining cause (candidates:
  `GOOGLE_WORKSPACE_ALLOWED_DOMAINS` not actually including `webdeskinc.com`, or an email/domain
  claim mismatch) is unconfirmed. `GoogleAuthService` deliberately never surfaces the specific
  reason to the browser or console logs (knowledge/05, avoids user enumeration) — only
  `auth_events.reason` has it. Added `list-auth-events` (`packages/database/src/list-auth-
events.ts`, single read-only `SELECT`, smoke-tested with a manually inserted row) for exactly
  this, but diagnosis was explicitly deferred by the user ("we will check at that time") rather
  than run immediately — pick up here next time this is revisited.
- `[2026-08-12]` User submitted a formal Phase 1E authorization brief (Immutable Audit Logging,
  Operational Job Records, Notification Records, Retention Controls, Operational Contacts, Core
  System Operations Foundation — explicitly not Phase 1F/business modules), gated on Phase 1D
  having "completed code review" as a distinct item from the security review. Verified against
  `project.json`'s `gates[]` (the authoritative source) that `G4-1D`/`G4-1D-EXP` are both
  `passed`/`CONFIRM`, filled in the brief's blank "approved remote SHA" field as `67a4955` (the
  PR #9 merge commit, confirmed via git log), and confirmed no currently-open blocker touches
  Phase 1E's scope — but found no actual record of an independent code review, distinct from the
  security review, anywhere in the Phase 1D docs, despite the original task package listing it as
  its own separate item (§9: "developer who performed implementation ≠ required independent code
  reviewer"). Reported this gap rather than assuming it was satisfied. User asked Claude to perform
  the independent code review itself; ran the project's own `code-review` skill at high effort
  (8 finder angles, 1-vote verification per surviving candidate) against the full Phase 1D diff —
  6 findings survived (5 CONFIRMED, 1 PLAUSIBLE), most severe a dormant `Op.in: [null, projectId]`
  bug in the RBAC repositories that would silently deny all globally-scoped grants the moment a
  real project-scoped route exists (none does yet). User reviewed the code and findings themselves
  and confirmed it acceptable, closing the "code review" gate item — see
  `docs/project-state/phase-1d-approval-checklist.md`'s new "Independent code review" section for
  the full record. Findings themselves are tracked as follow-up technical debt, not applied as
  fixes in this pass (not requested).
- `[2026-08-12]` Ran the Phase 1E authorization brief's own required pre-implementation
  verification (12 items: Phase 1D approval, exact approved SHA lineage, auth/sessions/RBAC/
  confidential-fields/SoD, Postgres+Sequelize foundations, migrations, tests, no Critical/High
  security finding, no production secret) — every check run fresh against live evidence this
  session, not recalled: `67a4955` confirmed an ancestor of current `HEAD` with zero Phase 1D files
  touched by the 30 commits since; 144 unit + 41 database-integration + 37 dashboard-api-integration/
  e2e tests all passed fresh; a full migration up/down round-trip passed on a brand-new disposable
  database; `pnpm audit` showed 0 vulnerabilities; the CI secret scanner found 0 matches across 347
  tracked files. Two honest caveats recorded rather than glossed over: the live Google SSO login
  flow still isn't fully working end-to-end (unrelated to Phase 1E's own backend-infrastructure
  scope), and the three existing threat-model docs' "no critical vulnerability" conclusions were
  originally written under a "no production deployment" assumption that's now partially stale
  (worth revisiting before Phase 1F, not blocking for Phase 1E). Full record:
  `docs/project-state/phase-1e-pre-implementation-verification.md`. Result: no blocking gap found,
  Phase 1E authorized to proceed.
- `[2026-08-12]` Explicit authorization received ("Start Phase 1E with the audit foundation first")
  to build the audit-foundation slice of Phase 1E only (§5–8: audit-event architecture,
  immutability, retention classification, approval/SoD event linkage) — not jobs, notifications,
  the full retention system, operational contacts, or system health, all separate later
  authorizations per the user's own framing. Built on branch `phase-1e-audit-foundation`, off
  `main` at `95b8c25` — see `docs/task-packages/phase-1e-audit-foundation.md`. Added migration
  `00018` creating the real ADR-0017 `audit_events` table (distinct from Phase 1C's narrower,
  login-scoped `auth_events`), with immutability enforced at the **database layer** via a Postgres
  trigger — not just repository convention like the earlier tables: `UPDATE` is unconditionally
  rejected; `DELETE` is rejected unless a transaction sets
  `audit.retention_delete_authorized = 'on'` (the hook a later, separately-authorized
  retention-deletion job will use — not built here), and even then is refused for any
  `legal_hold = true` row. Added `packages/database/src/audit/` (`AuditEventRepository`) and
  `apps/dashboard-api/src/audit/` (`AuditModule`/`AuditService`, the shared emission point).
  Wired additively (no existing behavior or `auth_events` write removed) into
  `RoleAssignmentService` (now also records `permission_change`/`security_exception`) and
  `RecoveryService` (now also records `account_recovery_request`/`account_recovery_decision`) —
  the latter **closes the specific `RecoveryService` SoD-denial audit gap** flagged by both the
  Phase 1D independent code review and the Phase 1E pre-implementation verification's item 7: a
  self-approval attempt is now recorded, not just blocked. Validated fresh this session against a
  real local disposable PostgreSQL 17 database: migration up/down round-trip clean; 48/48
  `packages/database` integration tests passing (7 new, including direct proof the DB trigger
  rejects a raw `UPDATE`/unauthorized `DELETE` and still refuses a legal-hold row even with
  retention authorization set); 148/148 `dashboard-api` unit tests passing (4 new); 37/37
  `dashboard-api` e2e tests passing (confirms the NestJS module graph resolves with `AuditModule`
  newly imported into both `AuthModule` and `AuthzModule`); typecheck/lint clean on both packages;
  `pnpm audit` 0 vulnerabilities; secret scan clean. Full record:
  `docs/project-state/phase-1e-audit-foundation-validation-report.md`. **Not merged, not
  deployed** — branch pushed and a PR opened for review, per this project's standing pattern.
  Also this session: found `prod-db.env` (the file holding the real production `DATABASE_URL`,
  created during earlier troubleshooting) was untracked but **not** actually covered by
  `.gitignore`'s existing patterns — added it explicitly (plus a general `*.env` pattern) before
  it could be accidentally staged.
- `[2026-08-12]` Ran `pnpm --filter @webdesk/database run list-auth-events` against production
  (user ran it themselves in their own terminal, sourcing `prod-db.env` — Claude never saw the real
  `DATABASE_URL`, same discipline as every prior production DB operation this session) to resume
  the diagnosis explicitly deferred earlier. **Real reason found**: every recent login attempt
  failed with `reason: "token_exchange_failed"`, not a domain/user-matching rejection — ruling out
  the candidates recorded earlier (`GOOGLE_WORKSPACE_ALLOWED_DOMAINS` misconfiguration, email/domain
  claim mismatch). The `auth_events` rows themselves prove the OIDC transaction cookie (state/nonce/
  PKCE verifier) round-tripped successfully across the redirect — a missing/expired cookie redirects
  before `handleCallback` is ever called, so no row would exist for that path, but rows do exist.
  The failure is inside or around `client.authorizationCodeGrant` itself
  (`apps/dashboard-api/src/auth/google/google-auth.service.ts`), most likely a `redirect_uri`
  mismatch against the OAuth client's registered URIs or a wrong/rotated client secret, but the
  `catch` block there swallowed the real `openid-client` error completely — never logged anywhere,
  even server-side. With explicit authorization ("Add the logging fix"), added a single
  `Logger.error` call logging the real error server-side only (Vercel runtime logs via the existing
  pino integration) — never sent to the browser, never written to `auth_events.reason` or the
  redirect URL, both of which stay exactly as generic as before per knowledge/05's no-user-
  enumeration rule. No behavior change; 145/145 `dashboard-api` unit tests passing (1 new). Branch
  `fix-google-oidc-token-exchange-logging` pushed,
  [PR #12](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/12) opened —
  not merged, not deployed. **Still open**: the actual root cause among the candidates above remains
  unconfirmed until this fix is merged, deployed, and a real login is attempted again with the new
  logging live.
- `[2026-08-12]` CI's "Formatting validation" job failed on PR #12 — `pnpm format` (prettier
  `--check`) flagged `CLAUDE.md` (touched by that PR) plus 4 pre-existing files on `main`
  (`docs/project-state/phase-1d-approval-checklist.md`,
  `docs/project-state/phase-1e-pre-implementation-verification.md`,
  `docs/project-state/setup-input-register.md`, `outputs/webdesk-growth-dashboard/HANDOFF.md`)
  already out of sync with prettier's markdown style. Fixed with `pnpm format:write`; diffs
  verified whitespace/emphasis-marker only (balanced insertions/deletions, spot-checked) — no
  content changed in any of the 5 files. All 14 checks passed after the fix.
- `[2026-08-12]` PR #12 merged to `main` under explicit "Merge PR #12" authorization — merge commit
  `11987fd`. `GoogleAuthService`'s token-exchange error logging fix is now on `main`; since
  `dashboard-api`'s Vercel project auto-deploys on push to `main` (the production branch), this
  triggers a real production deployment. **The actual root cause of the login failures is still
  unconfirmed** — that requires the deployment to complete and a real login attempt to run against
  it, so the new `Logger.error` call actually fires and its output can be read from Vercel's
  runtime logs.
- `[2026-08-12]` PR #11 (`phase-1e-audit-foundation`) had a merge conflict against `main` after
  PR #12 merged — both touched `CLAUDE.md` only (no code-file overlap). Resolved under explicit
  "please resolve those and merge" authorization: `git merge origin/main` into the PR branch,
  both conflict hunks were pure additive divergence (each branch had appended different-but-
  compatible content after the same point), resolved by keeping both "Recent decisions" entries in
  chronological order and taking `origin/main`'s footer as the base (the footer is an explicitly
  rewritten "current state" summary, not append-only, and `origin/main`'s was the more recent one).
  The merge also surfaced 4 files (`apps/dashboard-api/src/audit/audit.service.ts`,
  `docs/project-state/phase-1e-audit-foundation-validation-report.md`,
  `docs/task-packages/phase-1e-audit-foundation.md`,
  `packages/database/test/phase1e-audit.integration.test.ts`) that were never checked against
  prettier before — fixed with `pnpm format:write`, verified cosmetic-only. Re-ran the **full**
  validation suite fresh after the merge (not just the diff): typecheck/lint clean on both
  packages, 149/149 `dashboard-api` unit tests, migration up/down round-trip clean, 48/48
  `packages/database` integration tests, 37/37 `dashboard-api` e2e tests, `pnpm audit` 0
  vulnerabilities, secret scan clean (361 files) — all on a fresh local disposable database. Pushed
  the resolved branch, confirmed CI green (14/14 checks), then merged PR #11 to `main` under
  explicit "Merge PR #11" authorization — merge commit `c62cbc1`. The Phase 1E audit-foundation
  slice (real ADR-0017 `audit_events` table with DB-level immutability, `AuditService`, the
  `RecoveryService` SoD-audit-gap fix) is now on `main`. **Not yet live in production**: migration
  `00018` still needs to be run against the real Neon database (same "user runs `pnpm --filter
@webdesk/database run migrate` themselves" pattern as every prior production migration this
  project) before the `audit_events` table actually exists there — the code being on `main` and
  `dashboard-api` auto-deploying does not itself apply the migration.
- `[2026-08-12]` Migration `00018` (the ADR-0017 `audit_events` table, its DB-level immutability
  trigger/function, and the `git_commit_sha` check constraint) run against the real production
  Neon database — user ran it themselves in their own terminal (`pnpm --filter @webdesk/database
run migrate`, sourcing `prod-db.env`), same discipline as every prior production DB operation
  this session. Applied cleanly: `Applied 1 migration(s): 00018-create-audit-events`
  (`durationSeconds: 3.649`). The Phase 1E audit-foundation slice is now genuinely live in
  production — `audit_events` exists and `AuditService` calls from `RoleAssignmentService`/
  `RecoveryService` will now actually persist once `dashboard-api`'s deploy of PR #11's code is
  live (already triggered by the merge, per the prior entry).
- `[2026-08-12]` **Production incident**: user asked to retry the login; found `dashboard-api`
  fully down instead — `/health` and every other route returned `500 FUNCTION_INVOCATION_FAILED`,
  a NestJS bootstrap crash cached across warm invocations (the Vercel entrypoint's
  `bootstrapped ??= bootstrap()` pattern means one failed bootstrap fails every subsequent request
  until a cold start). Diagnosed via real Vercel runtime logs (accessed through the user's own
  authenticated Chrome session — the sandboxed Browser pane has no Vercel login — after explicit
  browser-selection confirmation). Real error: `TypeError: database_1.AuditEventRepository is not
a constructor` at `apps/dashboard-api/src/audit/database.providers.js:8:79`. **Root cause**:
  `packages/database/src/index.cjs.ts` is a separate, manually-maintained CommonJS entrypoint
  (distinct from `index.ts`, the ESM one) that Vercel's Function bundler actually `require()`s in
  production — PR #11 added the new `audit` barrel export to `index.ts` but never knew
  `index.cjs.ts` existed as a second file needing the same line, so `AuditEventRepository` was
  never compiled into the deployed CJS build. This is exactly the class of Vercel-bundler-only
  failure this project has hit repeatedly (openid-client, `pg` dialectModule, etc.) — every local
  and CI check (typecheck, lint, real e2e suite constructing the identical NestJS module graph)
  passed cleanly both before and after PR #11 merged, because none of them exercise the CJS build
  path Vercel's bundler actually uses. Fixed with one line
  (`export * from "./audit/index.js";` in `index.cjs.ts`), confirmed directly by rebuilding
  `dist-cjs` and checking `typeof require('@webdesk/database').AuditEventRepository ===
'function'` (was `'undefined'` before). Re-ran full validation (typecheck/lint on both packages,
  149/149 `dashboard-api` unit tests, 37/37 e2e tests against a real disposable database) before
  pushing. Given the outage and that this project has no real user traffic yet, pushed the
  one-line fix directly to `main` (commit `2e03a57`) rather than a full PR cycle, matching this
  project's established pattern for urgent live-deployment fixes (the openid-client/`pg` fix chain
  earlier this project). **Verified resolved against the live deployment**: `/health` returns
  `{"status":"ok",...}` again, and `/auth/google/start` correctly redirects to Google's real
  sign-in page again. The underlying `token_exchange_failed` diagnosis (PR #12, already live) is
  now unblocked for a real retry — this incident was a separate, newly-introduced regression, not
  related to that fix.
- `[2026-08-12]` **The real Google SSO login now works end-to-end in production**, closing the
  diagnosis thread that ran through most of this session. Path to resolution: (1) the
  `Logger.error()` call added in PR #12 never actually appeared in Vercel's logs for real
  failures — switched to `console.error` directly instead (confirmed reliably captured by Vercel;
  root cause of the `Logger` gap itself not tracked down, noted as a loose end). (2) User then
  updated `GOOGLE_OAUTH_CLIENT_SECRET`/`_CLIENT_ID` in Vercel to the originally-downloaded values
  and redeployed — confirmed via Vercel's own Environment Variables page (both genuinely
  "Production and Preview" scoped, "Updated" minutes prior) and the Deployments list (a real
  manual redeploy, `Ready`, marked current `Production`) — but the next real login attempt still
  failed identically, ruling out a stale-secret theory. (3) Asked directly to self-audit rather
  than keep guessing at external config — re-examined the actual code path instead: confirmed
  directly in `openid-client@6.8.4`'s own source
  (`authorizationCodeGrant` → `redirectUri = stripParams(currentUrl)`) that the library derives
  the `redirect_uri` it sends to Google's token endpoint **from the callback URL's own
  protocol+host**, not from any config value. `GoogleAuthController` builds that URL from
  `req.protocol`, which Express reports as `"http"` behind Vercel's TLS-terminating proxy unless
  the app explicitly trusts it — `trust proxy` was never set anywhere in this codebase. Every real
  login was silently sending `redirect_uri=http://...` to Google's token endpoint instead of the
  registered `https://...` one, a mismatch Google correctly rejects — surfaced to us only as the
  opaque `token_exchange_failed`, and invisible to every earlier check because the _registered_
  URI and the _actually-transmitted_ one were never the same thing. This is why steps (1)-(2)
  above, and everything checked in the original diagnosis, were all real, correct checks that
  simply couldn't have found this. Fixed with `app.set("trust proxy", true)` in both entrypoints
  (`api/index.ts` for production, `main.ts` for consistency). Added a real regression test
  (`apps/dashboard-api/test/google-auth.controller.e2e-spec.ts`) that reproduces the bug
  (`currentUrl.protocol` misread as `"http:"` without the fix, against a real `X-Forwarded-Proto:
https` request) and proves the fix — `GoogleAuthController` had **zero** test coverage before
  this, which is exactly how the bug shipped and stayed invisible through every prior local/CI
  check all session (`google-auth.service.spec.ts` only ever tested `handleCallback` in isolation
  against a hardcoded `https://` fixture URL, never exercising the controller's real
  `req.protocol`-based URL construction). Full validation suite re-run clean (typecheck/lint,
  149/149 unit tests, 39/39 e2e tests including the 2 new ones) before pushing directly to `main`
  (commit `2bc6c91`), matching the established urgent-live-fix pattern. **Verified live**: real
  Google sign-in completed successfully. Also found and gitignored, in passing: an untracked
  `oauth-google-workspace.json` (the downloaded Google OAuth client credentials) sitting at the
  repo root, uncovered by any existing `.gitignore` pattern — never read its contents.
- `[2026-08-13]` **Phase 1E (six operational-infrastructure architecture slices) built, merged,
  reviewed, and gated — the full arc from this entry's predecessor's "not merged" state to closed.**
  Summary (full detail in each phase document, cross-referenced below): all six slices — audit
  foundation (PR #11), audit schema expansion (PR #13), job architecture (PR #14), notification
  foundation (PR #15), retention architecture (PR #16), operational contacts (PR #17), system
  events/health (PR #18) — were merged to `main` one at a time under explicit per-PR authorization
  ("Yes, proceed with #N"), each requiring migration renumbering (parallel branches had claimed
  overlapping migration numbers) and a full validation pass on a fresh disposable database before
  merge. Two code-review fix PRs (#20: migration `00019`'s immutability-trigger self-block bug;
  #21: SoD-denial audit logging and retention-category validation) and one docs-rewrite PR (#19)
  followed. The user then went through all 5 genuine security-review policy questions one by one
  (`docs/security/threat-model-phase-1e-operational-infrastructure.md`) — 3 decided "fix now"
  (notification recipient existence checks, `operational_contacts` PII confidential-field gating,
  `JobRetryService.manualRetry()`'s `maxAttempts` cap), 2 decided "accept as tracked debt"
  (retention-hold approver verification, `projectId` query-filter scoping). The 3 fixes were built,
  tested, and merged via PR #22 (commit `6ae8a36`), including a bounded `pnpm-workspace.yaml`
  `nanoid` override to clear an unrelated CI dependency-audit failure. Asked to "do the second-role
  human review" directly, pushed back on performing it myself (would violate ADR-0010's
  separation-of-duties principle — the same agent that implemented and self-reviewed the work
  cannot also be its required second, human reviewer) and instead built an HTML review packet
  (published as a Claude artifact) for a real human to read and decide. **Jitesh D reviewed it and
  returned "Approved as-is"** — recorded across `docs/project-state/phase-1e-approval-checklist.md`,
  `docs/project-state/phase-1e-validation-report.md`, and
  `docs/security/threat-model-phase-1e-operational-infrastructure.md` (commit `c1664b1`). **The
  Phase 1E gate (G4-1E) was then separately requested and approved** — WebDesk Solution, decision
  CONFIRM (clean pass, not an override, since the review was already complete), approved commit
  `6ae8a36116f70ed0f4d429af12774e05b2092e70` — recorded in `outputs/webdesk-growth-dashboard/
project.json`'s `gates[]` and the approval checklist's "Sign-off" section. Final numbers:
  279/279 unit + 108/108 real-database integration + 72/72 e2e tests passing; 23/23 code-review
  findings and 8/10 security-review findings fixed (2 accepted as debt); `pnpm audit` clean. Phase
  1E is closed — the 21 real business-module endpoints, the remaining Task 7 audit scope, and
  Phase 1F are each separate, not-yet-requested next candidates.
- `[2026-08-14]` **Phase 1F (application shell, canonical module registry, navigation
  authorization, observability, CI/accessibility, staging documentation, module-implementation
  roadmap) built, reviewed, and gated — approved but not yet merged.** Built on branch
  `phase-1f-application-shell` off `main` at the G4-1E approved commit, in slices matching the
  brief's own structure: module-registry extension (migrations `00034`/`00035`, real data for all
  43 modules sourced from the approved specs), registry/permission-mapping validation, the
  `GET /me/navigation` and `GET /me` endpoints, `packages/ui`'s design-token/page-shell/UI-state
  foundation, the `dashboard-web` authenticated application shell, an observability foundation
  (extended Pino redaction, `getBuildMetadata()` wired into `/health`/`/ready` and the request
  logger, a Sentry integration built and unit-tested but deliberately inert since no real
  `SENTRY_DSN` exists), automated WCAG 2.2 AA accessibility checks (axe-core, zero violations on
  every page reachable without a session), staging-environment documentation stopped explicitly at
  the provisioning boundary (records what exists — two Vercel projects that are, in practice,
  production — and what a real isolated staging setup would need, without inventing any resource),
  and a module-implementation roadmap computed mechanically from the registry's own `dependencies`
  field (Tarjan SCC + topological sort, surfacing three genuine dependency cycles in the seeded
  data as explicit co-dependent groups rather than resolving them arbitrarily) plus a reusable
  task-package template. Builds **zero business functionality** for any of the 43 real modules.
  Ran this project's own `code-review` skill (8 finder angles, high effort) against the full
  branch diff before writing the validation report — 14 findings surfaced, 9 fixed (a dropped
  `font-family` outside the shell, 5 design-token groups never wired into CSS custom properties, a
  version constant triplicated across 3 files, sidebar navigation rendering alphabetically instead
  of the approved wireframe order, duplicate/conflicting page headings on the error/not-found
  boundaries, a missing `NEXT_PUBLIC_API_BASE_URL` silently becoming "signed out" with no log — the
  same misconfiguration class behind the 2026-08-12 production outage — a session-fetch dedup
  relying on implicit Next.js memoization instead of explicit `cache()`, a weakened test assertion,
  and a narrowed security-header test), 5 recorded as tracked technical debt with reasoning
  (`NavigationService` reimplementing capability-filter logic inline instead of calling
  `AuthorizationService`; Sentry forwarding exceptions with no `beforeSend` scrubbing — flagged as
  a hard precondition before any real `SENTRY_DSN` is ever set, currently zero exposure since none
  exists; a narrow `GET /me` vs `GET /me/navigation` account-status asymmetry; a transient
  migration-gap type cast; and 43 module keys hand-duplicated across 3 files). A right-sized
  security review (no new business data model this phase, so not a full STRIDE document) found no
  Critical/High finding. Full validation: 294 unit + 108 real-database integration + 79 e2e + 9
  Playwright tests, all passing; migration up/down round trip clean (35 migrations); module-
  registry validation passing (43 modules, 21 permission groups); `pnpm audit` 0 vulnerabilities;
  secret scan clean. Asked to push and open a PR — held locally first per explicit instruction (a
  quick local preview check in the meantime surfaced a real, unrelated local-dev-setup gap: no
  `.env.local` existed for `dashboard-web`, so `/auth/sign-in` crashed on the missing
  `NEXT_PUBLIC_API_BASE_URL` — fixed by copying the project's own documented `.env.example`,
  gitignored, not a code change). Pushed and opened
  [PR #23](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/23) once
  explicitly authorized. **Required second-role human review complete** — Jitesh D and Brijesh D,
  decision "Approved as-is", 2026-08-14, no disputes raised, recorded in
  `docs/project-state/phase-1f-approval-checklist.md`'s "Sign-off" section and `project.json`'s
  `audit_log`. **The Phase 1F gate (G4-1F) was then separately requested and approved** — WebDesk
  Solution, decision CONFIRM (clean pass, not an override, since the review was already complete),
  approved commit `7d84f040bce67fa7cd1e92aa69e8512021b39b64` on branch
  `phase-1f-application-shell` — recorded in `outputs/webdesk-growth-dashboard/project.json`'s
  `gates[]` and the approval checklist's "Sign-off" section. **Unlike every prior gate in this
  project's history, this gate approval was requested and granted before merge** — this project's
  standing "no auto-merge" rule treats merging as its own separate, explicit authorization
  regardless of gate status, never something a gate implies. **PR #23 was then merged to `main`
  under explicit "merge PR #23" authorization** — waited for all 14 CI checks to go green
  (Integration tests and Database migration test were still running at request time), merge commit
  `1e8f343c4779237a4fe75c3c663716877990dc20`. Both `dashboard-web` and `dashboard-api` auto-
  deployed to production on the merge (Vercel's standing auto-deploy-on-push-to-`main` behavior)
  and were **verified live directly, not just via CI's own Vercel status check** —
  `dashboard-api`'s `/health` returned `build.commitSha == 1e8f343...`/`environment ==
"production"` (proving the exact merged commit is what's serving, and that the new build-
  metadata feature itself works in production), and `dashboard-web`'s `/` correctly redirected an
  unauthenticated visitor to `/auth/sign-in` via the new `(shell)` layout's session gate (proving
  the new application shell code is genuinely live and behaviorally correct, not just deployed).
  At the time of this entry, Phase 1F's own schema migrations (`00034`/`00035`) had not yet been
  run against the real production database — **since resolved, see the next entry below.**
  Phase 1F's own real business-module endpoints, the remaining Task 7 audit scope, and any
  module-implementation wave are each separate, not-yet-requested next candidates.
- `[2026-08-14]` **Ran all pending production database migrations, surfacing and closing a
  previously-undocumented gap.** User ran `pnpm --filter @webdesk/database run migrate` themselves
  (sourcing `prod-db.env`, same credential-handling discipline as every prior production DB
  operation — Claude never saw the real `DATABASE_URL`). Output: `Applied 17 migration(s)`, naming
  all 17. Independently verified via a second, separate command (`migrate:status`, Umzug's own
  `executed()`/`pending()` read-only bookkeeping, not just the `migrate` command's own success
  message): all 35 migrations executed, 0 pending. **Only 2 of the 17 applied migrations
  (`00034`/`00035`) were the Phase 1F migrations this run was originally requested for.** The other
  15 (`00019` through `00033`) were the **entire remaining Phase 1E operational-infrastructure
  schema** — audit-schema expansion, `jobs`/`job_attempts`/`idempotency_keys`,
  `retention_policies`/`retention_holds`, `notifications`, `operational_contacts`/
  `incident_severity_policies`, `system_events`/`system_components`/`system_health_checks` — merged
  to `main` and gated (G4-1E, CONFIRM) on 2026-08-13, but **never actually applied to production
  until this run**. The last production migration before this one was `00018`
  (`create-audit-events`, run 2026-08-12); everything merged after that sat unapplied in production
  for roughly a day and a half. This was not previously flagged as a known gap — `CLAUDE.md`/
  `HANDOFF.md` stated only that "the production database has all migrations applied through Phase
  1E's `audit_events` table," which was accurate but didn't make explicit that the rest of Phase
  1E's schema was still pending. No production impact is known to have resulted: this project has
  no real user traffic yet, and none of the newly-migrated tables' endpoints had been exercised
  live. Recorded in `outputs/webdesk-growth-dashboard/project.json`'s `audit_log` (version 15 → 16).
  The production database is now fully migrated through `00035` — nothing known to be pending.

- `[2026-08-14]` **Prepared (not implemented) the Projects module task package**, per explicit
  instruction to use Phase 1F's own task-package template rather than a fresh giant prompt, and to
  "run consistency checks against the approved module roadmap/specification, and stop for human
  approval" before any code is written. Full record: `docs/task-packages/module-projects-foundation.md`.
  Pre-implementation verification (section 0) confirmed `projects` is a genuine Wave 1 module (no
  dependencies, per `docs/phase-plans/module-implementation-roadmap.md` and
  `module_registry.dependencies`), that its permission group (`project_configuration`) already has
  real seeded RBAC grants needing no new migration, and that no open Critical/High security finding
  or missing credential blocks it. It also surfaced real silences in the source docs that this
  package flags rather than resolves unilaterally: `03_Detailed_Module_Specifications.md`'s
  Projects entry is thin relative to other modules (no screens/statuses/audit events/acceptance
  criteria stated); `07_Low_Fidelity_Wireframes.md` has no Projects-specific screens at all, only
  the shell's nav item and header "Project Switcher"; `05_Workflow_State_Machines.md` defines no
  Project status lifecycle despite "pause"/"archive" being named actions; and, most notably,
  `04_Data_Model_and_Ownership.md` lists `operational_contacts` under "Projects and configuration,"
  but the actually-built table of that exact name (Phase 1E, `00027-create-operational-contacts.ts`)
  is a global, system-wide incident-escalation contact list with no `project_id` column, matching
  `09_Security_Backup_Retention_Operations.md`'s fixed "operational areas" list (which includes
  "Project Management" as one area, not a client project) — a genuine naming collision between the
  source docs and already-shipped code, flagged (design decision D1) rather than silently reused or
  reinterpreted. Eight design decisions (D1-D8) each propose a reasoned, clearly-flagged-as-unsourced
  resolution (status enum, phase/roadmap modeling, project team vs. project-scoped RBAC reuse via
  the existing `user_roles.project_id` mechanism, repository metadata scoped to reference-only with
  no live GitHub validation, retention category left unset pending confirmation, Project Switcher
  wiring explicitly deferred, no confidential fields for V1). **Implementation has not started and
  was not authorized to start** — this package is a proposal awaiting the human "looks correct"
  confirmation the authorizing instruction itself made a separate, later step from preparing the
  package.
- `[2026-08-15]` **Built the Projects module backend**, under explicit "begin implementation of the
  projects module" authorization, reinforcing three rules already in the task package: establish
  canonical project context, no multi-tenancy from the two Workspace domains, and prevent
  destructive deletion when dependent records exist. Branch `module-projects-foundation`, off
  `main` at `5722deb`/`3c73abe`. Schema: migrations `00036`-`00044` — `projects`,
  `project_environments`, `project_repositories`, `project_users`, `project_objectives`,
  `roadmap_items`, plus the FK finally completing Phase 1D-expanded's
  `user_roles.project_id`/`role_permissions.project_id` columns (their first real target, zero
  existing rows, no backfill risk). D2's status state machine (`active`/`paused`, either →
  `archived` terminal) and D3's one-active-phase-per-project invariant are both enforced —
  D3 at the database layer via a partial unique index, not just application code, matching
  ADR-0017's "enforce the real invariant at the DB layer" precedent. "Prevent destructive deletion
  when dependent records exist" is satisfied two ways: `projects` has no hard-delete endpoint at
  all (archive-only, per rule 8/ADR-0016's project-wide no-hard-delete policy), and
  `RoadmapItemsService.remove()` rejects removing a roadmap item that is currently a project's
  `active_phase_id` until reassigned or cleared — the one real dependent-record relationship this
  schema has. "No multi-tenancy" is satisfied by construction: every `projects` row belongs to the
  single WebDesk Solution tenant already recorded in `project.json.tenant.mode`; `webdesksolution.com`
  and `webdeskinc.com` users are the same tenant, never separate customer accounts, and this module
  adds no cross-tenant concept. "Canonical project context" is satisfied for the data layer (a real
  `projects` table and `GET /projects` exist for the first time) — full UI-level project-context
  propagation (the shell's Project Switcher) remains D7's deferred, separate scope.
  **A real, previously-flagged bug was found and fixed in the process**: writing this module's own
  e2e tests (a real `super_admin` session hitting a real `:projectId`-scoped route) reproduced the
  exact "dormant `Op.in: [null, projectId]` bug" the Phase 1D independent code review surfaced on
  2026-08-12 as tracked technical debt (`docs/project-state/phase-1d-approval-checklist.md`'s
  "Independent code review" section) — SQL's `IN` never matches `NULL` under three-valued logic, so
  `UserRoleRepository.findRoleIdsForUser`/`RolePermissionRepository.hasGrant`/`listGrantsForRoles`
  silently excluded every global-scope grant the instant a real `projectId` was passed, denying
  even a real Super Admin session 403 on every project-scoped route. Fixed with an explicit
  `Op.or` in all three call sites — the first production code fix this exact latent gap has ever
  received, closed now because this is the first real project-scoped route to exist.
  `RoleAssignmentService.assignRole`/`revokeRole` gained a new, trailing, backward-compatible
  optional `projectId` parameter (defaults to `null`, every existing call site untouched) so
  "define approvers" (D4) reuses the existing, already-reviewed role-assignment service — including
  its separation-of-duties check and session revocation — scoped to a real project, rather than
  writing a new authorization mechanism. `AuthzModule` now exports `RoleAssignmentService`/
  `ROLE_REPOSITORY` for that reuse. Full validation: 18 new unit tests (status transitions,
  active-phase invariant, destructive-deletion guard, approver assignment), 9 new real-database
  integration tests (including the D3 invariant and the new FK enforcement, on a real disposable
  database with all 8 new down-migrations individually verified reversible, not just the last
  one), 6 new e2e tests (401/403 paths, the real seeded-`project_configuration`-grant success path
  — no new RBAC seed migration was needed, D2's invalid-transition rejection, the
  destructive-deletion guard via real HTTP). Whole-monorepo re-validation after the fix: 312
  `dashboard-api` unit + 117 `packages/database` integration + 85 `dashboard-api` e2e tests (all
  three counts include the new Projects tests), typecheck/lint/format clean across all 9 packages,
  `pnpm audit` 0 vulnerabilities, module-registry validation unaffected (still 43 modules, 21
  permission groups). `module_registry.implementation_status` for `projects` updated to
  `in_development` (migration `00044`) — the first module ever moved off its Phase 1F seed value of
  `not_started`, deliberately not `available` since no UI exists yet and this hasn't been through
  code/security review. Committed as two commits (the RBAC fix separately from the module itself,
  for a cleaner review history), pushed, and opened as
  [PR #24](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/24) — **not
  merged, not deployed, no production migration run.** No `dashboard-web` UI exists yet — that,
  independent code review, security review, second-role human review, a gate decision, and merge
  authorization are all separate, not-yet-requested next steps.
- `[2026-08-15]` **Independent code review run against `module-projects-foundation` (explicit
  "run code review on the branch" instruction), then all 9 CONFIRMED findings fixed (explicit "fix
  the confirmed findings" instruction).** This project's own `code-review` skill ran at high
  effort (8 finder angles, 1-vote verification) and surfaced 9 CONFIRMED findings, most severe an
  **IDOR**: the five sub-resource repositories (environments, repositories, objectives, team,
  roadmap items) looked up rows by primary key alone with no `projectId` in the `WHERE` clause, so
  a user authorized on Project A could mutate or delete Project B's sub-resources by ID. Also
  found: `RoadmapItemsService.update()` spread the caller's raw patch (including `status`) into
  the repository write, letting a generic update bypass `setActivePhase()`'s active-phase-invariant
  and audit-event logic; `setActivePhase()`'s three writes were sequential and non-transactional,
  risking a partially-committed inconsistent state on failure; migration `00043` added a FK on
  `role_permissions.project_id` that the task package's own §3 scope statement never named; an
  unused `(project_id, status)` index on `roadmap_items` (no query ever filters by status) and a
  missing index on `projects.updated_at` (the real default list-sort column); duplicated
  `toJSON()`-plus-date-conversion mapping logic across all six Projects repositories; a speculative
  single-value `provider` ENUM column with no real multi-provider requirement; and dead
  `findById()`-style methods on four sub-resource repositories. All 9 fixed: added a shared
  `packages/database/src/projects/entity-mapping.ts` helper (closes the duplication finding while
  doing the IDOR-scoping edits); every sub-resource repository's `update()`/`remove()` now takes
  `(id, projectId, ...)` and scopes its `WHERE` clause accordingly, threaded through the
  corresponding `dashboard-api` services and controllers (added `@Param("projectId")` to 5
  controllers); `RoadmapItemsService.update()` now explicitly whitelists only `name`/`sequence`;
  `ProjectService.setActivePhase()` now wraps all three writes in `withTransaction()` (the
  `packages/database` helper, genuinely unused anywhere in `dashboard-api` until now); removed the
  unused index and added the missing one (migrations `00036`/`00041`); removed the `provider`
  column from migration `00038`, `entities.ts`, and `models.ts`; removed the 4 dead `findById()`
  methods. Appended a "Resolution note" to `docs/task-packages/module-projects-foundation.md`
  acknowledging the `role_permissions.project_id` FK as scope genuinely necessary for the IDOR fix
  to work correctly (not a silent scope creep), rather than editing the original scope statement.
  Full re-validation on a fresh local disposable PostgreSQL 17 database (Homebrew, not the
  project's real Neon instance): typecheck/lint/format clean across all 9 packages; 28
  `packages/database` unit + 117 `packages/database` integration + 313 `dashboard-api` unit + 85
  `dashboard-api` integration/e2e (including all 6 Projects e2e tests) + 8 `dashboard-web` unit
  tests, all passing; migration up/down round-trip clean (44 migrations); module-registry
  validation passing (43 modules, 21 permission groups); `pnpm audit` 0 vulnerabilities; secret
  scan clean (574 files). Two test-signature-mismatch fixes required along the way: the
  `roadmap-items.service.spec.ts` and `module-projects.integration.test.ts` assertions still called
  the old 2-argument repository signatures; and `project.service.spec.ts`'s two `setActivePhase()`
  tests needed a `vi.mock("@webdesk/database", ...)` stub for `withTransaction()` (it opens a real
  Sequelize connection needing `DATABASE_URL`, irrelevant to the service's own unit-tested logic).
  `ReportFindings` called again with all 9 findings marked `outcome: "fixed"`. Committed as two
  commits (`8f9e7ca` code, `5b10cfc` docs) and pushed to `module-projects-foundation`, updating
  PR #24. CI then failed on Lint/Formatting validation — a single inline `import("@webdesk/database")`
  type in the new `vi.mock()` block eslint's `consistent-type-imports` rule flagged; fixed with a
  scoped `eslint-disable-next-line` (no top-level type-only equivalent exists for that generic
  parameter) — commit `16cfd3a`, all 14 CI checks green.
- `[2026-08-15]` **"Merge PR #24" was requested directly; held per this project's standing
  discipline** (security review → second-role human review → gate decision, each separate, before
  merge — none of the three had happened yet). Asked the user directly whether to hold for those
  steps or merge now as an explicit override (Phase 1C's G4-1C pattern); the user chose to hold.
  Ran this project's own `security-review` skill against `module-projects-foundation` (fixed a
  stale local `origin/HEAD` symref pointing at `origin/master`, an unrelated diverged branch,
  before the diff base resolved correctly) — 2 CONFIRMED findings, both re-verified at 9/10
  confidence by an independent sub-agent pass before being reported: (1) **High** — `POST
/projects/:projectId/approvers` was gated only by `project_configuration:approve`, which
  `owner_growth_approver` itself holds, but minting an RBAC role grant is a `users_roles` action;
  the approved matrix (`06_Roles_and_Permissions.md §3`) deliberately withholds `users_roles:edit`
  from that role (`VM`, no `E`) — so any `owner_growth_approver` could mint unlimited co-approvers
  on any project they could approve in, a real privilege-escalation path with no other check
  catching it. (2) **Medium** — the only role-revocation route,
  `DELETE /authz/users/:userId/roles/:roleId`, always called `revokeRole()` with `projectId: null`,
  and `UserRoleRepository.revoke()` matches the exact `(userId, roleId, projectId)` triple, so a
  project-scoped grant (e.g. the one from finding 1) could never be revoked through the API — worse,
  the endpoint always reported `{ revoked: true }` regardless of whether anything was actually
  removed, so an operator revoking what they believed was an inappropriate grant would see success
  while the row silently survived. Both fixed on explicit "fix those" instruction: (1)
  `ProjectApproversService.assign()` now performs its own explicit `AuthorizationService.evaluate()`
  check for `users_roles:edit` before delegating to `RoleAssignmentService` — confirmed against the
  seeded matrix that this makes the endpoint effectively super-admin-only for now (only `super_admin`
  holds `users_roles:edit`), matching the matrix's actual intent rather than inventing a new
  restriction; (2) `RoleAssignmentService.revokeRole()` now returns whether a row was actually
  removed (`Promise<boolean>`, was `Promise<void>`), and the controller accepts an optional
  `?projectId=` query param, threading it through so a project-scoped grant can actually be reached,
  and reports the real outcome (`{ revoked: false }` when nothing matched) instead of always
  claiming success. Added a new `ProjectApproversService` unit test proving the `users_roles:edit`
  check runs before any role lookup/assignment; two new `role-assignment.controller.spec.ts` unit
  tests covering both the default-null and explicit-projectId revoke paths and both outcome values;
  and two new real-database e2e tests in `projects.e2e-spec.ts` proving, via real HTTP requests, that
  (a) an `owner_growth_approver`-only session gets a real `403` from `POST
/projects/:projectId/approvers` and (b) a super_admin-assigned project-scoped grant survives a
  revoke call missing `?projectId=` but is genuinely removed once it's supplied. Full re-validation
  on a fresh local disposable database: typecheck/lint/format clean; 315 `dashboard-api` unit + 87
  `dashboard-api` integration/e2e tests (including all 8 Projects e2e tests, up from 6) all passing.
  Not yet committed or pushed at the time this entry was written. **PR #24 remains unmerged** —
  second-role human review and a gate decision are still outstanding next steps.
- `[2026-08-15]` Both fix commits pushed (`66de25b` code, `0812896` docs); CI then failed on
  Formatting validation — `CLAUDE.md`'s own late edits hadn't been re-run through prettier before
  committing — fixed with a whitespace-only line-wrap change (`93fd424`), 14/14 CI checks green
  again. A review packet (published as a Claude artifact — code-review + security-review findings,
  fixes, and validation evidence, with a decision section) was then prepared for the required
  second-role human review, since the implementing agent cannot also be its own reviewer
  (ADR-0010) — the same pattern Phase 1E used. **Jitesh D reviewed it and returned "Approved"** —
  recorded in the new `docs/project-state/module-projects-foundation-approval-checklist.md`'s
  "Sign-off" section. This satisfies the last precondition before a gate decision can be
  requested, but is not itself a gate decision or a merge authorization — both remain separate,
  not-yet-requested steps, same discipline as every prior phase.
- `[2026-08-15]` **The gate (G4-projects) was then separately requested and approved** — WebDesk
  Solution, decision CONFIRM (clean pass, not an override, since the second-role review was
  already complete before the gate was requested), approved commit
  `46300a31ebaa69eb1cb6b848b6e218dda2f808cc` on branch `module-projects-foundation` — recorded in
  `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now `G4-projects`)
  and `docs/project-state/module-projects-foundation-approval-checklist.md`'s "Sign-off" section.
  **This gate approval does not itself authorize merging PR #24**, a production deployment, or a
  production migration run — merge remains its own separate, not-yet-requested authorization, per
  this project's standing "no auto-merge" rule (same pattern as G4-1F).
- `[2026-08-15]` **"Merge PR #24" was separately requested and executed.** Merged with a real
  merge commit (not squash/rebase) — `9ee540e67d50a471a4897d5af03cf5ccca01813f`. Both Vercel
  projects auto-deployed on push to `main` and were verified live directly, not just via CI's own
  Vercel status check — `dashboard-api`'s `/health` returned `build.commitSha ==
9ee540e67d50a471a4897d5af03cf5ccca01813f`, confirming the exact merged commit is what's serving;
  `dashboard-web`'s `/` resolves (via an intermediate `/home` hop) to `/auth/sign-in` for an
  unauthenticated visitor, confirming the session gate is intact. **The production migration was
  then requested and run** — user ran `pnpm --filter @webdesk/database run migrate` themselves, in
  their own terminal, sourcing `prod-db.env` — Claude never saw the real `DATABASE_URL`, same
  credential-handling discipline as every prior production migration. First attempt failed with
  `DATABASE_URL: Required` because the env file's variables were sourced but not exported to the
  child `pnpm`/`node` process — fixed by re-running with `set -a` before the `source` command.
  Applied the 9 pending migrations (`00036`–`00044`: `projects` and its five sub-resource tables,
  the `active_phase_id` FK, the `role_permissions.project_id`/`user_roles.project_id` scoping FK,
  and the `module_registry` status update). **Independently confirmed via a second, separate
  command** (`migrate:status`, Umzug's own read-only bookkeeping, not just the `migrate` command's
  own success message) — all 44 migrations executed, 0 pending. **The Projects module backend is
  now genuinely live in production** — code merged and deployed, schema migrated, both
  independently verified, closing out this module's full build-to-production arc in a single
  session. Remaining: no `dashboard-web` UI exists yet (D7's Project Switcher wiring remains
  separate, undesigned scope).
- `[2026-08-16]` **Built the `dashboard-web` header Project Switcher**, under the explicit "build
  the dashboard-web Project Switcher UI" instruction. Genuinely undesigned scope going in — D7
  (`docs/task-packages/module-projects-foundation.md`) and `phase-1f-application-shell.md` §2 both
  explicitly deferred it, and the only design reference anywhere in the canonical docs is a single
  wireframe label (`07_Low_Fidelity_Wireframes.md` §1: `Project Switcher`, no interaction spec).
  Built the smallest honest reading of that label: `packages/shared-types` gained `ProjectSummary`
  (this file's own header rule — "no business-module types until their owning module is actually
  authorized and implemented" — now true for Projects); `getServerSession()` now also loads
  `GET /projects` in parallel with `/me`/`/me/navigation` (degrading to an empty list on failure,
  not throwing — the switcher is header chrome, not an auth gate, unlike the other two calls);
  a new `ProjectSwitcher` client component (native `<select>`, no bespoke design — same "neutral
  foundations" precedent Phase 1F set) renders in `AppShell`'s header between the brand link and
  the header actions, matching the wireframe's left-to-right order. Selecting a project persists
  only to a new `CURRENT_PROJECT_COOKIE` (`apps/dashboard-web/lib/current-project.ts`) — no
  downstream module reads it yet; wiring a real "current project" context other modules filter by
  remains separate, undesigned scope, exactly as D7 already framed it. A real gap surfaced and was
  fixed along the way: `apps/dashboard-web/vitest.config.mts` had no `resolve.alias` for `@/*`
  (unlike `tsconfig.json`'s matching `paths` entry) — never exercised before because every prior
  `@/lib/...` import in a component was type-only and erased before Vite ever saw it; this
  component's `CURRENT_PROJECT_COOKIE` import is the first real (value) one, so the alias was added
  to `vitest.config.mts` to match. Full validation on branch `dashboard-web-project-switcher` (off
  `main` at `03787e4`): 12/12 `dashboard-web` unit tests (5 new, covering the empty state, option
  rendering with status suffixes, honoring/falling back on `initialProjectId`, and live selection),
  typecheck/lint/`next build` all clean, and the existing unauthenticated Playwright smoke suite
  (6/6) still passes. See `docs/implementation/dashboard-web-project-switcher.md` for the full
  as-built record, including what was deliberately not built (any downstream consumption of the
  selection, navigation on selection — no per-project pages exist yet, a bespoke visual design, or
  a server-side cookie write). **Not yet reviewed or merged** — pushed as its own branch; code
  review, security review, second-role human review, a gate decision, and merge authorization are
  each their own separate, not-yet-requested next step, unchanged from this project's standing
  discipline for every prior slice.
- `[2026-08-16]` **Independent code review run on `dashboard-web-project-switcher` (PR #25),
  medium effort — a small, additive UI-only slice with no new mutation surface (reuses the
  already-reviewed, already-gated `GET /projects`).** 6 findings surfaced (4 CONFIRMED, 2
  PLAUSIBLE). All 4 CONFIRMED fixed (commit `269b823`): (1) a network-level failure fetching
  `GET /projects` — not just a bad HTTP status — rejected the shared `Promise.all` inside
  `getServerSession()` and crashed the whole authenticated shell instead of just the switcher;
  fixed by extracting a `fetchProjectSummaries()` helper that never rejects; (2) `/projects`
  failures degraded silently with no logging, the same blind-spot class behind the 2026-08-12
  production incident — fixed with `console.error` on both failure paths, matching the existing
  `tryGetApiBaseUrl()` pattern; (3) the unqualified `GET /projects` call silently hit the
  backend's default 50-row page limit, which could drop real projects and misfire the switcher's
  stale-cookie fallback — fixed with `?limit=200` (the backend's actual max); (4) the Home page
  still read "the Projects module hasn't been built yet" directly beneath the new, working header
  switcher — fixed by rewording. The 2 PLAUSIBLE findings (switcher selection not re-syncing after
  mount — currently unobservable, only one page exists under the shell layout; and the `/projects`
  fetch being bundled into the session-resolution function — a documented, deliberate tradeoff)
  were left as tracked, non-blocking. Added 3 regression tests for the resilience fixes (16/16
  `dashboard-web` unit tests passing). A separate `security-review` skill run found no findings
  above the reporting threshold — the new `wds_current_project` cookie carries zero authorization
  weight (its one reader only pre-selects the UI, then the switcher re-validates against the real
  project list) and its value is always a server-generated UUID, never attacker-controlled. All 14
  CI checks passing on commit `269b823`. A review packet (published as a Claude artifact — code
  review + security review findings, fixes, and validation evidence) was prepared for the required
  second-role human review, since the implementing agent cannot also be its own reviewer
  (ADR-0010). **Jitesh D reviewed it and returned "Approved."** See
  `docs/project-state/dashboard-web-project-switcher-approval-checklist.md`'s "Sign-off" section.
  A gate decision and merge authorization remain separate, not-yet-requested next steps.
- `[2026-08-16]` **The gate (G4-project-switcher) was then separately requested and approved** —
  WebDesk Solution, decision CONFIRM (clean pass, not an override, since the second-role review was
  already complete before the gate was requested), approved commit
  `134b7fa2015fe3a58630f9718f560b865ace0794` on branch `dashboard-web-project-switcher` — recorded
  in `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
  `G4-project-switcher`) and
  `docs/project-state/dashboard-web-project-switcher-approval-checklist.md`'s "Sign-off" section.
  **This gate approval does not itself authorize merging PR #25, a production deployment, or any
  downstream "current project" context wiring** — merge remains its own separate, not-yet-requested
  authorization, per this project's standing "no auto-merge" rule (same pattern as every prior
  gate).
- `[2026-08-16]` **"Merge PR #25" was separately requested and executed.** Merged with a real merge
  commit (not squash/rebase), matching every prior merge in this project's history — merge commit
  `598f4d11c7b37626925de2d818c09cdb4948001b`. Both Vercel projects auto-deployed on push to `main`
  and were verified live directly, not just via CI's own Vercel status check —
  `dashboard-api`'s `/health` returned `build.commitSha ==
598f4d11c7b37626925de2d818c09cdb4948001b`, confirming the exact merged commit is what's serving;
  `dashboard-web`'s `/` resolves (via the intermediate `/home` hop) to `/auth/sign-in` for an
  unauthenticated visitor, confirming the session gate is intact. **The `dashboard-web` header
  Project Switcher is now genuinely live in production**, closing out this slice's full
  build-to-production arc. No downstream module reads the selected-project cookie yet — wiring a
  real "current project" context remains separate, undesigned scope, unchanged from D7.
- `[2026-08-16]` **Built the `dashboard-web` Projects list page** (`/projects`), under the explicit
  "build the Projects list page UI" instruction. Checked for a sourced design before writing any
  code: `07_Low_Fidelity_Wireframes.md` has 11 numbered screens and none is "Projects" (only the
  sidebar nav item and header "Project Switcher" label); `03_Detailed_Module_Specifications.md` §2
  names records/actions only, no screens or columns; the only prior description of a list screen
  is `module-projects-foundation.md` §8's own unapproved proposal, explicitly flagged in that
  document as "not sourced, should be confirmed or corrected." Built the smallest honest reading:
  renders exactly what `GET /projects` already returns and supports — name, status, public ID,
  updated-at, a search box, a status filter, sortable columns, and offset pagination — all via
  plain `<form method="get">` submissions and links (no client component, no JS required). Added
  `Project` to `packages/shared-types` as a second, wider projection of `ProjectEntity` alongside
  the header switcher's existing narrower `ProjectSummary` (not a replacement for it). Deliberately
  omitted "active phase" and "owner" columns from the unapproved proposal — `activePhaseId`/
  `ownerUserId` are bare foreign keys with no name-resolution endpoint, so showing them would mean
  either a raw UUID or a fabricated display name, both worse than omitting the column. A live
  dev-server check (no real backend available in this environment) surfaced a real ordering bug:
  an unauthenticated visit to `/projects` still fired the page's own `getProjects()` fetch in
  parallel with the `(shell)` layout's redirect check, logging a real (if harmless) server-side
  `ECONNREFUSED` error before the redirect won the race — fixed by adding the same defensive
  `getServerSession()` guard `home/page.tsx` already uses, confirmed clean on re-check (zero
  console/server errors). Full validation: 14 new unit tests (`parseProjectsSearchParams`,
  `buildProjectsHref`, `projectStatusBadge`, `getProjects` — 30/30 `dashboard-web` unit tests
  overall), 1 new Playwright smoke test (`/projects` redirects unauthenticated visitors, 7/7
  overall), typecheck/lint/`next build` all clean. See
  `docs/implementation/dashboard-web-projects-list.md` for the full as-built record, including what
  was deliberately not built (a project-detail page, a create/edit form, and a reusable `<Table>`
  component in `packages/ui` — judged premature for a single consumer). **Not yet reviewed or
  merged** — pushed as its own branch (`dashboard-web-projects-list`); code review, security
  review, second-role human review, a gate decision, and merge authorization are each their own
  separate, not-yet-requested next step, unchanged from this project's standing discipline.
- `[2026-08-16]` **Independent code review run on `dashboard-web-projects-list` (PR #26), medium
  effort — a single new read-only list page + lib helpers + a new shared type, no new mutation
  surface (reuses the already-reviewed, already-gated `GET /projects`).** 7 findings surfaced (6
  CONFIRMED, 1 PLAUSIBLE). The 2 highest-severity CONFIRMED findings fixed (commit `cda53bf`): (1)
  pagination dead-ended whenever the total project count was an exact multiple of the page size —
  the old "has next page" heuristic (`items.length === PROJECTS_PAGE_SIZE`) offered a phantom
  "Next" link into a guaranteed-empty page with no way back (no "Previous", no "Clear filters");
  fixed by requesting one row past the display page size and deriving `hasNextPage` from whether
  that extra row actually came back, plus a new "past the last page" empty-state branch with a
  real Previous link; (2) an overlong pasted search term crashed the whole app shell (a 400 from
  the backend's own `max(255)` validation propagated as an uncaught error to the root
  `error.tsx`) — fixed with `maxLength={255}` on the input and a matching `.slice(0, 255)` clamp in
  `parseProjectsSearchParams()` as the real defense-in-depth fix. The remaining 5 findings were
  left as tracked, non-blocking debt (an unbounded offset that can serialize as exponential
  notation on a hand-edited URL; a defensive gap in `projectStatusBadge()`'s lookup, not currently
  reachable since `status` is a real Postgres `ENUM`; two separate `GET /projects` calls per page
  view, a genuine shape mismatch with the header switcher's own bundled fetch; and two `@webdesk/ui`
  `FiltersBar`-reuse/style-duplication cleanup items). Added 2 new regression tests (33/33
  `dashboard-web` unit tests). A separate `security-review` skill run found no findings above the
  reporting threshold — every untrusted input (search/status/sortBy/sortOrder/offset) validates
  against closed enums or numeric bounds with safe fallbacks, no `dangerouslySetInnerHTML`, no
  open-redirect surface. All 14 CI checks passing on commit `cda53bf`. A review packet (published
  as a Claude artifact — code review + security review findings, fixes, and validation evidence)
  was prepared for the required second-role human review, since the implementing agent cannot also
  be its own reviewer (ADR-0010). **Jitesh D reviewed it and returned "Approved."** See
  `docs/project-state/dashboard-web-projects-list-approval-checklist.md`'s "Sign-off" section. A
  gate decision and merge authorization remain separate, not-yet-requested next steps.
- `[2026-08-16]` **The gate (G4-projects-list) was then separately requested and approved** —
  WebDesk Solution, decision CONFIRM (clean pass, not an override, since the second-role review was
  already complete before the gate was requested), approved commit
  `e14db588abca2dc89afc02f418677112c39f4045` on branch `dashboard-web-projects-list` — recorded in
  `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
  `G4-projects-list`) and
  `docs/project-state/dashboard-web-projects-list-approval-checklist.md`'s "Sign-off" section.
  **This gate approval does not itself authorize merging PR #26 or a production deployment** —
  merge remains its own separate, not-yet-requested authorization, per this project's standing
  "no auto-merge" rule (same pattern as every prior gate).
- `[2026-08-16]` **"Merge PR #26" was separately requested and executed.** Merged with a real merge
  commit (not squash/rebase), matching every prior merge in this project's history — merge commit
  `b6d0b601db1025d6c175afae4309aa406281ff39`. Both Vercel projects auto-deployed on push to `main`
  and were verified live directly, not just via CI's own Vercel status check —
  `dashboard-api`'s `/health` returned `build.commitSha ==
b6d0b601db1025d6c175afae4309aa406281ff39`, confirming the exact merged commit is what's serving;
  `dashboard-web`'s `/` resolves (via the intermediate `/home` hop) to `/auth/sign-in` for an
  unauthenticated visitor, confirming the session gate is intact. **The `dashboard-web` Projects
  list page is now genuinely live in production**, closing out this slice's full build-to-
  production arc. Backend, header switcher, and now the list page are all live — no project-detail
  page or create/edit form exists yet, both separate, not-yet-requested next steps.

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
  decision entry).
- ~~Whether the SSO login flow itself works end-to-end for a real Workspace user~~ — **resolved
  2026-08-12**. Real root cause was Express's `req.protocol` misreading "http" behind Vercel's
  proxy (no `trust proxy` set), silently corrupting the `redirect_uri` sent to Google's token
  endpoint — not any of the external-config candidates checked earlier (domain allowlist, client
  secret, redirect URI registration all turned out to be correct the whole time). See the
  dedicated "Recent decisions" entry for the full diagnosis chain. Real Google sign-in now
  completes successfully in production.
- The real emergency-administrator account list — the provisioning _mechanism_ is built
  (`apps/dashboard-api/src/auth/scripts/provision-emergency-admin.ts`), but no real accounts exist
  yet. Owner: PM/security owner.
- ~~`dashboard-web`'s real deployed origin (`WEB_APP_ORIGIN` on the `dashboard-api` side,
  CORS/CSRF allowlist)~~ — resolved 2026-08-12, user set it as a `dashboard-api` Vercel env var.
  Whether the current Vercel-assigned domain is the final one (vs. a custom domain later) is still
  an infrastructure-owner decision, but the value itself is set and live.
- ~~The real `DATABASE_URL` (Neon connection string) as a `dashboard-api` Vercel env var~~ —
  resolved 2026-08-12: user provisioned Neon via Vercel Marketplace and set `DATABASE_URL`; the
  deployed Function no longer fails at bootstrap on this. A live database _query_ succeeding is
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

- When adding a new export to `packages/database/src/index.ts` (the ESM barrel), you MUST also add
  it to `packages/database/src/index.cjs.ts` — a **separate, manually-maintained** CommonJS
  entrypoint that Vercel's Function bundler actually `require()`s in production. Missing this
  caused a full `dashboard-api` production outage on 2026-08-12 (`AuditEventRepository is not a
constructor` — the export simply didn't exist in the deployed CJS build) that no local or CI
  check caught, including a real e2e suite constructing the identical NestJS module graph — none
  of them exercise the CJS build path Vercel's bundler uses. `index.cjs.ts` deliberately omits a
  few ESM-only exports (see its own doc comment); everything else should mirror `index.ts`. Same
  applies to any other package with a dual ESM/CommonJS build (`@webdesk/configuration`,
  `@webdesk/shared-types`, `@webdesk/validation`) if they grow a similar split entrypoint — check
  before assuming a single barrel file covers both.
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
- Do NOT begin the 21 real business-module endpoints or user-management CRUD beyond role
  assignment (Task 8) without a separate, explicit go-ahead. **The general ADR-0017 audit-log
  subsystem (Task 7) — audit-foundation slice only** — is now built and validated (not merged) per
  "Start Phase 1E with the audit foundation first"; the remaining Task 7 scope (migrating existing
  `auth_events` writes into it, a query HTTP surface, the retention-deletion job itself) is still
  unauthorized. See `docs/task-packages/phase-1e-audit-foundation.md`.
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

Last touched: 2026-08-14 · by Claude (This entry closes out Phase 1F, the application-shell/
module-registry/observability body of work — canonical 43-module registry extension,
registry-driven permission-aware navigation, the `dashboard-web` authenticated application shell,
a shared design-system/UI-state foundation, an observability foundation (Sentry built and tested
but deliberately inert), automated WCAG 2.2 AA accessibility checks, staging documentation stopped
at the provisioning boundary, and planning-only module-implementation roadmap/task-package-
template artifacts. Builds zero business functionality for any of the 43 real modules. Built,
independently code-reviewed (14 findings, 9 fixed, 5 tracked as debt), security-reviewed (no
Critical/High finding), pushed to `origin`, and opened as
[PR #23](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/23). The
required second-role human review is complete (Jitesh D and Brijesh D, "Approved as-is"), **the
Phase 1F gate (G4-1F) was approved** (WebDesk Solution, clean CONFIRM, approved commit
`7d84f040bce67fa7cd1e92aa69e8512021b39b64`) — unusually, before merge, since merging is always its
own separate, explicit authorization in this project, never implied by a gate — and **PR #23 has
since been merged to `main`** (merge commit `1e8f343c4779237a4fe75c3c663716877990dc20`), under a
separate explicit "merge PR #23" authorization, after waiting for all 14 CI checks green. Both
Vercel projects auto-deployed on the merge and were independently live-verified (not just trusted
from Vercel's own status check): `dashboard-api`'s `/health` returned the exact merge commit SHA
in its `build.commitSha` field, and `dashboard-web`'s `/` correctly rendered the new `(shell)`
route group's unauthenticated sign-in redirect. See the 2026-08-14 "Recent decisions" entry for
the full arc and `docs/project-state/phase-1f-approval-checklist.md`'s "Sign-off" section for both
recorded decisions.

The previous session (2026-08-13) closed out Phase 1E — six operational-infrastructure
architecture slices (audit foundation, job architecture, notification foundation, retention
architecture, operational contacts, system events/health), merged to `main`, gated (G4-1E, clean
CONFIRM).

**Current state**: `dashboard-web` (https://webdesk-growth-dashboard-theta.vercel.app) and
`dashboard-api` (https://webdesk-growth-dashboard-7v1u-beta.vercel.app) are both live and healthy,
now serving Phase 1F's merged code (application shell, module registry, permission-aware
navigation, observability foundation) in addition to everything through Phase 1E. **The production
database now has all 35 migrations applied (run 2026-08-14)** — this run also retroactively
applied all of Phase 1E's remaining operational-infrastructure schema (`00019`–`00033`: jobs,
retention, notifications, operational contacts, system events/health), which had been merged and
gated since 2026-08-13 but never actually migrated to production until now (a previously-
undocumented gap, closed same-day, no known production impact — see the dedicated "Recent
decisions" entry). A real Super Admin (`jitesh@webdeskinc.com`) can sign in via Google Workspace
SSO successfully. Remaining open items: the real emergency-administrator account list, the
WordPress Application Password account (production/development, only staging exists), real
timezone confirmation, and — the next substantive decisions — the 21 real business-module
endpoints, the remaining Task 7 audit scope (query HTTP surface, retention-deletion job), Task 9's
real background-worker/queue wiring, or a module-implementation wave off the roadmap, each still
requiring its own explicit authorization.)

**2026-08-15 update**: the Projects module backend (branch `module-projects-foundation`, PR #24)
went through this project's own independent code review (9 CONFIRMED findings, most severe an
IDOR in the sub-resource repositories) and security review (2 CONFIRMED findings, most severe a
privilege-escalation path in the project-approver endpoint), all fixed and fully re-validated,
then the required second-role human review (Jitesh D, "Approved"), the gate (G4-projects,
CONFIRM), the merge (`9ee540e...`), and the production migration all completed the same day. See
that date's "Recent decisions" entries for the complete account. **The Projects module backend is
genuinely live in production** — no `dashboard-web` UI existed yet as of that entry.

**2026-08-16 update**: the `dashboard-web` header Project Switcher (branch
`dashboard-web-project-switcher`, [PR #25](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/25))
went through the full build-to-production arc in a single day — built, validated, independently
code-reviewed (4 CONFIRMED findings fixed), security-reviewed (0 findings), second-role human
reviewed (Jitesh D, "Approved"), gated (G4-project-switcher, WebDesk Solution, CONFIRM), merged
(`598f4d11c7b37626925de2d818c09cdb4948001b`), and verified live in production. See this date's
"Recent decisions" entries, `docs/implementation/dashboard-web-project-switcher.md`, and
`docs/project-state/dashboard-web-project-switcher-approval-checklist.md`'s "Sign-off" section.
Genuinely undesigned scope (D7), built to the smallest honest reading of the one wireframe label
that named it. No downstream module reads the selected-project cookie yet — wiring a real "current
project" context remains separate, undesigned scope.

**Same-day update**: the `dashboard-web` Projects list page (`/projects`, branch
`dashboard-web-projects-list`, [PR #26](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/26))
also went through the full build-to-production arc — built (no approved wireframe/spec exists,
confirmed before building; renders exactly what `GET /projects` returns and supports), independently
code-reviewed (medium effort — 7 findings, the 2 highest-severity CONFIRMED fixed, 5 tracked as
debt), security-reviewed (0 findings above threshold), second-role human reviewed (Jitesh D,
"Approved"), gated (G4-projects-list, WebDesk Solution, CONFIRM), merged
(`b6d0b601db1025d6c175afae4309aa406281ff39`), and verified live in production. See this date's
"Recent decisions" entries, `docs/implementation/dashboard-web-projects-list.md`, and
`docs/project-state/dashboard-web-projects-list-approval-checklist.md`'s "Sign-off" section. No
project-detail page or create/edit form exists yet — both separate, not-yet-requested next steps.
