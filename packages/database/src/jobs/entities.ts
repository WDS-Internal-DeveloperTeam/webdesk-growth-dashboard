/**
 * The reusable operational-job model (Phase 1E job-architecture brief §9/§10)
 * — persistence-layer shapes for `jobs` (migration `00020`) and
 * `job_attempts` (migration `00021`). See
 * `docs/task-packages/phase-1e-job-architecture.md`.
 */

export type JobStatus =
  "pending" | "queued" | "running" | "retrying" | "succeeded" | "failed" | "cancelled" | "expired";

/** Per §12's failure-classification list. STRING, not a closed TS union at the DB layer — evolvable, validated in the service layer. */
export type FailureCategory =
  | "retryable_transient"
  | "permanent"
  | "validation"
  | "authorization"
  | "dependency_unavailable"
  | "rate_limited"
  | "cancelled"
  | "timeout"
  | "unknown";

/** Per §14. `null` means no cancellation has ever been requested. */
export type CancellationState =
  "requested" | "acknowledged" | "cancelled_safely" | "too_late" | "failed";

export interface JobEntity {
  readonly id: string;
  readonly jobType: string;
  readonly projectId: string | null;
  readonly resourceType: string | null;
  readonly resourceId: string | null;
  readonly requestedByUserId: string | null;
  readonly status: JobStatus;
  readonly progress: number | null;
  readonly currentStep: string | null;
  readonly idempotencyKey: string | null;
  readonly retryPolicy: Record<string, unknown> | null;
  readonly attemptCount: number;
  readonly maxAttempts: number;
  readonly timeoutSeconds: number | null;
  readonly scheduledAt: string | null;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
  readonly heartbeatAt: string | null;
  readonly cancellationState: CancellationState | null;
  readonly failureCode: string | null;
  readonly failureCategory: FailureCategory | null;
  readonly failureSummary: string | null;
  readonly nextRetryAt: string | null;
  readonly workerIdentity: string | null;
  readonly correlationId: string | null;
  readonly retentionCategory: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Per §12's retry-decision vocabulary — what an attempt's outcome implies for the job going forward. */
export type RetryDecision =
  | "will_retry"
  | "no_retry_permanent"
  | "no_retry_max_attempts"
  | "no_retry_cancelled"
  | "manual_retry_required";

export type JobAttemptResult = "succeeded" | "failed" | "cancelled" | "timeout";

export interface JobAttemptEntity {
  readonly id: string;
  readonly jobId: string;
  readonly attemptNumber: number;
  readonly startedAt: string;
  readonly finishedAt: string | null;
  readonly handler: string | null;
  readonly result: JobAttemptResult | null;
  readonly failureCategory: FailureCategory | null;
  readonly failureSummary: string | null;
  readonly retryDecision: RetryDecision | null;
  readonly correlationId: string | null;
  readonly evidenceReference: string | null;
  readonly createdAt: string;
}
