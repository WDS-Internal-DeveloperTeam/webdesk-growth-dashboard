/**
 * Kept in sync with package.json's own "version" field manually — importing
 * package.json at runtime isn't viable under this app's tsconfig ("rootDir":
 * "src" excludes it). The single source every module needing the app's own
 * version reads from — health checks, the request logger, and Sentry release
 * tagging must never disagree with each other.
 */
export const API_VERSION = "0.1.0";
