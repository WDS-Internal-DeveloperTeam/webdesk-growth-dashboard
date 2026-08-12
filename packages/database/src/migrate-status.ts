import { closeConnection } from "./connection.js";
import { buildMigrator } from "./migrate.js";

/**
 * Read-only migration status: `node dist/migrate-status.js`. Reports which
 * migrations have already been applied vs. which are still pending, via
 * Umzug's own `executed()`/`pending()` — both pure reads against the
 * migration-tracking table (`SequelizeMeta` by default), never `up()`/
 * `down()`. Safe to run against a production database: makes no schema
 * changes, applies nothing, reverts nothing.
 */
async function main(): Promise<void> {
  const migrator = buildMigrator();

  const [executed, pending] = await Promise.all([migrator.executed(), migrator.pending()]);

  // eslint-disable-next-line no-console -- this IS the CLI's own output, not application logging.
  console.log(`Executed (${executed.length}): ${executed.map((m) => m.name).join(", ") || "none"}`);
  // eslint-disable-next-line no-console -- this IS the CLI's own output, not application logging.
  console.log(`Pending (${pending.length}): ${pending.map((m) => m.name).join(", ") || "none"}`);

  await closeConnection();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
