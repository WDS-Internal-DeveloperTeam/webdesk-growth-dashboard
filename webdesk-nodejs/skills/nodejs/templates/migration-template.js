/**
 * Sequelize migration template (ES Modules).
 *
 * Copy to `src/db/migrations/<timestamp>-<slug>.js`, e.g.
 *   `20260630120000-create-sync-state.js`.
 *
 * This file exports `up` and `down` named functions. That shape is accepted by
 * umzug (the migration runner most ESM Sequelize projects use) and mirrors the
 * sequelize-cli `{ up, down }` signature. If you standardize on sequelize-cli's
 * default CommonJS runner instead, keep the same body but adapt the module
 * wrapper at scaffold — pick ONE runner per project and stick to it.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * MIGRATION RULES (these are not optional — they keep production restorable):
 *
 *  1. REVERSIBLE. Every `up` has a real `down` that undoes it. A migration you
 *     cannot roll back is a migration you cannot deploy safely (see the
 *     deploy-recovery runbook).
 *
 *  2. ADDITIVE-FIRST. Prefer adding tables/columns/indexes over changing or
 *     dropping them. Add the new column, backfill, switch reads/writes, THEN
 *     remove the old one in a LATER migration — never in the same one.
 *
 *  3. NO DESTRUCTIVE CHANGE WITHOUT AN EXPLICIT NOTE. Dropping a column/table or
 *     a non-null/type change that can lose data must carry a `// DESTRUCTIVE:`
 *     comment explaining the data-loss window and how it was de-risked
 *     (backfill done, feature flag flipped, backup verified). Reviewers reject
 *     destructive changes that lack this note.
 *
 *  4. INDEX every column you filter or join on. Tenant-scoped tables get a
 *     `(tenant_id, ...)` composite so every per-tenant query (NODE-104) is
 *     index-covered. Add indexes in the same migration that adds the column.
 *
 *  5. WRAP MULTI-STEP MIGRATIONS IN A TRANSACTION. If `up` does more than one
 *     DDL/DML step, run them inside `sequelize.transaction` so a failure
 *     half-way leaves the schema unchanged rather than half-applied.
 *     (Note: some engines auto-commit certain DDL — Postgres is transactional
 *     for DDL, which is why this pattern is safe here.)
 *
 *  6. TENANT COLUMN ON TENANT-OWNED TABLES. Anything holding per-client data
 *     carries `tenant_id` so repositories can scope it (NODE-104).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { DataTypes } from "sequelize";

/**
 * Apply the migration.
 *
 * Worked example: create the `sync_state` table — the per-tenant, per-entity
 * record of how far each incremental ERP/store sync has progressed. The sync
 * engine reads `watermark`/`cursor` to resume after a kill (watermark-resume),
 * and reconciliation reads `updated_at` to detect stalled syncs.
 *
 * @param {object} context
 * @param {import('sequelize').QueryInterface} context.queryInterface
 * @param {import('sequelize').Sequelize} context.sequelize
 * @returns {Promise<void>}
 */
export async function up({ context: { queryInterface, sequelize } }) {
  // Multi-step: create table + create index → wrap in one transaction (rule 5).
  await sequelize.transaction(async (transaction) => {
    await queryInterface.createTable(
      "sync_state",
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        // Tenant scope — every per-tenant query filters on this (rule 6, NODE-104).
        tenant_id: {
          type: DataTypes.UUID,
          allowNull: false,
        },
        // Canonical entity name: 'items' | 'inventory' | 'orders' | ... .
        entity: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        // Incremental high-water mark (e.g. last seen modifiedAt, UTC ISO string).
        // Nullable: a first run starts at null = full sync.
        watermark: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        // Opaque provider pagination cursor for resumable mid-page runs. Nullable.
        cursor: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        // Bumped on every successful tick; reconciliation uses it to spot stalls.
        updated_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: sequelize.literal("CURRENT_TIMESTAMP"),
        },
      },
      { transaction },
    );

    // One row per (tenant, entity): a tenant syncs each entity exactly once.
    // Unique composite doubles as the lookup index for the engine (rule 4).
    await queryInterface.addIndex("sync_state", {
      name: "sync_state_tenant_entity_uniq",
      unique: true,
      fields: ["tenant_id", "entity"],
      transaction,
    });
  });
}

/**
 * Reverse the migration (rule 1). Drops the index implicitly with the table.
 *
 * This particular `down` IS destructive (it removes the table), but that is the
 * correct inverse of a create-table `up` and loses only data this migration
 * introduced — so no extra DESTRUCTIVE note is required here. For a `down` that
 * would drop a pre-existing column or table, add a `// DESTRUCTIVE:` note (rule 3).
 *
 * @param {object} context
 * @param {import('sequelize').QueryInterface} context.queryInterface
 * @param {import('sequelize').Sequelize} context.sequelize
 * @returns {Promise<void>}
 */
export async function down({ context: { queryInterface, sequelize } }) {
  await sequelize.transaction(async (transaction) => {
    await queryInterface.dropTable("sync_state", { transaction });
  });
}
