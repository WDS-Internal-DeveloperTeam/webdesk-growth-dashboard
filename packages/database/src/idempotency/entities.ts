/**
 * The reusable idempotency primitive (brief §11) — persistence shape for
 * `idempotency_keys` (migration `00021`). See
 * `docs/task-packages/phase-1e-job-architecture.md §7`.
 */

export type IdempotencyProcessingState = "pending" | "completed" | "failed";

export interface IdempotencyKeyEntity {
  readonly id: string;
  readonly scope: string;
  readonly idempotencyKey: string;
  readonly resourceType: string | null;
  readonly action: string | null;
  readonly requesterUserId: string | null;
  readonly processingState: IdempotencyProcessingState;
  readonly resultReference: string | null;
  readonly createdAt: string;
  readonly expiresAt: string | null;
}
