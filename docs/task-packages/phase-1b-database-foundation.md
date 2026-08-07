# Phase 1B Task Package — Database Foundation

**Status:** Documentation and planning only. Not started, not authorized. This package must be
reviewed and separately approved before any of its in-scope work begins — approving this package
does **not** itself authorize creating the two proposed foundational entities (§9/§11); that
requires an additional, explicit go-ahead within the approved execution package, per the brief's
own instruction.

---

## 0. Verification (performed before writing this package)

Per the task brief's "Verify before continuing" instructions, each check below was re-run live
against the repository rather than assumed from memory:

| Check                                                  | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 1A is formally approved                          | **Confirmed.** `docs/project-state/phase-1a-approval-checklist.md`'s Sign-off table: approved by WebDesk Solution, 2026-08-07, scope "Phase 1A only." `project.json`'s `gates[]` has a `G1` entry with `status: "passed"`.                                                                                                                                                                                                                                                                                                                                                    |
| The recorded remote commit SHA exists                  | **Confirmed.** `efdb301a0740b074893b010df0fa317b5c3dac69` — verified present via `git cat-file -e` and independently via `git ls-remote origin`.                                                                                                                                                                                                                                                                                                                                                                                                                              |
| The current branch is based on the approved SHA        | **Confirmed.** Working from `main`; `git merge-base --is-ancestor efdb301… main` returns true. `main`'s current tip (`f5065bec183875f651b94b5e24dc9b96514f06fe`) is a strict descendant of the approved SHA — it additionally includes the sign-off-recording commit (`084278a`), which does not change any approved Phase 1A content.                                                                                                                                                                                                                                        |
| Phase 1A tests passed                                  | **Confirmed.** 25 unit tests, 5 integration tests, 4 Playwright smoke tests, all passing per `docs/project-state/phase-1a-validation-report.md`, independently re-run and re-verified in this session (not just re-read from the report).                                                                                                                                                                                                                                                                                                                                     |
| No unresolved blocker prevents the database foundation | **One known, expected blocker exists — not a conflict, and does not block _this_ package.** The exact Vercel Postgres Marketplace provider is unconfirmed (`project.json.vercel_execution.postgres_marketplace_provider: null`), which `docs/phase-plans/phase-1-foundation-plan.md`'s own Task 3 already states as a dependency: _"Postgres Marketplace provider confirmed (setup input — this task cannot start without it)."_ This blocks **execution** of the eventual approved package, not the writing of this planning document — see §27. No other blocker was found. |

**Conclusion:** no conflict requiring a stop-and-report. Proceeding to the task package below.

---

## 1. Task ID

`PHASE-1B-TASK-3-DATABASE-FOUNDATION`

Corresponds to `docs/phase-plans/phase-1-foundation-plan.md`'s **Task 3 — Database package and
migration framework**.

## 2. Authorized phase

Phase 1B (this document only — Phase 1B _implementation_ remains unauthorized until this package
is reviewed, approved, and a separate execution instruction is issued against it, per the brief's
two-instruction pattern).

## 3. Purpose

Turn `packages/database`'s Phase 1A interface-only placeholders (`getConnection()` that throws,
a `Repository<T>` interface with no implementation) into a real, tested, minimal database
framework: a working Sequelize/PostgreSQL connection appropriate for Vercel Functions, a
version-controlled migration runner, a transaction mechanism, and a Sequelize-backed repository
base that satisfies the existing `Repository<TEntity>` contract — proven end-to-end against a
small number of foundational entities, not the full 43-module data model.

## 4. Business and technical justification

**Business:** every one of the dashboard's 43 V1 modules (`02_Version_1_Module_Inclusion_Matrix.md`)
ultimately persists to PostgreSQL. Nothing past Phase 1A can be built — no project record, no user
record, no workflow, no audit trail — without a working, reviewed database layer. This is the
single highest-leverage foundation task remaining in Phase 1.

