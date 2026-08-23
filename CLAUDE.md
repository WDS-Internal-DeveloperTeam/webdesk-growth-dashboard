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
39. **`dashboard-web` Proof and Claims Library UI — built, independently code-reviewed (6 of 8
    findings fixed, 2 accepted as tracked debt), security-reviewed (0 findings above threshold),
    pushed and opened as
    [PR #54](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/54), all
    14 CI checks green, and required second-role human reviewed — Jitesh D, "Approved", accepting
    the 2 open findings as tracked debt (2026-08-23).**
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
      `docs/project-state/dashboard-web-proof-and-claims-library-approval-checklist.md`. **Awaiting
      that review** — a gate decision, push/PR, and merge authorization each remain separate,
      not-yet-requested next steps.

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
- `[2026-08-16]` **Built the `dashboard-web` Project Detail page** (`/projects/:projectId`), under
  the explicit "build the project detail page UI" instruction. No approved wireframe exists; the
  only prior description is `module-projects-foundation.md` §8's own unapproved proposal (header +
  Overview/Team/Environments/Repositories/Roadmap tabs), explicitly flagged as "not sourced...
  should be confirmed or corrected." Built the same content grouping as sections rather than
  client-side tabs — a deliberate simplification keeping the page fully server-rendered, zero
  client JS, consistent with every other page in this app. `packages/shared-types` gained
  `ProjectDetail` (extends `Project` with `activePhaseId`/`ownerUserId` — legitimate here, unlike
  the list page's `Project`, since the detail page also fetches the project's own roadmap items in
  the same pass, so `activePhaseId` resolves to a real name by cross-reference, no fabrication),
  `RoadmapItem`, `ProjectObjective`, `ProjectEnvironment`, `ProjectRepository`, and
  `ProjectTeamEntry` (carries only `id` — used solely for a real, non-fabricated headcount, never
  an identity, since no user-lookup endpoint exists yet). `lib/projects.ts` gained
  `getProjectDetail()` — fetches `GET /projects/:projectId` first and gates on it (returns `null`
  specifically on a 404 for the page to call `notFound()`; throws on any other non-OK status, e.g.
  403/5xx, since none of the five sub-resource list endpoints themselves validate the parent
  project's existence — a bogus `projectId` returns an empty array, not a 404, so the primary fetch
  is the only way to detect a genuinely missing project) — then fans out to
  `roadmap-items`/`objectives`/`environments`/`repositories`/`team` in parallel once the project is
  confirmed to exist. Also promoted `formatTimestamp()` out of the list page's own file into the
  shared `lib/projects.ts` (both pages now use the identical one) and added
  `roadmapItemStatusBadge()`/`objectiveStatusBadge()`, following `projectStatusBadge()`'s own
  pattern (`active`/`complete` roadmap-item statuses deliberately share the `healthy` token — both
  are non-problem states, disambiguated by label text, not color, since the token palette has no
  distinct "success" concept). The list page's rows now link to `/projects/{id}` — a necessary,
  minimal follow-on now that a destination exists (previously plain, unlinked text). Deliberately
  not built: the header's proposed pause/archive/edit actions (matching the list page's own
  no-mutation-UI precedent) and any team-member identity list (same no-user-lookup constraint
  already shaping the list page's "owner" column omission). Full validation: 24/24
  `dashboard-web` unit tests (10 new), 11/11 Playwright tests (1 new — an unauthenticated visit to
  a detail URL redirects to sign-in), typecheck (after rebuilding `packages/shared-types`, whose
  compiled `dist/` is what `dashboard-web` actually resolves against)/lint/`next build` all clean,
  and a live dev-server check confirmed zero server-side or console errors on the unauthenticated
  redirect path. See `docs/implementation/dashboard-web-project-detail.md` for the full as-built
  record. **Not yet reviewed or merged** — pushed as its own branch
  (`dashboard-web-project-detail`); code review, security review, second-role human review, a gate
  decision, and merge authorization are each their own separate, not-yet-requested next step,
  unchanged from this project's standing discipline.
- `[2026-08-16]` **Independent code review run on `dashboard-web-project-detail` (PR #27), medium
  effort — a single new read-only detail page + lib helpers + new shared types, no new mutation
  surface (reuses the already-reviewed, already-gated `GET /projects/:projectId` and its
  sub-resource endpoints).** 7 findings surfaced (4 CONFIRMED, 3 PLAUSIBLE). All 4 CONFIRMED fixed
  (commit pending): (1) a malformed `projectId` in the URL produced a raw 500 instead of a clean
  404 — this page is the first place in the app where an arbitrary URL segment reaches
  `GET /projects/:projectId` with no format validation anywhere in `dashboard-api`'s stack — fixed
  with a `UUID_PATTERN` check in `getProjectDetail()` that rejects a malformed ID as "not found"
  before any network call; (2) the 5 sub-resource fetches waited on the primary project fetch even
  though they have no genuine data dependency on it, adding an unnecessary sequential round trip to
  every normal page view — fixed by firing all 6 requests concurrently, with a `tolerateDiscard()`
  helper to keep an abandoned sub-resource promise's rejection (on the 404 path) from surfacing as
  an unhandled-rejection warning; (3) the list page's own doc comment claimed "no links to a
  project-detail page that doesn't exist yet," which this same PR makes false — reworded; (4) the
  monospace font stack was hardcoded three times (twice new, once pre-existing in the list page)
  instead of using `typographyTokens.fontFamilyMono` from `@webdesk/ui`, already the pattern
  `packages/ui`'s own components follow — all three call sites now use the shared token. The 3
  PLAUSIBLE findings were left as tracked, non-blocking debt: the roadmap-item/objective status
  badge lookups have no fallback for an enum value outside the current union (an existing risk
  shape from `projectStatusBadge`, extended here, only reachable via a genuine deploy-skew window);
  the new `ProjectRepository` shared type collides in name with the pre-existing `ProjectRepository`
  DAO class in `@webdesk/database` (no active conflict today); and the five empty-state messages
  don't reuse the shared `EmptyState` component (a defensible call given that component's heavier,
  page-replacing visual weight). Regression tests updated: a new test asserts a malformed
  `projectId` never calls `fetch`; the 404 test now expects 6 concurrent fetch calls instead of 1;
  all `getProjectDetail()` tests switched from placeholder ID strings to real UUID-shaped fixtures.
  Full re-validation: typecheck/lint/`next build` clean, 41/41 `dashboard-web` unit tests (1 new),
  11/11 Playwright tests. See `docs/implementation/dashboard-web-project-detail.md`'s "3b. Code
  review" section for the full account. Security review, second-role human review, a gate decision,
  and merge authorization remain separate, not-yet-requested next steps.
- `[2026-08-16]` **Security review run on `dashboard-web-project-detail` (PR #27), separately from
  the code review.** 1 finding surfaced and confirmed at 9/10 confidence: the Environments section
  rendered each environment's stored `url` directly as a clickable `<a href>` with no scheme
  check. The backend's only validation, `z.string().url()` in
  `apps/dashboard-api/src/projects/projects.dto.ts`, confirms a value parses as _some_ URL but
  doesn't restrict scheme — a `javascript:` URL passes and is persisted unsanitized. This page is
  the first place in the codebase that renders this stored field as a link, turning previously-
  inert data into an executable sink; per the seeded RBAC matrix, `owner_growth_approver` (not the
  most trusted role) holds `project_configuration:edit` while five other roles are view-only,
  giving a genuine cross-privilege attack path — a lower/differently-trusted writer plants a
  payload a different viewer later clicks, executing in the viewer's own authenticated session.
  Fixed with a new `isSafeHttpUrl()` guard in `apps/dashboard-web/lib/projects.ts`: a stored URL
  now renders as a clickable link only if its parsed protocol is `http:`/`https:`; anything else
  renders as inert text. This closes the vulnerability at its actual sink regardless of what the
  backend already allows. The backend schema itself (`z.string().url()` accepting any scheme) is a
  separate, real hardening opportunity, but tightening it means editing the already-reviewed-and-
  merged Projects module backend — out of scope for a `dashboard-web` branch, so it was flagged as
  a standalone follow-up task rather than folded into this PR. 3 new regression tests for
  `isSafeHttpUrl()`. Full re-validation: typecheck/lint/`next build` clean, 44/44 `dashboard-web`
  unit tests (3 new), 11/11 Playwright tests. See
  `docs/implementation/dashboard-web-project-detail.md`'s "3c. Security review" section for the
  full account. Second-role human review, a gate decision, and merge authorization remain
  separate, not-yet-requested next steps.
- `[2026-08-16]` **Required second-role human review complete for `dashboard-web-project-detail`
  (PR #27).** A review packet (published as a Claude artifact — code review + security review
  findings, fixes, and validation evidence) was prepared for the required second-role human
  review, since the implementing agent cannot also be its own reviewer (ADR-0010). **Jitesh D
  reviewed it and returned "Approved."** See
  `docs/project-state/dashboard-web-project-detail-approval-checklist.md`'s "Sign-off" section. A
  gate decision and merge authorization remain separate, not-yet-requested next steps.
- `[2026-08-16]` **The gate (G4-project-detail) was then separately requested and approved** —
  WebDesk Solution, decision CONFIRM (clean pass, not an override, since the second-role review was
  already complete before the gate was requested), approved commit
  `9203bb95cc7b8bdedc2393e501f7c900c5343209` on branch `dashboard-web-project-detail` — recorded in
  `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
  `G4-project-detail`) and
  `docs/project-state/dashboard-web-project-detail-approval-checklist.md`'s "Sign-off" section.
  **This gate approval does not itself authorize merging PR #27 or a production deployment** —
  merge remains its own separate, not-yet-requested authorization, per this project's standing
  "no auto-merge" rule (same pattern as every prior gate).
- `[2026-08-16]` **"Merge PR #27" was separately requested and executed.** Merged with a real merge
  commit (not squash/rebase), matching every prior merge in this project's history — merge commit
  `af23ba1c0172c834d2d1311666a2811397598b14`. Both Vercel projects auto-deployed on push to `main`
  and were verified live directly, not just via CI's own Vercel status check —
  `dashboard-api`'s `/health` returned `build.commitSha ==
af23ba1c0172c834d2d1311666a2811397598b14`, confirming the exact merged commit is what's serving;
  `dashboard-web`'s `/` resolves to `/auth/sign-in` for an unauthenticated visitor, confirming the
  session gate is intact. **The `dashboard-web` Project Detail page is now genuinely live in
  production**, closing out this slice's full build-to-production arc. Backend, header switcher,
  list page, and now the detail page are all live for the Projects module — no create/edit form or
  pause/archive/edit actions exist yet, both separate, not-yet-requested next steps.
- `[2026-08-16]` **Built the `dashboard-web` Create/Edit Project form** (`/projects/new`,
  `/projects/:id/edit`), under the explicit "build the create/edit project form" instruction — the
  first real mutation UI in `dashboard-web`. Scoped to `module-projects-foundation.md` §8's own
  unapproved proposal (name/description; status handled by a separate action) plus
  `confidentiality`; `publicId` create-only and read-only on edit; `ownerUserId` deliberately
  omitted (no user-lookup capability exists). Submits via a direct browser `fetch()` with
  `credentials: "include"`, following the `app/auth/emergency/page.tsx` precedent so
  `OriginCheckGuard` is satisfied. Pushed as branch `dashboard-web-project-form`, opened as
  [PR #28](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/28). See
  `docs/implementation/dashboard-web-project-form.md`.
- `[2026-08-17]` **Independent code review run on `dashboard-web-project-form` (PR #28), medium
  effort — 8-angle finder pass.** 7 findings surfaced, all CONFIRMED. Most severe: the session
  cookie's `SameSite=Strict` setting meant the browser would never attach it to this form's
  cross-site `fetch()` — `dashboard-web` and `dashboard-api` are separate `*.vercel.app`
  deployments, isolated as distinct "sites" since `vercel.app` is on the Public Suffix List, so
  every real form submission would have 401'd in production. The other 6: a generic "Validation
  failed" message hid real per-field detail the backend had already computed but
  `AllExceptionsFilter` silently stripped before it reached the client; editing any field while
  leaving a stored empty-string description untouched silently overwrote it to `null`; the new
  `lib/project-confidentiality.ts`'s own doc comment claimed the detail page had been migrated to
  use it, but the detail page still kept its own separate, unmigrated copy; the edit page fetched 5
  unrelated sub-resource lists via `getProjectDetail()` just to populate a 4-field form; three
  independently-defined "primary action button" styles had already drifted from each other in
  font-weight and padding; and the form showed the backend's raw `HttpException.message` verbatim
  for any error, not just the two cases it was designed for. All 7 fixed: `AllExceptionsFilter` now
  surfaces Zod's `issues` array (a new optional field on `ApiErrorResponse`); the form no longer
  coerces an empty description to `null`; the detail page now actually imports the shared
  confidentiality-label file; a new lightweight `getProject()` fetches only the primary resource for
  the edit page; the three button styles were consolidated into one shared, token-derived
  `lib/action-link-style.ts`; a new `lib/api-errors.ts` allowlists which backend error codes may be
  shown verbatim (`BadRequestException`/`NotFoundException` only, everything else falls back to a
  generic message). The `SameSite` fix was held back from the rest — changing a production
  session-cookie security setting is outside what this session can apply unilaterally — and
  surfaced directly instead. **Asked directly how to proceed; the user chose to apply the
  recommended fix** (`SameSite=None`, keeping `Secure`, since `OriginCheckGuard` — verified applied
  to every mutating route across the entire API — is already the real CSRF defense, not
  `SameSite`), matching the existing OIDC transaction cookie's own precedent of choosing `SameSite`
  by actual traffic pattern rather than defaulting to the strictest option. Full re-validation
  after both fix rounds: 57/57 `dashboard-web` unit tests, 317/317 `dashboard-api` unit tests,
  13/13 e2e tests, typecheck/lint/build clean on both apps, all 14 CI checks green.
- `[2026-08-17]` **Security review run on `dashboard-web-project-form` (PR #28), separately from the
  code review.** 0 findings above threshold. The two security-relevant changes from the fix round —
  the `SameSite=None` cookie change and the new `lib/api-errors.ts` error-message allowlist — were
  both scrutinized directly: confirmed every mutating route across the API carries `OriginCheckGuard`
  (fails closed on a missing Origin/Referer, compares against the parsed `WEB_APP_ORIGIN`, not the
  request's own Host header) and CORS is an exact-origin allowlist with no wildcard, so no cross-site
  page can read a response even with the cookie attached; confirmed the Zod `issues` surface carries
  only schema-violation text (no submitted values, no internal state) and the two allowlisted error
  codes only ever carry the two benign, already-user-facing messages this form was designed to show.
  A review packet (published as a Claude artifact — code review + security review findings, fixes,
  and validation evidence) was prepared for the required second-role human review, since the
  implementing agent cannot also be its own reviewer (ADR-0010). **Jitesh D reviewed it and returned
  "Approved."** See `docs/project-state/dashboard-web-project-form-approval-checklist.md`'s
  "Sign-off" section. A gate decision and merge authorization remain separate, not-yet-requested
  next steps.
- `[2026-08-17]` **The gate (G4-project-form) was then separately requested and approved** —
  WebDesk Solution, decision CONFIRM (clean pass, not an override, since the second-role review was
  already complete before the gate was requested), approved commit
  `3ecd3996bc99c87522d8a1a4aab58edc5d048727` on branch `dashboard-web-project-form` — recorded in
  `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
  `G4-project-form`) and
  `docs/project-state/dashboard-web-project-form-approval-checklist.md`'s "Sign-off" section.
  **This gate approval does not itself authorize merging PR #28 or a production deployment** —
  merge remains its own separate, not-yet-requested authorization, per this project's standing
  "no auto-merge" rule (same pattern as every prior gate).
- `[2026-08-17]` **"Merge PR #28" was separately requested and executed.** Merged with a real merge
  commit (not squash/rebase), matching every prior merge in this project's history — merge commit
  `97c0ca59093db43406e387241d47a5f4733480af`. Both Vercel projects auto-deployed on push to `main`
  and were verified live directly, not just via CI's own Vercel status check —
  `dashboard-api`'s `/health` returned `build.commitSha ==
97c0ca59093db43406e387241d47a5f4733480af`, confirming the exact merged commit is what's serving;
  `dashboard-web`'s `/` resolves to `/auth/sign-in` for an unauthenticated visitor, confirming the
  session gate is intact. **The `dashboard-web` Create/Edit Project form is now genuinely live in
  production**, closing out this slice's full build-to-production arc. Backend, header switcher,
  list page, detail page, and now the create/edit form are all live for the Projects module.
- `[2026-08-17]` **Built the `dashboard-web` Project Status Change / Archive actions**, under the
  explicit "build the status change and archive UI" instruction — the last named UI gap against an
  already-live backend endpoint (`POST /projects/:projectId/status`, built with the Projects module
  itself but never called from any `dashboard-web` UI until now). A new client island,
  `ProjectStatusActions`, renders inside the Project Detail page's header alongside the existing
  "Edit" link, mirroring D2's own state machine (`active`⇄`paused`, either → `archived` terminal,
  from `apps/dashboard-api/src/projects/project.service.ts`'s `ALLOWED_TRANSITIONS`) by hand — only
  the transitions actually valid from a project's current status are ever rendered, and `archived`
  renders no actions at all. Only the archive transition prompts a `window.confirm()` — the one
  transition the state machine can never reverse. Reuses the existing mutation pattern (direct
  browser `fetch()` + `credentials: "include"`) and the existing `lib/api-errors.ts` error-message
  allowlist rather than adding new error-handling code; calls `router.refresh()` on success instead
  of navigating away. 65/65 `dashboard-web` unit tests (8 new) and 13/13 e2e tests (unchanged, no
  new route) passing; typecheck/lint/`next build` all clean. Pushed as branch
  `dashboard-web-project-status-actions`, off `main` at `b889982`. Not yet reviewed or merged.
- `[2026-08-17]` **Independent code review run on `dashboard-web-project-status-actions` (PR #29),
  medium effort — 8-angle finder pass, then all findings verified.** 9 candidates surfaced; 8
  survived 1-vote verification (1 REFUTED — a claimed duplicate of `lib/action-link-style.ts`'s
  `primaryActionLinkStyle`, which turned out technically unable to support the real
  `<button>` elements' `:disabled`/`:focus-visible` states, so it wasn't real duplication). Most
  severe: buttons re-enabled via the component's `finally` block immediately after firing
  `router.refresh()` — which returns `void` and isn't awaited — rather than after the refresh
  actually delivered the new status, a real window for a rushed or double-clicking user to fire a
  since-invalid transition. 7 of 8 findings fixed (commit pending): the race (the component now
  owns a local `status` state, updated via `setStatus(nextStatus)` in the same batched render as
  `setPending(null)`, so the rendered button set is never stale relative to whether it's enabled);
  an unguarded `ALLOWED_TRANSITIONS[status]` lookup that could throw on a status value outside the
  known union (fixed with a `?? []` fallback — not currently reachable, same latent-risk shape
  already accepted as debt for `roadmapItemStatusBadge`/`objectiveStatusBadge`); a silent
  network-failure `catch` with no logging (fixed with `console.error`, closing the same blind-spot
  class the Project Switcher review already fixed once); the page's own doc comment contradicting
  itself on whether it has client JS (reworded); `docs/implementation/dashboard-web-project-detail.md`
  left stale by this PR (an addendum section appended, not rewritten, preserving that doc's own
  historical accuracy); a duplicated `.error` CSS class (extracted into a new
  `components/error-message.module.css` that both `project-form.module.css` and
  `project-status-actions.module.css` now `composes` from); and a duplicated `ProjectStatus` type
  alias (now imports the existing `ProjectStatusFilter` from `lib/projects.ts`). The 8th —
  `router.refresh()` re-fetching the whole route (~9 requests: the page's own 6 plus the shell
  layout's 3) to reflect a 1-field change — was recorded as accepted, tracked debt: the race fix
  above removes this component's own need for the refresh to complete correctly, but the header's
  status badge is still server-rendered from the page's `project` prop, so some server
  reconciliation remains necessary; fully eliminating it would mean lifting `status` into a shared
  client wrapper the badge also reads from, a real architectural step up out of proportion for a
  review-fix pass. 3 new regression tests added (68/68 `dashboard-web` unit tests). Not yet
  security-reviewed, second-role human reviewed, gated, or merged.
- `[2026-08-17]` **Security review run on `dashboard-web-project-status-actions` (PR #29),
  separately from the code review.** 0 findings above threshold — confirmed the only file with
  real logic changes (`project-status-actions.tsx`) sends a fixed literal status value (never
  free-form input) to an endpoint already gated by `OriginCheckGuard`/`PermissionGuard`, with
  `project.service.ts`'s own state machine independently re-validating every transition
  server-side; client-side gating of which buttons render is advisory UX only. The new
  `console.error()` call (added in the code-review fix round) logs only the caught JS exception,
  no response bodies, tokens, or PII. A review packet (published as a Claude artifact — code
  review + security review findings, fixes, and validation evidence) was prepared for the
  required second-role human review, since the implementing agent cannot also be its own reviewer
  (ADR-0010). **Jitesh D reviewed it and returned "Approved."** See
  `docs/project-state/dashboard-web-project-status-actions-approval-checklist.md`'s "Sign-off"
  section. A gate decision and merge authorization remain separate, not-yet-requested next steps.
- `[2026-08-17]` **The gate (G4-project-status-actions) was then separately requested and
  approved** — WebDesk Solution, decision CONFIRM (clean pass, not an override, since the
  second-role review was already complete before the gate was requested), approved commit
  `90413983591b53c1a67f61d329702344ec22e651` on branch `dashboard-web-project-status-actions` —
  recorded in `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
  `G4-project-status-actions`) and
  `docs/project-state/dashboard-web-project-status-actions-approval-checklist.md`'s "Sign-off"
  section. **This gate approval does not itself authorize merging PR #29 or a production
  deployment** — merge remains its own separate, not-yet-requested authorization, per this
  project's standing "no auto-merge" rule (same pattern as every prior gate).
