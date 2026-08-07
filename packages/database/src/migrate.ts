import { fileURLToPath } from "node:url";
import path from "node:path";
import { SequelizeStorage, Umzug } from "umzug";
import { closeConnection, getConnection } from "./connection.js";
import { loadDatabaseEnv } from "./env.js";

/**
 * CLI migration runner: `node dist/migrate.js up` / `node dist/migrate.js
 * down`. Never invoked with sync({ alter: true }) or any other
 * production-schema-sync mechanism — migrations are the only schema-change
 * path (ADR-0006, WDS-011). `down` reverts exactly the most recently
 * applied migration (standard single-step rollback semantics), not
 * everything — see docs/task-packages/phase-1b-database-foundation.md §14.
 *
 * Matches `.js` when running compiled (`node dist/migrate.js`) or `.ts`
 * when the integration test suite imports this module directly from
 * `src/`, transformed on the fly by Vitest (`import.meta.url` then points
 * at `src/migrate.ts`, so `src/migrations/*.ts` is what exists on disk in
 * that context). A `*.{js,ts}` glob looks tempting but is wrong: `.d.ts`
 * declaration files sitting alongside the compiled `.js` output also end
 * in `.ts` and would match too, and umzug would try to "run" one as a
 * migration (caught by actually executing the compiled CLI end-to-end
 * against a real database, not just by reading the code).
 */
function buildMigrationsGlob(): string {
  const url = import.meta.url;
  const here = path.dirname(fileURLToPath(url));
  const extension = url.endsWith(".ts") ? "ts" : "js";
  return path.join(here, "migrations", `*.${extension}`);
}

export function buildMigrator(env = loadDatabaseEnv()) {
  const sequelize = getConnection(env);
  return new Umzug({
    migrations: { glob: buildMigrationsGlob() },
    context: sequelize.getQueryInterface(),
    storage: new SequelizeStorage({ sequelize }),
    logger: console,
  });
}

async function main(): Promise<void> {
  const direction = process.argv[2];
  if (direction !== "up" && direction !== "down") {
    throw new Error("Usage: node dist/migrate.js <up|down>");
  }

  const migrator = buildMigrator();

  if (direction === "up") {
    const applied = await migrator.up();
    // eslint-disable-next-line no-console -- this IS the CLI's own output, not application logging.
    console.log(`Applied ${applied.length} migration(s): ${applied.map((m) => m.name).join(", ")}`);
  } else {
    const reverted = await migrator.down();
    // eslint-disable-next-line no-console -- this IS the CLI's own output, not application logging.
    console.log(
      `Reverted ${reverted.length} migration(s): ${reverted.map((m) => m.name).join(", ")}`,
    );
  }

  await closeConnection();
}

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);
if (isMainModule) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
