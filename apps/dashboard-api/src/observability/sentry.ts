import * as Sentry from "@sentry/node";
import { getBuildMetadata, getSentryConfig } from "@webdesk/configuration";
import { API_VERSION } from "../version.js";

let enabled = false;

/**
 * Initializes Sentry only when a real DSN is configured (Phase 1F brief
 * §19–§22) — see `@webdesk/configuration`'s `getSentryConfig` for why no
 * real DSN exists yet. Safe to call unconditionally at boot: a no-op when
 * unconfigured, never a placeholder/test DSN.
 */
export function initSentry(dsn: string | undefined): void {
  const buildMetadata = getBuildMetadata(API_VERSION);
  const config = getSentryConfig({
    dsn,
    environment: buildMetadata.environment,
    release: buildMetadata.commitShaShort,
  });
  if (!config.enabled) {
    return;
  }
  Sentry.init({ dsn: config.dsn, environment: config.environment, release: config.release });
  enabled = true;
}

/**
 * Reports an unhandled exception to Sentry — a no-op when Sentry isn't
 * configured. Called only from AllExceptionsFilter, and only for the
 * server-error case (never for expected 4xx `HttpException`s, which aren't
 * incidents).
 */
export function captureException(exception: unknown): void {
  if (!enabled) {
    return;
  }
  Sentry.captureException(exception);
}
