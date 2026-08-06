# ADR-0006 — PostgreSQL and Sequelize Architecture

**Status:** Accepted (formalizing an already-resolved decision — see below)

## Context

The dashboard needs a relational database for its structured data (users, projects, scan results, notifications, audit events, etc.). The base skill and Master Specification both point to PostgreSQL; the ORM/query-layer choice and migration ownership needed explicit recording before any schema work begins.

## Decision

- **Database:** PostgreSQL, provisioned through the Vercel Postgres Marketplace (see ADR-0007 for the provider-independence and exclusion rule).
- **ORM:** Sequelize, used only from `packages/database` — no other app or package instantiates its own Sequelize connection or defines its own models. `dashboard-api` and `dashboard-worker` both import models and query helpers from `packages/database`; neither owns a direct connection independently.
- **Migrations:** owned exclusively by `packages/database` (WDS-011) — no second migration path is permitted anywhere else in the monorepo, structurally enforced by the package boundary in ADR-0001.

## Alternatives considered

- **Prisma instead of Sequelize** — not selected; no requirement in the dashboard documentation pack calls for Prisma specifically, and Sequelize is the base skill's established default ORM for this project type. Revisit only if a concrete Sequelize limitation is found during Phase 1.
- **Raw SQL / query builder (e.g., Knex) without an ORM** — rejected: loses the model-level validation and association conveniences Sequelize provides for a schema of this module count.

## Consequences

Every module's data-access code goes through `packages/database`'s models, which centralizes query patterns and makes it possible to enforce row-level conventions (e.g., soft-delete columns, audit timestamps) consistently.

## Security considerations

A single connection-owning package makes credential handling auditable in one place — database credentials are read from environment variables only inside `packages/database`'s connection setup, never duplicated into another app's own config.

## Operational considerations

Connection pooling behavior under Vercel's serverless execution model (many short-lived function invocations, each potentially opening a connection) is a known operational risk for Postgres — addressed by ADR-0007's provider requirements and a Phase 1 connection-pooling strategy (e.g., a pooler such as PgBouncer or the Marketplace provider's own pooling), not fully designed here.

## Validation method

Reviewed against profile `knowledge/01-approved-architecture.md` and WDS-011.

## Approval gate

G-Schema (schema approval gate, per the base skill's gate sequence) in addition to G1.

## Related dashboard requirements

`04_Data_Model_and_Ownership.md`.

## Related skill rules

Profile `knowledge/01-approved-architecture.md`; WDS-011.

## Open setup values

Exact Vercel Postgres Marketplace provider and connection-pooling configuration — see ADR-0007 and `docs/project-state/setup-input-register.md`.
