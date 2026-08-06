/**
 * Connection configuration SHAPE only — no Sequelize import, no actual
 * connection logic. Real implementation is Phase 1B, once the Postgres
 * Marketplace provider is confirmed (see
 * docs/architecture/decisions/0007-database-provider-independence-east-coast.md
 * and docs/project-state/setup-input-register.md — currently blocking).
 */
export interface DatabaseConnectionConfig {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly ssl: boolean;
}

/**
 * Placeholder — intentionally throws. Prevents any Phase 1A code from
 * accidentally depending on a working connection before Phase 1B exists.
 */
export function getConnection(): never {
  throw new Error(
    "packages/database has no real connection implementation yet — this is a Phase 1A " +
      "interface placeholder. Real Sequelize connection setup is Phase 1B, gated on the " +
      "Postgres Marketplace provider (see docs/project-state/setup-input-register.md).",
  );
}
