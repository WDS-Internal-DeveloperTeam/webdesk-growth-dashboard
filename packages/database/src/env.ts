import { loadEnv } from "@webdesk/configuration";
import { z } from "zod";

/**
 * Read and validated inside packages/database ONLY (ADR-0006, WDS-011) —
 * no other app/package ever parses DATABASE_URL. No literal env-var name is
 * mandated by any prior ADR/contract; DATABASE_URL is this task's own
 * proposal (docs/task-packages/phase-1b-database-foundation.md §12),
 * matching the shape most Vercel Postgres Marketplace integrations inject.
 */
export const databaseEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  /**
   * Serverless-aware pool sizing (small, not a persistent-process default
   * like `max: 10`) — see §13's reasoning. Defaults are a starting point,
   * not a tuned value; revisit once real load characteristics are known.
   */
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(20).default(2),
  DATABASE_POOL_MIN: z.coerce.number().int().min(0).max(20).default(0),
  DATABASE_POOL_IDLE_MS: z.coerce.number().int().min(1000).default(10_000),
  DATABASE_POOL_ACQUIRE_MS: z.coerce.number().int().min(1000).default(30_000),
  /** SSL is required in every environment — see §12. */
  DATABASE_SSL: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
});

export type DatabaseEnv = z.infer<typeof databaseEnvSchema>;

export function loadDatabaseEnv(
  source: Record<string, string | undefined> = process.env,
): DatabaseEnv {
  return loadEnv(databaseEnvSchema, source);
}
