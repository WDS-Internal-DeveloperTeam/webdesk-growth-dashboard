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
    (2026-08-18): gaps (2) and (3) built — see item 18.** Gaps (4) and (5) remain not started.
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
    call. **A review packet (published as a Claude artifact — code review + security review
    findings, fixes, and validation evidence, with a decision section) was then prepared for the
    required second-role human review, since the implementing agent cannot also be its own
    reviewer (ADR-0010).** See `docs/project-state/dashboard-web-visual-refresh-approval-checklist.md`.
    **Awaiting the second-role reviewer's decision** — a gate decision and merge authorization
    remain separate, not-yet-requested next steps. Since this branch/PR is still unreviewed on
    those fronts, both items 23 and 24's changes will go through that remaining cycle together as
    one unit, not separately.

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
