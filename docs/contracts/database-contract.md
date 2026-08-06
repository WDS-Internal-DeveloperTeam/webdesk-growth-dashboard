# Integration Contract — Database (PostgreSQL / Sequelize)

**Status:** Draft. No schema exists yet; the Postgres Marketplace provider is unconfirmed. This contract defines the intended shape so implementation can proceed against an agreed interface, not so schema work can begin.

## Purpose

Provide the dashboard's sole relational data store, per ADR-0006 and ADR-0007.

## Trust boundary

`packages/database` is the only code in the monorepo that instantiates a Sequelize connection or defines models, per ADR-0006 and WDS-011. `dashboard-api` and `dashboard-worker` both consume `packages/database`'s exported models/query helpers; neither opens its own connection.

## Authentication

Database credentials (connection string) read from environment variables inside `packages/database` only, never duplicated into another app's config.

## Authorization

Application-level authorization (RBAC, ADR-0010) is enforced in `dashboard-api` before any query is issued — the database connection itself uses a single application-level role, not per-user database credentials; row-level access control is application-enforced, not database-enforced, for V1.

## Inputs and outputs

Standard CRUD operations against the dashboard's schema (users, projects, scan results, notifications, audit events, and every other module's data), per `04_Data_Model_and_Ownership.md`.

## Validation

Sequelize model-level validation (types, required fields, associations) is the first validation layer; module-level business validation happens in `dashboard-api` before reaching `packages/database`.

## Error handling

Database errors (constraint violations, connection failures) are caught and translated into meaningful application-level errors — a raw database error message is never surfaced directly to a dashboard user.

## Retry and idempotency

Connection-level transient failures (e.g., a brief network blip) are retried with backoff at the connection-pool level; application-level write idempotency is handled per-operation where relevant (e.g., audit-event insertion, ADR-0017), not assumed globally.

## Rate limits

Not applicable in the traditional sense; connection-pool sizing under Vercel's serverless execution model (many short-lived invocations) is the actual operational constraint — addressed via a connection pooler, exact configuration a Phase 1 decision.

## Audit events

Schema migrations themselves are recorded in Sequelize's own migration-tracking table; application-data changes are audited per ADR-0017 at the application level, not the database level.

## Secret handling

Connection string/credentials managed per `docs/security/secrets-management-plan.md`, per environment, with provider-specific rotation support depending on the chosen Marketplace provider (ADR-0007).

## Environment separation

Fully separate databases per environment (development, staging, production) — no shared database instance across environments under any circumstance.

## Failure recovery

Backup/restore follows `knowledge/11-retention-backup-and-operations.md`'s cadence, extended to cover the dashboard's own database (previously scoped to WordPress backups; this contract confirms the same discipline applies here). The db-restore runbook (`project.json.runbooks_status.db_restore`, currently "missing") is a Phase 1 operational deliverable.

## Test requirements

Migration tests run against a disposable test database, never against staging or production; model-level tests cover validation and association behavior.

## Production approval requirements

Every migration requires review before being applied to staging, and a separate, explicit approval before being applied to production — no migration auto-applies on deploy without this gate.

## Open items

Exact Vercel Postgres Marketplace provider (must satisfy both the North America East Coast region requirement and the Neon exclusion, WDS-002) and connection-pooling configuration are unconfirmed — see ADR-0007 and `docs/project-state/setup-input-register.md`. This is a hard blocker for any database-dependent implementation work, though not for this contract document itself.
