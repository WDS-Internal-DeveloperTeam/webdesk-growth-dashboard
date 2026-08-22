// CommonJS-consumer entrypoint (dist-cjs/, see package.json's "exports"
// "require" condition). Deliberately omits buildMigrator/migrate.ts's
// export: that CLI internally uses import.meta.url (directory
// self-location for the migrations glob), which TypeScript cannot emit
// under a CommonJS module target. Migrations always run via the ESM
// build (`pnpm migrate*` -> node dist/migrate.js) - no CJS consumer
// (dashboard-api) calls buildMigrator, so nothing is lost here. See
// index.ts for the full ESM-facing export surface.
export type { Repository } from "./repository.js";
export { SequelizeRepository } from "./base-repository.js";
export { closeConnection, getConnection, resetConnectionForTests } from "./connection.js";
export { databaseEnvSchema, loadDatabaseEnv, type DatabaseEnv } from "./env.js";
export { withTransaction } from "./transaction.js";
export { checkDatabaseHealth } from "./health.js";
export * from "./auth/index.js";
export * from "./authz/index.js";
export * from "./audit/index.js";
export * from "./jobs/index.js";
export * from "./idempotency/index.js";
export * from "./notifications/index.js";
export * from "./operational-contacts/index.js";
export * from "./retention/index.js";
export * from "./system-operations/index.js";
export * from "./projects/index.js";
export * from "./business-knowledge/index.js";
export * from "./service-library/index.js";
export * from "./persona-library/index.js";
