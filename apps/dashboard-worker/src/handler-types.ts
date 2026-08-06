/**
 * Core handler contract every dashboard-worker job type implements.
 * Per ADR-0004: no persistent process, no generic "run any job" switch
 * statement — one handler function per job type, each independently
 * triggerable and independently testable without live infrastructure.
 */

export interface JobContext {
  readonly jobId: string;
  readonly jobType: string;
  /** 1-indexed; at-least-once delivery is assumed (docs/contracts/vercel-background-jobs-contract.md). */
  readonly attempt: number;
  readonly idempotencyKey: IdempotencyKey;
  readonly enqueuedAt: string;
}

/** Branded to prevent an arbitrary string being passed where a real idempotency key is expected. */
export type IdempotencyKey = string & { readonly __brand: "IdempotencyKey" };

export function toIdempotencyKey(value: string): IdempotencyKey {
  if (value.length === 0) {
    throw new Error("Idempotency key must not be empty");
  }
  return value as IdempotencyKey;
}

export type JobResult<TOutput = void> =
  | { readonly outcome: "success"; readonly output: TOutput }
  | { readonly outcome: "retry"; readonly reason: string; readonly retryAfterSeconds?: number }
  | { readonly outcome: "failure"; readonly reason: string; readonly permanent: boolean };

export function jobSuccess<TOutput>(output: TOutput): JobResult<TOutput> {
  return { outcome: "success", output };
}

export function jobRetry(reason: string, retryAfterSeconds?: number): JobResult<never> {
  return { outcome: "retry", reason, retryAfterSeconds };
}

export function jobFailure(reason: string, permanent = false): JobResult<never> {
  return { outcome: "failure", reason, permanent };
}

/**
 * The contract every job-type handler implements. `TPayload` is validated
 * by the handler itself (per-handler, not centrally) before use — see
 * docs/contracts/vercel-background-jobs-contract.md's Validation section.
 */
export type JobHandler<TPayload, TOutput = void> = (
  payload: TPayload,
  context: JobContext,
) => Promise<JobResult<TOutput>>;

/**
 * Wraps a handler so the SAME payload + idempotency key processed twice
 * (at-least-once delivery) doesn't repeat side effects. Phase 1A: the
 * dedup store is in-memory only (per-process, resets on cold start) — a
 * real, durable idempotency store is Phase 1B, backed by packages/database.
 */
export function withIdempotency<TPayload, TOutput>(
  handler: JobHandler<TPayload, TOutput>,
  seen: Set<IdempotencyKey> = new Set(),
): JobHandler<TPayload, TOutput> {
  return async (payload, context) => {
    if (seen.has(context.idempotencyKey)) {
      return jobSuccess(undefined as TOutput);
    }
    const result = await handler(payload, context);
    if (result.outcome === "success") {
      seen.add(context.idempotencyKey);
    }
    return result;
  };
}
