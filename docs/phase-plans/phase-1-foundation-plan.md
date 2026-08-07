# Phase 1 Foundation Plan

**Status:** Draft. Not started. Requires human approval of `docs/project-state/phase-0-approval-checklist.md` before Task 1 begins. Each task below requires its own approval before starting, not just Phase 0's overall sign-off.

Thirteen small, approval-gated tasks, in dependency order. No task in this plan is executed by this Phase 0 work — it is the plan Phase 1 executes against.

---

### Task 1 — Repository and monorepo scaffold

**Status: Complete, as "Phase 1A" — awaiting approval.** Executed 2026-08-06 under separate, explicit Phase 1A authorization (see `docs/project-state/phase-1a-approval-checklist.md`). Delivered more than the minimal "empty stubs" scope described below — real, tested foundations (Next.js/NestJS/handler scaffolds, all 6 packages, CI, dependency-boundary enforcement) rather than placeholders — see `docs/project-state/phase-1a-validation-report.md` for the exact validation record. The description below is preserved as the original Task 1 plan, not rewritten after the fact.

- **Purpose:** Scaffold the Turborepo workspace (`turbo.json`, `pnpm-workspace.yaml`, empty `apps/*`/`packages/*` stubs) per `docs/repository-plan/dashboard-monorepo-plan.md`, in the git repository already initialized in Phase 0 (`WDS-Dashboard/`, `origin` remote already registered pointing at `WDS-Internal-DeveloperTeam/webdesk-growth-dashboard.git` — **not yet confirmed to exist on GitHub**, and not yet pushed to).
- **Dependencies:** ADR-0001 approved. **The local scaffold itself does not depend on the remote GitHub repository existing** — it can be built and committed locally first. Pushing to `origin` (a separate sub-step within this task) does depend on the remote existing; if it doesn't yet, create it or confirm with PM/infrastructure owner before that sub-step, without blocking the local scaffold work. **GitHub App creation (ADR-0011, for CI/webhooks) is a separate, later concern and does not block this task at all.**
- **Authorized role:** Architect, with PM sign-off before any push to the remote.
- **Inputs:** `docs/repository-plan/dashboard-monorepo-plan.md`, `docs/architecture/decisions/0001-*.md`.
- **Expected files:** `turbo.json`, `pnpm-workspace.yaml`, empty `apps/*`/`packages/*` directories with minimal `package.json` stubs.
- **Acceptance criteria:** `turbo run build` succeeds against the empty scaffold; import-boundary rules configured per ADR-0001; local commit made. Push to `origin` (if the remote is confirmed to exist and PM has authorized it) is a distinct, separately-recorded step, not implied by "acceptance."
- **Required tests:** CI pipeline runs successfully — locally at first (`turbo run lint test build`); against the remote once pushed and CI is wired (Task 12).
- **Security checks:** none yet (no code, no secrets).
- **Approval gate:** G0 → G1 boundary.
- **Forbidden actions:** no application logic written yet — scaffold only. No push to `origin` without separate PM authorization, per the general rule that pushing code is a shared-state action.
- **Rollback:** revert the feature branch or commit that introduced the scaffold — never delete the repository. If already pushed and the push itself needs undoing, revert via a new commit or coordinate a force-push with the team, never delete the remote.

### Task 2 — Shared configuration and TypeScript standards

- **Purpose:** `packages/configuration`, shared `tsconfig.json`, ESLint/Prettier config.
- **Dependencies:** Task 1.
- **Authorized role:** Architect.
- **Inputs:** base skill's `CONVENTIONS.md`.
- **Expected files:** `packages/configuration/*`, root `tsconfig.base.json`, `.eslintrc`.
- **Acceptance criteria:** every `apps/*`/`packages/*` stub type-checks and lints cleanly.
- **Required tests:** lint/type-check CI job passes.
- **Security checks:** dependency audit tooling configured (not yet run against real dependencies).
- **Approval gate:** G1.
- **Forbidden actions:** no business logic.
- **Rollback:** revert the commit; no runtime state affected.

### Task 3 — Database package and migration framework

