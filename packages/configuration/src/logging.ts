/**
 * Shared Pino-compatible logging configuration. Every app builds its own
 * Pino instance (or NestJS's Pino integration) FROM this config — this
 * module does not instantiate a logger itself, to avoid a hidden shared
 * singleton across apps with different process lifecycles.
 */
import type { BaseEnv } from "./env.js";

/**
 * Field-name-based redaction paths, per Pino's own redact option. Matches
 * by common field name regardless of nesting depth pattern used here —
 * broadened as real integrations (Phase 1B+) introduce new sensitive field
 * names (e.g. specific token/credential field names once those integrations
 * exist). Never log Confidential/Restricted data in plaintext, per
 * docs/security/data-classification.md.
 */
export const DEFAULT_REDACT_PATHS: readonly string[] = [
  "*.password",
  "*.token",
  "*.secret",
  "*.apiKey",
  "*.authorization",
  "*.cookie",
  "req.headers.authorization",
  "req.headers.cookie",
];

export interface PinoLikeOptions {
  readonly level: string;
  readonly redact: {
    readonly paths: readonly string[];
    readonly censor: string;
  };
  readonly base: Readonly<Record<string, unknown>> | null;
  readonly timestamp: boolean;
}

/** Builds the options object every app passes to its own Pino instance. */
export function buildLoggerOptions(
  env: Pick<BaseEnv, "LOG_LEVEL">,
  serviceName: string,
): PinoLikeOptions {
  return {
    level: env.LOG_LEVEL,
    redact: {
      paths: [...DEFAULT_REDACT_PATHS],
      censor: "[REDACTED]",
    },
    base: { service: serviceName },
    timestamp: true,
  };
}
