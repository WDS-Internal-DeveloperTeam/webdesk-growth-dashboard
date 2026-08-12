import { closeConnection, getConnection } from "./connection.js";

/**
 * Pure read-only diagnostic: `node dist/list-auth-events.js [limit]`. Runs a
 * single SELECT against `auth_events` — no DDL, no writes. Exists because
 * `GoogleAuthService`'s rejection reason is deliberately never surfaced to
 * the browser or console logs (knowledge/05: "without leaking to the
 * rejected user *which* check failed"), but it IS recorded here, so this is
 * the only way to see *why* a login attempt was rejected without guessing.
 */
async function main(): Promise<void> {
  const limit = Number(process.argv[2] ?? 10);
  const sequelize = getConnection();

  const [rows] = await sequelize.query(
    `SELECT event_type, success, reason, auth_method, created_at
     FROM auth_events
     ORDER BY created_at DESC
     LIMIT :limit;`,
    { replacements: { limit } },
  );

  // eslint-disable-next-line no-console -- this IS the CLI's own output, not application logging.
  console.log(JSON.stringify(rows, null, 2));

  await closeConnection();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