**Technical:** `packages/database` is architecturally load-bearing — ADR-0006 makes it "the sole
Sequelize model/connection/migration implementation boundary" (WDS-011), and `dashboard-api` and
`dashboard-worker` both depend on it structurally (dependency-cruiser already enforces "only
`packages/database` may import `sequelize`," wired in Phase 1A). Getting the connection-pooling
and migration mechanics right once, in this shared package, avoids every future module
reinventing (and likely mis-designing) its own database access pattern under Vercel's serverless
execution model.

## 5. Approved source requirements

- `webdesk-dashboard-documentation-v1/01_Dashboard_Master_Specification.md` — overall
  architecture, traced as **REQ-003** in `docs/traceability/phase-0-requirements-traceability.md`
  ("PostgreSQL + Sequelize," owning package `packages/database`, ADR-0006/0007, contract
  `database`, test type "Migration test," gate **G-Schema**, current status "Architecture
  Defined... Provider unconfirmed (blocked on setup input)").
- `docs/architecture/decisions/0006-postgresql-sequelize-architecture.md` — PostgreSQL +
  Sequelize decision, exclusive ownership by `packages/database` (WDS-011).
- `docs/architecture/decisions/0007-database-provider-independence-east-coast.md` — Vercel
  Postgres Marketplace provisioning, North America East Coast requirement, Neon exclusion
  (WDS-002).
- `docs/architecture/decisions/0004-dashboard-worker-serverless-decomposition.md` — no permanent
  worker process (WDS-005), which structurally shapes how database connections must be managed
  (no long-lived connection to hold open).
- `docs/contracts/database-contract.md` — the integration contract this task package implements
  against.
- `webdesk-dashboard-documentation-v1/04_Data_Model_and_Ownership.md` — base-entity standard
  (§1) and the full entity catalogue (§2), from which §9/§11 below propose only the minimal
  foundational subset.

## 6. Dependencies

- Phase 1A complete and approved (§0 — confirmed).
- ADR-0006 and ADR-0007 approved (confirmed at Phase 0 sign-off).
- **Postgres Marketplace provider confirmed** — per `docs/phase-plans/phase-1-foundation-plan.md`
  Task 3, this is a hard dependency for _execution_, not for this planning document. See §27.
- `packages/shared-types`'s `BaseEntity`/`PaginationParams`/`PaginatedResult` (Phase 1A, already
  built) — the `Repository<TEntity>` interface this task implements against is defined in terms
  of these types.
- `packages/configuration`'s env-schema and logging patterns (Phase 1A, already built) — the
  database env schema and log redaction should extend these, not duplicate them.

## 7. In-scope work

- Real `getConnection()` implementation: Sequelize instance construction, connection-string
  parsing, SSL configuration, serverless-aware pool sizing (§13).
- Migration framework: directory structure, a migration runner (proposed tool + reasoning in
  §11/§14), up/down scripts, a CI-runnable "apply migrations to a disposable database" command.
- Transaction foundation: a `withTransaction()`-style helper usable by repository implementations
  and, later, by `dashboard-api`/`dashboard-worker` call sites (§15).
- Repository-pattern foundation: a Sequelize-backed base implementation of the existing
  `Repository<TEntity>` interface (§16), reusable by every future entity's repository.
- Database health check: a real, minimal query (e.g. `SELECT 1`) usable by `dashboard-api`'s
  `/ready` endpoint (already built in Phase 1A, currently checks nothing database-related).
- Test-database strategy: how migration/model tests run against a real, disposable PostgreSQL
  instance in CI and locally (§18).
- Migration validation: an automated check that migrations apply cleanly and down-scripts
  reverse them, per `docs/phase-plans/phase-1-foundation-plan.md` Task 3's acceptance criteria.
- Database logging: structured, redacted logging for connection/query errors, extending Phase
  1A's existing Pino-based logging package (§20).
- **Proposed, not yet authorized:** two minimal foundational entities (`projects`, `users`) to
  prove the framework end-to-end — see §9 and §11 for why these two, and the explicit statement
  that creating them requires separate authorization beyond this package's own approval.

## 8. Out-of-scope work

- Any entity beyond the two proposed minimal ones (§9) — none of the other ~130 entities in
  `04_Data_Model_and_Ownership.md` §2 are designed or created here.
- Authentication, sessions, RBAC (Phase 1 Tasks 4–6) — the `users` table proposed in §9 is a bare
  identity row only, with no auth/session/role columns.
- Audit-log persistence (Phase 1 Task 7, ADR-0017) — no `audit_events` table is created here,
  even though it was one of the "most foundational" candidates identified during research (see
  §26 for why it was deliberately excluded from this minimal set).
- Actual PostgreSQL provisioning, or any cloud-resource creation of any kind.
- Actual database credentials, connection strings, or any secret value.
- Wiring `dashboard-api`/`dashboard-worker` route/handler code to call the new repositories —
  this task ships the framework inside `packages/database` only; consuming it from an app is a
  later task's job once the app actually needs a real entity.
- Backup/restore runbook authoring (`db_restore` in `project.json.runbooks_status`) — remains a
  G5.5 pre-launch deliverable per `knowledge/11-retention-backup-and-operations.md`, out of scope
  here.
- Any staging/production migration execution — see §23.

## 9. Expected files

All under `packages/database/` unless noted:

- `src/connection.ts` — rewritten with a real implementation (replaces the Phase 1A
  throw-by-design placeholder).
- `src/connection.test.ts` — rewritten; the existing placeholder test asserting
  `expect(() => getConnection()).toThrow(/Phase 1B/)` is removed since Phase 1B is exactly what
  invalidates it.
- `src/transaction.ts` (new) — the `withTransaction()` helper.
- `src/transaction.test.ts` (new).
- `src/base-repository.ts` (new) — Sequelize-backed implementation of `Repository<TEntity>`.
- `src/base-repository.test.ts` (new).
- `src/health.ts` (new) — the `SELECT 1`-style health-check function `dashboard-api`'s `/ready`
  route will call.
- `src/health.test.ts` (new).
- `migrations/` (new directory) — migration files, naming convention TBD by the reviewer at
  implementation time (timestamp-prefixed, per the chosen runner's convention).
- `src/migrate.ts` (new) — programmatic migration-runner entry point (CLI-invokable via a
  `package.json` script), used by both the CI validation command and local development.
- **Proposed, requires separate authorization beyond this package's approval:**
  - `src/models/project.ts`, `migrations/<timestamp>-create-projects.ts`
  - `src/models/user.ts`, `migrations/<timestamp>-create-users.ts`
- `README.md` (new, package-local) — how to point `packages/database` at a local/CI test
  database, how to run/write a migration, how the repository base class is used.
- `docker-compose.test.yml` or equivalent (new, repo root or `packages/database/`, exact location
  TBD by reviewer) — a `postgres:16`-class disposable database for local test runs, mirroring
  what CI's service container will use.
- `.github/workflows/ci.yml` — extended with a database-migration-test step (or a new job)
  against a disposable Postgres service container.
- `apps/dashboard-api/src/health/health.controller.ts` — **not modified by this task**; wiring
  the real health check into `/ready` is explicitly out of scope (§8) unless the reviewer decides
  otherwise at implementation time.

## 10. Expected package changes

- `packages/database/package.json` — add the dependencies proposed in §11; bump version.
- No changes to any other package's `package.json` — nothing outside `packages/database` gains a
  new dependency as part of this task, consistent with ADR-0006's exclusive-ownership rule.
- `pnpm-workspace.yaml`'s `allowBuilds` map may need a new entry if any proposed dependency ships
  a native/postinstall build script (verify at implementation time — `pg` typically does not,
  `sequelize` does not; unconfirmed for the exact migration-runner package until selected).

## 11. Proposed dependencies and exact reasons

All proposed, none installed by this task package:

| Package                                     | Type | Reason                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sequelize`                                 | prod | The approved ORM (ADR-0006) — not yet a dependency anywhere in the monorepo; Phase 1A deliberately shipped `packages/database` with zero Sequelize/`pg` dependencies to keep the placeholder honest.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `pg`                                        | prod | Sequelize's required PostgreSQL dialect driver (`node-postgres`) — Sequelize does not bundle a database driver itself.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `pg-hstore`                                 | prod | Required alongside `pg` for Sequelize's Postgres dialect (serializes/deserializes hstore-typed columns); small, standard, no viable alternative.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `umzug` (**proposed, not `sequelize-cli`**) | prod | A programmatic, library-first migration runner maintained by the Sequelize organization. Proposed over `sequelize-cli` because: (1) `sequelize-cli` is a global-config, CLI-invocation-first tool built around a `.sequelizerc` file and an assumed single-app directory layout that fights a Turborepo package boundary; (2) the database contract requires migration tests to run programmatically against a disposable test database (`docs/contracts/database-contract.md` §"Test requirements") — `umzug` is designed to be driven from test code directly, `sequelize-cli` is not; (3) `umzug` is dialect-agnostic and decoupled from Sequelize's own version, reducing future upgrade coupling. **This is a proposal for reviewer approval, not a settled choice** — no prior ADR names a specific migration tool. |
| `@types/pg`                                 | dev  | TypeScript types for `pg`, matching this project's existing pattern of `@types/*` dev dependencies for untyped/partially-typed packages.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

**Explicitly not proposed:**

- `dotenv` — Node 24 (this project's pinned runtime) supports `process.loadEnvFile()` natively;
  adding `dotenv` would duplicate a capability already available, contradicting this project's
  established minimalism (e.g. Zod-only validation, no parallel `class-validator`, per profile
  `knowledge/03-nestjs-on-vercel.md`).
- Any secrets-management SDK (Vault, AWS Secrets Manager client, etc.) — explicitly out of scope
  per `docs/security/secrets-management-plan.md` ("A dedicated secrets-management service... is
  not adopted").
- A connection-pooler client library (e.g. a PgBouncer-specific package) — deferred until the
  Marketplace provider is chosen, since the correct pooling mechanism depends on what that
  provider natively offers (§13).

## 12. Database configuration approach

- Connection configuration is read from environment variables, inside `packages/database` only
  (ADR-0006, `database-contract.md` — no other package/app ever reads a database credential).
- `DatabaseConnectionConfig` (Phase 1A's existing interface: `host`, `port`, `database`, `ssl`)
  is extended with credentials and pool-sizing fields. **No literal environment-variable name is
  mandated by any prior ADR or contract** — this task proposes `DATABASE_URL` as a single
  connection-string variable (the conventional shape most Vercel Postgres Marketplace
  integrations auto-inject), with per-field env vars as a documented fallback, to be finalized
  once the actual provider is confirmed and its exact injected variable name(s) are known.
- Configuration validation follows Phase 1A's established Zod-schema pattern
  (`packages/configuration`'s `baseEnvSchema` precedent) — a `databaseEnvSchema` extension,
  failing fast on cold start if required variables are absent or malformed, consistent with
  `knowledge/03-nestjs-on-vercel.md`'s "config validation still fails fast per cold start."
- SSL is required in every environment (`ssl: true`) — no environment (including local
  development against a disposable container) is assumed to be a safe place to skip SSL, unless
  the reviewer explicitly carves out a local-only exception at implementation time.

## 13. Vercel Functions connection-management approach

Per `knowledge/03-nestjs-on-vercel.md`'s explicit guidance (found during research for this
package): _"a Sequelize connection pool sized for a persistent process... is wrong for a
Functions model, where many concurrent cold starts can each try to open a pool."_

- The Sequelize instance is constructed once per cold start and cached at module scope (mirrors
  the same "cache the Nest application instance across invocations" pattern `dashboard-api`
  already uses) — not re-instantiated per request within a warm invocation.
- Pool size is small and serverless-appropriate (proposed starting point: `max: 2, min: 0, idle:
10_000`ms — a conservative default, not a final tuned value) rather than a persistent-process
  sizing like `max: 10`.
- Whether an additional connection pooler in front of PostgreSQL is needed (e.g. a
  provider-managed pooler, or a serverless-specific driver mode) **depends on which Marketplace
  provider is chosen** — some providers ship this natively, others don't. This task package
  documents the requirement and the small-pool mitigation; the exact pooling mechanism is
  finalized once §27's blocking input is resolved, not guessed here.
- No graceful-shutdown/connection-draining logic is added — per `knowledge/03-nestjs-on-vercel.md`,
  this "does not carry over" to Vercel Functions, since there is no long-lived process to signal.

## 14. Sequelize migration approach

- Migrations live in `packages/database/migrations/`, the sole migration path in the monorepo
  (WDS-011) — enforced structurally today via the package boundary (ADR-0001) and, going
  forward, via the absence of any migration tooling in any other package's dependencies.
- Runner: `umzug` (§11), invoked via a `src/migrate.ts` script exposed as a `package.json` script
  (`pnpm --filter @webdesk/database migrate`).
- Every migration ships both an up and a down script — required by
  `docs/phase-plans/phase-1-foundation-plan.md` Task 3's own acceptance criteria ("migration
  down-scripts tested alongside up-scripts").
- **Schema synchronization (Sequelize's `sync()`) is never used, in any environment** — this
  isn't stated verbatim as a named rule in any single ADR, but follows directly from ADR-0006's
  "migrations owned exclusively by `packages/database`" combined with the contract's migration
  approval-gate language (§23); `sync()` bypasses both. This task package makes the prohibition
  explicit rather than leaving it implicit.
- Migrations never auto-apply on deploy — every migration requires review before staging and a
  separate, explicit approval before production (`database-contract.md` §"Production approval
  requirements," restated in §23/§25 below).

## 15. Transaction approach

- A single `withTransaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T>` helper,
  exported from `packages/database`, wrapping Sequelize's native transaction API.
- Repository methods that need multi-statement atomicity accept an optional transaction handle
  (a common Sequelize convention: `{ transaction }` passed through to the underlying query) so
  callers can compose multiple repository calls into one transaction via `withTransaction`.
- No implicit/ambient transaction (e.g. continuation-local-storage-based auto-wrapping) is
  proposed — explicit transaction boundaries only, matching this project's general preference for
  explicit over implicit behavior (e.g. the Zod-over-decorators validation pattern already
  established in Phase 1A).
- The existing `Repository<TEntity>` interface (Phase 1A) has no transaction-aware method
  signatures today — this task proposes extending it (or adding a parallel
  transaction-aware variant) rather than breaking the existing interface; exact shape is a
  reviewer decision at implementation time, not fixed here.

## 16. Repository-boundary approach

- `packages/database` ships a `BaseRepository<TEntity>` implementing today's `Repository<TEntity>`
  interface (Phase 1A, `packages/database/src/repository.ts`) against a real Sequelize model.
- Consuming code (`dashboard-api`, and later `dashboard-worker` where a job handler needs
  database access) depends on the `Repository<TEntity>` interface and receives a concrete
  instance via dependency injection (NestJS provider pattern) — never imports Sequelize directly.
  This is already mechanically enforced today: `dependency-cruiser.config.cjs` (Phase 1A) has a
  rule that only `packages/database` may import `sequelize`.
- `softDelete(id)` remains the only deletion method on the interface — no hard `delete` is added,
  consistent with ADR-0016 (operational data vs. Git-artifact ownership) as already reflected in
  the Phase 1A placeholder's own code comment.

## 17. Environment-separation approach

- Four fully separate database instances/connection strings: development (local, developer's own
  disposable Postgres), preview, staging, production — "no shared database instance across
  environments under any circumstance" (`database-contract.md`).
- Each environment's connection string is scoped in Vercel's own per-environment env-var
  configuration (`docs/security/secrets-management-plan.md`), never a shared value across
  environments.
- **Open question this task package surfaces, not resolved by any prior ADR:** whether Vercel
  preview deployments (one per PR) share a single "preview" database or each get an ephemeral
  one. Sharing risks cross-PR data collisions during concurrent preview deploys; ephemeral
  provisioning-per-PR has cost/complexity implications tied to whichever Marketplace provider is
  chosen. Flagged in §27 as a decision needed at (or before) implementation time, not assumed
  here.

## 18. Test strategy

- **Unit tests** (Vitest, matching every other package's Phase 1A pattern): connection-config
  parsing/validation, the transaction helper's control flow (mocked Sequelize transaction),
  `BaseRepository`'s method behavior against a mocked/in-memory model.
- **Migration tests** (real database required — no sqlite substitution, since Postgres-specific
  behavior must be tested faithfully per `database-contract.md`'s "migration tests run against a
  disposable test database"): apply every migration's up-script to a fresh disposable PostgreSQL
  instance, verify the resulting schema, then apply every down-script and verify a clean
  rollback.
- **Disposable test database, two contexts:**
  - **CI:** a `postgres:16`-class GitHub Actions service container — provider-agnostic, doesn't
    require the actual chosen Marketplace provider to be available, satisfies "never against
    staging or production."
  - **Local development:** developer runs their own disposable Postgres (Docker Compose file
    proposed in §9), matching CI's image/version to avoid environment drift.
- **No test ever touches staging or production** — structurally guaranteed by using a distinct,
  disposable connection string in test configuration, never the environment-scoped Vercel secret.
- Existing Phase 1A placeholder test (`connection.test.ts` asserting the throw) is removed as
  part of this work, since a working `getConnection()` invalidates its premise (§9).

## 19. Security requirements

- Credentials sourced from environment variables only, inside `packages/database`, never logged,
  never committed (extends the existing `.gitignore` `.env*` exclusion and the Phase 1A
  dependency-free secret scanner, which already runs against the full repo in CI).
- Single application-level database role — per `database-contract.md`, "row-level access control
  is application-enforced, not database-enforced, for V1" (RBAC is ADR-0010's job, in
  `dashboard-api`, before any query reaches this package).
- All queries parameterized via Sequelize's query builder/model API — no raw string-concatenated
  SQL anywhere in this task's code.
- SSL required on every connection, every environment (§12).
- Least-privilege database user/role — exact grants depend on the chosen provider's role model,
  confirmed at implementation time, not fixed here.
- Confidential/Restricted-classified columns (per `docs/security/data-classification.md`) are not
  introduced by this task at all, since the two proposed entities (§9) carry no such columns —
  this task's own data footprint is deliberately Internal-classification-only (a project name, a
  user email/display name).

## 20. Logging and redaction requirements

- Extends Phase 1A's existing Pino-based structured logging (`packages/configuration`'s
  `logging.ts`, already wired into `dashboard-api` via `nestjs-pino`) rather than introducing a
  separate logging mechanism.
- Database errors (connection failures, constraint violations) are logged with query _metadata_
  (operation type, table, error code) — never raw query parameter values, which could contain
  PII or, in future modules, Confidential/Restricted data (`docs/security/data-classification.md`:
  "Confidential and Restricted data must never be logged in plaintext in general application
  logs").
- The connection string / credentials are added to the existing redact-paths list (the same
  mechanism Phase 1A already uses for other sensitive fields) — never appear in any log line,
  including error logs on connection failure.
- Raw database error messages are never surfaced to an end user (`database-contract.md`'s "Error
  handling" clause) — translated into a generic application-level error at the repository
  boundary; the raw error is what gets logged (redacted), not returned.

## 21. Acceptance criteria

- `getConnection()` returns a real, working, pooled Sequelize connection (no longer throws by
  design) — verified via a live query against a disposable test database, not a mock.
- The health-check function (`src/health.ts`) succeeds against a live disposable database and
  fails cleanly (typed error, no crash) when the database is unreachable.
- Every migration's up-script applies cleanly to a fresh disposable database in CI; every
  down-script reverses it cleanly — both directions tested, per Task 3's own acceptance
  criteria.
- `BaseRepository` correctly implements every method of the existing `Repository<TEntity>`
  interface, exercised against the two proposed entities (if separately authorized) or against a
  minimal test-only schema otherwise (§9).
- `withTransaction()` correctly commits on success and rolls back on a thrown error — verified
  with a real disposable database, not mocked, since transaction semantics are exactly the kind
  of behavior a mock can misrepresent.
- Zero Sequelize (or `pg`) imports outside `packages/database` — `pnpm boundaries:check` remains
  0 errors.
- Zero secrets in any committed file — `pnpm scan:secrets` remains clean.
- `turbo run typecheck lint test build` remains fully green across the whole monorepo, not just
  `packages/database`.
- The Phase 1A placeholder test asserting `getConnection()` throws is removed, and no test
  anywhere still depends on the old throw-by-design behavior.

## 22. Validation commands

Reusing the exact validation pattern established and proven in Phase 1A (see
`docs/project-state/phase-1a-validation-report.md` for precedent):

```bash
pnpm install --frozen-lockfile
turbo run typecheck lint build
pnpm --filter @webdesk/database test
pnpm --filter @webdesk/database migrate:test    # new — applies + reverses all migrations against a disposable DB
pnpm boundaries:check
pnpm scan:secrets
pnpm format
```

Plus, if a new CI job/step is added for the disposable-database migration test (§9), that job's
own pass/fail is itself validation evidence, not just the local command.

## 23. Rollback and recovery approach

- Every migration ships a tested down-script (§14/§21) — rollback of a single migration is
  "redeploy the previous verified commit" (`docs/repository-plan/branch-and-release-plan.md`'s
  general rollback clause) plus running that migration's down-script, not a manual/ad-hoc fix.
- **No migration auto-applies on deploy.** Staging requires review before a migration is applied;
  production requires a separate, explicit approval beyond staging's — restated directly from
  `database-contract.md`'s "Production approval requirements," and echoed in
  `docs/phase-plans/phase-1-foundation-plan.md` Task 3's own forbidden-actions line ("no
  migration applied to staging/production without separate explicit approval").
- Actual backup/restore capability (the `db_restore` runbook,
  `project.json.runbooks_status.db_restore`, currently `"missing"`) remains a G5.5 pre-launch
  deliverable, out of scope for this task (§8) — this task's schema/tooling choices must not
  preclude it, but do not implement it.
- The 15-minute production RPO / 4-hour RTO targets (`knowledge/11-retention-backup-and-operations.md`)
  are **not achievable claims from this task alone** — they depend on the chosen Marketplace
  provider's point-in-time-recovery capability, confirmed once §27's blocker resolves. This
  package does not claim those targets are met by shipping the framework.

## 24. Approval gates

- **This task package itself** — human review and approval required before any in-scope work
  begins (separation-of-duties, ADR-0010 — the authoring agent cannot self-approve, exactly as
  applied to Phase 1A's own checklist).
- **G-Schema** — the primary architectural gate for this task, per REQ-003's traceability row and
  `docs/phase-plans/phase-1-foundation-plan.md` Task 3.
- **A separate, explicit authorization to create the two proposed foundational entities**
  (`projects`, `users`) — required in addition to this package's own approval, per the brief's
  own instruction that foundational entities "must not be created without explicit authorization
  in the approved execution package."
- **Infrastructure-owner sign-off on the specific Postgres Marketplace provider** — per
  ADR-0007, "additionally requires PM/infrastructure-owner sign-off before G2 (implementation)
  can proceed with any database-dependent code," independent of this package's own approval.

## 25. Forbidden actions

Restated verbatim from the task brief, all still in effect for this planning document and for
any future execution package built from it unless a later authorization explicitly lifts one:

- Do not implement the database package.
- Do not install Sequelize or a PostgreSQL driver.
- Do not create migrations.
- Do not create models.
- Do not create cloud resources.
- Do not provision PostgreSQL.
- Do not add credentials.
- Do not connect to any database.
- Do not begin authentication or RBAC.
- Do not commit application changes.
- Do not begin Phase 1B automatically.

Additional forbidden actions surfaced by this task's own research, worth stating explicitly since
they are easy to violate by accident once implementation starts:

- Do not use Sequelize's `sync()` in any environment (§14) — migrations only.
- Do not add a second migration path anywhere outside `packages/database` (WDS-011).
- Do not default to Neon, or to a non-East-Coast region, if the Marketplace provider search
  turns up a genuine conflict between the two requirements — escalate per ADR-0007's stop
  condition instead of silently resolving it either way.
- Do not design any entity beyond the two proposed minimal ones without a separate authorization.

## 26. Risks and mitigations

| Risk                                                                                                                                                                                                                                                                                        | Mitigation                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Connection-pool exhaustion under Vercel Functions' concurrent-invocation model                                                                                                                                                                                                              | Small, serverless-aware pool sizing (§13); revisit once the chosen provider's own pooling behavior is known; load-test before G-Schema sign-off rather than assuming the conservative default is correct.                                                         |
| Postgres Marketplace provider still unconfirmed                                                                                                                                                                                                                                             | Does not block _this_ package (documentation only) or CI testing (a generic `postgres:16` service container is provider-agnostic) — only blocks actual provisioning and final pooling-mechanism selection. Tracked explicitly in §27, not silently worked around. |
| `04_Data_Model_and_Ownership.md`'s full base-entity standard (§1: `public_id`, `project_id`, `version`, `lock_version`, `retention_category`, `confidentiality`, `audit_context_id`, etc.) is richer than Phase 1A's minimal `BaseEntity` shared type (`id`, `createdAt`, `updatedAt` only) | Flagged as an explicit open design decision for the reviewer (§27) rather than silently picking one shape — reconciling this correctly now avoids a costly rework once dozens of entities depend on whichever shape is chosen.                                    |
| `umzug` (§11) proves awkward in practice                                                                                                                                                                                                                                                    | Migration runner is isolated behind `packages/database`'s own scripts/exports — no consuming app calls `umzug` directly — so swapping tooling later is a contained, single-package change.                                                                        |
| RPO/RTO targets (15 min / 4 hr) implicitly expected by stakeholders once "the database" exists                                                                                                                                                                                              | This package explicitly does not claim those targets are met by shipping the framework alone (§23) — avoids a false sense of operational readiness before the backup/restore runbook (a separate, later G5.5 deliverable) actually exists.                        |
| Two-tier entity-creation gate (package approval, then separate model authorization) is confusing in practice                                                                                                                                                                                | Both gates are stated explicitly in this document (§9, §24) and should be restated again, unambiguously, in whatever execution instruction is issued against this package — not left implicit.                                                                    |

## 27. Open setup inputs

- **Blocking for execution (not for this document):** the exact Vercel Postgres Marketplace
  provider — must satisfy both the North America East Coast requirement and the Neon exclusion
  (WDS-002) simultaneously, per ADR-0007. Tracked in
  `docs/project-state/setup-input-register.md`, explicitly named as Task 3's own dependency in
  `docs/phase-plans/phase-1-foundation-plan.md`. **If, when this is resolved, no provider can
  satisfy both requirements at once, that is a genuine conflict to escalate to the project owner
  — not something to silently resolve by relaxing either constraint** (ADR-0007's own stop
  condition, restated here for visibility).
- **Not blocking, but needs a decision before/at implementation:**
  - The exact database connection-string environment-variable name(s) — no prior ADR fixes this;
    §12 proposes `DATABASE_URL` as a starting assumption, finalized once the provider's own
    injected variable name is known.
  - Base-entity column-shape reconciliation between the full standard
    (`04_Data_Model_and_Ownership.md` §1) and Phase 1A's minimal shared `BaseEntity` type (§26).
  - Preview-environment database strategy: shared vs. per-PR-ephemeral (§17) — not resolved by
    any existing document; this task package is the first place it's been raised.
  - Exact serverless connection-pool sizing (§13's `max: 2` is a proposed starting point, not a
    tuned value) — revisit once real load characteristics are known.

## 28. Estimated implementation sequence

1. Add proposed dependencies to `packages/database/package.json` (§11), gated on this package's
   approval — not before.
2. Implement `connection.ts`'s real `getConnection()` against the (by then, hopefully confirmed)
   Postgres Marketplace provider's connection details, with serverless-aware pooling (§12/§13).
3. Implement the migration framework (`migrations/` structure, `umzug`-based `migrate.ts`,
   `package.json` scripts) with zero migrations yet — prove the runner works against an empty
   schema first.
4. Implement `transaction.ts`'s `withTransaction()` helper (§15), tested against the disposable
   database from step 2.
5. Implement `base-repository.ts` (§16) against the existing `Repository<TEntity>` interface,
   using a minimal test-only Sequelize model (not yet one of the "real" proposed entities) to
   prove the pattern works in isolation.
6. Implement `health.ts` (§9) as a thin wrapper proving the connection is genuinely alive.
7. **Checkpoint — separate authorization required before proceeding to step 8** (§9/§24).
8. If authorized: add the `projects` and `users` migrations/models, and re-run
   `base-repository.ts`'s tests against them instead of the test-only model from step 5.
9. Wire the CI migration-test job/step (§9/§18) against a `postgres:16` service container.
10. Full validation pass (§22), documentation deliverables (§30), git-workflow closeout matching
    the pattern already proven in Phase 1A.

## 29. Required reviewers

- **Architect / DBA** — the role explicitly named in `docs/phase-plans/phase-1-foundation-plan.md`
  Task 3's own "Authorized role" field; reviews the connection/pooling/migration/transaction
  design against ADR-0006/0007 and the database contract.
- **PM** — reviews scope adherence (in-scope vs. out-of-scope, §7/§8) and the two-tier
  entity-creation gate (§24).
- **Infrastructure owner** — specifically for the Postgres Marketplace provider decision (§27),
  independent of and prior to the rest of this package's approval, per ADR-0007.
- Per ADR-0010's separation-of-duties rule, no reviewer approves their own implementation —
  applies here exactly as it applied to Phase 1A's checklist (the authoring agent cannot
  self-approve either this package or its eventual execution).

## 30. Completion evidence

Once this package is executed (a separate, future authorization — not part of this document),
completion evidence should mirror the exact discipline already proven working in Phase 1A:

- `docs/project-state/phase-1b-validation-report.md` — real, captured command output (not
  narrated), following `docs/project-state/phase-1a-validation-report.md`'s precedent.
- `docs/project-state/phase-1b-approval-checklist.md` — unsigned by the authoring agent, awaiting
  human sign-off, structured the same way as Phase 1A's checklist (completion-condition
  checklist, forbidden-actions check, commit record, sign-off table).
- `docs/traceability/phase-0-requirements-traceability.md`'s REQ-003 row updated (status moves
  from "Architecture Defined... Provider unconfirmed" toward whatever the real outcome is).
- `docs/phase-plans/phase-1-foundation-plan.md`'s Task 3 status line updated.
- `outputs/webdesk-growth-dashboard/HANDOFF.md` updated.
- A verified remote commit SHA, independently confirmed via `git ls-remote` (not just trusted
  from local state) — same discipline as Phase 1A's git-workflow record.
- A PR opened against `main`, **not merged automatically** — human merge decision, same as
  Phase 1A.
- `project.json`'s `gates[]` updated with a new `G-Schema` entry once that gate is actually
  passed.

---

_This document is itself the deliverable for the current authorization. Per the task brief:
**stop here.** No code was written, no dependency was installed, no migration was created, no
database connection was made, and Phase 1B implementation was not begun._
