import { closeConnection, getConnection } from "./connection.js";

/**
 * Pure read-only table listing: `node dist/list-tables.js`. Runs a single
 * SELECT against the `public` schema's own catalog view
 * (`pg_tables`/`information_schema`-equivalent) — no CREATE, no DDL of any
 * kind, unlike `migrate-status.ts` which still goes through Umzug's
 * `SequelizeStorage.syncModel()` and therefore attempts a
 * `CREATE TABLE IF NOT EXISTS "SequelizeMeta"` before it can even read.
 * Exists specifically to diagnose database state when that sync step
 * itself is failing (e.g. a `pg_type` catalog conflict) — this script
 * can't hit that failure mode because it issues no DDL at all.
 */
async function main(): Promise<void> {
  const sequelize = getConnection();

  const [rows] = await sequelize.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;`,
  );

  const tables = (rows as Array<{ tablename: string }>).map((r) => r.tablename);

  // eslint-disable-next-line no-console -- this IS the CLI's own output, not application logging.
  console.log(`Tables in 'public' schema (${tables.length}): ${tables.join(", ") || "none"}`);

  await closeConnection();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
