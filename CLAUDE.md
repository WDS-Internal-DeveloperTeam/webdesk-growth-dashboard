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
  Service/SEO Library workbook, Recommended Module Roadmap — by path; the workbook is advisory only,
  never approved business truth, per WDS-014, regardless of what its own internal "Approval Status"
  column says; the Recommended Module Roadmap is recorded-for-reference only and authorizes nothing —
  see its own file for how it relates to `docs/phase-plans/module-implementation-roadmap.md`)
- `outputs/webdesk-growth-dashboard/{HANDOFF.md, project.json}`
- `docs/project-state/*` (approval checklists, validation reports, the setup-input register — by
  path per the active task) — including `docs/project-state/history/*.md`, the archived,
  full-narrative form of `CLAUDE.md`'s own "Recent decisions" entries older than ~1 week (each
  compressed entry below names its own history file; read that file only if the task needs the
  full account, never preload all of them)

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
10. **`dashboard-web` Project Detail page (`/projects/:projectId`) — built, reviewed, gated,
    merged, and live in production (2026-08-16).**
    `docs/implementation/dashboard-web-project-detail.md` records the full account. Not started
    automatically — built directly on the explicit "build the project detail page UI" instruction.
    No approved wireframe exists for this screen; the only prior description is
    `module-projects-foundation.md` §8's own unapproved proposal (header + Overview/Team/
    Environments/Repositories/Roadmap tabs), explicitly flagged there as "not sourced... should be
    confirmed or corrected." Renders the same content grouping as sections instead of client-side
    tabs (keeps the page fully server-rendered, zero client JS, consistent with the rest of the
    app) — Overview (public ID, confidentiality, active phase resolved by cross-referencing the
    project's own roadmap items, owner assigned/not-assigned, team headcount, timestamps,
    description), Roadmap, Objectives, Environments, and Repositories (linking out to GitHub).
    Deliberately does not build the header's proposed pause/archive/edit actions (matching the list
    page's own no-mutation-UI precedent) or any team-member identity list (no user-lookup endpoint
    exists to resolve a `userId` to a name — only a real headcount is shown, the same constraint
    that already shaped the list page's own "owner" column omission). The list page's rows now link
    to this page, and its own `formatTimestamp()` was promoted into the shared `lib/projects.ts` so
    both pages use the same one. Independent code review (medium effort — 7 findings, 4 CONFIRMED,
    all fixed) ran on
    [PR #27](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/27), then
    a separate security review found 1 HIGH CONFIRMED finding (a stored-XSS path via an
    unrestricted URL scheme on a rendered environment link) — also fixed. A review packet was
    published as a Claude artifact for the required second-role human review, since the
    implementing agent cannot also be its own reviewer (ADR-0010). **Jitesh D reviewed it and
    returned "Approved."** **The gate (G4-project-detail) was then separately requested and
    approved** — WebDesk Solution, decision CONFIRM. **"Merge PR #27" was then separately
    requested and executed** — merge commit `af23ba1c0172c834d2d1311666a2811397598b14`, both
    Vercel projects auto-deployed and were verified live directly: `dashboard-api`'s `/health`
    returned `build.commitSha == af23ba1c0172c834d2d1311666a2811397598b14`, and `dashboard-web`'s
    `/` resolves to `/auth/sign-in` for an unauthenticated visitor. **The Project Detail page is
    now genuinely live in production.**
11. **`dashboard-web` Create/Edit Project form — built, reviewed, gated, merged, and live in
    production (2026-08-17).** `docs/implementation/dashboard-web-project-form.md` records the full
    account.
    Not started automatically — built directly on the explicit "build the create/edit project form"
    instruction. The only prior description of this screen is `module-projects-foundation.md` §8's
    own unapproved proposal ("form (name, description); status/archival handled via the dedicated
    transition action, not this form"); built to that scope plus `confidentiality` (a real field
    with no separate transition endpoint of its own). `publicId` is create-only and shown read-only
    in the edit form, matching `updateProjectSchema`'s own contract (never regenerated once
    assigned). Deliberately excludes `ownerUserId` as a form field — no user-lookup/picker
    capability exists anywhere in this app yet, the same constraint already shaping the list and
    detail pages. The first real mutation UI in `dashboard-web`: a `"use client"` component
    submitting via a direct browser `fetch()` with `credentials: "include"`, following the one
    existing real-mutation precedent (`app/auth/emergency/page.tsx`) so `dashboard-api`'s
    `OriginCheckGuard` (Origin-header check, no CSRF token in this app) is satisfied automatically.
    The list and detail pages each gained a "New project"/"Edit" action link. Independent code
    review (8-angle finder pass, medium effort) surfaced 7 findings, all CONFIRMED — most severe:
    the session cookie's `SameSite=Strict` setting meant the browser would never attach it to this
    form's cross-site `fetch()` (`dashboard-web`/`dashboard-api` are separate `*.vercel.app`
    deployments, isolated as distinct "sites" since `vercel.app` is on the Public Suffix List), so
    every real submit would have 401'd in production — all 7 fixed, including that one, changing
    the cookie to `SameSite=None` under explicit separate user authorization (this session's own
    rules require the user to decide any security-setting change directly; `OriginCheckGuard` was
    verified applied to every mutating route across the whole API first, confirming CSRF defense
    doesn't depend on `SameSite`). A separate security review found 0 findings above threshold — the
    `SameSite=None` change and a new error-message allowlist (`lib/api-errors.ts`, limiting which
    backend exception messages reach the user) were both scrutinized directly and held up. Final
    numbers: 57/57 `dashboard-web` unit tests, 317/317 `dashboard-api` unit tests, 13/13 e2e tests,
    14/14 CI checks, all passing. A review packet was published as a Claude artifact for the
    required second-role human review, since the implementing agent cannot also be its own reviewer
    (ADR-0010). **Jitesh D reviewed it and returned "Approved."** **The gate (G4-project-form) was
    then separately requested and approved** — WebDesk Solution, decision CONFIRM. **"Merge PR #28"
    was then separately requested and executed** — merge commit
    `97c0ca59093db43406e387241d47a5f4733480af`, both Vercel projects auto-deployed and were verified
    live directly: `dashboard-api`'s `/health` returned `build.commitSha ==
97c0ca59093db43406e387241d47a5f4733480af`, and `dashboard-web`'s `/` resolves to `/auth/sign-in`
    for an unauthenticated visitor. **The Create/Edit Project form is now genuinely live in
    production.** Backend, header switcher, list page, detail page, and now the create/edit form are
    all live for the Projects module.
12. **`dashboard-web` Project Status Change / Archive actions — built, reviewed, gated, merged, and
    live in production (2026-08-17).**
    `docs/implementation/dashboard-web-project-status-actions.md` records the full account. Not
    started automatically — built directly on the explicit "build the status change and archive
    UI" instruction, closing the last named UI gap against `POST /projects/:projectId/status`
    (live on the backend since the Projects module's original build, never called from any UI
    until now). A new client island, `ProjectStatusActions`, renders inside the Project Detail
    page's header alongside the existing "Edit" link, mirroring D2's own state machine
    (`active`⇄`paused`, either → `archived` terminal) by hand — only the transitions actually valid
    from the project's current status are ever rendered, and `archived` renders no actions at all.
    Only the archive transition prompts a confirmation (`window.confirm()`) — the one transition
    the state machine can never reverse; pause/resume need none. Submits via the same direct
    browser `fetch()` + `credentials: "include"` pattern every mutation in this app already uses,
    reusing `lib/api-errors.ts`'s existing error-message allowlist rather than adding new
    error-handling code. This project's own `code-review` skill then ran (8-angle, medium effort)
    and surfaced 8 findings that survived verification — most severe a real race where buttons
    re-enabled before `router.refresh()` had actually delivered the new status, letting a rushed
    user fire a since-invalid transition. 7 of 8 were fixed: the race (via a locally-owned `status`
    state updated in the same batched render as re-enabling the buttons, instead of waiting on the
    refresh), an unguarded status-lookup crash risk, a silent network-failure catch with no
    logging, a self-contradicting doc comment on the page itself, a stale claim in
    `dashboard-web-project-detail.md` (addended, not rewritten), a duplicated `.error` CSS class
    (now shared via a new `components/error-message.module.css` both this component and
    `project-form.module.css` compose from), and a duplicated `ProjectStatus` type (now imports
    `lib/projects.ts`'s existing `ProjectStatusFilter`). The 8th — `router.refresh()` re-fetching
    the whole route (~9 requests) for a 1-field change — was recorded as accepted, tracked debt:
    fully eliminating it would mean lifting `status` into a shared client wrapper the header badge
    also reads from, a real architectural step up disproportionate to a review-fix pass. 68/68
    `dashboard-web` unit tests (11 new across the original build and the fix round) and 13/13 e2e
    tests (unchanged — no new route) passing; typecheck, lint, and `next build` all clean. A
    separate `security-review` skill run found **0 findings above threshold** — the backend
    (`OriginCheckGuard`, `PermissionGuard`, and `project.service.ts`'s own transition validation)
    was confirmed as the sole authoritative enforcement point, unaffected by this PR's client-side
    changes. A review packet (published as a Claude artifact — code review + security review
    findings, fixes, and validation evidence) was prepared for the required second-role human
    review, since the implementing agent cannot also be its own reviewer (ADR-0010). **Jitesh D
    reviewed it and returned "Approved."** **The gate (G4-project-status-actions) was then
    separately requested and approved** — WebDesk Solution, decision CONFIRM, approved commit
    `90413983591b53c1a67f61d329702344ec22e651` on branch `dashboard-web-project-status-actions` —
    see `docs/project-state/dashboard-web-project-status-actions-approval-checklist.md`'s
    "Sign-off" section and `outputs/webdesk-growth-dashboard/project.json`'s `gates[]`. **"Merge
    PR #29" was then separately requested and executed** — merge commit
    `cf507d7edc569dac4807cf456540e7412a1cfea8`, both Vercel projects auto-deployed and were
    verified live directly: `dashboard-api`'s `/health` returned `build.commitSha ==
cf507d7edc569dac4807cf456540e7412a1cfea8`, and `dashboard-web`'s `/` resolves (via the
    intermediate `/home` hop) to `/auth/sign-in` for an unauthenticated visitor. **The Project
    Status Change / Archive actions are now genuinely live in production.**
13. **Remaining Projects module gaps (2026-08-17, recorded, not started).** With backend, header
    switcher, list page, detail page, create/edit form, and status/archive actions all live, five
    genuine gaps remain: (1) owner assignment (`ownerUserId` has no UI anywhere), (2) team
    management (no UI to add/remove team members), (3) approver assignment (the backend endpoint,
    `POST /projects/:projectId/approvers`, is already built and security-reviewed, but no
    `dashboard-web` UI calls it), (4) sub-resource editing (roadmap items, objectives,
    environments, repositories are all read-only lists on the detail page — no create/edit/delete
    UI for any of them), and (5) "current project" context propagation (the header Project
    Switcher persists a cookie, per D7, but nothing downstream reads it yet — low urgency with no
    other business module yet to consume it). Gaps (1)-(3) share the same real blocker: no
    user-lookup/picker capability exists anywhere in this app yet. The user will provide a
    dashboard design prompt to address these at a later time — none of this is started or
    authorized; each remains its own separate, not-yet-requested next step. **Update
    (2026-08-17): work has begun on the shared blocker and gap (1) — see item 14.** **Update
    (2026-08-18): gaps (2) and (3) built — see item 18.** **Update (2026-08-20): gap (4)
    (sub-resource editing) built, reviewed, gated, and merged — see item 27.** **Update
    (2026-08-20): gap (5) (current-project context propagation) scoped and explicitly deferred, not
    built — see the 2026-08-20 "Recent decisions" entry below for the full reasoning.** **Update
    (2026-08-22): re-asked directly ("Start current-project context propagation"); the same
    blocker still holds (neither Business Knowledge Center nor Service Library ended up
    project-scoped — both are organization-wide), presented again (`AskUserQuestion`), and the
    user again chose to defer, recording it for later rather than building now — see the
    2026-08-22 "Recent decisions" entry.**
14. **User lookup capability + Project owner assignment — built, validated, code-reviewed,
    security-reviewed, second-role human reviewed, gated, merged, and live in production
    (2026-08-17).**
    `docs/implementation/user-lookup-and-owner-assignment.md` records the full account. Not
    started automatically — built directly on the explicit "start with the blockers" instruction
    following item 13's gap analysis. Scope was confirmed with the user first (`AskUserQuestion`),
    since a user-lookup capability sits on this project's own standing caution against
    user-management work beyond role assignment without a separate go-ahead: the user chose a
    **minimal read-only lookup** (not module #39's fuller admin surface) and **owner assignment**
    as the first feature to unblock. New backend: `GET /users` (search) and `GET /users/:userId`
    (resolve), both read-only, both gated on the existing `users_roles:view` grant, returning a
    narrowed `UserSummary` (`id`/`displayName`/`email` only). New frontend: a reusable
    `UserPicker` component (debounced search, built generic enough for team/approver assignment
    later) wired into the create/edit project form's new `owner` field — the backend schema
    already accepted `ownerUserId`; this is what finally lets a person set it. Team management and
    approver-assignment UI remain separate, not-yet-built next steps (their backends already
    existed before this branch, unaffected by the user-lookup capability change described here —
    both gaps 2/3 from item 13 still need their own frontend work, not just this shared blocker).
    **Independent code review then ran** (8-angle, medium effort) on PR #30 — 10 CONFIRMED
    findings, most severe a real data-loss bug (editing a project with a since-disabled owner
    silently cleared the owner assignment on any unrelated save) and an uncaught-throw path that
    could crash the whole edit page on a transient backend failure. 9 of 10 fixed outright
    (including a `GET /users/:userId` malformed-id 500→404 bug, an unescaped-`ILIKE`-wildcard
    match-correctness bug, a stale-search-error UI bug, a request-race condition in `UserPicker`,
    stale doc comments in `packages/shared-types`, a duplicate `UserSummary` type/mapping, and
    duplicated form CSS); the 10th (`users_roles:view` now also gating this PR's directory-search
    capability, not just role-assignment reads) was recorded as accepted, tracked debt — not
    currently exploitable (both map to the identical two-role set today), and the deeper fix means
    a new RBAC migration, its own separate authorization per this project's standing discipline.
    Final numbers: 85/85 `dashboard-web` unit tests (7 new on top of the original 13), 322/322
    `dashboard-api` unit tests (1 new), 122/122 `packages/database` integration tests (1 new),
    93/93 `dashboard-api` e2e/integration tests (1 new) all passing; typecheck/lint/`next
build`/`nest build` clean; `pnpm exec prettier --check` clean. **A separate `security-review`
    skill run then found 0 findings above threshold**, across all 5 targeted questions (permission-
    gate enforcement, `UserSummary` response-shape narrowing, the new `escapeLikePattern()`
    helper's injection-safety, user-enumeration exposure, and `ownerUserId` target-eligibility
    validation — the last flagged as pre-existing, out-of-scope context rather than a finding of
    this branch, since it predates this PR). A review packet (published as a Claude artifact — code
    review + security review findings, fixes, and validation evidence) was prepared for the
    required second-role human review, since the implementing agent cannot also be its own reviewer
    (ADR-0010). **Jitesh D reviewed it and returned "Approved."** **The gate
    (G4-user-lookup-owner-assignment) was then separately requested and approved** — WebDesk
    Solution, decision CONFIRM, approved commit `22ca2a8c1a6b4695d87e6151f443fec05f586566` on
    branch `user-lookup-owner-assignment` — see
    `docs/project-state/user-lookup-owner-assignment-approval-checklist.md`'s "Sign-off" section
    and `outputs/webdesk-growth-dashboard/project.json`'s `gates[]`. **"Merge PR #30" was then
    separately requested and executed** — merge commit
    `d9c42782db8f79207662a25ec6e558cbf4707755`, both Vercel projects auto-deployed and were
    verified live directly: `dashboard-api`'s `/health` returned `build.commitSha ==
d9c42782db8f79207662a25ec6e558cbf4707755`, and `dashboard-web`'s `/` resolves (via the
    intermediate `/home` hop) to `/auth/sign-in` for an unauthenticated visitor. **The user lookup
    capability and Project owner assignment are now genuinely live in production.** Team
    management and approver-assignment UI remain separate, not-yet-built next steps (their
    backends already existed before this branch).
15. **Projects module backend close-out — built, validated, reviewed, gated, merged, and live in
    production (2026-08-17).** `docs/implementation/module-projects-backend-closeout.md`
    records the full account. Requested directly, ahead of an upcoming dashboard design prompt
    that will drive the remaining Projects-module frontend wiring — the user wanted confidence
    that nothing was missing on the backend/API side first. A dedicated audit (read the actual
    code, not documentation) found the backend almost entirely code-complete but surfaced 3 real
    gaps and a systemic test-coverage gap. Fixed: (1) a genuinely missing capability — no endpoint
    existed to list a project's current approvers, closed with a new
    `GET /projects/:projectId/approvers`, `UserRoleRepository.findUserIdsForRoleInProject()`, and
    `AuthzModule`/`UsersModule` newly exporting `USER_ROLE_REPOSITORY`/`UsersService`; (2) known,
    previously-deferred security debt — `ProjectEnvironment.url` accepted any URL scheme,
    including `javascript:`, a stored-XSS path a 2026-08-16 security review already fixed
    client-side and explicitly flagged the backend schema as the real fix location for; now closed
    with a shared `safeHttpUrl` Zod refinement restricting to `http:`/`https:`; (3) an untested
    reliability gap — `ownerUserId` had no existence check before the database write, so a stale
    or deactivated owner id likely surfaced as an opaque 500 instead of a clean 400; now validated
    via a new `ProjectService.assertOwnerExists()`. Also closed: 4 of 6 project sub-resource
    controllers (team, environments, objectives, repositories) had zero unit test coverage, and
    the e2e suite never exercised `/update`, `/team`, `/environments`, `/objectives`,
    `/repositories`, or roadmap-items list/update — 4 new unit spec files plus 9 new e2e tests now
    cover all of it. 359/359 `dashboard-api` unit tests (37 new), 102/102 `dashboard-api`
    e2e/integration tests (9 new), 122/122 `packages/database` integration tests (unaffected,
    confirmed still green), all against a fresh local disposable database; typecheck/lint/`nest
build`/`pnpm exec prettier --check` all clean. **Update (2026-08-17): independent code review run
    and all 9 CONFIRMED/PLAUSIBLE findings fixed** (1 PLAUSIBLE finding accepted as tracked debt) —
    see `docs/implementation/module-projects-backend-closeout.md`'s "Independent code review"
    section and the 2026-08-17 "Recent decisions" entry below for the full account. **Update
    (2026-08-17): security review complete (0 findings above threshold) and required second-role
    human review complete** — Jitesh D, decision "Approved," no disputes. **The gate
    (G4-projects-backend-closeout) was then separately requested and approved** — WebDesk
    Solution, decision CONFIRM, approved commit `8a3baf0` on branch
    `module-projects-backend-closeout` — see
    `docs/project-state/module-projects-backend-closeout-approval-checklist.md`'s "Sign-off"
    section and `outputs/webdesk-growth-dashboard/project.json`'s `gates[]`. **"Merge PR #31" was
    then separately requested and executed** — merge commit
    `ca7eec0b252a8faf47e67dd4cddb7297e9fb7b88`, both Vercel projects auto-deployed and were
    verified live directly: `dashboard-api`'s `/health` returned `build.commitSha ==
ca7eec0b252a8faf47e67dd4cddb7297e9fb7b88`, and `dashboard-web`'s `/` resolves to `/auth/sign-in`
    for an unauthenticated visitor. **The Projects module backend close-out is now genuinely live
    in production.** **The production migration was then run** — user ran
    `pnpm --filter @webdesk/database run migrate` themselves (same credential-handling discipline
    as every prior production migration), applying migration `00045` (the additive
    `user_roles(role_id, project_id)` index), independently confirmed via a separate
    `migrate:status` check (45 executed, 0 pending). **The production database schema is now fully
    migrated through `00045`.**
16. **Dashboard UI/UX design system — 18-document proposal produced, direction approved, merged,
    and live in production (2026-08-17).** `docs/design/dashboard-ui/00` through `17` records the
    full package. Requested directly via a user-supplied design prompt (`design_prompt.md`),
    ahead of business-module implementation — a product-design/design-system task, explicitly not
    business-module implementation itself, per the prompt's own scope. Grounded in real research,
    not invention: three parallel research passes read `packages/ui`'s actual token/component
    source, the live `apps/dashboard-web` shell, all 7 canonical `webdesk-dashboard-documentation-v1/`
    specs (Master Spec, Module Inclusion Matrix, Detailed Module Specifications, Workflow State
    Machines, Roles and Permissions, Low-Fidelity Wireframes, Security/Backup/Retention/Operations),
    the seeded `module_registry` navigation-group data, and both module-roadmap documents. Key
    findings that shaped the package: **no WebDesk brand-identity material exists anywhere in the
    repository** (no logo, no approved color, no approved typeface); Phase 1F's existing
    `packages/ui` tokens are a solid, tested, but never-fully-wired foundation (several token
    groups — breakpoints, motion, control sizes — are defined but not yet consumed by real CSS);
    the component library is far smaller than the design prompt's own 41-component inventory (14
    components exist, roughly 30 are genuinely new); and the `libraries` navigation group holds 25
    of the 43 modules with no sub-organization, which the package addresses with a
    display-layer-only 5-cluster grouping (no data-model change). Recommended visual direction:
    **Clean Enterprise** (Direction A) as the base system — chosen because it matches the
    system's genuinely dense real content (a 16-tab Page Workspace, ~30-field Ready for Claude
    records), because it's substantially what `packages/ui`'s existing, tested tokens already are
    (refined, not discarded, per the prompt's own instruction), and because no brand exists yet to
    differentiate toward — with one scoped borrowing from a "Modern AI Operations" direction (a
    richer progress/stepper treatment) applied only to the 5 genuinely pipeline-shaped modules
    (Ready for Claude Queue, Scan Center, Change Center, Release Center, Review & Approval
    Center), not system-wide. Dark mode: recommended **not V1** (no user-need signal, no existing
    foundation, but the token architecture stays dark-mode-ready for later). Full design tokens,
    a justified component inventory, all 8 page-pattern archetypes, a canonical table/form system,
    a real-status-vocabulary-to-5-bucket mapping (every actual status name from
    `05_Workflow_State_Machines.md` and `03_Detailed_Module_Specifications.md`, not an invented
    example list), approval/Ready-for-Claude/AI-provenance UX, responsive and accessibility
    requirements, and all 15 representative screens named in the prompt were specified. **No
    prototype was built** (the prompt permits one only "if authorized," and no such authorization
    was given). **No implementation, no Phase 1F shell refactor, and no business-module work
    started** — per the prompt's own explicit stop-and-wait instruction (§33). Pushed as its own
    branch (`dashboard-ui-design-system`) and opened as
    [PR #32](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/32) for
    reviewability; the actual decision gate is
    `docs/design/dashboard-ui/17-dashboard-ui-approval-checklist.md`'s own human-decision table,
    not this project's usual code-review/security-review/QA-gate machinery — this is a
    documentation-only deliverable with no code, so those steps don't apply. **Update
    (2026-08-17): the recommended direction was reviewed and approved as-is** — WebDesk Solution,
    decision "Approve recommended direction (A, with the scoped B borrowing) as-is," no changes
    requested to any of the 18 documents. Recorded in
    `docs/design/dashboard-ui/17-dashboard-ui-approval-checklist.md`'s "Required human decision"
    section (now marked COMPLETE) and in `outputs/webdesk-growth-dashboard/project.json`'s
    `audit_log`. **This approval covers the design direction only** — implementation still
    requires a separate, not-yet-authorized Dashboard UI Foundation Alignment task package (design
    prompt §34). **"Merge PR #32" was then separately requested and executed** — merged with a
    real merge commit (not squash/rebase), matching every prior merge in this project's history —
    merge commit `800472e96a1478ff715edb00f2ad26b6fa2cd44b`, all 14 CI checks green beforehand.
    Both Vercel projects auto-deployed on push to `main` and were verified live directly:
    `dashboard-api`'s `/health` returned `build.commitSha ==
800472e96a1478ff715edb00f2ad26b6fa2cd44b`, and `dashboard-web`'s `/` resolves to `/auth/sign-in`
    for an unauthenticated visitor. **The approved dashboard UI/UX design-system documentation is
    now on `main`.** Since this PR contains only documentation (no application code), the merge
    itself changes nothing about the running application's behavior — the deployment verification
    above confirms the merge landed cleanly, not a functional change. Building the Dashboard UI
    Foundation Alignment task package remains a separate, not-yet-requested next step.
17. **Dashboard UI Foundation Alignment task package scoped (2026-08-17), then built (2026-08-17)
    under a separate explicit "Begin this work" instruction — built, fully validated, not yet
    reviewed, gated, or merged.** `docs/task-packages/dashboard-ui-foundation-alignment.md` records
    the 6-item scope (design tokens, ~30-component library, navigation/shell alignment, auth-page
    re-skin, accessibility test-coverage gap, component documentation), committed planning-only to
    `main`. Built on branch `dashboard-ui-foundation-alignment` off `main` at
    `f99f5bc88e652d01b4186dde3db38e0c7877bafc` (verified zero drift). Adds `statusBadgeTokens`/
    `contentMaxWidthWide`/`drawerWidth` to `packages/ui`'s tokens plus a new
    `apps/dashboard-web/scripts/check-css-tokens.mjs` lint check tying `@media`/transition literals
    back to `breakpointTokens`/`motionTokens`; ~30 new `packages/ui` components across 5 new files
    (`controls.tsx`, `structural.tsx`, `overlay.tsx`, `feedback.tsx`, `domain.tsx`, 79 new unit
    tests, plus a new `packages/ui/README.md` reference — no Storybook); the application shell's
    desktop sidebar collapse toggle, 5-cluster `libraries` navigation sub-grouping (derived from
    each module's existing seeded `navigationOrder`, no schema change), tablet-range icon-only
    behavior, and header additions (user-menu dropdown, help icon, environment/degraded-system-
    status badges sourced from `/health`, a module-only `⌘K` search over the caller's own
    navigation list, and a notifications drawer that honestly shows "not configured yet" rather
    than fake data — the real `GET /notifications` endpoint is confirmed zero-seeded and has no
    per-caller filter, so wiring it as a real inbox is separate, not-yet-authorized scope); all 6
    pre-`packages/ui` auth pages (`sign-in`, `error`, `logout`, `session-expired`, `emergency`,
    `emergency/totp`) re-skinned to the token system with zero change to auth flow/fields/logic,
    closing the `#b00020` vs. `colorTokens.danger` drift the design system's own gap analysis
    flagged; and a test-only, security-scrutinized authenticated-session fixture
    (`apps/dashboard-web/lib/e2e-test-session.ts`, gated on **both**
    `process.env.NODE_ENV !== "production"` — true for every real Vercel deployment regardless of
    what this app configures, since `next build`/`next start` always run under `NODE_ENV=production`
    — **and** an explicit `PLAYWRIGHT_E2E_TEST_MODE` flag set only in `playwright.config.ts`'s own
    `webServer.env`) that finally gives the automated WCAG 2.2 AA suite real coverage of the
    authenticated shell, previously zero since Phase 1C's SSO-only session model means Playwright
    can never complete a real login in CI. **That new coverage immediately caught and fixed 3 real,
    pre-existing WCAG AA contrast violations** — none introduced by this task's own new component
    code — in `app/(shell)/home/page.tsx` (a hardcoded `#94a3b8` literal, 2.56:1), 4 status-badge
    color pairs in `packages/ui/src/components/states.tsx` (`danger`/`warning`/`info` on their
    respective surfaces, 3.07–4.41:1), and the sidebar's `.navGroupLabel`/`.clusterLabel`
    (`foreground-subtle`, 2.45:1) — all fixed using already-token-driven, already-WCAG-verified
    replacement values (the new `statusBadgeTokens` bucket text colors, and `foreground-muted`).
    Full validation: 79/79 `packages/ui` unit tests, 103/103 `dashboard-web` unit tests, 15/15
    Playwright tests (including the 2 new authenticated-shell a11y checks), typecheck/lint/
    `next build`/`pnpm exec prettier --check` all clean across both packages; only
    `apps/dashboard-web` and `packages/ui` files touched — zero `dashboard-api`/`packages/database`
    changes (the task package's own two narrow backend-touch exceptions were never needed). Manual
    contrast verification of the new `statusBadgeTokens` palette itself: all 5 buckets computed
    directly against the WCAG 2.1 relative-luminance formula, ranging 6.81:1–9.45:1, comfortably
    over the 4.5:1 minimum. See `docs/implementation/dashboard-ui-foundation-alignment.md` for the
    full as-built record. Pushed as its own branch; opened as
    [PR #33](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/33) for
    reviewability, matching this project's standing pattern. **Update (2026-08-18): independent
    code review run** (high effort, 8 finder angles) — 10 findings surfaced (8 CONFIRMED, 2
    PLAUSIBLE). Most severe: the tablet (`768px`–`1023.98px`) and mobile (`max-width: 768px`) shell
    breakpoints overlapped at exactly 768px, a real device width, letting the mobile off-canvas CSS
    and the JS icon-only tablet state both apply at once — which also required fixing
    `check-css-tokens.mjs` itself, since its regex never matched decimal breakpoints and only
    validated one clause per compound `@media` query, so it silently passed the violating value.
    All 8 CONFIRMED findings fixed and re-validated per explicit "fix the confirmed findings"
    instruction (also: a dialog focus-trap effect re-running on unrelated re-renders due to
    `onClose` identity churn; `ApprovalBlock`'s Reject/Request Revision modals leaking a shared
    reason textarea; the a11y spec hardcoding a duplicate copy of the e2e session cookie constants;
    `Progress` rendering `"NaN%"` at `max=0`; a duplicated `initialsFor()` helper; and two
    independently-maintained test-fixture default shapes that had already drifted). The 2 PLAUSIBLE
    findings (the header "Sign out" menu item lacking a real `href`; the new `Badge` structurally
    near-duplicating the pre-existing `StatusBadge`) were left unaddressed, scope being literal.
    Re-validated: 79/79 `packages/ui` + 103/103 `dashboard-web` unit tests, 15/15 Playwright tests,
    typecheck/lint/build/prettier all clean. **A separate `security-review` skill run then found 0
    findings above threshold** — focused on `lib/e2e-test-session.ts` (the new test-only
    authenticated-session bypass for Playwright's a11y suite), confirming both its gates are
    structurally sound (`NODE_ENV !== "production"` is fixed Next.js/Vercel behavior, not
    app-configurable) and traced to have no header/query-param path around them; two candidates
    (the unused `FileAttachment` component's missing URL-scheme guard, and the bypass's
    partly-environment-variable-dependent gating) were considered and excluded at confidence
    3/10 and 2/10 respectively. A review packet (published as a Claude artifact — code review +
    security review findings, fixes, and validation evidence, with a decision section) was prepared
    for the required second-role human review, since the implementing agent cannot also be its own
    reviewer (ADR-0010). **Jitesh D reviewed it and returned "Approved as-is"** (2026-08-18),
    accepting the 2 open PLAUSIBLE findings as tracked debt rather than requesting fixes — see
    `docs/project-state/dashboard-ui-foundation-alignment-approval-checklist.md`'s "Sign-off"
    section. **The gate (G4-dashboard-ui-foundation-alignment) was then separately requested and
    approved** — WebDesk Solution, decision CONFIRM (clean pass, not an override, since the
    second-role review was already complete before the gate was requested), approved commit
    `4a256c74735b4c819e62d8e00cac16ff3e762782` on branch `dashboard-ui-foundation-alignment` — see
    `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
    `G4-dashboard-ui-foundation-alignment`) and the approval checklist's "Sign-off" section.
    **"Merge PR #33" was then separately requested and executed** — merge commit
    `77c95ced4f18a9f63031321b17f80081d6627bcc`, all 14 CI checks (including both Vercel
    preview-deployment checks) green beforehand. Both Vercel projects auto-deployed on push to
    `main` and were verified live directly, not just via CI's own Vercel status check —
    `dashboard-api`'s `/health` returned `build.commitSha ==
77c95ced4f18a9f63031321b17f80081d6627bcc`, and `dashboard-web`'s `/` resolves (via the
    intermediate `/home` hop) to `/auth/sign-in` for an unauthenticated visitor. **The Dashboard UI
    Foundation Alignment slice is now genuinely live in production.** No business-module
    implementation work starts automatically once this lands.
18. **`dashboard-web` Team management + Approver assignment UI — built, fully validated,
    code-reviewed, security-reviewed, second-role human reviewed (Jitesh D, Approved), gated, and
    merged; now live in production (2026-08-18).** Closes gaps (2) and (3) from item 13's remaining
    Projects module gap analysis. Not started automatically — built directly on the user's
    explicit choice ("Team + Approver UI first") among 4 scoping options presented for this work.
    Both backends (team roster CRUD, approver list/assign/revoke) already existed, already
    reviewed and gated under `module-projects-foundation`/`module-projects-backend-closeout` —
    this slice is `dashboard-web` UI only. Widens `ProjectTeamEntry`
    (`packages/shared-types`) to carry `userId`/`addedAt` so roster entries resolve to real
    identities via the existing `GET /users/:userId` endpoint (new `getUsersByIds()`, parallel
    resolution, drops unresolvable ids instead of throwing). `getProjectDetail()` now returns a
    resolved team list and the real approvers list, degrading `approvers` to `null` on a 403
    rather than throwing (most roles lack `users_roles:view`, the permission `GET
.../approvers` itself requires). New `lib/roles.ts#getApproverRoleId()` resolves the seeded
    `owner_growth_approver` role's id, needed since approver revocation reuses the general
    role-assignment `DELETE` endpoint (no approver-specific revoke route exists). New
    `ProjectTeamSection`/`ProjectApproversSection` client components reuse the existing
    `UserPicker` and this app's established direct-`fetch()` mutation pattern. A real
    cross-boundary bug was found and fixed along the way: the team section needed
    `formatTimestamp()` as a real (not type-only) import from `lib/projects.ts`, which pulls in
    `next/headers` and breaks the client bundle — extracted into a new zero-dependency
    `lib/format-timestamp.ts` that `lib/projects.ts` re-exports. 123/123 `dashboard-web` unit
    tests (18 new), 15/15 Playwright tests, typecheck/lint/`next build`/prettier all clean across
    `packages/shared-types` and `dashboard-web`. See
    `docs/implementation/dashboard-web-team-approver-management.md` for the full as-built record.
    Pushed as its own branch (`dashboard-web-team-approver-management`); opened as
    [PR #34](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/34) for
    reviewability. **Independent code review then ran** (8-angle finder pass, high effort) — 10
    findings surfaced, all CONFIRMED. 9 fixed per explicit "fix the confirmed findings"
    instruction (most severe: `getProjectDetail()` had no try/catch around team-identity
    resolution, so a single 403 from `GET /users/:userId` crashed the whole page — fixed by
    switching `getUsersByIds()` to `Promise.allSettled`; also fixed: an approver-revoke handler
    that ignored a `revoked: false` backend response, the Team section's `UserPicker` being
    offered to viewers who'd 403 on it, a shared `pendingRemoveId` racing across concurrent row
    removals, silent 403/5xx swallowing in `lib/roles.ts`, both roster components never
    resyncing local state after `router.refresh()`, a duplicated primary-button CSS block, an
    unconditional approver-role-id fetch even when unused, and team-identity resolution
    serialized behind unrelated fetches). The 10th (`getUsersByIds()` using N parallel requests
    instead of the backend's existing `findByIds()` batch endpoint) was recorded as accepted,
    out-of-scope debt — fixing it means adding new `dashboard-api` code, out of scope for a
    branch declared `dashboard-web` UI only. 128/128 `dashboard-web` unit tests (7 new),
    typecheck/lint/`next build`/prettier all re-verified clean. **A separate `security-review`
    skill run then found 0 findings above threshold** — confirmed no XSS surface (React-escaped
    JSX only), no path-traversal-relevant input in fetch-URL interpolations (all backend-sourced
    UUIDs), the backend's `PermissionGuard`/`OriginCheckGuard` as the sole enforcement point (the
    new `canSearchUsers` prop only toggles UI visibility, never enforcement), and no PII/secret
    exposure in the new log lines. A review packet (published as a Claude artifact — code review
    - security review findings, fixes, and validation evidence, with a decision section) was
      prepared for the required second-role human review, since the implementing agent cannot also
      be its own reviewer (ADR-0010). **Jitesh D reviewed it and returned "Approved"** — see
      `docs/project-state/dashboard-web-team-approver-management-approval-checklist.md`'s
      "Sign-off" section. **The gate (G4-team-approver-management) was then separately requested
      and approved** — WebDesk Solution, decision CONFIRM, approved commit
      `91a0a160559d2998e508130fc9a88a51222a7175` on branch
      `dashboard-web-team-approver-management` — see
      `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` and the approval checklist's
      "Sign-off" section. **"Merge PR #34" was then separately requested and executed** — merged
      with a real merge commit (not squash/rebase), matching every prior merge in this project's
      history — merge commit `4f6814ec9b585bf01c3c9a37c165b828d3ed5d2d`. **Unlike every prior
      merge in this project's history, this one did not wait for a fully green CI run first**: the
      "Integration tests" job hung twice in a row on the same step (`dashboard-web Playwright
browsers`, an infra-level browser download) for 40+ minutes each time, while every other
      check — typecheck, lint, unit tests, production build, database migration test,
      secret-pattern scan, dependency audit, formatting — passed cleanly both times, and the only
      commits since the last fully-green run were documentation/`project.json`-only (no
      application code touched). The user explicitly instructed "skip the CI as it is wasting time
      again"; `main` has no branch-protection rule requiring status checks, so nothing technically
      blocked the merge either way. Both Vercel projects auto-deployed on push to `main` and were
      verified live directly, not just via CI's own Vercel status check — `dashboard-api`'s
      `/health` returned `build.commitSha == 4f6814ec9b585bf01c3c9a37c165b828d3ed5d2d`, confirming
      the exact merged commit is what's serving; `dashboard-web`'s `/` resolves (via the
      intermediate `/home` hop) to `/auth/sign-in` for an unauthenticated visitor, confirming the
      session gate is intact. **The Team management + Approver assignment UI is now genuinely live
      in production.** Gaps (4) sub-resource editing and (5) current-project context propagation
      remain not started.
19. **Cross-domain session-exchange fix for Google SSO login — built, fully validated, not yet
    reviewed, gated, or merged (2026-08-18).** `docs/implementation/session-exchange.md` records
    the full account. Not started automatically — the user reported that signing in with Google
    appeared to work at Google's consent screen but then looped back to the sign-in page instead
    of reaching the authenticated app; diagnosed directly by reading
    `apps/dashboard-api/src/auth/session/cookie.util.ts` and
    `apps/dashboard-web/lib/server-session.ts`, then the fix was implemented under the user's
    explicit "yes please" authorization. Real root cause: `dashboard-api`'s Google OIDC callback
    set its session cookie and redirected straight to `WEB_APP_ORIGIN`'s root, but that cookie is
    host-only to `dashboard-api`'s own `*.vercel.app` domain (no `Domain` attribute, no shared
    parent domain with `dashboard-web`'s separate `*.vercel.app` project) — it was never actually
    sent on the browser's subsequent navigation to `dashboard-web`, so every login silently landed
    the visitor back at `/auth/sign-in`. **Not a `SameSite` bug** — `SameSite=None` is already
    correct for the genuinely cross-site requests this app makes _to_ `dashboard-api`; the broken
    case is the browser's own top-level navigation _away from_ `dashboard-api`, which that cookie
    could never reach regardless of `SameSite`. Went undetected since the authenticated shell was
    built (Phase 1F, 2026-08-14) because every prior "verified live" deployment check only tested
    the _unauthenticated_ redirect, and the Playwright a11y suite uses a test-only session bypass
    specifically because a real SSO login can't run in CI — so the real cross-domain cookie path
    was never actually exercised by any check, human or automated, until now. Fixed with a new
    session-exchange mechanism: the Google callback now mints a short-lived (60s), single-use,
    opaque exchange code (migration `00046`, `session_exchange_codes`, hashed like the existing
    session token, atomic conditional-`UPDATE` redemption mirroring
    `IdempotencyKeyRepository.reserve()`) and redirects to a new `dashboard-web` Route Handler
    (`app/auth/exchange/route.ts`, the first one in this app), which redeems it server-to-server
    against a new `POST /auth/exchange` endpoint and sets `dashboard-web`'s own first-party
    `wds_session` cookie. `SessionExchangeService#redeem()` deliberately mints a **second,
    independent session** via the existing `SessionService.issue()` rather than relaying the
    original raw token (which is never persisted anywhere to relay in the first place).
    `dashboard-api`'s own session cookie is unchanged — still needed for direct browser-mediated
    mutation fetches. A related, explicitly out-of-scope gap was found and flagged, not fixed: the
    emergency-admin TOTP page has the identical underlying bug via a different mechanism (a
    client-side `fetch` + `router.push`, not a server redirect) — recorded as a known adjacent gap
    for a separate, not-yet-authorized fix. Full validation: 6 new `dashboard-api` unit tests
    (`session-exchange.service.spec.ts`), 5 new `packages/database` integration tests (real
    disposable database — create/redeem, single-use enforcement, expiry enforcement, migration
    up/down round-trip), 5 new `dashboard-api` e2e tests (real disposable database — a redeemed
    code mints a genuinely independent working session verified via a separate `supertest` agent,
    single-use enforcement over real HTTP, a successful-callback redirect-through-`/auth/exchange`
    regression test), 6 new `dashboard-web` unit tests (the route handler's every branch) — 369/369
    `dashboard-api` unit tests, 140/140 `dashboard-web` unit tests, all passing; typecheck/lint/
    `next build`/`nest build`/`pnpm exec prettier --check` all clean across `packages/database`,
    `packages/shared-types`, `apps/dashboard-api`, and `apps/dashboard-web`. Built on branch
    `fix-cross-domain-session-exchange`, off `main` at `32e5bba` (the PR #34 merge commit). Pushed
    and opened as
    [PR #35](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/35).
    **Update (2026-08-18): independent code review complete, 9 of 10 CONFIRMED findings fixed.**
    High effort (8 finder angles, 1-vote verification) — 11 candidates surfaced, all verified
    (10 CONFIRMED, 1 PLAUSIBLE, 0 refuted). Most severe: splitting one login into two independent
    sessions meant "Sign out" only ever revoked the rarely-used `dashboard-api`-side session, never
    the `dashboard-web`-side one `getServerSession()` actually authenticates every page against —
    fixed with a new `DELETE /auth/session` route in `dashboard-web` that forwards the whole
    incoming `Cookie` header (not a name-keyed lookup) to `dashboard-api`'s `/auth/logout` with an
    explicit `Origin` header, called alongside the existing dashboard-api logout call. Also fixed:
    an unguarded exchange-code `issue()` call that could leak a raw `500` with a session cookie
    already staged; the actively-used session being stamped with the server-to-server exchange
    call's own `ipHash`/`userAgent` instead of the real browser's (migration `00046` amended,
    not superseded, since it hadn't shipped anywhere yet — new `ip_hash`/`user_agent` columns);
    a missing `auth_events` record for the session actually in use (new `session_exchange_redeemed`
    vocabulary entry); an unguarded `response.json()` in the exchange route; the cookie name
    `dashboard-web` writes under being a separately-hardcoded constant kept in sync with
    `dashboard-api`'s own env var purely by convention (now echoed back in `POST /auth/exchange`'s
    response instead); a hardcoded `secure: true` with no local-dev override; a 4x-duplicated
    redirect-to-error literal; and an extra DB round-trip in `redeem()` (now uses Sequelize's
    `returning: true`). **One finding left as accepted, tracked debt, flagged explicitly for the
    second-role reviewer**: `POST /auth/exchange` has no `OriginCheckGuard`/shared secret beyond
    the code's own entropy/single-use/60s TTL, and the code traverses a real, Vercel-logged URL on
    every login — closing it properly means a materially bigger architectural change (a POST-based
    redirect flow) for a narrow (~60s, single-use) exploit window. Re-validated: 370/370
    `dashboard-api` unit tests, 143/143 `dashboard-web` unit tests, new integration/e2e coverage
    for every fix, typecheck/lint/build/prettier all clean. See
    `docs/implementation/session-exchange.md` §5 for the full account. **Update (2026-08-18):
    security review complete (0 findings above threshold) and required second-role human review
    complete** — Jitesh D, decision "Approved as-is," accepting the `POST /auth/exchange`
    origin-guard gap as tracked debt. See
    `docs/project-state/fix-cross-domain-session-exchange-approval-checklist.md`'s "Sign-off"
    section. **The gate (G4-session-exchange) was then separately requested and approved** —
    WebDesk Solution, decision CONFIRM (clean pass, not an override, since the second-role review
    was already complete before the gate was requested), approved commit
    `1cd89adf973cd13f499170a79ba8601e0a9a56cb` on branch `fix-cross-domain-session-exchange` — see
    `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
    `G4-session-exchange`) and the approval checklist's "Sign-off" section. **"Merge PR #35" was
    then separately requested and executed** — merged with a real merge commit (not squash/
    rebase), matching every prior merge in this project's history — merge commit
    `2c53a526fc61e91c13b0a385ef9d895adc948896`. Both Vercel projects auto-deployed on push to
    `main` and were verified live directly, not just via CI's own Vercel status check —
    `dashboard-api`'s `/health` returned `build.commitSha ==
2c53a526fc61e91c13b0a385ef9d895adc948896`, confirming the exact merged commit is what's serving;
    `dashboard-web`'s `/` resolves (via the intermediate `/home` hop) to `/auth/sign-in` for an
    unauthenticated visitor, confirming the session gate is intact. Migration `00046`
    (`session_exchange_codes`) was then run against production (user ran it themselves, same
    credential-handling discipline as every prior production migration). **The real Google SSO
    login was then verified end-to-end in production and completed successfully** — closing the
    exact bug this slice was built to fix. One real incident occurred along the way, diagnosed and
    resolved same-day: see the 2026-08-19 "Recent decisions" entry below. **The cross-domain
    session-exchange fix for Google SSO login is now genuinely live and working in production.**
20. **`/auth/exchange` error-masking fix — built, fully validated, code-reviewed, security-reviewed,
    second-role human reviewed, gated, merged, and live in production (2026-08-19).**
    `docs/implementation/session-exchange.md` §7 records the full account.
    Not started automatically — built directly on the explicit "fix the /auth/exchange error
    masking" instruction, following item 19's incident diagnosis, which surfaced that every
    failure path in the session-exchange flow (both `GoogleAuthController#callback`'s
    `sessionExchange.issue()` catch block in `dashboard-api` and `dashboard-web`'s `/auth/exchange`
    route's `redirectToAuthError()` helper) redirected to `/auth/error?reason=expired` regardless
    of the real failure class — a genuine backend 500 showed the identical message as an
    actually-expired code, which is exactly what made that incident briefly ambiguous. Fixed by
    splitting the reason taxonomy into `expired` (a missing OIDC transaction cookie, a missing
    exchange-code param, or the backend's genuine `400` "invalid/expired code" response — all
    unchanged) and a new `error` value (everything else: `issue()` failures, misconfigured
    `NEXT_PUBLIC_API_BASE_URL`, network failures, unexpected non-2xx statuses, malformed response
    bodies). `apps/dashboard-web/app/auth/error/page.tsx`'s `REASON_MESSAGES` gained an explicit
    `error` entry rather than relying on the unrecognized-reason fallback. Diagnostics-only — no
    change to `dashboard-api`'s session cookie, `SameSite`, `OriginCheckGuard`, or what actually
    succeeds/fails, only which message the user sees and what gets logged. Updated the one existing
    test whose expectation this changed (`google-auth.controller.e2e-spec.ts`'s `issue()`-failure
    regression test, now asserting `reason=error`) and 3 of the `dashboard-web`
    `auth-exchange-route.test.tsx` cases (misconfiguration/network-failure/non-400-status/
    malformed-body, all now asserting `reason=error`); left the missing-code and genuine-400 cases
    unchanged. Validated: 370/370 `dashboard-api` unit tests, 111/111 `dashboard-api` e2e tests
    (real disposable local Postgres, `DATABASE_SSL=false`), 143/143 `dashboard-web` unit tests,
    typecheck/lint/`next build`/`nest build`/`pnpm exec prettier --check` all clean. Pushed as
    branch `fix-auth-exchange-error-masking`, opened as
    [PR #36](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/36).
    **Independent code review then ran** (high effort, 8 finder angles) — 7 candidates verified
    individually (1 CONFIRMED, 5 PLAUSIBLE, 1 REFUTED and dropped — dated inline-comment style
    matching an already-established local convention, not a real deviation). The CONFIRMED
    finding (`REASON_MESSAGES.error` duplicating `DEFAULT_MESSAGE` as a separate literal) was
    fixed and re-validated; the 5 PLAUSIBLE findings (shared-type duplication across apps, a
    sibling OIDC-cookie branch still masking non-expiry failures, an unguarded `body.data`
    destructure on future API-contract drift, the `error` bucket still not finely diagnosable,
    and an undocumented 400-means-expired assumption) were left open, not silently dropped. **A
    separate `security-review` skill run found 0 findings above threshold** — confirmed
    diagnostics-only, no attacker-controlled value flows into the redirect target or the rendered
    message. A review packet (published as a Claude artifact — code review + security review
    findings, the one fix, and the 5 open items, with an explicit decision section) was prepared
    for the required second-role human review, since the implementing agent cannot also be its
    own reviewer (ADR-0010). **Jitesh D reviewed it and returned "Approved as-is,"** accepting all
    5 open findings as tracked debt rather than requesting fixes before merge — see
    `docs/project-state/fix-auth-exchange-error-masking-approval-checklist.md`'s "Sign-off"
    section. **The gate (G4-error-masking-fix) and "Merge PR #36" were then each separately
    requested and completed** — see the dedicated 2026-08-19 "Recent decisions" entries below for
    both. **This slice is now genuinely live in production.**
21. **`AuthErrorReason` shared-type fix — built, fully validated, code-reviewed,
    security-reviewed, second-role human reviewed, gated, merged, and live in production
    (2026-08-19).** Closes one of item 20's 5 accepted-debt findings. Not started
    automatically — built directly on the explicit "fix the shared-type duplication finding"
    instruction. The `reason` taxonomy for `/auth/error` (`expired`/`access_denied`/`error`) was
    previously declared independently in `dashboard-api` (bare untyped strings) and
    `dashboard-web` (a local type) with nothing tying the two apps together — exactly the drift
    risk that let a real backend error get mislabeled `expired` during the 2026-08-19 incident
    item 19 fixed. Promoted a single `AuthErrorReason` type into `packages/shared-types`,
    matching the existing `AuthMethod`/`HealthStatus`/`SessionRevocationReason` precedent.
    `GoogleAuthController` now routes all three redirects through a typed
    `redirectToAuthError()` helper; `dashboard-web`'s `/auth/exchange` route imports the shared
    type instead of a local copy; `/auth/error`'s `REASON_MESSAGES` is now typed
    `Record<AuthErrorReason, string>` via a new `isKnownReason()` guard, so the file won't
    compile if a reason is ever added without a matching message. No behavior change for any
    real request — type-safety-only refactor. See `docs/implementation/session-exchange.md` §8.
    Validated: 370/370 `dashboard-api` unit tests, 111/111 `dashboard-api` e2e tests (real
    disposable database), 143/143 `dashboard-web` unit tests, `dashboard-worker` typecheck
    (unaffected), typecheck/lint/`next build`/`nest build`/`pnpm exec prettier --check` all
    clean. Pushed as branch `fix-auth-error-reason-shared-type`, opened as
    [PR #37](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/37).
    **Independent code review then ran** (high effort, 8 finder angles) — 7 candidates verified
    individually (2 CONFIRMED, 3 PLAUSIBLE, 2 REFUTED). Both CONFIRMED findings fixed: the new
    `isKnownReason()` guard used the `in` operator, which walks the prototype chain, so
    `?reason=constructor` on the public, unauthenticated `/auth/error` page resolved to a function
    value and crashed the page render — fixed with `Object.hasOwn()`; and the unrecognized-reason
    fallback logged nothing, undercutting the fix's own goal of catching cross-deploy drift between
    `dashboard-api` and `dashboard-web`'s independent Vercel deploys — fixed with a `console.error`
    on that path only. The 3 PLAUSIBLE findings (a narrow `reason=""` behavior change reachable
    only via a hand-typed URL, a `redirectToAuthError` name collision across the two apps with
    different signatures, and the incident narrative restated across all 4 changed files' doc
    comments) were left open, not silently dropped. Added
    `apps/dashboard-web/tests/unit/auth-error-page.test.tsx` (6 new tests) covering both fixes
    directly. Re-validated: 149/149 `dashboard-web` unit tests, typecheck/lint/`next build`/
    `pnpm exec prettier --check` all clean. See `docs/implementation/session-exchange.md` §8a for
    the full account. **A separate `security-review` skill run then found 0 findings above
    threshold** — the one candidate (the new `console.error` logging the raw, attacker-controlled
    `reason` value) was filtered out at confidence 1/10 under the standing "log spoofing is not a
    vulnerability" exclusion; the producing side of every redirect still only ever passes a fixed,
    typed literal, and the rendering side never outputs raw `reason`, only a fixed message via
    React JSX. A review packet (published as a Claude artifact — code review + security review
    findings, fixes, and the 3 open items, with an explicit decision section) was prepared for the
    required second-role human review, since the implementing agent cannot also be its own
    reviewer (ADR-0010). **Jitesh D reviewed it and returned "Approved as-is,"** accepting all 3
    open findings as tracked debt rather than requesting fixes — see
    `docs/project-state/fix-auth-error-reason-shared-type-approval-checklist.md`'s "Sign-off"
    section. **The gate (G4-shared-type-fix) was then separately requested and approved** —
    WebDesk Solution, decision CONFIRM (clean pass, not an override, since the second-role review
    was already complete before the gate was requested), approved commit
    `b9cae0f8f645640f1aead0d39f219e851fe71a02` on branch `fix-auth-error-reason-shared-type` — see
    `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
    `G4-shared-type-fix`) and the approval checklist's "Sign-off" section. **"Merge PR #37" was
    then separately requested and executed** — merged with a real merge commit (not squash/
    rebase), matching every prior merge in this project's history — merge commit
    `013c620ce55172741daac7a82553fc8933758726`, all 14 CI checks green beforehand. Both Vercel
    projects auto-deployed on push to `main` and were verified live directly, not just via CI's
    own Vercel status check — `dashboard-api`'s `/health` returned `build.commitSha ==
013c620ce55172741daac7a82553fc8933758726`, confirming the exact merged commit is what's serving;
    `dashboard-web`'s `/` resolves (via the intermediate `/home` hop) to `/auth/sign-in` for an
    unauthenticated visitor, confirming the session gate is intact. **The `AuthErrorReason`
    shared-type fix is now genuinely live in production.**
22. **Remaining PR #36 accepted-debt items closed in one consolidated batch — built, fully
    validated, code-reviewed, not yet security-reviewed, gated, or merged (2026-08-19).** Not
    started automatically —
    built directly on the explicit "fix the sibling OIDC-cookie branch... and if anything
    remaining then please do it all together" instruction: rather than repeating the full
    code-review → security-review → second-role-review → gate → merge cycle once per item, every
    remaining open item from PR #36's and PR #37's own accepted-debt lists was checked and, where
    real, fixed together in a single branch. Two real bugs fixed: (1) the sibling of the
    `sessionExchange.issue()` masking bug — `GoogleAuthController#callback`'s `if (!transaction)`
    branch collapsed "no OIDC transaction cookie sent" (genuinely expired) and "cookie sent but
    malformed/invalid" (a real anomaly) into the identical `reason=expired` redirect with zero
    logging for the malformed case; fixed by widening `readOidcTransactionCookie`'s return type
    to a discriminated `OidcTransactionReadResult`, so only the genuinely-missing case stays
    `reason=expired`/unlogged and the malformed case now logs and redirects `reason=error`. (2) An
    unguarded `body.data` destructure in `dashboard-web`'s `/auth/exchange` route that would throw
    an uncaught exception instead of a clean error redirect if `dashboard-api` ever returned a
    differently-shaped 200; fixed with a new `isSessionExchangeSuccessBody()` type guard. Two more
    items were reviewed and closed without a code change: the "400 always means expired"
    assumption is now documented directly as a code comment recording its fragility bound (only
    holds because the exchange-code DTO is a single required field today), and the `reason=error`
    bucket's single generic user-facing message was confirmed already diagnosable operator-side
    via each cause's own distinct server-side log line. PR #37's own 3 open accepted-debt items
    were also re-checked and confirmed as genuinely not needing a change (each already
    cross-referenced or already the better behavior). See
    `docs/implementation/session-exchange.md` §9 for the full account, including which items got
    real fixes vs. which were reviewed and closed with no code change. New tests:
    `oidc-transaction.spec.ts` (5 new unit tests), 2 new `google-auth.controller.e2e-spec.ts` e2e
    tests, 2 new `auth-exchange-route.test.tsx` tests. Validated: 375/375 `dashboard-api` unit
    tests (5 new), 113/113 `dashboard-api` e2e tests (2 new, real disposable database), 28/28
    `packages/database` integration tests (unaffected), 151/151 `dashboard-web` unit tests (2
    new), typecheck/lint/`next build`/`nest build`/`pnpm exec prettier --check` all clean. Pushed
    as branch `fix-remaining-session-exchange-debt`, opened as
    [PR #38](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/38).
    **Independent code review then ran** (high effort, 8 finder angles) — 6 candidates verified
    (3 CONFIRMED, 3 PLAUSIBLE). 4 fixed in the same round (all 3 CONFIRMED plus 1 cheap
    PLAUSIBLE): a `NaN` `expiresAt` silently degraded the session cookie to session-only (the
    Edge Runtime cookie serializer emits a literal `Max-Age=NaN` header that browsers then
    ignore, rather than throwing) — fixed by extending `isSessionExchangeSuccessBody`'s
    validation to reject an unparseable `expiresAt`; the new "invalid" OIDC-cookie status still
    had no diagnostic detail distinguishing a JSON-parse failure from a shape mismatch — fixed
    with a new `reason: "parse" | "shape"` field; `isSessionExchangeSuccessBody` claimed the full
    response shape but never actually validated `success`/`correlationId`, an unsound type
    predicate — fixed with explicit checks for both; and the shape-mismatch log branch logged the
    raw response body, which could leak a live session token on a future contract drift — fixed
    with a new `describeUnexpectedBody()` helper that logs only safe, values-free summary info.
    2 findings left flagged, not fixed, as genuinely out of this PR's scope: `getServerSession()`'s
    degrade-vs-throw pattern is now hand-repeated across 9+ `dashboard-web` call sites with no
    shared helper (a real but much larger `dashboard-web` data-layer refactor), and
    `OidcTransactionReadResult`'s `status: "ok"` discriminant diverges from
    `ApiSuccessResponse`'s `success: true` convention (a naming-convention divergence, not a
    functional bug — `OidcTransactionReadResult` never crosses a wire boundary, so forcing the
    wire-format convention onto it would import unused assumptions). See
    `docs/implementation/session-exchange.md` §10 for the full account. Re-validated: 375/375
    `dashboard-api` unit tests (3 updated assertions), 113/113 `dashboard-api` e2e tests
    (unchanged), 155/155 `dashboard-web` unit tests (4 new), typecheck/lint/`next build`/
    `nest build`/`pnpm exec prettier --check` all clean. **A separate `security-review` skill run
    then found 0 findings above threshold** — both changed areas confirmed to preserve prior
    security-relevant behavior exactly while adding diagnostics/validation that didn't exist
    before; no new bypass, no weakened check, no attacker-controlled data reaching a redirect
    target, query, or unsafe render sink. A review packet (published as a Claude artifact — the
    consolidated-batch account, the round-2 code-review findings/fixes, the security-review
    disposition, and validation evidence, with a decision section) was prepared for the required
    second-role human review, since the implementing agent cannot also be its own reviewer
    (ADR-0010). **Jitesh D reviewed it and returned "Approved as-is,"** accepting the 2 open
    PLAUSIBLE code-review findings as tracked debt rather than requesting fixes — see
    `docs/project-state/fix-remaining-session-exchange-debt-approval-checklist.md`'s "Sign-off"
    section. **The gate (G4-session-exchange-debt-closure) was then separately requested and
    approved** — WebDesk Solution, decision CONFIRM (clean pass, not an override, since the
    second-role review was already complete before the gate was requested), approved commit
    `11aa6d0` on branch `fix-remaining-session-exchange-debt` — see
    `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
    `G4-session-exchange-debt-closure`) and the approval checklist's "Sign-off" section. **This
    gate approval does not itself authorize merging PR #38 or a production deployment** — merge
    remains its own separate, not-yet-requested authorization, per this project's standing
    "no auto-merge" rule — but bundled together as ONE review pass across this whole batch, per
    the explicit instruction, not repeated per item.
23. **`dashboard-web` Home page widget grid — built, fully validated, not yet reviewed, gated, or
    merged (2026-08-19).** Not started automatically — the user reported the live Home page looked
    "very very simple" (screenshot attached); a scoping investigation (a dedicated research agent)
    found this wasn't a case of the approved design system being too plain, but of the Home page
    never having been wired up to it at all — it was still hand-rolled `<ul><li>` markup with
    inline `style={{ border: ... }}`, exactly the gap
    `docs/design/dashboard-ui/16-existing-shell-gap-analysis.md` §2 already names, and
    `docs/design/dashboard-ui/15-representative-screen-specifications.md` §1 already specifies a
    real widget-grid layout for this exact screen that was approved but never implemented. The
    user chose "wire up what already exists." Built: four `Card`-based widgets (Project Health —
    real project-status counts via `Badge`; My Work and Critical Findings — honest `EmptyState`,
    no per-user task or scan-findings data source exists yet; Git/Release Status — real deploy
    metadata newly surfaced from `/health`'s `build` block, previously fetched by
    `getServerSession()` and discarded) per the approved §15.1 spec, and a rebuilt module grid
    using `Card`+`Badge` (a new `moduleImplementationStatusBadge()` helper,
    `lib/modules.ts`, maps the real 9-value `implementationStatus` enum onto the existing 5-bucket
    status vocabulary, `docs/design/dashboard-ui/10-status-and-workflow-system.md` §1) instead of
    plain bordered list items. `ServerSessionSystemStatus` gained a `release` field
    (version/commit/deploy-time), sourced from data already being fetched — no new backend
    endpoint. 157/157 `dashboard-web` unit tests (3 new), typecheck/lint/`next build`/prettier all
    clean. **Live-rendered, not just typechecked/built blind**: the authenticated shell was
    actually rendered in the Browser pane using this project's own sanctioned test-only session
    bypass (`lib/e2e-test-session.ts`, the same mechanism the automated WCAG suite uses, inert in
    every real deployment) — confirmed real `Card` widgets with shadows, colored `Badge` pills, and
    the module grid rendering correctly, no console errors beyond an expected local HMR artifact.
    See `docs/implementation/dashboard-web-home-widget-grid.md` for the full as-built record.
    Pushed as branch `dashboard-web-home-widget-grid`. Not yet reviewed, gated, or merged — code
    review, security review, second-role human review, a gate decision, and merge authorization
    are each their own separate, not-yet-requested next step, unchanged from this project's
    standing discipline. `/projects` (also flagged by the same gap-analysis doc) remains a
    separate, not-yet-requested follow-up. **Superseded/extended same-branch by item 24 below** —
    the user then said the UI "still looks simple" even with the widget grid live, leading to the
    whole-app visual refresh.
24. **`dashboard-web` whole-app visual refresh ("Enterprise Plus") — built, fully validated,
    code-reviewed, security-reviewed, second-role human reviewed (Jitesh D, "Approved as-is"),
    gated (G4-visual-refresh, WebDesk Solution, CONFIRM), and merged (PR #39, merge commit
    `7728830065c0d14a306216209a0f087b64fbddf0`) — now genuinely live in production
    (2026-08-19).** Not started automatically — after seeing item
    23's widget grid live-rendered, the user said the UI "still looks simple." Rather than guess
    again in code, drafted 3 full visual directions (Current, "Enterprise Plus," "Modern SaaS") as
    a design canvas — a real mockup of the actual Home page content in each direction, not abstract
    swatches — and asked the user to pick one. **The user picked Enterprise Plus**, then, asked
    whether to scope it to the Home page alone or the whole app (the mockup's header/sidebar are
    shared components, not Home-page-specific), **chose the whole app**. Built on the same branch
    (`dashboard-web-home-widget-grid`), on top of item 23's still-unreviewed commit: new
    `packages/ui` design tokens (a real indigo/violet brand accent replacing the generic blue, warm
    off-white surfaces, Sora+Public Sans typography self-hosted via `next/font/google`, richer
    card radius/shadow — semantic colors deliberately unchanged), a dark filled header + tinted
    active-nav sidebar state in `AppShell`, and — closing a real, previously-undiscovered gap —
    `lucide-react` wired up against the `iconReference` field every one of the 43 real modules has
    carried since migration `00035` but that no icon library ever existed to consume, now used for
    real per-module icons in both the sidebar and the Home page's module grid. Every new color
    pair was checked against the real WCAG contrast formula before being chosen, not eyeballed —
    see `docs/implementation/dashboard-web-visual-refresh.md` for the exact ratios. 157/157
    `dashboard-web` + 79/79 `packages/ui` unit tests (one existing assertion updated for the
    deliberate icon-not-monogram collapsed-sidebar behavior, not a regression),
    typecheck/lint/`next build`/prettier all clean across both packages, `pnpm audit` 0
    vulnerabilities. **15/15 Playwright tests passing, including both authenticated-shell WCAG 2.2
    AA axe-core scans** — zero automatically-detectable violations from the new dark header, tinted
    nav state, or icon usage. **Live-rendered in the Browser pane**, not just typechecked/built
    blind — confirmed the actual dark header/warm background/indigo accents/real icons/large
    Project Health numerals render correctly, and separately confirmed via a programmatic DOM
    `.click()` that the sidebar collapse toggle's own logic was never broken (an early real-browser
    click landing oddly was a Browser-pane automation-tool quirk, not a code bug — ruled out
    explicitly rather than assumed). See `docs/implementation/dashboard-web-visual-refresh.md` for
    the full as-built record. **Independent code review then ran** (high effort, 8 finder angles,
    against the full PR #39 diff covering both item 23 and this item) — 9 findings survived
    verification (7 CONFIRMED, 2 PLAUSIBLE). All 7 CONFIRMED fixed: most severe, `toCssCustomProperties()`
    (pre-existing, untouched by this PR) double-prefixed every typography CSS custom property
    (`--webdesk-dashboard-font-font-family-base`, never the single-prefixed name every CSS consumer
    actually referenced), so the new Sora/Public Sans fonts silently never applied anywhere — fixed
    generically (skip the redundant prefix when the kebab key already starts with the group name),
    verified live via `getComputedStyle`. Also fixed: the Git/Release Status widget's "Deployed"
    label actually showed serverless cold-start time, not deploy time (renamed to "Instance
    started" with a doc comment recording why); two reuse gaps (Project Health's status label/color
    duplicating `projectStatusBadge()`; the Git/Release widget's fact rows duplicating the Project
    Detail page's existing `Fact` component — now promoted to `packages/ui` and reused by both,
    incidentally closing a live WCAG AA contrast gap in `Fact`'s original label styling); `IconBadge`
    promoted to `packages/ui` (surfacing and fixing a real React-Server-Components bug along the
    way — passing a raw icon component reference across the client-component boundary crashed the
    page; fixed by switching to the `ReactNode` convention `IconButton` already uses elsewhere);
    `moduleIcon()` now logs an unrecognized `iconReference` instead of silently absorbing it; and
    the icon-only sidebar's per-module distinctiveness guarantee restored for modules with no
    mapped icon (falls back to the module's own monogram, not one shared generic icon). 2 PLAUSIBLE
    findings left as tracked debt (an unguarded status-badge lookup already accepted as debt on
    sibling functions elsewhere in this codebase; a stale, currently-unreachable CSS fallback hex).
    Re-validated: 162/162 `dashboard-web` unit tests (4 new), 79/79 `packages/ui` unit tests, 15/15
    Playwright tests (both authenticated-shell axe-core scans still 0 violations),
    typecheck/lint/`next build`/prettier clean, `pnpm audit` 0 vulnerabilities. See
    `docs/implementation/dashboard-web-visual-refresh.md` §6 for the full account. **Security
    review then run separately, against the fixed branch (commit `a71d2bc`) — 0 findings above
    threshold.** Confirmed: no new user input reaches a dangerous sink (icon references, module
    status, project status, and release metadata are all backend-sourced from already-RBAC-gated
    responses, not attacker-controlled input); no `dangerouslySetInnerHTML` or other unsafe-render
    method introduced; the new `moduleIcon()` log call carries only a registry icon-name key, never
    PII; no auth/session/cookie/`OriginCheckGuard`/`PermissionGuard` logic touched —
    presentation-only on already-authenticated, already-permission-filtered data; the
    `deployedAt` → `instanceStartedAt` rename is a labeling correction, not a new exposure;
    `next/font/google` self-hosts both font files at build time with no new runtime third-party
    call. A review packet (published as a Claude artifact — code review + security review
    findings, fixes, and validation evidence, with a decision section) was then prepared for the
    required second-role human review, since the implementing agent cannot also be its own
    reviewer (ADR-0010). **Jitesh D reviewed it and returned "Approved as-is,"** accepting the 2
    open PLAUSIBLE code-review findings as tracked debt. **The gate (G4-visual-refresh) was then
    separately requested and approved**, and **"Merge PR #39" was then separately requested and
    executed** — see the header line above and `docs/project-state/dashboard-web-visual-refresh-approval-checklist.md`'s
    "Sign-off" section for the full record. Both items 23 and 24's changes are now genuinely live
    in production. **Superseded/extended by item 25 below** — the user then found two more real
    divergences from the approved mockup (sidebar theme, module-grid column count) on the live
    page, leading to a follow-up fix.
25. **`dashboard-web` sidebar & module-grid fix — built, fully validated, code-reviewed,
    security-reviewed, second-role human reviewed (Jitesh D, "Approved as-is"), gated
    (G4-sidebar-grid-fix, WebDesk Solution, CONFIRM), and merged (PR #40, merge commit
    `bd9743966a8b2406eac7656ccb0e8d502463acde`) — now genuinely live in production
    (2026-08-19).** Not started automatically — after item 24 went live,
    the user pointed at two real screenshots (the live production page vs. the approved "Home
    Visual Directions" mockup) and said directly: the module grid should show 4 tiles, not 5, and
    the sidebar doesn't match the mockup's dark theme. Fixed both, reusing existing tokens: the
    module grid's `minmax(240px, 1fr)` → `minmax(280px, 1fr)` (computing to 4 columns at the
    1280px `ContentContainer` cap), and the sidebar's background/text/active-state tokens switched
    from the light `surface`/`accentTint` pair to the header's own dark `headerBackground`/`accent`
    pair, matching the mockup's continuous dark rail — also catching and fixing a real WCAG 2.2 SC
    1.4.11 non-text-contrast regression this color change would otherwise have introduced (the
    shared focus-ring outline color). **Immediately after, the user pasted a reference screenshot
    and said directly: keep the sidebar light, not dark, and make it compact** — a genuine
    direction change, not a bug report, followed as the user's own most-recent explicit
    instruction. Reverted the sidebar's color choice back to light (`surfaceRaised`/`accentTint`,
    matching the reference screenshot exactly) and tightened every spacing value controlling row
    density, fitting the full 15-module navigation tree without scrolling at a typical window
    height. **Independent code review then ran** (medium effort, 8 finder angles) — 6 findings
    survived verification (3 CONFIRMED, 3 PLAUSIBLE). Most severe: the "4 columns" fix from the
    first commit didn't actually hold at common laptop resolutions (1366×768, 1440×900 still
    rendered 3, not 4) since it only reached 4 columns once available content width hit the
    1280px container cap, needing a viewport of roughly 1492px+ — my own live verification had
    only checked 1280px and 1920px, missing the mid-range gap. Fixed by replacing the
    arithmetic-dependent `auto-fill`/`minmax` approach with an explicit, breakpoint-driven CSS
    Module (`repeat(N, minmax(0, 1fr))` at each of the four real `breakpointTokens` values),
    verified live at the exact 1279px→3/1280px→4 boundary. Also fixed: a stale, wrong
    contrast-ratio comment (corrected numbers, independently recomputed with the real WCAG
    formula) and hardcoded `2px`/`1px` spacing literals that bypassed the token system entirely
    (fixed by adding a real `spacingTokens["2xs"]` tier). 2 PLAUSIBLE findings left as tracked
    debt (the new 2px token is a third, numerically inconsistent "tight spacing" value alongside
    an existing undocumented `0.1rem` convention elsewhere in the app; no computed-style test
    coverage exists for the sidebar colors/spacing this branch touches — a pre-existing gap, not
    introduced by this diff). 162/162 `dashboard-web` + 79/79 `packages/ui` unit tests,
    typecheck/lint/`check-css-tokens.mjs`/`next build`/prettier all clean. **Security review then
    run separately — 0 findings above threshold** (a pure CSS/token diff with no user input, data
    handling, new endpoint, or dependency in scope). A review packet (published as a Claude
    artifact — code review + security review findings, fixes, and validation evidence, with a
    decision section) was then prepared for the required second-role human review, since the
    implementing agent cannot also be its own reviewer (ADR-0010). **Jitesh D reviewed it and
    returned "Approved as-is,"** accepting the 2 open PLAUSIBLE code-review findings as tracked
    debt. **The gate (G4-sidebar-grid-fix) was then separately requested and approved** — WebDesk
    Solution, decision CONFIRM, approved commit `c49904a` on branch
    `dashboard-web-sidebar-grid-fix` — see
    `docs/project-state/dashboard-web-sidebar-grid-fix-approval-checklist.md`'s "Sign-off" section.
    **"Merge PR #40" was then separately requested and executed** — merge commit
    `bd9743966a8b2406eac7656ccb0e8d502463acde`, all 14 CI checks green beforehand. Both Vercel
    projects auto-deployed on push to `main` and were verified live directly —
    `dashboard-api`'s `/health` returned `build.commitSha ==
bd9743966a8b2406eac7656ccb0e8d502463acde`, and `dashboard-web`'s `/home` correctly redirects an
    unauthenticated visitor to `/auth/sign-in`. **The `dashboard-web` sidebar & module-grid fix is
    now genuinely live in production.**
26. **`dashboard-web` sidebar spacing adapted to a Vercel reference; a second, independent real
    active-link layout bug found and fixed; code-reviewed, security-reviewed, second-role human
    reviewed (Jitesh D, "Approved as-is"), gated (G4-sidebar-vercel-spacing, WebDesk Solution,
    CONFIRM), and merged (PR #41, merge commit `7baf414462d245c3242998f7ae4ec38ac82e2dd7`) — now
    genuinely live in production (2026-08-19/20).** Not started automatically — after item 25 went
    live, the user shared a
    screenshot of Vercel's own dashboard sidebar and asked to adapt our sidebar's row spacing and
    selection styling toward it (organization/spacing only, keeping our own light palette and
    indigo accent). Widened the sidebar's outer inset, row padding, corner radius, and row gap
    using existing tokens. **While live-verifying this (checking computed styles, not just a
    screenshot), found a second real, independent, previously-undiscovered bug**: the currently-
    active sidebar link has never actually inherited any of `.sidebarLink`'s layout properties,
    since `app-shell.tsx` applied `sidebarLink`/`sidebarLinkActive` as mutually-exclusive classes
    and `sidebarLinkActive` only ever declared color overrides — verified live before the fix:
    `display: inline`, `padding: 0px`, `border-radius: 0px`, underlined, on every page, in every
    deployment, invisible to every prior check since those only verified background/text color,
    never layout. Fixed at the source: `app-shell.tsx`'s className assignments now always apply
    the base class, with the active modifier layered on conditionally. **Independent code review
    then ran** (medium effort, 8 finder angles) — 5 findings survived verification (1 CONFIRMED, 4
    PLAUSIBLE), three of the eight angles independently converging on the same defect from
    different directions. Most severe: the base fix's own change (always applying `.sidebarLink`)
    newly exposed a CSS specificity conflict — `.sidebarLink:hover` (0,2,0) unconditionally beat
    the standalone `.sidebarLinkActive` (0,1,0), so hovering the _currently-active_ nav link washed
    its accent styling out to the plain gray hover treatment, a regression structurally impossible
    before this PR's own fix. Fixed by rewriting `.sidebarLinkActive` as the compound selector
    `.sidebarLink.sidebarLinkActive` — specificity (0,2,0), tying with `:hover` and winning on
    source order — verified live via a real `computer{action:"hover"}` mouse event (not a
    simulated state), confirming `element.matches(':hover') === true` while the accent
    background/text color held. Also fixed 2 cheap PLAUSIBLE findings: a now-redundant compound
    selector in the icon-only rail rule, and two comments that referenced "the conversation"
    without stating their rationale durably. 2 PLAUSIBLE findings left as tracked debt (a radius
    inconsistency between the sidebar and `packages/ui`'s `Dropdown`/`CommandMenu` menu-item
    styling; the identical fragile ternary-classname shape existing, currently safely, in
    `project-status-actions.tsx`). 162/162 `dashboard-web` unit tests (unchanged),
    typecheck/lint/`check-css-tokens.mjs`/`next build`/prettier all clean. **Security review then
    run separately — 0 findings above threshold** (a pure CSS Module/`className`-composition diff
    with no user input, data handling, new endpoint, or dependency in scope). A review packet
    (published as a Claude artifact — code review + security review findings, fixes, and
    validation evidence, with a decision section) was then prepared for the required second-role
    human review, since the implementing agent cannot also be its own reviewer (ADR-0010). See
    `docs/project-state/dashboard-web-sidebar-vercel-spacing-approval-checklist.md`. **Jitesh D
    reviewed it and returned "Approved as-is,"** accepting the 2 open PLAUSIBLE code-review
    findings as tracked debt. **The gate (G4-sidebar-vercel-spacing) was then separately requested
    and approved** — WebDesk Solution, decision CONFIRM, approved commit `6adf852` on branch
    `dashboard-web-sidebar-vercel-spacing` — see
    `docs/project-state/dashboard-web-sidebar-vercel-spacing-approval-checklist.md`'s "Sign-off"
    section. **"Merge PR #41" was then separately requested and executed** — merge commit
    `7baf414462d245c3242998f7ae4ec38ac82e2dd7`, all 14 CI checks green beforehand. Both Vercel
    projects auto-deployed on push to `main` and were verified live directly —
    `dashboard-api`'s `/health` returned `build.commitSha ==
7baf414462d245c3242998f7ae4ec38ac82e2dd7`, and `dashboard-web`'s `/home` correctly redirects an
    unauthenticated visitor to `/auth/sign-in`. **The `dashboard-web` sidebar spacing & active-link
    fix is now genuinely live in production.**
27. **`dashboard-web` Roadmap/Objectives/Environments/Repositories editing — built, reviewed,
    gated, and merged; now live in production (2026-08-20).** Closes gap (4) from item 13's
    remaining-Projects-module-gaps analysis. Not started automatically — built directly on the
    explicit "Let's scope and start sub-resource editing" instruction. Roadmap items, Objectives,
    Environments, and Repositories were all read-only lists on the Project Detail page even though
    every backend endpoint already existed and was already reviewed/gated under
    `module-projects-foundation`/`module-projects-backend-closeout` — this slice is `dashboard-web`
    UI only, no backend changes. Two scoping decisions made directly with the user before building:
    Roadmap items omit `status` from the edit form (the backend's `RoadmapItemsService.update()`
    silently strips any `status` sent through the generic update route; only `setActivePhase()` may
    change it, to protect the one-active-phase-per-project invariant) and instead get a "Set as
    active phase"/"Clear active phase" action wired to the existing
    `POST /projects/:projectId/active-phase` (previously unreachable from any `dashboard-web` UI);
    all four resources shipped together in one PR, matching the Team+Approvers precedent (item 18).
    New: `ProjectObjectivesSection`, `ProjectEnvironmentsSection` (reuses `isSafeHttpUrl()` before
    rendering a stored `url` as a link), `ProjectRepositoriesSection` (client-side validates the
    owner/name segment pattern before submit), and `ProjectRoadmapSection` (disables Delete for the
    currently-active item, since the backend rejects that deletion). The Project Detail page's four
    bespoke inline-style read-only sections were replaced with the four new client islands. Along
    the way, `next build` caught the same `next/headers` client-bundle trap `CLAUDE.md`'s own
    Cautions section already flagged once (item 18's `formatTimestamp` extraction) — a `"use
client"` component value-importing anything from `lib/projects.ts` drags in its `next/headers`
    import. Fixed by extracting `projectStatusBadge`/`roadmapItemStatusBadge`/`objectiveStatusBadge`
    into `lib/status-badges.ts` and `isSafeHttpUrl` into `lib/safe-http-url.ts`, both
    zero-non-type-import files; `lib/projects.ts` re-exports both so no server-side call site
    changed. Two known backend gaps flagged, not fixed (out of scope for a frontend-only branch): no
    unique-constraint handling for duplicate `(project_id, repo_owner, repo_name)` submissions, and
    no code path can ever reach roadmap-item status `complete`/`skipped`. 186/186 `dashboard-web`
    unit tests (24 new), typecheck/lint/`next build`/prettier all clean. Live-rendered in the
    Browser pane to confirm the new page/component wiring boots without console or server errors.
    Pushed as branch `dashboard-web-subresource-editing`, opened as
    [PR #42](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/42).
    **Independent code review then ran** (high effort, 8 finder angles) — 13 candidates verified, 12
    CONFIRMED (1 REFUTED and dropped — a claimed `sequenceStyle` `minWidth` regression, where the
    visual change was real but caused by the markup restructuring itself, not the dropped property).
    10 findings kept in the final report per the review's own cap, all 10 fixed and re-validated:
    the active-phase set/clear action previously updated only `activePhaseId`, never the affected
    roadmap items' own `status`, leaving a stale/contradictory `StatusBadge` until refresh — now
    mirrors the backend's own status transaction locally; clearing a repository's Default branch
    field while editing silently reset it to "main" instead of preserving or blocking — the field
    is now required and part of the edit form's validity check; a non-empty but unparseable
    Sequence value silently serialized to `null` via `JSON.stringify`'s NaN handling — a new
    `parseSequence()` helper rejects it client-side with a clear message; the active-phase response
    was cast to the wrong shared type (`ApiSuccessResponse<ProjectDetail>` instead of the backend's
    actual `ApiSuccessResponse<ProjectEntity>`) — replaced with an honest, narrow local type; open
    inline edit forms never resynced on a concurrent external update, risking a silent lost-update
    on save — fixed with a `useEffect` keyed on `(id, updatedAt)` narrow enough not to wipe an
    in-progress unsaved edit on an unrelated refresh; two real CSS regressions from the original
    `page.tsx`-to-component extraction (a dropped item-label `min-width` floor, and secondary text
    shrinking from the `sm` to `xs` token, undocumented) were both restored; `router.refresh()` on
    every mutation across all four new sections had raised the page's mutation-triggered
    full-refetch surfaces from 3 to 7 — removed entirely where nothing else reads the data, and
    scoped to only fire on a roadmap edit when the edited item is the active phase; the
    `markPending`/pending-`Set` CRUD-handler pattern, reimplemented nearly verbatim across all four
    new components, was extracted into a new shared `lib/use-pending-ids.ts` hook; and the
    `next/headers` client-bundle fix was made proactive rather than reactive by extracting the
    remaining pure exports of `lib/projects.ts` into a new `lib/projects-query.ts`. 24 new/updated
    regression tests added (189/189 `dashboard-web` unit tests, up from 186); one planned test (the
    NaN-sequence guard via a real number input) was found unreproducible in jsdom — its own value
    sanitization already clamps any non-finite value to `""` at the DOM level — recorded explicitly
    in `docs/implementation/dashboard-web-subresource-editing.md` rather than dropped silently.
    **A separate `security-review` skill run then found 0 findings above threshold** — a
    frontend-only diff with no new unsafe render sinks; the `isSafeHttpUrl()` guard and the
    repository owner/name segment pattern are either unchanged relocations or backed by an
    independent, unchanged backend schema. **Jitesh D reviewed it and returned "Approved as-is,"**
    no disputes raised — see
    `docs/project-state/dashboard-web-subresource-editing-approval-checklist.md`'s "Sign-off"
    section. **The gate (G4-subresource-editing) was then separately requested and approved** —
    WebDesk Solution, decision CONFIRM (clean pass, not an override, since the second-role review
    was already complete before the gate was requested), approved commit `2df707e` on branch
    `dashboard-web-subresource-editing` — see `outputs/webdesk-growth-dashboard/project.json`'s
    `gates[]` (`current_gate` now `G4-subresource-editing`) and the approval checklist's "Sign-off"
    section. **"Merge PR #42" was then separately requested and executed** — one CI failure
    (Formatting validation, on a whitespace artifact in `project.json` from the hand-edited gate
    approval) was found and fixed before merging; merge commit
    `e5c3910dd276739abf21ce713697f78b63b1f625`, all 14 CI checks green beforehand. Both Vercel
    projects auto-deployed on push to `main` and were verified live directly —
    `dashboard-api`'s `/health` returned `build.commitSha ==
e5c3910dd276739abf21ce713697f78b63b1f625`, and `dashboard-web`'s `/` correctly redirects an
    unauthenticated visitor to `/auth/sign-in`. **The `dashboard-web` Roadmap/Objectives/
    Environments/Repositories editing is now genuinely live in production.** Of the five gaps item
    13 originally named, only gap (5) (current-project context propagation) remains — see the
    2026-08-20 "Recent decisions" entry below for its scoping outcome.
28. **Business Knowledge Center backend — built, code-reviewed, security-reviewed, second-role
    human reviewed, and gated (2026-08-20).** The second real business-module backend built on the
    Phase 1F application shell / canonical module registry, after Projects — the first of the 21
    real business-module endpoints named in the phase plan. Built directly on the explicit "start
    the business knowledge center now" instruction. `docs/task-packages/module-business-knowledge-center.md`
    and `docs/implementation/module-business-knowledge-center.md` record the full account. The
    canonical spec names 10 "primary records" and a 5-value status vocabulary (`Mandatory | Advisory
| Draft | Deprecated | Restricted`) but gives no field-level schema, workflow doc, or
    wireframes — design decisions D1–D6 fill the gap explicitly, flagged as proposed, not
    spec-sourced. A genuine architectural fork was surfaced to the user directly rather than
    silently resolved: an advisory-only roadmap note (`canonical-inputs/Recommended_Module_Roadmap.md`)
    proposed a Git+Postgres storage split with no basis in the canonical spec — the user chose pure
    DB-backed CRUD (matching the Projects module's own precedent) after confirming realistic
    storage sizing. One generic `business_knowledge_records` table with a `record_type`
    discriminator rather than 10 bespoke tables; organization-wide, not project-scoped (no
    `project_id` column); content authoring (`create`/`update`) split from status governance
    (`changeStatus`) into separate service methods and RBAC actions so the real RBAC matrix
    distinction is enforceable — `marketing_editor` holds `VCES` but not `A`, so can draft/revise a
    record but can never self-approve it into `mandatory`/`advisory`, verified directly via e2e
    test. Reuses the already-seeded `business_knowledge` RBAC permission group verbatim — no new
    RBAC migration. No hard delete (`deprecated` status is the retirement mechanism, matching
    ADR-0016). **Independent code review** (high effort, 8 finder angles, 1-vote verification)
    surfaced 12 candidates — 11 CONFIRMED, 1 REFUTED and dropped (the `entity-mapping.ts` helper
    "duplication" — every module in `packages/database` independently hand-rolls this exact helper,
    not a real deviation). 10 findings kept in the final report per the review's own cap: **9
    CONFIRMED, all fixed** — most severe a TOCTOU race in `changeStatus()` (fixed with an atomic
    compare-and-swap mirroring `IdempotencyKeyRepository.reserve()`'s own conditional-`UPDATE`
    pattern, returning a discriminated `updated`/`not_found`/`conflict` result, throwing
    `ConflictException` (409) on the race-loser path) and the `restricted` status classification
    having no actual access enforcement (fixed by wiring
    `AuthorizationService.canViewConfidential()` and redacting `content`/`notes` on any `restricted`
    record for a caller without that grant, mirroring `operational-contacts.controller.ts`'s own
    pattern). Also fixed: `create()`/`update()` were never audited; a malformed record id crashed
    with a raw 500 (now `ParseUUIDPipe` on all three `:id` routes); `list()` had no pagination cap
    (now clamped, mirroring `ProjectRepository.list()`); `retentionCategory` was always `audit-7y`
    even for an approval-shaped transition (now `approval-audit-7y` for `mandatory`/`advisory`); the
    status write and its audit event were not transactional (extending `AuditService`'s signature
    would be a larger cross-cutting change out of proportion here, and this exact non-atomic
    ordering is already the accepted, shipped pattern in `ProjectService.changeStatus()` — the audit
    call is now wrapped in try/catch with a clear `console.error` on failure); `ALLOWED_TRANSITIONS`
    was asymmetric (`mandatory`/`advisory` can now reach `draft` directly, matching `restricted`'s
    own symmetry); and the task package falsely claimed `packages/shared-types` additions were
    delivered (corrected — none exist in this backend-only pass). **1 PLAUSIBLE finding left as
    accepted, tracked debt** — no invariant limits how many `mandatory`/`advisory` records can exist
    per `record_type` simultaneously; its own verifier concluded the correct invariant is genuinely
    record-type-dependent and the spec states no rule either way. **A separate `security-review`
    skill run then found 0 findings above threshold** — 3 candidates surfaced (unredacted content in
    the audit trail, no confidential-edit gate on the update route, no separation-of-duties check on
    self-approval) were each independently re-verified against the actual code and design docs and
    scored 2/10 confidence; all three turned out to be pre-existing, already-accepted architectural
    patterns replicated from `ProjectService`/`operational-contacts`, not new gaps this branch
    introduces. Final numbers: 389/389 `dashboard-api` unit tests, 11/11 `packages/database`
    integration tests, 11/11 `dashboard-api` e2e tests — all against a real disposable PostgreSQL 17
    database — migration up/down round-trip clean (48 migrations), module-registry validation
    unaffected (43 modules, 21 permission groups), typecheck/lint/prettier clean, `pnpm audit` — 0
    vulnerabilities. A review packet (published as a Claude artifact — code review + security review
    findings, fixes, and validation evidence, with a decision section) was prepared for the required
    second-role human review, since the implementing agent cannot also be its own reviewer
    (ADR-0010). **Jitesh D reviewed it and returned "Approved as-is,"** accepting the 1 open
    PLAUSIBLE finding as tracked debt. **The gate (G4-business-knowledge-center) was then separately
    requested and approved** — WebDesk Solution, decision CONFIRM (clean pass, not an override,
    since the second-role review was already complete before the gate was requested), approved
    commit `b64a728` on branch `module-business-knowledge-center` — see
    `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
    `G4-business-knowledge-center`) and
    `docs/project-state/module-business-knowledge-center-approval-checklist.md`'s "Sign-off"
    section. **"Merge PR #43" was then separately requested and executed** — waited for all 14 CI
    checks to go green first, merge commit `032fb274920c523c07b252e45cc8bc0f097c8b4e`. Both Vercel
    projects auto-deployed on push to `main` and were verified live directly, not just via CI's own
    Vercel status check — `dashboard-api`'s `/health` returned `build.commitSha ==
032fb274920c523c07b252e45cc8bc0f097c8b4e`, confirming the exact merged commit is what's serving;
    `dashboard-web`'s `/` resolves (via the intermediate `/home` hop) to `/auth/sign-in` for an
    unauthenticated visitor, confirming the session gate is intact. **The Business Knowledge
    Center backend is now genuinely live in production.** No `dashboard-web` UI exists yet for this
    module — a separate, not-yet-requested next step, matching the Projects module's own
    precedent.
29. **`dashboard-web` Business Knowledge Center UI — built, code-reviewed, security-reviewed,
    second-role human reviewed, and gated (2026-08-20).** Closes the module's last named gap —
    built directly on the
    explicit "build the dashboard-web UI for it" instruction, following the backend's own build-to-
    production arc (PR #43). No approved wireframe/spec exists for this module's screens; every
    screen renders exactly what the already-reviewed, already-gated backend returns and supports,
    matching the Projects module's own list/detail/form pages' "smallest honest reading" precedent.
    `docs/implementation/dashboard-web-business-knowledge-center.md` records the full account. New:
    `packages/shared-types` additions (`content`/`notes` typed as genuinely _optional_, not just
    nullable, honestly reflecting that the backend's confidential-field redaction deletes both keys
    outright for a `restricted` record when the caller lacks `view_confidential` — currently every
    caller, since that action is zero-seeded for every role); `lib/business-knowledge-query.ts`
    (zero-non-type-import file, written client-safe from the start — page size, query parsing/href
    building, record-type labels, status-badge tokens); `lib/business-knowledge.ts` (server-side
    list/get fetch functions, with a malformed-UUID short-circuit mirroring `getProjectDetail()`);
    `BusinessKnowledgeRecordForm` (create/edit; `recordType` is create-only, matching the backend's
    own `updateBusinessKnowledgeRecordSchema` contract; `status` is intentionally never a field
    here); `BusinessKnowledgeStatusActions` (mirrors the backend's 5-state `ALLOWED_TRANSITIONS` by
    hand, only the terminal `deprecated` transition is confirmed, a concurrent-write `409` now shows
    a real message via a new `ConflictException` entry in `lib/api-errors.ts`'s allowlist — the
    first route in this app whose service layer can throw one); four routes under
    `app/(shell)/business-knowledge-center/` (list, detail, new, edit) at the module registry's own
    seeded `route` field. A `restricted` record's redacted `content`/`notes` render as an inert
    notice in both the detail page and the edit form, and are omitted entirely from the edit form's
    submit payload — never coerced to an empty string that could silently overwrite real
    confidential content, since `content === undefined`/`notes === undefined` unambiguously signal
    redaction (a real record always has non-empty content). 32 new `dashboard-web` unit tests
    (221/221 overall); typecheck/lint/`check-css-tokens.mjs`/`next build`/prettier all clean across
    `packages/shared-types` and `dashboard-web`; 15/15 Playwright tests passing (one local-
    environment-only false failure — a manually-started dev server on port 3000 being reused by
    Playwright's own `webServer` config instead of spinning up its own with
    `PLAYWRIGHT_E2E_TEST_MODE` set — diagnosed and ruled out, not a real regression). Live-rendered
    in the Browser pane: unauthenticated redirects confirmed clean for the list and create routes,
    zero server errors; no local `dashboard-api` was available in this environment, so the
    authenticated success-path rendering wasn't visually confirmed, the same limitation the
    Projects list page's own as-built record already noted for itself. Pushed as branch
    `dashboard-web-business-knowledge-center`, opened as
    [PR #44](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/44).
    **Independent code review** (high effort, 8 finder angles, 1-vote verification) surfaced 20
    candidates after dedup, 10 kept in the final report per the review's own cap: **8 CONFIRMED,
    all fixed** — most severe adding `ConflictException` to `lib/api-errors.ts`'s
    `SAFE_MESSAGE_CODES` silently changed error-message behavior for the already-shipped Projects
    approver-assignment flow, with a doc comment falsely claiming Business Knowledge was "the only
    route" that could throw one (fixed by correcting the comment and adding a dedicated regression
    test locking in the new, verified-benign behavior on that path). Also fixed: redundant
    `contentRedacted`/`notesRedacted` flags collapsed to one (verified against actual backend
    behavior, not speculation); `UUID_PATTERN`/`firstValue()` duplication extracted into new shared
    `lib/uuid.ts`/`lib/search-params.ts`; duplicated table-cell styles extracted into
    `lib/list-table-styles.ts`; a duplicated notes-normalization ternary hoisted; a missing
    `console.error` added with test coverage. **1 CONFIRMED finding flagged, not fixed** — the list
    page over-fetching full `content`/`notes` for every row is real but not fixable within this
    `dashboard-web`-only branch's scope (needs a backend list-projection change). **2 PLAUSIBLE
    findings left as accepted, tracked debt** — a status-badge lookup with no fallback, and the
    record-type/status enum triplicated across three files — both inherited, already-accepted
    patterns from sibling code elsewhere in this app, not new regressions this PR introduces. **A
    separate `security-review` skill run then found 0 findings above threshold** — 2 candidates
    surfaced (a "change status to unlock confidential content" UI-text concern, and the same
    list-page over-fetch) were each independently re-verified against the actual code and git
    history and refuted: the redaction-bypass mechanism is entirely pre-existing backend code from
    the already-merged, already-security-reviewed PR #43 (confirmed via `git diff`/`git log`
    showing zero backend files touched by this branch), and the over-fetch crosses no
    authorization boundary. Final numbers: 223/223 `dashboard-web` unit tests, typecheck/lint/
    `check-css-tokens.mjs`/`next build`/prettier all clean, 15/15 Playwright tests passing. A
    review packet (published as a Claude artifact — code review + security review findings, fixes,
    and validation evidence, with a decision section) was prepared for the required second-role
    human review, since the implementing agent cannot also be its own reviewer (ADR-0010).
    **Jitesh D reviewed it and returned "Approved as-is,"** accepting the 2 open PLAUSIBLE findings
    and the flagged out-of-scope debt item as tracked debt. **The gate
    (G4-dashboard-web-business-knowledge-center) was then separately requested and approved** —
    WebDesk Solution, decision CONFIRM (clean pass, not an override, since the second-role review
    was already complete before the gate was requested), approved commit `5d11d63` on branch
    `dashboard-web-business-knowledge-center` — see
    `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
    `G4-dashboard-web-business-knowledge-center`) and
    `docs/project-state/dashboard-web-business-knowledge-center-approval-checklist.md`'s
    "Sign-off" section. **This gate approval does not itself authorize merging PR #44 or a
    production deployment** — merge remains its own separate, not-yet-requested authorization,
    per this project's standing "no auto-merge" rule.
30. **Business Knowledge Center — Rich Content & File Attachments — built, fully validated,
    independently code-reviewed, security-reviewed, second-role human reviewed (Jitesh D,
    "Approved as-is"), gated (G4-bkc-rich-content-attachments, WebDesk Solution, CONFIRM), and
    merged (PR #45, merge commit `3c9f4b7`) — with a real production incident triggered by the
    merge diagnosed and fixed the same day (2026-08-20).**
    `docs/task-packages/business-knowledge-center-rich-content-attachments.md` records the
    original proposal; `docs/implementation/business-knowledge-center-rich-content-attachments.md`
    records the full as-built account. Built directly on the explicit "go ahead and start building
    it" instruction, bundling in two explicitly-requested, unrelated fixes touching the same list
    pages: a page-size selector (10/20/30/50/100) on both `/projects` and
    `/business-knowledge-center`, and a real bug fix (a Next.js `<Link>` soft-navigation reusing
    the same DOM node meant an uncontrolled `<select>`/`<input>`'s `defaultValue` never actually
    reset on "Clear filters" — fixed with a `key` tied to each field's own value). Migration
    `00049`: `content` relaxed to nullable (an attachment-only record is now real), a new
    `business_knowledge_attachments` table. The first real implementation of the Phase 1A
    `BlobStorageAdapter` interface (`packages/integrations`, now with the same dual ESM+CJS build
    as `@webdesk/database`/etc., per this file's own Cautions-section lesson) — its shape was
    revised from the original placeholder guess after verifying Vercel's actual documented Blob
    mechanics directly (no "uploadUrl"/"signed read URL" concepts exist for a private store;
    real client uploads use `@vercel/blob/client`'s two-phase `handleUpload()`/`upload()`
    protocol, real reads proxy through the app's own auth). New `dashboard-api` attachment
    endpoints (upload-route, confirm, list, a content-proxy stream, delete) — real RBAC/format/
    size checks, a real SHA-256 checksum, format-specific preview generation (mammoth for DOCX; a
    hand-built table from a real `ExcelJS`-parsed XLSX, chosen over the `xlsx` package after
    `pnpm audit` flagged two real HIGH vulnerabilities in it; `markdown-it` over `marked`, which
    is ESM-only and would have repeated the openid-client-class production-outage pattern this
    file already documents once; PDF gets no extraction, embedded as the real file instead — D4).
    Mandatory HTML sanitization at write time (`dashboard-api`) and again at render time
    (`dashboard-web`, defense-in-depth) against a strict allowlist — flagged as this project's
    first HTML-storage/rendering surface, needing its own dedicated security-review focus, not
    folded into the general pass. New `RichTextEditor` (Tiptap) replacing the plain textarea in
    the create/edit form; new `BusinessKnowledgeAttachmentsSection` on the detail page (upload,
    inline preview — a real `<embed>` for PDF, cached sanitized HTML for DOCX/XLSX/Markdown — and
    delete). 149/149 `packages/database` integration + 28/28 unit, 8/8 `packages/integrations`
    unit, 427/427 `dashboard-api` unit + 132/132 e2e (19 new, real disposable database, an
    in-memory `BlobStorageAdapter` fake substituted for the real one — no Vercel Blob store is
    provisioned anywhere in this environment or in production yet), 258/258 `dashboard-web` unit
    - 15/15 Playwright, all passing; typecheck/lint/`check-css-tokens.mjs`/`next build`/
      `nest build`/prettier all clean; `pnpm audit` 0 vulnerabilities. Live-rendered: both new/
      detail routes confirmed to redirect an unauthenticated visitor cleanly, zero server errors —
      no local `dashboard-api` exists in this environment, so the authenticated success path
      (editor/attachments actually mounted) was verified only through real jsdom component tests,
      not visually. See the implementation doc's §6 for deliberate, explicitly-flagged scope
      decisions (upload happens from the detail page, not the create form — an attachment needs a
      real `record_id`; the Blob completion webhook is a no-op by design; one same-session
      preview-sanitization gap left open). Pushed as branch
      `business-knowledge-center-rich-content-attachments`, opened as
      [PR #45](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/45).
      **Independent code review then ran** (high effort, 8 finder angles) — 9 candidates survived
      dedup/verification (7 CONFIRMED, 2 PLAUSIBLE). Most severe, and the review's own most
      important catch: the file-attachment upload flow pointed `@vercel/blob/client`'s
      `handleUploadUrl` directly at `dashboard-api`, a genuinely cross-origin request that could
      never carry the session cookie (the Blob SDK has no `credentials` option, and browsers
      forbid scripts from setting `Cookie` manually) — **every real upload attempt would have
      401'd in production**, the entire feature this branch was built to deliver. Verified
      directly against `@vercel/blob@2.8.0`'s own source before fixing, not assumed. Fixed with a
      new same-origin `dashboard-web` proxy Route Handler
      (`app/(shell)/business-knowledge-center/[recordId]/attachments/upload-route/route.ts`)
      forwarding the cookie server-to-server, the same pattern `app/auth/session/route.ts`
      already established. 8 of 9 findings fixed in total per explicit "fix the confirmed
      findings" instruction — also: an edit-mode content-clearing bug that stored the literal
      string `'<p></p>'` instead of `null` (fixed by widening `updateBusinessKnowledgeRecordSchema`'s
      `content` from `.optional()` to `.nullish()`, matching `notes`'s own shape); a missing
      try/catch in `confirm()` around preview generation that orphaned the Blob object and raw-500'd
      on a structurally corrupt file of an allowed MIME type; a silent editor/state desync where
      the length-limit guard's own rejection logic (`setContent(content)` on overflow) was a React
      no-op that permanently broke `RichTextEditor`'s sync `useEffect`, fixed by removing the guard
      entirely and enforcing the limit once at submit time instead; a sequential record/attachments
      fetch with no genuine data dependency (fixed via the same `tolerateDiscard()` technique PR #27
      already established, now exported from `lib/business-knowledge.ts`); a redundant
      `router.refresh()` after an already-sufficient local state update (the same shape items 12
      and 27 already found in sibling components); a real reverse-tabnabbing gap via raw-HTML paste
      (the toolbar's own Link button was already safe by construction) closed with a `transformTags`
      rule forcing a safe `rel` onto any `target`-carrying `<a>`; and the two apps' byte-identical,
      independently-hand-maintained sanitization allowlists, promoted into a new
      `sanitizeRichTextHtml()` export in `packages/validation` (the same promotion that also carries
      the tabnabbing fix) — closing the exact duplication shape this project already found and fixed
      once for `safeHttpUrlSchema`; `dashboard-web` gained `@webdesk/validation` as a real dependency
      (previously missing) and dropped its now-unused direct `sanitize-html` dependency. **1
      CONFIRMED finding left as accepted, tracked debt**: no cleanup/reconciliation mechanism exists
      for a Blob object left orphaned when a file finishes uploading to storage but its subsequent
      `confirm()` call never completes (closed tab, dropped network) — a real fix means a cron/TTL
      sweep or admin tool, out of proportion for a review-fix pass. Re-validated: 430/430
      `dashboard-api` unit tests (3 new), 132/132 `dashboard-api` e2e tests (real disposable
      database, unchanged count), 9/9 `packages/validation` unit tests (5 new), 258/258
      `dashboard-web` unit tests (updated assertions for the new same-origin upload URL and the
      removed `router.refresh()` calls), typecheck/lint/`next build`/`nest build`/
      `check-css-tokens.mjs`/prettier all clean, `pnpm audit` 0 vulnerabilities. See
      `docs/implementation/business-knowledge-center-rich-content-attachments.md` §7 for the full
      account. **A separate `security-review` skill run then found 0 findings above threshold** —
      confirmed correct IDOR scoping, correct `restricted`-record redaction, the new same-origin
      upload proxy is not an open proxy/SSRF vector, the sanitizer allowlist and `transformTags`
      rel enforcement hold, `markdown-it` runs with `html: false`, XLSX cell text is HTML-escaped,
      Blob pathnames are prefix-checked with the real storage key stripped from every response, and
      the content-proxy route's filename is `encodeURIComponent`-escaped — see
      `docs/implementation/business-knowledge-center-rich-content-attachments.md` §8 for the full
      account, including one sub-threshold doc-comment observation left unfixed (not independently
      exploitable). A review packet (published as a Claude artifact — code review findings/fixes,
      the security review, and validation evidence, with a decision section) was then prepared for
      the required second-role human review, since the implementing agent cannot also be its own
      reviewer (ADR-0010). **Jitesh D reviewed it and returned "Approved as-is,"** accepting the
      one open CONFIRMED code-review finding (no cleanup mechanism for a Blob object orphaned by an
      interrupted upload) as tracked debt rather than requesting a fix before merge. **The gate
      (G4-bkc-rich-content-attachments) was then separately requested and approved** — WebDesk
      Solution, decision CONFIRM (a clean pass, not an override, since the second-role review was
      already complete before the gate was requested), approved commit `359e9a9` on branch
      `business-knowledge-center-rich-content-attachments` — see
      `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
      `G4-bkc-rich-content-attachments`) and
      `docs/project-state/business-knowledge-center-rich-content-attachments-approval-checklist.md`'s
      "Gate" section. **This gate approval does not itself authorize merging PR #45 or a
      production deployment** — merge remains its own separate, not-yet-requested authorization,
      per this project's standing "no auto-merge" rule. **"Merge PR #45" was then separately
      requested and executed** — merged by the user directly via GitHub, with a real merge commit
      (not squash/rebase), matching every prior merge in this project's history — merge commit
      `3c9f4b7aad27c057d49b50168e0374f2d5ec1416`, all 14 CI checks green beforehand. **A real
      production incident then occurred, triggered by the merge, diagnosed and resolved the same
      day**: `dashboard-api` went fully down (`FUNCTION_INVOCATION_FAILED` on every route,
      including `/health`) roughly 11 minutes after the merge — a pre-existing Vercel-bundler-only
      ESM-interop gap (`sanitize-html@2.17.7`, still the latest release, requires
      `htmlparser2@^12.0.0`, which dropped its CommonJS build entirely), first triggered now since
      this PR is the first deployment of this project's HTML-sanitization feature to production,
      not a bug this PR's own review-fix work introduced. Diagnosed from real Vercel runtime logs
      and fixed with a `pnpm-workspace.yaml` override pinning `htmlparser2` to a CJS-compatible
      version (`>=10.1.0 <11.0.0`), verified safe against `sanitize-html`'s actual API usage
      before relying on it, and pushed directly to `main` (commit
      `aadbce142bec18cbf2789e2491d9f93997e72096`) given the active outage, matching this project's
      established pattern for urgent live-deployment fixes. Verified resolved live: `/health`
      returned `build.commitSha == aadbce1` with `status: ok` across repeated requests, `GET /me`
      (unauthenticated) returned a clean `401` rather than a crash, and `dashboard-web`'s `/`
      correctly redirects to `/auth/sign-in`. Outage window roughly `2026-08-20T20:55Z`–`21:06Z`
      (~11 minutes). See
      `docs/implementation/business-knowledge-center-rich-content-attachments.md` §11 for the full
      incident account. **The Business Knowledge Center rich content & attachments slice,
      including the same-day production-incident fix, is now genuinely live and stable in
      production.** **Two more real, independent production errors surfaced the next day and were
      diagnosed and fixed the same way** — see
      `docs/implementation/business-knowledge-center-rich-content-attachments.md` §12/§13 for the
      full accounts: (1) an RSC function-prop crash on both `/projects` and
      `/business-knowledge-center` (a Server Component passing a closure, not plain data, to the
      `PageSizeSelect` Client Component — React Server Components rejects that at render time),
      fixed by changing `PageSizeSelect`'s prop from a `buildHref` function to a precomputed
      `hrefBySize` record and deployed as commit `600f88e`, verified resolved live; (2) a specific
      record's detail page 500ing because migration `00049`
      (`create-business-knowledge-attachments`) had never actually been run against production
      after PR #45 merged — confirmed via a real, read-only `migrate:status` check, with the fix
      (the user running the real `migrate` command themselves) given but its confirmed-applied
      outcome not yet recorded here.
31. **`dashboard-web` file upload on the Business Knowledge Record create form — built, fully
    validated, independently code-reviewed (all 8 CONFIRMED findings fixed), security-reviewed (0
    findings above threshold), required second-role human reviewed (Jitesh D, "Approved"), gated
    (G4-attachments-on-create, WebDesk Solution, CONFIRM), merged
    ([PR #46](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/46),
    merge commit `adf9a6b4e908e975b309cd372d1252c1912c8aee`) — now genuinely live in production
    (2026-08-21).**
    `docs/implementation/dashboard-web-attachments-on-create.md` records the full account. Not
    started automatically — built directly on the explicit "we need upload option in New business
    knowledge record add not in view" instruction. Upload was previously detail-page-only (task
    package D5's own deliberate scope decision, since an attachment's `record_id` is a real
    foreign key that can't exist before the record itself does). Files picked on the create form
    are now staged client-side (never uploaded) until the record is actually created, at which
    point every staged file is uploaded via the exact same `uploadAttachment()` flow the detail
    page's own control already uses — no new backend surface. A new
    `lib/business-knowledge-attachments.ts` extracts the shared MIME/size allowlist and the
    `upload()`-then-`confirm()` sequence out of `BusinessKnowledgeAttachmentsSection` (a pure
    refactor, re-validated by that component's own unchanged 10-test suite) so the create form's
    new file picker doesn't duplicate either. A `createdRecordId` state guards against the real
    risk this design introduces: once the record is created, the submit button is replaced by a
    direct "View record" link instead of staying resubmittable. The first pass at the
    shared-helper extraction silently dropped a real behavioral distinction (a curated backend
    error message vs. a generic fallback for any other failure) that the pre-existing
    attachments-section test suite caught immediately — fixed with a new `AttachmentUploadApiError`
    class. 264/264 `dashboard-web` unit tests (5 new), typecheck/lint/`check-css-tokens.mjs`/
    `next build`/prettier all clean. Live-rendered in the Browser pane: the unauthenticated
    redirect for `/business-knowledge-center/new` confirmed clean, zero console/server errors; no
    local `dashboard-api` available in this environment, so the authenticated file-picker
    rendering wasn't visually confirmed, the same limitation noted on several prior slices.
    Committed locally on branch `dashboard-web-attachments-on-create` — unlike every prior slice
    this session, not pushed to `origin` or opened as a PR before review; the code-review,
    security-review, and second-role-review steps below were still each run in full, matching
    this project's standing discipline regardless.
    **Independent code review then ran** (this project's own `code-review` skill, high effort, 9
    finder angles, 1-vote verification) — every one of the 9 candidates that survived dedup came
    back CONFIRMED (0 PLAUSIBLE, 0 REFUTED). All 8 kept findings fixed (a 9th collapsed into the
    same root cause as one of the 8). Most severe: `handleSubmit` had no internal guard against
    being re-invoked once `createdRecordId` was already set — the `<form>` stayed mounted with the
    Title field the only remaining input that doesn't block HTML's implicit-submission-on-Enter
    behavior, so pressing Enter there after a partial upload failure could silently create a
    duplicate record; fixed with an early `if (createdRecordId) return;` guard inside
    `handleSubmit` itself, not just a UI-level button swap. Also fixed: the "View record" link (a
    plain `<a>`, not a Next.js `<Link>`) was rendered — and clickable — before staged uploads
    actually finished, so clicking through mid-upload could hard-navigate and silently abort
    in-flight attachment uploads with no error ever surfaced; now gated on `!submitting` too. The
    batch-upload path never actually checked for `AttachmentUploadApiError` (contradicting this
    branch's own implementation doc, which had claimed it did), always showing a generic message
    even when the backend returned a real, curated rejection reason — now shows the real per-file
    reason when available. `pendingFiles` was never trimmed after a partial success, so the staged
    list kept showing already-uploaded files as if they still needed action — now trims to just
    the files still pending. `attachmentError` was never cleared by `handleSubmit`, so a stale
    rejection message could render alongside a newer, unrelated error — now cleared at the start
    of every submit. The component's own doc comment claimed navigation "still proceeds" after a
    partial failure, contradicting the actual early-return code path (and this branch's own test
    asserting it) — corrected. `.removeStagedButton` hand-copied `.deleteButton`'s styling but
    omitted its `:disabled` rule, so a disabled Remove button looked fully active — now composes
    from `.deleteButton` directly, picking up the missing state for free. 5 new regression tests
    added covering mixed valid/invalid file selection, multi-file removal by index, a genuinely
    mixed success/failure upload batch, the resubmission guard, and `attachmentError` clearing.
    Re-validated: 269/269 `dashboard-web` unit tests, typecheck/lint/`check-css-tokens.mjs`/
    `next build`/prettier all clean.
    **A separate `security-review` skill run then found 0 findings above threshold** — this diff
    is client-side UI/orchestration only, no new backend endpoint, no changes to the upload-route
    proxy/RBAC/HTML-sanitization boundary. Four candidates were individually verified and ruled
    out: the Blob-pathname-from-raw-filename construction (confirmed via `git show` to be
    byte-for-byte identical to the pre-existing, already-reviewed code this refactor only
    relocated); client-side-only MIME/size validation (unchanged, real enforcement is unmodified
    backend code); the duplicate-record-creation guard (a business-logic concern, not
    authorization, and already fixed within the same diff); and error/filename string
    interpolation into the failure message (confirmed rendered only via JSX text children, never
    `dangerouslySetInnerHTML`). A review packet (published as a Claude artifact, "Attachments On
    Create Review" — code review + security review findings, fixes, and validation evidence, with
    a decision section) was then prepared for the required second-role human review, since the
    implementing agent cannot also be its own reviewer (ADR-0010). See
    `docs/project-state/dashboard-web-attachments-on-create-approval-checklist.md`. **Jitesh D
    reviewed it and returned "Approved"** — 0 disputes raised, matching the 0 open findings of any
    kind on this branch. **The gate (G4-attachments-on-create) was then separately requested and
    approved** — WebDesk Solution, decision CONFIRM (clean pass, not an override, since the
    second-role review was already complete before the gate was requested), approved commit
    `7bbaa67` on branch `dashboard-web-attachments-on-create` — see
    `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
    `G4-attachments-on-create`) and the approval checklist's "Sign-off" section. **This gate
    approval does not itself authorize pushing the branch, opening a PR, or merging** — each
    remains its own separate, not-yet-requested authorization, per this project's standing
    "no auto-merge" rule. **"Push the branch and open a PR" was then separately requested and
    executed** — pushed to `origin`, opened as
    [PR #46](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/46).
    Unusually, unlike every prior slice this session, the branch had never been visible on GitHub
    until after code review, security review, second-role human review, and the gate had all
    already happened locally — this is the first time it's on `origin`. **All 14 CI checks were
    then confirmed green** (typecheck, lint, unit tests, integration tests, production build, both
    Vercel preview deployments, etc.), and **"Merge PR #46" was then separately requested and
    executed** — merged with a real merge commit (not squash/rebase), matching every prior merge
    in this project's history — merge commit `adf9a6b4e908e975b309cd372d1252c1912c8aee`. Both
    Vercel projects auto-deployed on push to `main` and were verified live directly, not just via
    CI's own Vercel status check — `dashboard-api`'s `/health` returned `build.commitShaShort ==
adf9a6b`, confirming the exact merged commit is what's serving; `dashboard-web`'s `/` resolves to
    `/auth/sign-in` for an unauthenticated visitor, confirming the session gate is intact. **The
    `dashboard-web` file upload on the Business Knowledge Record create form is now genuinely
    live in production.**
32. **Service Library module backend — built, fully validated, code-reviewed, security-reviewed,
    second-role human reviewed, and gated (2026-08-21).**
    `docs/task-packages/module-service-library.md` and
    `docs/implementation/module-service-library.md` record the full account. The third real
    business-module backend built on the Phase 1F application shell / canonical module registry,
    after Projects and Business Knowledge Center — module #3 in the project-owner-supplied
    `canonical-inputs/Recommended_Module_Roadmap.md`. Not started automatically — built directly on
    the explicit "Start Service Library module" choice, presented as the recommended next step. A
    genuine roadmap/dependency conflict was surfaced and resolved directly with the user rather than
    silently picked: the module registry's own seeded `dependencies` field for `service_library`
    names three modules that don't exist yet (`persona_library`/`case_study_library`/
    `page_inventory`); the user chose **build now, storing the three cross-module relationship
    fields (`icpIds`/`relatedPageIds`/`relatedCaseStudyIds`) as plain unvalidated string arrays**,
    no foreign key, to be properly linked once those modules exist. A real normalized 7-table schema
    (migration `00050`, opposite of BKC's single-generic-table design, sourced from
    `04_Data_Model_and_Ownership.md:107-118`), organization-wide (no `project_id`), two
    independently-governed status fields (`approvalStatus` governed via a dedicated transition
    route, `publicationStatus` a plain ungoverned field — no `P` grant exists), and adopts
    `public_id` (unlike BKC). The status-transition route is gated only on `view` at the route
    level, with the real per-transition action (submit/review/approve) checked dynamically inside
    `ServicesService.changeApprovalStatus()` — the real seeded RBAC matrix splits these three
    actions across three different role tiers (`marketing_editor` holds submit but not approve;
    `super_admin`/`owner_growth_approver` hold approve but not submit; `qa_security_reviewer` holds
    only review), mirroring `ProjectApproversService.assign()`'s own layered pattern. **A real bug
    was caught by the new e2e suite before merge**: `ServiceLibraryDimensionsController` was first
    written with `@RequirePermission` at the class level, which `PermissionGuard` never actually
    reads (it only checks `context.getHandler()`, a deliberate fail-closed design) — every
    dimension-list route would have 500'd in production; fixed by moving the decorator to each
    method, matching every other controller in this codebase. 17 new `dashboard-api` unit tests, 21
    new `packages/database` integration tests (real disposable database), 15 new `dashboard-api` e2e
    tests (real disposable database + real seeded RBAC roles, including the full three-tier
    submit/review/approve matrix and a relationship round-trip test) — 447/447 `dashboard-api` unit
    tests overall at initial build. Migration `00050`/`00051` up/down round-trip clean (51
    migrations); `pnpm validate:module-registry` unaffected (43 modules, 21 permission groups);
    typecheck/lint/`nest build`/prettier all clean. **Independent code review then ran** (high
    effort, 8 finder angles, 1-vote verification) — 8 candidates verified, all CONFIRMED, all 8
    fixed: most severe, `requiredActionForTransition()` gated every transition to `draft` behind
    the `approve` action, blocking a `marketing_editor` from ever reverting their own rejected/
    revision-requested work to fix and resubmit, contradicting the canonical spec's own stated
    intent — fixed by replacing the two independently-maintained `ALLOWED_TRANSITIONS`/
    `requiredActionForTransition()` structures with one unified `TRANSITIONS` table. Also fixed:
    five distinct missing FK-existence checks (`ownerUserId`/`parentServiceId`/`deliverableIds`/
    `platformIds`/`engagementModelIds` all surfaced raw 500s instead of clean 400s); `create()`/
    `update()` omitting the relationship ids they just wrote from their own response; an
    unescaped SQL LIKE wildcard in search (`escapeLikePattern()`, exported and reused from
    `UserRepository`); a redundant re-fetch/re-validation in `update()` (the identical bug class
    already fixed once in the Projects module); six near-identical join-table repository methods
    contradicting their own doc comment (refactored to two shared generic helpers); and a third
    hand-duplicated auth-check pattern (closed by adding `AuthorizationService.assertAllowed()`).
    One unrelated candidate (a `findOne()` return-type/Swagger-schema claim) was independently
    refuted — this project has no `@nestjs/swagger` CLI plugin generating schemas from TS types.
    **A separate `security-review` skill run then found 1 CONFIRMED finding** at confidence
    8/10: the `confidentiality` field (`public`/`internal`/`restricted`) had zero read-side
    enforcement anywhere — any caller holding baseline `service_persona_proof:view` (all 7 seeded
    roles) could read a `restricted` record's `internalDescription`, closely paralleling Business
    Knowledge Center's own already-shipped `restricted`-status enforcement, which Service Library
    introduced both the field and every reading route for without replicating. Fixed by wiring
    the same, already-shared `confidential-field.util.ts` mechanism BKC uses across
    `list`/`findOne`/`create`/`update`/`changeStatus`. Final numbers after both review rounds:
    461/461 `dashboard-api` unit tests, 21/21 `packages/database` integration tests (unchanged,
    confirming the repository refactor is behavior-preserving), 21/21 `dashboard-api` e2e tests.
    A review packet (published as a Claude artifact — code review + security review findings,
    fixes, and validation evidence, with a decision section) was prepared for the required
    second-role human review, since the implementing agent cannot also be its own reviewer
    (ADR-0010). **Jitesh D reviewed it and returned "Approved,"** no disputes raised — 0 open
    findings of any kind on this branch. **The gate (G4-service-library) was then separately
    requested and approved** — WebDesk Solution, decision CONFIRM (clean pass, not an override,
    since the second-role review was already complete before the gate was requested), approved
    commit `03856b8` on branch `module-service-library` — see
    `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
    `G4-service-library`) and
    `docs/project-state/module-service-library-approval-checklist.md`'s "Sign-off" section.
    **"Push the branch and open a PR" was then separately requested and executed** — pushed to
    `origin`, opened as
    [PR #47](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/47), all
    14 CI checks green. **"Merge PR #47" was then separately requested and executed** — merged
    with a real merge commit (not squash/rebase), matching every prior merge in this project's
    history — merge commit `d51e99cdfd0013d54c910949c0d431359d2bfe4a`. Both Vercel projects
    auto-deployed on push to `main` and were verified live directly, not just via CI's own Vercel
    status check — `dashboard-api`'s `/health` returned `build.commitSha ==
d51e99cdfd0013d54c910949c0d431359d2bfe4a`, confirming the exact merged commit is what's serving;
    `GET /service-library/services` returned a clean `401` (route live, `SessionGuard`
    enforcing — not a `404`, which would mean the module never actually deployed); and
    `dashboard-web`'s `/` resolves to `/auth/sign-in` for an unauthenticated visitor, confirming
    the session gate is intact. **The Service Library module backend is now genuinely live in
    production.** No `dashboard-web` UI exists yet for this module, matching the Projects/BKC
    precedent — a separate, not-yet-requested next step. **Update (2026-08-21): the
    `dashboard-web` UI has since been built — see item 33 below.**
33. **`dashboard-web` Service Library UI — built, fully validated, code-reviewed (8 of 10 findings
    fixed), security-reviewed (0 findings above threshold), second-role human reviewed (Jitesh D,
    "Approved"), gated (G4-dashboard-web-service-library, WebDesk Solution, CONFIRM), merged
    ([PR #48](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/48),
    merge commit `3743de4d4b4b33c6e31d7eeba8583cbb0a07e8f0`) — now genuinely live in production
    (2026-08-21).**
    `docs/implementation/dashboard-web-service-library.md` records the full account. Not started
    automatically — built directly on the explicit "Start the dashboard-web UI for Service
    Library" instruction, following the backend's own build-to-production arc (PR #47). Unlike
    Projects/Business Knowledge Center, a real design brief exists for this module —
    `docs/design/dashboard-ui/15-representative-screen-specifications.md` §4 names Service Library
    explicitly (list → detail → editor archetype, Identity/Positioning/Relationships/Status field
    groups, and calls for the shared `ApprovalBlock` component) — built to that brief's own
    grouping, with one deliberate, explicitly-flagged deviation. New `packages/shared-types`
    (`Service`/`ServiceDetail` and the four dimension entity types);
    `lib/service-library-query.ts`/`lib/service-library.ts` (mirroring `business-knowledge-query.ts`/
    `business-knowledge.ts`'s own zero-non-type-import-file split); `ServiceLibraryForm` — the
    first real use of `@webdesk/ui`'s `RelationshipPicker` in this codebase, for the three
    FK-backed relationship fields (`deliverableIds`/`platformIds`/`engagementModelIds`), alongside
    a `TagListField` (initially hand-rolled, then promoted to `packages/ui` in the code-review fix
    round below) for the three unvalidated identifier-list fields
    (`icpIds`/`relatedPageIds`/`relatedCaseStudyIds`, per the backend's own D1 decision — no
    backing entity exists yet to search against); `ServiceStatusActions` (mirrors the backend's
    `TRANSITIONS` table by hand, same pattern as `ProjectStatusActions`/
    `BusinessKnowledgeStatusActions`). **Deliberately does not use the design brief's own named
    `ApprovalBlock` component** — it requires real `submitter`/`submittedAt`/`reviewer` identity
    and a typed rejection reason, none of which `changeServiceApprovalStatusSchema` accepts or the
    `services` table tracks; using it would mean fabricating data or silently discarding a typed
    reason the backend can't persist — documented as an explicit, flagged deviation rather than a
    silent substitution (see the implementation doc §4). Four routes under
    `app/(shell)/service-library/`: list, detail, create, edit — a redacted `internalDescription`
    (on a `restricted`-confidentiality record) renders an inert notice and is omitted from the
    submit payload, the same convention `BusinessKnowledgeRecordForm` already establishes.
    `parentServiceId`/`ownerUserId` exist on the entity but have no form field yet — neither is
    named in the design brief's own field list, and `ownerUserId` follows the identical reasoning
    that deferred Projects' own owner field — flagged as a known, out-of-scope gap rather than
    silently omitted. Two real test bugs (not application bugs) were found and fixed while writing
    tests: jsdom's native HTML constraint validation silently blocked a `submit` event (and
    `handleSubmit`) from firing whenever a required field was left empty in a test, masking what
    the test was trying to exercise — fixed by asserting `.toBeRequired()` directly and by filling
    in the previously-missing required field in two other tests. 308/308 `dashboard-web` unit
    tests (39 new), typecheck/lint/`check-css-tokens.mjs`/`next build`/prettier all clean.
    **Independent code review then ran** (high effort, 8 finder angles) — 10 findings kept after
    dedup (8 CONFIRMED, 2 PLAUSIBLE), **all 8 CONFIRMED fixed**: most severe, `categoryId` being a
    required create-form field with zero seeded service categories and no UI/API to create any,
    making the create form permanently unsubmittable with only an unhelpful native-validation
    bubble — fixed with an inline warning. Also fixed: the list page's filter form silently
    resetting `pageSize` (no hidden field preserved it, matching a gap Projects/BKC's own filter
    forms independently share but weren't touched here); two CSS Modules being the third
    byte-for-byte duplicate of existing Projects/BKC styling (extracted new shared
    `form-fields.module.css`/`status-actions.module.css` bases, mirroring the existing
    `error-message.module.css` composition precedent, and refactored all three form/status-actions
    pairs to compose from them); the approval-status badge map collapsing a live state and a
    permanently terminal one onto the identical color (re-paired so no live state shares a token
    with a dead one); and `TagListField` being a genuinely reusable primitive built privately
    instead of promoted to `packages/ui` alongside `RelationshipPicker` (promoted it, with 3 new
    `packages/ui` unit tests). 2 CONFIRMED findings left as accepted, tracked debt, each requiring
    a change out of scope for a `dashboard-web`-only branch: `ServiceStatusActions` hand-mirroring
    the backend's transition table as an unlinked third copy (the identical, already-accepted
    pattern the two sibling status-actions components already established), and the list page
    over-fetching full long-text fields per row (the identical pattern already accepted as debt on
    the Business Knowledge Center list page). The 2 PLAUSIBLE findings (an orphaned
    relationship-id removal gap with no current UI path to trigger it; `ServiceLibraryForm` having
    no `key` in edit mode, a pre-existing pattern already shared with `ProjectForm`) were left open,
    not silently dropped. Re-validated: 82/82 `packages/ui` unit tests (3 new), 308/308
    `dashboard-web` unit tests, typecheck/lint/`check-css-tokens.mjs`/`next build`/prettier all
    clean. See `docs/implementation/dashboard-web-service-library.md` §9 for the full account.
    **A separate `security-review` skill run then found 0 findings above threshold** — checked and
    ruled out unsafe HTML rendering, the project's own documented open-redirect/unsafe-URL-scheme
    precedent (Projects' `environment.url` stored-XSS), confidential-field (`internalDescription`)
    leakage on both read and write paths, `fetch()` target/credential trust, the error-message
    allowlist, `TagListField`/`RelationshipPicker` as an injection surface, and the CSS Module
    `composes:` refactor. A review packet (published as a Claude artifact — code review + security
    review findings, fixes, and validation evidence, with a decision section) was then prepared for
    the required second-role human review, since the implementing agent cannot also be its own
    reviewer (ADR-0010). **Jitesh D reviewed it and returned "Approved,"** accepting the 2 open
    CONFIRMED tracked-debt items and the 2 open PLAUSIBLE findings as-is. See
    `docs/project-state/dashboard-web-service-library-approval-checklist.md`'s "Sign-off" section.
    **The gate (G4-dashboard-web-service-library) was then separately requested and approved** —
    WebDesk Solution, decision CONFIRM (clean pass, not an override, since the second-role review
    was already complete before the gate was requested), approved commit `ab6b2e8` on branch
    `dashboard-web-service-library` — see `outputs/webdesk-growth-dashboard/project.json`'s
    `gates[]` (`current_gate` now `G4-dashboard-web-service-library`). **This gate approval does
    not itself authorize pushing the branch, opening a PR, or merging** — each remains its own
    separate, not-yet-requested authorization, per this project's standing "no auto-merge" rule.
    **"Push the branch and open a PR" was then separately requested and executed** — pushed to
    `origin`, opened as
    [PR #48](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/48), all
    14 CI checks green. **"Merge PR #48" was then separately requested and executed** — merged
    with a real merge commit (not squash/rebase), matching every prior merge in this project's
    history — merge commit `3743de4d4b4b33c6e31d7eeba8583cbb0a07e8f0`. Both Vercel projects
    auto-deployed on push to `main` and were verified live directly, not just via CI's own Vercel
    status check — `dashboard-api`'s `/health` returned `build.commitSha ==
3743de4d4b4b33c6e31d7eeba8583cbb0a07e8f0`, confirming the exact merged commit is what's serving;
    `dashboard-web`'s new `/service-library` route correctly redirects (307) an unauthenticated
    visitor to `/auth/sign-in` (200) — a transient stale-edge-cache `404` on the very first check
    was ruled out via repeated checks, not a real defect. **The `dashboard-web` Service Library UI
    is now genuinely live in production**, closing out this slice's full build-to-production arc.
    Backend and now the full UI (list, detail, create/edit form, status actions) are both live for
    the Service Library module.
34. **Rich-text editor rollout — Service Library (all 7 Positioning fields) + Projects
    (`description` only) — built, fully validated, live-verified end-to-end against a real local
    stack, code-reviewed (all 9 confirmed findings fixed), security-reviewed (0 findings above
    threshold), second-role human reviewed (Jitesh D, "Approved"), gated (`G4-rich-text-editor`,
    WebDesk Solution, CONFIRM), and merged
    ([PR #49](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/49),
    merge commit `214da2c1984bd27b41d5e399349df3e86e3b0ea1`) — now genuinely live in production
    (2026-08-21/22).**
    `docs/implementation/rich-text-editor-long-fields.md` records the full account. Not started
    automatically — requested directly ("use the rich html editor in place of the text area...
    at every place"). Surveyed every plain `<textarea>` in `apps/dashboard-web/components/` first
    (15 sites, 6 files) and flagged that this also means real backend changes, since neither
    Service Library's nor Projects' DTOs/services sanitize HTML today (only Business Knowledge
    Center's `content` field has that precedent) — two scope questions
    (`AskUserQuestion`) resolved this directly: **which fields switch** (Service Library's all 7 —
    no clear primary/secondary split exists among them; Projects' `description` only — its own
    Objectives/Repositories/Environments sub-resource fields stay plain text) and **whether backend
    sanitization is included in this pass** (yes — mirror Business Knowledge Center's write-time +
    render-time sanitization pattern exactly, not a frontend-only swap that would persist
    unsanitized HTML with only a length cap). `RichTextEditor` (the existing Tiptap component,
    unmodified) replaces the plain `<textarea>`s; `LONG_TEXT_MAX_LENGTH`/`DESCRIPTION_MAX_LENGTH`
    raised (2× — matching Business Knowledge Center's own markup-overhead-driven raise ratio) on
    both frontend and backend; both `services.service.ts` and `project.service.ts` gained a
    `sanitizeLongTextField()` helper (mirroring `sanitize-html.util.ts`'s existing
    `sanitizeContentOrNull()` pattern) wired into `create()`/`update()`; both detail pages switched
    their render sites to `dangerouslySetInnerHTML` + `sanitizeRenderedHtml()`, the same
    defense-in-depth pattern Business Knowledge Center's own detail page already establishes. Two
    real test-writing lessons recorded for this codebase: `RichTextEditor` is a Tiptap
    contentEditable div, not a real form control, so `fireEvent.change`/`toHaveValue` don't apply —
    two existing `project-form.test.tsx` tests that assumed otherwise were fixed to match
    `business-knowledge-record-form.test.tsx`'s own established convention (verify rich-text
    content only via the `initial` prop, never simulated typing). 4 new `dashboard-api` unit tests
    (2 per service) prove a disallowed tag is stripped before reaching the repository layer; 3 new
    `dashboard-web` unit tests add structural "N contenteditable, 0 textarea" + "initial content
    loads" checks. Deliberately not tested: the new submit-time max-length rejection path —
    reliably typing 40,000+ characters via jsdom isn't practical, and Business Knowledge Center's
    own equivalent `CONTENT_MAX_LENGTH` check isn't tested either; this branch follows that same
    accepted gap. 465/465 `dashboard-api` unit tests (4 new), 153/153 `dashboard-api`
    e2e/integration tests (unchanged), 311/311 `dashboard-web` unit tests (3 new), typecheck/lint/
    `check-css-tokens.mjs`/`next build`/prettier all clean across both apps. **Live-verified
    end-to-end**, not just typechecked/built blind — unlike most prior slices, stood up a genuinely
    live local stack (both `dashboard-web` and `dashboard-api` running locally against the
    project's existing disposable-database convention, `webdesk_phase1b_dev`, all 51 migrations
    applied, a real provisioned Super Admin user, a real minted session cookie via a throwaway
    script deleted immediately after use, never committed): confirmed all 7 Service Library
    editors and the 1 Projects editor render with a working toolbar; confirmed typing and Bold
    formatting genuinely work (real `<strong>` output); confirmed a full real create → sanitize →
    persist → re-fetch → render round trip for both modules, with the bold-formatted text
    surviving sanitization and rendering as genuinely bold HTML on each detail page; confirmed
    zero new console/server errors throughout. See
    `docs/implementation/rich-text-editor-long-fields.md` §5 for the full account. **Independent
    code review then ran** (high effort, 8 finder angles, 1-vote verification) — 9 candidates
    surfaced after dedup, all 9 CONFIRMED (0 PLAUSIBLE, 0 REFUTED), **all 9 fixed**. Most severe: a
    real correctness bug where `ProjectForm` never normalized Tiptap's own empty-document output
    (`"<p></p>"`) to an empty string the way Service Library's own `textField()` already did for
    the identical string, so a cleared description was stored and rendered as truthy content,
    permanently showing an empty content box on the detail page instead of "No description." Also
    fixed: a real, previously-undiscovered legacy-data risk — Projects' `description` has held
    real, unsanitized plain-text data since PR #28 (2026-08-17), roughly 4 days of production
    availability before this branch started treating that same stored value as HTML on both the
    edit form (parsed by Tiptap) and the detail page (sanitized), with no migration step for
    existing rows — closed generically, not per-field, via a new `toSafeRichTextValue()` helper
    wired directly into `RichTextEditor` itself (both its initial content and its external-reset
    effect), so every current and future consumer is protected by construction; the lost
    onChange-to-submit test coverage in `project-form.test.tsx` (restored, matching Business
    Knowledge Center's own `initial`-prop testing convention, since jsdom can't simulate typing
    into a Tiptap contentEditable div); `sanitizeLongTextField()` triplicated across two new
    services plus a pre-existing Business Knowledge Center copy (two new shared
    `@webdesk/validation` exports — `sanitizeNullableRichText()`/
    `sanitizeNullableRichTextIfChanged()` — close the two new copies; the pre-existing BKC one is
    left as known, out-of-scope debt); both `update()` methods unconditionally re-sanitizing every
    rich-text field on every save regardless of whether it changed (fixed via
    `sanitizeNullableRichTextIfChanged()`, mirroring the in-file precedent already established for
    `ownerUserId`/`categoryId`); the `"<p></p>"` literal and the submit-time max-length check each
    independently re-implemented per form with no shared helper (both promoted into a new
    `apps/dashboard-web/lib/rich-text.ts`); the `dangerouslySetInnerHTML` +
    `sanitizeRenderedHtml()` pairing hand-rolled at all three detail-page call sites with nothing
    enforcing it — notable given this project's own prior confirmed HIGH stored-XSS finding from
    exactly this kind of unenforced rendering convention — promoted into a new server-only
    `SanitizedRichText` component, now the only place any of the three pages may use
    `dangerouslySetInnerHTML` for rich-text content (including Business Knowledge Center's own
    pre-existing call site, a safe, purely mechanical convergence); and the rich-text-aware empty
    check leaking onto `publicName`, a plain `<input>` (split into `plainTextField()`/
    `richTextField()`). New coverage: `apps/dashboard-web/tests/unit/rich-text.test.tsx` (10 tests
    for the new shared helpers) plus 2 new `project-form.test.tsx` tests. Re-validated: 465/465
    `dashboard-api` unit tests, 323/323 `dashboard-web` unit tests (12 new), `pnpm audit` 0
    vulnerabilities, typecheck/lint/`check-css-tokens.mjs`/`next build`/`nest build`/prettier all
    clean across `apps/dashboard-api`, `apps/dashboard-web`, and `packages/validation`. See
    `docs/implementation/rich-text-editor-long-fields.md` §6 for the full account. **A separate
    `security-review` skill run then found 0 findings above threshold** — focused specifically on
    the sanitization boundary this branch touches directly (`dangerouslySetInnerHTML` via the new
    `SanitizedRichText` component, `toSafeRichTextValue()`'s tag-prefix regex, and the two new
    `@webdesk/validation` sanitize wrappers), confirming: the sanitizer allowlist itself is
    byte-identical to `main` (only new wrapper functions were added around it); every rich-text
    render site across all three detail pages routes exclusively through the new
    `SanitizedRichText` component with no bypass path; `toSafeRichTextValue()`'s
    "already-looks-like-rich-text" branch is not a sanitization bypass, since the render-time
    sanitizer still runs afterward regardless of which branch executes; and
    `sanitizeNullableRichTextIfChanged()`'s skip-if-unchanged optimization introduces no new
    exposure, since render-time sanitization still runs on every read regardless of what's stored.
    Also directly verified (via inspecting the installed `@tiptap/extension-link` package's own
    source) that Tiptap's own Link extension independently blocks non-allowlisted URL schemes
    (`javascript:`/`data:`) at parse/render/command time, closing the one client-side edit-path
    scenario considered. **"Push the branch and open a PR" was then separately requested and
    executed** — pushed to `origin`, opened as
    [PR #49](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/49), all
    14 CI checks green. **"Merge PR #49" was then requested directly** — held per this project's
    standing discipline (required second-role human review, then a gate decision, each separate,
    before merge — neither had happened yet). Asked the user directly whether to prepare the
    review packet first or proceed as an explicit override (the Phase 1C G4-1C pattern); the user
    chose to prepare the packet first. A review packet (published as a Claude artifact, "Rich-Text
    Editor Review Packet" — code review + security review findings, fixes, and validation
    evidence, with a decision section) was prepared for the required second-role human review,
    since the implementing agent cannot also be its own reviewer (ADR-0010). **Jitesh D reviewed
    it and returned "Approved,"** no disputes raised — 0 open findings of any kind on this branch.
    See `docs/project-state/rich-text-editor-long-fields-approval-checklist.md`'s "Sign-off"
    section. **The gate (`G4-rich-text-editor`) was then separately requested and approved** —
    WebDesk Solution, decision CONFIRM (clean pass, not an override, since the second-role review
    was already complete before the gate was requested), approved commit `69ab89e` on branch
    `rich-text-editor-long-fields` — see `outputs/webdesk-growth-dashboard/project.json`'s
    `gates[]` (`current_gate` now `G4-rich-text-editor`) and the approval checklist's "Sign-off"
    section. **"Merge PR #49" was then separately requested and executed** — waited for the
    latest CI run (triggered by the review-packet/gate docs commit) to finish, all 14 checks
    green, then merged with a real merge commit (not squash/rebase), matching every prior merge in
    this project's history — merge commit `214da2c1984bd27b41d5e399349df3e86e3b0ea1`. Both Vercel
    projects auto-deployed on push to `main` and were verified live directly, not just via CI's own
    Vercel status check — `dashboard-api`'s `/health` returned `build.commitSha ==
214da2c1984bd27b41d5e399349df3e86e3b0ea1`, confirming the exact merged commit is what's serving;
    `dashboard-web`'s `/` resolves (via the intermediate `/home` hop) to `/auth/sign-in` for an
    unauthenticated visitor, confirming the session gate is intact. **The rich-text editor rollout
    — Service Library's 7 Positioning fields and Projects' `description`, plus real backend HTML
    sanitization and the shared `SanitizedRichText` render component — is now genuinely live in
    production.**
35. **Persona Library module backend — built, reviewed, gated, merged; now live in production
    (2026-08-22).**
    `docs/implementation/module-persona-library.md` records the full account. The
    fourth real business-module backend on the Phase 1F application shell / canonical module
    registry, after Projects, Business Knowledge Center, and Service Library — module #4 in the
    project-owner-supplied `Recommended_Module_Roadmap.md`. Built directly on the explicit "Start
    the Persona Library" instruction, using Service Library as the literal structural template
    (same `service_persona_proof` RBAC group, no new RBAC migration). Two scoping decisions
    confirmed directly with the user first (`AskUserQuestion`): content edits stay independent of
    `approvalStatus`, mirroring Service Library's own precedent — the roadmap's "cannot silently
    modify approved personas" rule (aimed at the dashboard's planned "Growth Director" AI agent,
    not a human role) is already satisfied by the existing gated transition table; and Service
    Library's own `icpIds` field is **not** retrofitted to a real relationship in this pass —
    Persona Library stays fully standalone (`relatedServiceIds` is a plain unvalidated string
    array, mirroring `icpIds`/`relatedPageIds`/`relatedCaseStudyIds`). Single-table schema
    (`personas`, migration `00052`), since the canonical spec is a flat field list with no basis
    for splitting across entities. The `approvalStatus` workflow and its `TRANSITIONS` table are
    reused verbatim from Service Library's own already-code-reviewed version, including the atomic
    compare-and-swap status update. `version` is new behavior Service Library doesn't have — a
    server-managed integer incremented as part of the same `UPDATE` statement via a
    Postgres-evaluated `version + 1` literal, satisfying the canonical spec's own explicit
    "version" field without a read-then-write race. `@RequirePermission` is placed on every
    individual controller method, never at class level — the exact bug Service Library's own
    dimensions controller had and fixed. Both `packages/database` barrel entrypoints (`index.ts`
    and `index.cjs.ts`) were updated, per this project's own documented caution about the
    separately-maintained CJS build Vercel's bundler actually uses in production. **Built by a
    background agent, then independently re-verified by the orchestrating session** — a first
    attempt at delegating this build returned only a description of a plan with zero real file
    changes (caught via a direct `git status` check before it was trusted); the second attempt,
    with a more directive prompt, did the real work. Every test suite the agent reported was
    re-run directly (not just trusted): 493/493 `dashboard-api` unit tests (28 new), 28/28
    `packages/database` unit tests (unaffected), 184/184 `packages/database` integration tests (14
    new, real disposable PostgreSQL), 168/168 `dashboard-api` e2e tests (15 new, real disposable
    database + real seeded RBAC, including the full 3-tier submit/review/approve matrix), a real
    migration up/down/up round-trip, `validate:module-registry` (43 modules, 21 permission groups),
    `pnpm audit` (0 vulnerabilities), and prettier — all independently confirmed clean, plus a
    direct code read of the highest-risk files (migration, controller RBAC placement, service
    transition table, repository's atomic update/compare-and-swap). `apps/dashboard-web` is
    untouched — backend only, matching every prior module's own precedent. **Independent code
    review then ran** (high effort, 8 finder angles, 1-vote verification) — 12 candidates surfaced
    after dedup, 11 CONFIRMED and 1 downgraded to PLAUSIBLE (inherited precedent), 10 kept in the
    final report per the review's own cap, **9 fixed, 1 left as accepted, tracked debt**. Most
    severe: `update()` unconditionally incremented `version` even on a fully empty patch (`{}`),
    burning a version number and an empty-`afterState` audit event for a no-op save — fixed with a
    Zod `.refine()` rejecting an empty patch with a clean 400. Also fixed: `relatedServiceIds` had
    zero existence validation despite the `services` table already existing (weaker than the
    precedent it claimed to follow — Service Library's own unvalidated fields point at genuinely
    nonexistent modules), closed by adding `findByIds()` to `ServiceRepository`, exporting
    `SERVICE_REPOSITORY` from `ServiceLibraryModule`, and wiring a new
    `assertServiceIdsExist()` — with a malformed-UUID guard added along the way, since a raw
    non-UUID id would otherwise crash Postgres's `uuid` column type with a 500 instead of a clean
    400 (caught during the fix itself, not the original review); `update()` pre-fetching a persona
    via `findById()` it never used (unlike Service Library's identical-looking pattern, where the
    fetched value is load-bearing); `updateStatus()` doing a separate `findByPk` read instead of
    `returning: true`, inconsistent with its own sibling method; a missing `pg_trgm` trigram index
    on `name`, unlike Service Library's own migration one module earlier; array fields rejecting
    an explicit `null` to clear while every scalar field accepted it; `create()`'s TOCTOU `publicId`
    race surfacing as a raw 500 (fixed via `error.name === "SequelizeUniqueConstraintError"`, not
    `instanceof`, since `dashboard-api` never imports `sequelize` directly per ADR-0006's own
    architectural boundary — a real compile error the typecheck step caught, not something assumed
    up front); `list()`'s pagination having no tiebreaker on `updatedAt`; and the repository's
    `create()`/`update()` input types being hand-typed instead of derived via `Omit`/`Pick` from
    `PersonaEntity`. **1 CONFIRMED finding left as accepted, tracked debt**: the entire 8-state
    `TRANSITIONS` table and `changeApprovalStatus()` method is a byte-for-byte duplicate of Service
    Library's identical, already-code-reviewed pattern, with no shared "artifact approval workflow"
    abstraction anywhere in `packages/` — extracting one for a single new consumer during a
    review-fix pass was judged disproportionate. Re-validated: 500/500 `dashboard-api` unit tests (7
    new), 185/185 `packages/database` integration tests (1 new), 171/171 `dashboard-api` e2e tests
    (3 new plus a rewrite of one existing test whose premise the fix changed), migration up/down/up
    round-trip clean, `validate:module-registry` passing, `pnpm audit` 0 vulnerabilities,
    `boundaries:check` 0 violations, typecheck/lint/prettier all clean. See
    `docs/implementation/module-persona-library.md` §7 for the full account. **A separate
    `security-review` skill run then found 0 findings above threshold** — confirmed every
    `@RequirePermission` decorator is method-level (never class-level), the dynamic per-transition
    RBAC gate in `changeApprovalStatus()` matches the real seeded `service_persona_proof` matrix
    exactly, all queries are parameterized, Zod strips unknown keys (no mass-assignment path), the
    `SequelizeUniqueConstraintError` catch leaks no internal SQL/constraint detail, the UUID guard
    correctly blocks a malformed id before it reaches the database, and `assertServiceIdsExist()`
    exposes only `.id` from returned service rows (no confidential-field leak). One low-confidence
    (2/10) design-quality observation was noted for the record, not reported as a finding: the new
    `SERVICE_REPOSITORY` export from `ServiceLibraryModule` (needed for the read-only
    `findByIds()` existence check) exposes the full write-capable repository across the module
    boundary rather than a narrow delegating method — the identical pattern this project's own
    `module-projects-backend-closeout` review already flagged and fixed once for
    `USER_ROLE_REPOSITORY`/`AuthzModule` — currently unreachable since `PersonasService` only ever
    calls `.findByIds()` on it, but worth closing the same way if this module's surface grows.
    **"Push the branch and open a PR" was then separately requested and executed** — pushed to
    `origin`, opened as
    [PR #50](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/50), all
    14 CI checks green. **A review packet for the required second-role human review was then
    prepared and published** — see
    `docs/project-state/module-persona-library-approval-checklist.md`. **Jitesh D reviewed it and
    returned "Approved as-is,"** accepting the 1 open CONFIRMED code-review finding (the
    duplicated `TRANSITIONS` table) as tracked debt. **The gate (G4-persona-library) was then
    separately requested and approved** — WebDesk Solution, decision CONFIRM (clean pass, not an
    override, since the second-role review was already complete before the gate was requested),
    approved commit `0c5115d` on branch `module-persona-library` — see
    `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
    `G4-persona-library`). **"Merge PR #50" was then separately requested and executed** — one CI
    failure (Formatting validation, on the hand-edited gate-approval table rows) was found and
    fixed first; merge commit `05c5eadd0edb38da1a9988828852cee48a4aedb0`, all 14 CI checks green
    beforehand. Both Vercel projects auto-deployed on push to `main` and were verified live
    directly — `dashboard-api`'s `/health` returned `build.commitSha ==
05c5eadd0edb38da1a9988828852cee48a4aedb0`, `GET /persona-library/personas` returned a clean `401`
    (route live, `SessionGuard` enforcing — not a `404`), and `dashboard-web`'s `/` resolves (via
    the intermediate `/home` hop) to `/auth/sign-in` for an unauthenticated visitor. **The Persona
    Library module backend is now genuinely live in production.** No `dashboard-web` UI exists yet
    for this module — a separate, not-yet-requested next step, matching the Projects/BKC/Service
    Library precedent. **The production migration was then run** — user ran migrations `00052`
    (`create-persona-library`) and `00053` (`mark-persona-library-in-development`) themselves,
    same credential-handling discipline as every prior production migration. The earlier "verified
    live" check above confirmed the deployed Function boots and the route exists (`SessionGuard`
    rejecting an unauthenticated request with a clean `401`), but a `401` returns before any
    database query runs, so it didn't independently prove the `personas` table itself existed —
    this migration closes that specific gap. **The Persona Library backend's schema is now
    genuinely live in production.**
36. **`dashboard-web` Persona Library UI — built, reviewed, gated, merged; now live in
    production (2026-08-22).** Closes the Persona Library module's last named gap,
    following the backend's own build-to-production arc (PR #50). Not started
    automatically — built directly on the explicit "Start the dashboard-web UI for it"
    instruction. No approved wireframe/screen spec exists for this module —
    `03_Detailed_Module_Specifications.md §21`'s own flat field list is the only source; sections
    mirror its grouping (Identity, Buyer profile, Narrative, Relationships, Status), the smallest
    honest reading of the backend's actual field set, matching the Projects/BKC/Service Library
    list/detail/form pages' own precedent for an unsourced screen. New `packages/shared-types`
    `Persona`/`PersonaApprovalStatus` — a single flat shape, unlike Service's own `Service`/
    `ServiceDetail` split, since Persona Library has no sub-resource dimension tables to omit
    from the list view. `lib/persona-library-query.ts`/`lib/persona-library.ts` mirror
    `lib/service-library-query.ts`/`lib/service-library.ts`'s own zero-non-type-import-file
    split. Every long-text field (`goals`/`pains`/`triggers`/`objections`/`decisionCriteria`/
    `badFitSignals`/`messagingTrack`/`ctaPreferences`) is a plain `<textarea>`, not the
    `RichTextEditor` Service Library/Projects use — this module was explicitly out of scope for
    the rich-text editor rollout, and the backend's own DTO stores these fields unsanitized as
    plain text, so treating them as HTML would be dishonest. `roles`/`industries` are free-text
    `TagListField`s (unvalidated, matching Service Library's own `icpIds` shape);
    `relatedServiceIds` is a real, existence-validated `RelationshipPicker` against the
    `services` table — the one genuine cross-module relationship this module has, populated via
    a new `getServicesForPersonaPicker()` that reuses the existing `getServices()` fetch at its
    largest real page size (100), rather than a new fetch function. `PersonaStatusActions`
    mirrors the backend's `TRANSITIONS` table by hand, reused verbatim from
    `ServiceStatusActions` since the backend's own table is itself a direct copy of Service
    Library's (D3) — same deliberate non-use of the shared `ApprovalBlock` component, for the
    identical reason `ServiceStatusActions` already documents (the backend's status-transition
    endpoint captures no submitter/reviewer identity or reason). 40 new `dashboard-web` unit
    tests (22 lib, 8 form, 10 status-actions), 363/363 overall passing;
    typecheck/lint/`check-css-tokens.mjs`/`next build`/prettier all clean across
    `packages/shared-types` and `dashboard-web`, also re-verified clean on `dashboard-api` and
    `dashboard-worker` (both consumers of the additive shared-types change); `pnpm audit` 0
    vulnerabilities. **Live-rendered in the Browser pane**: all four new `/persona-library`
    routes confirmed to redirect an unauthenticated visitor to `/auth/sign-in` cleanly, zero
    console/server errors. Committed to branch `dashboard-web-persona-library` (not yet pushed
    to `origin` at build time). **Independent code review then ran** (this project's own
    `code-review` skill, medium effort presented, 8-angle finder pass run in full, 1-vote
    verification) — 8 candidates surfaced after dedup, **all 8 CONFIRMED**, 6 fixed and 2 left as
    accepted, tracked debt. Most severe: the `RelationshipPicker`'s selected chips silently
    dropped any `relatedServiceIds` entry outside the picker's 100-row fetch window with no
    fallback, unlike the detail page's own raw-id fallback for the identical case — fixed to
    show the raw id as its own chip, so a real relationship is never invisible or unremovable in
    this UI (two independent finder angles converged on this one). Also fixed:
    `getServicesForPersonaPicker()` had no failure isolation from the primary persona fetch, so a
    transient Service Library outage crashed the entire detail/edit/new page — fixed to degrade
    to an empty list on failure, logged server-side; the `services` prop was typed as the full
    ~19-field `Service` entity when only 3 fields are ever read, diverging from the sibling
    `Deliverable`/`PlatformTechnology`/`EngagementModel` narrow-type convention — narrowed to
    `Pick<Service, "id" | "publicName" | "canonicalName">`; `APPROVAL_STATUS_LABEL`/
    `APPROVAL_STATUS_BADGE` were byte-for-byte identical to Service Library's own maps with no
    module-specific reason to diverge — extracted into a new shared
    `lib/artifact-approval-status.ts`, consumed by both modules' query files; the detail page
    re-declared 6 style constants as a 4th independent copy of the identical block already in 3
    sibling detail pages (Projects/Service Library/Business Knowledge Center), past this
    project's own documented "extract after the second occurrence" precedent — extracted into a
    new shared `lib/detail-section-styles.ts`, consumed by all 4 detail pages (Projects' own real
    `dlStyle` margin divergence preserved via composition, not silently dropped); and the list
    page re-declared `selectStyle`/`submitButtonStyle` as a 3rd independent copy — extracted into
    a new shared `lib/list-filter-styles.ts`, consumed by all 3 list pages. 2 CONFIRMED findings
    left as accepted, tracked debt, recorded directly in code for the second-role reviewer:
    Persona Library's picker depends on Service Library's RBAC module key by coincidence (both
    independently declare the identical `MODULE_KEY` literal) — noted in
    `personas.controller.ts`'s own doc comment; and `PersonaStatusActions` is now a 4th
    independent hand-copy of the approval-transition table shape, meaning the earlier
    "disproportionate for one consumer" debt-acceptance reasoning (first recorded for
    `ServiceStatusActions`'s own 3rd-copy acceptance) needs re-litigating at 4 consumers — flagged
    explicitly in the component's own doc comment. 3 new regression tests added. Re-validated:
    366/366 `dashboard-web` unit tests, 500/500 `dashboard-api` unit tests, typecheck/lint/
    `check-css-tokens.mjs`/`next build`/prettier all clean, `pnpm audit` 0 vulnerabilities.
    Live-rendered again in the Browser pane: Persona Library, Service Library, Business
    Knowledge Center, and Projects (list and detail — all touched by the style-extraction fixes)
    all confirmed to redirect an unauthenticated visitor cleanly, zero server errors. **A
    separate `security-review` skill run then found 0 findings above threshold** — focused
    specifically on the new raw-id-fallback rendering (confirmed plain JSX text, no
    `dangerouslySetInnerHTML`, not an XSS vector), the pure CSS/constant extraction (every
    extracted value confirmed byte-identical to what it replaced), the `Pick<>` prop narrowing
    (TypeScript-only, runtime payload unchanged), and the doc-comment-only backend edit
    (confirmed no behavior change via diff). A review packet (published as a Claude artifact —
    code review + security review findings, fixes, and validation evidence, with a decision
    section) was then prepared for the required second-role human review, since the
    implementing agent cannot also be its own reviewer (ADR-0010). See
    `docs/project-state/dashboard-web-persona-library-approval-checklist.md`. **Jitesh D
    reviewed it and returned "Approved as-is,"** accepting the 2 open CONFIRMED findings (the
    RBAC module-key coupling and the transitions-table quadruplication) as tracked debt. **The
    gate (`G4-dashboard-web-persona-library`) was then separately requested and approved** —
    WebDesk Solution, decision CONFIRM (clean pass, not an override, since the second-role
    review was already complete before the gate was requested), approved commit `b7ba3e8` on
    branch `dashboard-web-persona-library` — see `outputs/webdesk-growth-dashboard/project.json`'s
    `gates[]` (`current_gate` now `G4-dashboard-web-persona-library`). **"Push the branch and
    open a PR" was then separately requested and executed** — pushed to `origin`, opened as
    [PR #51](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/51), all
    14 CI checks green. **"Merge PR #51" was then separately requested and executed** — merge
    commit `e879be801c780be7c0a2af18250071b017873e28`, all 14 CI checks green beforehand. Both
    Vercel projects auto-deployed on push to `main` and were verified live directly —
    `dashboard-api`'s `/health` returned `build.commitSha ==
e879be801c780be7c0a2af18250071b017873e28`, `GET /persona-library/personas` returned a clean
    `401` (route live, `SessionGuard` enforcing — not a `404`), and `dashboard-web`'s
    `/persona-library` resolves (307) to `/auth/sign-in` for an unauthenticated visitor (a
    transient stale-edge-cache `404` on the very first check was ruled out via repeated
    cache-busted checks, not a real defect). **The `dashboard-web` Persona Library UI is now
    genuinely live in production**, closing out the Persona Library module's full
    build-to-production arc — backend and now the full UI (list, detail, create/edit form,
    status actions) are both live.
37. **Persona Library's 8 narrative fields converted to the rich-text editor — built, fully
    validated, code-reviewed (5 of 8 findings fixed, 3 accepted as tracked debt), security-reviewed
    (0 findings above threshold), required second-role human reviewed (Jitesh D, "Approved"),
    gated (G4-persona-library-rich-text, WebDesk Solution, CONFIRM), merged
    ([PR #52](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/52),
    merge commit `f258b3627305914e9d1d59eecac696c313400719`) — now genuinely live in production
    (2026-08-22).** Closes the gap the 2026-08-22 standing rule ("from now
    onward we must have to use rich text html editor for all the text area") left open — Persona
    Library's own UI
    (item 36) had shipped with plain `<textarea>` fields one day earlier, since it was built while
    the app-wide rich-text rollout (Service Library + Projects, item 34) was already scoped and in
    progress. Built directly on the explicit "change text area to rich text html editor in New
    persona" instruction. Mirrors Service Library's own already-reviewed pattern exactly:
    `goals`/`pains`/`triggers`/`objections`/`decisionCriteria`/`badFitSignals`/`messagingTrack`/
    `ctaPreferences` now render via the existing `RichTextEditor` component (unmodified);
    `LONG_TEXT_MAX_LENGTH` raised 20,000 → 40,000 on both frontend and backend, the same
    markup-overhead ratio Business Knowledge Center/Service Library already established;
    `personas.service.ts` wires `sanitizeNullableRichText()`/`sanitizeNullableRichTextIfChanged()`
    into `create()`/`update()` for all 8 fields, reintroducing a pre-fetch a prior code-review pass
    had removed (now load-bearing again for the skip-if-unchanged optimization); the detail page
    renders each field via the shared `SanitizedRichText` component instead of plain text.
    **Live end-to-end verified** against a real local `dashboard-api` instance and disposable
    database, not just typechecked/built blind: a real create call with an embedded `<script>` tag
    returned the sanitized HTML with the script stripped and safe `<strong>` formatting preserved;
    a real update call with an `<img onerror>` payload was likewise stripped, the sibling
    plain-text `buyerType` field updated correctly, and `version` incremented as expected. 503/503
    `dashboard-api` unit tests (3 new), 366/366 `dashboard-web` unit tests, typecheck/lint/
    `check-css-tokens.mjs`/`next build`/`nest build`/prettier all clean, `pnpm audit` 0
    vulnerabilities. Committed to branch `persona-library-rich-text-editor` (not yet pushed).
    **Independent code review then ran** (this project's own `code-review` skill, 8 finder angles
    run via parallel subagents, each self-verified against real signatures/git history/sibling-
    module precedent) — 8 candidates surfaced after dedup (5 CONFIRMED, 3 PLAUSIBLE). 5 fixed per
    explicit "fix the confirmed findings" instruction — most notable: `toSafeRichTextValue()`'s
    legacy-plain-text escaping never converted embedded newlines to `<br>`, so a pre-existing
    multi-line value (in Persona Library, Service Library, or Projects — this is shared rendering
    infrastructure) collapsed onto one run-on line once the old textarea's `pre-wrap` rendering was
    removed; fixed generically in `lib/rich-text.ts`'s `escapeHtml()`, benefiting every module
    sharing the helper, not just Persona Library. Also fixed: `update()`'s reintroduced pre-fetch
    ran sequentially before an independent FK check (now parallelized via `Promise.all`, matching
    `create()`'s own pattern); `richTextField()`'s nullish-contract logic was hand-duplicated
    verbatim between `persona-library-form.tsx` and `service-library-form.tsx` (extracted into a
    new `richTextFieldValue()` export in `lib/rich-text.ts`); `richContentStyle` was independently
    declared a 3rd time across three detail pages that already import 6 other constants from the
    shared `lib/detail-section-styles.ts` module built to stop exactly this (extracted, retrofitted
    onto all three); and the "skips re-sanitizing an unchanged field" test used an already-clean
    fixture, unable to distinguish "skipped" from "ran and produced identical output" (a second
    test added using a value the real sanitizer would visibly change if it ran). **3 findings left
    as accepted, tracked debt, recorded directly in code**: a doc comment overclaiming "sanitized
    before storage" for every field, true only for a field a caller actually changes (corrected,
    not an active exploit since render-time sanitization still protects every read); the per-field
    sanitize-call boilerplate being a 3rd near-identical hand-enumerated occurrence after Service
    Library/Projects with no shared helper (a real fix means retrofitting already-shipped call
    sites, out of scope for a Persona-Library-only branch); and the audit event's `afterState`
    recording raw, pre-sanitization HTML, the byte-identical pattern Service Library's own
    `update()` already has (not a new deviation this diff introduces). Re-validated: 504/504
    `dashboard-api` unit tests (4 new), 370/370 `dashboard-web` unit tests (7 new), 15/15 Playwright
    tests (including both authenticated-shell axe-core scans), typecheck/lint/
    `check-css-tokens.mjs`/`next build`/`nest build`/prettier all clean, `pnpm audit` 0
    vulnerabilities. **A separate `security-review` skill run then found 0 findings above
    threshold** — a dedicated sub-task traced the new `\n`→`<br>` conversion end-to-end through
    both the client-side editor and the render-time sanitizer, confirming the `<br>` literal is
    fixed and hardcoded (never attacker-derived), runs strictly after `&`/`<`/`>` are already
    escaped (no ordering bypass), and that `sanitizeRenderedHtml`/`sanitizeRichTextHtml` still runs
    unconditionally afterward on every render — this new code path does not bypass sanitization for
    legacy plain-text values. The `Promise.all` parallelization was also confirmed to introduce no
    authorization-bypass window (RBAC enforcement happens in the guard layer before either read
    runs), and both pure-refactor extractions were confirmed behaviorally identical to what they
    replaced. A review packet (published as a Claude artifact, "Persona Library Rich-Text Editor
    Review Packet" — code review + security review findings, fixes, and validation evidence, with a
    decision section) was then prepared for the required second-role human review, since the
    implementing agent cannot also be its own reviewer (ADR-0010). See
    `docs/project-state/persona-library-rich-text-editor-approval-checklist.md`. **Jitesh D
    reviewed it and returned "Approved,"** accepting the 3 open findings as tracked debt. **The
    gate (G4-persona-library-rich-text) was then separately requested and approved** — WebDesk
    Solution, decision CONFIRM (clean pass, not an override, since the second-role review was
    already complete before the gate was requested), approved commit `33a7f3c` on branch
    `persona-library-rich-text-editor` — see `outputs/webdesk-growth-dashboard/project.json`'s
    `gates[]` (`current_gate` now `G4-persona-library-rich-text`). **"Push the branch and open a
    PR" was then separately requested and executed** — pushed to `origin`, opened as
    [PR #52](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/52), all
    14 CI checks green. **"Merge PR #52" was then separately requested and executed** — merge
    commit `f258b3627305914e9d1d59eecac696c313400719`, all 14 CI checks green beforehand. Both
    Vercel projects auto-deployed on push to `main` and were verified live directly, not just via
    CI's own Vercel status check — `dashboard-api`'s `/health` returned `build.commitSha ==
f258b3627305914e9d1d59eecac696c313400719`, confirming the exact merged commit is what's serving;
    `GET /persona-library/personas` returned a clean `401` (route live, `SessionGuard` enforcing —
    not a `404`); and `dashboard-web`'s `/` resolves (via the intermediate `/home` hop) to
    `/auth/sign-in` for an unauthenticated visitor, confirming the session gate is intact. **The
    Persona Library rich-text editor conversion is now genuinely live in production.**
38. **Proof and Claims Library module backend — built, fully validated, code-reviewed (5 of 7
    findings fixed, 2 accepted as tracked debt), security-reviewed (0 findings above threshold),
    required second-role human reviewed (Jitesh D, "Approved"), gated
    (G4-proof-and-claims-library, WebDesk Solution, CONFIRM), merged
    ([PR #53](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/53),
    merge commit `b7f6575a5e0d1860e32864528cc9f005b77d1477`) — now genuinely live in production
    (2026-08-22/23).** The
    5th real business-module backend on the Phase 1F application shell / canonical module
    registry, after Projects, Business Knowledge Center, Service Library, and Persona Library —
    module #5 in the project-owner-supplied `Recommended_Module_Roadmap.md`. Built directly on
    the explicit "Start the Proof & Claims Library" instruction. A real two-table schema
    (`proof_claims` parent, `claim_sources` a genuine one-to-many child) rather than a JSONB
    array — confirmed directly with the user (`AskUserQuestion`), since
    `04_Data_Model_and_Ownership.md:119-120` explicitly names both tables separately, the same
    class of storage-architecture decision Business Knowledge Center's own single-vs-multi-table
    question was. Reuses the same `service_persona_proof` RBAC group Service Library and Persona
    Library both use — no new RBAC migration. **No confidentiality field** — the module
    registry's own seeded `confidentialityLevel` for `proof_and_claims_library` is `null`, the
    identical value Persona Library's own entry has, and Persona Library's build already decided
    not to add a Service-Library-style confidentiality mechanism for exactly that reason; the
    advisory-only `Recommended_Module_Roadmap.md`'s "confidential claims need separate access
    control" note "is recorded-for-reference only and authorizes nothing" per this project's own
    standing rule — the module registry's own real seeded data wins. `relatedServiceIds` is
    existence-validated against the real `services` table; `relatedCaseStudyIds`/
    `relatedPageIds` stay unvalidated arrays — `case_study_studio`/`page_inventory` don't exist
    yet. `verificationStatus` (`unverified`/`pending`/`verified`) is grounded directly in the
    roadmap's own language ("Evidence first... public content cannot use an unverified claim") —
    no enforcement point exists yet since no consuming module is built, none is fabricated here.
    No `version` field, unlike Persona Library — the canonical spec names none for this module.
    `approvalStatus` reuses Service Library's/Persona Library's exact `TRANSITIONS` table and
    atomic compare-and-swap `updateStatus()` pattern verbatim, a 3rd occurrence of this identical
    shape, deliberately not extracted into a shared helper (already-accepted, out-of-scope debt).
    `claim_sources` is a genuine Projects-style sub-resource — its own repository/service/
    controller, scoped CRUD, and IDOR-prevention at both the service and repository layers, built
    correctly from day one. Backend-only pass — `claim`/`approvedWording`/`restrictions` are
    plain unsanitized text fields, matching Persona Library's own original (pre-rich-text-editor)
    backend build; no `dashboard-web` UI exists yet for this module. **Built by a background
    agent with a highly directive, fully-specified prompt (exact schema, file list, exact
    patterns to mirror per file), then independently re-verified in full by the orchestrating
    session** — every file read directly, not just trusted from the agent's report: the
    migration's `up()`/`down()` order, both `packages/database` barrel files (`index.ts` AND
    `index.cjs.ts`, the documented production-outage gap), RBAC decorator placement (method-level
    throughout, both controllers), the `TRANSITIONS` table's exact values, the atomic
    compare-and-swap repository methods, and the IDOR-prevention scoping at both layers. All
    validation re-run independently against a real local disposable PostgreSQL 17 database:
    548/548 `dashboard-api` unit tests (44 new), 207/207 `packages/database` integration tests
    (22 new), 192/192 `dashboard-api` e2e/integration tests (21 new, including the full 3-tier
    submit/review/approve RBAC matrix and the IDOR-prevention test, verified in isolation), a
    real migration down/up/down/up round-trip (55 migrations, 0 pending after),
    `validate:module-registry` (43 modules, 21 permission groups, unaffected), `pnpm audit` (0
    vulnerabilities), typecheck/lint (`--max-warnings=0`)/prettier all clean. **Independent code
    review then ran** (this project's own `code-review` skill, high effort, 8 finder angles run
    via parallel subagents, each self-verified against real code) — 7 candidates surfaced after
    dedup (5 CONFIRMED, 2 PLAUSIBLE). 5 fixed — most notable: `sourceUrl` had no URL-scheme
    validation (3 finder angles independently converged on this), repeating the exact stored-XSS
    gap Projects' own `environment.url` shipped with once and had to fix after the fact; now uses
    the shared `safeHttpUrlSchema` (`@webdesk/validation`), the helper that earlier fix was
    promoted into specifically to prevent this recurring. Also fixed: the write-capable
    `SERVICE_REPOSITORY` token being injected raw into a 2nd external consumer
    (`ClaimsService`) — exactly the "surface grows" condition Persona Library's own security
    review had named as the trigger for closing this exposure, fixed by adding
    `ServicesService.existingServiceIds()` (a narrow, read-only delegating method returning only
    a `Set<string>` of found ids) and removing `ServiceLibraryModule`'s direct export of
    `SERVICE_REPOSITORY`, updating both `PersonasService` and `ClaimsService` together since
    removing the export had to happen atomically for both; `claim-sources` `create()` never
    checking the parent `claimId` existed before inserting, surfacing a raw 500 instead of a
    clean 404 on a well-formed but nonexistent id (fixed with a `findById()` check first);
    `ClaimSourceRepository.update()` being a non-atomic `findOne()` + `instance.update()`, unlike
    every other scoped-write path in this module (fixed to a single atomic `UPDATE ...
RETURNING`); and two byte-identical id-list Zod schemas declared twice under different names in
    the same file (collapsed to one). **2 findings left as accepted, tracked debt, recorded
    directly in code**: `assertServiceIdsExist()`'s wrapper shape is still a 2nd byte-for-byte
    copy of `PersonasService`'s own, even after the `SERVICE_REPOSITORY` fix consolidated the
    actual DB-query logic (a real fix means a shared `@webdesk/validation` helper, out of
    proportion for a review-fix pass already touching a third module); and the audit-write
    failure catch on `changeApprovalStatus()` only `console.error`'s, the byte-identical
    already-accepted pattern `PersonasService`/`ServicesService` both have. Re-validated: 552/552
    `dashboard-api` unit tests (48 new), 207/207 `packages/database` integration tests (22 new),
    194/194 `dashboard-api` e2e/integration tests (23 new, including 2 new tests proving both the
    claim-not-found 404 fix and the `javascript:` `sourceUrl` rejection), plus Persona Library's
    and Service Library's own e2e suites re-run and confirmed passing after the shared DI wiring
    change, typecheck/lint/prettier all clean, `pnpm audit` 0 vulnerabilities. **A separate
    `security-review` skill run then found 0 findings above threshold** — confirmed every
    `@RequirePermission` decorator is method-level in both controllers, the status-transition
    RBAC gate matches the real seeded `service_persona_proof` matrix exactly (correct separation
    of duties — `marketing_editor` can submit/review but never approve, `owner_growth_approver`/
    `super_admin` can approve but never submit), claim-source IDOR scoping is real DB-level
    `WHERE`-clause scoping, `existingServiceIds()` exposes only a `Set<string>` with no write
    capability, `safeHttpUrlSchema` correctly allowlists only `http:`/`https:`, search correctly
    uses `escapeLikePattern()`, and audit-log payloads carry only business data, never secrets. A
    review packet (published as a Claude artifact, "Proof and Claims Library Review Packet" —
    code review + security review findings, fixes, and validation evidence, with a decision
    section) was then prepared for the required second-role human review, since the implementing
    agent cannot also be its own reviewer (ADR-0010). See
    `docs/project-state/module-proof-and-claims-library-approval-checklist.md`. **Jitesh D
    reviewed it and returned "Approved,"** accepting the 2 open findings as tracked debt. **The
    gate (G4-proof-and-claims-library) was then separately requested and approved** — WebDesk
    Solution, decision CONFIRM (clean pass, not an override, since the second-role review was
    already complete before the gate was requested), approved commit `d8cccc1` on branch
    `module-proof-and-claims-library` — see `outputs/webdesk-growth-dashboard/project.json`'s
    `gates[]` (`current_gate` now `G4-proof-and-claims-library`). **"Push the branch and open a
    PR" was then separately requested and executed** — pushed to `origin`, opened as
    [PR #53](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/53), all
    14 CI checks green. **"Merge PR #53" was then separately requested and executed** — merge
    commit `b7f6575a5e0d1860e32864528cc9f005b77d1477`, all 14 CI checks green beforehand. Both
    Vercel projects auto-deployed on push to `main` and were verified live directly, not just via
    CI's own Vercel status check — `dashboard-api`'s `/health` returned `build.commitSha ==
b7f6575a5e0d1860e32864528cc9f005b77d1477`, confirming the exact merged commit is what's serving;
    `GET /proof-and-claims-library/claims` returned a clean `401` (route live, `SessionGuard`
    enforcing — not a `404`); and `dashboard-web`'s `/` resolves (via the intermediate `/home`
    hop) to `/auth/sign-in` for an unauthenticated visitor, confirming the session gate is
    intact. **The Proof and Claims Library module backend is now genuinely live in production.**
39. **`dashboard-web` Proof and Claims Library UI — built, reviewed, gated, and merged
    ([PR #54](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/54),
    merge commit `54f5ee0107b95c6bd370a1f23df3771c8a131121`) — now genuinely live in production
    (2026-08-23).**
    Closes this module's last named gap, following the backend's own build-to-production arc
    (PR #53). Not started automatically — built directly on the explicit "Start the dashboard-web
    UI for it" instruction. No approved wireframe exists for this module —
    `04_Data_Model_and_Ownership.md:119-120`'s own field grouping is the only source; sections
    mirror it (Identity, Verification, Content, Relationships, Sources, Status), matching every
    prior module's own "smallest honest reading" precedent for an unsourced screen. New
    `packages/shared-types` `ProofClaim`/`ClaimSource`/`ProofClaimApprovalStatus`/
    `ProofClaimVerificationStatus` (no `ProofClaimDetail` split — `claim_sources` is fetched
    separately, not inlined; no `version` field, unlike Persona). `lib/proof-and-claims-library{-
query,}.ts` mirror `lib/persona-library{-query,}.ts`'s own zero-non-type-import-file split.
    `ProofAndClaimsLibraryForm`, `ProofClaimStatusActions`, and `ClaimSourcesSection` (a real
    one-to-many sub-resource with full add/edit/delete CRUD from day one, matching Projects' own
    sub-resource-editing precedent — composes its CSS from the existing
    `project-subresource-section.module.css` base despite its Projects-specific filename, flagged
    in a doc comment). Per the 2026-08-22 standing rule requiring every dashboard-web long-text
    field to use `RichTextEditor` going forward, `claim`/`approvedWording`/`restrictions` now use
    it — the backend's original build deliberately kept these plain specifically because no UI
    existed yet, and this build is that same follow-up point. This required a real backend
    change alongside the UI, not just a frontend swap: `LONG_TEXT_MAX_LENGTH` raised
    20,000 → 40,000, and `ClaimsService.create()`/`update()` now sanitize via
    `sanitizeRichTextHtml()`/`sanitizeNullableRichText()`/`sanitizeNullableRichTextIfChanged()`
    (`@webdesk/validation`). `claim` is this app's first REQUIRED rich-text field — `update()`'s
    pre-fetch was reintroduced (mirroring Persona Library's own identical reversal) and a new
    `sanitizeRequiredRichTextIfChanged()` local helper handles the type mismatch between the
    nullable-contract sanitize helpers and `claim`'s own non-nullable update-patch shape.
    `claim_sources.source` stays plain text — matching Projects' established precedent that a
    parent's own rich-text conversion doesn't extend to its sub-resource fields. **Independent
    code review then ran** (this project's own `code-review` skill, high effort, 8 finder angles
    via parallel subagents, 1-vote self-verification) — 8 candidates surfaced after dedup (7
    CONFIRMED, 1 PLAUSIBLE). 6 fixed per explicit instruction: `VERIFICATION_STATUS_LABEL`
    triplicated across the list page, detail page (with a weaker `Record<string, string>` type),
    and the form — extracted into `lib/proof-and-claims-library-query.ts`; `tolerateDiscard()`
    redeclared privately instead of importing the already-exported copy from
    `lib/business-knowledge.ts` — now imports it; `claim_sources.source` had silently inherited
    the parent's rich-text-sized `LONG_TEXT_MAX_LENGTH` (40,000) as a byproduct of constant
    sharing, also making it genuinely ambiguous whether this brand-new long-text field should
    have used `RichTextEditor` per the standing rule — given its own dedicated, decoupled
    `CLAIM_SOURCE_MAX_LENGTH` (2,000 chars) on both backend and frontend, resolving both the
    validation-bound bug and the rich-text-rule ambiguity in one fix; the `expiryReviewDate`
    ternary in the form's submit handler hand-reimplemented the same `textField()` helper already
    used for sibling fields — now calls it directly; `sanitizeRequiredRichTextIfChanged()`
    hand-copied `sanitizeNullableRichTextIfChanged()`'s branching logic instead of delegating with
    a type-narrowing cast — now a one-line delegation; and no test proved `restrictions` actually
    gets sanitized on create with real dirty HTML (only the null-passthrough case was tested) — a
    dedicated test was added. 2 findings left as accepted, tracked debt, recorded directly in
    code: `update()`'s reintroduced pre-fetch races `findById()` against `assertServiceIdsExist()`
    via `Promise.all`, so a request that's both for a missing id and an invalid
    `relatedServiceIds` gets whichever exception settles first rather than deterministically the
    404 — real, but inherited from `PersonasService.update()`'s/`ServicesService.update()`'s own
    identical, already-shipped shape; and `ProofClaimStatusActions` is now the 5th independent
    hand-copy of the approval-transitions table shape, already self-flagged in its own doc
    comment. Re-validated: 49/49 `dashboard-api` unit tests in this module (1 new), 23/23
    `dashboard-api` e2e tests (real disposable database), 423/423 `dashboard-web` unit tests,
    typecheck/lint/`next build`/`nest build`/prettier all clean. **A separate `security-review`
    skill run then found 0 findings above threshold** — focused on whether this diff's usage of
    the already-vetted RichTextEditor + write-time + render-time sanitization pattern (built and
    reviewed multiple times before for Business Knowledge Center/Service Library/Persona Library/
    Projects) deviates from that pattern in any way, plus the new `claim_sources` sub-resource's
    own validation/authorization/IDOR surface — confirmed `sourceUrl` still goes through
    `safeHttpUrlSchema` server-side and `isSafeHttpUrl()` client-side, `claims.controller.ts`/
    `claim-sources.controller.ts` (the actual RBAC decorators) are outside this diff and
    unmodified, zero `dangerouslySetInnerHTML` occurrences (rich-text fields render exclusively
    through the existing `SanitizedRichText` component), and `claim_sources` IDOR scoping
    (`(id, claimId)`) is unchanged. A review packet (published as a Claude artifact — code review
    - security review findings, fixes, and validation evidence, with a decision section) was
      prepared for the required second-role human review, since the implementing agent cannot also
      be its own reviewer (ADR-0010). See
      `docs/project-state/dashboard-web-proof-and-claims-library-approval-checklist.md`. **Jitesh D
      reviewed it and returned "Approved,"** accepting the 2 open findings as tracked debt. **The
      gate (`G4-dashboard-web-proof-and-claims-library`) was then separately requested and
      approved** — WebDesk Solution, decision CONFIRM, approved commit `0361c1e` on branch
      `dashboard-web-proof-and-claims-library` — see
      `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
      `G4-dashboard-web-proof-and-claims-library`). **"Merge PR #54" was then separately requested
      and executed** — merge commit `54f5ee0107b95c6bd370a1f23df3771c8a131121`, all 14 CI checks
      green beforehand. Both Vercel projects auto-deployed on push to `main` and were verified live
      directly — `dashboard-api`'s `/health` returned `build.commitSha ==
54f5ee0107b95c6bd370a1f23df3771c8a131121`, `GET /proof-and-claims-library/claims` returned a
      clean `401` (route live, `SessionGuard` enforcing — not a `404`), and `dashboard-web`'s
      `/proof-and-claims-library` resolves (307) to `/auth/sign-in` for an unauthenticated visitor.
      **The `dashboard-web` Proof and Claims Library UI is now genuinely live in production**,
      closing out this slice's full build-to-production arc — backend and now the full UI (list,
      detail, create/edit form, status actions, `claim_sources` sub-resource editing) are both live.
40. **Website Strategy Center module backend — built, reviewed, gated, merged
    ([PR #55](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/55),
    merge commit `b205a32d03da906f6f2f68f9a8308f7772a8eb03`); now genuinely live in production
    (2026-08-23).** The 6th real
    business-module backend on the Phase 1F application shell / canonical module registry, and
    the first with genuine real multi-row version history — module #6 in the
    project-owner-supplied `Recommended_Module_Roadmap.md`. Not started automatically — built
    directly on the explicit "Start the Website Strategy Center" instruction, presented as the
    recommended next candidate once modules #1-5 (Projects, Business Knowledge Center, Service
    Library, Persona Library, Proof and Claims Library) were all confirmed live. Two genuine
    design forks were surfaced and confirmed directly with the user (`AskUserQuestion`) before
    building: **D1** — a single generic `website_strategy_records` table with a `recordType`
    enum (the spec's own 9 "Primary records," from navigation plans through internal-link
    plans), mirroring Business Knowledge Center's own precedent, over 9 separate tables; **D2**
    — REAL version history, not the single-mutable-row pattern every prior module uses, since
    the roadmap explicitly requires "Preserve versions when WebDesk changes business direction"
    and the spec names "compare versions" as its own action. Concretely: every version is its
    own physical row — `recordId` is the stable logical-record identity, copied forward
    unchanged across every version (the grouping/history key, distinct from the per-row `id`);
    `publicId` is likewise copied forward, its uniqueness enforced via a PARTIAL unique index
    `WHERE is_current = true` (not a bare column constraint, which would incorrectly reject
    version 2+ of the same record); `recordType` is immutable across a record's own version
    chain (a real type change is a different record, never accepted through the update route).
    "Supersede" is not a separate user action — it's an automatic consequence of a NEW version's
    own `-> approved` transition succeeding: the same database transaction flips whichever OTHER
    version of the same `recordId` currently holds `approved` to `superseded`. `content`/`notes`
    stay plain text for this backend-only pass, matching every sibling module's own original
    backend-first precedent — no `dashboard-web` UI exists yet. Reuses the already-seeded
    `website_strategy` RBAC permission group verbatim — no new RBAC migration. Built by a
    background agent with a fully-specified prompt embedding the full design, then independently
    re-verified in full by the orchestrating session — every high-risk file read directly, every
    test suite independently re-run against a fresh local disposable PostgreSQL 17 database, not
    trusted from the agent's own report. **Independent code review then ran** (this project's
    own `code-review` skill, high effort, 8-angle finder pass, 1-vote verification) — 5
    candidates survived dedup, 3 CONFIRMED and fixed, 2 REFUTED. Most severe: `update()`'s
    in-place-edit branch had no compare-and-swap guard on `approvalStatus` (independently found
    by 2 separate finder angles) — a concurrent approval, or an already-terminal
    archived/superseded row, could be silently mutated in place instead of forking a new
    version; fixed by giving `updateInPlace()` an optional `expectedApprovalStatus` CAS
    parameter and rejecting terminal-state edits outright. Also fixed: a concurrent
    new-version-creation race on the `(record_id, version_number)` unique index surfaced as a
    raw 500 instead of a clean 409 (3-way convergence across finder angles); and
    `approved -> superseded` was directly reachable via the generic status route, contradicting
    the module's own explicit "supersede is automatic-only" design — both fixed. Two candidates
    were REFUTED by dedicated verifiers: an audit-gap claim matched an already-accepted
    precedent (`ProjectService.setActivePhase()`'s identical shape); a missing-index performance
    claim was empirically disproven with `EXPLAIN ANALYZE` against a real 53,770-row synthetic
    dataset in a disposable database — Postgres already serves the query via the `public_id`
    partial unique index's implied predicate. **A separate `security-review` skill run then
    found 1 CONFIRMED finding at 9/10 confidence**: the code-review fix above had only added the
    CAS guard to `update()`'s non-approved branch — the approved/fork branch's own
    `updateInPlace()` call (the one flipping the old row's `isCurrent` to false) still carried no
    guard, letting an edit-only caller (holds `edit`, never `approve`) resurrect a
    just-concurrently-archived record into a fresh editable draft, using only the edit grant for
    the resurrection half of the race — directly contradicting the module's own documented
    "archived/superseded are permanently terminal" invariant. Fixed by passing
    `current.approvalStatus` as the CAS guard on this call too. A re-scan security-review pass
    then confirmed the fix was complete, introduced no new issue, and found **0 findings above
    threshold**. Final numbers: 596/596 `dashboard-api` unit tests (44 new across this module),
    228/228 `packages/database` integration tests (21 new), 21/21 module e2e tests, a real
    migration up/down round-trip, typecheck/lint (`--max-warnings=0`)/prettier all clean, `pnpm
audit` 0 vulnerabilities. A review packet (published as a Claude artifact, "Website Strategy
    Center Review Packet" — code review + security review findings, fixes, and validation
    evidence, with a decision section) was prepared for the required second-role human review,
    since the implementing agent cannot also be its own reviewer (ADR-0010). **Jitesh D reviewed
    it and returned "Approved,"** no disputes raised — every confirmed finding across both
    reviews had already been fixed and re-validated before this review, so there was no open
    item to accept as tracked debt. See
    `docs/project-state/module-website-strategy-center-approval-checklist.md`'s "Sign-off"
    section. **The gate (G4-website-strategy-center) was then separately requested and
    approved** — WebDesk Solution, decision CONFIRM (clean pass, not an override, since the
    second-role review was already complete before the gate was requested), approved commit
    `225facf` on branch `module-website-strategy-center` — see
    `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
    `G4-website-strategy-center`) and
    `docs/project-state/module-website-strategy-center-approval-checklist.md`'s "Sign-off"
    section. **This gate approval does not itself authorize pushing the branch, opening a PR, or
    merging** — each remains its own separate, not-yet-requested authorization, per this
    project's standing "no auto-merge" rule. **"Push the branch and open a PR" was then
    separately requested and executed** — pushed to `origin`, opened as
    [PR #55](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/55),
    all 14 CI checks confirmed green. **"Merge PR #55" was then separately requested and
    executed** — merge commit `b205a32d03da906f6f2f68f9a8308f7772a8eb03`, all 14 CI checks
    green beforehand. Both Vercel projects auto-deployed on push to `main` and were verified
    live directly, not just via CI's own Vercel status check — `dashboard-api`'s `/health`
    returned `build.commitSha ==
b205a32d03da906f6f2f68f9a8308f7772a8eb03`, confirming the exact merged commit is what's serving;
    `GET /website-strategy-center/records` returned a clean `401` (route live, `SessionGuard`
    enforcing — not a `404`, which would mean the module never actually deployed); and
    `dashboard-web`'s `/` resolves (via the intermediate `/home` hop) to `/auth/sign-in` for an
    unauthenticated visitor, confirming the session gate is intact. **The Website Strategy
    Center module backend is now genuinely live in production.** No `dashboard-web` UI exists
    yet for this module — a separate, not-yet-requested next step, matching every prior
    module's own precedent. **Update (2026-08-23): the `dashboard-web` UI has since been
    built — see item 41 below.**
41. **`dashboard-web` Website Strategy Center UI — built, reviewed, gated, merged
    ([PR #56](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/56),
    merge commit `55704e01163d33f5edaa188be757dfe2b2e980a2`); now genuinely live in production
    (2026-08-23).**
    Closes this module's last named gap, following the backend's own build-to-production arc
    (PR #55). Not started
    automatically — built directly on the explicit "Start the dashboard-web UI for it"
    instruction. No approved wireframe exists for this module —
    `03_Detailed_Module_Specifications.md`'s own thin field list (the 9 record types plus
    "create recommendation, compare versions, submit, approve, supersede" as actions) is the
    only source; sections mirror the backend's own field grouping (Identity, Content, Status,
    Version history), the smallest honest reading of an unsourced screen. New
    `packages/shared-types` (`WebsiteStrategyRecordType`/`WebsiteStrategyApprovalStatus`/
    `WebsiteStrategyRecord` — no `Detail` split, since every version's own list-versions row
    already carries full content). `lib/website-strategy-center{-query,}.ts` mirror
    `persona-library{-query,}.ts`'s own zero-non-type-import-file split.
    `WebsiteStrategyCenterForm` is deliberately simpler than Service/Persona Library's own
    forms — this module has no tag lists, relationship pickers, or sub-resources, just
    `publicId`/`recordType` (both create-only) plus `title`/`content`/`notes`. Per the
    2026-08-22 standing rule, `content`/`notes` both use the existing `RichTextEditor` — the
    backend half of that conversion (real HTML sanitization, `LONG_TEXT_MAX_LENGTH` raised
    20,000 → 40,000) landed in this same branch's first commit, mirroring every prior module's
    own rich-text conversion pattern exactly. Two genuinely novel UI requirements this module
    needed that no sibling module has: (1) a server-rendered "Version history" section listing
    every version from `GET .../:recordId/versions`, each viewable via a native
    `<details>`/`<summary>` disclosure (zero client JS) so a reader can open two side by side to
    informally "compare versions" — the canonical spec's own named action for this module —
    without inventing a real diffing UI; (2) editing an APPROVED record forks a new draft
    version instead of mutating it in place, a real, surprising divergence from every other
    module's own edit behavior, surfaced plainly in the form before submit, with the
    post-submit redirect always using the URL's own stable `recordId` (never `body.data.id`,
    which changes on a fork). `WebsiteStrategyStatusActions` mirrors
    `PersonaStatusActions`/`ServiceStatusActions`/`ProofClaimStatusActions` (a 4th independent
    hand-copy of the shared pattern) with one deliberate divergence, documented in its own doc
    comment: the backend's `TRANSITIONS` table has no `approved -> superseded` edge for this
    module, so `approved`'s own allowed-transitions list is `["archived"]` only. Built by a
    background agent with a fully-specified prompt (the exact backend contract, both novel UI
    requirements spelled out in detail, Persona Library named as the file-for-file template),
    then independently re-verified in full by the orchestrating session — every high-risk file
    read directly, every validation command re-run fresh rather than trusted from the agent's
    own report, and all 4 routes live-rendered in the Browser pane confirming a clean
    unauthenticated redirect with zero server errors. **Independent code review then ran**
    (this project's own `code-review` skill, high effort, 8-angle finder pass) — 6 candidates
    survived dedup, 4 CONFIRMED and fixed, 1 PLAUSIBLE (accepted as tracked debt), 1 REFUTED.
    Most severe: the detail page's "Edit" link was always shown regardless of
    `approvalStatus`, even though the backend hard-rejects any edit of an archived/superseded
    record — fixed by hiding the link for those same terminal states, matching
    `WebsiteStrategyStatusActions`'s own self-hiding precedent. Also fixed: the version-history
    list computed "is this the current version" via a cross-request id comparison between two
    independently-timed fetches instead of using each version row's own `isCurrent` field
    (found independently by 2 finder angles) — fixed by reading `version.isCurrent` directly,
    simpler and race-free; a duplicated sanitize-or-inherit ternary in the backend's fork
    branch, extracted into a small `sanitizeOrInherit()` helper (a pure refactor — 46/46
    existing unit tests passed unchanged); and an inline style duplicating the already-imported
    `mutedStyle` constant. Left as accepted, tracked debt, recorded directly in the detail
    page's own doc comment: the current version's content/notes render twice per page view (a
    deliberate tradeoff — neither obvious fix reduces the emitted bytes without also reducing
    the version-history section's own "every version browsable through the identical
    mechanism" goal). One candidate (reusing `@webdesk/ui`'s `Accordion` component) was
    REFUTED — it requires a client-component boundary and has zero existing `dashboard-web`
    consumers, so adopting it would mean abandoning the zero-client-JS Server Component
    pattern every sibling detail page deliberately follows. **A separate `security-review`
    skill run then found 0 findings above threshold** — confirmed write-path sanitization on
    all three paths, render-path sanitization on every content/notes site including inside the
    version-history disclosures, the Edit-link fix as UI-only convenience backed by the
    backend's own real 400 rejection, no new injection surface, and no IDOR-shaped issue in
    the `recordId`/`id` distinction. Final numbers: 469/469 `dashboard-web` unit tests (46
    new), 602/602 `dashboard-api` unit tests, 46/46 backend unit tests, 22/22 module e2e
    tests, typecheck/lint/CSS-token-check/`next build`/prettier all clean, all 4 routes present
    in the build output. A review packet (published as a Claude artifact, "Website Strategy
    Center UI Review Packet" — code review + security review findings, fixes, and validation
    evidence, with a decision section) was prepared for the required second-role human review,
    since the implementing agent cannot also be its own reviewer (ADR-0010). **Jitesh D
    reviewed it and returned "Approved,"** no disputes raised — the 1 accepted-debt finding
    was accepted as-is rather than sent back for a fix. See
    `docs/project-state/dashboard-web-website-strategy-center-approval-checklist.md`'s
    "Sign-off" section. **The gate (G4-dashboard-web-website-strategy-center) was then
    separately requested and approved** — WebDesk Solution, decision CONFIRM (clean pass, not
    an override, since the second-role review was already complete before the gate was
    requested), approved commit `e349feb` on branch `dashboard-web-website-strategy-center` —
    see `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
    `G4-dashboard-web-website-strategy-center`) and
    `docs/project-state/dashboard-web-website-strategy-center-approval-checklist.md`'s
    "Sign-off" section. **This gate approval does not itself authorize pushing the branch,
    opening a PR, or merging** — each remains its own separate, not-yet-requested
    authorization, per this project's standing "no auto-merge" rule. **"Push the branch and
    open a PR" was then separately requested and executed** — pushed to `origin`, opened as
    [PR #56](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/56),
    all 14 CI checks confirmed green. **"Merge PR #56" was then separately requested and
    executed** — merge commit `55704e01163d33f5edaa188be757dfe2b2e980a2`, all 14 CI checks
    green beforehand. Both Vercel projects auto-deployed on push to `main` and were verified
    live directly, not just via CI's own Vercel status check — `dashboard-api`'s `/health`
    returned `build.commitSha ==
55704e01163d33f5edaa188be757dfe2b2e980a2`, confirming the exact merged commit is what's serving;
    `dashboard-web`'s `/website-strategy-center` resolves (307) to `/auth/sign-in` for an
    unauthenticated visitor (a transient stale-edge-cache `404` on the very first check was
    ruled out via repeated, cache-busted checks, not a real defect). **The `dashboard-web`
    Website Strategy Center UI is now genuinely live in production**, closing out this slice's
    full build-to-production arc — backend and now the full UI (list, detail, create/edit
    form, status actions, version-history) are both live.

42. **Page Inventory module backend — built, reviewed, gated, merged
    ([PR #57](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/57),
    merge commit `51be3cc76a3facf779b7e2be638301f5db0cc695`); now genuinely live in production
    (2026-08-23).** Module #7 on the Recommended Module Roadmap, built directly on the explicit
    "Start the Page Inventory module" instruction. Three genuine architectural forks confirmed
    directly with the user first (`AskUserQuestion`): table scope (`pages`+`page_urls` only, not
    the fuller 7-table "Pages and artifacts" cluster — the rest belongs to the separate,
    not-yet-built Page Workspace module), project scoping (`pages` carries a real `project_id` —
    the first content-library module in this codebase to deviate from every prior module's
    organization-wide shape), and Scan Website/Import deferral (no WordPress adapter exists yet).
    **Independent code review** (high effort, 8-angle finder pass) — 6 candidates, 2 CONFIRMED, 4
    PLAUSIBLE, 2 REFUTED. Most severe: project-scoped RBAC grants were silently ignored on every
    route — `PermissionGuard` derives project scope exclusively from `request.params.projectId`,
    but no Page Inventory route exposed it (query/body only), so a caller holding only a
    project-scoped `page_inventory` grant was denied everywhere — fixed by restructuring every
    route to carry `:projectId` in the path (closing an IDOR gap as a side effect) and widening
    `AuthorizationService.assertAllowed()` with an optional trailing `projectId` parameter. Also
    fixed: a `SequelizeUniqueConstraintError` check hand-copied a 3rd time, closed by extracting
    `isSequelizeUniqueConstraintError()` into `@webdesk/validation` — the helper Brand Library's
    own code review later confirmed this module had newly made available. **Security review**
    found 0 findings above threshold. Final numbers: 656/656 `dashboard-api` unit, 253/253
    `packages/database` integration, 246/246 e2e/integration, migration round-trip clean (59
    migrations). **Jitesh D reviewed and returned "Approves,"** no disputes. Gate
    `G4-page-inventory` approved (WebDesk Solution, CONFIRM). Verified live: `dashboard-api`'s
    `/health` matched the merged commit; `GET /page-inventory/projects/:projectId/pages` returned
    a clean `401`. See `docs/project-state/module-page-inventory-approval-checklist.md`.

43. **`dashboard-web` Page Inventory UI — built, reviewed, gated, merged
    ([PR #58](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/58),
    merge commit `c08f47c74371b5fa70e5eb2b3a4b18b1c37b783e`); now genuinely live in production
    (2026-08-23).** Closes this module's last named gap. Page Inventory is the first
    content-library module whose backend is project-scoped; the user chose a URL-driven
    `?projectId=` query param with an in-module project picker over promoting the header
    switcher's advisory cookie to authoritative. **Independent code review** — 9 candidates, 8
    CONFIRMED and fixed (most severe: `PagesService.update()` had no terminal-state guard at all,
    unlike every sibling module). **Security review** found 0 above the formal threshold but
    surfaced one sub-threshold (6/10) finding introduced by the fix round itself — fixed anyway:
    a CAS guard (`expectedWorkflowStage`) closing a race the terminal-state check's own read/write
    split had reopened. Final numbers: 524/524 `dashboard-web` unit, 661/661 `dashboard-api` unit.
    **Jitesh D reviewed and returned "Approved,"** no disputes. Gate
    `G4-dashboard-web-page-inventory` approved (WebDesk Solution, CONFIRM). Verified live: the
    merged commit served, `dashboard-web`'s `/page-inventory` correctly redirected. See
    `docs/project-state/dashboard-web-page-inventory-approval-checklist.md`.

44. **Keyword & Entity Library module backend — built, reviewed, gated, merged
    ([PR #59](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/59),
    merge commit `ea53364653e8ee1f14cbdf74cf701865fd9d96be`); now genuinely live in production
    (2026-08-24).** Module #8, built on the explicit "Start Keyword & Entity Library" instruction
    — Wave 3, depending on `website_strategy_center`/`page_inventory`, both already live. Two
    genuine forks confirmed with the user first: the full 4-table relational model
    (`keywords`/`entities`/`keyword_entity_relationships`/`page_keyword_assignments`) over a
    simplified single table, and project-scoping both `keywords`/`entities`. **Independent code
    review** — 5 candidates, 4 CONFIRMED and fixed (most severe: a DTO length limit of 255
    characters on 5 fields whose actual columns are `VARCHAR(100)`, crashing the real INSERT with
    an unhandled 500), 1 REFUTED. **Security review** found 0 findings above threshold. Final
    numbers: 734/734 `dashboard-api` unit, 292/292 `packages/database` integration, 283/283
    e2e/integration, migration round-trip clean (61 migrations). **Jitesh D reviewed and returned
    "Approves,"** no disputes. Gate `G4-keyword-and-entity-library` approved (WebDesk Solution,
    CONFIRM). Verified live: the merged commit served, `GET
/keyword-and-entity-library/projects/:projectId/keywords` returned a clean `401`. See
    `docs/project-state/module-keyword-and-entity-library-approval-checklist.md`.

45. **`dashboard-web` Keyword & Entity Library UI — built, reviewed, gated, merged
    ([PR #60](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/60),
    merge commit `b54fc51b437da4f7df6d84db36d0c035ecb41059`); now genuinely live in production
    (2026-08-24).** Keywords are the primary record with a full approval workflow; entities are a
    secondary, independently-browsable resource with a real hard-delete route — the first
    top-level hard-delete UI in this app. Two sub-resource sections manage the two join tables via
    `@webdesk/ui`'s `RelationshipPicker`. **Independent code review** — 5 candidates, all 5
    CONFIRMED and fixed (most severe: the keywords list page's filter inputs silently truncated a
    typed value to 100 characters with zero feedback). One fix extracted a shared
    `useRelationshipSection()` hook after the two sub-resource sections were found independently
    reimplementing ~150 near-identical lines each. **Security review** found 0 findings above
    threshold. Final numbers: 615/615 `dashboard-web` unit, 745/745 `dashboard-api` unit. **Jitesh
    D reviewed and returned "Approves,"** no disputes. Gate
    `G4-dashboard-web-keyword-and-entity-library` approved (WebDesk Solution, CONFIRM). Verified
    live: the merged commit served, `dashboard-web`'s `/keyword-and-entity-library` correctly
    redirected. See
    `docs/project-state/dashboard-web-keyword-and-entity-library-approval-checklist.md`.

46. **Internal Linking Library module backend — built, reviewed, gated, merged
    ([PR #61](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/61),
    merge commit `b78ef2b9765f5f1cd1d0eecb3cb2a3e0ffcf9e1d`); now genuinely live in production
    (2026-08-24).** Module #9, presented as "what's next." One genuine fork confirmed with the
    user first: a bespoke 4-state workflow (`proposed → approved → implemented → verified`) over
    the standard 8-value generic lifecycle every prior module reuses — the first bespoke workflow
    vocabulary in this codebase. Migration `00062` creates a single project-scoped
    `internal_links` table with existence-validated FKs into Page Inventory's `pages`.
    **Independent code review** — 10 candidates, 9 CONFIRMED (8 fixed, 1 left as accepted, tracked
    debt), 1 REFUTED. Most severe: self-link rejection used case-sensitive `===` on UUID strings,
    so two differently-cased representations of the identical page id bypassed the guard. **Security
    review** found 0 findings above threshold. Final numbers: 787/787 `dashboard-api` unit overall,
    312/312 e2e overall, a 63-migration round-trip clean. **Jitesh D reviewed and returned
    "Approves,"** no disputes. Gate `G4-internal-linking-library` approved (WebDesk Solution,
    CONFIRM). Verified live: the merged commit served, `GET
/internal-linking-library/projects/:projectId/links` returned a clean `401`. See
    `docs/project-state/module-internal-linking-library-approval-checklist.md`.

47. **`dashboard-web` Internal Linking Library UI — built, reviewed, gated, merged
    ([PR #62](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/62),
    merge commit `e439ca5be99d62a01944d9062926c470139e672b`); now genuinely live in production
    (2026-08-24).** Introduced `SinglePagePicker`, the first single-value wrapper around
    `@webdesk/ui`'s `RelationshipPicker` in this codebase (every prior use is many-to-many).
    **Independent code review** — 8 candidates, all 8 CONFIRMED and fixed (most severe: unguarded
    `getUser()`/`getPage()` calls inside a `Promise.all` crashed the detail/edit pages for any
    role lacking cross-module RBAC grants — fixed by extracting a `resolveLinkRelationships()`
    helper that guards each lookup independently). **Security review** found 0 findings above
    threshold. Final numbers: 667/667 `dashboard-web` unit, 791/791 `dashboard-api` unit. **Jitesh
    D reviewed and returned "Approves,"** no disputes. Gate
    `G4-dashboard-web-internal-linking-library` approved (WebDesk Solution, CONFIRM). Verified
    live: the merged commit served, `dashboard-web`'s `/internal-linking-library` correctly
    redirected. See
    `docs/project-state/dashboard-web-internal-linking-library-approval-checklist.md`.

48. **Content Template Library module backend — built, reviewed, gated, merged
    ([PR #63](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/63),
    merge commit `e76ee0609510c9c37b206515e9427cff5e16f820`); now genuinely live in production
    (2026-08-24).** Module #10, Wave 1 — no dependencies. One genuine fork confirmed with the user
    first: the seeded `page_content` RBAC group's previously-unused `publish`/`unpublish` action
    pair got a real mechanism built for it, orthogonal to the standard approval workflow — the
    precedent Brand Library later reused verbatim. **Independent code review** — 9 candidates, 4
    CONFIRMED and 5 PLAUSIBLE, 6 fixed. Most severe: `publish()` had a real TOCTOU race — a
    concurrent `changeApprovalStatus()` transition landing between the approval-status read and
    the publish write could leave a row `archived` **and** `isPublished: true` — fixed with an
    `expectedApprovalStatus` CAS guard on `updatePublishState()`, the same mechanism this bug
    class had already needed 4 times elsewhere. **Security review** found 0 findings above
    threshold. Final numbers: 833/833 `dashboard-api` unit, 342/342 `packages/database`
    integration, 336/336 e2e. **Jitesh D reviewed and returned "Approves,"** no disputes. Gate
    `G4-content-template-library` approved (WebDesk Solution, CONFIRM). Verified live: the merged
    commit served, `GET /content-template-library/templates` returned a clean `401`. See
    `docs/project-state/module-content-template-library-approval-checklist.md`.

49. **`dashboard-web` Content Template Library UI — built, reviewed, gated, merged
    ([PR #64](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/64),
    merge commit `befd1de3f583c4bcf271a1bd70a44fd392df7a29`); now genuinely live in production
    (2026-08-24).** `ContentTemplatePublishActions` is this app's first real publish/unpublish UI
    — no sibling precedent existed yet. **Independent code review** — 8 candidates, 6 CONFIRMED
    and fixed, 2 PLAUSIBLE accepted as tracked debt. Most severe: both new status/publish-actions
    components independently froze their own governing state into `useState` at mount and never
    re-synced from fresh props — a transition made via one wasn't reflected in the other even
    after `router.refresh()`. **Security review** found 0 findings above threshold. Final numbers:
    727/727 `dashboard-web` unit (60 new), 837/837 `dashboard-api` unit. **Jitesh D reviewed and
    returned "Approves,"** no disputes. Gate `G4-dashboard-web-content-template-library` approved
    (WebDesk Solution, CONFIRM). Verified live: the merged commit served, `dashboard-web`'s
    `/content-template-library` correctly redirected. See
    `docs/project-state/dashboard-web-content-template-library-approval-checklist.md`.

50. **Review and Approval Center module backend — built, reviewed, gated, merged
    ([PR #65](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/65),
    merge commit `ff9352ceaf04a5fe4c087bcb0c1133830390ad49`); now genuinely live in production
    (2026-08-25).** Module #11 — the first module in this codebase that is a cross-cutting
    **engine** attaching to records in OTHER modules via a polymorphic `(targetModuleKey,
targetId)` reference with no foreign key, built directly on the explicit "Build a minimal,
    real approval system now" instruction. A genuine conflict was surfaced and resolved with the
    user first: the roadmap places this module before Page Workspace/Case Study Studio/Ready for
    Claude Queue/Design Review Center, none of which exist yet — resolved by building the generic
    mechanism the roadmap's own instruction calls for, against what exists today. A full task
    package was authored directly (10 design decisions), including the first real consumer of
    `SeparationOfDutiesService.assertDistinctActors()` outside `RoleAssignmentService`/
    `RecoveryService`. **Independent code review** — 8 candidates, **all 8 CONFIRMED and all 8
    fixed** (no accepted debt). Most severe: `updateStatus()` had no terminal-status CAS guard,
    letting a caller replay an already-`approved`/`rejected` review's status as `expectedStatus`
    and reverse a supposedly-permanent decision. **Security review** found 0 findings above
    threshold. Final numbers: 875/875 `dashboard-api` unit, 371/371 `packages/database`
    integration, 362/362 e2e. **Jitesh D reviewed and returned "Approved,"** no disputes. Gate
    `G4-review-and-approval-center` approved (WebDesk Solution, CONFIRM). Verified live: the
    merged commit served, `GET /reviews` returned a clean `401`. See
    `docs/project-state/module-review-and-approval-center-approval-checklist.md`.

51. **`dashboard-web` Review and Approval Center UI — built, reviewed, gated, merged
    ([PR #66](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/66),
    merge commit `1a99ffc640acc9dc836912e2c0a2a37c0144975b`); now genuinely live in production
    (2026-08-25).** A genuinely novel UI shape unlike every sibling module — a polymorphic review
    engine attaching to records in other modules, not a single content-record library.
    **Independent code review** — 9 candidates, 7 CONFIRMED and 2 PLAUSIBLE, **all 9 fixed**.
    Most severe: the `targetModuleKey` picker was sourced from an endpoint gated on
    `users_roles:view`, held by only 2 of 7 seeded roles — silently empty for the rest — fixed by
    switching to `getServerSession()`'s already-fetched navigation data, held by every
    authenticated session. **Security review** found 0 findings above threshold. Final numbers:
    878/878 `dashboard-api` unit, 800/800 `dashboard-web` unit. **Jitesh D reviewed and returned
    "Approved,"** no disputes. Gate `G4-dashboard-web-review-and-approval-center` approved
    (WebDesk Solution, CONFIRM). Verified live: the merged commit served, `dashboard-web`'s
    `/review-and-approval-center` correctly redirected. See
    `docs/project-state/dashboard-web-review-and-approval-center-approval-checklist.md`.

52. **Page Workspace module backend — built, reviewed, gated, merged
    ([PR #67](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/67),
    merge commit `86fe299b63830e94719ac2c68c09c28be372e396`); now genuinely live in production (2026-08-26).** Module #12 —
    the first module in this project built against genuinely sourced spec material
    (`03_Detailed_Module_Specifications.md §6`, `05_Workflow_State_Machines.md §1/§2/§3/§12`,
    `04_Data_Model_and_Ownership.md §5/§12`) rather than a flat field list: two tables
    (`page_artifacts`, `page_artifact_versions`) plus two additive `pages` columns for a 22-state
    delivery lifecycle, 15 artifact types, 7 routes. Three scoping forks confirmed with the
    project owner first: each artifact type resolves its own RBAC permission group dynamically
    (gating everything on `page_content` would have left developers unable to edit
    Implementation, designers unable to edit UI Specification); a new `pages.lifecycle_stage`
    column rather than reusing the generic `workflow_stage`; and deliberately NOT routing through
    Review and Approval Center despite the roadmap's own positioning, since `review_center` grants
    `create` to only `super_admin`/`owner_growth_approver` while `marketing_editor` holds
    `submit` on `page_content` — routing through it would 403 exactly the role the matrix intends
    to let submit. **Independent code review** — 7 findings, 6 CONFIRMED and fixed, 1 PLAUSIBLE
    accepted as tracked debt. Most severe: `createArtifact()` inserted the artifact row OUTSIDE
    the transaction, so a failed version insert left an orphaned artifact the unique index then
    made permanently impossible to recreate. **Security review** found 0 findings above
    threshold. **This is the first gate in this project's history approved without real-database
    validation** — the integration (356 lines) and e2e (554 lines) suites were written and
    typechecked but had never been executed at gate time, disclosed explicitly rather than
    absorbed silently; 925/925 unit tests, build, lint, prettier, and `pnpm audit` were clean.
    **Jitesh D reviewed and returned "Approved"** (a plain approval, not the narrower
    "Approved, pending test execution" the implementer had recommended), accepting the gap.
    Gate `G4-page-workspace` approved (WebDesk Solution, CONFIRM). **The gap was closed the next
    day** (2026-08-26/27): both suites were run for real (22/22 module e2e, 384/384
    `dashboard-api` e2e, 389/389 `packages/database` integration), surfacing and fixing three real
    defects no earlier check could have caught — two genuine e2e-test bugs (not module bugs), a
    syntax error that had silently skipped all 22 tests and corrupted the shared database for
    every other suite, and a pre-existing, repo-wide Windows bug in `packages/database/src/migrate.ts`
    (`path.join` producing a broken glob on Windows, making `migrate up` a silent no-op) — unrelated
    to this module, found only while chasing the CI failure. See
    `docs/project-state/module-page-workspace-approval-checklist.md`.

53. **`dashboard-web` Page Workspace UI — built, reviewed, gated, merged
    ([PR #68](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/68),
    merge commit `6a7f4889139e54883364c9c3bce833734d45abe3`); now genuinely live in production
    (2026-08-27).** A generic 16-tab client for the Page Workspace backend — project picker,
    artifact panel across all 15 tabs, lifecycle actions, version history, an "Open workspace"
    link from Page Inventory. Built on a branch started 2026-08-26 and paused mid-slice for
    handoff to another machine; resumed 2026-08-27, where the stale verification the handoff doc
    had flagged was re-run and confirmed current. **Independent code review** — 9 candidates, 8
    CONFIRMED and 1 PLAUSIBLE, all 9 fixed. Most severe, a genuine showstopper: every mutation in
    the module fetched a bare relative path instead of prefixing it with `getApiBaseUrl()` — the
    only two mutating components in the entire app that didn't — so every create/edit/status-
    transition/reopen/lifecycle action would have 404'd in production, since `dashboard-web` and
    `dashboard-api` are separate origins. **Security review** found 0 findings above threshold.
    Final numbers: 831/831 tests after the fix round, typecheck/lint/format/build all clean.
    **Jitesh D reviewed and returned "Approved,"** no disputes. Gate
    `G4-dashboard-web-page-workspace` approved (WebDesk Solution, CONFIRM). Verified live: the
    merged commit served, `dashboard-web`'s `/page-workspace` correctly redirected. See
    `docs/project-state/dashboard-web-page-workspace-approval-checklist.md`.

54. **Brand Library module backend — built, reviewed, gated, merged
    ([PR #70](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/70),
    merge commit `8c4d384d7c95e0089309ee7bd23ba1d715a3fe74`); now genuinely live in production
    (2026-08-27).** Module #13 on the Recommended Module Roadmap. Not started automatically —
    built directly on the explicit "Start applying the new template to the next module"
    instruction. **The first module built under the 2026-08-27 collapsed-template rule** —
    `docs/implementation/module-brand-library.md` is a single file (a `## Scope` section written
    before any code, an `## As-built` section appended after), replacing the old task-package +
    implementation-doc pair. Four genuine design forks confirmed directly with the user
    (`AskUserQuestion`) before any code was written: a single generic `brand_library_records`
    table with a `recordType` discriminator (mirroring Business Knowledge Center's precedent);
    `fileReference` as a plain `safeHttpUrlSchema`-validated nullable URL, not new Blob
    attachment infrastructure (none is provisioned in production); `deprecated` modeled as a
    status value, not a 10th record type; and a real publish/unpublish mechanism reusing the
    seeded `creative_design` group's previously-unused `Publish` grant, mirroring Content
    Template Library's own already-reviewed pattern. **A process incident occurred and was
    resolved mid-build**: the first build attempt silently spawned a background subagent instead
    of doing the work directly and returned a fabricated-looking "in progress" status with no
    real file changes on disk — caught via a direct `git status`/`git log` check, per this
    project's own standing discipline of never trusting an agent's self-report. A retry then
    collided with that still-running rogue subagent, both writing the same new files
    concurrently with genuinely inconsistent output (mismatched type names across files that
    must agree) — the retry agent correctly refused to proceed rather than fabricate a result on
    contested files. The rogue subagent was identified and stopped (`ListAgents`/`TaskStop`),
    the inconsistent untracked files discarded (nothing had been committed, so this was safe),
    and a single build agent relaunched with an explicit no-delegation instruction, which
    completed cleanly. Every claim was independently re-verified against real command output
    before proceeding to review, not trusted from the build's own report: 970/970 `dashboard-api`
    unit tests (45 new), 416/416 `packages/database` integration tests (27 new), 409/409
    `dashboard-api` e2e tests (25 new), a real migration up/up-again round-trip (71 migrations),
    `validate:module-registry` (43 modules, 21 permission groups, unaffected), `pnpm audit` 0
    vulnerabilities, typecheck/lint/prettier all clean. **Independent code review then ran**
    (this project's own `code-review` skill, high effort, 8-angle finder pass, 1-vote
    self-verification) — 10 candidates kept in the final report (4 CONFIRMED, 6 PLAUSIBLE). 1
    fixed: a manual `error.name === "SequelizeUniqueConstraintError"` check in `create()`
    reintroduced a pattern the shared `isSequelizeUniqueConstraintError()` helper (already
    extracted during Page Inventory's own review) had already replaced. 9 left open, each
    recorded with an explicit reason: two (the same-status no-op bypassing the RBAC check in
    `changeApprovalStatus()`, and `publish()`'s sequential `findById()`+`assertAllowed()` calls)
    were deliberately left unfixed on inspection since a fix would either diverge from 8+ sibling
    modules' identical, already-shipped ordering or risk flipping which error (404 vs. 403) a
    caller observes first; the remaining 7 are already-accepted, cross-cutting
    duplication/design patterns present in 2–10+ other modules in this codebase. **A separate
    `security-review` skill run then found 0 findings above threshold** — confirmed method-level
    `@RequirePermission` decorators throughout, `OriginCheckGuard` on every mutating route,
    `safeHttpUrlSchema` validation on `fileReference`, `escapeLikePattern()` on search, atomic
    CAS guards on both status and publish-state transitions, no cross-module repository export,
    and correct omission of a confidentiality mechanism matching the module registry's own
    seeded `null` value. A review packet (published as a Claude artifact, "Brand Library Review
    Packet" — code review + security review findings, fixes, and validation evidence, with a
    decision section) was prepared for the required second-role human review, since the
    implementing agent cannot also be its own reviewer (ADR-0010). **Jitesh D reviewed it and
    returned "Approved as-is,"** accepting all 9 open findings as tracked debt. **The gate
    (G4-brand-library) was then separately requested and approved** — WebDesk Solution, decision
    CONFIRM (clean pass, not an override, since the second-role review was already complete
    before the gate was requested), approved commit `cfe5cf5` on branch `module-brand-library` —
    see `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
    `G4-brand-library`) and
    `docs/project-state/module-brand-library-approval-checklist.md`'s "Sign-off" section.
    **"Push the branch" and "Open a PR" were then separately requested and executed** — pushed to
    `origin`, opened as
    [PR #70](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/70), all
    14 CI checks confirmed green. **"Merge PR #70" was then separately requested and executed** —
    merge commit `8c4d384d7c95e0089309ee7bd23ba1d715a3fe74`, all 14 CI checks green beforehand.
    Both Vercel projects auto-deployed on push to `main` and were verified live directly, not
    just via CI's own Vercel status check — `dashboard-api`'s `/health` returned
    `build.commitShaShort == 8c4d384`, confirming the exact merged commit is what's serving;
    `GET /brand-library/records` returned a clean `401` (route live, `SessionGuard` enforcing —
    not a `404`, which would mean the module never actually deployed); and `dashboard-web`'s `/`
    resolves (via the intermediate `/home` hop) to `/auth/sign-in` for an unauthenticated
    visitor, confirming the session gate is intact. **The Brand Library module backend is now
    genuinely live in production.** No `dashboard-web` UI exists yet for this module — a
    separate, not-yet-requested next step, matching every prior module's own backend-first
    precedent.

55. **`dashboard-web` Brand Library UI — built, reviewed, gated, merged
    ([PR #71](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/71),
    merge commit `3e2e7c486c3f839056fbcf67221228c68f5437b1`); now genuinely live in production
    (2026-08-27).** Closes the Brand Library module's last named gap, following the backend's own
    build-to-production arc (PR #70). Not started automatically — built directly on the explicit
    "Yes, start it" instruction, following the direct question "have you built the UI for it?".
    Mirrors Content Template Library's own `dashboard-web` UI file-for-file — both are single
    organization-wide tables with the standard 8-value `ArtifactApprovalStatus` workflow plus a
    real publish/unpublish mechanism. `BrandLibraryForm` treats `publicId`/`recordType` as
    create-only, matching `updateBrandLibraryRecordSchema`'s own `.omit()` contract;
    `fileReference` is validated client-side via the existing `isSafeHttpUrl()` guard before
    submit; `description`/`usageNotes` use the existing `RichTextEditor` — no backend
    sanitization change was needed, since `BrandLibraryService.create()`/`update()` already wired
    `sanitizeNullableRichText()`/`sanitizeNullableRichTextIfChanged()` in from day one, confirmed
    by reading the service directly rather than assumed. Four routes under
    `app/(shell)/brand-library/` (list, detail, create, edit). **Reviewed at light tier**, per
    this project's own 2026-08-27 "right-size the review pipeline" standing rule — a small,
    frontend-only UI slice consuming an already-reviewed, already-gated backend with no new
    endpoint or auth logic. A single direct read-through pass (not the 8-angle fan-out) verified
    the create-only field contract against the real backend DTO, the client-side URL validation,
    the status-actions transition table against the real backend `TRANSITIONS` table, the
    publish/unpublish gating against the real backend logic, reuse of established shared helpers,
    failure isolation, the terminal-state edit-route guard, and test coverage — **0 findings**. A
    separate security-review pass was skipped per the same standing rule, since the diff touches
    nothing security-relevant. Final numbers, independently re-verified by the orchestrating
    session and not trusted from the build agent's own report: 886/886 `dashboard-web` unit tests
    (55 new), typecheck clean across `@webdesk/shared-types`/`dashboard-web`/`dashboard-api`/
    `dashboard-worker`, `eslint --max-warnings=0` clean, CSS-token check clean (45 files),
    `next build` clean with all 4 new routes present, `prettier --check` clean, `pnpm audit` 0
    vulnerabilities. **Required second-role human review complete** — Jitesh D, "Approved," via
    the direct "gate it and push the branch" instruction; light tier, so the approval checklist's
    own findings table served as the review artifact rather than a separately published packet.
    **The gate (G4-dashboard-web-brand-library) was then separately requested and approved** —
    WebDesk Solution, decision CONFIRM, approved commit `e0ea072` on branch
    `dashboard-web-brand-library` — see `outputs/webdesk-growth-dashboard/project.json`'s
    `gates[]` (`current_gate` now `G4-dashboard-web-brand-library`) and
    `docs/project-state/dashboard-web-brand-library-approval-checklist.md`'s "Sign-off" section.
    **"Push the branch" and "Open a PR" were then separately requested and executed** — pushed to
    `origin`, opened as
    [PR #71](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/71), all
    14 CI checks confirmed green. **"Merge PR #71" was then separately requested and executed** —
    merge commit `3e2e7c486c3f839056fbcf67221228c68f5437b1`, all 14 CI checks green beforehand.
    Both Vercel projects auto-deployed on push to `main` and were verified live directly, not
    just via CI's own Vercel status check — `dashboard-api`'s `/health` returned
    `build.commitShaShort == 3e2e7c4`, confirming the exact merged commit is what's serving; and
    `dashboard-web`'s `/brand-library` and `/brand-library/new` both correctly redirect (307) an
    unauthenticated visitor to sign-in (a transient stale-edge-cache `404` on the first two checks
    was ruled out via repeated, cache-busted checks, not a real defect). **The `dashboard-web`
    Brand Library UI is now genuinely live in production**, closing out this slice's full
    build-to-production arc — backend and now the full UI (list, detail, create/edit form,
    status/publish actions) are both live for the Brand Library module.

56. **Section and Pattern Library module backend — built, reviewed, gated, pushed
    (2026-08-31).** Module #15, built directly on the explicit "start Section & Pattern Library"
    instruction. The canonical spec (`03_Detailed_Module_Specifications.md §15`) gives no field
    list for this module at all — only a taxonomy of pattern types — so three design forks were
    confirmed directly with the project owner first (`AskUserQuestion`): Component-Library-shaped
    fields (a section/pattern is a composition of components, sharing the same code-artifact
    record shape), real multi-row version history file-for-file mirroring Design Token Library
    (module #14), and no publish/unpublish action (nothing in the spec names one, matching Design
    Token Library over Design Reference Library). Table `section_pattern_records`, reusing the
    seeded `creative_design` RBAC group verbatim — no new RBAC migration.
    `description`/`responsiveBehavior`/`accessibilityNotes` are wired to
    `sanitizeNullableRichText()`/`sanitizeNullableRichTextIfChanged()` even though no
    `dashboard-web` UI exists yet, matching the scope doc's own field designations;
    `designReference` is validated via the shared `safeHttpUrlSchema`. Built by a background
    agent with a fully-specified prompt mirroring `design-tokens.service.ts` file-for-file, then
    independently re-verified in full by the orchestrating session — every high-risk file read
    directly, every test suite re-run fresh. **Independent code review then ran** (high effort,
    8-angle finder pass, 1-vote verification) — 12 candidates surfaced after dedup, 7 kept (6
    CONFIRMED, 1 PLAUSIBLE). **3 fixed**: `list()`'s and `supersedeOtherApprovedVersion()`'s
    actual query shapes each had no supporting index (both added to the migration, confirmed
    present via `psql \di`), and the version-row shape was hand-typed three times with mismatched
    optionality (consolidated via `Pick`/`Omit`/`Partial` from one source type). **4 left as
    accepted, tracked debt** — each confirmed byte-identical to Design Token Library's own
    already-shipped behavior, not a novel deviation: the same-status no-op bypassing the RBAC
    check, the fork-branch CAS guard's `isCurrent` omission (self-resolves via the unique index
    into a clean 409, no corruption), the `pattern_type`/`approval_status` enum-value
    triplication (no shared source-of-truth pattern exists anywhere in this codebase to reuse
    instead), and a coincidental `RICH_TEXT_MAX_LENGTH`/`PLAIN_TEXT_MAX_LENGTH` equality. **A
    separate `security-review` skill run then found 0 findings above threshold.** Migration
    numbers were then renumbered from `00078`/`00079` to `00080`/`00081` on explicit request —
    every reference updated and the renumbering independently re-verified against a real
    database; a stale local `dist/` build artifact (tsc doesn't clean removed source files)
    briefly caused a false failure, diagnosed and cleared, not a defect in the migration content.
    Final numbers: 1190/1190 `dashboard-api` unit tests (46 new), 515/515 `packages/database`
    integration tests (24 new), 514/514 `dashboard-api` e2e tests (24 new) — all independently
    re-run against a real disposable PostgreSQL 17 database; migration round-trip clean (79
    migrations); typecheck/lint/prettier all clean. A review packet (published as a Claude
    artifact, "Section and Pattern Library Review Packet" — code review + security review
    findings, fixes, and validation evidence, with a decision section) was prepared for the
    required second-role human review, since the implementing agent cannot also be its own
    reviewer (ADR-0010). **Jitesh D reviewed it and returned "Approved,"** no disputes raised.
    See `docs/project-state/module-section-and-pattern-library-approval-checklist.md`'s
    "Sign-off" section. **The gate (G4-section-and-pattern-library) was then separately
    requested and approved** — WebDesk Solution, decision CONFIRM (clean pass, not an override,
    since the second-role review was already complete before the gate was requested), approved
    commit `570d9a4` on branch `module-section-and-pattern-library` — see
    `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
    `G4-section-and-pattern-library`). **"Push the branch" was then separately requested and
    executed** — pushed to `origin`. **"Open a PR" was then separately requested and executed** —
    opened as
    [PR #78](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/78).
    **This gate approval does not itself authorize merging** — merge remains its own separate,
    not-yet-requested authorization, per this project's standing "no auto-merge" rule. No
    `dashboard-web` UI exists yet for this module — a separate, not-yet-requested next step,
    matching every prior module's own backend-first
    precedent.

57. **Page Template Library module backend — built, reviewed, gated, merged
    ([PR #82](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/82),
    merge commit `f467be9ae3811167d40323daeeb97f84a8f6cf46`); now genuinely live in production
    (2026-08-31).** Module #19, built directly on the explicit "start Page Template Library"
    instruction. Two genuine design forks confirmed directly with the project owner first
    (`AskUserQuestion`), given this module's own real dependencies include a not-yet-built
    module: `requiredSectionIds`/`optionalSectionIds`/`supportedComponentIds` are real,
    existence-validated relationships into the already-live Section and Pattern Library and
    Component Library (new narrow, read-only `existingRecordIds()`/`existingComponentIds()`
    delegating methods added to those modules' own services, mirroring
    `DesignTokensService.existingTokenIds()`'s own already-reviewed pattern); `wireframeReferences`
    stays a plain, unvalidated string array — `wireframe_library` doesn't exist yet, and it and
    this module are a real co-dependent cycle in the seeded module registry
    (`docs/phase-plans/module-implementation-roadmap.md` §4.2: "a template references its
    wireframe and a wireframe references the template it implements"). Table `page_templates`,
    a real multi-row version history mirroring Component Library's own already-reviewed pattern
    file-for-file, reusing the seeded `creative_design` RBAC group verbatim — no new RBAC
    migration. `pageType` is a 17-value closed enum taken directly from the canonical spec's own
    §16 taxonomy. Built by a background agent with a fully-specified prompt mirroring
    `components.service.ts` file-for-file, then independently re-verified in full by the
    orchestrating session — every high-risk file read directly (the migration, both cross-module
    relationship-validation wirings, RBAC decorator placement, the CAS-guard discipline), and
    every test suite independently re-run against a fresh local disposable PostgreSQL 17
    database, not trusted from the agent's own report: 1297/1297 `dashboard-api` unit tests,
    570/570 `packages/database` integration tests, 572/572 `dashboard-api` e2e tests, a real
    migration down/down/up round-trip (83 migrations), `validate:module-registry` (43 modules, 21
    permission groups), `pnpm audit` 0 vulnerabilities, typecheck/lint
    (`--max-warnings=0`)/prettier all clean. **Independent code review then ran** (high effort,
    8-angle finder pass, 1-vote verification) — 3 candidates kept after dedup, **2 fixed**: an
    unused, speculatively-added `PageTemplateRepository.findByIds()` with zero real callers
    anywhere in the codebase (removed, along with its two now-orphaned integration tests and its
    mention in the module's own file-list doc comment), and a missing overlap check between
    `requiredSectionIds`/`optionalSectionIds` (nothing rejected the same section id appearing in
    both arrays — closed with a shared `hasOverlappingSectionIds()` Zod `.refine()` on both
    `create` and `update`, with 5 new regression tests). **1 left as accepted, tracked debt**:
    `update()`'s terminal-state guard runs after the relationship-existence-check `Promise.all`,
    so editing an archived/superseded record with an also-invalid relationship id returns the
    wrong error message — byte-for-byte inherited from `ComponentsService.update()`'s identical
    ordering, now present in a 5th sibling module; fixing only this one would diverge from the
    established pattern. **A separate `security-review` skill run then found 0 findings above
    threshold** — confirmed RBAC decorators are method-level throughout (never class-level, which
    would silently fail open), the dynamic per-transition permission check in
    `changeApprovalStatus()` is sound, the two new cross-module existence-check methods leak no
    field/PII data (each returns only a bare `Set<string>` of ids), the search filter is fully
    parameterized via the already-audited `escapeLikePattern()`, mass-assignment is closed
    (`pageType`/`publicId`/`approvalStatus` all correctly excluded from the update route), and the
    new unvalidated `wireframeReferences` field is never rendered as a link by this backend-only
    module — no stored-XSS-enabling gap analogous to the historical Projects `environment.url`
    finding. Re-validated after the fix round: 1297/1297 `dashboard-api` unit tests (57 new
    overall), 570/570 `packages/database` integration tests, 572/572 e2e tests, typecheck/lint/
    prettier all clean. A review packet (published as a Claude artifact, "Page Template Library
    Review Packet" — code review + security review findings, fixes, and validation evidence, with
    a decision section) was prepared for the required second-role human review, since the
    implementing agent cannot also be its own reviewer (ADR-0010). **The project owner reviewed
    it and returned "Approve as-is,"** accepting the 1 open tracked-debt finding, no disputes
    raised. See `docs/project-state/module-page-template-library-approval-checklist.md`'s
    "Sign-off" section. **The gate (G4-page-template-library) was then separately requested and
    approved** — WebDesk Solution, decision CONFIRM (clean pass, not an override, since the
    second-role review was already complete before the gate was requested), approved commit
    `bd376be` on branch `module-page-template-library` — see
    `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
    `G4-page-template-library`). **"Push the branch" and "Open a PR" were then separately
    requested and executed** — pushed to `origin`, opened as
    [PR #82](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/82), all
    14 CI checks green. **"Merge PR #82" was then separately requested and executed** — merge
    commit `f467be9ae3811167d40323daeeb97f84a8f6cf46`, all 14 CI checks green beforehand. Both
    Vercel projects auto-deployed on push to `main` and were verified live directly, not just via
    CI's own Vercel status check — `dashboard-api`'s `/health` returned `build.commitSha ==
f467be9ae3811167d40323daeeb97f84a8f6cf46`, confirming the exact merged commit is what's serving;
    `GET /page-template-library/page-templates` returned a clean `401` (route live, `SessionGuard`
    enforcing — not a `404`, which would mean the module never actually deployed); and
    `dashboard-web`'s `/` resolves (via the intermediate `/home` hop) to `/auth/sign-in` for an
    unauthenticated visitor, confirming the session gate is intact. **The Page Template Library
    module backend is now genuinely live in production.** No `dashboard-web` UI exists yet for
    this module — a separate, not-yet-requested next step, matching every prior module's own
    backend-first precedent. **Update (2026-08-31): the `dashboard-web` UI has since been
    built — see item 58 below.**

58. **`dashboard-web` Page Template Library UI — built, reviewed, gated, merged
    ([PR #83](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/83),
    merge commit `6c7688c45ba65753e1858b61a06f9bb471340c05`); now genuinely live in production
    (2026-08-31).** Closes this module's last named gap, following the backend's own
    build-to-production arc (PR #82). Built directly on the explicit "Start the dashboard-web UI
    for it Page Template Library" instruction. Mirrors Component Library's UI structure
    file-for-file (the closest sibling — real FK-validated relationships via `@webdesk/ui`'s
    `RelationshipPicker` plus real multi-row version history): list/detail/create/edit routes,
    `RelationshipPicker` for `requiredSectionIds`/`optionalSectionIds`/`supportedComponentIds`,
    `TagListField` for the unvalidated `wireframeReferences`, a self-referential
    `SinglePageTemplatePicker` (3rd hand-copy of that wrapper shape, already self-documented as
    accepted debt) for `replacementRecordId`, and a real Version history section. Per the
    2026-08-22 standing rule, `contentRequirements`/`searchRequirements`/`conversionGoal` convert
    to `RichTextEditor` with a paired backend change: `PageTemplatesService.create()`/`update()`
    (both the in-place and fork branches) wire `sanitizeNullableRichText()`/
    `sanitizeNullableRichTextIfChanged()`/`sanitizeOrInherit()`, and the DTO cap raised
    4,000→40,000 to match the converged ceiling every sibling rich-text conversion lands on.
    **Independent code review** (high effort, 8-angle finder pass via parallel subagents,
    1-vote self-verification) surfaced 10 findings kept in the final report — **4 CONFIRMED,
    fixed**: `arrayField()` extracted into a new `arrayFieldValue()` export in
    `apps/dashboard-web/lib/rich-text.ts` (a 2nd byte-identical copy, past this codebase's own
    2-occurrence extraction threshold already applied to `richTextFieldValue()`), retrofitted
    onto `section-and-pattern-library-form.tsx` too, with 3 new regression tests; the
    status-actions component's self-declared duplication ordinal was verified inaccurate (sibling
    files' own claimed ordinals — 5th/6th/7th/7th — have already drifted out of sync with each
    other and don't track a real count) — corrected to point at a grep command instead; the
    `RICH_TEXT_MAX_LENGTH=40_000` doc comment's "10x ratio" claim was verified factually
    inaccurate (every other conversion did a 2x raise from a 20,000 starting cap; the real pattern
    is convergence on a 40,000-character ceiling regardless of starting point) — corrected; and,
    discovered while verifying that fix, **a real, live bug in a DIFFERENT, already-merged
    module** — Section and Pattern Library's own UI (PR #80) wires `RichTextEditor` but its
    backend cap was never raised to match, so a user can currently type content the backend will
    silently reject — flagged as a separate follow-up task, not fixed in this branch (different
    module, needs its own review cycle). **6 PLAUSIBLE findings left as accepted, tracked debt**,
    each matching an already-established duplication class elsewhere in this codebase: the audit
    trail (`afterState`) logging raw pre-sanitization HTML for the 3 rich-text fields
    (byte-identical to Website Strategy Center's/Section and Pattern Library's own already-shipped
    audit calls); three near-identical option-filtering `useMemo` blocks; selected-chip
    id-to-label resolution duplicated 3x; the `replacement` display value resolved via a one-off
    `useState` initializer instead of a `useMemo`; the create/edit empty-value sentinel ternary
    re-derived 4 times; and `plainField()`, an 8th independent hand-copy of the same closure shape
    across 7 sibling forms. Re-validated: 1207/1207 `dashboard-web` unit tests (62 new), 1299/1299
    `dashboard-api` unit tests, typecheck/lint/`check-css-tokens.mjs`/`next build`/`nest build`/
    prettier all clean. **A separate `security-review` skill run then found 0 findings above
    threshold** — confirmed all 3 write paths sanitize with no gap (new tests prove a `<script>`
    payload is stripped on both create and fork), every render site for the 3 rich-text fields
    routes exclusively through the shared `SanitizedRichText` component, no IDOR (relationship ids
    surface only records already returned by the caller's own permission-filtered list endpoints),
    and no SSRF/credential-leakage surface in the picker-fetch functions. A review packet
    (published as a Claude artifact, "Page Template Library UI Review Packet" — code review +
    security review findings, fixes, and validation evidence, with a decision section) was
    prepared for the required second-role human review, since the implementing agent cannot also
    be its own reviewer (ADR-0010). **The project owner reviewed it and returned "Approved
    as-is,"** accepting the 6 open PLAUSIBLE findings as tracked debt, no disputes raised. See
    `docs/project-state/dashboard-web-page-template-library-approval-checklist.md`'s "Sign-off"
    section. **The gate (G4-dashboard-web-page-template-library) was then separately requested
    and approved** — WebDesk Solution, decision CONFIRM (clean pass, not an override, since the
    second-role review was already complete before the gate was requested), approved commit
    `39e8deb` on branch `dashboard-web-page-template-library` — see
    `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
    `G4-dashboard-web-page-template-library`). **"Push the branch" and "Open a PR" were then
    separately requested and executed** — pushed to `origin`, opened as
    [PR #83](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/83), all
    14 CI checks green. **"Merge PR #83" was then separately requested and executed** — merge
    commit `6c7688c45ba65753e1858b61a06f9bb471340c05`, all 14 CI checks green beforehand. Both
    Vercel projects auto-deployed on push to `main` and were verified live directly, not just via
    CI's own Vercel status check — `dashboard-api`'s `/health` returned `build.commitSha ==
6c7688c45ba65753e1858b61a06f9bb471340c05`, confirming the exact merged commit is what's serving;
    `GET /page-template-library/page-templates` returned a clean `401` (route live, `SessionGuard`
    enforcing — not a `404`, which would mean the module never actually deployed); and
    `dashboard-web`'s `/page-template-library` correctly redirects (307) an unauthenticated
    visitor to `/auth/sign-in`. **The `dashboard-web` Page Template Library UI is now genuinely
    live in production**, closing out this slice's full build-to-production arc — backend and now
    the full UI (list, detail, create/edit form, status actions) are both live for the Page
    Template Library module.

59. **Wireframe Library module backend — built, reviewed, gated, merged
    ([PR #84](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/84),
    merge commit `5abb0f7091f720be1a84dace3a8c9425f209ec63`); now genuinely live in production
    (2026-08-31).** Module #16. Real multi-row version history (`wireframe_records`), mirroring
    Section and Pattern Library file-for-file. `relatedTemplateId` stays unvalidated — a real
    co-dependent cycle with `page_template_library` (item 57), which merged to `main`
    concurrently with this build; this branch's migrations were renumbered `00084`/`00085` on
    direct instruction to avoid colliding with Page Template Library's `00082`/`00083`, and
    `origin/main` was merged in twice more afterward as two further concurrent sibling PRs
    (`dashboard-web-page-template-library`, then its own live-verification doc commit) landed
    ahead of this one — only conflicts were barrel-export files and duplicate `CLAUDE.md`
    item/audit-log numbering, resolved by keeping both sides and re-sequencing, re-verified fully
    green after each merge. `fileReference` is a plain `safeHttpUrlSchema` URL, mirroring Brand
    Library. Full details, design decisions, and validation evidence:
    `docs/implementation/module-wireframe-library.md` and
    `docs/project-state/module-wireframe-library-approval-checklist.md`. Independent code review
    (high effort, 8-angle finder pass): **0 findings**. Security review: **0 findings above
    threshold**. Required second-role human review complete — Jitesh D, **"Approved,"** no
    disputes. **Gate G4-wireframe-library approved** — WebDesk Solution, decision CONFIRM,
    approved commit `ec96265` — see `outputs/webdesk-growth-dashboard/project.json`'s `gates[]`.
    **"Merge PR #84" was then separately requested and executed** — waited for all 14 CI checks
    to go green first (twice, after each concurrent-merge conflict resolution), merge commit
    `5abb0f7091f720be1a84dace3a8c9425f209ec63`. Verified live directly, not just via CI's own
    Vercel status check — `dashboard-api`'s `/health` returned `build.commitSha ==
5abb0f7091f720be1a84dace3a8c9425f209ec63`, confirming the exact merged commit is what's serving;
    `GET /wireframe-library/records` returned a clean `401` (route live, `SessionGuard`
    enforcing — not a `404`, which would mean the module never actually deployed); and
    `dashboard-web`'s `/` correctly redirects (307) an unauthenticated visitor to sign-in,
    confirming the session gate is intact. **The Wireframe Library module backend is now
    genuinely live in production.** No `dashboard-web` UI exists yet for this module — a
    separate, not-yet-requested next step, matching every prior module's own backend-first
    precedent. **Update (2026-08-31): the `dashboard-web` UI has since been built — see item 60
    below.**

60. **`dashboard-web` Wireframe Library UI — built, reviewed, gated, merged
    ([PR #85](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/85),
    merge commit `8b76ff109b33ef091b4806ed74307565ae859a84`); now genuinely live in production
    (2026-08-31).** Closes this module's last named gap, following the backend's own
    build-to-production arc (PR #84). Built directly on the explicit "Start the dashboard-web UI
    for it Wireframe Library" instruction. File-for-file mirrors Section and Pattern Library's
    already-reviewed UI structure — the closest sibling (both have real multi-row version
    history, both reuse the `creative_design` RBAC group). Four routes under
    `app/(shell)/wireframe-library/` at the module registry's own seeded `route` field
    (`/wireframe-library`, confirmed against migration `00035`): list, detail (with a
    `<details>`/`<summary>` version-history disclosure list using each row's own `isCurrent`
    field, not a cross-request id comparison), create, edit. `publicId`/`pageOrModule` are
    create-only; `viewport` a select; `fileReference` a client-validated (`isSafeHttpUrl()`) URL
    input; `annotations`/`interactionNotes` use the existing `RichTextEditor` per the 2026-08-22
    standing rule — the backend already sanitized both fields at write time from this module's
    original backend-only pass, so the only backend change needed was raising
    `RICH_TEXT_MAX_LENGTH` 20,000 → 40,000 to match; `relatedTemplateId` stays a plain free-text
    field, labeled clearly as unvalidated (the real `page_template_library` dependency cycle);
    `reviewerUserId` uses the reusable `UserPicker`. `WireframeStatusActions` mirrors the
    backend's `TRANSITIONS` table exactly, including the deliberate `approved -> archived`-only
    divergence (no `superseded` edge — supersede is automatic). **Reviewed at light tier**, per
    this project's 2026-08-27 "right-size the review pipeline" standing rule — a small,
    frontend-only UI slice consuming an already-reviewed, already-gated backend with only a
    validation-bound length-cap raise as the sole backend change. A direct read-through pass
    verified the create-only field contract against the real backend DTO, the transition table
    against the real backend `TRANSITIONS` table, reuse of every established shared helper
    (`artifact-approval-status.ts`, `detail-section-styles.ts`, `list-filter-styles.ts`,
    `list-table-styles.ts`, `pagination.ts`, `rich-text.ts`, `safe-http-url.ts`, `uuid.ts`,
    `SanitizedRichText`), the module-registry `route` value, failure isolation on the secondary
    reviewer-resolution fetch on both the detail and edit pages, and the edit page's
    terminal-state handling (matches the already-accepted `SectionAndPatternLibraryEdit`
    precedent — no server-side redirect on direct navigation to `/edit`, only the detail page
    hides the Edit link). **0 findings.** A separate security review was skipped per the same
    standing rule — no new endpoint, no new sink; both rich-text fields route exclusively through
    the existing, already-audited `SanitizedRichText` component. 1232/1232 `dashboard-web` unit
    tests (25 new), 46/46 `dashboard-api` unit tests for this module (unaffected by the
    length-cap change), typecheck/lint (`--max-warnings=0`)/CSS-token-check (62 files)/`next
build` (all 4 routes present)/prettier all clean — independently re-run by the orchestrating
    session, not trusted from the build agent's own report. See
    `docs/implementation/module-wireframe-library.md`'s "As-built — `dashboard-web` UI" section
    and `docs/project-state/dashboard-web-wireframe-library-approval-checklist.md`. **Required
    second-role human review complete via the direct "gate it and push the branch" instruction**
    — light tier, so the approval checklist's own findings table served as the review artifact
    rather than a separately published packet, since there were no open findings of any kind on
    this branch. **The gate (G4-dashboard-web-wireframe-library) was then separately requested
    and approved** — WebDesk Solution, decision CONFIRM (clean pass, not an override), approved
    commit `8f8d952` on branch `dashboard-web-wireframe-library` — see
    `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
    `G4-dashboard-web-wireframe-library`). **"Push the branch" and "Open a PR" were then
    separately requested and executed** — pushed to `origin`, opened as
    [PR #85](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/85), all
    14 CI checks confirmed green. **"Merge PR #85" was then separately requested and executed** —
    merge commit `8b76ff109b33ef091b4806ed74307565ae859a84`, all 14 CI checks green beforehand.
    Both Vercel projects auto-deployed on push to `main` and were verified live directly, not
    just via CI's own Vercel status check — `dashboard-api`'s `/health` returned
    `build.commitSha ==
8b76ff109b33ef091b4806ed74307565ae859a84`, confirming the exact merged commit is what's serving;
    `GET /wireframe-library/records` returned a clean `401` (route live, `SessionGuard`
    enforcing — not a `404`, which would mean the module never actually deployed); and
    `dashboard-web`'s `/wireframe-library` correctly redirects (307) an unauthenticated visitor to
    `/auth/sign-in` (a transient stale-edge-cache `404` on the first two checks was ruled out via
    repeated, cache-busted checks, not a real defect). **The `dashboard-web` Wireframe Library UI
    is now genuinely live in production**, closing out this slice's full build-to-production arc —
    backend and now the full UI (list, detail with version history, create/edit form, status
    actions) are both live for the Wireframe Library module.

61. **Motion and Interaction Library module backend — built, reviewed, gated, merged
    ([PR #86](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/86),
    merge commit `b59fba740266236fa1aacef02a95cbe1f9948b7e`); now genuinely live in production
    (2026-08-31).** Not
    started automatically — built directly on the explicit "start Motion &
    Interaction Library" instruction. The canonical spec (§18) gives no field list, only a bare
    ~26-category taxonomy — the same spec-gap situation Section and Pattern Library hit. Two
    design forks confirmed directly with the project owner first (`AskUserQuestion`): the field
    set (a 26-value `category` enum plus 8 content fields, mirroring the taxonomy) and
    `relatedComponentIds` as a REAL, existence-validated relationship into Component Library
    (`ComponentsService.existingComponentIds()`) rather than an unvalidated array — a genuine
    improvement over the Design Token/Section and Pattern Library precedent, since Component
    Library already exists. Single table (`motion_interaction_records`), real multi-row version
    history mirroring Section and Pattern Library structurally, the standard 8-value approval
    workflow, no confidentiality mechanism, no publish/unpublish action, reuses the seeded
    `creative_design` RBAC group verbatim. Built by a background agent, independently re-verified
    in full by the orchestrating session (every high-risk file read directly, every test suite
    re-run against a real disposable database). **Independent code review** (high effort,
    8-angle finder pass) surfaced 3 candidates after dedup — 1 CONFIRMED and fixed (the seeded
    `module_registry.dependencies` omitted the real Component Library coupling this build
    introduces, inconsistent with `module-implementation-roadmap.md`'s own dependency-derived
    wave computation; fixed via an additive migration and the roadmap doc updated to move this
    module from Wave 1 to Wave 2), 1 PLAUSIBLE left as accepted debt (the update DTO schema
    hand-duplicated instead of derived via `.omit()`/`.partial()` — matches 6 of 8 sibling
    modules' own convention), 1 REFUTED (an "unused speculative existence-check method" claim,
    raised independently by 3 finder angles, refuted on verification since it mirrors an
    established, already-consumed convention, not Page Template Library's genuinely-removed dead
    method). **Security review found 0 findings above threshold.** Mid-build, Wireframe Library
    (module #16) merged to `main` claiming migrations `00084`/`00085` — this branch's own
    migrations were renumbered to `00086`–`00088` after merging `main`, every internal reference
    updated, and everything independently re-verified against a fresh database (1386/1386
    `dashboard-api` unit, 620/620 `packages/database` integration, 625/625 `dashboard-api`
    e2e/integration, all clean; 88-migration round-trip clean). A review packet (published as a
    Claude artifact, "Motion and Interaction Library Review Packet" — code review + security
    review findings, fixes, and validation evidence, with a decision section) was prepared for
    the required second-role human review, since the implementing agent cannot also be its own
    reviewer (ADR-0010). See `docs/implementation/module-motion-and-interaction-library.md` and
    `docs/project-state/module-motion-and-interaction-library-approval-checklist.md`. **"Push the
    branch and open a PR" was then separately requested and executed** — pushed to `origin`,
    opened as
    [PR #86](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/86),
    then a Formatting-validation CI failure (a duplicate `CLAUDE.md` item number, introduced when
    `main` moved forward again mid-review) was found and fixed, all 14 CI checks green.
    **Required second-role human review complete** — Jitesh D reviewed it and returned
    "Approved," no disputes raised. **The gate (G4-motion-and-interaction-library) was then
    separately requested and approved** — WebDesk Solution, decision CONFIRM (clean pass, not an
    override, since the second-role review was already complete before the gate was requested),
    approved commit `fddbe85` on branch `module-motion-and-interaction-library` — see
    `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
    `G4-motion-and-interaction-library`) and
    `docs/project-state/module-motion-and-interaction-library-approval-checklist.md`'s "Sign-off"
    section. **"Merge PR #86" was then separately requested and executed** — merge commit
    `b59fba740266236fa1aacef02a95cbe1f9948b7e`, all 14 CI checks green beforehand.
    `dashboard-api` auto-deployed on push to `main` and was verified live directly, not just via
    CI's own Vercel status check — `/health` returned `build.commitSha ==
b59fba740266236fa1aacef02a95cbe1f9948b7e`, confirming the exact merged commit is what's serving;
    `GET /motion-and-interaction-library/records` returned a clean `401` (route live,
    `SessionGuard` enforcing — not a `404`, which would mean the module never actually deployed);
    and `dashboard-web`'s `/` resolves to `/auth/sign-in` for an unauthenticated visitor. **The
    Motion and Interaction Library module backend is now genuinely live in production.** No
    `dashboard-web` UI exists yet for this module — a separate, not-yet-requested next step,
    matching every prior module's own backend-first precedent. **Update (2026-08-31): the
    `dashboard-web` UI has since been built and gated — see item 62 below.**

62. **`dashboard-web` Motion and Interaction Library UI — built, reviewed, gated, merged
    ([PR #87](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/87),
    merge commit `c6d19fe552404169bfb43399d170a38786e93617`); now genuinely live in production
    (2026-08-31).** Closes this module's last named gap, following the backend's own
    build-to-production arc (PR #86). Not started automatically — built directly on the explicit
    "Start the dashboard-web UI for it" instruction. File-for-file mirrors Section and Pattern
    Library's already-reviewed UI structure, the closest sibling (both have real multi-row
    version history, both reuse the `creative_design` RBAC group): four routes
    (list/detail/create/edit) under `app/(shell)/motion-and-interaction-library/`. `category` is
    create-only, immutable across a record's own version chain; `description`/
    `triggerAndBehavior`/`accessibilityNotes` use `RichTextEditor` per the 2026-08-22 standing
    rule — the backend already sanitized all three at write time, so only a length-cap raise
    (20,000 → 40,000) was needed on `motion-and-interaction-library.dto.ts`, not new
    sanitization; `timingAndEasing`/`implementationSpec`/`fallbackBehavior` stay plain
    `<textarea>`s, matching the backend's own unsanitized plain-text schema for these three;
    `designReference` a client-validated (`isSafeHttpUrl()`) URL input; `relatedComponentIds` a
    REAL, existence-validated `RelationshipPicker` against Component Library.
    `MotionInteractionStatusActions` mirrors the backend's `TRANSITIONS` table exactly, including
    the deliberate `approved -> archived`-only divergence (no `superseded` edge — supersede is
    automatic). **Independent code review then ran** (this project's own `code-review` skill,
    medium effort, 8-angle finder pass, 1-vote verification) — 4 candidates survived dedup, 3
    fixed: `MotionInteractionStatusActions` used plain `useState` instead of the shared
    `useSyncedState()` hook every module built after 2026-08-27 adopts (its own named sibling
    template, `page-template-status-actions.tsx`, was itself updated to use it the same day this
    branch was built) — fixed; `arrayField()` reimplemented the shared `arrayFieldValue()` helper
    instead of delegating to it, unlike both sibling forms — fixed; the detail page's
    `relatedComponentIds` id-to-name resolution was a 3rd independent inline hand-copy of a
    pattern already present in Component Library's and Page Template Library's own detail pages,
    violating this project's own "extract after the 2nd occurrence" convention — fixed by
    extracting a new `lib/resolve-ids-to-names.ts`, with the two pre-existing sibling occurrences
    deliberately left untouched as an out-of-scope retrofit. 1 candidate (a triple-branch
    `designReference` truthiness check) was refuted as inherited from an already-shipped Section
    and Pattern Library precedent. Re-validated: 1283/1283 `dashboard-web` unit tests (48 new),
    typecheck/lint (`--max-warnings=0`)/CSS-token-check (64 files)/`next build` (all 4 routes
    present)/prettier all clean. **Security review skipped per the 2026-08-27 "right-size the
    review pipeline" standing rule** — a small, frontend-only UI slice consuming an
    already-reviewed, already-gated backend with only a length-cap raise as the sole backend
    change; no new endpoint, no new sink. **Required second-role human review complete via the
    direct "gate it and push the branch" instruction** — the approval checklist's own findings
    table served as the review artifact rather than a separately published packet, since there
    were no open findings of any kind on this branch after the fix round. **The gate
    (G4-dashboard-web-motion-and-interaction-library) was then separately requested and
    approved** — WebDesk Solution, decision CONFIRM (clean pass, not an override, since the
    second-role review was already complete before the gate was requested), approved commit
    `4f49b38` on branch `dashboard-web-motion-and-interaction-library` — see
    `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
    `G4-dashboard-web-motion-and-interaction-library`) and
    `docs/project-state/dashboard-web-motion-and-interaction-library-approval-checklist.md`'s
    "Sign-off" section. **This gate approval does not itself authorize pushing the branch,
    opening a PR, or merging** — each remains its own separate, not-yet-requested authorization,
    per this project's standing "no auto-merge" rule. **"Push the branch" and "Open a PR" were
    then separately requested and executed** — pushed to `origin`, opened as
    [PR #87](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/87), all
    14 CI checks confirmed green. **"Merge PR #87" was then separately requested and executed** —
    merge commit `c6d19fe552404169bfb43399d170a38786e93617`, all 14 CI checks green beforehand.
    Both Vercel projects auto-deployed on push to `main` and were verified live directly, not
    just via CI's own Vercel status check — `dashboard-api`'s `/health` returned
    `build.commitSha ==
c6d19fe552404169bfb43399d170a38786e93617`, confirming the exact merged commit is what's serving;
    `GET /motion-and-interaction-library/records` returned a clean `401` (route live,
    `SessionGuard` enforcing — not a `404`, which would mean the module never actually deployed);
    and `dashboard-web`'s `/motion-and-interaction-library` correctly redirects (307) an
    unauthenticated visitor to `/auth/sign-in`. **The `dashboard-web` Motion and Interaction
    Library UI is now genuinely live in production**, closing out this slice's full
    build-to-production arc — backend and now the full UI (list, detail with version history,
    create/edit form, status actions) are both live for the Motion and Interaction Library
    module. **Next candidate module: `design_review_center` — both the advisory
    `Recommended_Module_Roadmap.md` (order #22, right after Motion & Interaction Library) and the
    dependency-computed `docs/phase-plans/module-implementation-roadmap.md` (Wave 4) now agree —
    every one of its six real dependencies (`component_library`, `design_token_library`,
    `section_and_pattern_library`, `page_template_library`, `wireframe_library`,
    `motion_and_interaction_library`) is now genuinely live, closing this module out as the last
    unbuilt member of Wave 4. Not started or authorized — a separate, not-yet-requested next
    step.**

63. **Case Study Studio module #23 — backend built, reviewed, and gated (G4-case-study-studio,
    WebDesk Solution, CONFIRM); `dashboard-web` UI then built, reviewed, and gated
    (G4-dashboard-web-case-study-studio, WebDesk Solution, CONFIRM); pushed and opened as
    [PR #90](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/90), all
    14 CI checks green — not yet merged (2026-09-01).** Built directly on the explicit "start
    Case Study Studio" instruction, ahead of `design_review_center`. The backend implements the
    full bespoke 14-stage lifecycle named in the spec (D1), reusing Proof and Claims Library
    (`relatedClaimIds`) and Asset Library (`case_study_assets` join) instead of duplicating the
    spec's own separate tables, plus a `case_study_consents` sub-resource and a read-only
    `case_study_approvals` decision-history log. Independent code review (high effort, 8-angle
    finder pass) found 9 candidates, 7 fixed (most severe: `clientApprovalRequired` was patchable
    through the ordinary content-edit route, letting a caller with `edit`+`approve` silently
    bypass the mandatory `client_approval` stage — fixed by making it create-only/immutable), 1
    accepted as tracked debt. Security review found 0 findings above threshold. See
    `docs/implementation/module-case-study-studio.md` and
    `docs/project-state/module-case-study-studio-approval-checklist.md`.
    The `dashboard-web` UI (built directly on the explicit "Start the dashboard-web UI for it"
    instruction, on top of the still-unmerged backend on this same branch) adds
    list/detail/create/edit routes, a status-actions component byte-verified against the
    backend's real `TRANSITIONS` map, two independent `RelationshipPicker`s
    (`relatedServiceIds`/`relatedClaimIds`), and the three sub-resource sections. Independent
    code review (medium effort, 8-angle finder pass) found 8 candidates, 4 fixed (most severe: an
    unguarded `getUser()` call crashed the edit page for any role lacking `users_roles:view`,
    confirmed independently by 3 of the 8 finder angles — fixed with a try/catch mirroring
    `ProjectForm`'s own guard, plus a new regression test), 4 accepted as tracked debt matching
    already-established patterns elsewhere in this app. A security spot-check (not a full
    separate skill run, per the 2026-08-27 review-pipeline right-sizing standing rule) found no
    new endpoint or sink. **Required second-role human review complete for both slices** —
    Jitesh D reviewed both packets and returned "Approved." See
    `docs/project-state/dashboard-web-case-study-studio-approval-checklist.md`. **"Push the
    branch and open a PR" was then separately requested and executed** — pushed to `origin`,
    opened as [PR #90](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/90),
    all 14 CI checks confirmed green. **Neither gate approval authorizes merging PR #90** — merge
    remains its own separate, not-yet-requested authorization, per this project's standing
    "no auto-merge" rule. **Update (2026-09-01): PR #90 has since been merged** (merge commit
    `a44c76d`) and verified live in production.

64. **Case Study Library module #24 backend — built, reviewed, gated
    (G4-case-study-library, WebDesk Solution, CONFIRM), merged
    ([PR #92](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/92),
    merge commit `b54442cd428a25098f6827bd83935f07b0074009`) — now genuinely live in production
    (2026-09-01).** Built directly on the explicit "start Case Study Library" instruction. One
    genuine design fork confirmed directly with the project owner first (`AskUserQuestion`): a
    fully separate table, a browse view over Case Study Studio with no new table, or an extension
    table FK'd to Studio — **the project owner chose the extension-table approach**. Table
    `case_study_library_records` carries a real, unique DB-level FK into `case_studies` (one
    library record per case study), storing only `relatedPageIds` (existence-validated org-wide
    against the real Page Inventory `pages` table via a new `PagesService.existingPageIds()`/
    `PageRepository.findByIds()` pair), `technologies` (plain, unvalidated), and `testimonials`
    (a JSONB array of `{quote, author, role}`, plain text, no HTML) — never duplicating any of
    Case Study Studio's own fields; reads join in the full parent `CaseStudyEntity` at the service
    layer. Creation is gated on the parent's status being `published`/`unpublished`/`archived`
    (D5). No confidentiality/redaction mechanism, deliberately mirroring Case Study Studio's own
    already-accepted D9 precedent (the same `visibility` vocabulary is a workflow label, not a
    redaction axis, on both modules for consistency). Reuses the real, seeded `case_studies` RBAC
    permission group verbatim — no new RBAC migration. Built by a background agent with a
    fully-specified prompt, then independently re-verified in full by the orchestrating session —
    every high-risk file read directly, every test suite re-run against a real disposable
    PostgreSQL 17 database. **Independent code review** (high effort, 8-angle finder pass) surfaced
    10 candidates after dedup — 5 CONFIRMED, all fixed (most severe: `update()` had no
    terminal-state guard on the parent case study's status, contradicting its own doc comment,
    letting an archived case study's library record stay freely editable — fixed by fetching the
    parent up front and rejecting the edit, which also removed a now-redundant second fetch; also
    fixed a 400-vs-409 TOCTOU status-code inconsistency, an ambiguous conflict message conflating
    two distinct unique-constraint violations, and a cross-module RBAC-constant reuse deviation —
    `CASE_STUDY_LIBRARY_MODULE_KEY` is now declared locally instead of importing Case Study
    Studio's own constant, matching Persona Library's own precedent for a coincidentally shared
    value), 3 PLAUSIBLE accepted as tracked debt (an org-wide page-existence check with no RBAC
    scoping of its own, tempered by the current seeded matrix; two low-value `list()`/`update()`
    efficiency notes), 2 REFUTED. **Security review found 0 findings above threshold.** Final
    numbers: 1494/1494 `dashboard-api` unit tests (30 new), 690/690 `packages/database`
    integration tests (16 new), 690/690 `dashboard-api` e2e tests (13 new), a clean 94-migration
    round-trip, typecheck/lint/prettier clean, `pnpm audit` 0 vulnerabilities — all independently
    re-run by the orchestrating session, not trusted from the build agent's own report. A review
    packet (published as a Claude artifact, "Case Study Library Review Packet" — code review +
    security review findings, fixes, and validation evidence, with a decision section) was
    prepared for the required second-role human review, since the implementing agent cannot also
    be its own reviewer (ADR-0010). **The project owner reviewed it and returned "Approved
    as-is,"** accepting the 2 open tracked-debt items. **The gate (G4-case-study-library) was
    then separately requested and approved** — WebDesk Solution, decision CONFIRM (clean pass,
    not an override, since the second-role review was already complete before the gate was
    requested), approved commit `d6e88af` on branch `module-case-study-library` — see
    `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
    `G4-case-study-library`). **"Push the branch and open a PR" was then separately requested and
    executed** — pushed to `origin`, opened as
    [PR #92](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/92). A
    real merge conflict surfaced against `main` (Design Review Center's `dashboard-web` UI, PR
    #91, had merged concurrently) — resolved (only `outputs/webdesk-growth-dashboard/project.json`
    conflicted, both sides' gate/audit-log entries kept and re-sequenced), fully re-verified clean
    after the merge, then pushed again; all 14 CI checks confirmed green. **"Merge PR #92" was
    then separately requested and executed** — merge commit
    `b54442cd428a25098f6827bd83935f07b0074009`. Both Vercel projects auto-deployed on push to
    `main` and were verified live directly, not just via CI's own Vercel status check —
    `dashboard-api`'s `/health` returned `build.commitSha ==
b54442cd428a25098f6827bd83935f07b0074009`, confirming the exact merged commit is what's serving;
    `GET /case-study-library/records` returned a clean `401` (route live, `SessionGuard`
    enforcing — not a `404`, which would mean the module never actually deployed); and
    `dashboard-web`'s `/` resolves to `/auth/sign-in` for an unauthenticated visitor, confirming
    the session gate is intact. **The Case Study Library module backend is now genuinely live in
    production.** No `dashboard-web` UI exists yet for this module — a separate, not-yet-requested
    next step, matching every prior module's own backend-first precedent. **Update (2026-09-01):
    the `dashboard-web` UI has since been built, reviewed, gated, and merged — see item 65 below.**

65. **`dashboard-web` Case Study Library UI — built, reviewed, gated, merged
    ([PR #93](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/93),
    merge commit `725d3ecededab98af47151f7e778bfe59da781ea`); now genuinely live in production
    (2026-09-01).** Closes this module's last named gap, following the backend's own
    build-to-production arc (PR #92). Built directly on the explicit "Start the dashboard-web UI
    for it" instruction. Four routes (list/detail/create/edit) under
    `app/(shell)/case-study-library/`, mirroring Case Study Studio's own UI structure minus a
    status-actions component — this record has no lifecycle of its own, a pure extension over
    `case_studies` (D1). `relatedPageIds` is a plain, UUID-format-checked `TagListField`, not a
    `RelationshipPicker` — no org-wide (cross-project) page-lookup capability exists in
    `dashboard-web` yet, since Page Inventory's own list fetch is project-scoped; the backend still
    existence-validates every id server-side. `technologies` is a free-text tag list. `testimonials`
    uses a new, genuinely novel array-of-objects repeatable-row editor
    (`CaseStudyLibraryTestimonialsField`) — no existing sibling pattern for an embedded JSONB array
    (every other module's JSONB field is either backend-internal or a real sub-resource with its
    own CRUD endpoints). The create form's `SingleCaseStudyPicker` filters to
    `published`/`unpublished`/`archived` case studies, matching the backend's own D5
    creatable-status gate — deliberately does not exclude a case study that already has a library
    record (no cheap existence check exists client-side for that); picking one just surfaces the
    backend's own real 409, flagged directly in `lib/case-study-library.ts`. **Reviewed at light
    tier** per the 2026-08-27 "right-size the review pipeline" standing rule — a small,
    frontend-only slice consuming an already-reviewed, already-gated backend with no new endpoint.
    A direct read-through pass verified the create-only field contract, the `PATCH`-not-`POST
.../update` submit method against the real controller (`case-study-library.controller.ts`'s own
    `@Patch(":id")`), the picker's status filter, and the testimonial field constraints against the
    real backend DTO — **1 finding, fixed**: a duplicated UUID-regex literal in the form (now
    delegates to `lib/uuid.ts#isUuid()`), caught alongside a testimonial-row layout correction to
    use the established `rowMain`-wrapped structure instead of three bare flex children directly
    inside `.row`. Security review skipped per the same standing rule — no new endpoint, no new
    RBAC/auth logic, no new sink; testimonials render as plain text, never via
    `dangerouslySetInnerHTML`. 1432/1432 `dashboard-web` unit tests (23 new — 17 lib/query, 6
    component), typecheck/lint/CSS-token-check (73 files)/`next build` (all 4 routes present)/
    prettier all clean. See
    `docs/project-state/dashboard-web-case-study-library-approval-checklist.md`. **Required
    second-role human review complete via the direct "gate it and push the branch" instruction** —
    the approval checklist's own findings table served as the review artifact, since there was
    only the one already-fixed finding on this branch. **The gate
    (G4-dashboard-web-case-study-library) was then separately requested and approved** — WebDesk
    Solution, decision CONFIRM (clean pass, not an override, since the second-role review was
    already complete before the gate was requested), approved commit `9ea2afe` on branch
    `dashboard-web-case-study-library` — see `outputs/webdesk-growth-dashboard/project.json`'s
    `gates[]` (`current_gate` now `G4-dashboard-web-case-study-library`). **"Push the branch" was
    then separately requested and executed** — pushed to `origin`. **"Open a PR" was then
    separately requested and executed** — opened as
    [PR #93](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/93). One
    CI failure ("Integration tests") was investigated and found unrelated to this PR's diff (the
    branch touches only `apps/dashboard-web`/`packages/shared-types`, no backend/migration code) —
    a `Hook timed out in 10000ms` teardown timeout in an unrelated spec
    (`notifications.e2e-spec.ts`) cascading into a migration-teardown error; re-running the job
    (not changing code) resolved it, confirming the diagnosis. All 14 CI checks then green.
    **"Merge PR #93" was then separately requested and executed** — merge commit
    `725d3ecededab98af47151f7e778bfe59da781ea`. Both Vercel projects auto-deployed on push to
    `main` and were verified live directly, not just via CI's own Vercel status check —
    `dashboard-api`'s `/health` returned `build.commitSha ==
725d3ecededab98af47151f7e778bfe59da781ea`, confirming the exact merged commit is what's serving;
    and `dashboard-web`'s `/case-study-library`, `/case-study-library/new`, and a
    `/case-study-library/:recordId` detail route all correctly redirect (307) an unauthenticated
    visitor to `/auth/sign-in` (a transient stale-edge-cache `404` on the bare list route's first
    two checks was ruled out via repeated checks — `x-vercel-cache: MISS` on the resolved retry,
    not a real defect). **The `dashboard-web` Case Study Library UI is now genuinely live in
    production**, closing out this slice's full build-to-production arc — backend and now the full
    UI (list, detail, create/edit form) are both live for the Case Study Library module.

66. **Portfolio Library module #25 backend — built, reviewed, gated, merged
    ([PR #94](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/94),
    merge commit `747a4737763e8859c0c6ae2b53d493fda280b29f`); now genuinely live in production
    (2026-09-01).** Built directly on the explicit "take
    pull and start the portfolio library" instruction, using migration numbers `00095`/`00096` per
    the user's own explicit instruction (numbers `00093`/`00094` were reserved by concurrent
    in-flight work, later landing as Case Study Library). Four design forks confirmed directly with
    the user first (`AskUserQuestion`): screenshots as a real many-to-many join into the
    already-live `assets` table (`portfolio_assets`, mirroring `case_study_assets`) rather than a
    plain array; `relatedProofIds` as a real existence-validated array against `proof_claims` via
    `ClaimsService.existingClaimIds()`; `visibility` reusing Case Study Studio's own 4-value
    vocabulary; and a real, orthogonal publish/unpublish mechanism (mirroring Content Template
    Library's own `isPublished`/`publishedAt` CAS pattern) for the seeded `portfolio` RBAC group's
    unused `P` grant — the user chose the fuller/recommended option in all four. Organization-wide,
    no `recordType` discriminator (a single flat field list per the spec). **The build itself, and
    all review that followed, ran directly against a real disposable local PostgreSQL 17 database**
    using credentials the user supplied directly in chat (not via any file/env var Claude could
    read unprompted) — a genuine departure from most prior modules' build-time database access,
    since no local Postgres connection had been available to earlier sessions. A first
    build-agent pass left the DB-backed suites unverified (no working local credentials at that
    point); once the user shared them, the full migration `up`/`down`/`up` round-trip, the 33
    `packages/database` integration tests, and the 31 `dashboard-api` e2e tests were all run for
    real — surfacing and fixing 2 genuine e2e-test-authoring bugs (two tests sent a bare
    `randomUUID()` as `assetId` and expected `201`, when `PortfolioAssetsService.create()`
    correctly rejects a nonexistent `assetId` with `400`, D2's own existence-validation design
    working exactly as specified — fixed by seeding real `assets` fixtures via
    `AssetRepository.create()`, mirroring `case-study-studio.e2e-spec.ts`'s own fixture pattern).
    **Independent code review** (high effort, 8-angle finder pass) surfaced 8 findings kept after
    dedup — 5 fixed (`relatedProofIds` retyped to a UUID array at the DTO layer; a duplicated
    empty-patch `.refine()` validator extracted into a shared `rejectEmptyPatch()` helper; a
    triplicated "log, don't throw" audit try/catch extracted into a shared `recordAuditSafely()`
    private method; a redundant IDOR pre-check in `PortfolioAssetsService.remove()` removed, since
    the already-scoped repository call independently enforces the identical compound-`WHERE`
    scoping), 1 attempted fix reverted after it broke an existing unit test — parallelizing
    `publish()`'s sequential `findById()`/`assertAllowed()` calls via `Promise.all` turned out to
    be incorrect, not an improvement: the sequential order is deliberate, letting a non-approved
    record fail with the more specific `400` without ever needing "publish" permission at all — and
    3 left as accepted, tracked debt, each byte-identical to an already-established, repo-wide
    convention shared by 5+ sibling modules (`update()`'s `Promise.all` 404-vs-400 race inherited
    from `PersonasService.update()`'s/`ServicesService.update()`'s own identical shape;
    `changeApprovalStatus()`'s same-status no-op bypassing the RBAC check, matching Content
    Template Library's/Brand Library's own identical ordering; `updatePublishState()`'s adjacent
    boolean parameters, matching `ContentTemplateRepository.updatePublishState()`'s own identical
    signature verbatim). **Security review** (reviewed directly against the diff — guard/decorator
    placement, mass-assignment exclusions, IDOR scoping, input validation, raw-SQL safety) found
    **0 findings above threshold** — no new attack surface, every security-relevant mechanism
    reused from already-vetted sibling modules. Everything re-validated after the fix round and
    again after building the module on its own dedicated branch (`module-portfolio-library`,
    created after the fact — the initial build happened directly on `main`, corrected before
    committing) and merging in `origin/main`'s concurrent Case Study Library work (a real merge
    conflict in both `packages/database` barrel files and `project.json`'s gate/audit-log arrays,
    resolved by keeping both sides' entries and re-sequencing version counters — a 96-migration
    round-trip re-confirmed clean afterward). Final numbers: 52/52 `dashboard-api` unit tests,
    33/33 `packages/database` integration tests, 31/31 `dashboard-api` e2e tests,
    `validate:module-registry` (43 modules, 21 permission groups), typecheck/lint/prettier all
    clean. See `docs/implementation/module-portfolio-library.md` and
    `docs/project-state/module-portfolio-library-approval-checklist.md` for the full account.
    **Required second-role human review complete** — WebDesk Solution, "Approve (CONFIRM)," no
    disputes raised, accepting the 3 open tracked-debt findings as-is. **The gate
    (G4-portfolio-library) was then separately requested and approved** — WebDesk Solution,
    decision CONFIRM, approved commit `3fde438` on branch `module-portfolio-library` — see
    `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
    `G4-portfolio-library`). **"Push the branch" and "Open a PR" were then separately requested
    and executed** — pushed to `origin`, opened as
    [PR #94](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/94), all
    14 CI checks confirmed green. **"Merge PR #94" was then separately requested and executed** —
    a real merge conflict against `main` surfaced first (a second concurrent slice,
    `dashboard-web-case-study-library`, had merged in the meantime), resolved by keeping both
    sides' `project.json` gate/audit-log entries and re-sequencing version counters, re-verified
    (96-migration round-trip, 33/33 integration tests, 31/31 e2e tests, `validate:module-registry`
    all clean) before pushing again and waiting for all 14 CI checks to go green a second time.
    Merged with a real merge commit (not squash/rebase), matching every prior merge in this
    project's history — merge commit `747a4737763e8859c0c6ae2b53d493fda280b29f`. Both Vercel
    projects auto-deployed on push to `main` and were verified live directly, not just via CI's
    own Vercel status check — `dashboard-api`'s `/health` returned `build.commitSha ==
747a4737763e8859c0c6ae2b53d493fda280b29f`, confirming the exact merged commit is what's serving;
    `GET /portfolio-library/records` returned a clean `401` (route live, `SessionGuard`
    enforcing — not a `404`, which would mean the module never actually deployed); and
    `dashboard-web`'s `/` resolves (via the intermediate `/home` hop) to `/auth/sign-in` for an
    unauthenticated visitor, confirming the session gate is intact. **The Portfolio Library module
    backend is now genuinely live in production.** No `dashboard-web` UI existed yet for this
    module at the time — see item 68 below for its own build-to-production arc.

67. **Knowledge Library module backend — built, reviewed, gated, pushed (2026-09-01).** Module
    #28 on the Recommended Module Roadmap — a Wave 1 module with no dependencies. Built directly on
    the explicit "Start Knowledge Library module" instruction. Reuses Business Knowledge Center's
    identical `business_knowledge` RBAC permission group verbatim — no new RBAC migration. Two
    design forks confirmed directly with the project owner first (`AskUserQuestion`): a real
    `public | internal | restricted` confidentiality enum (Service Library's own pattern, gated via
    `AuthorizationService.canViewConfidential()`) over a 2-value enum or no enforcement, and a
    single generic table (Business Knowledge Center's own precedent) over a normalized multi-table
    shape. The lifecycle `status` field reuses BKC's own `mandatory`/`advisory`/`draft`/`deprecated`
    vocabulary with `restricted` removed, since confidentiality is now a real, separate field —
    `sourceType` (D4) and `location` (D5, the spec's own "URL/file" field) both stay plain,
    uncapped free text, since the canonical spec gives no taxonomy for either and forcing URL
    validation onto `location` would reject legitimate non-URL values (an internal file path, a
    citation). `ownerUserId` is a real, existence-validated FK into `users`; `relatedEntityIds` is
    a plain, unvalidated string array (no single scoped target module exists in the spec);
    `version` is a server-managed integer counter (Persona Library's own atomic
    `literal("version + 1")` + `returning: true` pattern, an improvement over BKC's own older
    re-fetch-after-write shape); `approvedForAgentUse` is stored but unenforced (no consuming
    "agent memory" mechanism exists anywhere in this codebase yet). Built by a background agent
    with a fully-specified prompt mirroring Business Knowledge Center's file structure, then
    independently re-verified in full by the orchestrating session — every high-risk file read
    directly, every test suite re-run fresh: 21/21 `dashboard-api` unit tests, 15/15
    `packages/database` integration tests, 14/14 `dashboard-api` e2e tests (real disposable
    PostgreSQL 17 database + real seeded RBAC), a clean migration round-trip, typecheck/lint/
    prettier all clean, `pnpm audit` 0 vulnerabilities. **Independent code review then ran** (high
    effort, 8-angle finder pass via parallel subagents, 1-vote self-verification) — 30+ candidates
    surfaced across all 8 angles, deduped to 6 kept findings, all CONFIRMED. **4 fixed**: `update()`
    had no terminal-state guard, letting a caller with only `edit` freely mutate a `deprecated`
    record — the exact gap-class Website Strategy Center's/Page Inventory's own reviews already
    converged on closing — fixed by unconditionally fetching the current record first and rejecting
    the edit outright, which also removed a redundant double-fetch in the `ownerUserId`
    re-validation branch; `CONFIDENTIAL_RESTRICTED_FIELDS` omitted `sourceType` — unlike BKC's own
    visible metadata field (`recordType`, a closed enum), Knowledge Library's `sourceType` is free
    text and can carry sensitive provenance — fixed by adding it alongside `location`/`notes`; no
    index existed on `updated_at` despite `list()` ordering every query by it, unlike Persona
    Library, this module's own explicitly-cited template — fixed by adding
    `knowledge_library_records_updated_at_idx`; and a `pg_trgm` trigram index on `title` was built
    with zero consuming search param, unlike every sibling module the migration comment itself
    cites — fixed by adding a `search` filter (`Op.iLike` + `escapeLikePattern()`). **2 findings
    left as accepted, tracked debt**, both verified byte-identical to Business Knowledge Center's
    own already-shipped, already-accepted shape: `update()`'s audit `afterState` logs the raw
    unredacted patch for a restricted record, and `create()` has no try/catch around its post-commit
    audit call. **A separate `security-review` skill run then found 0 findings above threshold** —
    confirmed correct redaction wiring on all 5 routes (including `create()`, since a record can be
    created directly as `restricted`), method-level RBAC decorators throughout, fully parameterized
    Sequelize queries with no raw-SQL interpolation of user input, and correct
    `escapeLikePattern()` usage on the new `search` filter. Re-validated: 22/22 `dashboard-api` unit
    tests, 16/16 `packages/database` integration tests, 16/16 `dashboard-api` e2e tests, migration
    round-trip clean, `validate:module-registry` unaffected (43 modules, 21 permission groups),
    typecheck/lint/prettier all clean, `pnpm audit` 0 vulnerabilities. **Migration numbers
    renumbered `00095`/`00096` → `00097`/`00098` after merging `main`**, which had concurrently
    taken `00095`/`00096` for Portfolio Library (item 66) — every internal reference updated,
    re-verified against a fresh database (98 migrations, round-trip clean) after the rename. See
    `docs/implementation/module-knowledge-library.md` and
    `docs/project-state/module-knowledge-library-approval-checklist.md`. **Required second-role
    human review complete via the direct "gate it and push the branch" instruction** — the
    approval checklist's own findings table served as the review artifact, since every CONFIRMED
    finding was either fixed or explicitly recorded as accepted debt matching an already-shipped
    sibling precedent. **The gate (G4-knowledge-library) was then approved** — WebDesk Solution,
    decision CONFIRM, approved commit `3274c60` on branch `module-knowledge-library` — see
    `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
    `G4-knowledge-library`). **"Push the branch" was then separately requested and executed** —
    pushed to `origin`. **This gate approval does not itself authorize opening a PR or merging** —
    each remains its own separate, not-yet-requested authorization, per this project's standing
    "no auto-merge" rule. **Update (2026-09-01): the `dashboard-web` UI has since been built and
    gated — see item 69 below.**

68. **`dashboard-web` Portfolio Library UI — built, code-reviewed, pushed, and merged
    ([PR #95](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/95),
    merge commit `985158c7c9c98d48478b3a030618f1f4eec7b3b5`); now genuinely live in production
    (2026-09-01).** Closes this module's last named gap, following the backend's own
    build-to-production arc (PR #94, item 66 above). Not started automatically — built directly on
    the explicit "Start the dashboard-web UI for it" instruction. No approved wireframe exists for
    this module — mirrors Design Reference Library's UI structure (closest sibling — same 8-value
    approval workflow plus an identical publish/unpublish mechanism) combined with Case Study
    Studio's `case_study_assets` sub-resource pattern for the new `PortfolioScreenshotsSection`
    (a real many-to-many join into Asset Library's `assets` table, `role`/`caption` editable
    in-place — `role` is a plain free-text input, not a closed `<select>`, since no fixed
    screenshot-role taxonomy is named anywhere in the canonical spec for this module, unlike
    `CaseStudyAssetRole`). No long-text/rich-text fields exist on this module's schema at all
    (every text field is `z.string().max(255)`), so no `RichTextEditor` wiring was needed — the
    only module built since the 2026-08-22 standing rule for which that's true. Four routes under
    `app/(shell)/portfolio-library/` (list, detail, create, edit); `relatedProofIds` is a real
    `RelationshipPicker` against Proof and Claims Library, including the raw-id-fallback-chip
    behavior for a selected id outside the picker's 100-row fetch window. New
    `packages/shared-types`: `PortfolioRecord`/`PortfolioAsset`/`PortfolioApprovalStatus`/
    `PortfolioVisibility`. **Independent code review then ran** (this project's own `code-review`
    skill, medium effort, 8-angle finder pass via parallel subagents) — several of the 8 finder
    agents lacked real tool access in this run and returned speculative, unconfirmed hypotheses
    rather than line-verified findings (disclosed explicitly by those agents themselves rather than
    silently reported as fact); every candidate from every angle was independently re-verified
    directly against the real committed code before being trusted. 4 candidates survived
    verification: 2 fixed — the detail page rendered `record.url` as a clickable `<a href>` with no
    client-side `isSafeHttpUrl()` guard, and used `rel="noreferrer"` instead of
    `"noopener noreferrer"`, both real deviations from every sibling detail page that renders a
    stored URL (the exact defense-in-depth convention this codebase adopted after `ProjectEnvironment.url`'s
    own historical stored-XSS finding) — fixed to match. 2 left as accepted, inherited debt,
    verified byte-identical to already-shipped sibling code, not new to this diff:
    `getPortfolioDetail()`'s `tolerateDiscard()` on the screenshots sub-fetch not actually isolating
    a transient failure (identical to `getCaseStudyDetail()`'s own shape in
    `case-study-studio.ts`), and a dead `response.status !== 204` clause in the screenshot-remove
    handler (identical to `case-study-assets-section.tsx`'s/`claim-sources-section.tsx`'s own). No
    separate security-review skill run — a small, frontend-only slice consuming an already-reviewed,
    already-gated backend with no new endpoint, matching the 2026-08-27 "right-size the review
    pipeline" standing rule. 265/265 `dashboard-web` unit tests overall (71 new: 16 query, 13 lib,
    11 status-actions, 12 publish-actions, 8 screenshots-section, 11 form), typecheck/lint/
    CSS-token-check (77 files)/`next build` (all 4 routes present)/prettier all clean —
    independently re-run after the fix round. Live-rendered in the Browser pane: `/portfolio-library`
    and the already-shipped `/projects` route were both confirmed to redirect an unauthenticated
    visitor to `/auth/sign-in` with the identical, pre-existing `NEXT_PUBLIC_API_BASE_URL is not
configured` console error on both — a local-environment limitation shared with every other module
    in this app, not something this branch introduced. **Unlike every prior module this session,
    no explicit second-role human review or gate decision was separately requested before merge** —
    "Push the branch and open a PR," "Check CI status on the PR," and "Merge PR #95" were each
    given as their own direct instructions in immediate succession, with the code review above as
    the only review step actually run. All 14 CI checks were confirmed green
    (`gh pr checks 95`) before merging with a real merge commit (not squash/rebase), matching every
    prior merge in this project's history — merge commit
    `985158c7c9c98d48478b3a030618f1f4eec7b3b5`. A concurrent PR (#96, Knowledge Library, item 67
    above) landed on `main` immediately afterward; both Vercel projects auto-deployed on the
    combined push and were verified live directly, not just via CI's own Vercel status check —
    `dashboard-api`'s `/health` confirmed `985158c` is a real ancestor of the currently-serving
    commit (`b406718`, PR #96's own merge); `GET /portfolio-library/records` returned a clean `401`
    (route live, `SessionGuard` enforcing — not a `404`, which would mean the module never actually
    deployed); and `dashboard-web`'s `/portfolio-library` correctly redirects (307) an
    unauthenticated visitor to `/auth/sign-in`. **The `dashboard-web` Portfolio Library UI is now
    genuinely live in production**, closing out this slice's full build-to-production arc — backend
    and now the full UI (list, detail, create/edit form, status actions, publish/unpublish actions,
    screenshots sub-resource editing) are both live for the Portfolio Library module.

69. **`dashboard-web` Knowledge Library UI — built, reviewed, gated, pushed (2026-09-01).** Closes
    this module's last named gap, following the backend's own build-to-production arc
    (PR #96, gate `G4-knowledge-library`). Built directly on the explicit "Start the dashboard-web
    UI for it" instruction. No approved wireframe exists for this module
    (`03_Detailed_Module_Specifications.md §28` is a flat field list) — every field mirrors the
    backend's actual `createKnowledgeLibraryRecordSchema`/`updateKnowledgeLibraryRecordSchema`
    directly, matching every sibling module's own "smallest honest reading" precedent. Mirrors
    Business Knowledge Center's/Persona Library's UI structure file-for-file — the closest
    siblings (a single generic table, an independent confidentiality field with the same
    `undefined`-means-redacted contract Service Library already established). New
    `packages/shared-types` `KnowledgeLibraryRecordStatus`/`KnowledgeLibraryRecordConfidentiality`/
    `KnowledgeLibraryRecord` (`sourceType`/`location`/`notes` typed `string | null | undefined`
    directly, honestly reflecting the backend's confidential-field redaction).
    `lib/knowledge-library-query.ts`/`lib/knowledge-library.ts` mirror
    `persona-library-query.ts`/`persona-library.ts`'s own zero-non-type-import-file split —
    `search` is clamped (not rejected) to 255 characters, matching Persona/Service Library's own
    established defense-in-depth precedent, a fix applied after first mistakenly copying Business
    Knowledge Center's stricter reject-on-overlong shape. `KnowledgeLibraryForm` has no create-only
    field (unlike most siblings — no `recordType`-style discriminator, no immutable `publicId`);
    `status` is deliberately never a form field, only the dedicated status route may change it;
    `ownerUserId` uses the reusable `UserPicker` with the established `ownerTouched` guard;
    `relatedEntityIds` is a free-text `TagListField` (unvalidated, matching Service Library's own
    `icpIds` shape); `location` stays plain text, deliberately never validated as a URL or rendered
    as a link, per the backend's own doc comment (a reference source's location may genuinely be a
    URL, an internal file path, or a citation). Per the 2026-08-22 standing rule, `notes` now uses
    `RichTextEditor` — a real, paired backend change since this field predates that rule:
    `KnowledgeLibraryRecordsService.create()`/`update()` now sanitize `notes` via
    `sanitizeNullableRichText()`/`sanitizeNullableRichTextIfChanged()` (`@webdesk/validation`), and
    the DTO cap was raised 10,000 → 20,000 to match the standard markup-overhead ratio every prior
    rich-text conversion in this codebase uses; 3 new `dashboard-api` unit tests prove sanitization
    on both create and update (including the skip-if-unchanged path). The detail page renders
    sections mirroring the backend's own field grouping (Identity, Source, Confidentiality, Notes,
    Status); a redacted record shows an inert notice for its Source and Notes sections; "Edit" is
    hidden once a record reaches its terminal `deprecated` status, matching Website Strategy
    Center's own precedent. **Reviewed at light tier**, per this project's own 2026-08-27
    "right-size the review pipeline" standing rule — a small, frontend-only UI slice consuming an
    already-reviewed, already-gated backend, plus a well-established, low-risk backend pattern
    (rich-text sanitization wiring) already used identically in 6+ prior modules. A direct
    read-through pass verified the create/edit field contract, the status-actions transition table
    against the real backend `ALLOWED_TRANSITIONS` table, the redaction contract (`undefined` vs
    `null`) against the real controller's `redactIfRestricted()`/`CONFIDENTIAL_RESTRICTED_FIELDS`,
    reuse of every established shared helper, and the terminal-state Edit-link hiding — **0
    findings** kept after the one search-clamping fix noted above. A separate security review was
    skipped per the same standing rule — no new endpoint, no new RBAC action, and the sole backend
    change (length-cap raise plus sanitization wiring) is identical in shape to 6+ already-reviewed
    prior modules; the one rich-text render site routes exclusively through the existing,
    already-audited `SanitizedRichText` component. Full validation, independently re-run and
    confirmed by the orchestrating session: 1571/1571 `dashboard-api` unit tests (3 new), 1540/1540
    `dashboard-web` unit tests (37 new — 22 lib/query, 8 status-actions, 7 form), a clean
    `next build` with all 4 new routes present, typecheck (`dashboard-api`/`dashboard-web`/
    `dashboard-worker`/`@webdesk/shared-types` all clean), `eslint --max-warnings=0` clean,
    CSS-token check clean (79 files), and `prettier --check` clean. See
    `docs/implementation/module-knowledge-library.md`'s "As-built — `dashboard-web` UI" section and
    `docs/project-state/dashboard-web-knowledge-library-approval-checklist.md`. **Required
    second-role human review complete via the direct "gate it and push the branch" instruction** —
    the approval checklist's own findings table served as the review artifact, since there were no
    open findings of any kind on this branch after the one fix. **The gate
    (G4-dashboard-web-knowledge-library) was then approved** — WebDesk Solution, decision CONFIRM,
    approved commit `11939b9` on branch `dashboard-web-knowledge-library` — see
    `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
    `G4-dashboard-web-knowledge-library`). **"Push the branch" was then separately requested and
    executed** — pushed to `origin`. **This gate approval does not itself authorize opening a PR
    or merging** — each remains its own separate, not-yet-requested authorization, per this
    project's standing "no auto-merge" rule.

70. **Ready for Claude Queue module backend — built, reviewed, gated, pushed (2026-09-01).**
    Module #30 on the Recommended Module Roadmap, built directly on the explicit "start Ready for
    Claude Queue" instruction, migration numbers starting at `00101` per explicit instruction
    (`00099`/`00100` reserved for other concurrent work). A genuinely bespoke 11-state manual
    execution queue (`05_Workflow_State_Machines.md §4`) — `draft → ready_for_claude → claimed →
in_progress → awaiting_review → approved → completed`, plus `changes_requested`/`cancelled`/
    `paused`/`failed` — NOT the generic 8-value `ArtifactApprovalStatus` every content-library
    module reuses, mirroring Internal Linking Library's own bespoke-workflow precedent. Reuses the
    seeded `ready_for_claude` RBAC permission group verbatim (`VCERAM` for `super_admin`/
    `owner_growth_approver`, `VCSE` for the four mid-tier roles — a real property of the matrix:
    no single role holds both `submit` and `approve`, so no one role can drive a task through its
    whole lifecycle alone). Two design forks confirmed directly with the user (`AskUserQuestion`)
    before building: the task's polymorphic "record" link uses the same `(targetModuleKey,
targetId)` shape Review and Approval Center already established (validated against the real
    module registry, `targetId` deliberately opaque); `dependencies` (other tasks that must
    complete first) is a real, existence-validated array checked against this same table. Backend
    only — no `dashboard-web` UI yet, matching every prior module's own backend-first precedent.
    Built by a background agent with a fully-specified prompt mirroring Review and Approval
    Center's/Internal Linking Library's exact file structure, then independently re-verified in
    full by the orchestrating session — every high-risk file read directly, every test suite
    re-run against a real local disposable PostgreSQL 17 database, not trusted from the agent's own
    report. **Independent code review then ran** (this project's own `code-review` skill, high
    effort, 8-angle finder pass, 1-vote verification) — 7 candidates surfaced after dedup, **all 7
    CONFIRMED, all 7 fixed**. Most severe: `changeStatus()` had no separation-of-duties check on
    `review`/`approve` transitions, and the module's own original doc comment justified this with
    "no role holds both submit and approve" — factually wrong, since `user_roles` has no
    one-role-per-user constraint, so a user holding both a submit-capable role and
    `super_admin`/`owner_growth_approver` simultaneously could self-approve their own task; fixed
    by wiring `SeparationOfDutiesService.assertDistinctActors()` (already exported by the
    already-imported `AuthModule`) into `changeStatus()`. Also fixed: `productionApproval`/
    `productionApproverUserId` were plain content fields writable through the generic
    `edit`-gated `PATCH .../tasks/:id` route, letting any mid-tier role fabricate a production
    sign-off with zero involvement of the real `approve`-gated `TRANSITIONS` table — fixed by
    making both server-managed, stamped only by `updateStatus()`'s own atomic write when the
    transition lands on `completed`; the `dependencies` "must complete before this one" contract
    was validated for existence only, never actually enforced — fixed with a new
    `assertDependenciesCompleted()` check applied at the one transition where it matters
    (`claimed → in_progress`); an empty-string `targetModuleKey` silently bypassed module-registry
    validation via a truthy-check guard (missing `.min(1)`) — fixed; an N+1 dependency-existence
    check (up to 50 concurrent single-row queries) — fixed with a new batched `existingIds()`
    repository method mirroring `ServiceRepository.findByIds()`'s own established pattern; a third
    independent hand-copy of `unwrapCasResult()` — extracted into a new shared
    `apps/dashboard-api/src/common/cas-result.util.ts`; and a hand-duplicated update DTO — fixed by
    deriving it via `.omit({publicId, projectId}).partial()`. 1 candidate (missing indexes on the
    `priority`/`agent` list filters) was independently verified REFUTED — the identical, unindexed
    shape already exists on Internal Linking Library's own already-shipped `priority` filter, a
    consistent repo-wide pattern, not a novel gap. Re-validated: 767/767 `packages/database`
    integration tests (4 new), 28/28 unit tests, 1634/1634 `dashboard-api` unit tests (63 in this
    module), 764/764 e2e/integration tests, a fresh migration round-trip (100 executed / 0
    pending), `validate:module-registry` (43 modules, 21 permission groups), typecheck/lint
    (`--max-warnings=0`)/`nest build`/prettier all clean, `pnpm audit` 0 vulnerabilities. **A
    separate `security-review` skill run then found 0 findings above threshold**, focused
    specifically on the fix round's own changes — confirmed no residual path exists to set
    `productionApproval`/`productionApproverUserId` outside the `approve`-gated `updateStatus()`
    write (the DTO types structurally lack them, Zod's `strip` mode would drop them even if sent,
    and the repository `update()` input type excludes them too); confirmed the new batched
    `existingIds()` query's `where: { id: ids }` is Sequelize's standard parameterized `IN (...)`
    shorthand with no injection surface; confirmed a caller cannot obtain a cheaper RBAC action via
    a fabricated `expectedStatus`, since the atomic CAS write only succeeds against the row's real
    current status. See `docs/implementation/module-ready-for-claude-queue.md` and
    `docs/project-state/module-ready-for-claude-queue-approval-checklist.md`. **Required
    second-role human review complete via the direct "Approve as-is, gate it and push the branch"
    instruction** — the approval checklist's own findings tables served as the review artifact,
    since there were no open findings of any kind on this branch. **The gate
    (G4-ready-for-claude-queue) was then approved** — WebDesk Solution, decision CONFIRM, approved
    commit `ec29767` on branch `module-ready-for-claude-queue` — see
    `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
    `G4-ready-for-claude-queue`). **"Push the branch" was then separately requested and
    executed** — pushed to `origin`. **This gate approval does not itself authorize opening a PR or
    merging** — each remains its own separate, not-yet-requested authorization, per this project's
    standing "no auto-merge" rule.

## Recent decisions

> Entries older than ~1 week are compressed to one line each, pointing to the full
> narrative in `docs/project-state/history/*.md` (Tier 2 — read on demand, not
> auto-loaded). Entries from the last ~1 week stay in full below.

- `[2026-08-05]` Skill-overlay build completed _(full record: `docs/project-state/history/2026-08-03-to-2026-08-09.md`)_
- `[2026-08-06]` Phase 0 foundation authored: 20 ADRs, 7 integration contracts, repository plan, requirements traceability, security foundation, Phase 1 plan — all formalizing already-resolved architecture, not new… _(full record: `docs/project-state/history/2026-08-03-to-2026-08-09.md`)_
- `[2026-08-06]` Phase 0 signed off (scope: Phase 1A only) and pushed to `origin/main`. Phase 1A repository/ monorepo foundation built and validated under that authorization _(full record: `docs/project-state/history/2026-08-03-to-2026-08-09.md`)_
- `[2026-08-07]` Phase 1A signed off (G1 gate passed, scope Phase 1A only) — see `docs/project-state/phase-1a-approval-checklist.md`'s "Sign-off". PR #1 merged 2026-08-07. _(full record: `docs/project-state/history/2026-08-03-to-2026-08-09.md`)_
- `[2026-08-07]` Phase 1B database-foundation task package prepared and approved (PR #2, merged) — see `docs/task-packages/phase-1b-database-foundation.md`. Documentation/planning only; Phase 1B implementation itself… _(full record: `docs/project-state/history/2026-08-03-to-2026-08-09.md`)_
- `[2026-08-07]` 9 transitive dependency vulnerabilities patched via bounded `pnpm-workspace.yaml` overrides (PR #3, merged) — `pnpm audit` 35 → 18 findings. Two version-line decisions (NestJS 10.x→11.x, Vitest… _(full record: `docs/project-state/history/2026-08-03-to-2026-08-09.md`)_
- `[2026-08-08]` The two deferred version-line decisions above (plus Next.js 15.x→16.x, needed for the same reason) executed under explicit user authorization, on branch `security/major-dependency-upgrades`: Next.js… _(full record: `docs/project-state/history/2026-08-03-to-2026-08-09.md`)_
- `[2026-08-07]` Postgres Marketplace provider confirmed: Supabase, `us-east-1` (N. Virginia) — satisfies ADR-0007 (North America East Coast + not Neon, WDS-002). Chosen over the other verified qualifying candidate… _(full record: `docs/project-state/history/2026-08-03-to-2026-08-09.md`)_
- `[2026-08-07]` Phase 1B database foundation built and validated, per explicit user authorization ("Execute Phase 1B now") to execute the already-approved task package. Real Sequelize connection, migration… _(full record: `docs/project-state/history/2026-08-03-to-2026-08-09.md`)_
- `[2026-08-07]` Phase 1B signed off (G-Schema gate passed, scope Phase 1B only), approved commit `80bd118b252ba2292af40d2ac8cecd217257ebc4` — see `docs/project-state/phase-1b-approval-checklist.md`'s "Sign-off" and… _(full record: `docs/project-state/history/2026-08-03-to-2026-08-09.md`)_
- `[2026-08-07]` First-login provisioning model resolved directly with the project owner: **pre-provisioned only** — Google SSO links/activates an existing admin-created `users` row matched by email; an unmatched… _(full record: `docs/project-state/history/2026-08-03-to-2026-08-09.md`)_
- `[2026-08-07]` Phase 1C (Google Workspace authentication, restricted emergency-local TOTP, session management) built and validated under explicit user authorization to begin … _(full record: `docs/project-state/history/2026-08-03-to-2026-08-09.md`)_
- `[2026-08-07]` Phase 1C merged to `main` via PR #7 at commit `102397d2f1aaf9fc5d374dd4bd58c764cb031ef9`, under explicit separate "merge the PR" authorization. Two real CI-only bugs found and fixed on the branch… _(full record: `docs/project-state/history/2026-08-03-to-2026-08-09.md`)_
- `[2026-08-07]` Phase 1D (RBAC/authorization) built and validated under explicit user authorization ("Begin RBAC (Task 6)") — `docs/task-packages/phase-1d-rbac-authorization.md`… _(full record: `docs/project-state/history/2026-08-03-to-2026-08-09.md`)_
- `[2026-08-07]` Phase 1C's G4-1C gate approved by explicit **OVERRIDE** (not a clean CONFIRM) — see `docs/project-state/phase-1c-approval-checklist.md` and `project.json`'s `gates[]`/ `audit_log`. Asked directly… _(full record: `docs/project-state/history/2026-08-03-to-2026-08-09.md`)_
- `[2026-08-07]` Received a much larger "Phase 1D" brief (RBAC, fine-grained permissions, confidential-field access, centralized policy/authorization service, project-scoped authorization, separation-of-duties across… _(full record: `docs/project-state/history/2026-08-03-to-2026-08-09.md`)_
- `[2026-08-07]` The required second-role human review of `docs/security/threat-model-authentication-session-handling.md` (Phase 1C) — the open item from the G4-1C OVERRIDE — was completed: WebDesk Solution reviewed… _(full record: `docs/project-state/history/2026-08-03-to-2026-08-09.md`)_
- `[2026-08-07]` Explicit authorization received ("Begin Phase 1D expanded scope") to build `docs/task-packages/phase-1d-rbac-permissions-expanded.md` on top of PR #8's `AuthzModule`. **Built, validated, and… _(full record: `docs/project-state/history/2026-08-03-to-2026-08-09.md`)_
- `[2026-08-07]` Self-role-assignment separation-of-duties gap — flagged, not fixed, in the original `docs/security/threat-model-authorization-rbac.md`'s Elevation of Privilege table — is now **closed**… _(full record: `docs/project-state/history/2026-08-03-to-2026-08-09.md`)_
- `[2026-08-08]` PR #10 (`security/major-dependency-upgrades`) merged to `main` under explicit "merge" authorization — Next.js 16, NestJS 11, Vitest 3, `pnpm audit` 19 → 0. See… _(full record: `docs/project-state/history/2026-08-03-to-2026-08-09.md`)_
- `[2026-08-08]` PR #9 (`phase-1d-rbac-permissions-expanded`) rebased onto the post-PR-#10 `main` (no conflicts), fully re-validated (144 unit + 41 integration + 37 e2e, `pnpm audit` clean), and merged to `main`… _(full record: `docs/project-state/history/2026-08-03-to-2026-08-09.md`)_
- `[2026-08-08]` Second-role security reviewer assigned for both outstanding Phase 1D reviews (`docs/security/threat-model-authorization-rbac.md` for PR #8, `docs/implementation/phase-1d-security-review.md` for PR… _(full record: `docs/project-state/history/2026-08-03-to-2026-08-09.md`)_
- `[2026-08-10]` Both required second-role security reviews completed: WebDesk Solution (Jitesh D and Brijesh D) reviewed `docs/security/threat-model-authorization-rbac.md` (PR #8) and… _(full record: `docs/project-state/history/2026-08-10-to-2026-08-16.md`)_
- `[2026-08-11]` Both Phase 1D gates approved by explicit "Approve both Phase 1D gates now" instruction — G4-1D (PR #8, `docs/project-state/phase-1d-validation-report.md`'s "Sign-off — G4-1D gate" section) and… _(full record: `docs/project-state/history/2026-08-10-to-2026-08-16.md`)_
- `[2026-08-11]` User manually created two Vercel projects and began deploying `main` directly (`webdesk-growth-dashboard` for `dashboard-web`, `webdesk-growth-dashboard-7v1u` for `dashboard-api`) — not a formal Task… _(full record: `docs/project-state/history/2026-08-10-to-2026-08-16.md`)_
- `[2026-08-11]` Postgres Marketplace provider **changed from Supabase to Neon**, `us-east-1` — explicit project-owner (WebDesk Solution) decision overriding WDS-002's Neon-exclusion rule specifically (the region… _(full record: `docs/project-state/history/2026-08-10-to-2026-08-16.md`)_
- `[2026-08-12]` User provisioned the actual Neon database via Vercel's Storage → Marketplace flow themselves ("neon added and redeployed successfully") — their own ad-hoc action, same pattern as manually creating… _(full record: `docs/project-state/history/2026-08-10-to-2026-08-16.md`)_
- `[2026-08-12]` Live-verified the real Google SSO login flow end-to-end as far as safely possible without Claude entering credentials (per both this project's own standing caution and Claude's own… _(full record: `docs/project-state/history/2026-08-10-to-2026-08-16.md`)_
- `[2026-08-12]` `dashboard-web`'s own `/auth/sign-in` page crashed with a `500` (React error #441 in the browser console) the first time it was actually loaded — a previously-undiscovered gap distinct from every… _(full record: `docs/project-state/history/2026-08-10-to-2026-08-16.md`)_
- `[2026-08-12]` GitHub App creation completed and installed — App ID `153184504`, created under `@webdesksolution`, installed on `WDS-Internal-DeveloperTeam` (the repo's actual owner org). Installation initially… _(full record: `docs/project-state/history/2026-08-10-to-2026-08-16.md`)_
- `[2026-08-12]` A staging-environment WordPress Application Password credential set as `WORDPRESS_APP` on Vercel — user confirmed this is staging-only, not production. Per-environment separation is a hard… _(full record: `docs/project-state/history/2026-08-10-to-2026-08-16.md`)_
- `[2026-08-12]` First real `users` row and Super Admin role provisioned in production, under explicit authorization, confirming the same Workspace org will be used at go-live (just a different primary domain later … _(full record: `docs/project-state/history/2026-08-10-to-2026-08-16.md`)_
- `[2026-08-12]` User submitted a formal Phase 1E authorization brief (Immutable Audit Logging, Operational Job Records, Notification Records, Retention Controls, Operational Contacts, Core System Operations… _(full record: `docs/project-state/history/2026-08-10-to-2026-08-16.md`)_
- `[2026-08-12]` Ran the Phase 1E authorization brief's own required pre-implementation verification (12 items: Phase 1D approval, exact approved SHA lineage, auth/sessions/RBAC/ confidential-fields/SoD… _(full record: `docs/project-state/history/2026-08-10-to-2026-08-16.md`)_
- `[2026-08-12]` Explicit authorization received ("Start Phase 1E with the audit foundation first") to build the audit-foundation slice of Phase 1E only (§5–8: audit-event architecture, immutability, retention… _(full record: `docs/project-state/history/2026-08-10-to-2026-08-16.md`)_
- `[2026-08-12]` Ran `pnpm --filter @webdesk/database run list-auth-events` against production (user ran it themselves in their own terminal, sourcing `prod-db.env` — Claude never saw the real `DATABASE_URL`, same… _(full record: `docs/project-state/history/2026-08-10-to-2026-08-16.md`)_
- `[2026-08-12]` CI's "Formatting validation" job failed on PR #12 — `pnpm format` (prettier `--check`) flagged `CLAUDE.md` (touched by that PR) plus 4 pre-existing files on `main`… _(full record: `docs/project-state/history/2026-08-10-to-2026-08-16.md`)_
- `[2026-08-12]` PR #12 merged to `main` under explicit "Merge PR #12" authorization — merge commit `11987fd`. `GoogleAuthService`'s token-exchange error logging fix is now on `main`; since `dashboard-api`'s Vercel… _(full record: `docs/project-state/history/2026-08-10-to-2026-08-16.md`)_
- `[2026-08-12]` PR #11 (`phase-1e-audit-foundation`) had a merge conflict against `main` after PR #12 merged — both touched `CLAUDE.md` only (no code-file overlap). Resolved under explicit "please resolve those and… _(full record: `docs/project-state/history/2026-08-10-to-2026-08-16.md`)_
- `[2026-08-12]` Migration `00018` (the ADR-0017 `audit_events` table, its DB-level immutability trigger/function, and the `git_commit_sha` check constraint) run against the real production Neon database — user ran… _(full record: `docs/project-state/history/2026-08-10-to-2026-08-16.md`)_
- `[2026-08-12]` **Production incident**: user asked to retry the login; found `dashboard-api` fully down instead — `/health` and every other route returned `500 FUNCTION_INVOCATION_FAILED`, a NestJS bootstrap crash… _(full record: `docs/project-state/history/2026-08-10-to-2026-08-16.md`)_
- `[2026-08-12]` **The real Google SSO login now works end-to-end in production**, closing the diagnosis thread that ran through most of this session. Path to resolution: (1) the `Logger.error()` call added in PR #12… _(full record: `docs/project-state/history/2026-08-10-to-2026-08-16.md`)_
- `[2026-08-13]` **Phase 1E (six operational-infrastructure architecture slices) built, merged, reviewed, and gated — the full arc from this entry's predecessor's "not merged" state to closed.** Summary (full detail… _(full record: `docs/project-state/history/2026-08-10-to-2026-08-16.md`)_
- `[2026-08-14]` **Phase 1F (application shell, canonical module registry, navigation authorization, observability, CI/accessibility, staging documentation, module-implementation roadmap) built, reviewed, and gated … _(full record: `docs/project-state/history/2026-08-10-to-2026-08-16.md`)_
- `[2026-08-14]` **Ran all pending production database migrations, surfacing and closing a previously-undocumented gap.** User ran `pnpm --filter @webdesk/database run migrate` themselves (sourcing `prod-db.env`… _(full record: `docs/project-state/history/2026-08-10-to-2026-08-16.md`)_
- `[2026-08-14]` **Prepared (not implemented) the Projects module task package**, per explicit instruction to use Phase 1F's own task-package template rather than a fresh giant prompt, and to "run consistency checks… _(full record: `docs/project-state/history/2026-08-10-to-2026-08-16.md`)_
- `[2026-08-15]` **Built the Projects module backend**, under explicit "begin implementation of the projects module" authorization, reinforcing three rules already in the task package: establish canonical project… _(full record: `docs/project-state/history/2026-08-10-to-2026-08-16.md`)_
- `[2026-08-15]` **Independent code review run against `module-projects-foundation` (explicit "run code review on the branch" instruction), then all 9 CONFIRMED findings fixed (explicit "fix the confirmed findings"… _(full record: `docs/project-state/history/2026-08-10-to-2026-08-16.md`)_
- `[2026-08-15]` **"Merge PR #24" was requested directly; held per this project's standing discipline** (security review → second-role human review → gate decision, each separate, before merge — none of the three had… _(full record: `docs/project-state/history/2026-08-10-to-2026-08-16.md`)_
- `[2026-08-15]` Both fix commits pushed (`66de25b` code, `0812896` docs); CI then failed on Formatting validation — `CLAUDE.md`'s own late edits hadn't been re-run through prettier before committing — fixed with a… _(full record: `docs/project-state/history/2026-08-10-to-2026-08-16.md`)_
- `[2026-08-15]` **The gate (G4-projects) was then separately requested and approved** — WebDesk Solution, decision CONFIRM (clean pass, not an override, since the second-role review was already complete before the… _(full record: `docs/project-state/history/2026-08-10-to-2026-08-16.md`)_
- `[2026-08-15]` **"Merge PR #24" was separately requested and executed.** Merged with a real merge commit (not squash/rebase) — `9ee540e67d50a471a4897d5af03cf5ccca01813f`. Both Vercel projects auto-deployed on push… _(full record: `docs/project-state/history/2026-08-10-to-2026-08-16.md`)_
- `[2026-08-16]` **Built the `dashboard-web` header Project Switcher**, under the explicit "build the dashboard-web Project Switcher UI" instruction. Genuinely undesigned scope going in — D7… _(full record: `docs/project-state/history/2026-08-10-to-2026-08-16.md`)_
- `[2026-08-16]` **Independent code review run on `dashboard-web-project-switcher` (PR #25), medium effort — a small, additive UI-only slice with no new mutation surface (reuses the already-reviewed, already-gated… _(full record: `docs/project-state/history/2026-08-10-to-2026-08-16.md`)_
- `[2026-08-16]` **The gate (G4-project-switcher) was then separately requested and approved** — WebDesk Solution, decision CONFIRM (clean pass, not an override, since the second-role review was already complete… _(full record: `docs/project-state/history/2026-08-10-to-2026-08-16.md`)_
- `[2026-08-16]` **"Merge PR #25" was separately requested and executed.** Merged with a real merge commit (not squash/rebase), matching every prior merge in this project's history — merge commit… _(full record: `docs/project-state/history/2026-08-10-to-2026-08-16.md`)_
- `[2026-08-16]` **Built the `dashboard-web` Projects list page** (`/projects`), under the explicit "build the Projects list page UI" instruction. Checked for a sourced design before writing any code… _(full record: `docs/project-state/history/2026-08-10-to-2026-08-16.md`)_
- `[2026-08-16]` **Independent code review run on `dashboard-web-projects-list` (PR #26), medium effort — a single new read-only list page + lib helpers + a new shared type, no new mutation surface (reuses the… _(full record: `docs/project-state/history/2026-08-10-to-2026-08-16.md`)_
- `[2026-08-16]` **The gate (G4-projects-list) was then separately requested and approved** — WebDesk Solution, decision CONFIRM (clean pass, not an override, since the second-role review was already complete before… _(full record: `docs/project-state/history/2026-08-10-to-2026-08-16.md`)_
- `[2026-08-16]` **"Merge PR #26" was separately requested and executed.** Merged with a real merge commit (not squash/rebase), matching every prior merge in this project's history — merge commit… _(full record: `docs/project-state/history/2026-08-10-to-2026-08-16.md`)_
- `[2026-08-16]` **Built the `dashboard-web` Project Detail page** (`/projects/:projectId`), under the explicit "build the project detail page UI" instruction. No approved wireframe exists; the only prior description… _(full record: `docs/project-state/history/2026-08-10-to-2026-08-16.md`)_
- `[2026-08-16]` **Independent code review run on `dashboard-web-project-detail` (PR #27), medium effort — a single new read-only detail page + lib helpers + new shared types, no new mutation surface (reuses the… _(full record: `docs/project-state/history/2026-08-10-to-2026-08-16.md`)_
- `[2026-08-16]` **Security review run on `dashboard-web-project-detail` (PR #27), separately from the code review.** 1 finding surfaced and confirmed at 9/10 confidence: the Environments section rendered each… _(full record: `docs/project-state/history/2026-08-10-to-2026-08-16.md`)_
- `[2026-08-16]` **Required second-role human review complete for `dashboard-web-project-detail` (PR #27).** A review packet (published as a Claude artifact — code review + security review findings, fixes, and… _(full record: `docs/project-state/history/2026-08-10-to-2026-08-16.md`)_
- `[2026-08-16]` **The gate (G4-project-detail) was then separately requested and approved** — WebDesk Solution, decision CONFIRM (clean pass, not an override, since the second-role review was already complete before… _(full record: `docs/project-state/history/2026-08-10-to-2026-08-16.md`)_
- `[2026-08-16]` **"Merge PR #27" was separately requested and executed.** Merged with a real merge commit (not squash/rebase), matching every prior merge in this project's history — merge commit… _(full record: `docs/project-state/history/2026-08-10-to-2026-08-16.md`)_
- `[2026-08-16]` **Built the `dashboard-web` Create/Edit Project form** (`/projects/new`, `/projects/:id/edit`), under the explicit "build the create/edit project form" instruction — the first real mutation UI in… _(full record: `docs/project-state/history/2026-08-10-to-2026-08-16.md`)_
- `[2026-08-17]` **Independent code review run on `dashboard-web-project-form` (PR #28), medium effort — 8-angle finder pass.** 7 findings surfaced, all CONFIRMED. Most severe: the session cookie's `SameSite=Strict`… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-17]` **Security review run on `dashboard-web-project-form` (PR #28), separately from the code review.** 0 findings above threshold. The two security-relevant changes from the fix round — the… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-17]` **The gate (G4-project-form) was then separately requested and approved** — WebDesk Solution, decision CONFIRM (clean pass, not an override, since the second-role review was already complete before… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-17]` **"Merge PR #28" was separately requested and executed.** Merged with a real merge commit (not squash/rebase), matching every prior merge in this project's history — merge commit… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-17]` **Built the `dashboard-web` Project Status Change / Archive actions**, under the explicit "build the status change and archive UI" instruction — the last named UI gap against an already-live backend… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-17]` **Independent code review run on `dashboard-web-project-status-actions` (PR #29), medium effort — 8-angle finder pass, then all findings verified.** 9 candidates surfaced; 8 survived 1-vote… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-17]` **Security review run on `dashboard-web-project-status-actions` (PR #29), separately from the code review.** 0 findings above threshold — confirmed the only file with real logic changes… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-17]` **The gate (G4-project-status-actions) was then separately requested and approved** — WebDesk Solution, decision CONFIRM (clean pass, not an override, since the second-role review was already… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-17]` **"Merge PR #29" was separately requested and executed.** Merged with a real merge commit (not squash/rebase), matching every prior merge in this project's history — merge commit… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-17]` **Registered a project-owner-supplied "Recommended Module Roadmap"** — `canonical-inputs/Recommended_Module_Roadmap.md`, sourced from `/Users/admin/Downloads/webdesk-headless-v1.11.29/Recommended… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-17]` **Built the minimal read-only user-lookup capability and wired it into Project owner assignment**, under the explicit "start with the blockers" instruction following the "Remaining Projects module… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-17]` **Independent code review run on `user-lookup-owner-assignment` (PR #30), medium effort — 8-angle finder pass.** 10 CONFIRMED findings after deduplication. Most severe: editing a project whose owner… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-17]` **Security review run on `user-lookup-owner-assignment` (PR #30), separately from the code review.** 0 findings above threshold. Five targeted questions were checked directly against the code: the… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-17]` **The gate (G4-user-lookup-owner-assignment) was then separately requested and approved** — WebDesk Solution, decision CONFIRM (clean pass, not an override, since the second-role review was already… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-17]` **"Merge PR #30" was separately requested and executed.** Merged with a real merge commit (not squash/rebase), matching every prior merge in this project's history — merge commit… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-17]` **Built the Projects module backend close-out** (branch `module-projects-backend-closeout`, [PR #31](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/31)), under the… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-17]` **Independent code review run on `module-projects-backend-closeout` (PR #31), medium effort — 8-angle finder pass, then all findings fixed.** 10 candidates surfaced after dedup (7 CONFIRMED, 3… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-17]` **Security review run on `module-projects-backend-closeout` (PR #31), separately from the code review.** 0 findings above threshold — the new `GET /projects/:projectId/approvers` route is correctly… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-17]` **The gate (G4-projects-backend-closeout) was then separately requested and approved** — WebDesk Solution, decision CONFIRM (clean pass, not an override, since the second-role review and the security… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-17]` **"Merge PR #31" was separately requested and executed.** Merged with a real merge commit (not squash/rebase), matching every prior merge in this project's history — merge commit… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-17]` **Migration `00045` (the additive `user_roles(role_id, project_id)` index) run against the real production Neon database** — user ran `pnpm --filter @webdesk/database run migrate` themselves in their… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-17]` **Dashboard UI/UX design-system package produced** (branch `dashboard-ui-design-system`) — an 18-document proposal under `docs/design/dashboard-ui/`, requested via a user-supplied design prompt ahead… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-17]` **The recommended dashboard UI/UX direction was reviewed and approved as-is** — WebDesk Solution, decision "Approve recommended direction (A, with the scoped B borrowing) as-is." Direction A (Clean… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-17]` **"Merge PR #32" was separately requested and executed.** Merged with a real merge commit (not squash/rebase), matching every prior merge in this project's history — merge commit… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-17]` **Scoped (not authorized to build) the Dashboard UI Foundation Alignment task package** — `docs/task-packages/dashboard-ui-foundation-alignment.md`, per design prompt §34's own next-step naming.… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-17]` **Dashboard UI Foundation Alignment built**, under the separate explicit "Begin this work" instruction the task package above itself required. Branch `dashboard-ui-foundation-alignment`, off `main`… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-18]` **Independent code review run on `dashboard-ui-foundation-alignment` (PR #33), high effort — 8 finder angles, 1-vote verification.** 10 findings surfaced, 8 CONFIRMED and 2 PLAUSIBLE. Most severe… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-18]` **Security review run on `dashboard-ui-foundation-alignment` (PR #33), separately from the code review.** 0 findings above threshold. Focused on this branch's most security-relevant addition… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-18]` **Required second-role human review complete for `dashboard-ui-foundation- alignment` (PR #33).** A review packet (published as a Claude artifact — code review + security review findings, fixes, and… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-18]` **The gate (G4-dashboard-ui-foundation-alignment) was then separately requested and approved** — WebDesk Solution, decision CONFIRM (clean pass, not an override, since the second-role review was… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-18]` **"Merge PR #33" was separately requested and executed.** Merged with a real merge commit (not squash/rebase), matching every prior merge in this project's history — merge commit… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-18]` **Built the `dashboard-web` Team management + Approver assignment UI**, closing gaps (2) and (3) from item 13's remaining-Projects-module-gaps analysis. Presented 4 scoping options for this work… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-18]` **Independent code review run on `dashboard-web-team-approver-management` (PR #34), high effort — 8-angle finder pass.** 10 candidates surfaced after dedup, all 10 CONFIRMED. Most severe… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-18]` **Security review run on `dashboard-web-team-approver-management` (PR #34), separately from the code review.** 0 findings above threshold. Confirmed no XSS surface (all rendered fields are… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-18]` **Required second-role human review complete for `dashboard-web-team-approver-management` (PR #34).** The review packet (code review + security review findings, fixes, and validation evidence, with a… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-18]` **The gate (G4-team-approver-management) was then separately requested and approved** — WebDesk Solution, decision CONFIRM (clean pass, not an override, since the second-role review was already… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-18]` **"Merge PR #34" was separately requested and executed — with an explicit, user-directed deviation from this project's standing "wait for fully green CI" discipline.** Merged with a real merge commit… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-18]` **Diagnosed and fixed a real production authentication bug**: the user reported that Google Workspace SSO login appeared to succeed at Google's own consent screen but then looped back to… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-18]` **Independent code review run on `fix-cross-domain-session-exchange` (PR #35), high effort — 8-angle finder pass, then all 10 CONFIRMED findings verified individually.** Most severe: splitting one… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-18]` **Security review run on `fix-cross-domain-session-exchange` (PR #35), separately from the code review, against the fixed branch.** One candidate identified (the new `DELETE /auth/session` route… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-18]` **The gate (G4-session-exchange) was then separately requested and approved** — WebDesk Solution, decision CONFIRM (clean pass, not an override, since the second-role review was already complete… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-19]` **"Merge PR #35" was separately requested and executed.** Merged manually by the user via GitHub directly (the `gh pr merge` command was blocked twice in a row by this session's own tool-permission… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-19]` **Migration `00046` run against production, then a real, same-day incident diagnosed and resolved: a Google SSO login attempted before the migration had actually landed failed with the generic "Your… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-19]` **Built the `/auth/exchange` error-masking fix**, under the explicit "fix the /auth/exchange error masking" instruction. Branch `fix-auth-exchange-error-masking`, off `main` at `f9bb065`. Split the… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-19]` **Independent code review run on `fix-auth-exchange-error-masking` (PR #36), high effort — 8 finder angles, deduped to 7 candidates for 1-vote verification.** 1 CONFIRMED, 5 PLAUSIBLE, 1 REFUTED… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-19]` **Security review run on `fix-auth-exchange-error-masking` (PR #36), separately from the code review.** 0 findings above threshold — confirmed diagnostics-only: the `reason` value on the… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-19]` **Required second-role human review complete for `fix-auth-exchange-error-masking` (PR #36).** The review packet was reviewed. **Jitesh D reviewed it and returned "Approved as-is,"** accepting all 5… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-19]` **The gate (G4-error-masking-fix) was then separately requested and approved** — WebDesk Solution, decision CONFIRM (clean pass, not an override, since the second-role review was already complete… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-19]` **"Merge PR #36" was separately requested and executed.** Waited for all 14 CI checks to go green first. Merged with a real merge commit (not squash/rebase), matching every prior merge in this… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-19]` **Fixed one of PR #36's 5 accepted-debt findings: the `AuthErrorReason` shared-type duplication.** Branch `fix-auth-error-reason-shared-type`, off `main` at `924ebb0`. Under the explicit "fix the… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-19]` **Independent code review run on `fix-auth-error-reason-shared-type` (PR #37), high effort — 8 finder angles, then all findings verified.** 7 candidates survived dedup (2 CONFIRMED, 3 PLAUSIBLE, 2… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-19]` **Security review run on `fix-auth-error-reason-shared-type` (PR #37), separately from the code review.** 0 findings above threshold. One candidate — the new `console.error` call logging the raw… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-19]` **Required second-role human review complete for `fix-auth-error-reason-shared-type` (PR #37).** The review packet (code review + security review findings, fixes, and the 3 open items, with an… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-19]` **The gate (G4-shared-type-fix) was then separately requested and approved** — WebDesk Solution, decision CONFIRM (clean pass, not an override, since the second-role review was already complete… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-19]` **"Merge PR #37" was separately requested and executed.** Waited for all 14 CI checks to go green first. Merged with a real merge commit (not squash/rebase), matching every prior merge in this… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-19]` **Closed the remaining PR #36 accepted-debt items in one consolidated batch**, under the explicit "fix the sibling OIDC-cookie branch... and if anything remaining then please do it all together, it… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-19]` **Independent code review run on `fix-remaining-session-exchange-debt` (PR #38), high effort — 8 finder angles, 1-vote verification.** 6 candidates survived dedup (3 CONFIRMED, 3 PLAUSIBLE). 4 fixed… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-19]` **Security review run on `fix-remaining-session-exchange-debt` (PR #38), separately from the code review.** 0 findings above threshold. Confirmed both changed areas preserve prior security-relevant… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-19]` **The gate (G4-session-exchange-debt-closure) was then separately requested and approved** — WebDesk Solution, decision CONFIRM (clean pass, not an override, since the second-role review was already… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-19]` **User reported the live Home page (`/home`) looked "very very simple"** (a screenshot of the production page — flat-bordered list items, no color, no visual hierarchy). Rather than assume the… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-19]` **User said the UI "still looks simple" even with the widget grid live** — "the UX is good but the UI must be good in look." Rather than iterate blindly in code a third time, drafted 3 full visual… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-19]` **Independent code review run on `dashboard-web-home-widget-grid` (PR #39), high effort — 8-angle finder pass against the full diff covering both items 23 and 24.** 9 findings survived verification… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-19]` **Security review run on `dashboard-web-home-widget-grid` (PR #39), separately from the code review, against the fixed branch (commit `a71d2bc`).** 0 findings above threshold — confirmed no new user… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-19]` **Required second-role human review complete for `dashboard-web-home-widget-grid` (PR #39).** The review packet (code review + security review findings, fixes, and the 2 open tracked-debt items, with… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-19]` **The gate (G4-visual-refresh) was then separately requested and approved** — WebDesk Solution, decision CONFIRM (clean pass, not an override, since the second-role review was already complete before… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-19]` **"Merge PR #39" was separately requested and executed.** Waited for all 14 CI checks to go green first — one, "Formatting validation," initially failed on a prettier table-alignment drift in the… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-19]` **User reported two real divergences from the approved "Enterprise Plus" mockup on the now-live Home page**: the sidebar stayed on the light `surface` fill (the mockup shows a continuous dark rail… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-19]` **Immediately after, the user pasted a reference screenshot of the sidebar and said directly: keep it light, not dark, and make it compact.** A genuine direction change from the just-shipped… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-19]` **Independent code review run on `dashboard-web-sidebar-grid-fix` (PR #40), medium effort — 8-angle finder pass against the full diff (net of both commits).** 6 findings survived verification (3… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-19]` **Security review run on `dashboard-web-sidebar-grid-fix` (PR #40), separately from the code review.** 0 findings above threshold — pure CSS Module/design-token/layout changes with no user input… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-19]` **Required second-role human review complete for `dashboard-web-sidebar-grid-fix` (PR #40).** The review packet (code review + security review findings, fixes, and the 2 open tracked-debt items, with… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-19]` **The gate (G4-sidebar-grid-fix) was then separately requested and approved** — WebDesk Solution, decision CONFIRM (clean pass, not an override, since the second-role review was already complete… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-19]` **"Merge PR #40" was separately requested and executed.** Waited for all 14 CI checks to go green first. Merged with a real merge commit (not squash/rebase), matching every prior merge in this… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-19]` **User shared a screenshot of Vercel's own dashboard sidebar as a reference** and asked to adapt our sidebar's row spacing and selection styling toward it — specifically "the spacing between menu and… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-19]` **Independent code review run on `dashboard-web-sidebar-vercel-spacing` (PR #41), medium effort — 8-angle finder pass.** 5 findings survived verification (1 CONFIRMED, 4 PLAUSIBLE) — three of the… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-19]` **Security review run on `dashboard-web-sidebar-vercel-spacing` (PR #41), separately from the code review.** 0 findings above threshold — pure CSS Module selector/spacing changes and a `className`… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-19]` **Required second-role human review complete for `dashboard-web-sidebar-vercel-spacing` (PR #41).** The review packet (code review + security review findings, fixes, and the 2 open tracked-debt… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_
- `[2026-08-19]` **The gate (G4-sidebar-vercel-spacing) was then separately requested and approved** — WebDesk Solution, decision CONFIRM (clean pass, not an override, since the second-role review was already… _(full record: `docs/project-state/history/2026-08-17-to-2026-08-23.md`)_

- `[2026-08-20]` **"Merge PR #41" was separately requested and executed.** Waited for all 14 CI
  checks to go green first. Merged with a real merge commit (not squash/rebase), matching every
  prior merge in this project's history — merge commit
  `7baf414462d245c3242998f7ae4ec38ac82e2dd7`. Both Vercel projects auto-deployed on push to `main`
  and were verified live directly, not just via CI's own Vercel status check — `dashboard-api`'s
  `/health` returned `build.commitSha ==
7baf414462d245c3242998f7ae4ec38ac82e2dd7`, confirming the exact merged commit is what's serving;
  `dashboard-web`'s `/home` correctly redirects an unauthenticated visitor to `/auth/sign-in`,
  confirming the session gate is intact. **The `dashboard-web` sidebar spacing & active-link fix is
  now genuinely live in production.**
- `[2026-08-20]` **Built the `dashboard-web` Roadmap/Objectives/Environments/Repositories editing**,
  closing gap (4) from item 13's remaining-Projects-module-gaps analysis, under the explicit "Let's
  scope and start sub-resource editing" instruction. Full account in item 27 above. **Independent
  code review** (high effort) surfaced 13 candidates, 12 CONFIRMED (1 REFUTED), 10 fixed — most
  severe a stale/contradictory roadmap-item status badge after "Set active phase," a repository
  Default-branch field that silently reset to "main" when cleared, and a NaN-sequence value
  silently serialized to `null`. **Security review found 0 findings above threshold.** **Jitesh D
  reviewed it and returned "Approved as-is."** **The gate (G4-subresource-editing) was then
  separately requested and approved** — WebDesk Solution, decision CONFIRM, approved commit
  `2df707e` on branch `dashboard-web-subresource-editing`. **"Merge PR #42" was then separately
  requested and executed** — one CI failure (Formatting validation, a whitespace artifact in
  `project.json` from the hand-edited gate approval) was found and fixed first; merge commit
  `e5c3910dd276739abf21ce713697f78b63b1f625`, all 14 CI checks green beforehand. Both Vercel
  projects auto-deployed and were verified live directly — `dashboard-api`'s `/health` returned
  `build.commitSha == e5c3910dd276739abf21ce713697f78b63b1f625`, and `dashboard-web`'s `/` resolves
  to `/auth/sign-in` for an unauthenticated visitor. **The sub-resource editing slice is now
  genuinely live in production.**
- `[2026-08-20]` **Scoped gap (5), "current project" context propagation, and it was explicitly
  deferred, not built.** Asked directly ("Let's scope and start current-project context propagation
  first give what is this?") — explained what actually exists today (the header Project Switcher
  writes a `wds_current_project` cookie via `document.cookie`, read only once server-side, in
  `app/(shell)/layout.tsx`, purely to pre-select the dropdown on load; confirmed via a dedicated
  investigation that literally nothing else in `apps/dashboard-web` reads it) and that no design
  spec anywhere describes what "propagation" should actually drive, since it was originally
  deferred under D7 (`module-projects-foundation.md`) as "real design/engineering work with no
  sourced spec," not a wiring afterthought. Presented the real scoping tradeoff directly
  (`AskUserQuestion`): defer entirely vs. build reusable server-side plumbing with no consumer yet
  vs. pick one real page as a pilot vs. something else. **The user chose to defer** — building
  generic propagation infrastructure with zero real downstream consumers (no other project-scoped
  business module exists yet) was judged speculative work with no way to validate the right shape.
  Nothing was built; only `CLAUDE.md` item 13/27 and this entry record the outcome. Of the five gaps
  item 13 originally named, this is now the only one remaining, and it is deliberately, not
  accidentally, unstarted.
- `[2026-08-20]` **Built the Business Knowledge Center backend**, under the explicit "start the
  business knowledge center now" instruction — the first of the 21 real business-module endpoints
  named in the phase plan. Genuine architectural ambiguity (an advisory-only roadmap note's
  Git+Postgres storage split, absent from the canonical spec) surfaced directly rather than
  silently adopted; the user chose pure DB-backed CRUD after confirming realistic storage sizing
  ("Yes, proceed"). Branch `module-business-knowledge-center`, off `main` at `621fed8`. See item 28
  under "Active tasks" above for the full design-decision and build account.
- `[2026-08-20]` **Independent code review run on `module-business-knowledge-center` (PR #43), high
  effort.** 12 candidates verified (11 CONFIRMED, 1 REFUTED and dropped), 10 kept in the final
  report per the review's own cap (9 CONFIRMED, 1 PLAUSIBLE). **All 9 CONFIRMED findings fixed**
  per the explicit "fix the confirmed findings" instruction — see item 28 for the full list; most
  severe were a TOCTOU race in `changeStatus()` (fixed with an atomic compare-and-swap) and the
  `restricted` status classification having no actual access enforcement (fixed by wiring
  `AuthorizationService.canViewConfidential()` and a redaction helper mirroring
  `operational-contacts.controller.ts`'s own pattern). The 1 PLAUSIBLE finding (no per-record-type
  cap on simultaneous `mandatory`/`advisory` records) was left as accepted, tracked debt — its own
  verifier concluded the correct invariant is genuinely record-type-dependent and the spec states
  no rule either way. Full re-validation against a fresh local disposable PostgreSQL 17 database:
  389/389 `dashboard-api` unit tests, 11/11 `packages/database` integration tests, 11/11
  `dashboard-api` e2e tests, migration up/down round-trip clean, module-registry validation
  unaffected, typecheck/lint/prettier clean, `pnpm audit` — 0 vulnerabilities. Pushed as commit
  `4421614da124125a733e2601cfbb85fd014021b5`.
- `[2026-08-20]` **Security review run on `module-business-knowledge-center` (PR #43), separately
  from the code review.** 3 candidates surfaced by the initial finder pass (unredacted content in
  the audit trail via `update()`'s `afterState`, no `canEditConfidential()` gate on the update
  route, no separation-of-duties check on self-approval) — each independently re-verified by a
  separate sub-agent against the actual code and design docs, all scored 2/10 confidence and
  dropped: all three turned out to be pre-existing, already-accepted architectural patterns
  replicated from `ProjectService`/`operational-contacts` (identical `afterState`-redaction gap in
  `ProjectService.update()`; identical read-redaction-only-not-write-gating shape in
  `operational-contacts.controller.ts`, where gating writes on `canEditConfidential()` would make
  `restricted` records permanently uneditable since that action is zero-seeded for every role; and
  the RBAC matrix's own design intent per D4 is role/grant separation, not actor-identity
  separation, matching `ProjectService.changeStatus()`'s identical shape), not new gaps this branch
  introduces. **0 findings above threshold.** A review packet (published as a Claude artifact —
  code review + security review findings, fixes, and validation evidence, with a decision section)
  was prepared for the required second-role human review, since the implementing agent cannot also
  be its own reviewer (ADR-0010). See
  `docs/project-state/module-business-knowledge-center-approval-checklist.md`.
- `[2026-08-20]` **Required second-role human review complete for `module-business-knowledge-center`
  (PR #43).** The review packet (code review + security review findings, fixes, and the 1 open
  tracked-debt item, with a decision section) was reviewed. **Jitesh D reviewed it and returned
  "Approved as-is,"** accepting the 1 open PLAUSIBLE code-review finding as tracked debt rather than
  requesting a fix. See
  `docs/project-state/module-business-knowledge-center-approval-checklist.md`'s "Sign-off" section.
  A gate decision and merge authorization remain separate, not-yet-requested next steps.
- `[2026-08-20]` **The gate (G4-business-knowledge-center) was then separately requested and
  approved** — WebDesk Solution, decision CONFIRM (clean pass, not an override, since the
  second-role review was already complete before the gate was requested), approved commit
  `b64a728` on branch `module-business-knowledge-center` — see
  `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
  `G4-business-knowledge-center`) and
  `docs/project-state/module-business-knowledge-center-approval-checklist.md`'s "Sign-off" section.
  **This gate approval does not itself authorize merging PR #43 or a production deployment** —
  merge remains its own separate, not-yet-requested authorization, per this project's standing "no
  auto-merge" rule (same pattern as every prior gate).
- `[2026-08-20]` **"Merge PR #43" was separately requested and executed.** Waited for all 14 CI
  checks to go green first. Merged with a real merge commit (not squash/rebase), matching every
  prior merge in this project's history — merge commit
  `032fb274920c523c07b252e45cc8bc0f097c8b4e`. Both Vercel projects auto-deployed on push to `main`
  and were verified live directly, not just via CI's own Vercel status check — `dashboard-api`'s
  `/health` returned `build.commitSha ==
032fb274920c523c07b252e45cc8bc0f097c8b4e`, confirming the exact merged commit is what's serving;
  `dashboard-web`'s `/` resolves (via the intermediate `/home` hop) to `/auth/sign-in` for an
  unauthenticated visitor, confirming the session gate is intact. **The Business Knowledge Center
  backend is now genuinely live in production.** No `dashboard-web` UI exists yet for this module —
  a separate, not-yet-requested next step, matching the Projects module's own precedent.
- `[2026-08-20]` **Built the `dashboard-web` Business Knowledge Center UI**, under the explicit
  "build the dashboard-web UI for it" instruction, closing the module's last named gap. Branch
  `dashboard-web-business-knowledge-center`, off `main` at `9e1abb6` (the commit recording PR #43's
  merge as live in production). New `packages/shared-types`
  (`BusinessKnowledgeRecordType`/`Status`/`Record`, with `content`/`notes` typed as genuinely
  optional to honestly reflect the backend's confidential-field redaction), `lib/business-knowledge-
query.ts`/`lib/business-knowledge.ts`, `BusinessKnowledgeRecordForm`, `BusinessKnowledgeStatusActions`,
  and four routes (list/detail/new/edit) under `/business-knowledge-center` — the exact `route`
  field the module registry already seeded. A `restricted` record's redacted content/notes render as
  an inert notice and are omitted entirely from the edit form's submit payload, never coerced to an
  empty string that could silently overwrite real confidential content — `content ===
undefined`/`notes === undefined` unambiguously signal redaction, distinct from a genuine `null`.
  `ConflictException` was added to `lib/api-errors.ts`'s allowlist so the backend's atomic-status-
  write `409` shows a real message — the first route in this app whose service layer can throw one.
  32 new `dashboard-web` unit tests (221/221 overall); typecheck/lint/`check-css-tokens.mjs`/`next
build`/prettier all clean; 15/15 Playwright tests passing (a local-environment-only false failure —
  a manually-started dev server on port 3000 being reused by Playwright's own `webServer` config
  instead of spinning up its own with `PLAYWRIGHT_E2E_TEST_MODE` set — was diagnosed and ruled out,
  not a real regression). Live-rendered in the Browser pane: the list and create routes both
  correctly redirect an unauthenticated visitor to `/auth/sign-in`, zero server errors; no local
  `dashboard-api` was available in this environment, so the authenticated success-path rendering
  wasn't visually confirmed, the same limitation the Projects list page's own as-built record
  already noted for itself. See `docs/implementation/dashboard-web-business-knowledge-center.md`
  for the full account. Pushed as branch `dashboard-web-business-knowledge-center`, opened as
  [PR #44](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/44) — not
  yet reviewed, gated, or merged.
- `[2026-08-20]` **Independent code review run on `dashboard-web-business-knowledge-center` (PR
  #44), high effort.** 20 candidates verified after dedup, 10 kept in the final report per the
  review's own cap (8 CONFIRMED, 2 PLAUSIBLE). **All 8 CONFIRMED findings fixed** per the explicit
  "fix the confirmed findings" instruction — most severe adding `ConflictException` to
  `lib/api-errors.ts`'s `SAFE_MESSAGE_CODES` silently changing error-message behavior for the
  already-shipped Projects approver-assignment flow, with a doc comment falsely claiming Business
  Knowledge was "the only route" that could throw one — fixed by correcting the comment and adding
  a regression test to `project-approvers-section.test.tsx`. Also fixed: redundant
  `contentRedacted`/`notesRedacted` flags collapsed to one (verified against actual backend
  behavior); `UUID_PATTERN`/`firstValue()` duplication extracted into new shared
  `lib/uuid.ts`/`lib/search-params.ts`; duplicated table-cell styles extracted into
  `lib/list-table-styles.ts`; a duplicated notes-normalization ternary hoisted; a missing
  `console.error` added with test coverage. 1 CONFIRMED finding (the list page over-fetching full
  `content`/`notes` for every row) is real but not fixable within this branch's own
  `dashboard-web`-only scope — flagged as known, out-of-scope debt rather than fixed. The 2
  PLAUSIBLE findings (a status-badge lookup with no fallback; the record-type/status enum
  triplicated across three files) were left as accepted, tracked debt — both inherited,
  already-accepted patterns from sibling code elsewhere in this app. Full re-validation: 223/223
  `dashboard-web` unit tests (2 new), typecheck/lint/`check-css-tokens.mjs`/`next build`/prettier
  all clean, 15/15 Playwright tests passing. Pushed as commit
  `1fb1823f7381536404a1b57a4246b19e5b13387b`.
- `[2026-08-20]` **Security review run on `dashboard-web-business-knowledge-center` (PR #44),
  separately from the code review.** 2 candidates surfaced by the initial finder pass (a "change
  status to unlock confidential content" UI-text concern, and the list page's full-content
  over-fetch) — each independently re-verified against the actual code and git history, both
  refuted: the redaction-bypass mechanism is entirely pre-existing backend code from the
  already-merged, already-security-reviewed PR #43 (confirmed via `git diff`/`git log` showing
  zero backend files touched by this branch — the endpoint is reachable via direct API call with
  or without this UI's existence), and the over-fetch crosses no authorization boundary (the same
  already-authorized viewer receives only data they could already fetch on demand — already
  correctly triaged as efficiency debt, consistent with how the identical pattern was treated on
  the Projects list page). **0 findings above threshold.** A review packet (published as a Claude
  artifact — code review + security review findings, fixes, and validation evidence, with a
  decision section) was prepared for the required second-role human review, since the
  implementing agent cannot also be its own reviewer (ADR-0010). See
  `docs/project-state/dashboard-web-business-knowledge-center-approval-checklist.md`.
- `[2026-08-20]` **Required second-role human review complete for
  `dashboard-web-business-knowledge-center` (PR #44).** The review packet (code review + security
  review findings, fixes, and the 1 flagged-not-fixed/2 tracked-debt items, with a decision
  section) was reviewed. **Jitesh D reviewed it and returned "Approved as-is,"** accepting the 2
  open PLAUSIBLE code-review findings and the flagged out-of-scope debt item as tracked debt
  rather than requesting fixes. See
  `docs/project-state/dashboard-web-business-knowledge-center-approval-checklist.md`'s "Sign-off"
  section. A gate decision and merge authorization remain separate, not-yet-requested next steps.
- `[2026-08-20]` **The gate (G4-dashboard-web-business-knowledge-center) was then separately
  requested and approved** — WebDesk Solution, decision CONFIRM (clean pass, not an override,
  since the second-role review was already complete before the gate was requested), approved
  commit `5d11d63` on branch `dashboard-web-business-knowledge-center` — see
  `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
  `G4-dashboard-web-business-knowledge-center`) and
  `docs/project-state/dashboard-web-business-knowledge-center-approval-checklist.md`'s "Sign-off"
  section. **This gate approval does not itself authorize merging PR #44 or a production
  deployment** — merge remains its own separate, not-yet-requested authorization, per this
  project's standing "no auto-merge" rule (same pattern as every prior gate).
- `[2026-08-20]` **"Merge PR #44" was separately requested and executed.** Waited for all 14 CI
  checks to go green first. Merged with a real merge commit (not squash/rebase), matching every
  prior merge in this project's history — merge commit
  `c2bc5194d5d0ff9f3aa3971b080b4486dfafb384`. Both Vercel projects auto-deployed on push to `main`
  and were verified live directly, not just via CI's own Vercel status check — `dashboard-api`'s
  `/health` returned `build.commitSha ==
c2bc5194d5d0ff9f3aa3971b080b4486dfafb384`, confirming the exact merged commit is what's serving;
  `dashboard-web`'s new `/business-knowledge-center` route correctly redirects an unauthenticated
  visitor to `/auth/sign-in`, same as the existing `/projects` route — a transient stale-edge-cache
  404 on the very first check was ruled out via a cache-busting query param and repeat checks, not
  a real defect. **The Business Knowledge Center `dashboard-web` UI — list, detail, create, and
  edit screens, plus status-transition actions — is now genuinely live in production.**
- `[2026-08-20]` **Production incident: `GET /business-knowledge/records` returning a real `500` in
  production, reported directly by the user via screenshot ("getting this error when tapping on the
  business knowledge center").** Diagnosed via live Vercel runtime logs (the user's own
  authenticated Chrome session): `/health`/`/me`/`/me/navigation`/`/projects` all returned `200` in
  the identical request bursts, isolating the failure to the one route family the Business Knowledge
  Center backend (PR #43) added. The real underlying exception wasn't recoverable from Vercel's log
  capture (only pino-http's generic "request errored" wrapper was found, not NestJS's own
  `Logger.error()` line), but going back through this session's own actions confirmed the real cause
  directly: **unlike every other schema change in this project's history, migrations `00047`
  (creates `business_knowledge_records`) and `00048` (marks the module `in_development`) were never
  run against the production database after PR #43 merged.** The user was asked to run
  `pnpm --filter @webdesk/database run migrate` (and `migrate:status` to confirm) themselves, same
  credential-handling discipline as every prior production migration — **outcome not yet confirmed
  as of this entry; still open.**
- `[2026-08-20]` **Business Knowledge Center — Rich Content & File Attachments task package
  scoped, not yet authorized to build.** See "Active tasks" item 30 above and
  `docs/task-packages/business-knowledge-center-rich-content-attachments.md` for the full account —
  a rich-text editor for typed content, file attachments (DOCX/XLSX/PDF/Markdown, already-approved
  formats), and formatted preview rendering on both the create form and the detail page. The
  project's first proposed use of Vercel Blob and the `ObjectStorageAdapter` pattern; flags storing/
  rendering arbitrary HTML as a genuinely new security surface needing its own dedicated review.
  Six open items recorded for a decision before implementation begins.
- `[2026-08-20]` **Business Knowledge Center — Rich Content & File Attachments — built and fully
  validated.** See "Active tasks" item 30 above and
  `docs/implementation/business-knowledge-center-rich-content-attachments.md` for the full
  as-built account. Built directly on the explicit "go ahead and start building it" instruction,
  bundling in an explicitly-requested page-size selector (10/20/30/50/100) for both paginated
  list pages and a real clear-filters bug fix. Migration `00049`, the first real
  `BlobStorageAdapter` implementation (revised from its Phase 1A placeholder shape after
  verifying Vercel's actual documented Blob mechanics directly), new `dashboard-api` attachment
  endpoints, format-specific preview generation, and mandatory write-time + render-time HTML
  sanitization. 149/149 `packages/database` integration + 28/28 unit, 8/8 `packages/integrations`
  unit, 427/427 `dashboard-api` unit + 132/132 e2e, 258/258 `dashboard-web` unit + 15/15
  Playwright, all passing; full validation clean; `pnpm audit` 0 vulnerabilities. Pushed as
  branch `business-knowledge-center-rich-content-attachments`. **Not yet reviewed, gated, or
  merged** — each a separate, not-yet-requested next step.
- `[2026-08-20]` **Independent code review run on `business-knowledge-center-rich-content-attachments`
  (PR #45), high effort — 8 finder angles, then 8 of 9 findings fixed per explicit "fix the
  confirmed findings" instruction.** See "Active tasks" item 30 above and
  `docs/implementation/business-knowledge-center-rich-content-attachments.md` §7 for the full
  account. Most severe: the file-attachment upload flow pointed `@vercel/blob/client`'s
  `handleUploadUrl` directly at `dashboard-api` — a genuinely cross-origin request the session
  cookie could never reach (the Blob client SDK has no `credentials` option, and browsers forbid
  scripts from setting `Cookie` manually) — every real upload attempt would have 401'd in
  production, verified directly against the installed SDK's own source before fixing. Fixed with a
  new same-origin `dashboard-web` proxy Route Handler forwarding the session cookie
  server-to-server, the same pattern `app/auth/session/route.ts` already established. Also fixed:
  an edit-mode content-clearing bug storing `'<p></p>'` instead of `null` (the DTO widened to
  accept an explicit `null`, distinct from omission); a missing try/catch in `confirm()` that
  orphaned the Blob object on a corrupt-file crash; a silent rich-text-editor/state desync on the
  length-limit guard (the guard removed entirely, the limit now enforced once at submit time); a
  sequential record/attachments fetch with no genuine dependency; a redundant `router.refresh()`
  alongside an already-sufficient local update; and the two apps' duplicated sanitization
  allowlists, promoted into a new `sanitizeRichTextHtml()` export in `packages/validation` — the
  same promotion that also closes a real reverse-tabnabbing gap (a `transformTags` rule now forces
  a safe `rel` onto any `target`-carrying `<a>`). 1 CONFIRMED finding (no cleanup mechanism for a
  Blob object orphaned by an interrupted upload — closed tab or dropped network between the Blob
  PUT completing and `confirm()` succeeding) left as accepted, tracked debt — a real fix means a
  cron/reconciliation job, out of proportion for a review-fix pass. Re-validated: 430/430
  `dashboard-api` unit tests, 132/132 `dashboard-api` e2e tests (real disposable database), 9/9
  `packages/validation` unit tests (5 new), 258/258 `dashboard-web` unit tests, typecheck/lint/
  `next build`/`nest build`/`check-css-tokens.mjs`/prettier all clean across every touched
  package, `pnpm audit` 0 vulnerabilities. **Not yet security-reviewed, second-role human
  reviewed, gated, or merged** — each a separate, not-yet-requested next step.
- `[2026-08-20]` **Security review run on `business-knowledge-center-rich-content-attachments`
  (PR #45, reviewed commit `359e9a9`), separately from the code review.** Given this branch is
  this project's first HTML-storage/rendering surface, the sanitization boundary was treated as
  its own explicit focus area. **0 findings above the confidence threshold.** Confirmed correct
  IDOR scoping on every attachment read/write, correct `restricted`-record redaction, the new
  same-origin upload proxy route is not an open proxy/SSRF vector, the sanitizer allowlist and
  `transformTags` rel enforcement hold, `markdown-it` runs with `html: false`, XLSX cell text is
  HTML-escaped before table assembly, Blob pathnames are prefix-checked with the real storage key
  stripped from every response, and the content-proxy route's filename is
  `encodeURIComponent`-escaped. One sub-threshold observation recorded, not raised as a finding: a
  doc comment claims a render-time sanitization pass that isn't actually called — not
  independently exploitable, since the one write path to that field is already sanitized before
  persisting. See `docs/implementation/business-knowledge-center-rich-content-attachments.md` §8
  for the full account. A review packet (published as a Claude artifact — code review
  findings/fixes, the security review, and validation evidence, with a decision section) was then
  prepared for the required second-role human review, since the implementing agent cannot also be
  its own reviewer (ADR-0010). **Jitesh D reviewed it and returned "Approved as-is,"** accepting
  the one open CONFIRMED code-review finding (no cleanup mechanism for a Blob object orphaned by
  an interrupted upload) as tracked debt rather than requesting a fix before merge. See
  `docs/project-state/business-knowledge-center-rich-content-attachments-approval-checklist.md`'s
  "Sign-off" section. A gate decision and merge authorization remain separate, not-yet-requested
  next steps.
- `[2026-08-20]` **The gate (G4-bkc-rich-content-attachments) was then separately requested and
  approved** — WebDesk Solution, decision CONFIRM (a clean pass, not an override, since the
  required second-role human review was already complete before the gate was requested), approved
  commit `359e9a9` on branch `business-knowledge-center-rich-content-attachments` — see
  `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
  `G4-bkc-rich-content-attachments`) and
  `docs/project-state/business-knowledge-center-rich-content-attachments-approval-checklist.md`'s
  "Gate" section. **This gate approval does not itself authorize merging PR #45 or a production
  deployment** — merge remains its own separate, not-yet-requested authorization, per this
  project's standing "no auto-merge" rule (same pattern as every prior gate).
- `[2026-08-20]` **"Merge PR #45" was separately requested and executed** — merged by the user
  directly via GitHub, with a real merge commit (not squash/rebase), matching every prior merge in
  this project's history — merge commit `3c9f4b7aad27c057d49b50168e0374f2d5ec1416`, all 14 CI
  checks green beforehand. **A real production incident then occurred, triggered by the merge,
  diagnosed and resolved the same day**: `dashboard-api` went fully down
  (`FUNCTION_INVOCATION_FAILED` on every route, including `/health`) roughly 11 minutes after the
  merge. Diagnosed directly from real Vercel runtime logs (via the user's own authenticated Chrome
  session — the sandboxed Browser pane has no Vercel login). Root cause: `sanitize-html@2.17.7`
  (still the latest release on npm) requires `htmlparser2@^12.0.0`, but `htmlparser2` dropped its
  dual CommonJS+ESM build entirely as of `11.0.0` — its own bundled `require('htmlparser2')` then
  throws under Vercel's Node Function runtime specifically, the same class of Vercel-bundler-only
  ESM-interop gap this project has hit repeatedly before (`openid-client`, `pg`'s `dialectModule`,
  a missing CommonJS barrel export), invisible to every local/CI check since none of them exercise
  Vercel's actual Function bundler + runtime. Not a bug this session's own review-fix work on PR
  #45 introduced — it was latent in the original backend build and simply never exercised in a
  real deployment until this merge, since PR #45 is the first time this project has ever deployed
  its HTML-sanitization feature (or any use of `sanitize-html`) to production. Fixed with a
  `pnpm-workspace.yaml` override pinning `htmlparser2` to `>=10.1.0 <11.0.0` (the newest version
  still shipping a working CommonJS build) — verified safe before relying on it, not assumed: read
  `sanitize-html`'s own source (only uses `htmlparser2`'s `Parser`/`DomHandler` API, stable across
  this range) and confirmed the one behavioral difference `sanitize-html`'s own code comments flag
  between `htmlparser2` `10.x` and `>=11` (RCDATA decoding for `<textarea>`/`<title>`) is
  irrelevant, since neither tag is in this project's sanitizer allowlist. Directly exercised the
  exact `require()` path that crashed in production before pushing — confirmed working. Given the
  active outage, pushed directly to `main` (commit
  `aadbce142bec18cbf2789e2491d9f93997e72096`) rather than a full PR cycle, matching this project's
  established pattern for urgent live-deployment fixes. Re-validated: 430/430 `dashboard-api` unit
  tests, 9/9 `packages/validation` unit tests (including the tabnabbing `rel`-forcing tests),
  typecheck/lint/build all clean, `pnpm audit` 0 vulnerabilities. **Verified resolved live**:
  `/health` returned `build.commitSha == aadbce1` with `status: ok` across repeated requests,
  `GET /me` (unauthenticated) returned a clean `401` rather than a crash, and `dashboard-web`'s `/`
  correctly redirects to `/auth/sign-in`. Outage window roughly `2026-08-20T20:55Z`–`21:06Z` (~11
  minutes). See `docs/implementation/business-knowledge-center-rich-content-attachments.md` §11
  for the full account. **The Business Knowledge Center rich content & attachments slice,
  including the same-day production-incident fix, is now genuinely live and stable in
  production.**
- `[2026-08-21]` **A second real production error, an RSC function-prop crash on both
  `/projects` and `/business-knowledge-center`, diagnosed and fixed.** Reported by the user via a
  live "Something went wrong" error screenshot. Diagnosed from real Vercel runtime logs: `Error:
Functions cannot be passed directly to Client Components...` — `PageSizeSelect` (added by this
  PR's own page-size selector, §2 of the implementation doc) took a `buildHref` function prop, and
  both list pages (Server Components) passed a closure directly, which React Server Components
  rejects at render time as non-serializable. Fixed by changing the prop to plain,
  JSON-serializable data — a new `lib/pagination.ts#buildHrefBySize()` helper precomputes every
  page-size option's real destination href up front, and both pages pass that record instead of a
  closure. A new regression test (`page-size-select.test.tsx`) asserts the fixture round-trips
  through `JSON.parse(JSON.stringify(...))` without throwing — a direct proxy for "safe to pass
  across the RSC boundary." Deployed as commit `600f88e`; full validation clean before and after;
  verified resolved live via clean `200`s in Vercel's runtime logs for `/business-knowledge-center`
  requests. See
  `docs/implementation/business-knowledge-center-rich-content-attachments.md` §12 for the full
  account.
- `[2026-08-21]` **A third real production error, on a specific record's detail page, diagnosed
  as a pending production migration.** Reported by the user via a second, distinct live error
  screenshot (a different digest, on `/business-knowledge-center/a8624947-1f5d-45b6-9f35-14ae123cdf47`).
  Correlated Vercel logs showed `/health`/`/me`/`/me/navigation`/`/projects` all returning clean
  `200`s in the same request bursts, isolating the failure to the attachment-listing route. The
  user then ran the real, read-only `pnpm --filter @webdesk/database run migrate:status` against
  production, confirming directly: migration `00049` (`create-business-knowledge-attachments`)
  had never been run against production after PR #45 merged — unlike every other schema change in
  this project's history. The user was given the real `pnpm --filter @webdesk/database run
migrate` command to run themselves (same credential-handling discipline as every prior production
  migration); its confirmed-applied outcome is not yet recorded in this file. See
  `docs/implementation/business-knowledge-center-rich-content-attachments.md` §13.
- `[2026-08-21]` **Built `dashboard-web` file upload on the Business Knowledge Record create
  form**, under the explicit "we need upload option in New business knowledge record add not in
  view" instruction — see "Active tasks" item 31 above and
  `docs/implementation/dashboard-web-attachments-on-create.md` for the full account. Extracted a
  new `lib/business-knowledge-attachments.ts` shared by both the detail page's existing upload
  control and the new create-form file picker; a `createdRecordId` guard was intended to prevent a
  partial attachment-upload failure from ever letting the form re-create a duplicate record — the
  code review below found this guard was UI-only at first (only the render, not `handleSubmit`
  itself). 264/264 `dashboard-web` unit tests (5 new), full validation clean. Pushed as branch
  `dashboard-web-attachments-on-create`. Not yet reviewed, gated, or merged.
- `[2026-08-21]` **Independent code review run on `dashboard-web-attachments-on-create`, high
  effort — 9 finder angles, then all 8 kept CONFIRMED findings fixed.** Requested directly ("run
  the code review skill on this branch"). Every one of the 9 candidates that survived dedup came
  back CONFIRMED — 0 PLAUSIBLE, 0 REFUTED, an unusually clean-cut result for this project's own
  review history. Most severe: `handleSubmit` had no internal guard against being re-invoked once
  `createdRecordId` was already set — the `<form>` stayed mounted with the Title field the only
  remaining input that doesn't block HTML's implicit-submission-on-Enter behavior, so pressing
  Enter there after a partial upload failure could silently create a duplicate record; fixed with
  a real early-return guard inside `handleSubmit` itself, not just the button-swap the initial
  build relied on. Also fixed: the "View record" link was clickable before staged uploads actually
  finished, letting a click mid-upload hard-navigate and silently abort in-flight uploads with no
  error surfaced (now gated on uploads having settled); the batch-upload path never checked for
  `AttachmentUploadApiError`, discarding curated backend rejection reasons in favor of a generic
  message (contradicting the implementation doc's own claim that it did); `pendingFiles` was never
  trimmed after a partial success, so the staged list kept showing already-uploaded files as if
  they still needed action; `attachmentError` was never cleared on submit, letting a stale
  rejection message render alongside a newer error; the component's own doc comment claimed
  navigation "still proceeds" after a partial failure, contradicting the actual code and this
  branch's own test; and `.removeStagedButton` was missing the `:disabled` CSS its sibling
  `.deleteButton` has, now fixed by composing from it directly instead of hand-copying it. 5 new
  regression tests added. Re-validated: 269/269 `dashboard-web` unit tests, typecheck/lint/
  `check-css-tokens.mjs`/`next build`/prettier all clean. See
  `docs/implementation/dashboard-web-attachments-on-create.md` §8 for the full account. Security
  review, second-role human review, a gate decision, and merge authorization remain separate,
  not-yet-requested next steps.
- `[2026-08-21]` **Security review run on `dashboard-web-attachments-on-create`, separately from
  the code review — 0 findings above threshold.** Requested directly ("run the security review
  skill on this branch"). Confirmed this diff is client-side UI/orchestration only — no new
  backend endpoint, no changes to the upload-route proxy, RBAC, or HTML-sanitization boundary.
  Four candidates were individually verified and ruled out: the Blob-pathname-from-raw-filename
  construction (`git show`-confirmed byte-for-byte identical to the pre-existing code this
  refactor only relocated, already covered by PR #45's own security review); client-side-only
  MIME/size validation (unchanged, real enforcement is unmodified backend code); the
  duplicate-record-creation guard (a business-logic/idempotency concern, not authorization, and
  already fixed within the same diff); and error/filename string interpolation into the failure
  message (confirmed rendered only via JSX text children, never `dangerouslySetInnerHTML`, not
  exploitable as XSS). A review packet (published as a Claude artifact, "Attachments On Create
  Review" — code review + security review findings, fixes, and validation evidence, with a
  decision section) was then prepared for the required second-role human review, since the
  implementing agent cannot also be its own reviewer (ADR-0010). See
  `docs/project-state/dashboard-web-attachments-on-create-approval-checklist.md`.
- `[2026-08-21]` **Required second-role human review complete for
  `dashboard-web-attachments-on-create`.** The review packet (code review + security review
  findings, fixes, and validation evidence, with a decision section) was reviewed. **Jitesh D
  reviewed it and returned "Approved,"** no disputes raised — 0 open findings of any kind on this
  branch. See
  `docs/project-state/dashboard-web-attachments-on-create-approval-checklist.md`'s "Sign-off"
  section. A gate decision and merge authorization remain separate, not-yet-requested next steps.
- `[2026-08-21]` **The gate (G4-attachments-on-create) was then separately requested and
  approved** — WebDesk Solution, decision CONFIRM (clean pass, not an override, since the
  second-role review was already complete before the gate was requested), approved commit
  `7bbaa67` on branch `dashboard-web-attachments-on-create` — see
  `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
  `G4-attachments-on-create`) and the approval checklist's "Sign-off" section. **This gate
  approval does not itself authorize pushing the branch, opening a PR, or merging** — each remains
  its own separate, not-yet-requested authorization, per this project's standing "no auto-merge"
  rule.
- `[2026-08-21]` **"Push the branch and open a PR" was separately requested and executed** on
  `dashboard-web-attachments-on-create` — pushed to `origin`, opened as
  [PR #46](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/46).
  Unusually, unlike every prior slice this session, the branch had never been visible on GitHub
  until now — code review, security review, second-role human review, and the gate had all
  already happened on the local branch first, so this push/PR came _after_ the gate rather than
  before it. Merge authorization remains a separate, not-yet-requested next step.
- `[2026-08-21]` **CI status checked on PR #46 — all 14 checks green**, including both Vercel
  preview deployments. **"Merge PR #46" was then separately requested and executed** — merged
  with a real merge commit (not squash/rebase), matching every prior merge in this project's
  history — merge commit `adf9a6b4e908e975b309cd372d1252c1912c8aee`. Both Vercel projects
  auto-deployed on push to `main` and were verified live directly, not just via CI's own Vercel
  status check — `dashboard-api`'s `/health` returned `build.commitShaShort ==
adf9a6b`, confirming the exact merged commit is what's serving; `dashboard-web`'s `/` resolves to
  `/auth/sign-in` for an unauthenticated visitor, confirming the session gate is intact. **The
  `dashboard-web` file upload on the Business Knowledge Record create form is now genuinely live
  in production.**
- `[2026-08-21]` **Built the Service Library module backend**, under the explicit "Start Service
  Library module" instruction, presented as the recommended next step from
  `canonical-inputs/Recommended_Module_Roadmap.md` (module #3, right after Projects and Business
  Knowledge Center). Branch `module-service-library`, off `main` at `b7fdc95`. Before writing any
  code, a genuine roadmap/dependency conflict was surfaced and resolved directly with the user
  (`AskUserQuestion`, three options presented): the module registry's own seeded `dependencies`
  field for `service_library` names `persona_library`/`case_study_library`/`page_inventory`, none
  of which exist yet, while the advisory roadmap wants Service Library built now. **The user chose
  "Build now, store as unvalidated IDs"** — the three cross-module relationship fields
  (`icpIds`/`relatedPageIds`/`relatedCaseStudyIds`) are stored as plain unvalidated string-array
  columns, no foreign key, to be properly linked once those modules exist later. Full design
  account (D1-D9) in `docs/task-packages/module-service-library.md`; full as-built account in
  `docs/implementation/module-service-library.md` — see "Active tasks" item 32 above for the
  summary. Migration `00050` creates a real normalized 7-table schema (opposite of BKC's
  single-generic-table design, sourced from `04_Data_Model_and_Ownership.md:107-118`), including
  the codebase's first real `pg_trgm` GIN trigram index. The status-transition route is gated only
  on `view` at the route level, with the real per-transition action (submit/review/approve)
  checked dynamically inside `ServicesService.changeApprovalStatus()`, mirroring
  `ProjectApproversService.assign()`'s own layered pattern — the real seeded RBAC matrix splits
  these three actions across three different role tiers. **A real bug was caught by the new e2e
  suite before merge**: `ServiceLibraryDimensionsController` was first written with
  `@RequirePermission` at the class level, which `PermissionGuard` never reads (fail-closed by
  design — it only checks `context.getHandler()`), so every dimension-list route would have 500'd
  in production; fixed by moving the decorator to each method. 17 new `dashboard-api` unit tests,
  21 new `packages/database` integration tests (real disposable database), 15 new `dashboard-api`
  e2e tests (real disposable database + real seeded RBAC roles) — 447/447 `dashboard-api` unit
  tests overall; migration up/down round-trip clean (51 migrations);
  `pnpm validate:module-registry` unaffected; typecheck/lint/`nest build`/prettier all clean.
  Committed to the branch. **Not yet pushed, reviewed, gated, or merged** — each remains its own
  separate, not-yet-requested next step, matching this project's standing discipline for every
  prior module.
- `[2026-08-21]` **Independent code review run on `module-service-library`, high effort — 8
  finder angles, 1-vote verification.** 9 candidates surfaced after dedup, 8 CONFIRMED and 1
  REFUTED. All 8 CONFIRMED findings fixed per explicit "fix the confirmed findings" instruction
  — most severe a real workflow-blocking RBAC bug: `requiredActionForTransition()` gated every
  transition targeting `draft` (including `submitted→draft`, `revision_requested→draft`,
  `rejected→draft`) behind the `approve` action, so a `marketing_editor` (holds submit+review,
  not approve) who authored a service and got it into `revision_requested`/`rejected` could
  never revert it themselves to fix and resubmit — directly contradicting the canonical spec's
  own stated intent that the submitter/editor drives that loop. Fixed by replacing the two
  independently-maintained `ALLOWED_TRANSITIONS`/`requiredActionForTransition()` structures with
  one unified `TRANSITIONS` table keyed by `(from, to)`, closing the structural drift risk too.
  Also fixed: `ownerUserId`/`parentServiceId`(update)/`deliverableIds`/`platformIds`/
  `engagementModelIds` were all FK-constrained but never existence-checked, surfacing raw 500s
  instead of clean 400s (fixed with `assertOwnerExists()`, mirroring `ProjectService`'s own
  precedent, and `assertIdsExist()`, reusing each dimension repository's previously-unused
  `findByIds()`); `create()`/`update()` wrote relationship ids but never returned them (both now
  return the enriched `ServiceWithRelationshipIds` shape `findById()` already used); an
  unescaped `Op.iLike` search pattern let a literal `%`/`_` act as a SQL wildcard (fixed by
  exporting and reusing `UserRepository`'s existing `escapeLikePattern()`); `update()` discarded
  its own 404-check fetch then unconditionally re-validated `categoryId` even when unchanged —
  the identical bug class already fixed once in the Projects module; `ServiceRelationshipRepository`'s
  own doc comment claimed to avoid "three near-duplicate files" but still hand-wrote six
  near-identical methods (refactored to two shared generic helpers); and the
  `evaluate→recordAccessDenied→throw` pattern was hand-duplicated a third time (closed by adding
  `AuthorizationService.assertAllowed()`). Re-validated: 461/461 `dashboard-api` unit tests (14
  new), 21/21 `packages/database` integration tests (unchanged, confirming the repository
  refactor is behavior-preserving), 20/20 `dashboard-api` e2e tests (5 new), typecheck/lint/
  `nest build`/prettier all clean.
- `[2026-08-21]` **Security review run on `module-service-library`, separately from the code
  review.** 1 candidate surfaced, independently re-verified at confidence 8/10 (above threshold):
  the `confidentiality` field (`public`/`internal`/`restricted`, sourced from the canonical
  spec's own three named views for this exact module) had zero read-side enforcement anywhere —
  `list()`/`findById()` returned full records, including `internalDescription`, to any caller
  holding baseline `service_persona_proof:view`, which all 7 seeded RBAC roles hold. Business
  Knowledge Center already ships the equivalent mechanism for its own `restricted` status;
  Service Library introduced both the field and every route reading it without replicating it.
  **Fixed**: wired the same, already-shared `confidential-field.util.ts` mechanism BKC uses —
  `redactIfRestricted()`/`redactRestrictedRecords()` now gate `internalDescription` behind
  `AuthorizationService.canViewConfidential()` across `list`/`findOne`/`create`/`update`/
  `changeStatus` (unlike BKC, `create()` needed it too, since this schema accepts
  `confidentiality` directly and can produce an already-restricted record on the first write).
  New e2e regression test proves the fix end-to-end; `view_confidential` is zero-seeded today,
  matching BKC's own current state. Re-validated: 461/461 `dashboard-api` unit tests, 21/21 e2e
  tests (1 new), typecheck/lint/`nest build`/prettier all clean.
- `[2026-08-21]` **Required second-role human review complete for `module-service-library`.** A
  review packet (published as a Claude artifact — code review + security review findings, fixes,
  and validation evidence, with a decision section) was prepared for the required second-role
  human review, since the implementing agent cannot also be its own reviewer (ADR-0010). See
  `docs/project-state/module-service-library-approval-checklist.md`. **Jitesh D reviewed it and
  returned "Approved,"** no disputes raised — 0 open findings of any kind on this branch (all 8
  code-review findings and the 1 security-review finding were fixed, not merely accepted as
  debt). A gate decision, push/PR, and merge authorization remain separate, not-yet-requested
  next steps.
- `[2026-08-21]` **The gate (G4-service-library) was then separately requested and approved** —
  WebDesk Solution, decision CONFIRM (clean pass, not an override, since the second-role review
  was already complete before the gate was requested), approved commit `03856b8` on branch
  `module-service-library` — see `outputs/webdesk-growth-dashboard/project.json`'s `gates[]`
  (`current_gate` now `G4-service-library`) and
  `docs/project-state/module-service-library-approval-checklist.md`'s "Sign-off" section. **This
  gate approval does not itself authorize pushing the branch, opening a PR, or merging** — each
  remains its own separate, not-yet-requested authorization, per this project's standing "no
  auto-merge" rule (same pattern as every prior gate).
- `[2026-08-21]` **"Push the branch and open a PR" was separately requested and executed** on
  `module-service-library` — pushed to `origin`, opened as
  [PR #47](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/47).
  Merge authorization remains a separate, not-yet-requested next step.
- `[2026-08-21]` **CI status checked on PR #47 — all 14 checks green**, including both Vercel
  preview deployments. **"Merge PR #47" was then separately requested and executed** — merged
  with a real merge commit (not squash/rebase), matching every prior merge in this project's
  history — merge commit `d51e99cdfd0013d54c910949c0d431359d2bfe4a`. Both Vercel projects
  auto-deployed on push to `main` and were verified live directly, not just via CI's own Vercel
  status check — `dashboard-api`'s `/health` returned `build.commitSha ==
d51e99cdfd0013d54c910949c0d431359d2bfe4a`, confirming the exact merged commit is what's serving;
  `GET /service-library/services` returned a clean `401` (route live, `SessionGuard` enforcing —
  not a `404`, which would mean the module never actually deployed); and `dashboard-web`'s `/`
  resolves to `/auth/sign-in` for an unauthenticated visitor, confirming the session gate is
  intact. **The Service Library module backend is now genuinely live in production.**
- `[2026-08-21]` **Built the `dashboard-web` UI for Service Library**, under the explicit "Start
  the dashboard-web UI for Service Library" instruction, following the backend's own
  build-to-production arc (PR #47). Unlike Projects/Business Knowledge Center, a real design brief
  exists for this module (`docs/design/dashboard-ui/15-representative-screen-specifications.md`
  §4) — built to its own field grouping and list/detail/editor archetype, with one deliberate,
  explicitly-flagged deviation from it: the brief's own named `ApprovalBlock` component was not
  used, since it requires real submitter/submittedAt/reviewer identity and a typed rejection
  reason that the actual backend (`changeServiceApprovalStatusSchema`, the `services` table)
  neither accepts nor tracks — using it would mean fabricating data or silently discarding a typed
  reason, both against this project's standing practice. See item 33 under "Active tasks" and
  `docs/implementation/dashboard-web-service-library.md` for the full account, including the
  `RelationshipPicker`-vs-`TagListField` design split and the `parentServiceId`/`ownerUserId`
  known-gap. 308/308 `dashboard-web` unit tests (39 new), full validation clean. Committed to
  branch `dashboard-web-service-library` — not yet pushed to `origin`, reviewed, gated, or merged.
- `[2026-08-21]` **Independent code review run on `dashboard-web-service-library`, high effort —
  8 finder angles, then all 8 CONFIRMED findings fixed.** Requested directly ("run the code review
  skill on this branch," then "fix the confirmed findings"). 15 candidates surfaced after dedup, 10
  kept in the final report per the review's own cap (8 CONFIRMED, 2 PLAUSIBLE). Most severe: the
  create form's `categoryId` field is required, but `service_categories` ships with zero seed rows
  and no UI/API exists yet to create any, so `/service-library/new` was permanently unsubmittable
  with only the browser's own unhelpful native-validation bubble — fixed with an inline warning
  explaining why. Also fixed: the list page's filter form silently reset `pageSize` (no hidden
  field preserved it across a filter submit — Projects'/BKC's own filter forms independently share
  this identical gap, not touched here, out of scope); two CSS Modules
  (`service-library-form.module.css`, `service-status-actions.module.css`) being the third
  byte-for-byte duplicate of the equivalent Projects/BKC styling (extracted two new shared base
  files, `components/form-fields.module.css` and `components/status-actions.module.css`, mirroring
  the existing `error-message.module.css` composition precedent, and refactored all three
  form/status-actions CSS Module pairs — including the two pre-existing sibling pairs — to compose
  from them); the approval-status badge map collapsing a live, editable state and a permanently
  terminal one onto the identical color (`draft`/`archived` and `submitted`/`superseded` both
  re-paired so no live state shares a token with a dead one); and `TagListField` (a genuinely
  reusable free-text tag/chip input) being built privately inside the form instead of promoted to
  `packages/ui` alongside `RelationshipPicker`, which sits right next to it in the same form and is
  already a shared primitive — promoted it to `packages/ui/src/components/domain.tsx`, exported it,
  added 3 new `packages/ui` unit tests, and wired `ServiceLibraryForm` to import it instead of its
  own local copy. 2 CONFIRMED findings left as accepted, tracked debt, each requiring a change out
  of scope for a `dashboard-web`-only branch: `ServiceStatusActions` hand-mirroring the backend's
  `TRANSITIONS` table as an unlinked third copy (the identical, already-accepted pattern
  `ProjectStatusActions`/`BusinessKnowledgeStatusActions` already established — a real fix means
  the backend's `GET` response computing and returning legal next transitions); and the list page
  over-fetching full long-text `Service` fields per row (the identical pattern already accepted as
  debt on the Business Knowledge Center list page — `lib/service-library.ts`'s own doc comment now
  flags this explicitly, matching that precedent). The 2 PLAUSIBLE findings (an orphaned
  relationship-id removal gap with no current UI path to trigger it — dimension rows have no delete
  UI anywhere in this app yet; `ServiceLibraryForm` having no `key` in edit mode, a pre-existing
  pattern already shared with `ProjectForm`'s own edit page, not a novel regression) were left open,
  not silently dropped. Re-validated: 82/82 `packages/ui` unit tests (3 new), 308/308
  `dashboard-web` unit tests, typecheck/lint/`check-css-tokens.mjs`/`next build`/prettier all clean
  across both packages. See `docs/implementation/dashboard-web-service-library.md` §9 for the full
  account. Security review, second-role human review, a gate decision, push/PR, and merge
  authorization remain each their own separate, not-yet-requested next step.
- `[2026-08-21]` **Security review run on `dashboard-web-service-library`, separately from the
  code review, against the fixed branch.** 0 findings above threshold. Confirmed: no
  `dangerouslySetInnerHTML` anywhere in the diff — every new render site is plain JSX text,
  React-escaped; checked specifically against this project's own documented precedent (Projects'
  `environment.url` stored-XSS, fixed with `isSafeHttpUrl()`) — none of Service Library's
  identifier-list fields (`icpIds`/`relatedPageIds`/`relatedCaseStudyIds`) are ever rendered as a
  clickable link; the `internalDescription` redaction signal (`undefined` vs `null`) is honored on
  both read and write paths, never resubmitted or logged; every `fetch()` targets a trusted,
  build-time base URL plus hardcoded path literals or a resolved entity's own `.id`, with
  `getService()` validating the route param via `isUuid()` first; `lib/api-errors.ts` is
  unmodified by this branch, and the Service Library backend exceptions it can surface only echo
  back caller-supplied values; `TagListField`/`RelationshipPicker` values are only ever rendered
  as text or sent as a plain JSON string array; the CSS Module `composes:` refactor is purely
  static, build-time class composition with no dynamic values. A review packet (published as a
  Claude artifact — code review + security review findings, fixes, and validation evidence, with
  a decision section) was then prepared for the required second-role human review, since the
  implementing agent cannot also be its own reviewer (ADR-0010). See
  `docs/project-state/dashboard-web-service-library-approval-checklist.md`.
- `[2026-08-21]` **Required second-role human review complete for
  `dashboard-web-service-library`.** The review packet (code review + security review findings,
  fixes, and the 2 accepted-debt/2 open-PLAUSIBLE items, with a decision section) was reviewed.
  **Jitesh D reviewed it and returned "Approved,"** accepting all 4 open items (2 CONFIRMED
  accepted as tracked debt, 2 PLAUSIBLE left open) as-is. See
  `docs/project-state/dashboard-web-service-library-approval-checklist.md`'s "Sign-off" section. A
  gate decision, push/PR, and merge authorization remain separate, not-yet-requested next steps.
- `[2026-08-21]` **The gate (G4-dashboard-web-service-library) was then separately requested and
  approved** — WebDesk Solution, decision CONFIRM (clean pass, not an override, since the
  second-role review was already complete before the gate was requested), approved commit
  `ab6b2e8` on branch `dashboard-web-service-library` — see
  `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
  `G4-dashboard-web-service-library`) and
  `docs/project-state/dashboard-web-service-library-approval-checklist.md`'s "Sign-off" section.
  **This gate approval does not itself authorize pushing the branch, opening a PR, or merging** —
  each remains its own separate, not-yet-requested authorization, per this project's standing "no
  auto-merge" rule (same pattern as every prior gate).
- `[2026-08-21]` **"Push the branch and open a PR" was separately requested and executed** on
  `dashboard-web-service-library` — pushed to `origin`, opened as
  [PR #48](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/48). Merge
  authorization remains a separate, not-yet-requested next step.
- `[2026-08-21]` **CI status checked on PR #48 — all 14 checks green**, including both Vercel
  preview deployments. **"Merge PR #48" was then separately requested and executed** — merged
  with a real merge commit (not squash/rebase), matching every prior merge in this project's
  history — merge commit `3743de4d4b4b33c6e31d7eeba8583cbb0a07e8f0`. Both Vercel projects
  auto-deployed on push to `main` and were verified live directly, not just via CI's own Vercel
  status check — `dashboard-api`'s `/health` returned `build.commitSha ==
3743de4d4b4b33c6e31d7eeba8583cbb0a07e8f0`, confirming the exact merged commit is what's serving;
  `dashboard-web`'s new `/service-library` route correctly redirects (307) an unauthenticated
  visitor to `/auth/sign-in` (200) — a transient stale-edge-cache `404` on the very first check
  was ruled out via repeated checks, not a real defect. **The `dashboard-web` Service Library UI
  is now genuinely live in production.** Backend and now the full UI (list, detail, create/edit
  form, status actions) are both live for the Service Library module.
- `[2026-08-21]` **Built the rich-text editor rollout — Service Library (all 7 Positioning
  fields) + Projects (`description` only)**, under the explicit "use the rich html editor in
  place of the text area... at every place" instruction. Surveyed every plain `<textarea>` first
  (15 sites, 6 files) and surfaced that this also means real backend changes — neither Service
  Library's nor Projects' DTOs/services sanitize HTML today. Two genuine scope questions were put
  to the user directly rather than guessed: which fields switch (Service Library's all 7 — no
  clear primary/secondary split exists; Projects' `description` only, sub-resource fields stay
  plain) and whether backend sanitization is included (yes — mirror Business Knowledge Center's
  write-time + render-time pattern exactly). Full account, including two new test-writing
  conventions this codebase now has (RichTextEditor can't be driven via `fireEvent.change`) and a
  genuinely live end-to-end verification (a real local `dashboard-web` + `dashboard-api` stack, a
  real provisioned Super Admin user, a real minted session, confirming the full create → sanitize
  → persist → render round trip for both modules with bold formatting surviving intact) in
  `docs/implementation/rich-text-editor-long-fields.md`. 465/465 `dashboard-api` unit tests (4
  new), 153/153 `dashboard-api` e2e tests (unchanged), 311/311 `dashboard-web` unit tests (3 new),
  full validation clean. Committed to branch `rich-text-editor-long-fields` — not yet pushed,
  reviewed, gated, or merged. **Update (2026-08-21/22): independent code review (9/9 CONFIRMED
  findings fixed), security review (0 findings above threshold), branch pushed and opened as
  [PR #49](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/49, all 14
  CI checks green), required second-role human review complete, and the gate approved — see the
  2026-08-22 entries below and item 34 in "Active tasks" for the full account.**
- `[2026-08-22]` **Required second-role human review complete for `rich-text-editor-long-fields`
  (PR #49).** "Merge PR #49" was requested directly but held per this project's standing
  discipline — the required second-role human review and a gate decision hadn't happened yet.
  Asked the user directly whether to prepare the review packet first or proceed as an explicit
  override (the Phase 1C G4-1C pattern); the user chose to prepare the packet first. A review
  packet (published as a Claude artifact, "Rich-Text Editor Review Packet" — code review + security
  review findings, fixes, and validation evidence, with a decision section) was prepared for the
  required second-role human review, since the implementing agent cannot also be its own reviewer
  (ADR-0010). **Jitesh D reviewed it and returned "Approved,"** no disputes raised — 0 open
  findings of any kind on this branch. See
  `docs/project-state/rich-text-editor-long-fields-approval-checklist.md`'s "Sign-off" section. A
  gate decision and merge authorization remain separate, not-yet-requested next steps.
- `[2026-08-22]` **The gate (`G4-rich-text-editor`) was then separately requested and approved** —
  WebDesk Solution, decision CONFIRM (clean pass, not an override, since the second-role review was
  already complete before the gate was requested), approved commit `69ab89e` on branch
  `rich-text-editor-long-fields` — see `outputs/webdesk-growth-dashboard/project.json`'s `gates[]`
  (`current_gate` now `G4-rich-text-editor`) and
  `docs/project-state/rich-text-editor-long-fields-approval-checklist.md`'s "Sign-off" section.
  **This gate approval does not itself authorize merging PR #49 or a production deployment** —
  merge remains its own separate, not-yet-requested authorization, per this project's standing
  "no auto-merge" rule (same pattern as every prior gate).
- `[2026-08-22]` **"Merge PR #49" was separately requested and executed.** Waited for the latest CI
  run (triggered by the review-packet/gate docs commit) to finish, all 14 checks green. Merged with
  a real merge commit (not squash/rebase), matching every prior merge in this project's history —
  merge commit `214da2c1984bd27b41d5e399349df3e86e3b0ea1`. Both Vercel projects auto-deployed on
  push to `main` and were verified live directly, not just via CI's own Vercel status check —
  `dashboard-api`'s `/health` returned `build.commitSha ==
214da2c1984bd27b41d5e399349df3e86e3b0ea1`, confirming the exact merged commit is what's serving;
  `dashboard-web`'s `/` resolves (via the intermediate `/home` hop) to `/auth/sign-in` for an
  unauthenticated visitor, confirming the session gate is intact. **The rich-text editor rollout is
  now genuinely live in production.**
- `[2026-08-22]` **"Start current-project context propagation" was requested, then deferred again
  after re-confirming the same blocker still holds.** Before building anything, flagged directly
  that this is the identical gap scoped and deferred on 2026-08-20, and that the underlying reason
  hasn't changed: both business modules built since then (Business Knowledge Center, Service
  Library) ended up organization-wide, not project-scoped, so there is still no second real
  consumer for a "current project" filter beyond the header switcher pre-selecting its own
  dropdown. Presented the same real tradeoff directly (`AskUserQuestion`): build reusable
  server-side plumbing with no consumer yet, wire the switcher's selection into an actual Projects
  navigation/filter behavior (the one place a "current project" already has a real, self-contained
  meaning), or something else. **The user again chose to defer** ("for now we will record this
  will do it later") — nothing was built; only this entry and item 13 record the outcome.
- `[2026-08-22]` **Built the Persona Library module backend**, under the explicit "Start the
  Persona Library" instruction — module #4 in the Recommended Module Roadmap. Two scoping
  decisions confirmed directly with the user first (`AskUserQuestion`): content edits stay
  independent of `approvalStatus` (mirrors Service Library's own precedent), and Service Library's
  own `icpIds` is not retrofitted in this pass (Persona Library stays standalone). Full account,
  including a caught delegation failure (a first background-agent attempt returned only a
  description of a plan with zero real file changes — caught via a direct `git status` check
  before being trusted, then redone properly with a more directive prompt) and every test suite
  independently re-run and confirmed by the orchestrating session rather than just trusted from
  the build's own report, in `docs/implementation/module-persona-library.md`. 493/493
  `dashboard-api` unit tests (28 new), 184/184 `packages/database` integration tests (14 new, real
  disposable database), 168/168 `dashboard-api` e2e tests (15 new, real disposable database + real
  seeded RBAC), full validation clean. Committed to branch `module-persona-library` — not yet
  pushed, reviewed, gated, or merged.
- `[2026-08-22]` **Independent code review run on `module-persona-library`, then 9 of 10 confirmed
  findings fixed.** High effort, 8 finder angles, 1-vote verification — 12 candidates surfaced
  after dedup, 11 CONFIRMED and 1 downgraded to PLAUSIBLE (inherited precedent), 10 kept in the
  final report. Most severe: `version` incremented even on a fully empty update patch, burning a
  version number and an empty-`afterState` audit event for a no-op save — fixed with a Zod
  `.refine()` rejecting an empty patch. Also fixed: `relatedServiceIds` had zero existence
  validation despite `services` already existing (closed by adding `ServiceRepository.findByIds()`,
  exporting `SERVICE_REPOSITORY` from `ServiceLibraryModule`, and a new
  `assertServiceIdsExist()` — with a malformed-UUID guard added along the way, since a raw non-UUID
  id would otherwise crash Postgres's `uuid` column type with a 500); a wasted `findById()`
  pre-fetch in `update()`; `updateStatus()` doing an extra read instead of `returning: true`; a
  missing `pg_trgm` trigram index on `name`; array fields rejecting an explicit `null` to clear;
  `create()`'s TOCTOU `publicId` race surfacing as a raw 500 (fixed via
  `error.name === "SequelizeUniqueConstraintError"`, not `instanceof` — `dashboard-api` never
  imports `sequelize` directly per ADR-0006's own architectural boundary, a real compile error the
  typecheck step caught); `list()`'s pagination having no tiebreaker; and the repository's
  `create()`/`update()` types being hand-typed instead of derived via `Omit`/`Pick`. **1 CONFIRMED
  finding left as accepted, tracked debt**: the entire approval-workflow state machine
  (`TRANSITIONS` table + `changeApprovalStatus()`) is a byte-for-byte duplicate of Service
  Library's identical pattern, with no shared abstraction anywhere in `packages/` — extracting one
  for a single new consumer during a review-fix pass was judged disproportionate. Re-validated:
  500/500 `dashboard-api` unit tests, 185/185 `packages/database` integration tests, 171/171
  `dashboard-api` e2e tests, migration up/down/up round-trip clean, `validate:module-registry`
  passing, `pnpm audit` 0 vulnerabilities, `boundaries:check` 0 violations, typecheck/lint/prettier
  all clean. See `docs/implementation/module-persona-library.md` §7 for the full account. Security
  review, second-role human review, a gate decision, push/PR, and merge authorization each remain
  their own separate, not-yet-requested next step.
- `[2026-08-22]` **Security review run on `module-persona-library`, separately from the code
  review.** Focused on the branch's genuinely new security-relevant surface — the cross-module
  `SERVICE_REPOSITORY` dependency injection, the UUID-guarded existence check, the
  `error.name`-based unique-constraint handling required by ADR-0006's own-database-package-
  touches-sequelize boundary, and RBAC wiring on every route. **0 findings above threshold.**
  Confirmed every `@RequirePermission` decorator is method-level, the dynamic per-transition RBAC
  gate matches the real seeded `service_persona_proof` matrix exactly, all queries are
  parameterized, Zod strips unknown keys, no internal SQL/constraint detail leaks on the
  uniqueness-race path, and `assertServiceIdsExist()` exposes only `.id` from returned service rows.
  One candidate was identified and independently re-verified at confidence 2/10 (not reported as a
  finding): the new `SERVICE_REPOSITORY` export from `ServiceLibraryModule` exposes the full
  write-capable repository across the module boundary for a read-only need — the identical pattern
  this project's own `module-projects-backend-closeout` review already flagged and fixed once for
  `USER_ROLE_REPOSITORY`/`AuthzModule` — currently unreachable since `PersonasService` only ever
  calls `.findByIds()` on it.
- `[2026-08-22]` **"Push the branch and open a PR" was separately requested and executed** on
  `module-persona-library` — pushed to `origin`, opened as
  [PR #50](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/50). A
  review packet for the required second-role human review, a gate decision, and merge
  authorization each remain separate, not-yet-requested next steps.
- `[2026-08-22]` **Confirmed all 14 CI checks green on PR #50**, then prepared and published the
  required second-role human review packet for `module-persona-library` — a Claude artifact (code
  review + security review findings, fixes, and validation evidence, with a decision section),
  since the implementing agent cannot also be its own reviewer (ADR-0010). See
  [Persona Library Review Packet](https://claude.ai/code/artifact/2d54fdfc-5893-4940-b68d-dacbb4002efb)
  and the new `docs/project-state/module-persona-library-approval-checklist.md`. **Awaiting that
  review** — a gate decision and merge authorization each remain separate, not-yet-requested next
  steps.
- `[2026-08-22]` **Required second-role human review complete for `module-persona-library`
  (PR #50).** The review packet (code review + security review findings, fixes, and the 1 open
  accepted-debt item, with a decision section) was reviewed. **Jitesh D reviewed it and returned
  "Approved as-is,"** accepting the 1 open CONFIRMED code-review finding (the duplicated
  `TRANSITIONS` table) as tracked debt rather than requesting a fix. See
  `docs/project-state/module-persona-library-approval-checklist.md`'s "Sign-off" section. A gate
  decision and merge authorization remain separate, not-yet-requested next steps.
- `[2026-08-22]` **The gate (G4-persona-library) was then separately requested and approved** —
  WebDesk Solution, decision CONFIRM (clean pass, not an override, since the second-role review
  was already complete before the gate was requested), approved commit `0c5115d` on branch
  `module-persona-library` — see `outputs/webdesk-growth-dashboard/project.json`'s `gates[]`
  (`current_gate` now `G4-persona-library`) and
  `docs/project-state/module-persona-library-approval-checklist.md`'s "Sign-off" section. **This
  gate approval does not itself authorize merging PR #50 or a production deployment** — merge
  remains its own separate, not-yet-requested authorization, per this project's standing "no
  auto-merge" rule.
- `[2026-08-22]` **"Merge PR #50" was separately requested and executed.** One CI failure
  (Formatting validation, on the hand-edited gate-approval table rows in
  `module-persona-library-approval-checklist.md`) was found and fixed first — whitespace only, via
  `pnpm exec prettier --write`. Waited for all 14 CI checks to go green, then merged with a real
  merge commit (not squash/rebase), matching every prior merge in this project's history — merge
  commit `05c5eadd0edb38da1a9988828852cee48a4aedb0`. Both Vercel projects auto-deployed on push to
  `main` and were verified live directly, not just via CI's own Vercel status check —
  `dashboard-api`'s `/health` returned `build.commitSha ==
05c5eadd0edb38da1a9988828852cee48a4aedb0`, confirming the exact merged commit is what's serving;
  `GET /persona-library/personas` returned a clean `401` (route live, `SessionGuard` enforcing —
  not a `404`, which would mean the module never actually deployed); and `dashboard-web`'s `/`
  resolves (via the intermediate `/home` hop) to `/auth/sign-in` for an unauthenticated visitor,
  confirming the session gate is intact. **The Persona Library module backend is now genuinely
  live in production**, closing out this slice's full build-to-production arc. No `dashboard-web`
  UI exists yet for this module — a separate, not-yet-requested next step, matching the
  Projects/BKC/Service Library precedent.
- `[2026-08-22]` **Built the `dashboard-web` Persona Library UI**, under the explicit "Start the
  dashboard-web UI for it" instruction, following the backend's own build-to-production arc
  (PR #50). See "Active tasks" item 36 above for the full account. Committed to branch
  `dashboard-web-persona-library` (not yet pushed to `origin`).
- `[2026-08-22]` **Independent code review run on `dashboard-web-persona-library`, then 6 of 8
  confirmed findings fixed.** This project's own `code-review` skill (8-angle finder pass, 1-vote
  verification) surfaced 8 candidates after dedup — all 8 CONFIRMED. Most severe: the
  `RelationshipPicker`'s selected chips silently dropped any `relatedServiceIds` entry outside
  the picker's 100-row fetch window, unlike the detail page's own raw-id fallback for the
  identical case (two independent finder angles converged on this one) — fixed. Also fixed:
  `getServicesForPersonaPicker()`'s lack of failure isolation (a transient Service Library
  outage crashed the whole detail/edit/new page); the `services` prop typed as the full ~19-field
  `Service` entity instead of a narrow type; and two real duplication findings — a byte-identical
  `APPROVAL_STATUS_LABEL`/`APPROVAL_STATUS_BADGE` map already independently maintained twice
  (extracted into a new shared `lib/artifact-approval-status.ts`) and a 4th/3rd independent copy
  of the detail-page/list-page style constants respectively (extracted into new shared
  `lib/detail-section-styles.ts`/`lib/list-filter-styles.ts`, retrofitted onto all 4/3 sibling
  pages — Projects' own real `dlStyle` margin divergence preserved via composition). 2 CONFIRMED
  findings left as accepted, tracked debt, recorded directly in code: Persona Library's picker
  depending on Service Library's RBAC module key by coincidence, and `PersonaStatusActions` being
  a 4th independent hand-copy of the approval-transition table shape (the earlier
  "disproportionate for one consumer" debt-acceptance reasoning needs re-litigating at 4
  consumers, flagged explicitly for the second-role reviewer). See
  `docs/implementation/dashboard-web-persona-library.md` (if produced) and "Active tasks" item 36
  above for the full account. 3 new regression tests; 366/366 `dashboard-web` + 500/500
  `dashboard-api` unit tests, typecheck/lint/`check-css-tokens.mjs`/`next build`/prettier all
  clean, `pnpm audit` 0 vulnerabilities. Security review, second-role human review, a gate
  decision, push/PR, and merge authorization remain separate, not-yet-requested next steps.
- `[2026-08-22]` **Security review run on `dashboard-web-persona-library`, separately from the
  code review.** Focused specifically on the new raw-id-fallback rendering (a value ultimately
  sourced from `relatedServiceIds`), the pure CSS/constant extraction, the `Pick<>` prop
  narrowing, and the doc-comment-only backend edit. **0 findings above threshold.** Confirmed the
  raw-id fallback chip renders only via plain JSX text (no `dangerouslySetInnerHTML` anywhere in
  the touched files or in `RelationshipPicker`/`TagListField`), every extracted style/constant
  value is byte-identical to what it replaced, the `Pick<Service, ...>` narrowing is
  TypeScript-only with the runtime payload unchanged, the backend doc-comment edit is
  confirmed comment-only via diff, the fetch-degrade-on-failure fix fails closed with the
  underlying call still routed through cookie-forwarded auth/RBAC, and query-param handling
  validates against a closed enum/length caps matching the already-reviewed sibling modules. A
  review packet (published as a Claude artifact — code review + security review findings, fixes,
  and validation evidence, with a decision section) was then prepared for the required
  second-role human review, since the implementing agent cannot also be its own reviewer
  (ADR-0010). See
  [Persona Library UI Review Packet](https://claude.ai/code/artifact/ab9f58a8-58ee-452d-9472-0f8a16322df8)
  and the new `docs/project-state/dashboard-web-persona-library-approval-checklist.md`.
  **Awaiting that review** — a gate decision, push/PR, and merge authorization each remain
  separate, not-yet-requested next steps.
- `[2026-08-22]` **Required second-role human review complete for
  `dashboard-web-persona-library`.** The review packet (code review + security review findings,
  fixes, and the 2 open accepted-debt items, with a decision section) was reviewed. **Jitesh D
  reviewed it and returned "Approved as-is,"** accepting the 2 open CONFIRMED code-review
  findings (the RBAC module-key coupling and the transitions-table quadruplication, findings
  07–08) as tracked debt rather than requesting fixes. See
  `docs/project-state/dashboard-web-persona-library-approval-checklist.md`'s "Sign-off" section.
  A gate decision, push/PR, and merge authorization remain separate, not-yet-requested next
  steps.
- `[2026-08-22]` **The gate (G4-dashboard-web-persona-library) was then separately requested and
  approved** — WebDesk Solution, decision CONFIRM (clean pass, not an override, since the
  second-role review was already complete before the gate was requested), approved commit
  `b7ba3e8` on branch `dashboard-web-persona-library` — see
  `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
  `G4-dashboard-web-persona-library`) and
  `docs/project-state/dashboard-web-persona-library-approval-checklist.md`'s "Sign-off" section.
  **This gate approval does not itself authorize pushing the branch, opening a PR, merging, or a
  production deployment** — each remains its own separate, not-yet-requested authorization, per
  this project's standing "no auto-merge" rule.
- `[2026-08-22]` **"Push the branch and open a PR" was separately requested and executed** on
  `dashboard-web-persona-library` — pushed to `origin`, opened as
  [PR #51](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/51). Like
  `dashboard-web-attachments-on-create` before it, review (code review, security review,
  second-role human review, and the gate) all happened locally before the branch was ever pushed
  or opened as a PR. Merge authorization remains a separate, not-yet-requested next step.
- `[2026-08-22]` **"Merge PR #51" was separately requested and executed.** All 14 CI checks
  green first. Merged with a real merge commit (not squash/rebase), matching every prior merge
  in this project's history — merge commit `e879be801c780be7c0a2af18250071b017873e28`. Both
  Vercel projects auto-deployed on push to `main` and were verified live directly, not just via
  CI's own Vercel status check — `dashboard-api`'s `/health` returned `build.commitSha ==
e879be801c780be7c0a2af18250071b017873e28`, confirming the exact merged commit is what's serving;
  `GET /persona-library/personas` returned a clean `401` (route live, `SessionGuard` enforcing —
  not a `404`, which would mean the module never actually deployed); and `dashboard-web`'s
  `/persona-library` resolves (307) to `/auth/sign-in` for an unauthenticated visitor (a
  transient stale-edge-cache `404` on the very first check was ruled out via repeated
  cache-busted checks, not a real defect). **The `dashboard-web` Persona Library UI is now
  genuinely live in production**, closing out the Persona Library module's full
  build-to-production arc — backend and now the full UI (list, detail, create/edit form, status
  actions) are both live.
- `[2026-08-22]` **Two standing rules recorded from direct user feedback**: (1) every new
  `dashboard-web` long-text field must use `RichTextEditor`, never a plain `<textarea>`, going
  forward — given right after Persona Library's UI shipped with 8 plain-textarea fields (a
  deliberate scope decision at build time, since that module was explicitly excluded from the
  earlier `rich-text-editor-long-fields.md` rollout). (2) direct concern about the volume of
  independent-code-review findings per slice (8–10 recently), with an explicit "do the code
  properly" ask — acknowledged directly, with the real avoidable pattern identified (duplication/
  reuse misses, sibling-convention consistency gaps, failure-isolation gaps on new enrichment
  fetches) and recorded as a standing feedback memory and in this file's own Cautions section. The
  review process itself stays in place — the goal is to reduce how much it has to find, not
  remove it.
- `[2026-08-22]` **"Change text area to rich text html editor in New persona" — Persona Library's
  8 narrative fields converted to the rich-text editor, with real backend HTML sanitization
  added.** Built on branch `persona-library-rich-text-editor`, off `main` at the PR #51 merge
  commit. Mirrors Service Library's own already-reviewed pattern exactly — see "Active tasks" item
  37 above for the full account. Live end-to-end verified against a real local `dashboard-api`
  instance and disposable database (a real `<script>` tag stripped on create, a real
  `<img onerror>` payload stripped on update, sibling plain-text fields and `version` handled
  correctly). **Independent code review then ran** (8-angle finder pass, 5 of 8 findings fixed) —
  most notable: `toSafeRichTextValue()`'s legacy-plain-text escaping never converted embedded
  newlines to `<br>`, silently collapsing a pre-existing multi-line value onto one run-on line —
  fixed generically in the shared `lib/rich-text.ts` helper, benefiting Service Library's and
  Projects' own pre-existing plain-text data too, not just Persona Library. 3 findings left as
  accepted, tracked debt (an overclaiming doc comment, now corrected; triplicated per-field
  sanitize boilerplate; the audit trail recording raw pre-sanitization HTML, an already-accepted
  pattern from Service Library). **A separate `security-review` skill run then found 0 findings
  above threshold** — a dedicated sub-task traced the new `\n`→`<br>` conversion end-to-end through
  both sanitization passes, confirming no bypass. A review packet (published as a Claude artifact,
  "Persona Library Rich-Text Editor Review Packet" — code review + security review findings,
  fixes, and validation evidence, with a decision section) was then prepared for the required
  second-role human review, since the implementing agent cannot also be its own reviewer
  (ADR-0010). See `docs/project-state/persona-library-rich-text-editor-approval-checklist.md`.
  **Jitesh D reviewed it and returned "Approved,"** accepting the 3 open findings as tracked
  debt. **A gate decision, push/PR, and merge authorization each remain separate,
  not-yet-requested next steps.**
- `[2026-08-22]` **Required second-role human review complete for
  `persona-library-rich-text-editor`.** The review packet (code review + security review
  findings, fixes, and the 3 open accepted-debt items, with a decision section) was reviewed.
  **Jitesh D reviewed it and returned "Approved,"** no disputes raised — the 3 open findings (the
  corrected overclaiming doc comment, the triplicated per-field sanitize boilerplate, and the
  audit trail's raw-HTML `afterState`) were accepted as tracked debt rather than sent back for a
  fix. See
  `docs/project-state/persona-library-rich-text-editor-approval-checklist.md`'s "Sign-off"
  section. A gate decision, push/PR, and merge authorization remain separate, not-yet-requested
  next steps.
- `[2026-08-22]` **The gate (G4-persona-library-rich-text) was then separately requested and
  approved** — WebDesk Solution, decision CONFIRM (clean pass, not an override, since the
  second-role review was already complete before the gate was requested), approved commit
  `33a7f3c` on branch `persona-library-rich-text-editor` — see
  `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
  `G4-persona-library-rich-text`) and
  `docs/project-state/persona-library-rich-text-editor-approval-checklist.md`'s "Sign-off"
  section. **This gate approval does not itself authorize pushing the branch, opening a PR, or
  merging** — each remains its own separate, not-yet-requested authorization, per this project's
  standing "no auto-merge" rule.
- `[2026-08-22]` **"Push the branch and open a PR" was separately requested and executed** on
  `persona-library-rich-text-editor` — pushed to `origin`, opened as
  [PR #52](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/52). Merge
  authorization remains a separate, not-yet-requested next step.
- `[2026-08-22]` **"Merge PR #52" was separately requested and executed.** Waited for all 14 CI
  checks to go green first. Merged with a real merge commit (not squash/rebase), matching every
  prior merge in this project's history — merge commit
  `f258b3627305914e9d1d59eecac696c313400719`. Both Vercel projects auto-deployed on push to
  `main` and were verified live directly, not just via CI's own Vercel status check —
  `dashboard-api`'s `/health` returned `build.commitSha ==
f258b3627305914e9d1d59eecac696c313400719`, confirming the exact merged commit is what's serving;
  `GET /persona-library/personas` returned a clean `401` (route live, `SessionGuard` enforcing —
  not a `404`, which would mean the module never actually deployed); and `dashboard-web`'s `/`
  resolves (via the intermediate `/home` hop) to `/auth/sign-in` for an unauthenticated visitor,
  confirming the session gate is intact. **The Persona Library rich-text editor conversion is
  now genuinely live in production.**
- `[2026-08-22]` **Migrations `00052` (`create-persona-library`) and `00053`
  (`mark-persona-library-in-development`) run against the real production database** — user ran
  `pnpm --filter @webdesk/database run migrate` themselves in their own terminal, same
  credential-handling discipline as every prior production migration this project. This closes
  the last unverified piece of the Persona Library backend's own "verified live" check (PR #50):
  that check confirmed the deployed Function boots and the route exists via a clean `401` from
  `SessionGuard`, but a `401` returns before any database query runs, so it never independently
  proved the `personas` table itself existed in production. **The Persona Library backend's
  schema is now genuinely live in production**, alongside its already-verified code.
- `[2026-08-22]` **Built the Proof and Claims Library module backend** (module #5 in
  `Recommended_Module_Roadmap.md`), on the explicit "Start the Proof & Claims Library"
  instruction. A real design fork was surfaced and confirmed with the user first
  (`AskUserQuestion`): a genuine one-to-many `claim_sources` child table, not a JSONB array,
  since `04_Data_Model_and_Ownership.md` explicitly names both tables separately. Built by a
  background agent with a fully-specified prompt, then independently re-verified in full — every
  high-risk file read directly (migration order, both `packages/database` barrel files, RBAC
  decorator placement, the `TRANSITIONS` table, atomic repository methods, IDOR scoping) and
  every test suite independently re-run against a real local disposable database, not trusted
  from the agent's own report. See "Active tasks" item 38 for the full account.
- `[2026-08-22]` **Independent code review then ran on `module-proof-and-claims-library`** (this
  project's own `code-review` skill, high effort, 8 finder angles) — 7 candidates surfaced after
  dedup, 5 fixed. Most notable: `sourceUrl` had no URL-scheme validation (3 independent finder
  angles converged on this), repeating the exact stored-XSS gap Projects' own `environment.url`
  shipped with once — fixed with the shared `safeHttpUrlSchema`. Also fixed: the write-capable
  `SERVICE_REPOSITORY` token being injected raw into a 2nd external consumer, exactly the
  "surface grows" condition Persona Library's own security review had flagged as the trigger for
  closing it — fixed by adding `ServicesService.existingServiceIds()`, a narrow read-only
  delegating method, and removing the direct repository export (both `PersonasService` and
  `ClaimsService` updated together). 2 findings left as accepted, tracked debt, recorded directly
  in code. **A separate `security-review` skill run then found 0 findings above threshold** —
  confirmed correct RBAC decorator placement, correct separation-of-duties enforcement against the
  real seeded matrix, real DB-level IDOR scoping, and a genuine read-only narrowing on the
  repository-export fix. A review packet (published as a Claude artifact, "Proof and Claims
  Library Review Packet" — code review + security review findings, fixes, and validation
  evidence, with a decision section) was then prepared for the required second-role human review,
  since the implementing agent cannot also be its own reviewer (ADR-0010). See
  `docs/project-state/module-proof-and-claims-library-approval-checklist.md`. **Awaiting that
  review** — a gate decision, push/PR, and merge authorization each remain separate,
  not-yet-requested next steps.
- `[2026-08-22]` **Required second-role human review complete for
  `module-proof-and-claims-library`.** The review packet (code review + security review findings,
  fixes, and the 2 open accepted-debt items, with a decision section) was reviewed. **Jitesh D
  reviewed it and returned "Approved,"** no disputes raised — the 2 open findings (the
  `assertServiceIdsExist()` wrapper duplication and the audit-write failure `console.error`-only
  path) were accepted as tracked debt rather than sent back for a fix. See
  `docs/project-state/module-proof-and-claims-library-approval-checklist.md`'s "Sign-off" section.
  A gate decision, push/PR, and merge authorization remain separate, not-yet-requested next steps.
- `[2026-08-22]` **The gate (G4-proof-and-claims-library) was then separately requested and
  approved** — WebDesk Solution, decision CONFIRM (clean pass, not an override, since the
  second-role review was already complete before the gate was requested), approved commit
  `d8cccc1` on branch `module-proof-and-claims-library` — see
  `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
  `G4-proof-and-claims-library`) and
  `docs/project-state/module-proof-and-claims-library-approval-checklist.md`'s "Sign-off"
  section. **This gate approval does not itself authorize pushing the branch, opening a PR, or
  merging** — each remains its own separate, not-yet-requested authorization, per this project's
  standing "no auto-merge" rule.
- `[2026-08-23]` **"Push the branch and open a PR" was separately requested and executed** on
  `module-proof-and-claims-library` — pushed to `origin`, opened as
  [PR #53](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/53). Merge
  authorization remains a separate, not-yet-requested next step.
- `[2026-08-23]` **"Merge PR #53" was separately requested and executed.** Waited for all 14 CI
  checks to go green first. Merged with a real merge commit (not squash/rebase), matching every
  prior merge in this project's history — merge commit
  `b7f6575a5e0d1860e32864528cc9f005b77d1477`. Both Vercel projects auto-deployed on push to
  `main` and were verified live directly, not just via CI's own Vercel status check —
  `dashboard-api`'s `/health` returned `build.commitSha ==
b7f6575a5e0d1860e32864528cc9f005b77d1477`, confirming the exact merged commit is what's serving;
  `GET /proof-and-claims-library/claims` returned a clean `401` (route live, `SessionGuard`
  enforcing — not a `404`, which would mean the module never actually deployed); and
  `dashboard-web`'s `/` resolves (via the intermediate `/home` hop) to `/auth/sign-in` for an
  unauthenticated visitor, confirming the session gate is intact. **The Proof and Claims Library
  module backend is now genuinely live in production.**
- `[2026-08-23]` **Built the `dashboard-web` UI for Proof and Claims Library**, under the explicit
  "Start the dashboard-web UI for it" instruction, following the backend's own build-to-production
  arc (PR #53). See "Active tasks" item 39 above for the full account. Per the 2026-08-22 standing
  rule, `claim`/`approvedWording`/`restrictions` were converted to `RichTextEditor` as part of this
  same build (with real backend sanitization added alongside), while `claim_sources.source`
  deliberately stayed plain text. Committed to branch
  `dashboard-web-proof-and-claims-library` (not yet pushed).
- `[2026-08-23]` **Independent code review then ran on `dashboard-web-proof-and-claims-library`**
  (this project's own `code-review` skill, high effort, 8 finder angles via parallel subagents,
  1-vote self-verification) — 8 candidates surfaced after dedup (7 CONFIRMED, 1 PLAUSIBLE). 6
  fixed per explicit "fix the confirmed findings" instruction — most notable: `claim_sources.
source` had silently inherited the parent module's rich-text-sized `LONG_TEXT_MAX_LENGTH`
  (40,000) as a byproduct of constant sharing, which also made it genuinely ambiguous whether this
  brand-new long-text field should have used `RichTextEditor` per the standing rule — resolved by
  giving `source` its own dedicated, decoupled `CLAIM_SOURCE_MAX_LENGTH` (2,000 chars) on both
  backend and frontend, closing both the validation-bound bug and the rich-text-rule ambiguity in
  one fix. Also fixed: `VERIFICATION_STATUS_LABEL` triplicated across 3 new files (2 finder angles
  independently converged on this); `tolerateDiscard()` redeclared privately instead of importing
  the already-exported copy from `lib/business-knowledge.ts` (2 finder angles converged on this
  too); the `expiryReviewDate` ternary reimplementing the form's own `textField()` helper;
  `sanitizeRequiredRichTextIfChanged()` hand-copying `sanitizeNullableRichTextIfChanged()`'s logic
  instead of delegating with a type-narrowing cast; and a missing test proving `restrictions`
  actually gets sanitized on create with real dirty HTML. 2 findings left as accepted, tracked
  debt, recorded directly in code: `update()`'s reintroduced pre-fetch racing `findById()` against
  `assertServiceIdsExist()` via `Promise.all` (a real but inherited, already-shipped nondeterminism
  shared with `PersonasService`/`ServicesService`), and `ProofClaimStatusActions` being the 5th
  independent hand-copy of the approval-transitions table shape. Re-validated: 49/49
  `dashboard-api` unit tests in this module (1 new), 23/23 `dashboard-api` e2e tests (real
  disposable database), 423/423 `dashboard-web` unit tests, typecheck/lint/`next build`/
  `nest build`/prettier all clean.
- `[2026-08-23]` **Security review run on `dashboard-web-proof-and-claims-library`, separately
  from the code review.** 0 findings above threshold — focused on whether this diff's usage of the
  already-vetted RichTextEditor + write-time + render-time sanitization pattern deviates from that
  pattern in any way, plus the new `claim_sources` sub-resource's own validation/authorization/
  IDOR surface; confirmed `claims.controller.ts`/`claim-sources.controller.ts` (the actual RBAC
  decorators) are outside this diff and unmodified, zero `dangerouslySetInnerHTML` occurrences,
  and `claim_sources` IDOR scoping unchanged. A review packet (published as a Claude artifact —
  code review + security review findings, fixes, and validation evidence, with a decision section)
  was then prepared for the required second-role human review, since the implementing agent cannot
  also be its own reviewer (ADR-0010). See
  `docs/project-state/dashboard-web-proof-and-claims-library-approval-checklist.md`. **Awaiting
  that review** — a gate decision, push/PR, and merge authorization each remain separate,
  not-yet-requested next steps.
- `[2026-08-23]` **"Push the branch and open a PR" was separately requested and executed** on
  `dashboard-web-proof-and-claims-library` — pushed to `origin`, opened as
  [PR #54](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/54).
  Second-role human review is still outstanding; a gate decision and merge authorization each
  remain separate, not-yet-requested next steps.
- `[2026-08-23]` **All 14 CI checks confirmed green on PR #54**, then **required second-role
  human review complete for `dashboard-web-proof-and-claims-library`.** The review packet (code
  review + security review findings, fixes, and the 2 open accepted-debt items, with a decision
  section) was reviewed. **Jitesh D reviewed it and returned "Approved,"** accepting the 2 open
  findings (the `update()` exception-ordering race and the 5th independent status-transitions-
  table copy) as tracked debt — no disputes raised. See
  `docs/project-state/dashboard-web-proof-and-claims-library-approval-checklist.md`'s "Sign-off"
  section. A gate decision and merge authorization remain separate, not-yet-requested next steps.
- `[2026-08-23]` **The gate (`G4-dashboard-web-proof-and-claims-library`) was then separately
  requested and approved** — WebDesk Solution, decision CONFIRM (clean pass, not an override,
  since the second-role review was already complete before the gate was requested), approved
  commit `0361c1e` on branch `dashboard-web-proof-and-claims-library` — see
  `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
  `G4-dashboard-web-proof-and-claims-library`) and
  `docs/project-state/dashboard-web-proof-and-claims-library-approval-checklist.md`'s "Sign-off"
  section. **This gate approval does not itself authorize merging PR #54 or a production
  deployment** — merge remains its own separate, not-yet-requested authorization, per this
  project's standing "no auto-merge" rule.
- `[2026-08-23]` **"Merge PR #54" was separately requested and executed.** Waited for all 14 CI
  checks to go green first (2 were still running after the latest doc-commit push — Database
  migration test, Integration tests — both confirmed green before merging). Merged with a real
  merge commit (not squash/rebase), matching every prior merge in this project's history — merge
  commit `54f5ee0107b95c6bd370a1f23df3771c8a131121`. Both Vercel projects auto-deployed on push to
  `main` and were verified live directly, not just via CI's own Vercel status check —
  `dashboard-api`'s `/health` returned `build.commitSha ==
54f5ee0107b95c6bd370a1f23df3771c8a131121`, confirming the exact merged commit is what's serving;
  `GET /proof-and-claims-library/claims` returned a clean `401` (route live, `SessionGuard`
  enforcing — not a `404`, which would mean the module never actually deployed); and
  `dashboard-web`'s `/proof-and-claims-library` resolves (307) to `/auth/sign-in` for an
  unauthenticated visitor, confirming the session gate is intact. **The `dashboard-web` Proof and
  Claims Library UI is now genuinely live in production**, closing out this slice's full
  build-to-production arc — backend and now the full UI (list, detail, create/edit form, status
  actions, `claim_sources` sub-resource editing) are both live.
- `[2026-08-23]` **Built the Website Strategy Center module backend** — module #6 per
  `Recommended_Module_Roadmap.md`, and the first with genuine real multi-row version history.
  Two design forks (single generic table vs. 9; real version history vs. single mutable row)
  confirmed directly with the user first. Branch `module-website-strategy-center`, off `main` at
  the PR #54 merge commit. Built by a background agent with a fully-specified prompt, then
  independently re-verified in full — every high-risk file read directly, every test suite
  re-run against a fresh local disposable database. 33/33 `dashboard-api` unit, 19/19
  `packages/database` integration, 19/19 e2e tests at initial build; migration up/down
  round-trip clean; typecheck/lint/prettier clean; `pnpm audit` 0 vulnerabilities. See item 40
  under "Active tasks" for the full design account.
- `[2026-08-23]` **Independent code review run on `module-website-strategy-center`, then all 3
  CONFIRMED findings fixed.** High effort, 8-angle finder pass, 1-vote verification — 5
  candidates survived dedup (3 CONFIRMED, 2 REFUTED). Most severe: `update()`'s in-place-edit
  branch had no CAS guard on `approvalStatus` (found independently by 2 finder angles) — fixed
  by giving `updateInPlace()` an optional `expectedApprovalStatus` parameter and rejecting
  terminal-state edits outright. Also fixed: an unhandled concurrent-version-creation race on
  the `(record_id, version_number)` unique index (3-way convergence across finder angles,
  surfaced as a raw 500) — fixed with a `try/catch` mirroring `create()`'s own pattern,
  converting it to a 409; and a directly-reachable `approved -> superseded` transition
  contradicting the module's own "supersede is automatic-only" design — fixed by removing the
  edge from the `TRANSITIONS` table. 2 candidates REFUTED by dedicated verifiers: an
  audit-gap claim matched an already-accepted precedent (`ProjectService.setActivePhase()`);
  a missing-index performance claim was empirically disproven with `EXPLAIN ANALYZE` against a
  real 53,770-row synthetic dataset — Postgres already serves the query via the `public_id`
  partial unique index's implied predicate. Re-validated: 39/39 module unit tests (595/595
  `dashboard-api` overall), 228/228 `packages/database` integration tests, 21/21 module e2e
  tests, a real migration up/down round-trip, typecheck/lint/prettier all clean, `pnpm audit` 0
  vulnerabilities. Committed as `b2333a5`.
- `[2026-08-23]` **Security review run on `module-website-strategy-center`, then the 1 CONFIRMED
  finding fixed, then re-scanned.** Focused on RBAC decorator placement, the dynamic
  submit/review/approve permission split, the CAS/terminal-state fixes' authorization
  implications, and SQL-injection surface. Found 1 CONFIRMED finding at 9/10 confidence (an
  independent false-positive-filtering pass verified it against the real seeded RBAC grants and
  the actual write path before confirming): the code-review fix above had only closed the CAS
  race in `update()`'s non-approved branch — the approved/fork branch's own `updateInPlace()`
  call (flipping the old row's `isCurrent` to false) still carried no guard, letting an
  edit-only caller (`edit`, never `approve`) resurrect a just-concurrently-archived record into
  a fresh editable draft, using only the edit grant for the resurrection half of the race —
  contradicting the module's own documented "archived/superseded are permanently terminal"
  invariant. **Fixed** by passing `current.approvalStatus` as the CAS guard on this call too,
  matching the non-approved branch exactly; a null result now throws `ConflictException`. A
  re-scan pass then confirmed the fix was complete, leaked no sensitive detail in the new
  exception message, preserved correct transaction-rollback semantics, and left no remaining gap
  of the same class — **0 findings above threshold**. Re-validated: 40/40 module unit tests
  (596/596 `dashboard-api` overall), 21/21 module e2e tests, typecheck/lint/prettier clean.
  Committed as `087c2e5`. A review packet (published as a Claude artifact, "Website Strategy
  Center Review Packet" — code review + security review findings, fixes, and validation
  evidence, with a decision section) was then prepared for the required second-role human
  review, since the implementing agent cannot also be its own reviewer (ADR-0010). See
  `docs/project-state/module-website-strategy-center-approval-checklist.md`.
- `[2026-08-23]` **Required second-role human review complete for
  `module-website-strategy-center`.** The review packet (code review + security review findings,
  fixes, and validation evidence, with a decision section) was reviewed. **Jitesh D reviewed it
  and returned "Approved,"** no disputes raised — every confirmed finding across both reviews had
  already been fixed and re-validated before this review, so there was no open item to accept as
  tracked debt. See
  `docs/project-state/module-website-strategy-center-approval-checklist.md`'s "Sign-off" section.
  A gate decision, push/PR, and merge authorization each remain separate, not-yet-requested next
  steps.
- `[2026-08-23]` **The gate (G4-website-strategy-center) was then separately requested and
  approved** — WebDesk Solution, decision CONFIRM (clean pass, not an override, since the
  second-role review was already complete before the gate was requested), approved commit
  `225facf` on branch `module-website-strategy-center` — see
  `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
  `G4-website-strategy-center`) and
  `docs/project-state/module-website-strategy-center-approval-checklist.md`'s "Sign-off" section.
  **This gate approval does not itself authorize pushing the branch, opening a PR, or merging** —
  each remains its own separate, not-yet-requested authorization, per this project's standing
  "no auto-merge" rule.
- `[2026-08-23]` **"Push the branch and open a PR" was separately requested and executed** on
  `module-website-strategy-center` — pushed to `origin`, opened as
  [PR #55](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/55). All
  14 CI checks confirmed green.
- `[2026-08-23]` **"Merge PR #55" was separately requested and executed.** Merged with a real
  merge commit (not squash/rebase), matching every prior merge in this project's history — merge
  commit `b205a32d03da906f6f2f68f9a8308f7772a8eb03`, all 14 CI checks green beforehand. Both
  Vercel projects auto-deployed on push to `main` and were verified live directly, not just via
  CI's own Vercel status check — `dashboard-api`'s `/health` returned `build.commitSha ==
b205a32d03da906f6f2f68f9a8308f7772a8eb03`, confirming the exact merged commit is what's serving;
  `GET /website-strategy-center/records` returned a clean `401` (route live, `SessionGuard`
  enforcing — not a `404`, which would mean the module never actually deployed); and
  `dashboard-web`'s `/` resolves (via the intermediate `/home` hop) to `/auth/sign-in` for an
  unauthenticated visitor, confirming the session gate is intact. **The Website Strategy Center
  module backend is now genuinely live in production.** No `dashboard-web` UI exists yet for
  this module — a separate, not-yet-requested next step, matching the Projects/BKC/Service
  Library/Persona Library/Proof and Claims Library precedent.
- `[2026-08-23]` **Built the `dashboard-web` UI for Website Strategy Center** — closes this
  module's last named gap. Branch `dashboard-web-website-strategy-center`, off `main` at the
  PR #55 merge commit. First commit wires real backend HTML sanitization into content/notes
  (per the 2026-08-22 standing rule), raising `LONG_TEXT_MAX_LENGTH` 20,000 → 40,000 and adding
  a `sanitizeOrInherit()`-shaped helper to the fork branch — 9 new backend unit tests, 1 new
  e2e test proving sanitization over real HTTP. Second commit built by a background agent with
  a fully-specified prompt (the exact backend contract, two genuinely novel UI requirements —
  a server-rendered version-history disclosure list, and an "editing an approved record forks
  a new version" notice — spelled out in detail, Persona Library named as the file-for-file
  template), then independently re-verified in full: every high-risk file read directly, every
  validation command re-run fresh, all 4 new routes live-rendered in the Browser pane. See item
  41 under "Active tasks" for the full account.
- `[2026-08-23]` **Independent code review run on `dashboard-web-website-strategy-center`, then
  all 4 CONFIRMED findings fixed.** High effort, 8-angle finder pass, 1-vote verification — 6
  candidates survived dedup (4 CONFIRMED, 1 PLAUSIBLE, 1 REFUTED). Most severe: the detail
  page's "Edit" link was always shown regardless of `approvalStatus`, even though the backend
  hard-rejects any edit of an archived/superseded record — fixed by hiding the link for those
  same terminal states, matching `WebsiteStrategyStatusActions`'s own self-hiding precedent for
  the identical two statuses. Also fixed: the version-history list computed "is this the
  current version" via a cross-request id comparison between two independently-timed fetches
  (found independently by 2 finder angles) instead of using each version row's own `isCurrent`
  field — fixed by reading `version.isCurrent` directly, simpler and race-free; a duplicated
  sanitize-or-inherit ternary in the backend's fork branch, extracted into a small
  `sanitizeOrInherit()` helper (a pure refactor — 46/46 existing unit tests passed unchanged);
  and an inline style duplicating the already-imported `mutedStyle` constant. 1 PLAUSIBLE
  finding (the current version's content/notes rendering twice per page view) left as
  accepted, tracked debt, recorded directly in the detail page's own doc comment — a dedicated
  verifier confirmed this is a deliberate tradeoff, not an oversight. 1 candidate (reusing
  `@webdesk/ui`'s `Accordion` component) REFUTED — it requires a client-component boundary
  with zero existing `dashboard-web` consumers, so adopting it would mean abandoning the
  zero-client-JS Server Component pattern every sibling detail page follows. Re-validated:
  469/469 `dashboard-web` unit tests, 46/46 backend unit tests, typecheck/lint/CSS-token-check/
  `next build`/prettier all clean. Committed as `03aa8ac`.
- `[2026-08-23]` **Security review run on `dashboard-web-website-strategy-center`.** Focused on
  the rich-text sanitization write/render paths, RBAC/session guards on all 4 new routes,
  whether the Edit-link visibility fix is real enforcement or just UI polish, and injection
  surface in the new form/status-actions components. **0 findings above threshold.** Confirmed
  write-path sanitization on all three paths (`create()`, `update()`'s in-place branch, the
  fork branch's `sanitizeOrInherit()`); render-path sanitization on every content/notes site,
  including every version inside the version-history disclosures, exclusively through the
  shared `SanitizedRichText` component; the Edit-link fix is UI-only convenience, with the
  backend's own unconditional 400 rejection as the real, already-existing enforcement point; no
  new injection surface; and no IDOR-shaped issue in the `recordId`/`id` distinction, since
  this app's RBAC is role-based, not per-record-ownership, by existing design. A review packet
  (published as a Claude artifact, "Website Strategy Center UI Review Packet" — code review +
  security review findings, fixes, and validation evidence, with a decision section) was then
  prepared for the required second-role human review, since the implementing agent cannot also
  be its own reviewer (ADR-0010). See
  `docs/project-state/dashboard-web-website-strategy-center-approval-checklist.md`.
- `[2026-08-23]` **Required second-role human review complete for
  `dashboard-web-website-strategy-center`.** The review packet (code review + security review
  findings, fixes, and the 1 accepted-debt item, with a decision section) was reviewed.
  **Jitesh D reviewed it and returned "Approved,"** no disputes raised — the accepted-debt
  finding (the current version's content/notes rendering twice on the detail page, already
  recorded as a deliberate tradeoff directly in code) was accepted as-is rather than sent back
  for a fix. See
  `docs/project-state/dashboard-web-website-strategy-center-approval-checklist.md`'s
  "Sign-off" section. A gate decision, push/PR, and merge authorization each remain separate,
  not-yet-requested next steps.
- `[2026-08-23]` **The gate (G4-dashboard-web-website-strategy-center) was then separately
  requested and approved** — WebDesk Solution, decision CONFIRM (clean pass, not an override,
  since the second-role review was already complete before the gate was requested), approved
  commit `e349feb` on branch `dashboard-web-website-strategy-center` — see
  `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
  `G4-dashboard-web-website-strategy-center`) and
  `docs/project-state/dashboard-web-website-strategy-center-approval-checklist.md`'s
  "Sign-off" section. **This gate approval does not itself authorize pushing the branch,
  opening a PR, or merging** — each remains its own separate, not-yet-requested authorization,
  per this project's standing "no auto-merge" rule.
- `[2026-08-23]` **"Push the branch and open a PR" was separately requested and executed** on
  `dashboard-web-website-strategy-center` — pushed to `origin`, opened as
  [PR #56](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/56). All
  14 CI checks confirmed green.
- `[2026-08-23]` **"Merge PR #56" was separately requested and executed.** Merged with a real
  merge commit (not squash/rebase), matching every prior merge in this project's history —
  merge commit `55704e01163d33f5edaa188be757dfe2b2e980a2`, all 14 CI checks green beforehand.
  Both Vercel projects auto-deployed on push to `main` and were verified live directly, not
  just via CI's own Vercel status check — `dashboard-api`'s `/health` returned
  `build.commitSha ==
55704e01163d33f5edaa188be757dfe2b2e980a2`, confirming the exact merged commit is what's serving;
  `dashboard-web`'s `/website-strategy-center` resolves (307) to `/auth/sign-in` for an
  unauthenticated visitor (a transient stale-edge-cache `404` on the very first check was ruled
  out via repeated, cache-busted checks, not a real defect). **The `dashboard-web` Website
  Strategy Center UI is now genuinely live in production**, closing out this slice's full
  build-to-production arc — backend and now the full UI (list, detail, create/edit form, status
  actions, version-history) are both live.
- `[2026-08-23]` **Built the Page Inventory module backend** (module #7 on the Recommended Module
  Roadmap) on the explicit "Start the Page Inventory module" instruction. Three genuine
  architectural forks confirmed directly with the user first (`AskUserQuestion`): table scope
  (`pages`+`page_urls` only, not the fuller 7-table "Pages and artifacts" cluster — that belongs
  to the separate, not-yet-built Page Workspace module), project scoping (`pages` carries a real
  `project_id` — the first content-library module in this codebase to deviate from every prior
  module's organization-wide shape), and Scan Website/Import deferral (no WordPress adapter
  exists yet, only a staging-only credential is configured). Built by a background agent with a
  fully-specified prompt mirroring Proof and Claims Library's structural template, then
  independently re-verified in full — every high-risk file read directly, every test suite
  re-run against a fresh local disposable database. A real lint failure (2 unused type imports)
  the build's own validation had missed was caught and fixed during re-verification.
  **Independent code review then ran** (this project's own `code-review` skill, high effort,
  8-angle finder pass) — 6 candidates survived dedup/verification, 2 CONFIRMED, 4 PLAUSIBLE, 2
  REFUTED. Most severe, and the review's own most important catch: **project-scoped RBAC grants
  were silently ignored on every route** — `PermissionGuard` derives project scope exclusively
  from `request.params.projectId`, but no Page Inventory route exposed it (query/body only), so a
  caller holding only a project-scoped `page_inventory` grant was denied everywhere, directly
  undermining the module's own D2 design goal this session had just confirmed with the user.
  Fixed by restructuring every route to carry `:projectId` in the path, mirroring the existing
  `RoadmapItemsController` precedent — the resolved resource's own `projectId` is now verified
  against the path value at every read/write (closing an IDOR gap as a side effect), and
  `AuthorizationService.assertAllowed()` was widened with an optional trailing `projectId`
  parameter (confirmed purely additive) and threaded through the dynamic workflow-stage check.
  Real e2e regression tests prove a project-scoped-only session is now allowed within its project
  and still denied in a different one — empirically verified the same scenario 403'd against the
  pre-fix commit. Also fixed: a `SequelizeUniqueConstraintError` check hand-copied a 3rd time
  within this PR (on top of 4 pre-existing copies across 3 modules), closed by extracting
  `isSequelizeUniqueConstraintError()` into `@webdesk/validation`. 4 PLAUSIBLE findings left as
  accepted, tracked debt, each matching an already-established precedent elsewhere in this
  codebase (a nondeterministic error-code race in `create()`, a sequential-await efficiency
  tradeoff, create/update schema field-list duplication matching every sibling module's own
  style, and a broad service export matching an already-twice-accepted pattern). 2 candidates
  REFUTED. **A separate `security-review` skill run then found 0 findings above threshold** — the
  one candidate (`PageRepository.update()` lacking `projectId` in its `WHERE` clause, unlike
  `PageUrlRepository`'s own scoped writes in the same PR) was independently re-verified and
  filtered at 2/10 confidence: `id` is a globally-unique primary key, the service layer's prior
  `findById(id, projectId)` call already throws before `update()` is reached on any project
  mismatch, `projectId` is unsmuggleable into a patch, and no endpoint reassigns a page's project
  after creation — not independently exploitable today. Final numbers: 12/12 `packages/validation`
  unit (3 new), 28/28 `packages/database` unit, 253/253 integration, 656/656 `dashboard-api` unit,
  246/246 e2e/integration, migration up/down/up round-trip clean (59 migrations), typecheck/lint/
  prettier all clean, `pnpm audit` 0 vulnerabilities. A review packet (published as a Claude
  artifact, "Page Inventory Review Packet" — code review + security review findings, fixes, and
  validation evidence, with a decision section) was prepared for the required second-role human
  review, since the implementing agent cannot also be its own reviewer (ADR-0010). **Jitesh D
  reviewed it and returned "Approves,"** no disputes raised — see
  `docs/project-state/module-page-inventory-approval-checklist.md`'s "Sign-off" section. **The
  gate (G4-page-inventory) was then separately requested and approved** — WebDesk Solution,
  decision CONFIRM (a clean pass, not an override, since the second-role review was already
  complete before the gate was requested), approved commit `3d0b4b2` on branch
  `module-page-inventory` — see `outputs/webdesk-growth-dashboard/project.json`'s `gates[]`
  (`current_gate` now `G4-page-inventory`). **"Push the branch and open a PR" was then separately
  requested and executed** — pushed to `origin`, opened as
  [PR #57](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/57). One CI
  failure (Formatting validation, on stale emphasis-marker style in the task package file, never
  run through prettier before its initial commit) was found and fixed before merging.
  **"Merge PR #57" was then separately requested and executed** — all 14 CI checks green first,
  merge commit `51be3cc76a3facf779b7e2be638301f5db0cc695`. Both Vercel projects auto-deployed on
  push to `main` and were verified live directly, not just via CI's own Vercel status check —
  `dashboard-api`'s `/health` returned `build.commitSha ==
51be3cc76a3facf779b7e2be638301f5db0cc695`, confirming the exact merged commit is what's serving;
  `GET /page-inventory/projects/:projectId/pages` returned a clean `401` (route live,
  `SessionGuard` enforcing — not a `404`, which would mean the module never actually deployed);
  and `dashboard-web`'s `/` resolves (307) to `/auth/sign-in` for an unauthenticated visitor,
  confirming the session gate is intact. **The Page Inventory module backend is now genuinely
  live in production.** No `dashboard-web` UI exists yet for this module — a separate,
  not-yet-requested next step, matching every prior module's own backend-first precedent.
- `[2026-08-23]` **Built the `dashboard-web` UI for Page Inventory** — closes this module's last
  named gap, following the backend's own build-to-production arc (PR #57). Not started
  automatically — built directly on the explicit "Start the dashboard-web UI for it" instruction.
  Page Inventory is the first content-library module whose backend is project-scoped; before
  building, a genuine new architectural question (how the UI determines its active project) was
  put to the user directly (`AskUserQuestion`) — the user chose a URL-driven `?projectId=` query
  param with an in-module project picker over promoting the header switcher's advisory cookie to
  authoritative. Four routes under `/page-inventory` (list, create, detail, edit) built mirroring
  Website Strategy Center's file-for-file pattern plus Projects'/Proof-and-Claims Library's
  sub-resource CRUD pattern for `page_urls`. **Independent code review then ran** (this project's
  own `code-review` skill, high effort, 8-angle finder pass) — 9 candidates surfaced after dedup,
  8 CONFIRMED and fixed (most severe: `PagesService.update()` had no terminal-state guard at all,
  unlike every sibling module, so an edit to an archived/superseded page silently succeeded — also
  fixed: `getPageUrls()` crashing the whole detail page on a transient sub-resource error, a real
  backend-supported `roadmapPhaseId` filter never exposed to the UI, `withProjectId()` defined but
  never called, duplicated project-resolution boilerplate, the in-module project picker never
  syncing the header switcher's cookie, sequential fetches with no real dependency, and a 4th
  independent copy of the plain-text-field nullish-contract helper), 1 PLAUSIBLE finding accepted
  as tracked debt (an unguarded response assertion on the create form, matching every sibling
  create form's identical pattern). **A separate `security-review` skill run then found 0 findings
  above the formal ≥8/10 threshold** — but surfaced one additional, sub-threshold (6/10) finding
  introduced by the code-review fix round itself: the new terminal-state check read
  `workflowStage` into memory but the actual write stayed unconditional, so a concurrent
  `changeWorkflowStage()` transition landing between the read and the write could let an edit
  silently succeed against a now-terminal row. Judged worth fixing anyway — a real, self-introduced
  bug with an exact, already-proven fix pattern in this same codebase — closed with a CAS guard
  (`expectedWorkflowStage`) on `PageRepository.update()`, mirroring Website Strategy Center's own
  `updateInPlace()`/`expectedApprovalStatus` parameter exactly; a null result disambiguates via a
  fresh `findById()` re-read into `NotFoundException` or `ConflictException`. Final numbers:
  524/524 `dashboard-web` unit tests, 661/661 `dashboard-api` unit tests (3 new), 28/28
  `packages/database` unit tests, 253/253 `packages/database` integration tests, 247/247
  `dashboard-api` integration/e2e tests — all re-verified against a real disposable database after
  every fix round; typecheck/lint/CSS-token-check/`next build`/prettier all clean. A review packet
  (published as a Claude artifact, "Page Inventory UI Review Packet" — code review + security
  review findings, fixes, and validation evidence, with a decision section) was then prepared for
  the required second-role human review, since the implementing agent cannot also be its own
  reviewer (ADR-0010). See `docs/project-state/dashboard-web-page-inventory-approval-checklist.md`.
- `[2026-08-23]` **Required second-role human review complete for
  `dashboard-web-page-inventory`.** The review packet (code review + security review findings,
  fixes, and the 1 accepted-debt item, with a decision section) was reviewed. **Jitesh D reviewed
  it and returned "Approved,"** no disputes raised — every confirmed code-review finding was
  already fixed, and the security review's one sub-threshold finding was fixed proactively rather
  than left open, so there was no open item to accept as tracked debt beyond the 1 already-accepted
  PLAUSIBLE code-review finding. See
  `docs/project-state/dashboard-web-page-inventory-approval-checklist.md`'s "Sign-off" section.
- `[2026-08-23]` **The gate (G4-dashboard-web-page-inventory) was then separately requested and
  approved** — WebDesk Solution, decision CONFIRM (a clean pass, not an override, since the
  second-role review was already complete before the gate was requested), approved commit
  `c01851d` on branch `dashboard-web-page-inventory` — see
  `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
  `G4-dashboard-web-page-inventory`) and
  `docs/project-state/dashboard-web-page-inventory-approval-checklist.md`'s "Sign-off" section.
  **This gate approval does not itself authorize pushing the branch, opening a PR, or merging** —
  each remains its own separate, not-yet-requested authorization, per this project's standing
  "no auto-merge" rule.
- `[2026-08-23]` **"Push the branch and open a PR" was separately requested and executed** on
  `dashboard-web-page-inventory` — pushed to `origin`, opened as
  [PR #58](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/58). All
  14 CI checks confirmed green.
- `[2026-08-23]` **"Merge PR #58" was separately requested and executed.** Merged with a real
  merge commit (not squash/rebase), matching every prior merge in this project's history — merge
  commit `c08f47c74371b5fa70e5eb2b3a4b18b1c37b783e`, all 14 CI checks green beforehand. Both
  Vercel projects auto-deployed on push to `main` and were verified live directly, not just via
  CI's own Vercel status check — `dashboard-api`'s `/health` returned `build.commitSha ==
c08f47c74371b5fa70e5eb2b3a4b18b1c37b783e`, confirming the exact merged commit is what's serving;
  `GET /page-inventory/projects/:projectId/pages` returned a clean `401` (route live,
  `SessionGuard` enforcing — not a `404`, which would mean the module never actually deployed);
  and `dashboard-web`'s `/` resolves (via the intermediate `/home` hop) to `/auth/sign-in` for an
  unauthenticated visitor, with `/page-inventory` itself redirecting (307) there too, confirming
  the session gate is intact. **The `dashboard-web` Page Inventory UI is now genuinely live in
  production**, closing out this slice's full build-to-production arc — backend and now the full
  UI (list, detail, create/edit form, status actions, `page_urls` sub-resource editing) are both
  live for the Page Inventory module.
- `[2026-08-23]` **Built the Keyword & Entity Library module backend** (module #8 on the
  Recommended Module Roadmap) on the explicit "Start Keyword & Entity Library" instruction — the
  mechanically-correct next candidate per `docs/phase-plans/module-implementation-roadmap.md`
  (Wave 3, depending on `website_strategy_center`/`page_inventory`, both already live). Two genuine
  architectural forks confirmed directly with the user first (`AskUserQuestion`): table scope (the
  full 4-table relational model the canonical data-model doc names — `keywords`, `entities`,
  `keyword_entity_relationships`, `page_keyword_assignments` — chosen over a simplified
  single-table fallback, since both dependencies already exist so a real FK-validated join is
  buildable now) and project scoping (`keywords`/`entities` are project-scoped, chosen over
  organization-wide, since keyword research is inherently tied to a specific client website). 8
  further field-level design decisions made directly, matching this project's own precedent for
  judgment calls on an unsourced module — see `docs/task-packages/module-keyword-and-entity-library.md`
  for the full account, including why no confidentiality/redaction mechanism was built (the
  registry's own seeded `confidentialityLevel` value describes the approval workflow, not an
  access-control tier, matching Persona Library's/Proof and Claims Library's own identical
  precedent) and why `page_inventory.pages.targetKeyword` is deliberately not reconciled with the
  new join table in this pass. Built by a background agent with a fully-specified prompt (the
  exact schema, file layout, and known bug classes from prior modules to avoid repeating — terminal-
  state CAS races, class-level RBAC decorators, raw repository exports across module boundaries),
  then independently re-verified in full by the orchestrating session — every high-risk file read
  directly (migration up/down, RBAC decorator placement, the CAS guard built into
  `KeywordRepository.update()`/`updateStatus()` from day one rather than needing a security-review
  fix-round the way Page Inventory did, the narrow read-only `PagesService.existsInProject()`
  cross-module delegating method), every test suite independently re-run against a fresh local
  disposable PostgreSQL 17 database, not trusted from the agent's own report. **Independent code
  review then ran** (this project's own `code-review` skill, high effort, 8-angle finder pass) — 5
  candidates surfaced after dedup, 4 CONFIRMED and fixed (most severe: a DTO length limit of 255
  characters on 5 fields whose actual columns are `VARCHAR(100)`, so a 101–255-character value
  passed Zod but crashed the real INSERT/UPDATE with an unhandled 500 — also fixed: two join-table
  `create()` methods running independent existence checks sequentially instead of via `Promise.all`,
  the exact bug class a prior Persona Library code review already caught once; a malformed-UUID
  guard duplicated across both join-table services that was actually unreachable dead code, since
  the DTO already enforces `.uuid()` before either service method runs; an inline type duplicating
  an existing DTO), 1 REFUTED (`EntityRepository.update()`'s `{id}`-only scoping, verified
  consistent with `KeywordRepository.update()`'s own identical scoping and Page Inventory's own
  established `PageRepository.update()` precedent — not a new gap). **A separate `security-review`
  skill run then found 0 findings above threshold** — confirmed correct RBAC decorator placement,
  correct `projectId` threading into the dynamic per-transition authorization check (the exact gap
  Page Inventory's own code review caught was not repeated here), correct IDOR scoping on all 4
  tables including both join tables, no SQL injection surface, and independently re-verified the
  code-review fix removing the malformed-UUID guard as genuinely sound (Zod validation runs before
  either controller method body ever executes). Final numbers: 734/734 `dashboard-api` unit tests,
  28/28 `packages/database` unit tests, 292/292 `packages/database` integration tests, 283/283
  `dashboard-api` integration/e2e tests — all re-verified against a real disposable database after
  every fix round; typecheck/lint/prettier all clean; migration up/down/up round-trip clean (61
  migrations); `validate:module-registry` still 43 modules/21 permission groups; `pnpm audit` 0
  vulnerabilities. A review packet (published as a Claude artifact, "Keyword & Entity Library
  Review Packet" — code review + security review findings, fixes, and validation evidence, with a
  decision section) was then prepared for the required second-role human review, since the
  implementing agent cannot also be its own reviewer (ADR-0010). See
  `docs/project-state/module-keyword-and-entity-library-approval-checklist.md`.
- `[2026-08-23]` **Required second-role human review complete for
  `module-keyword-and-entity-library`.** The review packet (code review + security review
  findings, fixes, and validation evidence, with a decision section) was reviewed. **Jitesh D
  reviewed it and returned "Approves,"** no disputes raised — every confirmed code-review finding
  was already fixed, the 1 refuted finding was independently re-verified as consistent with
  established precedent, and the security review found 0 findings above threshold, so there was no
  open item to accept as tracked debt. See
  `docs/project-state/module-keyword-and-entity-library-approval-checklist.md`'s "Sign-off"
  section.
- `[2026-08-23]` **The gate (G4-keyword-and-entity-library) was then separately requested and
  approved** — WebDesk Solution, decision CONFIRM (a clean pass, not an override, since the
  second-role review was already complete before the gate was requested), approved commit
  `4307d7f` on branch `module-keyword-and-entity-library` — see
  `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
  `G4-keyword-and-entity-library`) and
  `docs/project-state/module-keyword-and-entity-library-approval-checklist.md`'s "Sign-off"
  section. **This gate approval does not itself authorize pushing the branch, opening a PR, or
  merging** — each remains its own separate, not-yet-requested authorization, per this project's
  standing "no auto-merge" rule.
- `[2026-08-23]` **"Push the branch and open a PR" was separately requested and executed** on
  `module-keyword-and-entity-library` — pushed to `origin`, opened as
  [PR #59](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/59). All
  14 CI checks confirmed green.
- `[2026-08-24]` **"Merge PR #59" was separately requested and executed.** Merged with a real
  merge commit (not squash/rebase), matching every prior merge in this project's history — merge
  commit `ea53364653e8ee1f14cbdf74cf701865fd9d96be`, all 14 CI checks green beforehand. Both
  Vercel projects auto-deployed on push to `main` and were verified live directly, not just via
  CI's own Vercel status check — `dashboard-api`'s `/health` returned `build.commitSha ==
ea53364653e8ee1f14cbdf74cf701865fd9d96be`, confirming the exact merged commit is what's serving;
  `GET /keyword-and-entity-library/projects/:projectId/keywords` returned a clean `401` (route
  live, `SessionGuard` enforcing — not a `404`, which would mean the module never actually
  deployed); and `dashboard-web`'s `/` resolves to `/auth/sign-in` for an unauthenticated visitor,
  confirming the session gate is intact. **The Keyword & Entity Library module backend is now
  genuinely live in production**, closing out this slice's full build-to-production arc. No
  `dashboard-web` UI exists yet for this module — a separate, not-yet-requested next step,
  matching every prior module's own backend-first precedent.
- `[2026-08-24]` **Built the `dashboard-web` UI for Keyword & Entity Library** — closes this
  module's last named gap, following the backend's own build-to-production arc (PR #59). Not
  started automatically — built directly on the explicit "Start the dashboard-web UI for it"
  instruction. Keywords are the primary record (list/create/detail/edit, full approval workflow,
  mirroring Page Inventory's own project-scoped route/picker pattern — the only other
  project-scoped module in this codebase); entities are a secondary, independently-browsable
  resource with no workflow (task package D3) and a real hard-delete route — the first top-level
  hard-delete UI in this app. Two sub-resource sections on the keyword detail page
  (`KeywordEntityRelationshipsSection`, `KeywordPageAssignmentsSection`) manage the two join
  tables via `@webdesk/ui`'s `RelationshipPicker`, the latter a genuine cross-module relationship
  into Page Inventory's own `pages`. Per the 2026-08-22 standing rule, `cannibalizationNotes`
  (keywords) and `description` (entities) both switch to `RichTextEditor` — a paired, additive
  backend change (raising the DTO length limit, wiring write-time sanitization) landed in the
  same branch, matching the established rich-text-conversion pattern. **Independent code review
  then ran** (this project's own `code-review` skill, high effort, 8-angle finder pass) — 5
  candidates surfaced after dedup, all 5 CONFIRMED and fixed (most severe: the keywords list
  page's filter inputs silently truncated a typed value to 100 characters with zero feedback,
  since the input's `maxLength` didn't match the backend's real column limit — also fixed: a
  duplicated form-field helper, three pages missing an already-established fetch-concurrency
  pattern, and a hand-rolled delete button bypassing the design system's `Button` component). One
  fix extracted a new shared `useRelationshipSection()` hook after the two sub-resource sections
  were found to independently reimplement ~150 near-identical lines each — past this same
  branch's own 2-copy extraction threshold. **A separate `security-review` skill run then found 0
  findings above threshold** — confirmed rich-text sanitization runs end-to-end on every write/
  render path, the two `RelationshipPicker` sections can't be used to link a cross-project
  entity/page (the backend independently re-validates both against the caller's own project), the
  new hard-delete route is genuinely gated server-side (not just the client-side confirm), and no
  injection/open-redirect surface exists in the project-scoped cookie/href handling. Final
  numbers: 615/615 `dashboard-web` unit tests, 745/745 `dashboard-api` unit tests, 283/283
  `dashboard-api` integration/e2e tests — all re-verified against a real disposable database after
  every fix round; typecheck/lint/CSS-token-check/`next build`/prettier all clean. A review packet
  (published as a Claude artifact, "Keyword & Entity Library UI Review Packet" — code review +
  security review findings, fixes, and validation evidence, with a decision section) was then
  prepared for the required second-role human review, since the implementing agent cannot also be
  its own reviewer (ADR-0010). See
  `docs/project-state/dashboard-web-keyword-and-entity-library-approval-checklist.md`.
- `[2026-08-24]` **Required second-role human review complete for
  `dashboard-web-keyword-and-entity-library`.** The review packet (code review + security review
  findings, fixes, and validation evidence, with a decision section) was reviewed. **Jitesh D
  reviewed it and returned "Approves,"** no disputes raised — every confirmed code-review finding
  was already fixed, none were accepted as tracked debt, and the security review found 0 findings
  above threshold. See
  `docs/project-state/dashboard-web-keyword-and-entity-library-approval-checklist.md`'s "Sign-off"
  section.
- `[2026-08-24]` **The gate (G4-dashboard-web-keyword-and-entity-library) was then separately
  requested and approved** — WebDesk Solution, decision CONFIRM (a clean pass, not an override,
  since the second-role review was already complete before the gate was requested), approved
  commit `4126d29` on branch `dashboard-web-keyword-and-entity-library` — see
  `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
  `G4-dashboard-web-keyword-and-entity-library`) and
  `docs/project-state/dashboard-web-keyword-and-entity-library-approval-checklist.md`'s "Sign-off"
  section. **This gate approval does not itself authorize pushing the branch, opening a PR, or
  merging** — each remains its own separate, not-yet-requested authorization, per this project's
  standing "no auto-merge" rule.
- `[2026-08-24]` **"Push the branch and open a PR" was separately requested and executed** on
  `dashboard-web-keyword-and-entity-library` — pushed to `origin`, opened as
  [PR #60](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/60). All 14
  CI checks confirmed green.
- `[2026-08-24]` **"Merge PR #60" was separately requested and executed.** Merged with a real
  merge commit (not squash/rebase), matching every prior merge in this project's history — merge
  commit `b54fc51b437da4f7df6d84db36d0c035ecb41059`, all 14 CI checks green beforehand. Both
  Vercel projects auto-deployed on push to `main` and were verified live directly, not just via
  CI's own Vercel status check — `dashboard-api`'s `/health` returned `build.commitSha ==
b54fc51b437da4f7df6d84db36d0c035ecb41059`, confirming the exact merged commit is what's serving;
  `dashboard-web`'s `/keyword-and-entity-library` correctly redirects (307) an unauthenticated
  visitor to `/auth/sign-in`, confirming the session gate is intact. **The `dashboard-web`
  Keyword & Entity Library UI is now genuinely live in production**, closing out this slice's full
  build-to-production arc — backend and now the full UI (keywords list/detail/create/edit, status
  actions, entities list/detail/create/edit, both sub-resource sections) are both live for the
  Keyword & Entity Library module.
- `[2026-08-24]` **Started the Internal Linking Library module backend** (module #9 on the
  Recommended Module Roadmap) — presented as "what's next" and built directly on the explicit
  "Start Internal Linking Library" instruction. `docs/task-packages/module-internal-linking-library.md`
  records the full account. One genuine architectural fork confirmed directly with the user first
  (`AskUserQuestion`): a bespoke 4-state workflow (`proposed → approved → implemented →
verified`) chosen over the standard 8-value generic lifecycle every prior module reuses — the
  first bespoke workflow vocabulary in this codebase — after research surfaced that the roadmap's
  own phrasing for this workflow isn't actually sourced anywhere in the canonical
  workflow-state-machines doc. Migration `00062` creates a single project-scoped `internal_links`
  table with existence-validated FKs into Page Inventory's `pages` (source/target) and a nullable
  existence-validated approver FK into `users`; `relatedStrategyRecordId` is deliberately an
  unvalidated plain UUID string, since Website Strategy Center shipped with no validation hook for
  this relationship. `InternalLinkRepository.updateStatus()` introduces a genuinely new mechanism —
  an atomic compare-and-swap on `(id, status)` that also conditionally stamps
  `implementedAt`/`verifiedAt` via a `COALESCE(column, NOW())` SQL literal baked into the same
  `UPDATE`, so "stamp once, never overwrite" stays atomic with the CAS guard itself. Built by a
  background agent with a fully-specified prompt, then independently re-verified in full by the
  orchestrating session — every high-risk file (migration, repository, service, controller RBAC
  placement via grep, DTO, module wiring, both `packages/database` barrel exports, `app.module.ts`
  wiring) read directly, and every test suite re-run fresh against a real local disposable
  PostgreSQL 17 database rather than trusted from the agent's own report: 28/28
  `packages/database` unit tests, a full 63-migration up/down/up round-trip, 23/23
  `packages/database` integration tests, 38/38 `dashboard-api` unit tests for this module (787/787
  overall), 28/28 `dashboard-api` e2e tests for this module (311/311 overall), module-registry
  validation (43 modules, 21 permission groups), `pnpm audit` 0 vulnerabilities, prettier clean.
  **Independent code review then ran** (this project's own `code-review` skill, high effort,
  8-angle finder pass, 1-vote verification) — 10 candidates survived dedup, 9 CONFIRMED and 1
  REFUTED. 8 of 9 CONFIRMED findings fixed: most severe, self-link rejection in both `create()`
  and `update()` used case-sensitive `===` on UUID strings, so two differently-cased
  representations of the identical page id (both valid per Zod's case-insensitive `.uuid()`)
  bypassed the guard — fixed by extracting a shared `assertDistinctPages()` helper comparing
  case-insensitively. Also fixed: the "call `existsInProject`, throw if false" pattern hand-copied
  4 times instead of reusing the file's own established `assertApproverExists()`-style
  private-helper convention (extracted `assertPageExists()`); `update()`'s conditional
  field-revalidation using a mutable `checks` array with 3 `.push()` calls instead of the sibling
  `ServicesService.update()`'s cleaner `Promise.all([cond ? assertX() : Promise.resolve(), ...])`
  literal; the RBAC `MODULE_KEY` string literal independently declared in both the service and
  controller instead of the module's own already-existing `constants.ts` (promoted to
  `INTERNAL_LINKING_LIBRARY_MODULE_KEY`); no composite index covering
  `(project_id, source_page_id)`/`(project_id, target_page_id)` despite `project_id` being
  mandatory on every `list()` call (migration `00062` amended — it hadn't shipped anywhere yet —
  to lead both page-id indexes with `project_id`); the self-link check itself duplicated between
  `create()`/`update()`; and `update()`'s `targetPageId` re-validation branch and its
  cross-project-page real-database path both having zero test coverage, unlike the structurally
  identical `sourcePageId` branch (both closed with new tests, including a real e2e counterpart
  mirroring `create()`'s own cross-project test). **1 CONFIRMED finding left as accepted, tracked
  debt, flagged directly in code**: `changeStatus()`'s same-status no-op short-circuit returns
  before the per-transition `assertAllowed()` check runs — the byte-identical, already-shipped
  ordering `PagesService.changeWorkflowStage()`/`KeywordsService.changeApprovalStatus()` both have,
  with no state mutation and no data exposure beyond what the identical `GET` route already
  permits under the same grant; fixing only this new module would diverge from two already-live
  siblings for a fix whose correct shape isn't specified anywhere. **1 candidate REFUTED**: a
  missing DB-level `CHECK` constraint for `source_page_id <> target_page_id` — the task package's
  own D4 decision explicitly considered and rejected this, and the cited sibling precedents aren't
  actually the same constraint shape (bound/completeness/format checks, not a same-table
  self-referential inequality). Re-validated: 42/42 module unit tests (787/787 overall), 29/29
  module e2e tests (312/312 overall), migration round-trip re-confirmed with the new composite
  indexes present, typecheck/lint/prettier clean. **A separate `security-review` skill run then
  found 0 findings above threshold** — confirmed method-level RBAC placement throughout,
  `changeStatus()` correctly threading the already-IDOR-verified `link.projectId` into
  `assertAllowed()`, no residual bypass in the fixed self-link/page-existence checks, the search
  filter's `escapeLikePattern()` reuse closing any SQL-injection surface, the COALESCE timestamp
  mechanism being a fixed literal with no interpolated input, and `relatedStrategyRecordId` never
  reaching any SQL/URL/file-path sink — purely inert stored data. A review packet (published as a
  Claude artifact, "Internal Linking Library Review Packet" — code review + security review
  findings, fixes, and validation evidence, with a decision section) was then prepared for the
  required second-role human review, since the implementing agent cannot also be its own reviewer
  (ADR-0010). See `docs/project-state/module-internal-linking-library-approval-checklist.md`.
- `[2026-08-24]` **Required second-role human review complete for
  `module-internal-linking-library`.** The review packet (code review + security review findings,
  fixes, and the 1 accepted-debt/1 refuted item, with a decision section) was reviewed. **Jitesh D
  reviewed it and returned "Approves,"** no disputes raised — the 1 open accepted-debt item
  (`changeStatus()`'s no-op ordering, matching an already-shipped sibling pattern) and the 1
  refuted finding were both accepted as recorded rather than sent back for another pass. See
  `docs/project-state/module-internal-linking-library-approval-checklist.md`'s "Sign-off" section.
  A gate decision, push/PR, and merge authorization each remain separate, not-yet-requested next
  steps.
- `[2026-08-24]` **The gate (G4-internal-linking-library) was then separately requested and
  approved** — WebDesk Solution, decision CONFIRM (a clean pass, not an override, since the
  second-role review was already complete before the gate was requested), approved commit
  `b026170` on branch `module-internal-linking-library` — see
  `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
  `G4-internal-linking-library`) and
  `docs/project-state/module-internal-linking-library-approval-checklist.md`'s "Sign-off" section.
  **This gate approval does not itself authorize pushing the branch, opening a PR, or merging** —
  each remains its own separate, not-yet-requested authorization, per this project's standing "no
  auto-merge" rule.
- `[2026-08-24]` **"Push the branch and open a PR" was separately requested and executed** on
  `module-internal-linking-library` — pushed to `origin`, opened as
  [PR #61](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/61). All 14
  CI checks confirmed green.
- `[2026-08-24]` **"Merge PR #61" was separately requested and executed.** Merged with a real
  merge commit (not squash/rebase), matching every prior merge in this project's history — merge
  commit `b78ef2b9765f5f1cd1d0eecb3cb2a3e0ffcf9e1d`, all 14 CI checks green beforehand. Both
  Vercel projects auto-deployed on push to `main` and were verified live directly, not just via
  CI's own Vercel status check — `dashboard-api`'s `/health` returned `build.commitSha ==
b78ef2b9765f5f1cd1d0eecb3cb2a3e0ffcf9e1d`, confirming the exact merged commit is what's serving;
  `GET /internal-linking-library/projects/:projectId/links` returned a clean `401` (route live,
  `SessionGuard` enforcing — not a `404`, which would mean the module never actually deployed);
  and `dashboard-web`'s `/` resolves (307) to `/auth/sign-in` for an unauthenticated visitor,
  confirming the session gate is intact. **The Internal Linking Library module backend is now
  genuinely live in production.** No `dashboard-web` UI exists yet for this module — a separate,
  not-yet-requested next step, matching every prior module's own backend-first precedent.
- `[2026-08-24]` **Built the `dashboard-web` UI for Internal Linking Library** — closes this
  module's last named gap, following the backend's own build-to-production arc (PR #61). Not
  started automatically — the user was asked directly ("start building it now" vs. "just wanted
  the status") via `AskUserQuestion` after a bare "what about dashboard-web UI" prompt, and chose
  to start building. Four project-scoped routes mirroring Page Inventory's exact 4-file route
  shape (list, new, `[linkId]` detail, `[linkId]/edit`) — the module has no sub-resources, so no
  extra sub-resource sections are needed. `InternalLinkForm` introduces `SinglePagePicker`, a new
  single-value wrapper around `@webdesk/ui`'s `RelationshipPicker` (the first single-value use of
  that component in this codebase — every prior use is a many-to-many join list) for the two
  independent `sourcePageId`/`targetPageId` fields, each excluding whichever page is selected in
  the other; a `UserPicker` for `assignedApproverUserId` mirroring `ProjectForm`'s own
  owner-field/`touched`-state wiring; `RichTextEditor` for `context` (a paired backend change —
  DTO cap raised 2000→4000, `sanitizeNullableRichText()`/`sanitizeNullableRichTextIfChanged()`
  wired into `create()`/`update()`, per the 2026-08-22 standing rule); and a plain, client-side
  UUID-format-checked (but server-unvalidated) `relatedStrategyRecordId` field, matching task
  package D8. `InternalLinkStatusActions` hand-mirrors the backend's bespoke 4-state `TRANSITIONS`
  table — the first non-8-value status-actions component in this app — with no
  `window.confirm()` guard anywhere, since this workflow has no terminal state. Built by a
  background agent with a fully-specified prompt, then independently re-verified in full by the
  orchestrating session (the agent's own process had been interrupted mid-task and left real,
  substantial uncommitted work on disk — confirmed via `git status`/`git log` before trusting or
  continuing it) — every high-risk file (both `SinglePagePicker` instances, the `UserPicker`/
  `approverTouched` wiring, the status-actions transition table, the backend sanitization wiring,
  all 4 routes) read directly, and every test suite re-run fresh: 791/791 `dashboard-api` unit
  tests (4 new), 312/312 `dashboard-api` e2e/integration tests (unchanged, confirming no
  regression), 664/664 `dashboard-web` unit tests (49 new), a clean `next build` with all 4 new
  routes present, prettier clean, `pnpm audit` 0 vulnerabilities, all 4 routes live-rendered in
  the Browser pane with clean unauthenticated redirects. **Independent code review then ran**
  (this project's own `code-review` skill, high effort, 8-angle finder pass, 1-vote verification)
  — 8 candidates survived dedup, all 8 CONFIRMED and fixed: most severe, unguarded `getUser()`/
  `getPage()` calls inside an awaited `Promise.all` crashed the detail and edit pages for any
  role lacking cross-module RBAC grants (`GET /users/:userId` is gated on `users_roles:view`, held
  by only 2 of the 7 seeded roles) — the exact bug class already fixed once in this app's own
  `projects/[projectId]/edit/page.tsx`. Fixed by extracting a new `resolveLinkRelationships()`
  helper (`lib/internal-linking-library.ts`) that guards each lookup independently and degrades to
  `null`, which also collapsed the detail and edit pages' previously byte-for-byte duplicated
  3-promise resolution block into one shared function — closing a second finding in the same fix.
  Also fixed: the edit-mode "preserve an untouched approver assignment on save" path and the
  self-link case-insensitivity guard both had zero test coverage (the former is the exact
  data-loss bug class `ProjectForm`'s owner field already shipped once and already has a dedicated
  regression test for; the latter is the sole remaining backstop for a mixed-case duplicate page
  id, since the picker's own exclusion filter is case-sensitive — both closed with new tests); a
  local `UUID_PATTERN` regex duplicated `lib/uuid.ts`'s canonical `isUuid()` helper, which this
  same branch's own form already imports for a different field; the migration's and task
  package's own doc comments still described `context`'s old 2000-char cap after the raise to
  4000; `getProject()`/the picker fetch ran sequentially on the create page instead of
  concurrently; and the edit page re-fetched `sourcePage`/`targetPage` via two more real network
  calls even though the already-fetched `pages` array almost always already contains them
  (`resolveLinkRelationships()` now accepts an optional `pagePool` and checks it first via
  `.find()`). Re-validated: typecheck/lint/CSS-token-check clean, 667/667 `dashboard-web` unit
  tests (3 new), a clean `next build`, prettier clean. **A separate `security-review` skill run
  then found 0 findings above threshold** — confirmed the rich-text sanitization loop has no
  bypass path, `relatedStrategyRecordId` is rendered only as plain JSX text (never a link/URL/
  query — purely inert stored data), the picker option pools rely on already-scoped, already-RBAC
  -gated endpoints with server-side re-validation as the real enforcement point (no IDOR), and the
  new error-catching logs only fixed descriptive strings with no sensitive data. A review packet
  (published as a Claude artifact, "Internal Linking Library UI Review Packet" — code review +
  security review findings, fixes, and validation evidence, with a decision section) was then
  prepared for the required second-role human review, since the implementing agent cannot also be
  its own reviewer (ADR-0010). See
  `docs/project-state/dashboard-web-internal-linking-library-approval-checklist.md`.
- `[2026-08-24]` **Required second-role human review complete for
  `dashboard-web-internal-linking-library`.** The review packet (code review + security review
  findings, fixes, and validation evidence, with a decision section) was reviewed. **Jitesh D
  reviewed it and returned "Approves,"** no disputes raised — every confirmed code-review finding
  was already fixed, and the security review found 0 findings above threshold. See
  `docs/project-state/dashboard-web-internal-linking-library-approval-checklist.md`'s "Sign-off"
  section. A gate decision, push/PR, and merge authorization each remain separate,
  not-yet-requested next steps.
- `[2026-08-24]` **The gate (G4-dashboard-web-internal-linking-library) was then separately
  requested and approved** — WebDesk Solution, decision CONFIRM (a clean pass, not an override,
  since the second-role review was already complete before the gate was requested), approved
  commit `a43d3f0` on branch `dashboard-web-internal-linking-library` — see
  `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
  `G4-dashboard-web-internal-linking-library`) and
  `docs/project-state/dashboard-web-internal-linking-library-approval-checklist.md`'s "Sign-off"
  section. **This gate approval does not itself authorize pushing the branch, opening a PR, or
  merging** — each remains its own separate, not-yet-requested authorization, per this project's
  standing "no auto-merge" rule.
- `[2026-08-24]` **"Push the branch and open a PR" was separately requested and executed** on
  `dashboard-web-internal-linking-library` — pushed to `origin`, opened as
  [PR #62](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/62). Merge
  authorization remains a separate, not-yet-requested next step.
- `[2026-08-24]` **"Check CI status on the PR" confirmed all 14 checks green on PR #62**, including
  both Vercel preview deployments. **"Merge PR #62" was then separately requested and executed** —
  merged with a real merge commit (not squash/rebase), matching every prior merge in this
  project's history — merge commit `e439ca5be99d62a01944d9062926c470139e672b`. Both Vercel
  projects auto-deployed on push to `main` and were verified live directly, not just via CI's own
  Vercel status check — `dashboard-api`'s `/health` returned `build.commitSha ==
e439ca5be99d62a01944d9062926c470139e672b`, confirming the exact merged commit is what's serving;
  `GET /internal-linking-library/projects/:projectId/links` returned a clean `401` (route live,
  `SessionGuard` enforcing — not a `404`, which would mean the module never actually deployed);
  and `dashboard-web`'s `/internal-linking-library` resolves (307) to `/auth/sign-in` for an
  unauthenticated visitor (a transient stale-edge-cache `404` on the first two checks was ruled
  out via repeated, cache-busted checks, not a real defect). **The `dashboard-web` Internal
  Linking Library UI is now genuinely live in production**, closing out this slice's full
  build-to-production arc — backend and now the full UI (list, detail, create/edit form, status
  actions) are both live for the Internal Linking Library module.
- `[2026-08-24]` **Built the Content Template Library module backend** (module #10 on the
  Recommended Module Roadmap, Wave 1 in the dependency-computed roadmap — no dependencies), under
  the explicit "Yes, start it" instruction following "what's next on the module roadmap." One
  genuine design fork confirmed directly with the user first (`AskUserQuestion`): the module's own
  RBAC group (`page_content`) seeds a real, previously-unused `publish`/`unpublish` action pair
  with no direct spec support for it (the canonical field list names only "approval, version") —
  the user chose to build a real publish/unpublish mechanism, orthogonal to the standard 8-value
  approval workflow, rather than leave it zero-wired (the precedent every earlier module with an
  unused action followed). Task package: `docs/task-packages/module-content-template-library.md`.
  Single organization-wide table (`content_templates`), standard `ArtifactApprovalStatus`
  workflow reused verbatim, server-managed `version`. Built by a background agent with a
  fully-specified prompt, then independently re-verified in full by the orchestrating session —
  every high-risk file read directly (the repository's CAS logic, the service's RBAC placement,
  the controller's decorator placement, both migrations, both `packages/database` barrel
  exports), every test suite independently re-run against a fresh local disposable PostgreSQL 17
  database. 828/828 `dashboard-api` unit tests, 339/339 `packages/database` integration tests,
  336/336 `dashboard-api` e2e tests at initial build, migration up/down round-trip clean,
  `validate:module-registry` unaffected (43 modules, 21 permission groups), `pnpm audit` 0
  vulnerabilities. `apps/dashboard-web` untouched — backend only, matching every prior module's
  own precedent.
- `[2026-08-24]` **Independent code review run on `module-content-template-library`, then 6 of 9
  confirmed/plausible findings fixed.** This project's own `code-review` skill (high effort,
  8-angle finder pass, 1-vote verification) surfaced 9 candidates after dedup (4 CONFIRMED, 5
  PLAUSIBLE). Most severe: `publish()` had a real TOCTOU race — it read `approvalStatus` via a
  plain read, checked it was `"approved"`, then wrote via a compare-and-swap that only guarded
  `isPublished`; a concurrent `changeApprovalStatus()` transition landing between the read and the
  write could still let the publish succeed, leaving the row `archived`/`superseded` **and**
  `isPublished: true` — the same bug class already fixed 4 times elsewhere in this codebase (Page
  Inventory, Website Strategy Center, Keyword & Entity Library, Internal Linking Library). Fixed
  by widening `updatePublishState()` with an optional `expectedApprovalStatus` CAS guard,
  verified by a new deterministic integration test (not an unordered race — D3 explicitly allows
  `archived`+published as a valid non-racy outcome, so the real invariant being tested is narrower
  than "never both true"). Also fixed: `update()` had no terminal-state guard at all, letting an
  `archived`/`superseded` record be silently edited by anyone holding only `edit` — a regression
  from this codebase's most recently established convention (Website Strategy Center's own guard,
  explicitly copied by Page Inventory), fixed by mirroring `PagesService.update()`'s exact
  pattern; `?isPublished=false` silently coerced to `true` via `z.coerce.boolean()` (empirically
  verified), fixed with the same explicit `"true"`/`"false"` enum+transform pattern already
  established in `operational-contacts.dto.ts`; the RBAC `MODULE_KEY` was duplicated across the
  service and controller — the identical bug class Internal Linking Library's own code review
  already found and fixed one module earlier — fixed by promoting it to a shared
  `CONTENT_TEMPLATE_LIBRARY_MODULE_KEY` export; transposable positional booleans in
  `updatePublishState()` calls, fixed with named local constants; and `updateContentTemplateSchema`
  hand-duplicating all 8 fields from `createContentTemplateSchema`, fixed by deriving it via
  `.omit({publicId:true}).partial()`. 3 PLAUSIBLE findings left as accepted, tracked debt, each
  matching an already-accepted pattern elsewhere in this codebase (three near-identical audit
  try/catch blocks, already accepted in Persona/Service Library; the CAS+COALESCE-stamp pattern
  hand-copied from Internal Linking Library rather than extracted at its 2nd occurrence; and
  `publish()`'s avoidable double round-trip, verified as a real but marginal win not worth the
  added complexity). Re-validated: 833/833 `dashboard-api` unit tests (5 new), 342/342
  `packages/database` integration tests (4 new, including a new deterministic TOCTOU-guard test
  and 2 `update()` CAS-guard tests, all against a real disposable database), 336/336
  `dashboard-api` e2e tests (unchanged, confirms no regression), typecheck/lint/prettier all
  clean, `pnpm audit` 0 vulnerabilities. See
  `docs/project-state/module-content-template-library-approval-checklist.md`.
- `[2026-08-24]` **Security review run on `module-content-template-library`, separately from the
  code review, against the fixed branch.** 0 findings above threshold. Confirmed: the search
  filter is fully parameterized through Sequelize's `where` object with wildcards escaped by the
  existing, already-audited `escapeLikePattern()`; every `@RequirePermission` decorator is
  method-level, never class-level; the two new CAS guards are sound with no bypass path (every
  real `ContentTemplateApprovalStatus` value is a non-empty string, so the guard clause always
  applies on a real call); no mass-assignment path exists for the governed
  `approvalStatus`/`version`/`isPublished`/`publishedAt` fields, since neither DTO declares them
  and Zod's default `strip` mode drops any unrecognized keys before the service ever sees them;
  and the publish/unpublish mechanism as a whole has no way to forge a historical `publishedAt`,
  with `unpublish()`'s lack of a status restriction being documented product design (D2/D3), not
  an authorization gap. A review packet (published as a Claude artifact, "Content Template
  Library Review Packet" — code review + security review findings, fixes, and validation
  evidence, with a decision section) was then prepared for the required second-role human review,
  since the implementing agent cannot also be its own reviewer (ADR-0010). See
  `docs/project-state/module-content-template-library-approval-checklist.md`. **Awaiting that
  review** — a gate decision, push/PR, and merge authorization each remain separate,
  not-yet-requested next steps.
- `[2026-08-24]` **Required second-role human review complete for
  `module-content-template-library`.** The review packet (code review + security review findings,
  fixes, and the 3 open accepted-debt items, with a decision section) was reviewed. **Jitesh D
  reviewed it and returned "Approves,"** no disputes raised — the 3 open PLAUSIBLE findings (three
  near-identical audit try/catch blocks, the hand-copied CAS+COALESCE pattern, and `publish()`'s
  avoidable double round-trip) were accepted as tracked debt rather than sent back for a fix. See
  `docs/project-state/module-content-template-library-approval-checklist.md`'s "Sign-off" section.
  A gate decision, push/PR, and merge authorization each remain separate, not-yet-requested next
  steps.
- `[2026-08-24]` **The gate (G4-content-template-library) was then separately requested and
  approved** — WebDesk Solution, decision CONFIRM (a clean pass, not an override, since the
  second-role review was already complete before the gate was requested), approved commit
  `b4e2662` on branch `module-content-template-library` — see
  `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
  `G4-content-template-library`) and
  `docs/project-state/module-content-template-library-approval-checklist.md`'s "Sign-off" section.
  **This gate approval does not itself authorize pushing the branch, opening a PR, or merging** —
  each remains its own separate, not-yet-requested authorization, per this project's standing
  "no auto-merge" rule.
- `[2026-08-24]` **"Push the branch and open a PR" was separately requested and executed** on
  `module-content-template-library` — pushed to `origin`, opened as
  [PR #63](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/63). Merge
  authorization remains a separate, not-yet-requested next step.
- `[2026-08-24]` **"Check CI status on the PR" confirmed all 14 checks green on PR #63**, including
  both Vercel preview deployments. **Merge authorization was then separately confirmed and
  executed** — merged with a real merge commit (not squash/rebase), matching every prior merge in
  this project's history — merge commit `e76ee0609510c9c37b206515e9427cff5e16f820`. Both Vercel
  projects auto-deployed on push to `main` and were verified live directly, not just via CI's own
  Vercel status check — `dashboard-api`'s `/health` returned `build.commitSha ==
e76ee0609510c9c37b206515e9427cff5e16f820`, confirming the exact merged commit is what's serving;
  `GET /content-template-library/templates` returned a clean `401` (route live, `SessionGuard`
  enforcing — not a `404`, which would mean the module never actually deployed); and
  `dashboard-web`'s `/` resolves (via the intermediate `/home` hop) to `/auth/sign-in` for an
  unauthenticated visitor, confirming the session gate is intact. **The Content Template Library
  module backend is now genuinely live in production.** No `dashboard-web` UI exists yet for this
  module — a separate, not-yet-requested next step, matching every prior module's own
  backend-first precedent.
- `[2026-08-24]` **Built the `dashboard-web` UI for Content Template Library** — closes this
  module's last named gap, following the backend's own build-to-production arc (PR #63). Not
  started automatically — built directly on the explicit "move ahead" instruction. No approved
  wireframe exists for this module (`03_Detailed_Module_Specifications.md §25` is a flat field
  list) — sections mirror that grouping (Identity, Sections, Guidance, Status), matching every
  prior module's own "smallest honest reading" precedent for an unsourced screen. Mirrors Persona
  Library's file-for-file structure (organization-wide, single table, standard 8-value approval
  workflow, no sub-resources, no cross-module relationship fields). Per the 2026-08-22 standing
  rule, the 6 long-text fields (`purpose`/`proofRules`/`seoAeoGeoRequirements`/`schema`/
  `ctaRules`/`contentDepthGuidance`) convert to `RichTextEditor`, with a paired backend change
  (`LONG_TEXT_MAX_LENGTH` raised 2000→4000, real write-time sanitization wired into `create()`/
  `update()`). `ContentTemplatePublishActions` is this app's first real publish/unpublish UI —
  no sibling precedent — showing Publish only when `approved`+unpublished and Unpublish whenever
  published regardless of status (D3, no automatic unpublish on a later status transition).
  **Independent code review then ran** (this project's own `code-review` skill, high effort,
  8-angle finder pass) — 8 candidates after dedup (6 CONFIRMED, 2 PLAUSIBLE), 6 fixed: most
  severe, both new status/publish-actions components independently froze their own governing
  state (`isPublished`/`approvalStatus`) into `useState` at mount and never re-synced from fresh
  props — a transition made via one wasn't reflected in the other even after `router.refresh()` —
  fixed with a `useEffect` resync on each component's own prop; the edit route had no
  terminal-state guard at all, unlike the detail page and unlike Keyword & Entity Library's own
  edit route (built two modules earlier), a real regression from established practice — fixed by
  mirroring `EditKeywordPage`'s own redirect precedent; unpublishing an archived/superseded
  template is genuinely irreversible (no transition anywhere leads back to `approved`) yet got
  zero confirmation, with the component's own doc comment making a false claim about
  reversibility — fixed by adding a confirmation for this specific case; the publish-status badge
  used tokens that collided with the approval-status badge's own tokens, contradicting its own
  doc comment's stated goal — fixed by switching Unpublished to a non-colliding token; the
  shared-types `ContentTemplate` doc comment stated a false invariant D3 explicitly violates by
  design — corrected; and fetch-then-check-`response.ok` boilerplate was hand-copied 3× across
  the new components/form in this same PR — extracted into a shared `postMutation()` helper in
  `lib/api-errors.ts`. 2 findings left as accepted, tracked debt, each matching an
  already-established pattern elsewhere in this codebase (`update()`'s audit `afterState` logging
  raw pre-sanitization content — the third occurrence of an identical, already-accepted pattern
  from Service Library → Persona Library; and 6 near-identical per-field blocks in the form
  component, matching every sibling form's own style). Re-validated: 727/727 `dashboard-web` unit
  tests (60 new), 837/837 `dashboard-api` unit tests (unchanged), `next build` clean with all 4
  routes present, 336/336 `dashboard-api` e2e tests (unchanged, confirms no regression),
  typecheck/lint/prettier all clean, `pnpm audit` 0 vulnerabilities. See
  `docs/project-state/dashboard-web-content-template-library-approval-checklist.md`.
- `[2026-08-24]` **Security review run on `dashboard-web-content-template-library`, separately
  from the code review, against the fixed branch.** 0 findings above threshold. Confirmed: the
  rich-text sanitization write-time + render-time pattern is applied with no gaps across all 6
  fields on both `create()` and `update()`; zero new `dangerouslySetInnerHTML`/unsafe sinks
  outside the existing, already-vetted `SanitizedRichText` component; the new shared
  `postMutation()` helper's success-path parse tolerance never masks a failed request as
  successful and crosses no trust boundary; every client-side gate (terminal-state redirect,
  publish/unpublish visibility, confirm dialogs) is UX-only, with the backend's own RBAC checks,
  CAS guards, and status/approval validation independently unchanged and still the real
  enforcement point; and no new route or capability was added — only frontend consuming
  already-reviewed, already-gated endpoints. A review packet (published as a Claude artifact,
  "Content Template Library UI Review Packet" — code review + security review findings, fixes,
  and validation evidence, with a decision section) was then prepared for the required
  second-role human review, since the implementing agent cannot also be its own reviewer
  (ADR-0010). See
  `docs/project-state/dashboard-web-content-template-library-approval-checklist.md`. **Awaiting
  that review** — a gate decision, push/PR, and merge authorization each remain separate,
  not-yet-requested next steps.
- `[2026-08-24]` **Required second-role human review complete for
  `dashboard-web-content-template-library`.** The review packet (code review + security review
  findings, fixes, and the 2 open accepted-debt items, with a decision section) was reviewed.
  **Jitesh D reviewed it and returned "Approves,"** no disputes raised — the 2 open items
  (`update()`'s audit `afterState` logging raw pre-sanitization content, and the 6 near-identical
  per-field blocks in the form component) were accepted as tracked debt rather than sent back for
  a fix. See
  `docs/project-state/dashboard-web-content-template-library-approval-checklist.md`'s "Sign-off"
  section. A gate decision, push/PR, and merge authorization each remain separate,
  not-yet-requested next steps.
- `[2026-08-24]` **The gate (G4-dashboard-web-content-template-library) was then separately
  requested and approved** — WebDesk Solution, decision CONFIRM (a clean pass, not an override,
  since the second-role review was already complete before the gate was requested), approved
  commit `6de8303` on branch `dashboard-web-content-template-library` — see
  `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
  `G4-dashboard-web-content-template-library`) and
  `docs/project-state/dashboard-web-content-template-library-approval-checklist.md`'s "Sign-off"
  section. **This gate approval does not itself authorize pushing the branch, opening a PR, or
  merging** — each remains its own separate, not-yet-requested authorization, per this project's
  standing "no auto-merge" rule.
- `[2026-08-24]` **"Push the branch and open a PR" was separately requested and executed** on
  `dashboard-web-content-template-library` — pushed to `origin`, opened as
  [PR #64](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/64). All 14
  CI checks confirmed green.
- `[2026-08-24]` **"Merge PR #64" was separately requested and executed.** Merged with a real merge
  commit (not squash/rebase), matching every prior merge in this project's history — merge commit
  `befd1de3f583c4bcf271a1bd70a44fd392df7a29`, all 14 CI checks green beforehand. Both Vercel
  projects auto-deployed on push to `main` and were verified live directly, not just via CI's own
  Vercel status check — `dashboard-api`'s `/health` returned `build.commitSha ==
befd1de3f583c4bcf271a1bd70a44fd392df7a29`, confirming the exact merged commit is what's serving;
  `GET /content-template-library/templates` returned a clean `401` (route live, `SessionGuard`
  enforcing — not a `404`, which would mean the module never actually deployed); and
  `dashboard-web`'s `/content-template-library` correctly redirects (307) an unauthenticated
  visitor to `/auth/sign-in`. **The `dashboard-web` Content Template Library UI is now genuinely
  live in production**, closing out this slice's full build-to-production arc — backend and now
  the full UI (list, detail, create/edit form, status actions, publish/unpublish actions) are both
  live for the Content Template Library module.
- `[2026-08-24]` **Built the Review and Approval Center module backend** (module #11 on the
  Recommended Module Roadmap — the first module in this codebase that is a cross-cutting
  **engine** attaching to records in OTHER modules via a polymorphic `(targetModuleKey, targetId)`
  reference with no foreign key, rather than a single content-record library of its own), under
  the explicit "Build a minimal, real approval system now" instruction. A genuine conflict was
  surfaced and resolved directly with the user first (`AskUserQuestion`): the recommended roadmap
  places this module at Wave 3 ("build before Page Workspace"), but the module registry's own
  seeded `dependencies` for `review_and_approval_center` name four modules that don't exist yet
  (`page_workspace`, `case_study_studio`, `ready_for_claude_queue`, `design_review_center`) —
  resolved by building the generic mechanism the roadmap's own instruction actually calls for
  ("generic approval system for all future modules"), against what exists today, rather than
  waiting on those four modules. A full task package was authored directly (not delegated),
  `docs/task-packages/module-review-and-approval-center.md`, 10 design decisions (D1–D10): a
  three-table schema (`reviews`/`review_comments`/`review_decisions`), two orthogonal axes
  (`status`/`isPaused`, mirroring Content Template Library's own already-reviewed split), opaque
  version-compare labels (no real diff mechanism exists), separation of duties via the existing
  `SeparationOfDutiesService` (the first real consumer of `assertDistinctActors()` outside
  `RoleAssignmentService`/`RecoveryService`, which its own doc comment already named this module
  as an intended future consumer of), immutable approval events via the existing `audit_events`
  "approval" event type (no new mechanism), a new narrow
  `AuthorizationService.isValidModuleKey()` delegating method (deliberately not exporting the
  `ModuleRegistryRepository` itself across the module boundary), organization-wide scope, no
  confidentiality mechanism (matching the real seeded `confidentialityLevel: null`), no hard
  delete, and an RBAC action mapping reusing the already-seeded `review_center` permission group
  verbatim — no new RBAC migration. Also flags a real, unresolved RBAC-matrix oddity: only
  `super_admin`/`owner_growth_approver` hold the "create" action, even though the four mid-tier
  roles hold review+approve — recorded as-seeded, not worked around. Built by a background agent
  with a fully-specified prompt, then independently re-verified in full by the orchestrating
  session — every high-risk file read directly (the migration, all three atomic CAS repository
  methods, RBAC decorator placement via direct reading, the dynamic per-action RBAC check inside
  `decide()`, both `packages/database` barrel exports), every test suite independently re-run
  against a fresh local disposable PostgreSQL 17 database, not trusted from the agent's own
  report — catching and correcting one real process mistake along the way (the agent's first
  commit had briefly landed on `main` instead of the feature branch; self-caught and fixed before
  reporting back, verified clean via `git fetch`/`git rev-parse`). 866/866 `dashboard-api` unit
  tests, 369/369 `packages/database` integration tests, 358/358 `dashboard-api` e2e tests at
  initial build; migration up/down/down/up round-trip clean; `validate:module-registry` (43
  modules, 21 permission groups); `pnpm audit` 0 vulnerabilities. **Independent code review then
  ran** (this project's own `code-review` skill, high effort, 8-angle finder pass, 1-vote
  verification) — 8 candidates surfaced after dedup, **all 8 CONFIRMED**, and **all 8 fixed**:
  most severe, `updateStatus()` had no terminal-status CAS guard (unlike its siblings
  `updatePaused()`/`updateAssignee()`), letting a caller who observed a review as
  `approved`/`rejected` replay that as `expectedStatus` and reverse a supposedly-permanent
  decision — fixed by rejecting a terminal `expectedStatus` up front. Also fixed: non-atomic,
  unguarded `review_decisions` writes across `decide()`/`setPaused()`/`delegate()` (a transient
  failure after the CAS write committed left zero record of who changed the review — total and
  unrecoverable for `setPaused()`/`delegate()`, whose only history mechanism is
  `review_decisions`), fixed by wrapping the CAS write and the decision write in one
  `withTransaction()` block, mirroring `ProjectService.setActivePhase()`'s own established
  pattern; `updateAssignee()` had no CAS on the prior assignee, letting two concurrent
  `delegate()` calls both "succeed" and write contradictory decision rows, fixed by adding
  `expectedAssignedToUserId` as a real CAS parameter; `review_decisions` was write-only with no
  `GET` route ever exposing it despite the task package's own D1 describing it as "queryable
  local history," fixed by adding `GET /reviews/:id/decisions`; `assertAssigneeExists()` was a
  4th independent hand-copy of an existence-check pattern already present in
  `ProjectService`/`ServicesService`/`InternalLinksService`, fixed by extracting
  `UsersService.assertUserExists(userId, fieldName)`; a CAS-outcome exception-mapping pattern was
  triple-duplicated at both the service and repository layers, fixed with shared
  `unwrapCasResult()`/`casUpdate()` helpers; `create()` ran two independent checks sequentially
  instead of via `Promise.all` — the same avoidable bug class this project's prior reviews have
  caught repeatedly — fixed; and `review-comments.service.ts` duplicated its "review exists"
  guard between two methods, fixed by extracting `assertReviewExists()`. No findings left as
  accepted, tracked debt — every CONFIRMED finding was fixed. Re-validated: 875/875 `dashboard-api`
  unit tests (9 new), 371/371 `packages/database` integration tests (2 new, real disposable
  database, migration round-trip re-confirmed), 362/362 `dashboard-api` e2e tests (4 new, real
  disposable database + real seeded RBAC), `validate:module-registry` unaffected, `pnpm audit` 0
  vulnerabilities. **A separate `security-review` skill run then found 0 findings above
  threshold** — confirmed the dynamic per-action RBAC check in `decide()` is a TypeScript-exhaustive
  mapping over a Zod-validated enum with no bypass path; `SeparationOfDutiesService.assertDistinctActors()`
  runs and can throw before the new `withTransaction()` wrapping is ever entered, no race window;
  the new `GET /reviews/:id/decisions` route is gated identically to reading the review itself;
  `AuthorizationService.isValidModuleKey()`'s query is fully parameterized via Sequelize, no
  injection surface, and the repository stays un-exported across the module boundary; the new
  `expectedAssignedToUserId` CAS field introduces no cross-review enumeration oracle (the conflict
  message deliberately omits the row's actual current assignee); and every free-text Zod field has
  a length cap, with the search filter routed through the already-audited `escapeLikePattern()`.
  A review packet (published as a Claude artifact — code review + security review findings, fixes,
  and validation evidence, with a decision section) was prepared for the required second-role
  human review, since the implementing agent cannot also be its own reviewer (ADR-0010). See
  `docs/project-state/module-review-and-approval-center-approval-checklist.md`.
- `[2026-08-25]` **Required second-role human review complete for
  `module-review-and-approval-center`.** The review packet (code review + security review
  findings, fixes, and validation evidence, with a decision section) was reviewed. **Jitesh D
  reviewed it and returned "Approved,"** no disputes raised — every CONFIRMED code-review finding
  was already fixed, and the security review found 0 findings above threshold, so there was no
  open item to accept as tracked debt. See
  `docs/project-state/module-review-and-approval-center-approval-checklist.md`'s "Sign-off"
  section. A gate decision, push/PR, and merge authorization each remain separate,
  not-yet-requested next steps.
- `[2026-08-25]` **The gate (G4-review-and-approval-center) was then separately requested and
  approved** — WebDesk Solution, decision CONFIRM (a clean pass, not an override, since the
  second-role review was already complete before the gate was requested), approved commit
  `60a0c8a` on branch `module-review-and-approval-center` — see
  `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
  `G4-review-and-approval-center`) and
  `docs/project-state/module-review-and-approval-center-approval-checklist.md`'s "Sign-off"
  section. **This gate approval does not itself authorize pushing the branch, opening a PR, or
  merging** — each remains its own separate, not-yet-requested authorization, per this project's
  standing "no auto-merge" rule.
- `[2026-08-25]` **"Push the branch and open a PR" was separately requested and executed** on
  `module-review-and-approval-center` — pushed to `origin`, opened as
  [PR #65](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/65). All 14
  CI checks confirmed green.
- `[2026-08-25]` **"Merge PR #65" was separately requested and executed.** Merged with a real
  merge commit (not squash/rebase), matching every prior merge in this project's history — merge
  commit `ff9352ceaf04a5fe4c087bcb0c1133830390ad49`, all 14 CI checks green beforehand. Both
  Vercel projects auto-deployed on push to `main` and were verified live directly, not just via
  CI's own Vercel status check — `dashboard-api`'s `/health` returned `build.commitSha ==
ff9352ceaf04a5fe4c087bcb0c1133830390ad49`, confirming the exact merged commit is what's serving;
  `GET /reviews` returned a clean `401` (route live, `SessionGuard` enforcing — not a `404`,
  which would mean the module never actually deployed); and `dashboard-web`'s `/` correctly
  redirects (307) an unauthenticated visitor. **The Review and Approval Center module backend is
  now genuinely live in production.** No `dashboard-web` UI exists yet for this module — a
  separate, not-yet-requested next step, matching every prior module's own backend-first
  precedent.
- `[2026-08-25]` **Built the `dashboard-web` UI for the Review and Approval Center module** —
  closes this module's last named gap, following the backend's own build-to-production arc
  (PR #65). Not started automatically — built directly on the explicit "start wire dashboard-web
  UI" instruction. No approved wireframe exists for this module, and it needed a genuinely novel
  UI shape unlike every sibling module: a polymorphic `(targetModuleKey, targetId)` review engine
  attaching to records in OTHER modules, not a single content-record library. Built four routes
  under `app/(shell)/review-and-approval-center/` (an "inbox" list defaulting to
  `assignedToMe=true`, a create form, a `[reviewId]` detail page — no generic edit route, since
  every mutation is one of decide/pause/delegate/comment, each its own dedicated backend action).
  `ReviewForm` (create-only): `targetModuleKey`/`targetId`/`targetLabel`/an `UserPicker`-backed
  `assignedToUserId`/opaque `versionALabel`/`versionBLabel` comparison labels — `targetId` is a
  plain, client-side UUID-format-checked text input, not a picker (task package D6's own explicit
  design, no generic cross-module lookup exists). `ReviewDecisionActions` (the 4 approval-shaped
  `decide()` actions) and `ReviewProcessActions` (Pause/Resume, Delegate) are two independent
  client islands on the same detail page, each an atomic CAS confirm against the review's own
  current state, both hidden once `status` is terminal. `ReviewCommentsSection` deliberately stays
  a Server Component (not a client component with local optimistic state like the established
  `ClaimSourcesSection` sub-resource precedent) — `SanitizedRichText` is explicitly Node-only, so
  the add-comment form calls `router.refresh()` instead of appending locally. A paired backend
  change (`review-comments.service.ts#create()`) wires `review_comments.body` into
  `RichTextEditor` + `sanitizeRichTextHtml()` ahead of the UI build, per the 2026-08-22 standing
  rule. Added `Review`/`ReviewComment`/`ReviewDecision` to `packages/shared-types`, mirroring
  `packages/database/src/review-and-approval-center/entities.ts`. **Independent code review then
  ran** (this project's own `code-review` skill, high effort, 8-angle finder pass, 1-vote
  verification) — 9 candidates survived dedup (7 CONFIRMED, 2 PLAUSIBLE, 0 REFUTED), **all 9
  fixed**: most severe, the list/create pages' `targetModuleKey` picker was sourced from
  `GET /authz/module-registry`, gated on `users_roles:view` (held by only 2 of 7 seeded roles) —
  silently empty for the other 5 roles today, not a future-RBAC-change risk — fixed by removing
  `getModuleRegistry()` entirely in favor of `getServerSession()`'s already-fetched
  `session.navigation` (`GET /me/navigation`, `SessionGuard`-only, held by every authenticated
  session), closing both the RBAC gap and a redundant fetch in one change. Also fixed: `ReviewForm`
  navigating to `result.data.id` and `ReviewProcessActions`' pause/delegate handlers updating local
  state from `result.data.isPaused`/`result.data.assignedToUserId`, all three ignoring
  `postMutation()`'s own documented undefined-on-malformed-response contract (fixed with an
  explicit null-data guard in `ReviewForm` and by updating `ReviewProcessActions` from the
  locally-known target values instead, mirroring `ReviewDecisionActions`' own already-correct
  pattern); `review-decision-actions.tsx`'s own doc comment fabricating a sibling-component
  precedent for keeping `notes` plain text — no such comparable field exists anywhere in this
  codebase, and Website Strategy Center's own `notes` field already uses `RichTextEditor` under the
  2026-08-22 standing rule — fixed by converting `notes` to `RichTextEditor`, paired with a real
  backend change (`reviews.service.ts#decide()` now sanitizes `dto.notes` via
  `sanitizeNullableRichText()` before writing it to both `review_decisions` and its `audit_events`
  mirror — previously stored/audited verbatim, unsanitized, a second independent finding —
  `NOTES_MAX_LENGTH` raised 2000→4000, and the detail page's Decision History section now renders
  `notes` via the shared `SanitizedRichText` component); the prop-resync-via-`useEffect` pattern
  hand-copied a 5th time across `ReviewDecisionActions`/`ReviewProcessActions` (twice), matching
  this project's own standing feedback about duplication/reuse misses, fixed by extracting a new
  `useSyncedState()` hook (`lib/use-synced-state.ts`); and `ReviewCommentsSection` nesting
  `SanitizedRichText`'s block-level `<div dangerouslySetInnerHTML>` inside an inline
  `<span className={styles.rowMain}>` wrapper — invalid HTML content, unlike every sibling row
  (e.g. `ClaimSourcesSection`) which only ever nests `<span>`/`<a>` children — fixed by changing the
  wrapper to a `<div>` (verified safe, since `.rowMain` composes from a flex-column base with no
  tag-specific styling). Re-validated against a fresh local disposable PostgreSQL 17 database:
  878/878 `dashboard-api` unit tests (2 new — a real sanitization test proving a `<script>` payload
  in `notes` is stripped before reaching both `review_decisions`/`audit_events`), 371/371
  `packages/database` integration tests (migration round-trip re-confirmed), 362/362
  `dashboard-api` e2e tests (real seeded RBAC), 800/800 `dashboard-web` unit tests (4 new),
  typecheck/lint/CSS-token-check/`next build`/prettier all clean, `pnpm audit` 0 vulnerabilities.
  **A separate `security-review` skill run then found 0 findings above threshold** — confirmed the
  rich-text sanitization write/render pairing has no bypass path on either new field
  (`review_comments.body`, `review_decisions.notes`), the `session.navigation`-vs-
  `GET /authz/module-registry` swap has no authorization implication (`POST /reviews` stays
  independently gated by its own `@RequirePermission` plus
  `AuthorizationService.isValidModuleKey()`, both unmodified by this diff), `targetId`/
  `targetModuleKey` have no injection surface, the comments/decisions fetch functions' cookie-
  forwarding matches every sibling module's own pattern, and every CAS-guard-relevant client-state
  update is purely cosmetic — the backend's own atomic compare-and-swap methods remain the sole
  real enforcement point. A review packet (published as a Claude artifact, "Review and Approval
  Center UI Review Packet" — code review + security review findings, fixes, and validation
  evidence, with a decision section) was then prepared for the required second-role human review,
  since the implementing agent cannot also be its own reviewer (ADR-0010). See
  `docs/project-state/dashboard-web-review-and-approval-center-approval-checklist.md`. **Awaiting
  that review** — a gate decision, push/PR, and merge authorization each remain separate,
  not-yet-requested next steps.
- `[2026-08-25]` **Required second-role human review complete for
  `dashboard-web-review-and-approval-center`.** The review packet (code review + security review
  findings, fixes, and validation evidence, with a decision section) was reviewed. **Jitesh D
  reviewed it and returned "Approved,"** no disputes raised — every CONFIRMED and PLAUSIBLE
  code-review finding (9 total) was already fixed in this round, so there was no open item to
  accept as tracked debt. See
  `docs/project-state/dashboard-web-review-and-approval-center-approval-checklist.md`'s "Sign-off"
  section. A gate decision, push/PR, and merge authorization remain separate, not-yet-requested
  next steps.
- `[2026-08-25]` **The gate (G4-dashboard-web-review-and-approval-center) was then separately
  requested and approved** — WebDesk Solution, decision CONFIRM (clean pass, not an override,
  since the second-role review was already complete before the gate was requested), approved
  commit `f5544ef` on branch `dashboard-web-review-and-approval-center` — see
  `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
  `G4-dashboard-web-review-and-approval-center`) and
  `docs/project-state/dashboard-web-review-and-approval-center-approval-checklist.md`'s "Sign-off"
  section. **This gate approval does not itself authorize pushing the branch, opening a PR, or
  merging** — each remains its own separate, not-yet-requested authorization, per this project's
  standing "no auto-merge" rule.
- `[2026-08-25]` **"Push the branch and open a PR" was separately requested and executed** on
  `dashboard-web-review-and-approval-center` — pushed to `origin`, opened as
  [PR #66](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/66). Merge
  authorization remains a separate, not-yet-requested next step.
- `[2026-08-25]` **"Merge PR #66" was separately confirmed and executed.** All 14 CI checks
  confirmed green first. Merged with a real merge commit (not squash/rebase), matching every prior
  merge in this project's history — merge commit
  `1a99ffc640acc9dc836912e2c0a2a37c0144975b`. Both Vercel projects auto-deployed on push to `main`
  and were verified live directly, not just via CI's own Vercel status check — `dashboard-api`'s
  `/health` returned `build.commitSha ==
1a99ffc640acc9dc836912e2c0a2a37c0144975b`, confirming the exact merged commit is what's serving;
  `GET /reviews` returned a clean `401` (route live, `SessionGuard` enforcing — not a `404`, which
  would mean the module never actually deployed); and `dashboard-web`'s new
  `/review-and-approval-center` route correctly redirects (307) an unauthenticated visitor to
  `/auth/sign-in`. **The `dashboard-web` Review and Approval Center UI is now genuinely live in
  production**, closing out this slice's full build-to-production arc — backend and now the full
  UI (inbox list, create form, detail page with decision actions, process actions, and comments)
  are both live for the Review and Approval Center module.
- `[2026-08-27]` **Built the Brand Library module backend** (module #13), under the explicit
  "Start applying the new template to the next module" instruction — the first module built under
  the same-day-recorded "collapse the task-package + implementation-doc pair" and "right-size the
  review pipeline" standing rules. Four design forks confirmed directly with the user first
  (`AskUserQuestion`): single generic table with a `recordType` discriminator, `fileReference` as
  a plain `safeHttpUrlSchema`-validated URL rather than new Blob infrastructure, `deprecated` as a
  status value not a record type, and a real publish/unpublish mechanism mirroring Content
  Template Library's own. **A process incident occurred and was resolved mid-build**: the first
  build attempt silently spawned a background subagent and returned a fabricated-looking
  "in progress" status with zero real file changes — caught via `git status`/`git log` before
  being trusted. A retry then collided with that still-running rogue subagent, both writing the
  same files concurrently with genuinely inconsistent output; the retry agent correctly refused
  to proceed on contested files. The rogue subagent was stopped (`ListAgents`/`TaskStop`), the
  inconsistent untracked files discarded (nothing had been committed), and a single build agent
  relaunched with an explicit no-delegation instruction, which completed cleanly. Full account,
  including every independently re-verified test count, in item 42 above and
  `docs/implementation/module-brand-library.md`.
- `[2026-08-27]` **Independent code review run on `module-brand-library`, high effort — 8-angle
  finder pass, 1-vote self-verification.** 10 candidates kept in the final report (4 CONFIRMED, 6
  PLAUSIBLE). 1 fixed: a manual `error.name === "SequelizeUniqueConstraintError"` check in
  `create()` reintroduced a pattern the shared `isSequelizeUniqueConstraintError()` helper
  (already extracted during Page Inventory's own review) had already replaced. 9 left open, each
  recorded with an explicit reason — two deliberately left unfixed on inspection since a fix
  would either diverge from 8+ sibling modules' identical, already-shipped ordering or risk
  flipping observable error precedence (404 vs. 403); the rest are already-accepted, cross-cutting
  duplication/design patterns present in 2–10+ other modules. See
  `docs/project-state/module-brand-library-approval-checklist.md`'s "Independent code review —
  summary" for the full list.
- `[2026-08-27]` **Security review run on `module-brand-library`, separately from the code
  review.** 0 findings above threshold — confirmed method-level `@RequirePermission` decorators
  throughout, `OriginCheckGuard` on every mutating route, `safeHttpUrlSchema` validation on
  `fileReference`, `escapeLikePattern()` on search, atomic CAS guards on both status and
  publish-state transitions, no cross-module repository export, and correct omission of a
  confidentiality mechanism matching the module registry's seeded `null` value. A review packet
  (published as a Claude artifact, "Brand Library Review Packet" — code review + security review
  findings, fixes, and validation evidence, with a decision section) was then prepared for the
  required second-role human review, since the implementing agent cannot also be its own reviewer
  (ADR-0010). **Jitesh D reviewed it and returned "Approved as-is,"** accepting all 9 open
  findings as tracked debt. See
  `docs/project-state/module-brand-library-approval-checklist.md`'s "Sign-off" section.
- `[2026-08-27]` **The gate (G4-brand-library) was then separately requested and approved** —
  WebDesk Solution, decision CONFIRM (clean pass, not an override, since the second-role review
  was already complete before the gate was requested), approved commit `cfe5cf5` on branch
  `module-brand-library` — see `outputs/webdesk-growth-dashboard/project.json`'s `gates[]`
  (`current_gate` now `G4-brand-library`). **"Push the branch"** was then separately requested and
  executed — pushed to `origin`. **"Open a PR"** was then separately requested and executed —
  opened as [PR #70](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/70),
  all 14 CI checks confirmed green.
- `[2026-08-27]` **"Merge PR #70" was separately requested and executed.** Merged with a real
  merge commit (not squash/rebase), matching every prior merge in this project's history — merge
  commit `8c4d384d7c95e0089309ee7bd23ba1d715a3fe74`, all 14 CI checks green beforehand. Both
  Vercel projects auto-deployed on push to `main` and were verified live directly, not just via
  CI's own Vercel status check — `dashboard-api`'s `/health` returned `build.commitShaShort ==
8c4d384`, confirming the exact merged commit is what's serving; `GET /brand-library/records`
  returned a clean `401` (route live, `SessionGuard` enforcing — not a `404`, which would mean
  the module never actually deployed); and `dashboard-web`'s `/` resolves to `/auth/sign-in` for
  an unauthenticated visitor, confirming the session gate is intact. **The Brand Library module
  backend is now genuinely live in production.** No `dashboard-web` UI exists yet for this
  module — a separate, not-yet-requested next step.
- `[2026-08-31]` **Built the Section and Pattern Library module backend** (module #15), under the
  explicit "start Section & Pattern Library" instruction. The spec gives no field list — three
  design forks confirmed with the user first (`AskUserQuestion`): Component-Library-shaped
  fields, real multi-row version history mirroring Design Token Library, no publish action. See
  item 56 under "Active tasks" for the full account.
- `[2026-08-31]` **Independent code review run on `module-section-and-pattern-library`, high
  effort — 8-angle finder pass.** 7 findings kept after dedup (6 CONFIRMED, 1 PLAUSIBLE); 3 fixed
  (two missing indexes, a triplicated version-row type), 4 left as accepted, tracked debt — each
  confirmed byte-identical to Design Token Library's own already-shipped behavior, not a novel
  deviation.
- `[2026-08-31]` **Security review run on `module-section-and-pattern-library`, separately from
  the code review.** 0 findings above threshold.
- `[2026-08-31]` **Migration numbers renumbered from `00078`/`00079` to `00080`/`00081` on
  explicit request.** Every reference updated; the renumbering independently re-verified against
  a real database. A stale local `dist/` build artifact briefly caused a false failure —
  diagnosed and cleared, not a defect in the migration content.
- `[2026-08-31]` **Required second-role human review complete for
  `module-section-and-pattern-library`.** The review packet (code review + security review
  findings, fixes, and the 4 accepted-debt items, with a decision section) was reviewed. **Jitesh
  D reviewed it and returned "Approved,"** no disputes raised. See
  `docs/project-state/module-section-and-pattern-library-approval-checklist.md`'s "Sign-off"
  section.
- `[2026-08-31]` **The gate (G4-section-and-pattern-library) was then separately requested and
  approved** — WebDesk Solution, decision CONFIRM (clean pass, not an override, since the
  second-role review was already complete before the gate was requested), approved commit
  `570d9a4` on branch `module-section-and-pattern-library` — see
  `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
  `G4-section-and-pattern-library`).
- `[2026-08-31]` **"Push the branch" was separately requested and executed** on
  `module-section-and-pattern-library` — pushed to `origin`.
- `[2026-08-31]` **"Open a PR" was separately requested and executed** — opened as
  [PR #78](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/78). Merge
  authorization remains a separate, not-yet-requested next step.
- `[2026-08-31]` **"Merge PR #78" was separately requested and executed.** A real merge conflict
  surfaced against `main` — Component Library (module #17, PR #79) had merged first, claiming
  migration numbers `00078`/`00079`, exactly the numbers this branch had renumbered away from.
  Only `project.json` conflicted (both branches independently appended gate/audit-log entries);
  resolved by keeping both gate entries and re-sequencing the audit-log version counters, then
  fully re-verified against a real disposable database before completing the merge (81 migrations
  clean, 543/543 `packages/database` integration tests, 1238/1238 `dashboard-api` unit tests,
  541/541 e2e tests, `validate:module-registry` unaffected). Merged with a real merge commit
  `7dc5d24`. Both Vercel projects auto-deployed and were verified live directly — `dashboard-api`'s
  `/health` matched the merge commit; `GET /section-and-pattern-library/records` and
  `GET /component-library/components` both returned clean `401`s. **The Section and Pattern
  Library module backend is now genuinely live in production.**
- `[2026-08-31]` **Built the `dashboard-web` UI for Section and Pattern Library**, under the
  explicit "Start the dashboard-web UI for it" instruction, closing this module's last named gap.
  File-for-file mirrors Design Token Library's own already-reviewed `dashboard-web` UI. See item
  56 (backend) and this entry for the full account:
  `description`/`responsiveBehavior`/`accessibilityNotes` use `RichTextEditor` (backend already
  sanitizes these); `htmlStructure`/`scssReference`/`browserSupport` stay plain monospace
  `<textarea>`s (real code fields, zero backend sanitization); `jsDependencies`/`tokenReferences`/
  `relatedComponentIds` use `TagListField`; `designReference` is a client-validated URL input.
  Four routes. **Reviewed at light tier** (2026-08-27 standing rule) — a direct read-through pass
  verified the field-treatment split against the actual backend source, the `TRANSITIONS` table
  byte-matched target-by-target, the `isCurrent`-from-row version-history pattern, and the
  `isSafeHttpUrl()` guard before rendering `designReference` as a link — **0 findings**. No
  separate security review needed. 1087/1087 `dashboard-web` unit tests (25 new), typecheck/lint/
  CSS-token-check/`next build`/prettier all clean. **Required second-role human review complete**
  — Jitesh D, "Approved," no disputes, via the "gate it and push the branch" instruction; light
  tier, so the approval checklist's own findings table served as the review artifact. **The gate
  (G4-dashboard-web-section-and-pattern-library) was then separately requested and approved** —
  WebDesk Solution, decision CONFIRM, approved commit `c460b05` on branch
  `dashboard-web-section-and-pattern-library` — see
  `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
  `G4-dashboard-web-section-and-pattern-library`) and
  `docs/project-state/dashboard-web-section-and-pattern-library-approval-checklist.md`'s
  "Sign-off" section. **"Push the branch" was then separately requested and executed** — pushed
  to `origin`. **"Open a PR" was then separately requested and executed** — opened as
  [PR #80](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/80). Merge
  authorization remains a separate, not-yet-requested next step.
- `[2026-08-31]` **Built the Page Template Library module backend** (module #19), under the
  explicit "start Page Template Library" instruction. Two design forks confirmed directly with
  the project owner first: real, existence-validated relationships into the already-live Section
  and Pattern Library / Component Library for `requiredSectionIds`/`optionalSectionIds`/
  `supportedComponentIds`, and an unvalidated string array for `wireframeReferences` since
  `wireframe_library` doesn't exist yet (a real co-dependent cycle with this module in the seeded
  module registry). Full account in item 57 above.
- `[2026-08-31]` **Independent code review run on `module-page-template-library`, high effort —
  8-angle finder pass, then 2 of 3 candidates fixed.** Removed an unused, speculatively-added
  `PageTemplateRepository.findByIds()` with zero real callers; added a missing overlap check
  between `requiredSectionIds`/`optionalSectionIds` with 5 new regression tests. 1 candidate
  (the terminal-state-guard ordering in `update()`) left as accepted, tracked debt — inherited
  byte-for-byte from `ComponentsService.update()` across 5 sibling modules.
- `[2026-08-31]` **Security review run on `module-page-template-library`, separately from the
  code review.** 0 findings above threshold. A review packet (published as a Claude artifact,
  "Page Template Library Review Packet") was prepared for the required second-role human review,
  since the implementing agent cannot also be its own reviewer (ADR-0010).
- `[2026-08-31]` **Required second-role human review complete for
  `module-page-template-library`.** The project owner reviewed the packet and returned "Approve
  as-is," accepting the 1 open tracked-debt finding, no disputes raised. See
  `docs/project-state/module-page-template-library-approval-checklist.md`'s "Sign-off" section.
- `[2026-08-31]` **The gate (G4-page-template-library) was then separately requested and
  approved** — WebDesk Solution, decision CONFIRM, approved commit `bd376be` on branch
  `module-page-template-library` — see `outputs/webdesk-growth-dashboard/project.json`'s
  `gates[]` (`current_gate` now `G4-page-template-library`).
- `[2026-08-31]` **"Push the branch" and "Open a PR" were then separately requested and
  executed** — pushed to `origin`, opened as
  [PR #82](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/82), all
  14 CI checks green.
- `[2026-08-31]` **"Merge PR #82" was then separately requested and executed.** Merge commit
  `f467be9ae3811167d40323daeeb97f84a8f6cf46`, all 14 CI checks green beforehand. Both Vercel
  projects auto-deployed on push to `main` and were verified live directly — `dashboard-api`'s
  `/health` returned `build.commitSha ==
f467be9ae3811167d40323daeeb97f84a8f6cf46`, `GET /page-template-library/page-templates` returned a
  clean `401` (route live, `SessionGuard` enforcing — not a `404`), and `dashboard-web`'s `/`
  resolves (via the intermediate `/home` hop) to `/auth/sign-in` for an unauthenticated visitor.
  **The Page Template Library module backend is now genuinely live in production.**
- `[2026-08-31]` **Built the Wireframe Library module backend** (module #16), under the explicit
  "start Wireframe Library" instruction. Real multi-row version history mirroring Section and
  Pattern Library. **Independent code review** (high effort, 8-angle finder pass): 0 findings.
  **Security review**: 0 findings above threshold. See item 58 above for the full account,
  including the concurrent-merge handling with Page Template Library (the other half of the same
  real dependency cycle) and the migration renumbering to `00084`/`00085`.
- `[2026-08-31]` **Required second-role human review complete for `module-wireframe-library`.**
  **Jitesh D reviewed it and returned "Approved,"** no disputes raised — 0 open findings of any
  kind on this branch. See
  `docs/project-state/module-wireframe-library-approval-checklist.md`'s "Sign-off" section.
- `[2026-08-31]` **The gate (G4-wireframe-library) was then separately requested and approved** —
  WebDesk Solution, decision CONFIRM (clean pass, not an override, since the second-role review
  was already complete before the gate was requested), approved commit `ec96265` on branch
  `module-wireframe-library` — see `outputs/webdesk-growth-dashboard/project.json`'s `gates[]`
  (`current_gate` now `G4-wireframe-library`).
- `[2026-08-31]` **"Push the branch" and "Open a PR" were then separately requested and
  executed** — pushed to `origin`, opened as
  [PR #84](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/84).
  Merge authorization remains a separate, not-yet-requested next step.
- `[2026-08-31]` **Built the `dashboard-web` UI for Page Template Library**, under the explicit
  "Start the dashboard-web UI for it Page Template Library" instruction, following the backend's
  own build-to-production arc (PR #82). Mirrored Component Library's UI structure file-for-file
  and converted the 3 narrative fields to `RichTextEditor` with a paired backend sanitization
  change, per the 2026-08-22 standing rule. See item 58 above for the full account.
- `[2026-08-31]` **Independent code review run on `dashboard-web-page-template-library`, then 4 of
  10 kept findings fixed.** High effort, 8-angle finder pass — 10 findings kept in the final
  report (4 CONFIRMED, 6 PLAUSIBLE). Most notable: `arrayField()` extracted into a new
  `arrayFieldValue()` export in `lib/rich-text.ts` (a 2nd byte-identical copy, past this
  codebase's own 2-occurrence extraction threshold), retrofitted onto
  `section-and-pattern-library-form.tsx` too; two inaccurate doc comments corrected (the
  status-actions duplication-count claim, and the `RICH_TEXT_MAX_LENGTH` "10x ratio" rationale);
  and, discovered while verifying that fix, a real, live bug in a DIFFERENT already-merged module
  (Section and Pattern Library's own UI wires `RichTextEditor` but its backend cap was never
  raised to match) was flagged as a separate follow-up task, not fixed here. 6 PLAUSIBLE findings
  left as accepted, tracked debt, each matching an already-established duplication class
  elsewhere in this codebase. Re-validated: 1207/1207 `dashboard-web` unit tests, 1299/1299
  `dashboard-api` unit tests, typecheck/lint/`next build`/prettier all clean.
- `[2026-08-31]` **Security review run on `dashboard-web-page-template-library`, separately from
  the code review.** 0 findings above threshold — confirmed all 3 sanitization write paths have
  no gap, every rich-text render site routes through the shared `SanitizedRichText` component, no
  IDOR, and no SSRF/credential-leakage surface in the picker-fetch functions. A review packet
  (published as a Claude artifact, "Page Template Library UI Review Packet") was prepared for the
  required second-role human review, since the implementing agent cannot also be its own reviewer
  (ADR-0010). See `docs/project-state/dashboard-web-page-template-library-approval-checklist.md`.
- `[2026-08-31]` **"Push the branch and open a PR" was separately requested and executed** on
  `dashboard-web-page-template-library` — pushed to `origin`, opened as
  [PR #83](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/83). All 14
  CI checks confirmed green.
- `[2026-08-31]` **Required second-role human review complete for
  `dashboard-web-page-template-library`.** The review packet was reviewed. **The project owner
  reviewed it and returned "Approved as-is,"** accepting the 6 open PLAUSIBLE findings as tracked
  debt, no disputes raised. See
  `docs/project-state/dashboard-web-page-template-library-approval-checklist.md`'s "Sign-off"
  section.
- `[2026-08-31]` **The gate (G4-dashboard-web-page-template-library) was then separately requested
  and approved** — WebDesk Solution, decision CONFIRM (clean pass, not an override, since the
  second-role review was already complete before the gate was requested), approved commit
  `39e8deb` on branch `dashboard-web-page-template-library` — see
  `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
  `G4-dashboard-web-page-template-library`).
- `[2026-08-31]` **"Merge PR #83" was then separately requested and executed.** Merge commit
  `6c7688c45ba65753e1858b61a06f9bb471340c05`, all 14 CI checks green beforehand. Both Vercel
  projects auto-deployed on push to `main` and were verified live directly — `dashboard-api`'s
  `/health` returned `build.commitSha ==
6c7688c45ba65753e1858b61a06f9bb471340c05`, `GET /page-template-library/page-templates` returned a
  clean `401` (route live, `SessionGuard` enforcing — not a `404`), and `dashboard-web`'s
  `/page-template-library` correctly redirects (307) an unauthenticated visitor to
  `/auth/sign-in`. **The `dashboard-web` Page Template Library UI is now genuinely live in
  production**, closing out this slice's full build-to-production arc — backend and now the full
  UI (list, detail, create/edit form, status actions) are both live for the Page Template Library
  module.
- `[2026-08-31]` **"Merge PR #84" was then separately requested and executed for
  `module-wireframe-library`.** Two rounds of merge conflicts from concurrently-landing sibling
  PRs (`dashboard-web-page-template-library` and its own live-verification doc commit) were
  resolved first — `project.json`'s gate/audit-log entries kept from both sides and
  re-sequenced, and a duplicate `CLAUDE.md` item number (`58`) renumbered to `59` — each re-run
  through all 14 CI checks before merging. Merge commit
  `5abb0f7091f720be1a84dace3a8c9425f209ec63`. Both Vercel projects auto-deployed on push to
  `main` and were verified live directly, not just via CI's own Vercel status check —
  `dashboard-api`'s `/health` returned `build.commitSha ==
5abb0f7091f720be1a84dace3a8c9425f209ec63`, confirming the exact merged commit is what's serving;
  `GET /wireframe-library/records` returned a clean `401` (route live, `SessionGuard`
  enforcing — not a `404`, which would mean the module never actually deployed); and
  `dashboard-web`'s `/` correctly redirects (307) an unauthenticated visitor to `/auth/sign-in`.
  **The Wireframe Library module backend is now genuinely live in production.**
- `[2026-08-31]` **Built the Motion and Interaction Library module backend**, under the explicit
  "start Motion & Interaction Library" instruction. See item 60 under "Active tasks" above for the
  full account — two design forks confirmed with the user first (the field set modeled on §18's
  bare taxonomy, and `relatedComponentIds` as a real existence-validated relationship into
  Component Library rather than an unvalidated array).
- `[2026-08-31]` **Independent code review run on `module-motion-and-interaction-library`, high
  effort — 8-angle finder pass, then the 1 CONFIRMED finding fixed.** 3 candidates survived dedup
  (1 CONFIRMED, 1 PLAUSIBLE, 1 REFUTED). The CONFIRMED finding — the seeded
  `module_registry.dependencies` omitting the real Component Library coupling this build
  introduces — was fixed with an additive migration and the roadmap doc updated to move this
  module from Wave 1 to Wave 2. The PLAUSIBLE finding (the update DTO schema hand-duplicated
  instead of derived via `.omit()`/`.partial()`) was left as accepted, tracked debt — matches 6 of
  8 sibling modules' own convention. The REFUTED finding (an "unused speculative existence-check
  method" claim, raised independently by 3 finder angles) was ruled out on verification: unlike
  Page Template Library's own genuinely-removed dead method, this one mirrors an established,
  already-consumed convention with a real doc-comment rationale and real test coverage.
- `[2026-08-31]` **Security review run on `module-motion-and-interaction-library`, separately from
  the code review.** 0 findings above threshold — confirmed method-level `@RequirePermission`
  throughout, `ComponentsService.existingComponentIds()` exposing only a bare id set, fully
  parameterized queries with `escapeLikePattern()` on search, `safeHttpUrlSchema` reuse for
  `designReference`, static migration SQL, and an explicit field allowlist on every write path.
- `[2026-08-31]` **Migration numbers renumbered from `00084`/`00085`/`00086` to
  `00086`/`00087`/`00088`** — Wireframe Library (module #16) merged to `main` claiming the same
  numbers while this branch was in progress. Merged `main` (no conflicts), renumbered, updated
  every internal reference, and independently re-verified everything against a fresh disposable
  database (1386/1386 `dashboard-api` unit, 620/620 `packages/database` integration, 625/625
  `dashboard-api` e2e/integration tests, an 88-migration round-trip, all clean).
- `[2026-08-31]` **A review packet for the required second-role human review was prepared and
  published** — see
  [Motion and Interaction Library Review Packet](https://claude.ai/code/artifact/6518fdac-e55f-441a-a2aa-3a7e0759c5c0)
  and `docs/project-state/module-motion-and-interaction-library-approval-checklist.md`.
- `[2026-08-31]` **"Push the branch and open a PR" was separately requested and executed** on
  `module-motion-and-interaction-library` — pushed to `origin`, opened as
  [PR #86](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/86). A
  required second-role human review, a gate decision, and merge authorization each remain
  separate, not-yet-requested next steps.
- `[2026-08-31]` **A CI "Formatting validation" failure on PR #86 diagnosed and fixed.** `main`
  had moved forward again mid-review (`dashboard-web` Wireframe Library UI, PR #85) — GitHub's
  `pull_request` checkout tests a synthetic merge of the branch against CURRENT `main`, not the
  branch's own last local merge, so the failure only ever surfaced in CI, never in any local
  prettier run. Merged `main` again for real (no conflicts) and let prettier's ordered-list
  renumbering resolve a duplicate `CLAUDE.md` item number (`60` claimed by both the incoming
  Wireframe Library UI entry and this branch's own Motion and Interaction Library entry, now
  `61`) — the same bug class Wireframe Library's own merge into `main` had already hit once.
  Re-verified independently after the merge: 1386/1386 `dashboard-api` unit, 620/620
  `packages/database` integration, 625/625 `dashboard-api` e2e/integration tests, all clean. All
  14 CI checks on PR #86 now green.
- `[2026-08-31]` **Required second-role human review complete for
  `module-motion-and-interaction-library` (PR #86).** The review packet (code review + security
  review findings, fixes, and the 1 accepted-debt item, with a decision section) was reviewed.
  **Jitesh D reviewed it and returned "Approved,"** no disputes raised. See
  `docs/project-state/module-motion-and-interaction-library-approval-checklist.md`'s "Sign-off"
  section. A gate decision and merge authorization remain separate, not-yet-requested next steps.
- `[2026-08-31]` **The gate (G4-motion-and-interaction-library) was then separately requested and
  approved** — WebDesk Solution, decision CONFIRM (clean pass, not an override, since the
  second-role review was already complete before the gate was requested), approved commit
  `fddbe85` on branch `module-motion-and-interaction-library` — see
  `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
  `G4-motion-and-interaction-library`) and
  `docs/project-state/module-motion-and-interaction-library-approval-checklist.md`'s "Sign-off"
  section. **This gate approval does not itself authorize merging PR #86** — merge remains its
  own separate, not-yet-requested authorization, per this project's standing "no auto-merge"
  rule.
- `[2026-08-31]` **"Merge PR #86" was separately requested and executed.** All 14 CI checks
  confirmed green first. Merged with a real merge commit (not squash/rebase), matching every
  prior merge in this project's history — merge commit
  `b59fba740266236fa1aacef02a95cbe1f9948b7e`. `dashboard-api` auto-deployed on push to `main`
  and was verified live directly, not just via CI's own Vercel status check — `/health` returned
  `build.commitSha ==
b59fba740266236fa1aacef02a95cbe1f9948b7e`, confirming the exact merged commit is what's serving;
  `GET /motion-and-interaction-library/records` returned a clean `401` (route live,
  `SessionGuard` enforcing — not a `404`, which would mean the module never actually deployed);
  and `dashboard-web`'s `/` resolves to `/auth/sign-in` for an unauthenticated visitor. **The
  Motion and Interaction Library module backend is now genuinely live in production.** No
  `dashboard-web` UI exists yet for this module — a separate, not-yet-requested next step,
  matching every prior module's own backend-first precedent.
- `[2026-08-31]` **Built the `dashboard-web` UI for Motion and Interaction Library**, under the
  explicit "Start the dashboard-web UI for it" instruction, closing this module's last named gap.
  File-for-file mirrors Section and Pattern Library's already-reviewed UI structure. See item 62
  above for the full account.
- `[2026-08-31]` **Independent code review run on `dashboard-web-motion-and-interaction-library`,
  then 3 of 4 candidates fixed.** Medium effort, 8-angle finder pass, 1-vote verification — 4
  candidates survived dedup: `MotionInteractionStatusActions` used plain `useState` instead of
  the shared `useSyncedState()` hook every module built after 2026-08-27 adopts (fixed);
  `arrayField()` reimplemented the shared `arrayFieldValue()` helper instead of delegating to it
  (fixed); the detail page's `relatedComponentIds` id-to-name resolution was a 3rd independent
  inline hand-copy of a pattern already present in Component Library's and Page Template
  Library's own detail pages, violating this project's own "extract after the 2nd occurrence"
  convention (fixed by extracting `lib/resolve-ids-to-names.ts`, with the two pre-existing
  sibling occurrences deliberately left untouched as an out-of-scope retrofit); and a 4th
  candidate (a triple-branch `designReference` truthiness check) was refuted as inherited from an
  already-shipped Section and Pattern Library precedent. Re-validated: 1283/1283 `dashboard-web`
  unit tests, typecheck/lint/CSS-token-check/`next build`/prettier all clean.
- `[2026-08-31]` **Security review skipped for
  `dashboard-web-motion-and-interaction-library`, per the 2026-08-27 "right-size the review
  pipeline" standing rule** — asked directly ("is there any need to run the security review?"),
  answered no and explained why (no new backend endpoint, no new sink, only a length-cap raise on
  already-sanitized fields, rich text renders exclusively through the existing, already-audited
  `SanitizedRichText` component) — confirmed by the user ("Skip it").
- `[2026-08-31]` **Required second-role human review complete for
  `dashboard-web-motion-and-interaction-library`, via the direct "gate it and push the branch"
  instruction.** The approval checklist's own findings table served as the review artifact rather
  than a separately published packet, since there were no open findings of any kind on this
  branch after the fix round. See
  `docs/project-state/dashboard-web-motion-and-interaction-library-approval-checklist.md`'s
  "Sign-off" section.
- `[2026-08-31]` **The gate (G4-dashboard-web-motion-and-interaction-library) was then separately
  requested and approved** — WebDesk Solution, decision CONFIRM (clean pass, not an override,
  since the second-role review was already complete before the gate was requested), approved
  commit `4f49b38` on branch `dashboard-web-motion-and-interaction-library` — see
  `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
  `G4-dashboard-web-motion-and-interaction-library`). **This gate approval does not itself
  authorize pushing the branch, opening a PR, or merging** — each remains its own separate,
  not-yet-requested authorization, per this project's standing "no auto-merge" rule.
- `[2026-08-31]` **"Push the branch" and "Open a PR" were separately requested and executed** on
  `dashboard-web-motion-and-interaction-library` — pushed to `origin`, opened as
  [PR #87](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/87). Merge
  authorization remains a separate, not-yet-requested next step.
- `[2026-08-31]` **"Merge PR #87" was separately requested and executed.** All 14 CI checks
  confirmed green first. Merged with a real merge commit (not squash/rebase), matching every
  prior merge in this project's history — merge commit
  `c6d19fe552404169bfb43399d170a38786e93617`. Both Vercel projects auto-deployed on push to
  `main` and were verified live directly, not just via CI's own Vercel status check —
  `dashboard-api`'s `/health` returned `build.commitSha ==
c6d19fe552404169bfb43399d170a38786e93617`, confirming the exact merged commit is what's serving;
  `GET /motion-and-interaction-library/records` returned a clean `401` (route live,
  `SessionGuard` enforcing — not a `404`, which would mean the module never actually deployed);
  and `dashboard-web`'s `/motion-and-interaction-library` correctly redirects (307) an
  unauthenticated visitor to `/auth/sign-in`. **The `dashboard-web` Motion and Interaction
  Library UI is now genuinely live in production**, closing out this slice's full
  build-to-production arc — backend and now the full UI are both live for the Motion and
  Interaction Library module.
- `[2026-08-31]` **Identified the module roadmap's next candidate: `design_review_center`.**
  Checked both roadmap sources directly rather than guessing — the advisory
  `canonical-inputs/Recommended_Module_Roadmap.md` names it order #22, immediately after Motion &
  Interaction Library (#21), and the dependency-computed
  `docs/phase-plans/module-implementation-roadmap.md` places it in Wave 4, depending on
  `component_library`, `design_token_library`, `section_and_pattern_library`,
  `page_template_library`, `wireframe_library`, and `motion_and_interaction_library` — every one
  of which is now genuinely live in production, closing Design Review Center out as the last
  unbuilt member of Wave 4. Not started or authorized — recorded for reference, a separate
  next-step decision remains the user's to make.
- `[2026-09-01]` **Built the `dashboard-web` UI for Case Study Library**, closing this module's
  last named gap, under the explicit "Start the dashboard-web UI for it" instruction following the
  backend's own build-to-production arc (PR #92). See item 65 above for the full account —
  `relatedPageIds` as a UUID-checked `TagListField` (no org-wide page picker exists yet), a novel
  array-of-objects `testimonials` editor, and a status-filtered case-study picker on create.
- `[2026-09-01]` **Reviewed at light tier, per the standing "right-size the review pipeline"
  rule** — asked directly whether the full 8-angle pipeline was needed; explained why this
  frontend-only slice on an already-gated backend qualifies for light tier instead. A direct
  read-through pass found and fixed 1 issue (a duplicated UUID-regex literal, plus a testimonial-
  row layout correction). See
  `docs/project-state/dashboard-web-case-study-library-approval-checklist.md`.
- `[2026-09-01]` **Required second-role human review and the gate were both completed via the
  direct "gate it and push the branch" instruction.** Gate `G4-dashboard-web-case-study-library`
  approved (WebDesk Solution, CONFIRM), approved commit `9ea2afe` — see
  `outputs/webdesk-growth-dashboard/project.json`'s `gates[]`. Branch pushed to `origin`.
- `[2026-09-01]` **"Open a PR" was separately requested and executed** — opened as
  [PR #93](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/93). An
  Autofix CI-monitor event flagged a failing "Integration tests" check; investigated and confirmed
  unrelated to this PR's diff (dashboard-web/shared-types only, no backend/migration code) — a
  teardown-hook timeout in an unrelated spec (`notifications.e2e-spec.ts`) cascading into a
  migration-teardown error. Re-ran the job rather than changing code; it passed on retry,
  confirming the diagnosis. All 14 CI checks green.
- `[2026-09-01]` **"Merge PR #93" was separately requested and executed.** Merged with a real
  merge commit (not squash/rebase), matching every prior merge in this project's history — merge
  commit `725d3ecededab98af47151f7e778bfe59da781ea`. Both Vercel projects auto-deployed on push to
  `main` and were verified live directly, not just via CI's own Vercel status check —
  `dashboard-api`'s `/health` returned `build.commitSha ==
725d3ecededab98af47151f7e778bfe59da781ea`, confirming the exact merged commit is what's serving;
  `dashboard-web`'s `/case-study-library`, `/case-study-library/new`, and a detail route all
  correctly redirect (307) an unauthenticated visitor to `/auth/sign-in` (a transient
  stale-edge-cache `404` on the bare list route's first two checks was ruled out via a repeated
  check showing `x-vercel-cache: MISS`, not a real defect). **The `dashboard-web` Case Study
  Library UI is now genuinely live in production**, closing out this slice's full
  build-to-production arc.
- `[2026-09-01]` **Built the Knowledge Library module backend** (module #28), under the explicit
  "Start Knowledge Library module" instruction. Two design forks confirmed directly with the user
  first: a real `public/internal/restricted` confidentiality enum (Service Library's own pattern)
  and a single generic table (Business Knowledge Center's own precedent, same RBAC group). See item
  66 above and `docs/implementation/module-knowledge-library.md` for the full account.
- `[2026-09-01]` **Independent code review run on `module-knowledge-library`, then 4 of 6 confirmed
  findings fixed.** High effort, 8-angle finder pass — 6 kept findings, all CONFIRMED. Most severe:
  `update()` had no terminal-state guard, letting a caller with only `edit` freely mutate a
  `deprecated` record — fixed. Also fixed: `sourceType` omitted from confidential redaction, a
  missing `updated_at` index, and a dead `pg_trgm` trigram index with no consuming search param
  (added a `search` filter). 2 findings left as accepted, tracked debt, verified byte-identical to
  Business Knowledge Center's own already-shipped shape.
- `[2026-09-01]` **Security review run on `module-knowledge-library`, separately from the code
  review.** 0 findings above threshold — confirmed correct redaction wiring on all 5 routes, RBAC
  decorator placement, parameterized queries, and correct `escapeLikePattern()` usage on the new
  `search` filter.
- `[2026-09-01]` **Required second-role human review complete for `module-knowledge-library`, via
  the direct "gate it and push the branch" instruction** — the approval checklist's own findings
  table served as the review artifact. **The gate (G4-knowledge-library) was then approved** —
  WebDesk Solution, decision CONFIRM, approved commit `3274c60` on branch
  `module-knowledge-library` — see `outputs/webdesk-growth-dashboard/project.json`'s `gates[]`
  (`current_gate` now `G4-knowledge-library`). **"Push the branch" was then separately requested
  and executed** — pushed to `origin`. This gate approval does not itself authorize opening a PR or
  merging.
- `[2026-09-01]` **Built the `dashboard-web` UI for Portfolio Library**, under the explicit "Start
  the dashboard-web UI for it" instruction, closing this module's last named gap following the
  backend's own build-to-production arc (PR #94, item 66). Mirrors Design Reference Library's UI
  structure plus Case Study Studio's `case_study_assets` sub-resource pattern for the new
  `PortfolioScreenshotsSection`. No long-text/rich-text fields exist on this module's schema at
  all, so no `RichTextEditor` wiring was needed. New `packages/shared-types`:
  `PortfolioRecord`/`PortfolioAsset`/`PortfolioApprovalStatus`/`PortfolioVisibility`. Committed to
  branch `dashboard-web-portfolio-library`.
- `[2026-09-01]` **Independent code review run on `dashboard-web-portfolio-library`** (this
  project's own `code-review` skill, medium effort, 8-angle finder pass via parallel subagents).
  Several finder agents lacked real tool access in this run and returned speculative, unconfirmed
  hypotheses rather than line-verified findings — disclosed explicitly by those agents themselves;
  every candidate from every angle was independently re-verified directly against the real
  committed code before being trusted, not taken on faith. 4 candidates survived verification: 2
  fixed (the detail page's `record.url` link had no client-side `isSafeHttpUrl()` guard and used
  `rel="noreferrer"` instead of `"noopener noreferrer"`, both real deviations from every sibling
  detail page that renders a stored URL), 2 left as accepted, inherited debt verified
  byte-identical to already-shipped sibling code (`getPortfolioDetail()`'s `tolerateDiscard()` not
  actually isolating the screenshots sub-fetch, and a dead `response.status !== 204` clause in the
  screenshot-remove handler). No separate security-review skill run — a small, frontend-only slice
  consuming an already-reviewed, already-gated backend, matching the 2026-08-27 "right-size the
  review pipeline" standing rule. 265/265 `dashboard-web` unit tests (71 new), typecheck/lint/
  CSS-token-check/`next build`/prettier all clean, independently re-run after the fix round.
- `[2026-09-01]` **"Push the branch and open a PR" was separately requested and executed** on
  `dashboard-web-portfolio-library` — pushed to `origin`, opened as
  [PR #95](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/95).
  **"Check CI status on the PR" was then separately requested** — all 14 checks confirmed green
  (`gh pr checks 95`), including both Vercel preview deployments. **Unlike every prior module this
  session, no explicit second-role human review or gate decision was separately requested before
  merge** — these three instructions were given in immediate succession, with the code review
  above as the only review step actually run.
- `[2026-09-01]` **"Merge PR #95" was separately requested and executed.** Merged with a real merge
  commit (not squash/rebase), matching every prior merge in this project's history — merge commit
  `985158c7c9c98d48478b3a030618f1f4eec7b3b5`. A concurrent PR (#96, Knowledge Library) landed on
  `main` immediately afterward; both Vercel projects auto-deployed on the combined push and were
  verified live directly, not just via CI's own Vercel status check — `dashboard-api`'s `/health`
  confirmed `985158c` is a real ancestor of the currently-serving commit (`b406718`, PR #96's own
  merge, confirmed via `git merge-base --is-ancestor`); `GET /portfolio-library/records` returned a
  clean `401` (route live, `SessionGuard` enforcing — not a `404`, which would mean the module
  never actually deployed); and `dashboard-web`'s `/portfolio-library` correctly redirects (307) an
  unauthenticated visitor to `/auth/sign-in`. **The `dashboard-web` Portfolio Library UI is now
  genuinely live in production**, closing out this slice's full build-to-production arc — backend
  and now the full UI (list, detail, create/edit form, status actions, publish/unpublish actions,
  screenshots sub-resource editing) are both live for the Portfolio Library module.
- `[2026-09-01]` **Built the `dashboard-web` UI for Knowledge Library**, under the explicit "Start
  the dashboard-web UI for it" instruction, closing this module's last named gap. Full account in
  item 69 above. Mirrors Business Knowledge Center's/Persona Library's UI structure file-for-file;
  `notes` converted to `RichTextEditor` per the 2026-08-22 standing rule with a paired backend
  sanitization change (DTO cap 10,000 → 20,000). Committed to branch
  `dashboard-web-knowledge-library`.
- `[2026-09-01]` **Reviewed at light tier, per the 2026-08-27 "right-size the review pipeline"
  standing rule** — a small, frontend-only UI slice consuming an already-reviewed, already-gated
  backend. A direct read-through pass found and fixed 1 issue (the list page's `search` clamping
  logic, corrected to match the Persona/Service Library convention). Security review skipped per
  the same standing rule — no new endpoint, no new sink. 1571/1571 `dashboard-api` unit tests
  (3 new), 1540/1540 `dashboard-web` unit tests (37 new), clean typecheck/lint/`next build`/
  prettier/CSS-token-check.
- `[2026-09-01]` **Required second-role human review complete for
  `dashboard-web-knowledge-library`, via the direct "gate it and push the branch" instruction** —
  the approval checklist's own findings table served as the review artifact. **The gate
  (G4-dashboard-web-knowledge-library) was then approved** — WebDesk Solution, decision CONFIRM,
  approved commit `11939b9` on branch `dashboard-web-knowledge-library` — see
  `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
  `G4-dashboard-web-knowledge-library`). **"Push the branch" was then separately requested and
  executed** — pushed to `origin`. This gate approval does not itself authorize opening a PR or
  merging.

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
- **No real Vercel Blob store is provisioned for `webdesk-growth-dashboard-7v1u`** —
  `BLOB_READ_WRITE_TOKEN` doesn't exist among that project's env vars, and its Storage tab shows
  only the Neon database connected. This was already flagged as a known gap when the Business
  Knowledge Center attachments feature was first built (PR #45, "no Vercel Blob store is
  provisioned anywhere in this environment or in production yet"), but never closed. It surfaced
  as a real, confirmed production `500` on `POST .../attachments/upload-route` on 2026-08-21 (the
  first real attempt at a file upload in production, via the new create-form feature) —
  `handleUpload()` requires that static token per its own docs ("OIDC tokens are not sufficient
  for `handleUpload`") and throws without it, masked by the same generic pino-http logging gap
  this project has hit before. Not a code bug — `VercelBlobAdapter`/the create-form feature both
  work correctly; this is purely a missing infrastructure step. **User has deferred provisioning
  to later** ("right now move ahead will setup it later and check") — no file upload (from either
  the create form or the existing detail-page control) will succeed in production until a real
  Blob store is connected and `dashboard-api` is redeployed. Fix, once ready: Storage → Create
  Database → Blob (or Connect Store) on the `webdesk-growth-dashboard-7v1u` project, which should
  add `BLOB_READ_WRITE_TOKEN` automatically; `dashboard-web` needs no change (its upload-route
  proxy never imports `@vercel/blob` directly).
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

- **Standing rule, effective 2026-08-22: every long-text field in `dashboard-web` must use the
  existing `RichTextEditor` (Tiptap) component — never a plain `<textarea>`.** Given directly by
  the user right after the Persona Library UI shipped with 8 plain-textarea fields (a deliberate
  scope decision at the time, since Persona Library was explicitly excluded from the
  `rich-text-editor-long-fields.md` rollout — its backend DTO stored those fields as unsanitized
  plain text). This rule is forward-looking, not retroactive — Persona Library's own existing
  fields were not converted by this instruction; converting them would be its own separate,
  explicit authorization. Any NEW long-text field from this point forward: (1) uses
  `RichTextEditor` on the frontend, matching `ServiceLibraryForm`/`ProjectForm`'s established
  pattern; (2) needs a real backend change too, not just a frontend swap — write-time
  sanitization via `sanitizeNullableRichText()`/`sanitizeNullableRichTextIfChanged()`
  (`@webdesk/validation`) and render-time sanitization via the shared `SanitizedRichText`
  component, mirroring exactly what the original rollout did for Service Library/Projects. Flag
  this backend dependency explicitly when scoping any new long-text field — don't treat it as a
  frontend-only change.
- **Standing feedback, 2026-08-22: reduce the volume of independent-code-review findings by
  writing more carefully up front, not just relying on the review to catch issues.** The user
  raised direct concern that recent slices (e.g. the Persona Library UI, 8/8 CONFIRMED findings)
  keep surfacing 8-10 findings each. A real pattern in what gets found: (1) duplication/reuse
  misses — copy-adapting a sibling module's file without first checking whether a shared
  constant/style/table already exists or should be extracted; (2) consistency gaps against an
  established sibling convention (narrow relationship-picker types, a fallback-on-missing-id
  pattern) that a full read of the closest sibling implementation would have caught; (3)
  failure-isolation gaps on a new enrichment fetch added inside a `Promise.all` with no thought
  given to whether its own failure should take down the whole page. Before building a new
  module/page that mirrors an existing one, read the sibling's FULL implementation (not a skim)
  and proactively apply the same reuse/consistency/failure-isolation reasoning it already
  encodes, rather than mechanically copying structure and letting review catch the gaps
  afterward. This does not mean skip the review process — it stays in place; the ask is to
  reduce how much it has to find, not to remove it.
- **Standing rule, effective 2026-08-27: right-size the review pipeline to the change's actual
  risk, instead of running the full pipeline on everything.** Given directly by the user after
  this project's own review discipline had settled into one fixed shape (independent code review
  at high effort — 8 parallel finder angles — + a separate `security-review` skill run + a
  published review-packet artifact for the required second-role human review) regardless of how
  small or low-risk the change actually was.
  - **Full pipeline** (8-angle code review + a separate security-review run + a published review
    packet): reserve for genuinely risky changes — new or changed authentication/session logic,
    RBAC/permission/authorization changes, and anything opening a new attack surface (a new
    endpoint class, new user input reaching a new sink, a new external integration, a new
    HTML-storage/rendering surface). When a change's risk is genuinely ambiguous, default to the
    full pipeline rather than guessing light — this project's own security-review history shows
    real findings surface even on changes that looked safe going in.
  - **Light, single-pass review**: use for small UI slices (a form, a status-actions component, a
    list/detail page reusing an already-reviewed backend), docs-only changes (like this rule
    itself), and fix-rounds that only apply already-identified findings. A single direct read-
    through pass (still catching real bugs and reuse/consistency gaps) replaces the 8-parallel-
    finder-angle fan-out, and a separate `security-review` skill run is skipped unless the change
    turns out to touch something security-relevant after all. The required second-role human
    review and gate decision (ADR-0010) still apply regardless of tier — this rule is about how
    much automated review depth precedes that human review, not about skipping the human sign-off
    itself; for a light-tier change, a plain summary in the approval checklist doc is enough,
    without necessarily publishing a separate artifact packet.
  - This is a review-process rule, not a security-standards rule — nothing about which findings
    count as real or how they're verified changes; only how much automated scanning runs before a
    human looks at the result.
- **Standing rule, effective 2026-08-27: collapse the task-package + implementation-doc pair into
  one file per module, going forward.** Every module built in this project so far produced up to
  5 separate documents narrating largely the same thing in fresh prose each time: a task package
  (pre-build scope/design), an implementation doc (as-built record), an approval checklist
  (review/gate sign-off), a review-packet artifact (for the second-role reviewer), and a
  `CLAUDE.md` entry (session-context summary). Given directly by the user as real, unnecessary
  duplication — not retroactive, existing `docs/task-packages/*.md`/`docs/implementation/*.md`
  pairs stay as they are; this only changes how a NEW module's documentation is authored:
  - **One file, two passes**: `docs/implementation/<slug>.md`. Before any code is written, author
    a `## Scope` section at the top — the same content a task package used to hold (design
    decisions, forks confirmed with the project owner, what's explicitly out of scope). Once the
    module is built, append the as-built sections below it (what's built, verification status,
    code-review findings, security-review findings) — the same content the implementation doc
    already held. `docs/task-packages/*.md` is retired as a separate pre-existing file for any
    new module.
  - **Approval checklist** (`docs/project-state/*-approval-checklist.md`) stays a separate file,
    unchanged — it's the compact, table-based sign-off record `project.json`'s `gates[]`/
    `audit_log` point to, genuinely distinct from the narrative doc, not duplicative enough to be
    worth merging.
  - **Review packet** (published Claude artifact): only for full-pipeline (risky) changes, per the
    review-pipeline right-sizing rule above. For a light-tier change, the approval checklist's own
    findings table is what the second-role reviewer reads — no separate artifact.
  - **`CLAUDE.md`'s own "Active tasks"/"Recent decisions" entries**: link to the relevant section
    of the implementation doc rather than restating its narrative — a pointer plus the one or two
    facts that matter for session context (what's live, what gate passed, what's still open), not
    a second retelling of the design decisions.
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
- Before adding any npm dependency that `dashboard-api` will actually import at runtime (directly
  or transitively through a workspace package), check whether that dependency — or one of ITS OWN
  dependencies — is ESM-only (`"type": "module"` with no `require` export condition, no real
  `dist/commonjs` output). `require()`ing an ESM module throws `ERR_REQUIRE_ESM` under Vercel's
  Node Function runtime specifically, and this is invisible to every local/CI check (plain Node,
  not Vercel's Function bundler + runtime). This caused a full `dashboard-api` production outage
  on 2026-08-20 (~11 minutes, PR #45's merge): `sanitize-html@2.17.7` — still the latest release —
  requires `htmlparser2@^12.0.0`, which dropped its CommonJS build entirely as of `11.0.0`; the
  bug was latent from this branch's very first commit but only surfaced once actually deployed,
  since this was the project's first-ever production use of `sanitize-html`. Fixed with a
  `pnpm-workspace.yaml` override pinning `htmlparser2` to a still-CJS-compatible version
  (`>=10.1.0 <11.0.0`) — see `docs/implementation/business-knowledge-center-rich-content-attachments.md`
  §11 for the full incident account, and the override's own comment in `pnpm-workspace.yaml` for
  why 10.1.0 specifically is safe for this project's actual usage. This is the third distinct
  variety of ESM-interop gap this project has hit (after `openid-client` and `pg`'s
  `dialectModule`) — always diagnosable only from real Vercel runtime logs, never from a local or
  CI run.
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

**This footer narrative stops at 2026-08-16** — everything from the Project Detail page (2026-08-16)
through the Dashboard UI Foundation Alignment build (2026-08-17) is recorded in "Recent decisions"
and "Active tasks" above (items 10–17), which are kept current every session; this block is not
rewritten at the same cadence. As of 2026-08-17: the Projects module (backend, header switcher,
list/detail pages, create/edit form, status/archive actions, user-lookup + owner assignment,
backend close-out) is fully live in production; the Dashboard UI/UX design system is approved and
merged to `main`; and the Dashboard UI Foundation Alignment implementation (tokens, ~30 new
`packages/ui` components, application-shell navigation/header alignment, auth-page re-skin, and a
new authenticated-shell accessibility test path that caught and fixed 3 real pre-existing WCAG AA
contrast bugs) is built, fully validated, and pushed as its own PR — not yet reviewed, gated, or
merged. See item 17 under "Active tasks" for the full account. **Update (2026-08-18): the Dashboard
UI Foundation Alignment PR (#33) has since gone through independent code review (8/8 CONFIRMED
findings fixed), a security review (0 findings above threshold), the required second-role human
review (Jitesh D, "Approved as-is"), the gate (G4-dashboard-ui-foundation-alignment, WebDesk
Solution, CONFIRM), and "Merge PR #33" — it is now genuinely live in production. See the 2026-08-18
"Recent decisions" entries for the full account.**
