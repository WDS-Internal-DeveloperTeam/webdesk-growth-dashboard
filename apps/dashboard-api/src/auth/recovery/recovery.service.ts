import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  AuthEventRepository,
  RecoveryRequestEntity,
  RecoveryRequestRepository,
} from "@webdesk/database";
import { AUTH_EVENT_REPOSITORY, RECOVERY_REQUEST_REPOSITORY } from "../config/auth.constants.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime, see google-auth.service.ts's note.
import { SeparationOfDutiesService } from "../common/separation-of-duties.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- same reason as SeparationOfDutiesService above.
import { AuditService } from "../../audit/audit.service.js";

/**
 * Foundation only (ADR-0009, knowledge/05 separation-of-duties) — request
 * creation and a second-administrator approval/rejection decision. No
 * self-service recovery, no automated unlocking; deciding *who* is
 * authorized to call `decide` at all (i.e. RBAC-gating this to admin roles)
 * is Task 6's job, layered on top of this once it exists.
 *
 * `AuditService` calls here are additive alongside the existing narrow
 * `auth_events` writes below — nothing existing is removed. The
 * `assertDistinctActors` call is now wrapped the same way
 * `RoleAssignmentService.assertNotSelfTargeting` already wraps its own
 * equivalent call: this closes the specific gap the Phase 1D independent
 * code review and `docs/project-state/phase-1e-pre-implementation-verification.md`
 * item 7 both flagged — a self-approval attempt on a recovery request was
 * correctly *blocked* but never *recorded* anywhere.
 */
@Injectable()
export class RecoveryService {
  constructor(
    @Inject(RECOVERY_REQUEST_REPOSITORY) private readonly requests: RecoveryRequestRepository,
    @Inject(AUTH_EVENT_REPOSITORY) private readonly events: AuthEventRepository,
    private readonly separationOfDuties: SeparationOfDutiesService,
    private readonly auditService: AuditService,
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
    await this.auditService.record({
      eventType: "account_recovery_request",
      actorUserId: input.requestedByUserId,
      actorType: input.requestedByUserId ? "human" : "system",
      entityType: "recovery_request",
      entityId: request.id,
      action: "create",
      reason: input.reason,
      retentionCategory: "audit-7y",
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
    await this.assertNotSelfDeciding(input.decidedByUserId, request.targetUserId, request.id);

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
    await this.auditService.record({
      eventType: "account_recovery_decision",
      actorUserId: input.decidedByUserId,
      actorType: "human",
      entityType: "recovery_request",
      entityId: request.id,
      action: input.approve ? "approve" : "reject",
      ...(input.note !== undefined ? { reason: input.note } : {}),
      retentionCategory: "approval-audit-7y",
    });

    return decided;
  }

  /** Wraps `SeparationOfDutiesService.assertDistinctActors`: on denial, records a `security_exception` audit event before rethrowing, so the block itself is auditable — see this class's own doc comment. */
  private async assertNotSelfDeciding(
    decidedByUserId: string,
    targetUserId: string,
    requestId: string,
  ): Promise<void> {
    try {
      this.separationOfDuties.assertDistinctActors(
        decidedByUserId,
        targetUserId,
        "target of the recovery request",
      );
    } catch (error) {
      await this.auditService.record({
        eventType: "security_exception",
        actorUserId: decidedByUserId,
        actorType: "human",
        entityType: "recovery_request",
        entityId: requestId,
        action: "separation_of_duties_denied",
        reason: `target:${targetUserId}`,
        retentionCategory: "security-log-1y",
      });
      throw error;
    }
  }
}
