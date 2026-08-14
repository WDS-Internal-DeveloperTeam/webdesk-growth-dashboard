/**
 * Per-environment Sentry configuration (Phase 1F brief §19–§22). Deliberately
 * returns a plain data object rather than depending on the `@sentry/*` SDK
 * itself or calling `Sentry.init()` — same separation `buildLoggerOptions`
 * keeps from Pino: each app wires the real SDK, this package only decides
 * *what* it should be configured with.
 *
 * No real Sentry project/DSN exists yet for this project (not recorded in
 * docs/project-state/setup-input-register.md) — `enabled` is false and no
 * event is ever sent until a real `SENTRY_DSN` is set, the same
 * build-the-mechanism-first pattern as NotificationsModule's
 * `UnconfiguredNotificationDeliveryAdapter`.
 */
export interface SentryRuntimeConfig {
  readonly enabled: boolean;
  readonly dsn: string | undefined;
  readonly environment: string;
  readonly release: string;
}

export function getSentryConfig(params: {
  readonly dsn: string | undefined;
  readonly environment: string;
  readonly release: string;
}): SentryRuntimeConfig {
  return {
    enabled: Boolean(params.dsn && params.dsn.length > 0),
    dsn: params.dsn,
    environment: params.environment,
    release: params.release,
  };
}
