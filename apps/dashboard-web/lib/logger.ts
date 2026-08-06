/**
 * Logging integration BOUNDARY for dashboard-web. Next.js App Router code
 * runs in both server and (occasionally) client contexts, so a full Pino
 * instance isn't appropriate here the way it is in dashboard-api/worker
 * (see packages/configuration/src/logging.ts, which dashboard-web does NOT
 * use directly for that reason). This module is the one seam server
 * components/route handlers log through — swap the implementation for a
 * real structured/Pino-compatible sink without touching call sites.
 */
export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export const logger: Logger = {
  info(message, meta) {
    // eslint-disable-next-line no-console -- this IS the logging boundary; console is the real sink here, not a debugging leftover.
    console.info(JSON.stringify({ level: "info", service: "dashboard-web", message, ...meta }));
  },
  warn(message, meta) {
    console.warn(JSON.stringify({ level: "warn", service: "dashboard-web", message, ...meta }));
  },
  error(message, meta) {
    console.error(JSON.stringify({ level: "error", service: "dashboard-web", message, ...meta }));
  },
};