- **Purpose:** `packages/database` scaffold, Sequelize connection setup, first migration (schema TBD at G-Schema).
- **Dependencies:** Task 1, Task 2, ADR-0006/0007 approved, Postgres Marketplace provider confirmed (setup input — **resolved 2026-08-07, Supabase/us-east-1**, see `docs/project-state/setup-input-register.md`). This clears the setup-input dependency; Task 3 still requires its own separate execution authorization, per the Phase 1B task package's own approval gates (`docs/task-packages/phase-1b-database-foundation.md`).
- **Authorized role:** Architect, DBA.
- **Inputs:** `docs/architecture/decisions/0006-*.md`, `0007-*.md`, `docs/contracts/database-contract.md`.
- **Expected files:** `packages/database/src/*`, `packages/database/migrations/*`.
- **Acceptance criteria:** migration runs cleanly against a fresh database in CI.
- **Required tests:** migration test against a disposable test database.
- **Security checks:** connection credentials sourced from environment variables only, verified in review.
- **Approval gate:** G-Schema.
- **Forbidden actions:** no migration applied to staging/production without separate explicit approval (per `docs/repository-plan/branch-and-release-plan.md`).
- **Rollback:** migration down-scripts tested alongside up-scripts.

### Task 4 — Authentication

- **Purpose:** Google Workspace OIDC flow in `dashboard-api`, per ADR-0008 and `docs/contracts/google-workspace-auth-contract.md`.
- **Dependencies:** Task 3, Google Workspace OAuth client created (setup input), first-login provisioning model decided (setup input — **blocking**).
- **Authorized role:** Backend.
- **Inputs:** ADR-0008, `docs/contracts/google-workspace-auth-contract.md`.
- **Expected files:** `apps/dashboard-api/src/auth/*`.
- **Acceptance criteria:** login flow succeeds against a test Google Workspace account.
- **Required tests:** auth flow integration test; forged/expired-token rejection test.
- **Security checks:** the "Authentication" area of `docs/security/threat-model-plan.md` completed.
- **Approval gate:** G4.
- **Forbidden actions:** no production OAuth client used in tests.
- **Rollback:** feature-flagged; disable the login route if a critical issue is found.

### Task 5 — Sessions

- **Purpose:** Session issuance/expiry/invalidation following successful authentication.
- **Dependencies:** Task 4.
- **Authorized role:** Backend.
- **Inputs:** `docs/contracts/google-workspace-auth-contract.md`.
- **Expected files:** `apps/dashboard-api/src/session/*`.
- **Acceptance criteria:** session expires correctly; invalidation on logout is immediate.
- **Required tests:** session-expiry test, concurrent-session behavior test.
- **Security checks:** "Session handling" area of the threat model.
- **Approval gate:** G4.
- **Forbidden actions:** none beyond standard review.
- **Rollback:** feature-flagged alongside Task 4.

### Task 6 — RBAC and authorization

