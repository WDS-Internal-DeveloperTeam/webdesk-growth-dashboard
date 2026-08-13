import { Inject, Injectable } from "@nestjs/common";
import type { IdempotencyKeyEntity, IdempotencyKeyRepository } from "@webdesk/database";
import { IDEMPOTENCY_KEY_REPOSITORY } from "./jobs.constants.js";

export type IdempotentReservation =
  | { readonly outcome: "proceed"; readonly reservation: IdempotencyKeyEntity }
  | { readonly outcome: "duplicate"; readonly reservation: IdempotencyKeyEntity }
  | { readonly outcome: "conflict"; readonly reservation: IdempotencyKeyEntity };

/**
 * The reusable, DB-backed idempotency primitive (brief §11) — not folded
 * into `JobService` even though jobs are its first real consumer, since
 * §11 frames idempotency as a service-wide concern, not job-specific.
 * `JobService.create()` is the only current caller.
 */
@Injectable()
export class IdempotencyService {
  constructor(
    @Inject(IDEMPOTENCY_KEY_REPOSITORY) private readonly keys: IdempotencyKeyRepository,
  ) {}

  /**
   * Reserves `(scope, key)`. `"proceed"` means the caller should do the
   * real work and then call `complete`/`fail`. `"duplicate"` means a prior
   * attempt already finished — `reservation.resultReference` has what it
   * produced. `"conflict"` means another request is *currently* processing
   * the same key — the caller should reject, not retry silently, per
   * §11's "conflict detection."
   */
  async reserve(input: {
    scope: string;
    idempotencyKey: string;
    resourceType?: string | null;
    action?: string | null;
    requesterUserId?: string | null;
    expiresAt?: Date | null;
  }): Promise<IdempotentReservation> {
    const result = await this.keys.reserve(input);
    if (result.kind === "reserved") {
      return { outcome: "proceed", reservation: result.entity };
    }
    if (result.kind === "duplicate") {
      return { outcome: "duplicate", reservation: result.entity };
    }
    return { outcome: "conflict", reservation: result.entity };
  }

  async complete(reservationId: string, resultReference: string | null): Promise<void> {
    await this.keys.complete(reservationId, resultReference);
  }

  async fail(reservationId: string): Promise<void> {
    await this.keys.fail(reservationId);
  }
}
