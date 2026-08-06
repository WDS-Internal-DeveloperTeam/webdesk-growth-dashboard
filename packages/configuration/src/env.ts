/**
 * Phase 1A environment schema — foundation only. Covers only what every app
 * needs to boot (runtime mode, service port, log level). Integration-specific
 * variables (database URL, GitHub App credentials, Google OAuth client,
 * SMTP, Blob tokens, etc.) are added when their owning integration is
 * actually authorized and implemented (Phase 1B+) — never speculatively
 * added ahead of that, per this project's "no unconfirmed setup values"
 * discipline (see docs/project-state/setup-input-register.md).
 */
import { z } from "zod";

export const baseEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  PORT: z.coerce.number().int().min(1).max(65535).optional(),
});

export type BaseEnv = z.infer<typeof baseEnvSchema>;

/**
 * Validates `source` (defaults to `process.env`) against `schema` and
 * returns the parsed, typed result. Throws with every validation issue
 * listed if `source` doesn't satisfy `schema` — fail fast at boot, never
 * silently continue with `undefined` propagating into application code.
 */
export function loadEnv<TSchema extends z.ZodType>(
  schema: TSchema,
  source: Record<string, string | undefined> = process.env,
): z.infer<TSchema> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Environment validation failed:\n${issues}`);
  }
  return result.data;
}