- `[2026-08-17]` **"Merge PR #29" was separately requested and executed.** Merged with a real
  merge commit (not squash/rebase), matching every prior merge in this project's history — merge
  commit `cf507d7edc569dac4807cf456540e7412a1cfea8`. Both Vercel projects auto-deployed on push to
  `main` and were verified live directly, not just via CI's own Vercel status check —
  `dashboard-api`'s `/health` returned `build.commitSha ==
cf507d7edc569dac4807cf456540e7412a1cfea8`, confirming the exact merged commit is what's serving;
  `dashboard-web`'s `/` resolves (via the intermediate `/home` hop) to `/auth/sign-in` for an
  unauthenticated visitor, confirming the session gate is intact. **The `dashboard-web` Project
  Status Change / Archive actions are now genuinely live in production**, closing out this
  slice's full build-to-production arc. Backend, header switcher, list page, detail page,
  create/edit form, and now status change/archive actions are all live for the Projects module.
- `[2026-08-17]` **Registered a project-owner-supplied "Recommended Module Roadmap"** —
  `canonical-inputs/Recommended_Module_Roadmap.md`, sourced from
  `/Users/admin/Downloads/webdesk-headless-v1.11.29/Recommended Module Roadmap.md`. Recorded
  verbatim: a 43-module, 10-wave recommended build order with per-module special instructions
  (e.g. Projects first; Review & Approval Center before Page Workspace; Ready for Claude Queue is
  manual-execution-only in V1; Users/Roles/Permissions is UI-only, no authorization redesign).
  **Per the project owner's own explicit instruction, this is recorded for reference only — no
  module is started, scoped, or authorized.** Distinguished from the existing, independently
  mechanically-computed `docs/phase-plans/module-implementation-roadmap.md` (Phase 1F's
  dependency-graph wave assignment) — the two are not the same artifact and may not agree on
  ordering for a given module; any such conflict gets surfaced to the project owner at the time a
  module is actually proposed, not resolved silently now.
- `[2026-08-17]` **Built the minimal read-only user-lookup capability and wired it into Project
  owner assignment**, under the explicit "start with the blockers" instruction following the
  "Remaining Projects module gaps" entry above. Scope confirmed with the user first
  (`AskUserQuestion`), since this touches the standing "no user-management CRUD beyond role
  assignment without a separate go-ahead" caution: chose a minimal read-only lookup (not module
  #39's fuller admin surface) and owner assignment as the first feature to unblock. New backend:
  `packages/database`'s `UserRepository.search()` (active-only, `ILIKE` across email/displayName)
  and a new `UsersModule` (`GET /users`, `GET /users/:userId`), both gated on the existing
  `users_roles:view` grant — verified as the right fit, not a scope mismatch, since only
  `super_admin`/`owner_growth_approver` (the two roles holding that grant) can ever reach a
  project owner picker anyway. New shared type `UserSummary` (`id`/`displayName`/`email` only).
  New frontend: a reusable `components/user-picker.tsx` (debounced search, built generic enough
  for team/approver assignment later) wired into `project-form.tsx`'s new `owner` field — the
  backend schema already accepted `ownerUserId` since the Projects module's original build; this
  is what finally lets a person set it. `lib/users.ts`'s `getUser()` resolves an existing owner
  server-side for the edit page, mirroring `getProject()`'s null-on-404 contract. 81/81
  `dashboard-web` unit tests (13 new), 321/321 `dashboard-api` unit tests (4 new), 121/121
  `packages/database` integration tests (4 new, real disposable database), 92/92 `dashboard-api`
  e2e tests (5 new, including a real RBAC-denial check) all passing; typecheck/lint/build clean.
  Pushed as branch `user-lookup-owner-assignment`. Not yet reviewed or merged — team management
  and approver-assignment UI remain separate, not-yet-built next steps (their backends already
  existed before this branch).
- `[2026-08-17]` **Independent code review run on `user-lookup-owner-assignment` (PR #30), medium
  effort — 8-angle finder pass.** 10 CONFIRMED findings after deduplication. Most severe: editing
  a project whose owner had since become disabled/removed and saving any unrelated field change
  (e.g. the name) silently cleared the owner assignment — `ProjectForm` had no way to distinguish
  "no owner" from "owner set but unresolvable," since both collapsed to the same `null` display
  state. Also found: `getUser()`'s uncaught throw on a non-404 failure meant a transient backend
  error on `GET /users/:userId` could crash the whole edit page (its primary content doesn't
  depend on owner resolution at all); `UserPicker`'s debounced search had no guard against an
  out-of-order response overwriting fresher results; `GET /users/:userId` 500'd on a malformed
  (non-UUID) id instead of a clean 404 (a raw Postgres driver error reaching the generic exception
  filter); `UserRepository.search()`'s `ILIKE` pattern didn't escape `%`/`_`, so a literal
  underscore in a search term was reinterpreted as a wildcard; a failed search's error message
  could resurface after the query was cleared or a selection removed; stale doc comments in
  `packages/shared-types` still claimed "no user-lookup endpoint exists yet," contradicted by this
  same PR; a duplicate local `UserSummary` interface and duplicated entity-mapping logic in
  `users.service.ts` (the type already existed in `packages/shared-types`); and duplicated
  form-field CSS plus a missing danger-styling composition for the picker's error state. 9 of 10
  fixed: `ProjectForm` now tracks the raw `ownerUserId` separately from the resolved `owner`
  summary and only overwrites it on an explicit picker interaction, preserving an unresolvable
  assignment untouched; the edit page wraps `getUser()` in try/catch; `UserPicker` gained a
  request-id guard invalidating stale responses and now clears `error` on every path that resets
  the query/selection; `UsersService.findById()` rejects a malformed id before ever reaching the
  repository; `UserRepository.search()` gained an `escapeLikePattern()` helper; the stale doc
  comments were reworded to record that the endpoint now exists; `users.service.ts` now imports
  the shared `UserSummary` type and both methods call one `toUserSummary()` helper;
  `user-picker.module.css` now composes from `project-form.module.css` and the shared
  `error-message.module.css`. The 10th finding — `users_roles:view` now also gating this PR's
  directory-search capability, not just role-assignment reads, a real but not-currently-exploitable
  semantic-drift concern (both map to the identical two-role set today) whose deeper fix (a
  dedicated permission action) means a new RBAC migration — was recorded as **accepted, tracked
  debt** directly in `users.controller.ts`'s own doc comment, per this project's standing "RBAC
  schema changes are their own separate authorization" discipline. Re-validated: 85/85
  `dashboard-web` unit tests (7 new), 322/322 `dashboard-api` unit tests (1 new), 122/122
  `packages/database` integration tests (1 new), 93/93 `dashboard-api` e2e/integration tests (1
  new), all against a fresh local disposable database; typecheck/lint/`next build`/`nest build`
  clean; `pnpm exec prettier --check` clean. Not yet security-reviewed, second-role human
  reviewed, gated, or merged.
- `[2026-08-17]` **Security review run on `user-lookup-owner-assignment` (PR #30), separately from
  the code review.** 0 findings above threshold. Five targeted questions were checked directly
  against the code: the `users_roles:view` gate is correctly enforced (verified against the real
  seeded RBAC matrix, plus the e2e suite's real 401/403 proofs); the `UserSummary` response shape
  stays narrowed to `id`/`displayName`/`email` in every path via one shared `toUserSummary()`
  helper; the new `escapeLikePattern()` helper is injection-safe (a match-correctness fix, not a
  SQL-injection vector — Sequelize already parameterizes the value); the search endpoint doesn't
  enable user enumeration beyond this codebase's already-accepted model (gated to the two most-
  trusted roles, with indistinguishable 404s across malformed/nonexistent/disabled cases); and
  `ownerUserId`'s lack of target-user-eligibility validation (UUID shape only) was noted as
  pre-existing, out-of-scope context — the field and its Zod schema predate this branch, and this
  PR doesn't touch `project.service.ts`/`projects.dto.ts`. A review packet (published as a Claude
  artifact — code review + security review findings, fixes, and validation evidence, with a
  decision section) was prepared for the required second-role human review, since the implementing
  agent cannot also be its own reviewer (ADR-0010). **Jitesh D reviewed it and returned
  "Approved."** See `docs/project-state/user-lookup-owner-assignment-approval-checklist.md`'s
  "Sign-off" section. This satisfies the last precondition before a gate decision can be
  requested, but is not itself a gate decision or a merge authorization — both remain separate,
  not-yet-requested next steps.
- `[2026-08-17]` **The gate (G4-user-lookup-owner-assignment) was then separately requested and
  approved** — WebDesk Solution, decision CONFIRM (clean pass, not an override, since the
  second-role review was already complete before the gate was requested), approved commit
  `22ca2a8c1a6b4695d87e6151f443fec05f586566` on branch `user-lookup-owner-assignment` — recorded in
  `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
  `G4-user-lookup-owner-assignment`) and
  `docs/project-state/user-lookup-owner-assignment-approval-checklist.md`'s "Sign-off" section.
  **This gate approval does not itself authorize merging PR #30, a production deployment, or any
  further Projects-module gap work (team management, approver assignment)** — merge remains its
  own separate, not-yet-requested authorization, per this project's standing "no auto-merge" rule
  (same pattern as every prior gate).