- **Purpose:** Role/permission model per `06_Roles_and_Permissions.md` and ADR-0010, enforced server-side in `dashboard-api`.
- **Dependencies:** Task 3, Task 5.
- **Authorized role:** Backend, reviewed by Architect.
- **Inputs:** ADR-0010, `06_Roles_and_Permissions.md`.
- **Expected files:** `apps/dashboard-api/src/authz/*`.
- **Acceptance criteria:** every module's authorization check is a server-side guard, not a UI-only hide.
- **Required tests:** authorization test per role, including negative tests (a role attempting an action it shouldn't have).
- **Security checks:** "Authorization" area of the threat model.
- **Approval gate:** G4.
- **Forbidden actions:** no client-side-only permission check treated as sufficient.
- **Rollback:** feature-flagged.

### Task 7 — Audit logging

- **Purpose:** Append-only audit-event recording per ADR-0017.
- **Dependencies:** Task 3, Task 6.
- **Authorized role:** Backend.
- **Inputs:** ADR-0017, `contracts/audit-event.schema.json` (profile).
- **Expected files:** `packages/database` audit-event model, `apps/dashboard-api/src/audit/*`.
- **Acceptance criteria:** no code path exposes an update/delete on the audit table (verified by code review and a negative test).
- **Required tests:** immutability test (attempt an update/delete, confirm it's not possible through the application layer).
- **Security checks:** "Audit logs" area of the threat model.
- **Approval gate:** G4.
- **Forbidden actions:** no audit-event mutation capability, ever.
- **Rollback:** feature-flagged.

### Task 8 — Project and user foundations

- **Purpose:** Core `Project`/`User` models and their basic CRUD, the foundation other modules build on.
- **Dependencies:** Task 3, Task 6, Task 7.
- **Authorized role:** Backend.
- **Inputs:** `04_Data_Model_and_Ownership.md`.
- **Expected files:** `packages/database` models, `apps/dashboard-api/src/{projects,users}/*`.
- **Acceptance criteria:** basic CRUD works with RBAC and audit logging both active.
- **Required tests:** module-level tests plus the RBAC/audit tests from Tasks 6/7 applied to this module specifically.
- **Security checks:** standard module review.
- **Approval gate:** G4.
- **Forbidden actions:** none beyond standard review.
- **Rollback:** feature-flagged.

### Task 9 — Background-job record foundation

- **Purpose:** The database-side record structure background jobs write to/read from, plus the first `dashboard-worker` handler (a trivial one, to prove the pattern) per ADR-0004/0005.
- **Dependencies:** Task 3, Vercel Queues/Workflows availability confirmed (setup input) or Upstash QStash fallback selected.
- **Authorized role:** Backend.
- **Inputs:** ADR-0004, 0005, `docs/contracts/vercel-background-jobs-contract.md`.
- **Expected files:** `apps/dashboard-worker/src/*`, `packages/database` job-record model.
- **Acceptance criteria:** the trivial handler is triggered via the chosen job provider and its result is recorded correctly.
- **Required tests:** trigger-payload validation test, idempotency test (same trigger processed twice produces no duplicate side effect).
- **Security checks:** "Background jobs" and "Queues and retries" areas of the threat model.
- **Approval gate:** G4.
- **Forbidden actions:** no persistent-process pattern introduced (WDS-005).
- **Rollback:** feature-flagged; the job type can be disabled at the trigger-configuration level.

### Task 10 — Basic dashboard shell

- **Purpose:** `dashboard-web` scaffold with authenticated layout, navigation, and a single real page (e.g., a project list) calling `dashboard-api`.
- **Dependencies:** Task 4, Task 5, Task 8.
- **Authorized role:** Frontend, Designer.
- **Inputs:** `07_Low_Fidelity_Wireframes.md`, ADR-0002.
- **Expected files:** `apps/dashboard-web/*`.
- **Acceptance criteria:** an authenticated user sees a real, data-backed page; an unauthenticated user is redirected to login.
- **Required tests:** basic UI test, auth-redirect test.
- **Security checks:** standard module review; confirm `dashboard-web` makes no direct database calls (ADR-0002).
- **Approval gate:** G4.
- **Forbidden actions:** no direct DB access from `dashboard-web`.
- **Rollback:** feature-flagged.

### Task 11 — Health checks and observability

- **Purpose:** Basic health-check endpoints for each app, minimal structured logging.
- **Dependencies:** Tasks 1–10 (needs real apps to check the health of).
- **Authorized role:** Backend, DevOps.
- **Inputs:** none beyond standard operational practice.
- **Expected files:** health-check routes per app.
- **Acceptance criteria:** each app's health check reflects real dependency status (e.g., database reachability), not a hardcoded 200.
- **Required tests:** health-check test with a deliberately broken dependency (confirm it reports unhealthy).
- **Security checks:** health-check endpoints don't leak sensitive configuration details.
- **Approval gate:** G5.5.
- **Forbidden actions:** none.
- **Rollback:** none needed — additive only.

### Task 12 — CI validation

- **Purpose:** Full `turbo run lint test build` pipeline wired to the repository, including the migration dry-run and dependency audit from `docs/repository-plan/dashboard-monorepo-plan.md`.
- **Dependencies:** Tasks 1–11 (needs real content to validate).
- **Authorized role:** DevOps, Architect.
- **Inputs:** `docs/repository-plan/branch-and-release-plan.md`.
- **Expected files:** CI workflow configuration.
- **Acceptance criteria:** CI blocks a PR that fails lint/test/build; passes on a clean PR.
- **Required tests:** a deliberately-broken PR confirmed blocked; a clean PR confirmed passing.
- **Security checks:** dependency-audit step configured and passing.
- **Approval gate:** G5.5.
- **Forbidden actions:** no auto-merge wired (ADR-0018).
- **Rollback:** disable the specific failing check, don't bypass the whole pipeline.

### Task 13 — Staging deployment foundation

- **Purpose:** First real deployment of the foundation to the staging environment.
- **Dependencies:** Tasks 1–12, staging environment provisioned (setup input).
- **Authorized role:** DevOps, PM sign-off.
- **Inputs:** `docs/repository-plan/environment-plan.md`.
- **Expected files:** deployment configuration for staging.
- **Acceptance criteria:** the foundation (auth, RBAC, audit, one real page) works end-to-end in staging.
- **Required tests:** smoke test against the deployed staging environment.
- **Security checks:** staging-specific credentials confirmed separate from development (per every integration contract's environment-separation requirement).
- **Approval gate:** G5.5 → G6.
- **Forbidden actions:** no production deployment from this task — staging only.
- **Rollback:** redeploy the previous state; staging has no production data to protect.

---

## What comes after Task 13

Individual dashboard modules (Scan Center, Notification Center, Release Center, etc.) per `03_Detailed_Module_Specifications.md`, each following the same per-task discipline (dependencies, acceptance criteria, tests, security checks, approval gate) established above — planned in detail once this foundation is in place, not pre-planned speculatively here.
