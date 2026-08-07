import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  AuthEventRepository,
  RecoveryRequestEntity,
  RecoveryRequestRepository,
} from "@webdesk/database";
import { AUTH_EVENT_REPOSITORY, RECOVERY_REQUEST_REPOSITORY } from "../config/auth.constants.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime, see google-auth.service.ts's note.
import { SeparationOfDutiesService } from "../common/separation-of-duties.service.js";

/**
 * Foundation only (ADR-0009, knowledge/05 separation-of-duties) — request
 * creation and a second-administrator approval/rejection decision. No
 * self-service recovery, no automated unlocking; deciding *who* is
 * authorized to call `decide` at all (i.e. RBAC-gating this to admin roles)
 * is Task 6's job, layered on top of this once it exists.
 */
@Injectable()
export class RecoveryService {
  constructor(
    @Inject(RECOVERY_REQUEST_REPOSITORY) private readonly requests: RecoveryRequestRepository,
    @Inject(AUTH_EVENT_REPOSITORY) private readonly events: AuthEventRepository,
    private readonly separationOfDuties: SeparationOfDutiesService,
  ) {}

  async createRequest(input: {
    targetUserId: string;
    requestedByUserId: string | null;
    reason: string;
  }): Promise<RecoveryRequestEntity> {
    const request = await this.requests.create(input);
    await this.events.record({
      eventType: "recovery_request_created",
      userId: input.targetUserId,
      success: true,
    });
    return request;
  }

  async decide(input: {
    requestId: string;
    decidedByUserId: string;
    approve: boolean;
    note?: string;
    now?: Date;
  }): Promise<RecoveryRequestEntity> {
    const request = await this.requests.findById(input.requestId);
    if (!request) {
      throw new NotFoundException(`Recovery request not found: ${input.requestId}`);
    }
    if (request.status !== "pending") {
      throw new ForbiddenException(`Recovery request already decided: ${input.requestId}`);
    }
    this.separationOfDuties.assertDistinctActors(
      input.decidedByUserId,
      request.targetUserId,
      "target of the recovery request",
    );

    const decided = await this.requests.decide(input.requestId, {
      status: input.approve ? "approved" : "rejected",
      decidedByUserId: input.decidedByUserId,
      decidedAt: input.now ?? new Date(),
      ...(input.note !== undefined ? { note: input.note } : {}),
    });

    await this.events.record({
      eventType: input.approve ? "recovery_request_approved" : "recovery_request_denied",
      userId: request.targetUserId,
      success: true,
      reason: `decided_by:${input.decidedByUserId}`,
    });

    return decided;
  }
}
