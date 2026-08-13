/** NestJS DI tokens for the Phase 1E job-architecture slice — kept in one file, same pattern as ../audit/audit.constants.ts. */
export const JOB_REPOSITORY = Symbol("JOB_REPOSITORY");
export const JOB_ATTEMPT_REPOSITORY = Symbol("JOB_ATTEMPT_REPOSITORY");
export const IDEMPOTENCY_KEY_REPOSITORY = Symbol("IDEMPOTENCY_KEY_REPOSITORY");

/**
 * Job types explicitly declared cancellable (brief §14: "each future job
 * type must explicitly declare cancellation capability"). No real job
 * producer exists yet in this slice, so this set is intentionally almost
 * empty — `"framework_probe"` is the one test-shaped entry, the same
 * "prove the mechanism, not a business module" pattern
 * `packages/database`'s `_framework_probe` table set in Phase 1B. A future
 * business module adds its own real job type here once it actually knows
 * what safely stopping mid-execution means for it. Not exported as mutable
 * state — extend this literal set directly when that day comes.
 */
export const CANCELLABLE_JOB_TYPES: ReadonlySet<string> = new Set(["framework_probe"]);
