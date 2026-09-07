import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  IntegrationEntity,
  IntegrationListFilter,
  IntegrationRepository,
  IntegrationStatus,
} from "@webdesk/database";
import { isSequelizeUniqueConstraintError } from "@webdesk/validation";
import { INTEGRATION_REPOSITORY } from "./integrations.constants.js";
import type {
  CreateIntegrationDto,
  UpdateIntegrationDto,
  VerifyIntegrationDto,
} from "./integrations.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuditService } from "../audit/audit.service.js";

/**
 * Record-keeping only (D1) — `verify()` records a MANUAL, operator-supplied verification result;
 * it never makes a real outbound call to the underlying provider. `success` moves `status` to
 * `connected`, `failure` moves it to `error`, `unknown` leaves `status` untouched entirely (the
 * caller genuinely doesn't know the current state, so overwriting it either way would be
 * dishonest) — the simplest correct mapping onto the 4-value `IntegrationStatus` enum, since no
 * finer real-time signal exists for this module to derive one from.
 */
function statusForVerificationResult(
  result: VerifyIntegrationDto["result"],
  current: IntegrationStatus,
): IntegrationStatus {
  if (result === "success") {
    return "connected";
  }
  if (result === "failure") {
    return "error";
  }
  return current;
}

@Injectable()
export class IntegrationsService {
  constructor(
    @Inject(INTEGRATION_REPOSITORY) private readonly integrations: IntegrationRepository,
    private readonly auditService: AuditService,
  ) {}

  async create(input: CreateIntegrationDto, actorUserId: string): Promise<IntegrationEntity> {
    const existing = await this.integrations.findByPublicId(input.publicId);
    if (existing) {
      throw new BadRequestException(`publicId already in use: ${input.publicId}`);
    }

    let created: IntegrationEntity;
    try {
      created = await this.integrations.create(input);
    } catch (error) {
      // The publicId uniqueness check above is TOCTOU (two concurrent creates with the same
      // publicId can both pass it before either INSERT commits) — the real unique index catches
      // the race loser, but without this catch it would otherwise surface as a raw 500 instead of
      // the same clean 400 the check above already gives the non-racing caller. Uses the shared
      // `isSequelizeUniqueConstraintError()` helper (`@webdesk/validation`), mirroring
      // `BrandLibraryService.create()`'s own identical pattern.
      if (isSequelizeUniqueConstraintError(error)) {
        throw new BadRequestException(`publicId already in use: ${input.publicId}`);
      }
      throw error;
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      entityType: "integration",
      entityId: created.id,
      action: "create",
      afterState: { provider: created.provider, displayName: created.displayName },
      retentionCategory: "audit-7y",
    });

    return created;
  }

  async findById(id: string): Promise<IntegrationEntity> {
    const integration = await this.integrations.findById(id);
    if (!integration) {
      throw new NotFoundException(`Integration not found: ${id}`);
    }
    return integration;
  }

  async list(filter: IntegrationListFilter): Promise<readonly IntegrationEntity[]> {
    return this.integrations.list(filter);
  }

  /**
   * Content update — no terminal-state concept for this module: `isActive: false` is purely a
   * display/retirement filter (D-schema), not a workflow terminus, so a retired integration
   * remains freely editable (its config/notes may still need correcting even while inactive).
   * `status`/`lastVerified*`/`isActive` are never accepted here — `verify()`/`toggleActive()` are
   * the only routes that may change those.
   */
  async update(
    id: string,
    patch: UpdateIntegrationDto,
    actorUserId: string,
  ): Promise<IntegrationEntity> {
    const updated = await this.integrations.update(id, patch);
    if (!updated) {
      throw new NotFoundException(`Integration not found: ${id}`);
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      entityType: "integration",
      entityId: id,
      action: "update",
      afterState: { ...patch },
      retentionCategory: "audit-7y",
    });

    return updated;
  }

  /** Records a manual verification result — real gate is the `review` RBAC action, checked
   *  statically at the route via `@RequirePermission` (no dynamic per-transition check needed,
   *  unlike a content-approval workflow module — this is a single flat action, not a state
   *  machine). */
  async verify(
    id: string,
    input: VerifyIntegrationDto,
    actorUserId: string,
  ): Promise<IntegrationEntity> {
    const current = await this.findById(id);
    const nextStatus = statusForVerificationResult(input.result, current.status);

    const updated = await this.integrations.recordVerification(id, {
      status: nextStatus,
      result: input.result,
      notes: input.notes ?? null,
      verifiedByUserId: actorUserId,
    });
    if (!updated) {
      throw new NotFoundException(`Integration not found: ${id}`);
    }

    try {
      await this.auditService.record({
        eventType: "data_change",
        actorUserId,
        actorType: "human",
        entityType: "integration",
        entityId: id,
        action: "verify",
        beforeState: { status: current.status },
        afterState: { status: updated.status, result: input.result },
        retentionCategory: "audit-7y",
      });
    } catch (error) {
      console.error(
        `Integration ${id} verification recorded, but recording its audit event failed:`,
        error,
      );
    }

    return updated;
  }

  /** Toggles the retirement flag — real gate is the `configure` (`M`) RBAC action, the one
   *  action `owner_growth_approver` holds beyond `view`, matching System Settings' own
   *  precedent. */
  async setActive(id: string, isActive: boolean, actorUserId: string): Promise<IntegrationEntity> {
    const updated = await this.integrations.setActive(id, isActive);
    if (!updated) {
      throw new NotFoundException(`Integration not found: ${id}`);
    }

    try {
      await this.auditService.record({
        eventType: "data_change",
        actorUserId,
        actorType: "human",
        entityType: "integration",
        entityId: id,
        action: isActive ? "activate" : "deactivate",
        afterState: { isActive },
        retentionCategory: "audit-7y",
      });
    } catch (error) {
      console.error(
        `Integration ${id} active-state toggle committed, but recording its audit event failed:`,
        error,
      );
    }

    return updated;
  }
}
