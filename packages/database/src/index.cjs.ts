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
