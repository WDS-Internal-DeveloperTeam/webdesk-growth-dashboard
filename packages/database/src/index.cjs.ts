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
export * from "./proof-and-claims-library/index.js";
export * from "./website-strategy-center/index.js";
export * from "./page-inventory/index.js";
export * from "./keyword-and-entity-library/index.js";
export * from "./internal-linking-library/index.js";
export * from "./content-template-library/index.js";
export * from "./review-and-approval-center/index.js";
export * from "./page-workspace/index.js";
export * from "./brand-library/index.js";
export * from "./design-reference-library/index.js";
export * from "./design-token-library/index.js";
export * from "./section-and-pattern-library/index.js";
export * from "./asset-library/index.js";
export * from "./component-library/index.js";
export * from "./wireframe-library/index.js";
export * from "./page-template-library/index.js";
export * from "./design-review-center/index.js";
export * from "./motion-and-interaction-library/index.js";
export * from "./case-study-studio/index.js";
export * from "./case-study-library/index.js";
export * from "./portfolio-library/index.js";
export * from "./knowledge-library/index.js";
export * from "./ready-for-claude-queue/index.js";
export * from "./workflow-and-task-template-library/index.js";
export * from "./scan-center/index.js";
export * from "./change-center/index.js";
export * from "./import-and-export-center/index.js";
