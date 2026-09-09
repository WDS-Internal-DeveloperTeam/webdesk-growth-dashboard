import { z } from "zod";

/**
 * "The dashboard never exposes raw WP-CLI command execution to any operator or automated
 * process. Instead, each allowlisted operation is a named, parameterized action... never a
 * free-text command field." (profile `02-wp-cli-and-deployment.md` "Production WP-CLI allowlist
 * enforcement"). The functions below are the ENTIRE surface of WP-CLI access from the dashboard —
 * there is no generic "run WP-CLI command" export from this file, and there must never be one. A
 * new allowlisted action requires a new named function here, reviewed at Code Review.
 *
 * WP-CLI/SSH actual provisioning on the WordPress.com hosting plan is still an unconfirmed
 * setup-time input (docs/project-state/setup-input-register.md, "WP-CLI/SSH actual provisioning
 * and WordPress.com restrictions") — no real executor is wired in yet. `WpCliExecutor` is the seam
 * a real SSH-backed implementation plugs into once that's confirmed; `NotConfiguredWpCliExecutor`
 * is the only implementation today, and it throws rather than fabricating a result — the same
 * "the one real adapter in the system physically cannot claim work it never did" discipline as
 * `UnconfiguredNotificationDeliveryAdapter` (`apps/dashboard-api/src/notifications/delivery-adapter.ts`).
 */

export type WordPressEnvironment = "development" | "staging" | "production";

export interface WpCliResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

/** The seam a real SSH-backed WP-CLI implementation plugs into — see this file's own doc comment. */
export interface WpCliExecutor {
  run(env: WordPressEnvironment, args: readonly string[]): Promise<WpCliResult>;
}

export class WpCliNotConfiguredError extends Error {
  constructor(env: WordPressEnvironment) {
    super(
      `No WP-CLI executor is configured for the "${env}" environment — WP-CLI/SSH provisioning ` +
        "has not been confirmed for this project yet (docs/project-state/setup-input-register.md).",
    );
    this.name = "WpCliNotConfiguredError";
  }
}

/** The only wired-in executor today — see this file's own doc comment for why it throws rather than fabricating a result. */
export class NotConfiguredWpCliExecutor implements WpCliExecutor {
  async run(env: WordPressEnvironment, _args: readonly string[]): Promise<WpCliResult> {
    return Promise.reject(new WpCliNotConfiguredError(env));
  }
}

export interface VersionInfo {
  readonly wpVersion: string;
  readonly phpVersion: string;
}

export interface CacheClearResult {
  readonly cleared: boolean;
  readonly message: string;
}

export interface DbCheckResult {
  readonly ok: boolean;
  readonly message: string;
}

const migrationReportSchema = z.object({
  dryRun: z.boolean(),
  beforeCounts: z.record(z.string(), z.number()),
  afterCounts: z.record(z.string(), z.number()),
  errors: z.array(z.object({ recordId: z.string(), message: z.string() })),
  rollbackInstructions: z.string(),
});

export type MigrationReport = z.infer<typeof migrationReportSchema>;

/**
 * A basic safety net, not a verified tie to a real reviewed deployment record — a caller can
 * satisfy this with a bare `{ approved: true }`. ADR-0013's own "approved deployment workflow" is
 * the repository/branch/release/GitHub-deployment process described there, which this package has
 * no way to inspect; this check only guarantees the flag was passed deliberately, not that a real
 * approval happened. Whoever wires this into a real caller is responsible for deriving `approved`
 * from an actual reviewed record (a gate decision, a merged PR, a signed release), never from
 * something superficial like "the caller is an admin session."
 */
function assertProductionWriteApproved(
  env: WordPressEnvironment,
  isWrite: boolean,
  approved: boolean | undefined,
): void {
  if (env === "production" && isWrite && approved !== true) {
    throw new Error(
      'Production WP-CLI writes require explicit { approved: true } from the approved deployment workflow (ADR-0013) — "no direct, unreviewed production write path exists".',
    );
  }
}

/**
 * Two separate `wp` invocations, not one `wp core version --extra` call — that command's real
 * output is multi-line labeled text ("WordPress version: X\nDatabase revision: Y\n...") with no
 * PHP version in it at all, not the single line of two space-separated tokens an earlier version
 * of this function assumed (a real bug caught in code review, before any real executor ever ran
 * it). `wp core version` alone reliably prints just the version string; PHP's own version has no
 * dedicated `wp` subcommand, so `wp eval` reads it directly from the running PHP process.
 */
export async function checkCoreVersion(
  executor: WpCliExecutor,
  env: WordPressEnvironment,
): Promise<VersionInfo> {
  const [wpResult, phpResult] = await Promise.all([
    executor.run(env, ["core", "version"]),
    executor.run(env, ["eval", "echo PHP_VERSION;"]),
  ]);
  return { wpVersion: wpResult.stdout.trim(), phpVersion: phpResult.stdout.trim() };
}

export async function clearCache(
  executor: WpCliExecutor,
  env: WordPressEnvironment,
): Promise<CacheClearResult> {
  const result = await executor.run(env, ["cache", "flush"]);
  return { cleared: result.exitCode === 0, message: result.stdout.trim() || result.stderr.trim() };
}

export async function flushRewriteRules(
  executor: WpCliExecutor,
  env: WordPressEnvironment,
): Promise<void> {
  const result = await executor.run(env, ["rewrite", "flush", "--hard"]);
  if (result.exitCode !== 0) {
    // Unlike clearCache/checkDatabase (which report success/failure via their return value),
    // this signature is `Promise<void>` per the profile spec — throwing on failure is the only
    // way this function can avoid silently reporting success for a failed flush.
    throw new Error(
      `flushRewriteRules failed (exit ${result.exitCode}): ${result.stderr.trim() || result.stdout.trim()}`,
    );
  }
}

/** Non-mutating — the allowlist's own "database checks (non-mutating)" entry. */
export async function checkDatabase(
  executor: WpCliExecutor,
  env: WordPressEnvironment,
): Promise<DbCheckResult> {
  const result = await executor.run(env, ["db", "check"]);
  return { ok: result.exitCode === 0, message: result.stdout.trim() || result.stderr.trim() };
}

/**
 * Per `02-wp-cli-and-deployment.md` "Migration command technical requirements" —
 * `--dry-run` is the default; `opts.dryRun: false` (a real `--apply`) against `production`
 * requires `opts.approved: true`. This function only shapes the CLI invocation and its report;
 * the requirements themselves (backup-before-apply, idempotency, per-record error logging,
 * before/after counts, rollback instructions in the output) are the migration command's own job
 * on the WordPress side — this is the dashboard-side trigger, not the migration's implementation.
 */
export async function runCaseStudyMigration(
  executor: WpCliExecutor,
  env: WordPressEnvironment,
  opts: { readonly dryRun: boolean; readonly approved?: boolean },
): Promise<MigrationReport> {
  assertProductionWriteApproved(env, !opts.dryRun, opts.approved);

  const result = await executor.run(env, [
    "webdesk",
    "migrate-case-study-portfolio",
    opts.dryRun ? "--dry-run" : "--apply",
    "--format=json",
  ]);

  if (result.exitCode !== 0) {
    throw new Error(
      `runCaseStudyMigration failed (exit ${result.exitCode}): ${result.stderr.trim() || result.stdout.trim()}`,
    );
  }

  // Boundary validation (NODE-005) applied to WP-CLI's own stdout, same as every other
  // externally-produced response this project validates before trusting it.
  return migrationReportSchema.parse(JSON.parse(result.stdout));
}
