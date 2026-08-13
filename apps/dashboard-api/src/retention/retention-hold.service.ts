import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  RetentionHoldEntity,
  RetentionHoldRepository,
  RetentionHoldScope,
} from "@webdesk/database";
import { RETENTION_HOLD_REPOSITORY } from "./retention.constants.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime, see google-auth.service.ts's note.
import { AuditService } from "../audit/audit.service.js";

export interface CreateHoldInput {
  scope: RetentionHoldScope;
  resourceType?: string | null;
  resourceId?: string | null;
  categoryKey?: string | null;
  reasonCategory: string;
  reason: string;
  createdByUserId: string;
  approvedByUserId?: string | null;
  endDate?: Date | null;
}

/**
 * The legal/retention-hold service (brief §21). "Only authorized users may
 * create/release holds" is enforced at the controller (RBAC), not here —
 * this service enforces the other half: a hold's *shape* is valid for its
 * scope, and releasing one always requires a real reason and is always
 * recorded — "do not silently release a hold."
 */
@Injectable()
export class RetentionHoldService {
  constructor(
    @Inject(RETENTION_HOLD_REPOSITORY) private readonly holds: RetentionHoldRepository,
    private readonly auditService: AuditService,
  ) {}

  async createHold(input: CreateHoldInput): Promise<RetentionHoldEntity> {
    if (input.scope === "entity" && (!input.resourceType || !input.resourceId)) {
      throw new BadRequestException(
        "An entity-scoped hold requires both resourceType and resourceId",
      );
    }
    if (input.scope === "category" && !input.categoryKey) {
      throw new BadRequestException("A category-scoped hold requires categoryKey");
    }

    const hold = await this.holds.create(input);

    await this.auditService.record({
      eventType: "retention_hold_created",
      actorUserId: input.createdByUserId,
      actorType: "human",
      entityType: "retention_hold",
      entityId: hold.id,
      action: "create",
      reason: input.reason,
      retentionCategory: "approval-audit-7y",
    });

    return hold;
  }

  async releaseHold(
    id: string,
    input: { releaseReason: string; releasedByUserId: string },
  ): Promise<RetentionHoldEntity> {
    if (!input.releaseReason.trim()) {
      throw new BadRequestException("releaseReason is required to release a hold");
    }

    const existing = await this.holds.findById(id);
    if (!existing) {
      throw new NotFoundException(`Retention hold not found: ${id}`);
    }
    if (existing.status !== "active") {
      throw new BadRequestException(`Retention hold ${id} is already ${existing.status}`);
    }

    const released = await this.holds.release(id, input);
    if (!released) {
      throw new NotFoundException(`Retention hold not found: ${id}`);
    }

    await this.auditService.record({
      eventType: "retention_hold_released",
      actorUserId: input.releasedByUserId,
      actorType: "human",
      entityType: "retention_hold",
      entityId: id,
      action: "release",
      reason: input.releaseReason,
      retentionCategory: "approval-audit-7y",
    });

    return released;
  }

  async listHolds(
    filter: { status?: RetentionHoldEntity["status"] } = {},
  ): Promise<readonly RetentionHoldEntity[]> {
    return this.holds.listAll(filter);
  }
}
