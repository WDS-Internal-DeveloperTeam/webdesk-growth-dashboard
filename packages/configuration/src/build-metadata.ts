/**
 * Safe build/release metadata (Phase 1F brief §24) — application version,
 * git commit SHA, environment, deployment identifier. Reads Vercel's own
 * automatically-injected env vars (no manual wiring needed once deployed);
 * every field falls back to a clearly-labeled "unknown" outside Vercel
 * (local dev, CI) rather than fabricating a value. Deliberately excludes
 * anything beyond these — no internal repo paths, no infrastructure
 * details (brief's own "do not expose sensitive repository or
 * infrastructure metadata unnecessarily").
 */
export interface BuildMetadata {
  readonly version: string;
  readonly commitSha: string;
  /** Short (7-char) form of `commitSha`, convenient for display. */
  readonly commitShaShort: string;
  readonly environment: string;
  readonly deploymentId: string;
  /**
   * When this process started — the honest value actually available today.
   * Vercel exposes no true "code was compiled at X" timestamp via env var,
   * so labeling this "build timestamp" would overclaim; this is computed
   * once at module load (not per-call), so it stays stable for the life of
   * the process, same as a real build timestamp would.
   */
  readonly processStartedAt: string;
}

const UNKNOWN = "unknown";

// Computed once at module load, not per-call — see processStartedAt's own doc comment.
const PROCESS_STARTED_AT = new Date().toISOString();

/**
 * Reads directly from `process.env` rather than a Zod-validated schema —
 * these are optional, best-effort diagnostic values, not required
 * configuration; a missing one should never fail startup (unlike
 * `packages/configuration`'s `loadEnv`, which validates required config).
 *
 * @param version — each app's own `package.json` version (the caller's
 *   responsibility to supply; this module has no single app's package.json
 *   to read from).
 */
export function getBuildMetadata(version: string): BuildMetadata {
  const commitSha = process.env["VERCEL_GIT_COMMIT_SHA"] ?? UNKNOWN;
  return {
    version,
    commitSha,
    commitShaShort: commitSha === UNKNOWN ? UNKNOWN : commitSha.slice(0, 7),
    environment: process.env["VERCEL_ENV"] ?? process.env["NODE_ENV"] ?? UNKNOWN,
    deploymentId: process.env["VERCEL_DEPLOYMENT_ID"] ?? UNKNOWN,
    processStartedAt: PROCESS_STARTED_AT,
  };
}