- `[2026-08-17]` **"Merge PR #30" was separately requested and executed.** Merged with a real merge
  commit (not squash/rebase), matching every prior merge in this project's history — merge commit
  `d9c42782db8f79207662a25ec6e558cbf4707755`. Both Vercel projects auto-deployed on push to `main`
  and were verified live directly, not just via CI's own Vercel status check — `dashboard-api`'s
  `/health` returned `build.commitSha ==
d9c42782db8f79207662a25ec6e558cbf4707755`, confirming the exact merged commit is what's serving;
  `dashboard-web`'s `/` resolves (via the intermediate `/home` hop) to `/auth/sign-in` for an
  unauthenticated visitor, confirming the session gate is intact. **The user lookup capability
  (`GET /users`, `GET /users/:userId`) and Project owner assignment (the `UserPicker` component
  wired into the create/edit project form) are now genuinely live in production**, closing out
  this slice's full build-to-production arc. Team management and approver-assignment UI remain
  separate, not-yet-built next steps — their backends already existed before this branch.
- `[2026-08-17]` **Built the Projects module backend close-out** (branch
  `module-projects-backend-closeout`, [PR #31](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/31)),
  under the explicit "make sure nothing is remaining on the backend/API side from the Projects
  module" instruction, ahead of an upcoming dashboard design prompt that will drive the remaining
  frontend wiring. A dedicated audit (read the actual code, not documentation) found the backend
  almost entirely code-complete but surfaced 3 real gaps — a missing `GET
/projects/:projectId/approvers` endpoint, `ProjectEnvironment.url` accepting any URL scheme
  (known, previously client-side-only-fixed security debt), and no existence check on
  `ownerUserId` before the database write — plus a systemic test-coverage gap (4 of 6 sub-resource
  controllers had zero unit tests). All fixed and covered; see
  `docs/implementation/module-projects-backend-closeout.md` for the full account.
- `[2026-08-17]` **Independent code review run on `module-projects-backend-closeout` (PR #31),
  medium effort — 8-angle finder pass, then all findings fixed.** 10 candidates surfaced after
  dedup (7 CONFIRMED, 3 PLAUSIBLE). Most severe: `update()` re-validated `ownerUserId` against
  `UsersService` even when the patch resent the project's own already-stored, unchanged value —
  which `dashboard-web`'s edit form always does — so a project whose owner had since been disabled
  would reject _any_ unrelated edit; fixed by only re-validating when the value is actually
  changing. Also fixed: `GET /:projectId/approvers` reused the sibling routes'
  `project_configuration:view` gate, exposing `users_roles`-scoped PII (approver display
  names/emails) to any project-configuration viewer with no `users_roles` grant at all (e.g. the
  seeded `read_only` role) — regated to `users_roles:view`, matching
  `role-assignment.controller.ts`'s own precedent, with a new e2e regression test proving a
  `read_only` session now gets `403`; an error-swallowing `.catch(() => null)` around each
  approver's identity resolution that hid any error class, not just a genuine not-found;
  `assertOwnerExists()` re-declaring its own `UserRepository` binding and duplicating
  `UsersService.findById()`'s already-existing active-user check — now delegates to `UsersService`
  instead; `AuthzModule` over-exporting the write-capable `USER_ROLE_REPOSITORY` token just so
  `ProjectApproversService` could read from it — replaced with a new, read-only
  `RoleAssignmentService.findUserIdsForRoleInProject()` delegating method, and the export reverted;
  a missing covering index on the new "list approvers" query (migration `00045`, `(role_id,
project_id)` on `user_roles`); `safeHttpUrl` duplicated locally instead of using the shared
  `packages/validation` package it was built for — moved there as `safeHttpUrlSchema`; an N+1
  query resolving approver identities one-by-one — replaced with a new
  `UserRepository.findByIds()`/`UsersService.findByIds()` batch-resolve path (also closes the
  error-swallowing finding, since batch resolution has no per-item catch); and `create()` running
  its two independent checks (`findByPublicId()`, the owner check) sequentially instead of via
  `Promise.all()`. The 10th finding — a TOCTOU gap between the owner-existence check and the
  write — was recorded as accepted, tracked debt: `accountStatus` only changes via operator-run CLI
  scripts, never concurrent HTTP, so the window isn't practically reachable, and `ownerUserId`
  carries no authorization weight, making a real fix (a transaction/row-lock spanning both the
  check and the write) disproportionate. Full re-validation on a fresh local disposable database:
  363/363 `dashboard-api` unit tests (16 new), 125/125 `packages/database` integration tests (4
  new), 103/103 `dashboard-api` integration/e2e tests (18 Projects tests, up from 16), migration
  `00045` up/down round-trip clean, typecheck/lint/`nest build`/prettier all clean, `pnpm audit` 0
  vulnerabilities. Security review, second-role human review, a gate decision, and merge
  authorization remain each their own separate, not-yet-requested next step.
- `[2026-08-17]` **Security review run on `module-projects-backend-closeout` (PR #31), separately
  from the code review.** 0 findings above threshold — the new `GET /projects/:projectId/approvers`
  route is correctly gated on `users_roles:view` (proven by a real e2e `403` test against a
  `read_only` session), `safeHttpUrlSchema` correctly allowlists `http:`/`https:` via the WHATWG
  `URL` parser, the new batch identity-resolution path (`findByIds()`) preserves the existing
  active-user filter and malformed-id rejection, `AuthzModule` no longer exporting a write-capable
  repository token is a hardening rather than a new risk, and migration `00045` is a pure additive
  index with no data or authorization-model change. A review packet (published as a Claude
  artifact — code review + security review findings, fixes, and validation evidence, with a
  decision section) was prepared for the required second-role human review, since the implementing
  agent cannot also be its own reviewer (ADR-0010). **Jitesh D reviewed it and returned
  "Approved."** See `docs/project-state/module-projects-backend-closeout-approval-checklist.md`'s
  "Sign-off" section. A gate decision and merge authorization remain separate, not-yet-requested
  next steps.
- `[2026-08-17]` **The gate (G4-projects-backend-closeout) was then separately requested and
  approved** — WebDesk Solution, decision CONFIRM (clean pass, not an override, since the
  second-role review and the security review were already complete before the gate was
  requested), approved commit `8a3baf0` on branch `module-projects-backend-closeout` — recorded in
  `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
  `G4-projects-backend-closeout`) and
  `docs/project-state/module-projects-backend-closeout-approval-checklist.md`'s "Sign-off" section.
  **This gate approval does not itself authorize merging PR #31 or a production deployment** —
  merge remains its own separate, not-yet-requested authorization, per this project's standing
  "no auto-merge" rule (same pattern as every prior gate).
- `[2026-08-17]` **"Merge PR #31" was separately requested and executed.** Merged with a real
  merge commit (not squash/rebase), matching every prior merge in this project's history — merge
  commit `ca7eec0b252a8faf47e67dd4cddb7297e9fb7b88`. Both Vercel projects auto-deployed on push to
  `main` and were verified live directly, not just via CI's own Vercel status check —
  `dashboard-api`'s `/health` returned `build.commitSha ==
ca7eec0b252a8faf47e67dd4cddb7297e9fb7b88`, confirming the exact merged commit is what's serving;
  `dashboard-web`'s `/` resolves to `/auth/sign-in` for an unauthenticated visitor, confirming the
  session gate is intact. **The Projects module backend close-out — the
  `GET /projects/:projectId/approvers` endpoint, the environment-URL scheme fix, the `ownerUserId`
  existence check, the expanded sub-resource test coverage, and every code-review/security-review
  fix from the review round — is now genuinely live in production.**
- `[2026-08-17]` **Migration `00045` (the additive `user_roles(role_id, project_id)` index) run
  against the real production Neon database** — user ran
  `pnpm --filter @webdesk/database run migrate` themselves in their own terminal, sourcing
  `prod-db.env` — Claude never saw the real `DATABASE_URL`, same discipline as every prior
  production migration this project. Applied cleanly: `Applied 1 migration(s):
00045-add-user-roles-role-project-index` (`durationSeconds: 0.988`). **Independently confirmed
  via a second, separate command** (`migrate:status`, Umzug's own read-only bookkeeping, not just
  the `migrate` command's own success message) — all 45 migrations executed, 0 pending. **The
  production database schema is now fully migrated through `00045`**, closing the last
  outstanding item from the Projects module backend close-out (PR #31) — this index was a pure
  query-performance optimization for the `GET /projects/:projectId/approvers` endpoint, not a
  functional blocker, so nothing was degraded while it was pending.
- `[2026-08-17]` **Dashboard UI/UX design-system package produced** (branch
  `dashboard-ui-design-system`) — an 18-document proposal under `docs/design/dashboard-ui/`,
  requested via a user-supplied design prompt ahead of business-module implementation. Grounded in
  real research (Phase 1F's actual token/component code, the live shell, all 7 relevant canonical
  spec documents, the seeded module registry, both module-roadmap documents) rather than
  invention. Key finding: no WebDesk brand-identity material exists in the repository at all.
  Recommends **Clean Enterprise** (Direction A) as the base visual direction, refining Phase 1F's
  existing token foundation rather than discarding it, with a narrow scoped borrowing (richer
  progress/stepper treatment) for the 5 pipeline-shaped modules only. Dark mode recommended not
  V1. All 8 page-pattern archetypes, a real-status-to-5-bucket mapping covering every actual
  workflow state name in the canonical specs, and all 15 representative screens named in the
  prompt were specified. No prototype built, no implementation started, no Phase 1F shell
  refactor performed — per the prompt's own explicit stop-and-wait instruction. See item 16 in
  "Active tasks" above for the full account and
  `docs/design/dashboard-ui/17-dashboard-ui-approval-checklist.md` for the pending human
  direction-selection decision.
- `[2026-08-17]` **The recommended dashboard UI/UX direction was reviewed and approved as-is** —
  WebDesk Solution, decision "Approve recommended direction (A, with the scoped B borrowing)
  as-is." Direction A (Clean Enterprise) is now the canonical dashboard visual direction for all
  43 modules, with Direction B's richer progress/stepper treatment scoped only to Ready for Claude
  Queue, Scan Center, Change Center, Release Center, and Review & Approval Center; dark mode
  deferred (not V1); all 18 supporting documents approved alongside the direction, with no changes
  requested to any of them. Recorded in
  `docs/design/dashboard-ui/17-dashboard-ui-approval-checklist.md`'s "Required human decision"
  section (now COMPLETE) and `outputs/webdesk-growth-dashboard/project.json`'s `audit_log`. This
  approval is scoped to the design direction only, per design prompt §34 — it does not itself
  authorize a Dashboard UI Foundation Alignment implementation task package, and merging PR #32
  remains its own separate, not-yet-requested step, per this project's standing "no auto-merge"
  rule (the same pattern followed for every prior gate/approval in this project's history, even
  though this decision used the design prompt's own approval mechanism rather than the usual
  code-review/security-review/QA-gate machinery, since there is no code in this PR to run those
  against).
- `[2026-08-17]` **"Merge PR #32" was separately requested and executed.** Merged with a real
  merge commit (not squash/rebase), matching every prior merge in this project's history — merge
  commit `800472e96a1478ff715edb00f2ad26b6fa2cd44b`, all 14 CI checks (including both Vercel
  preview-deployment checks) green beforehand. Both Vercel projects auto-deployed on push to
  `main` and were verified live directly, not just via CI's own Vercel status check —
  `dashboard-api`'s `/health` returned `build.commitSha ==
800472e96a1478ff715edb00f2ad26b6fa2cd44b`, confirming the exact merged commit is what's serving;
  `dashboard-web`'s `/` resolves to `/auth/sign-in` for an unauthenticated visitor, confirming the
  session gate is intact. Since PR #32 contains only documentation (`docs/design/dashboard-ui/`,
  no application code), this merge changes nothing about the running application's actual
  behavior — the live checks confirm the merge landed cleanly on `main`, not a functional change.
  **The approved dashboard UI/UX design-system package is now on `main`.** Building the Dashboard
  UI Foundation Alignment task package (design prompt §34) remains a separate, not-yet-requested
  next step.
- `[2026-08-17]` **Scoped (not authorized to build) the Dashboard UI Foundation Alignment task
  package** — `docs/task-packages/dashboard-ui-foundation-alignment.md`, per design prompt §34's
  own next-step naming. Grounded entirely in the 18 approved design documents plus direct
  verification against live code, surfacing two concrete blockers rather than assuming the header
  could be fully wired up: (1) header "global search" can only honestly be module-navigation
  search for now — no cross-record search backend exists for any business module yet; (2) header
  "notifications" can ship as UI only — `GET /notifications` is gated on a **zero-seeded**
  `system_settings:notifications_view` action (no role currently holds it, so even Super Admin
  would get a real `403` today) and isn't scoped to "the current user's own notifications" in the
  first place, so a real per-user drawer needs a new self-service endpoint and an RBAC seed
  decision — both their own, separate, not-yet-requested authorizations. Scope: ~30 new
  `packages/ui` components, wiring the already-defined-but-unused breakpoint/motion/control-size
  tokens into real CSS, a new calmer `statusBadgeTokens` palette (flagged as needing real
  contrast-tool verification, not assumed), the 5-cluster library sub-grouping and desktop sidebar
  collapse from the approved navigation spec, and re-skinning the 6 pre-`packages/ui` auth pages
  (closing a confirmed `#b00020`-vs-`colorTokens.danger` color drift). Explicitly out of scope: any
  of the 43 modules' business functionality, dark mode (still not V1), and any RBAC/workflow-state/
  module-registry schema change. One item flagged for extra scrutiny when this work is eventually
  reviewed: closing the accessibility test-coverage gap requires a test-only session-establishment
  path for Playwright, which touches authentication-adjacent code and should get the same security
  attention as real auth code, not be treated as routine test scaffolding. **Writing this package
  is scoping only — a separate, explicit "begin this work" instruction is still required before
  any branch is created or any code is touched**, matching this project's discipline for every
  prior phase.
- `[2026-08-17]` **Dashboard UI Foundation Alignment built**, under the separate explicit "Begin
  this work" instruction the task package above itself required. Branch
  `dashboard-ui-foundation-alignment`, off `main` at `f99f5bc88e652d01b4186dde3db38e0c7877bafc`
  (re-verified zero drift before starting). All 6 scoped items built and fully validated — see the
  new "Active tasks" item 17 above and `docs/implementation/dashboard-ui-foundation-alignment.md`
  for the complete as-built account, including the 3 real, pre-existing WCAG AA contrast
  violations the new authenticated-shell accessibility coverage caught and fixed. 79/79
  `packages/ui` + 103/103 `dashboard-web` unit tests, 15/15 Playwright tests, typecheck/lint/
  `next build`/prettier all clean; only `apps/dashboard-web` and `packages/ui` touched. Pushed and
  opened as [PR #33](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/33)
  for reviewability.
- `[2026-08-18]` **Independent code review run on `dashboard-ui-foundation-alignment` (PR #33),
  high effort — 8 finder angles, 1-vote verification.** 10 findings surfaced, 8 CONFIRMED and 2
  PLAUSIBLE. Most severe: the tablet (`min-width: 768px, max-width: 1023.98px`) and mobile
  (`max-width: 768px`) shell breakpoints overlapped at exactly 768px, a real device width, letting
  the mobile off-canvas CSS and the JS icon-only tablet state both apply at once — this also
  required fixing `check-css-tokens.mjs` itself, since its regex never matched decimal breakpoints
  and only validated one clause per compound `@media` query, so it silently passed the now-removed
  `1023.98px` violation. All 8 CONFIRMED findings fixed and re-validated per the explicit "fix the
  confirmed findings" instruction: the breakpoint/lint-script pair above; a dialog focus-trap
  effect (`useDialogBehavior`) re-running on any unrelated parent re-render because it depended on
  the `onClose` callback's identity (fixed via the latest-ref pattern); `ApprovalBlock`'s Reject
  and Request Revision modals sharing one `reason` textarea, cleared only on submit and leaking
  between them on Cancel; `accessibility.spec.ts` hardcoding a duplicate copy of the e2e session
  cookie constants instead of importing them from `lib/e2e-test-session.ts`; `Progress` rendering
  `width: "NaN%"` at `max === 0`; a duplicated `initialsFor()` helper between `app-shell.tsx` and
  `packages/ui` (now exported and reused); and two independently-maintained test-fixture default
  shapes (`fixtureModule()`/`navEntry()`) that had already drifted on their `implementationStatus`
  default. The 2 PLAUSIBLE findings — the header "Sign out" menu item using `router.push()` instead
  of a real `href`, and the new `Badge` structurally near-duplicating the pre-existing
  `StatusBadge` — were left unaddressed, since the fix instruction's scope was literal
  (CONFIRMED-only); both were flagged for the second-role reviewer's disposition. Re-validated:
  79/79 `packages/ui` + 103/103 `dashboard-web` unit tests, 15/15 Playwright tests, typecheck/lint/
  build/`pnpm exec prettier --check` all clean. See `docs/implementation/dashboard-ui-foundation-
alignment.md`'s "Independent code review" section for the full account.
- `[2026-08-18]` **Security review run on `dashboard-ui-foundation-alignment` (PR #33), separately
  from the code review.** 0 findings above threshold. Focused on this branch's most
  security-relevant addition, `lib/e2e-test-session.ts` (the new test-only authenticated-session
  bypass built so Playwright's automated accessibility suite can exercise the real authenticated
  shell in CI). Traced its only consumer (`getServerSession()`) and confirmed no header/query-param
  path reaches it; both gates are structurally sound — Next.js force-sets `NODE_ENV=production` for
  the real `next build`/Vercel Runtime pipeline regardless of any other env var, so even a
  misconfigured `PLAYWRIGHT_E2E_TEST_MODE=1` in production wouldn't clear the first gate. Two
  candidates were considered and excluded: the unused `FileAttachment` component's `<a href>`
  rendering with no URL-scheme allowlist (the same shape as a previously-fixed stored-XSS bug, but
  with no live caller anywhere in this branch — confidence 3/10, a hardening gap to close before
  first real use, not a live vulnerability today) and the bypass's partly-environment-variable-
  dependent gating (excluded per this project's standing precedent that environment variables are
  trusted, not attacker-controllable — confidence 2/10). No SQL/command injection, hardcoded
  secrets, broken auth/authz logic, or exploitable XSS found elsewhere; the 6 re-skinned auth pages
  are style-only, with zero change to `fetch()` calls, credentials, endpoints, or form logic.
- `[2026-08-18]` **Required second-role human review complete for `dashboard-ui-foundation-
alignment` (PR #33).** A review packet (published as a Claude artifact — code review + security
  review findings, fixes, and validation evidence, with a decision section) was prepared for the
  required second-role human review, since the implementing agent cannot also be its own reviewer
  (ADR-0010). **Jitesh D reviewed it and returned "Approved as-is,"** accepting the 2 open
  PLAUSIBLE code-review findings as tracked debt rather than requesting fixes. See
  `docs/project-state/dashboard-ui-foundation-alignment-approval-checklist.md`'s "Sign-off"
  section. A gate decision and merge authorization remain separate, not-yet-requested next steps.
- `[2026-08-18]` **The gate (G4-dashboard-ui-foundation-alignment) was then separately requested
  and approved** — WebDesk Solution, decision CONFIRM (clean pass, not an override, since the
  second-role review was already complete before the gate was requested), approved commit
  `4a256c74735b4c819e62d8e00cac16ff3e762782` on branch `dashboard-ui-foundation-alignment` —
  recorded in `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
  `G4-dashboard-ui-foundation-alignment`) and
  `docs/project-state/dashboard-ui-foundation-alignment-approval-checklist.md`'s "Sign-off"
  section. **This gate approval does not itself authorize merging PR #33 or a production
  deployment** — merge remains its own separate, not-yet-requested authorization, per this
  project's standing "no auto-merge" rule (same pattern as every prior gate).
- `[2026-08-18]` **"Merge PR #33" was separately requested and executed.** Merged with a real
  merge commit (not squash/rebase), matching every prior merge in this project's history — merge
  commit `77c95ced4f18a9f63031321b17f80081d6627bcc`, all 14 CI checks (including both Vercel
  preview-deployment checks) green beforehand. Both Vercel projects auto-deployed on push to
  `main` and were verified live directly, not just via CI's own Vercel status check —
  `dashboard-api`'s `/health` returned `build.commitSha ==
77c95ced4f18a9f63031321b17f80081d6627bcc`, confirming the exact merged commit is what's serving;
  `dashboard-web`'s `/` resolves (via the intermediate `/home` hop) to `/auth/sign-in` for an
  unauthenticated visitor, confirming the session gate is intact. **The Dashboard UI Foundation
  Alignment slice — design tokens, ~30 new `packages/ui` components, application-shell
  navigation/header alignment, 6 re-skinned auth pages, and the new authenticated-shell
  accessibility test coverage — is now genuinely live in production**, closing out this slice's
  full build-to-production arc. No business-module implementation work starts automatically as a
  result of this merge.
- `[2026-08-18]` **Built the `dashboard-web` Team management + Approver assignment UI**, closing
  gaps (2) and (3) from item 13's remaining-Projects-module-gaps analysis. Presented 4 scoping
  options for this work (team+approver UI first / sub-resource editing first / all 4 gaps as one
  package / something else); the user chose "Team + Approver UI first" — both reuse the existing
  `UserPicker` and already-built, already-security-reviewed backend endpoints, the smallest,
  lowest-risk next slice. Widened `ProjectTeamEntry` (`packages/shared-types`) to carry
  `userId`/`addedAt`; added `getUsersByIds()` (`lib/users.ts`) to resolve a team roster to real
  identities via the existing `GET /users/:userId` endpoint, in parallel, dropping unresolvable
  ids rather than throwing; `getProjectDetail()` now returns a resolved team list and the real
  approvers list (`null` when the viewer lacks `users_roles:view`, distinct from an empty list);
  new `lib/roles.ts#getApproverRoleId()` resolves the `owner_growth_approver` role's id needed to
  construct the approver-revoke call (reuses the general role-assignment `DELETE` endpoint — no
  approver-specific revoke route exists). New `ProjectTeamSection`/`ProjectApproversSection`
  client components render on the Project Detail page, replacing the old headcount-only Team
  display. A real cross-boundary bug was found and fixed: the team section needed
  `formatTimestamp()` as a real (not type-only) import from `lib/projects.ts`, which pulls in
  `next/headers` and broke the client bundle — extracted into a new zero-dependency
  `lib/format-timestamp.ts` that `lib/projects.ts` re-exports, so every existing server-side call
  site stayed unaffected. 123/123 `dashboard-web` unit tests (18 new: `ProjectTeamSection`,
  `ProjectApproversSection`, `getApproverRoleId`, `getUsersByIds`, plus updated/new
  `getProjectDetail` coverage), 15/15 Playwright tests, typecheck/lint/`next build`/prettier all
  clean across `packages/shared-types` and `dashboard-web`. See
  `docs/implementation/dashboard-web-team-approver-management.md` for the full as-built record.
  Pushed as branch `dashboard-web-team-approver-management`, opened as
  [PR #34](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/34) — not
  yet code-reviewed, security-reviewed, gated, or merged.
- `[2026-08-18]` **Independent code review run on `dashboard-web-team-approver-management` (PR
  #34), high effort — 8-angle finder pass.** 10 candidates surfaced after dedup, all 10 CONFIRMED.
  Most severe: `getProjectDetail()` had no try/catch around team-identity resolution, and
  `getUser()` throws on any non-404 error, so a single 403 from `GET /users/:userId` (a viewer
  lacking `users_roles:view`) crashed the entire Project Detail page. 9 of 10 fixed per explicit
  "fix the confirmed findings" instruction: the crash (switched `getUsersByIds()` to
  `Promise.allSettled` with per-id error logging); the approver-revoke handler ignoring a
  `revoked: false` backend response; the Team section's `UserPicker` being offered to viewers
  who'd 403 on the first keystroke (new `canSearchUsers` prop, reusing the same signal the
  Approvers section already resolves); a single shared `pendingRemoveId` racing across concurrent
  row removals in both roster components (now a per-row `Set`); silent 403/5xx swallowing in
  `lib/roles.ts` with no logging; both roster components never resyncing local state from fresh
  props after `router.refresh()` (new resync `useEffect`s); a duplicated primary-button CSS block
  (now composes from `project-form.module.css`); an unconditional approver-role-id fetch even when
  unused; and team-identity resolution serialized behind unrelated sub-resource fetches instead of
  chained directly off the team fetch. The 10th (`getUsersByIds()` using N parallel requests
  instead of the backend's existing `findByIds()` batch endpoint) was recorded as accepted,
  out-of-scope debt — closing it means adding new `dashboard-api` code, out of scope for a branch
  declared `dashboard-web` UI only. 128/128 `dashboard-web` unit tests (7 new), 15/15 Playwright
  tests, typecheck/lint/`next build`/prettier all re-verified clean. Pushed as commit `249faa8`.
- `[2026-08-18]` **Security review run on `dashboard-web-team-approver-management` (PR #34),
  separately from the code review.** 0 findings above threshold. Confirmed no XSS surface (all
  rendered fields are React-escaped JSX interpolation of backend-sourced data, no
  `dangerouslySetInnerHTML`); no path-traversal-relevant input reaches the fetch-URL
  interpolations (`projectId`/`userId`/`approverRoleId` are all backend-sourced UUIDs); both new
  components rely entirely on the backend's `PermissionGuard`/`OriginCheckGuard` for real
  enforcement, with the new `canSearchUsers` prop only toggling UI visibility, never enforcement
  (a stale/tampered value can only over-restrict, never grant privilege); the approver-revoke path
  always targets a fixed, server-resolved role id; new `console.error` calls log only status codes
  or generic errors, no PII or secrets. A review packet (published as a Claude artifact — code
  review + security review findings, fixes, and validation evidence, with a decision section) was
  prepared for the required second-role human review, since the implementing agent cannot also be
  its own reviewer (ADR-0010). See
  `docs/project-state/dashboard-web-team-approver-management-approval-checklist.md`. A gate
  decision and merge authorization remain separate, not-yet-requested next steps.
- `[2026-08-18]` **Required second-role human review complete for
  `dashboard-web-team-approver-management` (PR #34).** The review packet (code review + security
  review findings, fixes, and validation evidence, with a decision section) was reviewed. **Jitesh
  D reviewed it and returned "Approved."** See
  `docs/project-state/dashboard-web-team-approver-management-approval-checklist.md`'s "Sign-off"
  section. A gate decision and merge authorization remain separate, not-yet-requested next steps.
- `[2026-08-18]` **The gate (G4-team-approver-management) was then separately requested and
  approved** — WebDesk Solution, decision CONFIRM (clean pass, not an override, since the
  second-role review was already complete before the gate was requested), approved commit
  `91a0a160559d2998e508130fc9a88a51222a7175` on branch `dashboard-web-team-approver-management` —
  recorded in `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
  `G4-team-approver-management`) and
  `docs/project-state/dashboard-web-team-approver-management-approval-checklist.md`'s "Sign-off"
  section. **This gate approval does not itself authorize merging PR #34 or a production
  deployment** — merge remains its own separate, not-yet-requested authorization, per this
  project's standing "no-auto-merge" rule (same pattern as every prior gate).
- `[2026-08-18]` **"Merge PR #34" was separately requested and executed — with an explicit,
  user-directed deviation from this project's standing "wait for fully green CI" discipline.**
  Merged with a real merge commit (not squash/rebase) — merge commit
  `4f6814ec9b585bf01c3c9a37c165b828d3ed5d2d`. The first merge attempt was blocked by this
  session's own tool-permission classifier (not a CI or GitHub-side block); re-attempted under
  the same explicit "merge PR 34" instruction and succeeded. **Before merging, CI's "Integration
  tests" job was found genuinely hung** — not failing, just stuck — on its `dashboard-web
Playwright browsers` step (an infra-level browser download) for 40+ minutes; diagnosed via the
  GitHub Actions API's step-level timestamps, cancelled, and re-run once, which hung on the
  identical step a second time. Every other check in the same run — typecheck, lint, unit tests,
  production build, database migration test, secret-pattern scan, dependency audit, formatting —
  passed cleanly both times, and the only two commits since the last fully-green run (the
  second-role-review and gate-approval doc updates) touched only `CLAUDE.md`, one approval
  checklist, and `project.json` — no application code. The user then explicitly instructed "skip
  the CI as it is wasting time again"; `main` was confirmed to have no branch-protection rule
  requiring status checks (`gh api .../branches/main/protection` → 404 "Branch not protected"),
  so the merge was neither a bypass of a GitHub-enforced gate nor an override of anything beyond
  waiting for the stuck check to resolve on its own. Both Vercel projects auto-deployed on push to
  `main` and were verified live directly — `dashboard-api`'s `/health` returned `build.commitSha
== 4f6814ec9b585bf01c3c9a37c165b828d3ed5d2d`, and `dashboard-web`'s `/` resolves (via the
  intermediate `/home` hop) to `/auth/sign-in` for an unauthenticated visitor. **The
  `dashboard-web` Team management + Approver assignment UI is now genuinely live in production.**
  No business-module implementation work starts automatically as a result of this merge.
- `[2026-08-18]` **Diagnosed and fixed a real production authentication bug**: the user reported
  that Google Workspace SSO login appeared to succeed at Google's own consent screen but then
  looped back to `/auth/sign-in` instead of reaching the authenticated app. Diagnosed directly
  against the deployed app (via the user's own Chrome session, then confirmed by reading
  `cookie.util.ts`/`server-session.ts`) as a genuine cross-domain cookie-scoping bug:
  `dashboard-api`'s Google OIDC callback set its session cookie and redirected straight to
  `WEB_APP_ORIGIN`'s root, but that cookie is host-only to `dashboard-api`'s own domain (no
  `Domain` attribute, no shared parent domain between the two separate `*.vercel.app` projects) —
  it was never actually sent on the subsequent navigation to `dashboard-web`. Not a `SameSite`
  bug — `SameSite=None` is already correct for the cross-site requests this app makes _to_
  `dashboard-api`; the broken case is the browser's own top-level navigation _away from_ it, which
  that cookie could never reach. Explained 3 candidate fixes and asked directly which to
  implement; the user replied "yes please" to the recommended session-exchange approach. Built and
  fully validated on branch `fix-cross-domain-session-exchange` — see "Active tasks" item 19 above
  and `docs/implementation/session-exchange.md` for the complete account. Pushed and opened as
  [PR #35](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/35).
- `[2026-08-18]` **Independent code review run on `fix-cross-domain-session-exchange` (PR #35),
  high effort — 8-angle finder pass, then all 10 CONFIRMED findings verified individually.** Most
  severe: splitting one Google SSO login into two independent sessions meant "Sign out" only ever
  revoked the rarely-used `dashboard-api`-side session — the `dashboard-web`-side one
  `getServerSession()` actually authenticates every page against was never touched, so a user
  clicking "Sign out" remained effectively signed in for up to 7 days. Fixed with a new
  `DELETE /auth/session` route in `dashboard-web` that forwards the whole incoming `Cookie` header
  to `dashboard-api`'s `/auth/logout` with an explicit `Origin` header, called alongside the
  existing dashboard-api logout call. 9 of 10 CONFIRMED findings fixed per explicit "fix the
  confirmed findings" instruction (also: an unguarded exchange-code `issue()` call that could leak
  a raw `500` with a session cookie already staged; the actively-used session being stamped with
  the server-to-server exchange call's own `ipHash`/`userAgent` instead of the real browser's,
  fixed by capturing forensic data at issue time and storing it on the amended migration `00046`;
  a missing `auth_events` record for the session actually in use, via a new
  `session_exchange_redeemed` vocabulary entry; an unguarded `response.json()`; a cookie-name
  drift risk between the two independently-deployed apps, closed by having `POST /auth/exchange`
  echo back the authoritative name instead of `dashboard-web` guessing its own; a hardcoded
  `secure: true` with no local-dev override; a 4x-duplicated redirect-to-error literal; and an
  extra DB round-trip in `redeem()`). The 10th — `POST /auth/exchange` having no
  `OriginCheckGuard`/shared secret beyond the code's own entropy/single-use/60s TTL — was left as
  **accepted, tracked debt**, flagged explicitly for the second-role reviewer's own judgment,
  since closing it properly means a materially bigger architectural change (a POST-based redirect
  flow) for a narrow exploit window. Re-validated: 370/370 `dashboard-api` unit tests, 143/143
  `dashboard-web` unit tests, new integration/e2e coverage for every fix (including a real
  logout-via-forwarded-cookie regression test proving the new route's mechanism), typecheck/lint/
  build/prettier all clean. See `docs/implementation/session-exchange.md`'s "Independent code
  review" section for the full account. Not yet security-reviewed, second-role human reviewed,
  gated, or merged.
- `[2026-08-18]` **Security review run on `fix-cross-domain-session-exchange` (PR #35), separately
  from the code review, against the fixed branch.** One candidate identified (the new
  `DELETE /auth/session` route clears the local cookie and reports success even if the
  server-side revoke call to `dashboard-api` fails or is unreachable) and adversarially
  verified — rejected at 2/10 confidence: exploiting it requires an attacker to already hold a
  leaked raw session token _and_ a coincidental `dashboard-api` outage at the exact moment of
  logout, neither attacker-triggerable; it's a standard best-effort "cookie-clear is the primary
  signal" logout pattern that only narrows, never removes, the pre-existing TTL-bounded exposure
  every session already has. **0 findings above threshold.** Also confirmed clean: the new route's
  `Cookie`/`Origin` forwarding (no cross-site forgery path — no CORS wildcard, `SameSite=Lax`
  cookie, `DELETE` requires a preflight `dashboard-web` never satisfies for foreign origins);
  exchange-code crypto and atomic redemption; the new `ipHash`/`userAgent` storage (same shape as
  existing `sessions`/`auth_events` columns, no new PII exposure class); `GoogleAuthController#callback`'s
  reordered flow (no auth-bypass/session-fixation shape); and the `cookieName` echoed back in
  `POST /auth/exchange`'s response (sourced solely from trusted server-side config). A review
  packet (published as a Claude artifact — code review + security review findings, fixes, and
  validation evidence, with an explicit decision section for the one accepted-debt item) was
  prepared for the required second-role human review, since the implementing agent cannot also be
  its own reviewer (ADR-0010). **Jitesh D reviewed it and returned "Approved as-is,"** accepting
  the `POST /auth/exchange` origin-guard gap as tracked debt rather than requesting the bigger
  architectural fix. See
  `docs/project-state/fix-cross-domain-session-exchange-approval-checklist.md`'s "Sign-off"
  section. A gate decision and merge authorization remain separate, not-yet-requested next steps.
- `[2026-08-18]` **The gate (G4-session-exchange) was then separately requested and approved** —
  WebDesk Solution, decision CONFIRM (clean pass, not an override, since the second-role review
  was already complete before the gate was requested), approved commit
  `1cd89adf973cd13f499170a79ba8601e0a9a56cb` on branch `fix-cross-domain-session-exchange` — see
  `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
  `G4-session-exchange`) and
  `docs/project-state/fix-cross-domain-session-exchange-approval-checklist.md`'s "Sign-off"
  section. **This gate approval does not itself authorize merging PR #35, a production
  deployment, or running migration `00046` against the real production database** — merge
  remains its own separate, not-yet-requested authorization, per this project's standing
  "no auto-merge" rule (same pattern as every prior gate).
- `[2026-08-19]` **"Merge PR #35" was separately requested and executed.** Merged manually by the
  user via GitHub directly (the `gh pr merge` command was blocked twice in a row by this session's
  own tool-permission classifier, an unrelated local restriction — not a GitHub or CI-side block;
  the user completed the merge themselves rather than continuing to retry) with a real merge
  commit (not squash/rebase), matching every prior merge in this project's history — merge commit
  `2c53a526fc61e91c13b0a385ef9d895adc948896`. Both Vercel projects auto-deployed on push to `main`
  and were verified live directly, not just via CI's own Vercel status check — `dashboard-api`'s
  `/health` returned `build.commitSha ==
2c53a526fc61e91c13b0a385ef9d895adc948896`, confirming the exact merged commit is what's serving;
  `dashboard-web`'s `/` resolves (via the intermediate `/home` hop) to `/auth/sign-in` for an
  unauthenticated visitor, confirming the session gate is intact. **The cross-domain
  session-exchange fix for Google SSO login is now genuinely live in production.** Migration
  `00046` (`session_exchange_codes`) has not yet been run against the real production database —
  a real login attempt through the new `/auth/exchange` path will fail at the database layer until
  it is; running it remains a separate, not-yet-requested next step, per this project's standing
  credential-handling discipline (the user runs production migrations themselves, in their own
  terminal).
- `[2026-08-19]` **Migration `00046` run against production, then a real, same-day incident
  diagnosed and resolved: a Google SSO login attempted before the migration had actually landed
  failed with the generic "Your sign-in attempt expired" message.** User ran
  `pnpm --filter @webdesk/database run migrate` themselves (`prod-db.env` sourced in their own
  terminal, same discipline as every prior production migration) — output confirmed
  `Applied 1 migration(s): 00046-create-session-exchange-codes`. A real sign-in attempt
  immediately after reported "Sign-in failed — Your sign-in attempt expired. Please try again."
  Diagnosed directly from live Vercel runtime logs (via the user's own authenticated Chrome
  session on their Mac mini, paired through the extension's device-pairing flow — the sandboxed
  Browser pane has no Vercel login, same pattern as every prior live-log diagnosis this project has
  needed): two `GoogleAuthController#callback` errors at `10:07:37`/`10:07:44` UTC —
  `failed to issue session-exchange code`, a real Postgres `42P01` (`undefined_table`) error on
  `INSERT INTO "session_exchange_codes"`. **Root cause: the login attempt raced the migration** —
  it happened before `00046` had actually applied, so the table didn't exist yet at that exact
  moment; not a bug in the session-exchange code itself. No further errors were logged after
  `10:07:44`, and the very next real sign-in attempt (after the migration had genuinely landed)
  **completed successfully**, confirmed directly by the user. **A real, separate gap was found
  along the way and flagged, not fixed**: `dashboard-web`'s `/auth/exchange` route
  (`app/auth/exchange/route.ts`) currently maps _every_ failure — a missing code, a misconfigured
  `NEXT_PUBLIC_API_BASE_URL`, a network failure reaching `dashboard-api`, a malformed response
  body, and any non-2xx status from `POST /auth/exchange` **including a genuine backend 500** — to
  the same generic `reason=expired` message via its `redirectToAuthError()` helper. Only the
  `400` case (`redeem()` returning `null`, a genuinely invalid/expired code) actually means what
  the message says; every other case is a real error being mislabeled as an expired code, which is
  exactly what made this incident briefly ambiguous before the logs settled it. Recorded here as
  known, tracked debt — not fixed under this diagnosis, since fixing it means changing
  `route.ts`'s error taxonomy (e.g. distinct `reason` values per failure class), its own separate,
  not-yet-requested scope. **The cross-domain session-exchange fix for Google SSO login is now
  fully verified working end-to-end in production** — closing the original bug this whole PR #35
  effort was built to fix.
- `[2026-08-19]` **Built the `/auth/exchange` error-masking fix**, under the explicit "fix the
  /auth/exchange error masking" instruction. Branch `fix-auth-exchange-error-masking`, off `main`
  at `f9bb065`. Split the `reason` taxonomy used by `/auth/error` into `expired` (genuinely
  expired/invalid: missing OIDC transaction cookie, missing exchange code, backend `400`) and a
  new `error` (everything else: `GoogleAuthController#callback`'s `sessionExchange.issue()`
  failures — the exact shape of the incident just diagnosed — misconfiguration, network failures,
  unexpected non-2xx statuses, malformed response bodies), across both `dashboard-api`'s
  `GoogleAuthController` and `dashboard-web`'s `/auth/exchange` route. See
  `docs/implementation/session-exchange.md` §7 for the full account. Diagnostics-only: no change
  to session-cookie handling, `SameSite`, `OriginCheckGuard`, or actual success/failure outcomes —
  only which message the user sees and what gets logged. Updated the one existing test whose
  expectation this changed (`google-auth.controller.e2e-spec.ts`) and 3 of `dashboard-web`'s
  `auth-exchange-route.test.tsx` cases; left the missing-code and genuine-400 cases unchanged.
  Full validation: 370/370 `dashboard-api` unit tests, 111/111 `dashboard-api` e2e tests (real
  disposable local Postgres), 143/143 `dashboard-web` unit tests, typecheck/lint/`next build`/
  `nest build`/`pnpm exec prettier --check` all clean. Pushed as branch
  `fix-auth-exchange-error-masking`, opened as
  [PR #36](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/36).
- `[2026-08-19]` **Independent code review run on `fix-auth-exchange-error-masking` (PR #36), high
  effort — 8 finder angles, deduped to 7 candidates for 1-vote verification.** 1 CONFIRMED, 5
  PLAUSIBLE, 1 REFUTED (inline dated-incident comments — verified against a repo-wide grep to
  match an already-established local convention across both apps and packages, not a real
  deviation, so dropped). Under explicit "fix the confirmed findings" instruction, fixed the one
  CONFIRMED finding: `REASON_MESSAGES.error` was a hand-typed literal byte-identical to
  `DEFAULT_MESSAGE` with nothing tying them together — reordered `DEFAULT_MESSAGE`'s declaration
  above `REASON_MESSAGES` and referenced it directly instead of duplicating the string. The 5
  PLAUSIBLE findings (shared-type duplication for `AuthErrorReason` across `dashboard-api`/
  `dashboard-web` with no compiler enforcement — converged on independently by three finder
  angles; a sibling branch in `GoogleAuthController#callback` that still masks a missing/
  unparseable OIDC transaction cookie as `reason=expired` with zero logging, the identical bug
  class this PR fixes elsewhere in the same function; an unguarded `body.data` destructure in
  `dashboard-web`'s `/auth/exchange` route that could crash instead of showing the new error page
  if the two apps' response contracts ever briefly drift, verified not reachable with today's
  matched code; the `reason=error` bucket still collapsing five internally-distinguished failure
  classes into one identical message; and an undocumented, currently-unreachable assumption that
  a backend `400` always means "expired") were left open, not silently dropped. Re-validated:
  143/143 `dashboard-web` unit tests, typecheck/lint/`next build`/prettier all clean.
- `[2026-08-19]` **Security review run on `fix-auth-exchange-error-masking` (PR #36), separately
  from the code review.** 0 findings above threshold — confirmed diagnostics-only: the `reason`
  value on the redirect-emitting side is always one of two fixed string literals, never derived
  from attacker-controlled input; the `reason` value on the rendering side is user-controlled via
  `searchParams` but used only as a lookup key into a fixed message map rendered as plain JSX
  text, no `dangerouslySetInnerHTML`; no new internal error detail newly exposed to the browser;
  session-cookie/`OriginCheckGuard` logic untouched; no open-redirect surface (the target path is
  hardcoded, only a constrained two-literal query value changes). A review packet (published as a
  Claude artifact — code review + security review findings, the one fix, and the 5 open items,
  with an explicit decision section) was prepared for the required second-role human review,
  since the implementing agent cannot also be its own reviewer (ADR-0010).
- `[2026-08-19]` **Required second-role human review complete for `fix-auth-exchange-error-masking`
  (PR #36).** The review packet was reviewed. **Jitesh D reviewed it and returned "Approved
  as-is,"** accepting all 5 open PLAUSIBLE findings as tracked debt rather than requesting fixes
  before merge. See
  `docs/project-state/fix-auth-exchange-error-masking-approval-checklist.md`'s "Sign-off"
  section. A gate decision and merge authorization remain separate, not-yet-requested next steps.
- `[2026-08-19]` **The gate (G4-error-masking-fix) was then separately requested and approved** —
  WebDesk Solution, decision CONFIRM (clean pass, not an override, since the second-role review
  was already complete before the gate was requested), approved commit
  `f5ecff611261183e6ae9e03ee4edd6fd5ff3a34e` on branch `fix-auth-exchange-error-masking` — see
  `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
  `G4-error-masking-fix`) and
  `docs/project-state/fix-auth-exchange-error-masking-approval-checklist.md`'s "Sign-off" section.
  **This gate approval does not itself authorize merging PR #36 or a production deployment** —
  merge remains its own separate, not-yet-requested authorization, per this project's standing
  "no auto-merge" rule (same pattern as every prior gate).
- `[2026-08-19]` **"Merge PR #36" was separately requested and executed.** Waited for all 14 CI
  checks to go green first. Merged with a real merge commit (not squash/rebase), matching every
  prior merge in this project's history — merge commit
  `78aaa4ac0b5b0508d492a196ae9394b24e31b9ef`. Both Vercel projects auto-deployed on push to `main`
  and were verified live directly, not just via CI's own Vercel status check —
  `dashboard-api`'s `/health` returned `build.commitSha ==
78aaa4ac0b5b0508d492a196ae9394b24e31b9ef`, confirming the exact merged commit is what's serving;
  `dashboard-web`'s `/` resolves (via the intermediate `/home` hop) to `/auth/sign-in` for an
  unauthenticated visitor, confirming the session gate is intact. **The `/auth/exchange`
  error-masking fix is now genuinely live in production.** The 5 open PLAUSIBLE findings accepted
  as tracked debt during second-role review remain recorded in
  `docs/project-state/fix-auth-exchange-error-masking-approval-checklist.md` for future reference.
- `[2026-08-19]` **Fixed one of PR #36's 5 accepted-debt findings: the `AuthErrorReason`
  shared-type duplication.** Branch `fix-auth-error-reason-shared-type`, off `main` at `924ebb0`.
  Under the explicit "fix the shared-type duplication finding" instruction. Promoted a single
  `AuthErrorReason` type (`"expired" | "access_denied" | "error"`) into `packages/shared-types`,
  matching the existing precedent for cross-app-consistent literal unions (`AuthMethod`,
  `HealthStatus`, `SessionRevocationReason`) and this feature's own earlier `cookieName`
  echo-back pattern. `GoogleAuthController` (`dashboard-api`) now routes all three redirects
  through a new typed `redirectToAuthError()` helper instead of hand-written template strings;
  `dashboard-web`'s `/auth/exchange` route imports the shared type instead of a local copy;
  `/auth/error`'s `REASON_MESSAGES` is now typed `Record<AuthErrorReason, string>` (not
  `Record<string, string>`) via a new `isKnownReason()` type guard, so this file won't compile if
  a reason is ever added to the union without a matching message — closing the "future reason
  silently falls through" risk the original review flagged. No behavior change for any real
  request — type-safety-only. See `docs/implementation/session-exchange.md` §8. Validated:
  370/370 `dashboard-api` unit tests, 111/111 `dashboard-api` e2e tests (real disposable
  database), 143/143 `dashboard-web` unit tests, `dashboard-worker` typecheck (a third,
  unrelated consumer of `packages/shared-types`, confirmed unaffected), typecheck/lint/
  `next build`/`nest build`/`pnpm exec prettier --check` all clean. Pushed and opened as
  [PR #37](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/37). Not
  yet reviewed, gated, or merged — code review, security review, second-role human review, a
  gate decision, and merge authorization are each their own separate, not-yet-requested next
  step, unchanged from this project's standing discipline.
- `[2026-08-19]` **Independent code review run on `fix-auth-error-reason-shared-type` (PR #37),
  high effort — 8 finder angles, then all findings verified.** 7 candidates survived dedup (2
  CONFIRMED, 3 PLAUSIBLE, 2 REFUTED). Both CONFIRMED findings fixed per explicit "fix the confirmed
  findings" instruction: `isKnownReason()` used the `in` operator, which walks the prototype
  chain, so `?reason=constructor` on the public, unauthenticated `/auth/error` page resolved to an
  inherited `Object.prototype` function value instead of a string, crashing the page render when
  rendered as a JSX child — fixed with `Object.hasOwn()`; and the unrecognized-reason fallback
  logged nothing, undercutting the fix's own goal of catching cross-deploy drift between
  `dashboard-api` and `dashboard-web`'s independently-deployed Vercel projects — fixed with a
  `console.error` on that path only. The 2 REFUTED findings (widening `dashboard-web`'s
  route-local `AuthErrorReason` from 2 values to 3 — an acceptable, even necessary side effect of
  the actual fix; and the new `redirectToAuthError` being a private class method rather than a
  standalone function — the more idiomatic NestJS pattern given it needs `this.env`) were dropped.
  The 3 PLAUSIBLE findings (a narrow `reason=""` behavior change reachable only via a hand-typed
  URL; a `redirectToAuthError` name collision between the new `dashboard-api` controller method
  and the pre-existing `dashboard-web` route function; and the incident narrative restated across
  all 4 changed files' doc comments) were left open, not silently dropped. Added
  `apps/dashboard-web/tests/unit/auth-error-page.test.tsx` (6 new tests). Re-validated: 149/149
  `dashboard-web` unit tests, typecheck/lint/`next build`/`pnpm exec prettier --check` all clean.
  See `docs/implementation/session-exchange.md` §8a for the full account.
- `[2026-08-19]` **Security review run on `fix-auth-error-reason-shared-type` (PR #37), separately
  from the code review.** 0 findings above threshold. One candidate — the new `console.error` call
  logging the raw, attacker-controlled `reason` query-param value with no sanitization
  (`apps/dashboard-web/app/auth/error/page.tsx:60`) — was identified and independently filtered
  out at confidence 1/10, squarely under the standing "log spoofing / outputting unsanitized user
  input to logs is not a vulnerability" exclusion: no secondary sink exists (never rendered, never
  persisted, never used in a control-flow decision), and the attacker already knows the value
  being logged since it's their own query param. Also confirmed clean: the producing side
  (`redirectToAuthError()` in both apps) passes only fixed, compile-time-checked literals at every
  call site — never raw user input — so no injection or open-redirect risk exists via the `reason`
  param; and the rendering side never outputs raw `reason`, only one of three hardcoded strings via
  React JSX (auto-escaped, no `dangerouslySetInnerHTML`). A review packet (published as a Claude
  artifact — code review + security review findings, fixes, and the 3 open items, with an explicit
  decision section) was prepared for the required second-role human review, since the implementing
  agent cannot also be its own reviewer (ADR-0010). See
  `docs/project-state/fix-auth-error-reason-shared-type-approval-checklist.md`. Second-role human
  review, a gate decision, and merge authorization remain separate, not-yet-requested next steps.
- `[2026-08-19]` **Required second-role human review complete for
  `fix-auth-error-reason-shared-type` (PR #37).** The review packet (code review + security review
  findings, fixes, and the 3 open items, with an explicit decision section) was reviewed. **Jitesh
  D reviewed it and returned "Approved as-is,"** accepting all 3 open PLAUSIBLE findings as tracked
  debt rather than requesting fixes. See
  `docs/project-state/fix-auth-error-reason-shared-type-approval-checklist.md`'s "Sign-off"
  section. A gate decision and merge authorization remain separate, not-yet-requested next steps.
- `[2026-08-19]` **The gate (G4-shared-type-fix) was then separately requested and approved** —
  WebDesk Solution, decision CONFIRM (clean pass, not an override, since the second-role review
  was already complete before the gate was requested), approved commit
  `b9cae0f8f645640f1aead0d39f219e851fe71a02` on branch `fix-auth-error-reason-shared-type` — see
  `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
  `G4-shared-type-fix`) and
  `docs/project-state/fix-auth-error-reason-shared-type-approval-checklist.md`'s "Sign-off"
  section. **This gate approval does not itself authorize merging PR #37 or a production
  deployment** — merge remains its own separate, not-yet-requested authorization, per this
  project's standing "no auto-merge" rule (same pattern as every prior gate).
- `[2026-08-19]` **"Merge PR #37" was separately requested and executed.** Waited for all 14 CI
  checks to go green first. Merged with a real merge commit (not squash/rebase), matching every
  prior merge in this project's history — merge commit
  `013c620ce55172741daac7a82553fc8933758726`. Both Vercel projects auto-deployed on push to `main`
  and were verified live directly, not just via CI's own Vercel status check —
  `dashboard-api`'s `/health` returned `build.commitSha ==
013c620ce55172741daac7a82553fc8933758726`, confirming the exact merged commit is what's serving;
  `dashboard-web`'s `/` resolves (via the intermediate `/home` hop) to `/auth/sign-in` for an
  unauthenticated visitor, confirming the session gate is intact. **The `AuthErrorReason`
  shared-type fix is now genuinely live in production.**
- `[2026-08-19]` **Closed the remaining PR #36 accepted-debt items in one consolidated batch**,
  under the explicit "fix the sibling OIDC-cookie branch... and if anything remaining then please
  do it all together, it is wasting time after fixing one issue and go through the long process
  and then do it same for the next issue" instruction — every remaining open item from both PR
  #36's and PR #37's own accepted-debt lists was checked and, where real, fixed together in a
  single branch (`fix-remaining-session-exchange-debt`), so the code-review → security-review →
  second-role-review → gate → merge cycle runs once for the whole batch instead of once per item.
  Two real bugs fixed: (1) `GoogleAuthController#callback`'s `if (!transaction)` branch — the
  sibling of the already-fixed `sessionExchange.issue()` masking bug — collapsed "no OIDC
  transaction cookie sent" (genuinely expired) and "cookie sent but malformed/invalid" (a real
  anomaly) into the identical `reason=expired` redirect with zero logging for the malformed case;
  fixed by widening `readOidcTransactionCookie` (`oidc-transaction.ts`) to a discriminated
  `OidcTransactionReadResult` (`"missing" | "invalid" | "ok"`), so only the genuinely-missing case
  stays unlogged `reason=expired` and the malformed case now logs and redirects `reason=error`.
  (2) An unguarded `body.data` destructure in `dashboard-web`'s `/auth/exchange` route that would
  throw an uncaught exception instead of a clean error redirect on a future API-contract drift;
  fixed with a new `isSessionExchangeSuccessBody()` type guard. Two items reviewed and closed with
  no code change: the "backend 400 always means expired" assumption is now documented directly as
  a code comment recording exactly why it currently holds and when it would stop holding; the
  `reason=error` bucket's single generic user-facing message was confirmed already diagnosable
  operator-side via each cause's own distinct server-side log line, so no change was needed there
  either. PR #37's own 3 open accepted-debt items were also re-checked and confirmed genuinely not
  needing a change. See `docs/implementation/session-exchange.md` §9 for the full account. New
  tests: `oidc-transaction.spec.ts` (5 new unit tests covering all three
  `readOidcTransactionCookie` outcomes), 2 new `google-auth.controller.e2e-spec.ts` e2e tests
  (missing-cookie and malformed-cookie paths), 2 new `auth-exchange-route.test.tsx` tests
  (`data`-less and wrong-typed response bodies). Validated: 375/375 `dashboard-api` unit tests (5
  new), 113/113 `dashboard-api` e2e tests (2 new, real disposable database), 28/28
  `packages/database` integration tests (unaffected, confirmed still green), 151/151
  `dashboard-web` unit tests (2 new), typecheck/lint/`next build`/`nest build`/
  `pnpm exec prettier --check` all clean. Pushed as branch `fix-remaining-session-exchange-debt`,
  opened as
  [PR #38](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/38). Not
  yet reviewed, gated, or merged — code review, security review, second-role human review, a
  gate decision, and merge authorization remain each their own separate, not-yet-requested next
  step, but — per the explicit instruction — bundled as ONE pass across this whole batch, not
  repeated per item.
- `[2026-08-19]` **Independent code review run on `fix-remaining-session-exchange-debt` (PR #38),
  high effort — 8 finder angles, 1-vote verification.** 6 candidates survived dedup (3 CONFIRMED,
  3 PLAUSIBLE). 4 fixed in this same round per the "move forward now" authorization to proceed
  through code review then security review as one pass: (1) a `NaN` `expiresAt` — `data.expiresAt`
  was checked for being a `string` but not a _parseable_ date — flowed through
  `Math.max(0, Math.floor(...))` (any `NaN` argument to `Math.max` propagates) into
  `cookieStore.set(..., { maxAge: NaN })`; this doesn't throw — Next.js's Edge Runtime
  `@edge-runtime/cookies` only checks `typeof maxAge === "number"`, and `typeof NaN === "number"`
  is `true`, so it emits a literal `Max-Age=NaN` header that every mainstream browser then ignores
  per RFC 6265, silently degrading the new session cookie to session-only; fixed by extending
  `isSessionExchangeSuccessBody`'s validation to reject an unparseable `expiresAt` before any
  cookie is set. (2) The new "invalid" OIDC-transaction-cookie status (from the prior fix round)
  still collapsed a JSON-parse failure and a shape mismatch into one undifferentiated case with no
  way for the log line to say which happened; fixed with a new `reason: "parse" | "shape"` field
  on `OidcTransactionReadResult`'s `"invalid"` variant. (3) `isSessionExchangeSuccessBody` claimed
  the full response shape (`success`/`correlationId` included, via `ApiSuccessResponse<T>`) but
  only ever validated `data`'s leaf fields — an unsound type predicate that let unchecked fields be
  trusted as compiler-guaranteed-present; fixed with explicit `success !== true`/
  `typeof correlationId !== "string"` checks. (4, PLAUSIBLE) the shape-mismatch log branch logged
  the raw response body directly, which could leak a live, redeemable session token on a future
  backend contract drift; fixed with a new `describeUnexpectedBody()` helper logging only a safe,
  values-free summary (`typeOf` or `topLevelKeys`, never field values). 2 findings left flagged,
  not fixed, as genuinely larger in scope than this PR: `getServerSession()`'s degrade-vs-throw
  pattern is now hand-repeated across 9+ `dashboard-web` call sites with no shared helper (a real
  `dashboard-web` data-layer refactor, out of scope for a debt-closure PR); and
  `OidcTransactionReadResult`'s `status: "ok"` discriminant diverges from the codebase's
  `ApiSuccessResponse`/`success: true` convention (a naming-convention observation, not a
  functional bug — this type never crosses a wire boundary, so importing that convention's
  wire-format assumptions has no real use here). See `docs/implementation/session-exchange.md`
  §10 for the full account. Re-validated: 375/375 `dashboard-api` unit tests (3 updated
  assertions), 113/113 `dashboard-api` e2e tests (unchanged), 155/155 `dashboard-web` unit tests
  (4 new), typecheck/lint/`next build`/`nest build`/`pnpm exec prettier --check` all clean across
  both apps. Security review remains the next step, per the same "one pass" plan.
- `[2026-08-19]` **Security review run on `fix-remaining-session-exchange-debt` (PR #38),
  separately from the code review.** 0 findings above threshold. Confirmed both changed areas
  preserve prior security-relevant behavior exactly while adding diagnostics/validation that
  didn't exist before: the `"missing"` vs `"invalid"` OIDC-cookie split both still redirect to
  `/auth/error` in every case (no bypass, state/nonce/PKCE verification untouched);
  `isSessionExchangeSuccessBody()` only adds a runtime check that didn't exist before (the prior
  code trusted an unchecked TS cast); `describeUnexpectedBody()` deliberately avoids logging raw
  response-body values that could carry a live, redeemable session token on a future contract
  drift; the exchange-code redemption path's atomic single-use conditional-UPDATE and 60s TTL are
  untouched. Two informational, not-a-vulnerability observations were considered and excluded per
  standing review criteria (the type guard not rejecting empty-string `sessionToken`/`cookieName`
  — no realistic exploit, the response originates from this route's own trusted server-to-server
  call; and the "invalid" branch logging a fixed diagnostic plus a two-value enum — log-spoofing
  class). A review packet (published as a Claude artifact — the consolidated-batch account, the
  round-2 code-review findings/fixes, the security-review disposition, and validation evidence,
  with a decision section) was prepared for the required second-role human review, since the
  implementing agent cannot also be its own reviewer (ADR-0010). **Jitesh D reviewed it and
  returned "Approved as-is,"** accepting the 2 open PLAUSIBLE code-review findings as tracked
  debt rather than requesting fixes before merge — see
  `docs/project-state/fix-remaining-session-exchange-debt-approval-checklist.md`'s "Sign-off"
  section. A gate decision and merge authorization remain separate, not-yet-requested next steps.
- `[2026-08-19]` **The gate (G4-session-exchange-debt-closure) was then separately requested and
  approved** — WebDesk Solution, decision CONFIRM (clean pass, not an override, since the
  second-role review was already complete before the gate was requested), approved commit
  `11aa6d0` on branch `fix-remaining-session-exchange-debt` — see
  `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
  `G4-session-exchange-debt-closure`) and
  `docs/project-state/fix-remaining-session-exchange-debt-approval-checklist.md`'s "Sign-off"
  section. **This gate approval does not itself authorize merging PR #38 or a production
  deployment** — merge remains its own separate, not-yet-requested authorization, per this
  project's standing "no auto-merge" rule (same pattern as every prior gate).
- `[2026-08-19]` **User reported the live Home page (`/home`) looked "very very simple"** (a
  screenshot of the production page — flat-bordered list items, no color, no visual hierarchy).
  Rather than assume the approved "Clean Enterprise" design system itself was too plain, ran a
  dedicated research agent to check whether the page was actually using it — found it wasn't: the
  Home page still imported none of the ~30 `packages/ui` components PR #33 added, and
  `docs/design/dashboard-ui/15-representative-screen-specifications.md` §1 already specifies a
  real widget-grid layout for exactly this screen, approved but never implemented; the design
  system's own `16-existing-shell-gap-analysis.md` §2 already names this page as one of two still
  on stale inline styling. Presented this diagnosis and asked how to scope the fix (Home only,
  Home + `/projects`, or a bigger visual-direction change); **the user chose "wire up what already
  exists."** Built the four-widget grid (Project Health/My Work/Critical Findings/Git-Release-
  Status) and rebuilt the module grid with `Card`/`Badge`, live-verified in the Browser pane via
  this project's own sanctioned test-only session bypass. See "Active tasks" item 23 and
  `docs/implementation/dashboard-web-home-widget-grid.md` for the full account. Pushed as branch
  `dashboard-web-home-widget-grid` — not yet reviewed, gated, or merged.
- `[2026-08-19]` **User said the UI "still looks simple" even with the widget grid live** — "the
  UX is good but the UI must be good in look." Rather than iterate blindly in code a third time,
  drafted 3 full visual directions as a design canvas (real mockups of the actual Home page
  content — Current, "Enterprise Plus," "Modern SaaS" — not abstract color swatches) and asked the
  user to pick one directly. **The user picked Enterprise Plus.** Before building, flagged that
  the mockup's header/sidebar are shared components every page renders through, not something
  Home-specific, and asked whether to scope the change to Home only or the whole app — **the user
  chose the whole app.** Built on the same branch as item 23 (still unreviewed): new `packages/ui`
  design tokens (indigo/violet accent, warm surfaces, Sora+Public Sans via `next/font/google`,
  richer card radius/shadow), a dark header + tinted active-nav sidebar in `AppShell`, and real
  per-module icons via a newly-added `lucide-react` dependency wired against the `iconReference`
  field every module has carried since migration `00035` with no icon library to consume it until
  now. Every new color pair checked against the real WCAG formula, not eyeballed. 157/157
  `dashboard-web` + 79/79 `packages/ui` unit tests, 15/15 Playwright tests (including both
  authenticated-shell axe-core scans, 0 violations), typecheck/lint/build/prettier clean,
  `pnpm audit` 0 vulnerabilities. Live-rendered in the Browser pane to confirm the actual output,
  not just typechecked blind. See "Active tasks" item 24 and
  `docs/implementation/dashboard-web-visual-refresh.md` for the full account. Not yet reviewed,
  gated, or merged — will go through that cycle together with item 23 as one unit.
- `[2026-08-19]` **Independent code review run on `dashboard-web-home-widget-grid` (PR #39), high
  effort — 8-angle finder pass against the full diff covering both items 23 and 24.** 9 findings
  survived verification (7 CONFIRMED, 2 PLAUSIBLE). All 7 CONFIRMED fixed per explicit "fix the
  confirmed findings" instruction — most severe, `toCssCustomProperties()` (pre-existing,
  untouched by this PR) double-prefixed every typography CSS custom property, so the new
  Sora/Public Sans fonts silently never applied anywhere in the app; fixed generically and
  verified live via `getComputedStyle`. Also fixed: the Git/Release widget's "Deployed" label
  actually showing serverless cold-start time (renamed to "Instance started"); two reuse gaps
  (`projectStatusBadge()`, a duplicated `Fact` component now promoted to `packages/ui`); a real
  React-Server-Components crash from promoting `IconBadge` into a `"use client"` file (fixed by
  switching its `icon` prop to `ReactNode`); `moduleIcon()` now logging an unrecognized
  `iconReference`; and the icon-only sidebar's per-module distinctiveness restored via a monogram
  fallback. 2 PLAUSIBLE findings left as tracked debt. Re-validated: 162/162 `dashboard-web` unit
  tests (4 new), 79/79 `packages/ui` unit tests, 15/15 Playwright tests, typecheck/lint/`next
build`/prettier clean, `pnpm audit` 0 vulnerabilities. See
  `docs/implementation/dashboard-web-visual-refresh.md` §6 for the full account.
- `[2026-08-19]` **Security review run on `dashboard-web-home-widget-grid` (PR #39), separately
  from the code review, against the fixed branch (commit `a71d2bc`).** 0 findings above threshold
  — confirmed no new user input reaches a dangerous sink (icon references, module status, project
  status, and release metadata are all backend-sourced from already-RBAC-gated responses); no
  `dangerouslySetInnerHTML` or other unsafe-render method introduced; the new `moduleIcon()` log
  call carries only a registry icon-name key, never PII; no auth/session/cookie/
  `OriginCheckGuard`/`PermissionGuard` logic touched (presentation-only on already-authenticated,
  already-permission-filtered data); the `deployedAt` → `instanceStartedAt` rename is a labeling
  correction, not a new exposure; `next/font/google` self-hosts both font files at build time with
  no new runtime third-party call. A review packet (published as a Claude artifact — code review +
  security review findings, fixes, and validation evidence, with a decision section) was then
  prepared for the required second-role human review, since the implementing agent cannot also be
  its own reviewer (ADR-0010). See
  `docs/project-state/dashboard-web-visual-refresh-approval-checklist.md`. **Awaiting the
  second-role reviewer's decision** — a gate decision and merge authorization remain separate,
  not-yet-requested next steps.
- `[2026-08-19]` **Required second-role human review complete for
  `dashboard-web-home-widget-grid` (PR #39).** The review packet (code review + security review
  findings, fixes, and the 2 open tracked-debt items, with a decision section) was reviewed.
  **Jitesh D reviewed it and returned "Approved as-is,"** accepting the 2 open PLAUSIBLE
  code-review findings as tracked debt rather than requesting fixes. See
  `docs/project-state/dashboard-web-visual-refresh-approval-checklist.md`'s "Sign-off" section. A
  gate decision and merge authorization remain separate, not-yet-requested next steps.
- `[2026-08-19]` **The gate (G4-visual-refresh) was then separately requested and approved** —
  WebDesk Solution, decision CONFIRM (clean pass, not an override, since the second-role review
  was already complete before the gate was requested), approved commit `9eb8f28` on branch
  `dashboard-web-home-widget-grid` — see `outputs/webdesk-growth-dashboard/project.json`'s
  `gates[]` (`current_gate` now `G4-visual-refresh`) and
  `docs/project-state/dashboard-web-visual-refresh-approval-checklist.md`'s "Sign-off" section.
  **This gate approval does not itself authorize merging PR #39 or a production deployment** —
  merge remains its own separate, not-yet-requested authorization, per this project's standing
  "no auto-merge" rule (same pattern as every prior gate).
- `[2026-08-19]` **"Merge PR #39" was separately requested and executed.** Waited for all 14 CI
  checks to go green first — one, "Formatting validation," initially failed on a prettier
  table-alignment drift in the approval checklist committed with the gate approval; fixed and
  pushed as commit `7a085dd` before merging. Merged with a real merge commit (not squash/rebase),
  matching every prior merge in this project's history — merge commit
  `7728830065c0d14a306216209a0f087b64fbddf0`. Both Vercel projects auto-deployed on push to `main`
  and were verified live directly, not just via CI's own Vercel status check — `dashboard-api`'s
  `/health` returned `build.commitSha ==
7728830065c0d14a306216209a0f087b64fbddf0`, confirming the exact merged commit is what's serving;
  `dashboard-web`'s `/` resolves (via the intermediate `/home` hop) to `/auth/sign-in` for an
  unauthenticated visitor, confirming the session gate is intact. **The `dashboard-web` Home
  widget grid and whole-app visual refresh are now genuinely live in production.**
- `[2026-08-19]` **User reported two real divergences from the approved "Enterprise Plus" mockup on
  the now-live Home page**: the sidebar stayed on the light `surface` fill (the mockup shows a
  continuous dark rail spanning header + sidebar together — item 24's build only made the header
  dark), and the "Available to you" module grid rendered 5 columns at desktop width, not the
  mockup's roomier 4. Built directly on branch `dashboard-web-sidebar-grid-fix`, off `main` at
  `ea9c9b8` (the PR #39 merge commit): the module grid's `minmax(240px, 1fr)` → `minmax(280px,
1fr)`, and the sidebar's `.sidebar`/`.sidebarLink`/`.navGroupLabel`/`.clusterLabel`/
  `.sidebarLinkActive` switched from the light `surface`/`accentTint` token pair to the header's own
  dark `headerBackground`/`accent` pair. Along the way, caught and fixed a real WCAG 2.2 SC 1.4.11
  non-text-contrast regression this color change would otherwise have introduced (the shared
  focus-ring outline's contrast against the new dark sidebar dropped to ~2.1:1, under the 3:1
  minimum) with a targeted `.sidebarLink:focus-visible` override. 162/162 `dashboard-web` + 79/79
  `packages/ui` unit tests, typecheck/lint/`check-css-tokens.mjs`/`next build`/prettier all clean.
  Live-verified via `getComputedStyle` that every changed color and the grid's column count matched
  the intended values exactly. Pushed as branch `dashboard-web-sidebar-grid-fix`, opened as
  [PR #40](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/40).
- `[2026-08-19]` **Immediately after, the user pasted a reference screenshot of the sidebar and
  said directly: keep it light, not dark, and make it compact.** A genuine direction change from
  the just-shipped dark-sidebar fix, not a bug report — followed as the user's own most-recent
  explicit instruction over the earlier mockup-matching one. Reverted `.sidebar`/`.clusterLabel`/
  `.navGroupLabel`/`.sidebarLink`/`.sidebarLink:hover`/`.sidebarLinkActive` back off the `header*`
  tokens onto light-surface tokens — `.sidebar` now uses `colorTokens.surfaceRaised` (pure white)
  rather than either the dark `headerBackground` or the original pre-refresh `surface` (a warm
  cream), reading as a distinct white panel against the slightly warmer `background` the main
  content sits on; `.sidebarLinkActive` reverts to `accentTint`/`accent`, matching the reference
  screenshot exactly. Removed the `.sidebarLink:focus-visible` override added the prior commit — no
  longer needed on a light surface. For "compact," tightened every spacing value controlling the
  sidebar's vertical density (padding, margins, gaps) rather than shrinking type — the full
  15-module navigation tree now fits without scrolling at a typical 900px-tall window. 79/79
  `packages/ui` + 162/162 `dashboard-web` unit tests (unchanged), typecheck/lint/
  `check-css-tokens.mjs`/`next build`/prettier all clean. Live-verified via `getComputedStyle` that
  every color and the link padding matched the intended values exactly.
- `[2026-08-19]` **Independent code review run on `dashboard-web-sidebar-grid-fix` (PR #40),
  medium effort — 8-angle finder pass against the full diff (net of both commits).** 6 findings
  survived verification (3 CONFIRMED, 3 PLAUSIBLE) — all 8 angles independently converged on the
  same two underlying issues, meaningfully increasing confidence in both. Most severe, and the
  only one with real functional impact: the "4 columns" fix from the first commit only actually
  reached 4 columns once available content width hit `ContentContainer`'s 1280px cap, needing a
  viewport of roughly 1492px+ — at common laptop resolutions (1366×768, 1440×900) it silently
  rendered 3 columns, not 4, the exact undershoot bug it was built to fix, just relocated to a
  lower number. My own live verification had only checked 1280px and 1920px, never a mid-range
  width where the gap actually shows. Fixed by replacing the `auto-fill`/`minmax` approach with an
  explicit, breakpoint-driven CSS Module (new `app/(shell)/home/page.module.css`):
  `repeat(N, minmax(0, 1fr))` at each of the four real `breakpointTokens` values
  (480/768/1024/1280px) — no per-column minimum floor, so exactly N columns render at each
  breakpoint regardless of container width. Verified live at the exact boundary: 1279px → 3
  columns, 1280px → 4, 1440px → 4 (previously 3). Also fixed: a stale, wrong contrast-ratio comment
  (`foregroundSubtle` claimed "2.45:1," contradicting `tokens.ts`'s own documented 3.88:1 for the
  identical pair; `foregroundMuted` claimed "7+:1," the real figure is 6.08:1 — both independently
  recomputed with the real WCAG formula); hardcoded `2px`/`1px` spacing literals that bypassed the
  token system entirely, invisible to `check-css-tokens.mjs` (fixed by adding a real
  `spacingTokens["2xs"]` tier, `0.125rem`/2px, and using it consistently across all three touched
  sites); and an ambiguous comment ("after seeing the dark-sidebar direction live") that could be
  misread as a production rollback given this project's own vocabulary conventions — reworded to
  make explicit this was a local dev-preview render on an unmerged branch, never deployed. 2
  PLAUSIBLE findings left as tracked debt: the new `spacingTokens["2xs"]` is a third, numerically
  different "tight spacing" value alongside an existing undocumented `gap: 0.1rem` (1.6px)
  convention already used in `project-roster-section.module.css` and `user-picker.module.css` (full
  reconciliation is a larger, separate task); and `app-shell.test.tsx` has no computed-style
  assertions for any of the sidebar colors/spacing this branch touches (a pre-existing testing gap,
  not introduced by this diff). Re-validated: 79/79 `packages/ui` unit tests (1 updated —
  `spacingTokens` key list), 162/162 `dashboard-web` unit tests, typecheck/lint/
  `check-css-tokens.mjs` (now checking 9 CSS Module files, up from 8)/`next build`/prettier all
  clean.
- `[2026-08-19]` **Security review run on `dashboard-web-sidebar-grid-fix` (PR #40), separately
  from the code review.** 0 findings above threshold — pure CSS Module/design-token/layout changes
  with no user input, data handling, new endpoint, or dependency anywhere in scope; every value
  changed (grid columns, colors, spacing) is a static, compile-time constant injected as a CSS
  custom property, never attacker-influenceable; no `dangerouslySetInnerHTML` or other
  unsafe-render method anywhere in the diff. A review packet (published as a Claude artifact — code
  review + security review findings, fixes, and validation evidence, with a decision section) was
  then prepared for the required second-role human review, since the implementing agent cannot
  also be its own reviewer (ADR-0010). See
  `docs/project-state/dashboard-web-sidebar-grid-fix-approval-checklist.md`.
- `[2026-08-19]` **Required second-role human review complete for
  `dashboard-web-sidebar-grid-fix` (PR #40).** The review packet (code review + security review
  findings, fixes, and the 2 open tracked-debt items, with a decision section) was reviewed.
  **Jitesh D reviewed it and returned "Approved as-is,"** accepting the 2 open PLAUSIBLE
  code-review findings as tracked debt rather than requesting fixes. See
  `docs/project-state/dashboard-web-sidebar-grid-fix-approval-checklist.md`'s "Sign-off" section. A
  gate decision and merge authorization remain separate, not-yet-requested next steps.
- `[2026-08-19]` **The gate (G4-sidebar-grid-fix) was then separately requested and approved** —
  WebDesk Solution, decision CONFIRM (clean pass, not an override, since the second-role review
  was already complete before the gate was requested), approved commit `c49904a` on branch
  `dashboard-web-sidebar-grid-fix` — see `outputs/webdesk-growth-dashboard/project.json`'s
  `gates[]` (`current_gate` now `G4-sidebar-grid-fix`) and
  `docs/project-state/dashboard-web-sidebar-grid-fix-approval-checklist.md`'s "Sign-off" section.
  **This gate approval does not itself authorize merging PR #40 or a production deployment** —
  merge remains its own separate, not-yet-requested authorization, per this project's standing
  "no auto-merge" rule (same pattern as every prior gate).
- `[2026-08-19]` **"Merge PR #40" was separately requested and executed.** Waited for all 14 CI
  checks to go green first. Merged with a real merge commit (not squash/rebase), matching every
  prior merge in this project's history — merge commit
  `bd9743966a8b2406eac7656ccb0e8d502463acde`. Both Vercel projects auto-deployed on push to `main`
  and were verified live directly, not just via CI's own Vercel status check — `dashboard-api`'s
  `/health` returned `build.commitSha ==
bd9743966a8b2406eac7656ccb0e8d502463acde`, confirming the exact merged commit is what's serving;
  `dashboard-web`'s `/home` correctly redirects an unauthenticated visitor to `/auth/sign-in`,
  confirming the session gate is intact. **The `dashboard-web` sidebar & module-grid fix is now
  genuinely live in production.**
- `[2026-08-19]` **User shared a screenshot of Vercel's own dashboard sidebar as a reference** and
  asked to adapt our sidebar's row spacing and selection styling toward it — specifically "the
  spacing between menu and selection." Built directly on branch
  `dashboard-web-sidebar-vercel-spacing`, off `main` at `eb1ec99` (the PR #40 merge commit): widened
  `.sidebar`'s outer padding `space-sm` → `space-md`, `.sidebarLink`'s padding to uniform `space-sm`
  (taller ~34px rows), corner radius `radius-sm` → `radius-md`, and `.navList`'s row gap `space-2xs`
  → `space-xs` — organization/spacing only, keeping our own light palette and indigo accent.
  **While live-verifying this (checking computed styles, not a screenshot), found a second real,
  independent, previously-undiscovered bug**: the currently-active sidebar link has never actually
  inherited any of `.sidebarLink`'s layout properties, since `app-shell.tsx` applied
  `sidebarLink`/`sidebarLinkActive` as mutually-exclusive classes and `sidebarLinkActive` only ever
  declared `background`/`color`/`font-weight` — verified live before the fix: `display: inline`,
  `padding: 0px`, `border-radius: 0px`, `text-decoration-line: underline`, on every page, in every
  deployment, invisible to every prior verification pass since those only checked
  `background-color`/`color`, never layout. Fixed at the source: `app-shell.tsx`'s two `className`
  assignments now always apply `styles.sidebarLink`, with `styles.sidebarLinkActive` layered on
  conditionally — the correct base-class-plus-modifier composition. Re-verified live:
  `display: flex`, `align-items: center`, `gap: 8px`, `padding: 8px`, `border-radius: 8px`,
  `text-decoration-line: none`, `height: 34px`, matching every other link's layout with the accent
  styling on top; the icon-only collapsed state re-verified separately (unaffected). 162/162
  `dashboard-web` unit tests (unchanged), typecheck/lint/`check-css-tokens.mjs`/`next build`/
  prettier all clean. Pushed as branch `dashboard-web-sidebar-vercel-spacing`, opened as
  [PR #41](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/41).
- `[2026-08-19]` **Independent code review run on `dashboard-web-sidebar-vercel-spacing` (PR #41),
  medium effort — 8-angle finder pass.** 5 findings survived verification (1 CONFIRMED, 4
  PLAUSIBLE) — three of the eight angles independently converged on the same defect from different
  directions, meaningfully increasing confidence in it. Most severe: the base fix's own change
  (always applying `.sidebarLink`) newly exposed a CSS specificity conflict —
  `.sidebarLink:hover` (specificity 0,2,0) unconditionally beat the standalone `.sidebarLinkActive`
  (0,1,0) for the `background`/`color` properties both declare, so hovering the _currently-active_
  nav link washed its accent styling out to the plain gray hover treatment — structurally
  impossible before this PR's own fix (the active link never carried `.sidebarLink` at all, so
  `:hover` could never match it). Fixed by rewriting `.sidebarLinkActive` as the compound selector
  `.sidebarLink.sidebarLinkActive` — specificity (0,2,0), tying with `.sidebarLink:hover` instead
  of losing outright, with the tie broken by source order (declared after `:hover`) in its favor —
  also more accurate, since this class can never actually appear without `.sidebarLink` in the DOM.
  Verified live via a real mouse hover (not a simulated state) — `element.matches(':hover')`
  confirmed `true` while `getComputedStyle` still showed the correct accent background/text color.
  Also fixed 2 cheap PLAUSIBLE findings: the icon-only rail's now-redundant compound selector
  (`.sidebarLinkActive` can never appear alone, so the second clause was dead) simplified to a
  single clause; and two comments that referenced "the Vercel reference the user pointed at" and
  "this branch never deployed" with no durable rationale reworded to state the numeric reasoning on
  their own terms. 2 PLAUSIBLE findings left as tracked debt: `.sidebarLink`'s new `radius-md`
  (8px) doesn't match `packages/ui`'s existing `Dropdown`/`CommandMenu` menu-item pattern
  (`radius-sm`, 4px) — a pre-existing design-consistency gap this PR's change happened to surface,
  not something a sidebar-focused PR should expand scope to reconcile; and
  `project-status-actions.tsx` has the identical fragile "pick one class or the other" ternary
  shape that caused the original bug, currently safe only because its own CSS Module happens to
  write the shared layout as a combined selector — flagged for future awareness, not fixed.
  Re-validated: 162/162 `dashboard-web` unit tests (unchanged), typecheck/lint/
  `check-css-tokens.mjs`/`next build`/prettier all clean.
- `[2026-08-19]` **Security review run on `dashboard-web-sidebar-vercel-spacing` (PR #41),
  separately from the code review.** 0 findings above threshold — pure CSS Module selector/spacing
  changes and a `className` composition fix, with no user input, data handling, new endpoint, or
  dependency anywhere in scope; the `className` template literal composes only fixed,
  build-generated CSS Module class references, nothing attacker-controlled reaches it; no auth/
  session/cookie logic touched. A review packet (published as a Claude artifact — code review +
  security review findings, fixes, and validation evidence, with a decision section) was then
  prepared for the required second-role human review, since the implementing agent cannot also be
  its own reviewer (ADR-0010). See
  `docs/project-state/dashboard-web-sidebar-vercel-spacing-approval-checklist.md`.
- `[2026-08-19]` **Required second-role human review complete for
  `dashboard-web-sidebar-vercel-spacing` (PR #41).** The review packet (code review + security
  review findings, fixes, and the 2 open tracked-debt items, with a decision section) was
  reviewed. **Jitesh D reviewed it and returned "Approved as-is,"** accepting the 2 open PLAUSIBLE
  code-review findings as tracked debt rather than requesting fixes. See
  `docs/project-state/dashboard-web-sidebar-vercel-spacing-approval-checklist.md`'s "Sign-off"
  section. A gate decision and merge authorization remain separate, not-yet-requested next steps.
- `[2026-08-19]` **The gate (G4-sidebar-vercel-spacing) was then separately requested and
  approved** — WebDesk Solution, decision CONFIRM (clean pass, not an override, since the
  second-role review was already complete before the gate was requested), approved commit
  `6adf852` on branch `dashboard-web-sidebar-vercel-spacing` — see
  `outputs/webdesk-growth-dashboard/project.json`'s `gates[]` (`current_gate` now
  `G4-sidebar-vercel-spacing`) and
  `docs/project-state/dashboard-web-sidebar-vercel-spacing-approval-checklist.md`'s "Sign-off"
  section. **This gate approval does not itself authorize merging PR #41 or a production
  deployment** — merge remains its own separate, not-yet-requested authorization, per this
  project's standing "no auto-merge" rule (same pattern as every prior gate).
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
