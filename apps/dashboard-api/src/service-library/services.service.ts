import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { withTransaction } from "@webdesk/database";
import type {
  ServiceApprovalStatus,
  ServiceCategoryRepository,
  ServiceEntity,
  ServiceListFilter,
  ServiceRelationshipRepository,
  ServiceRepository,
} from "@webdesk/database";
import {
  SERVICE_CATEGORY_REPOSITORY,
  SERVICE_RELATIONSHIP_REPOSITORY,
  SERVICE_REPOSITORY,
} from "./service-library.constants.js";
import type { CreateServiceDto, UpdateServiceDto } from "./service-library.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuditService } from "../audit/audit.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuthorizationService } from "../authz/authorization.service.js";

const MODULE_KEY = "service_persona_proof";

/**
 * Which real, seeded RBAC action (`06_Roles_and_Permissions.md:42`) a given `approvalStatus`
 * transition requires. Three tiers, not two — `submit` (only `marketing_editor` holds it),
 * `review` (`marketing_editor`/`owner_growth_approver`/`qa_security_reviewer`/`super_admin`), and
 * `approve` (`owner_growth_approver`/`super_admin` only) — matching the matrix's real letter
 * grants exactly rather than collapsing them (task package D5).
 */
function requiredActionForTransition(nextStatus: ServiceApprovalStatus): string {
  if (nextStatus === "submitted") {
    return "submit";
  }
  if (nextStatus === "under_review" || nextStatus === "revision_requested") {
    return "review";
  }
  // approved | rejected | superseded | archived
  return "approve";
}

/**
 * Sourced from `05_Workflow_State_Machines.md §2`'s generic artifact lifecycle (task package D5).
 * `archived` and `superseded` are both terminal — no code path resurrects a record from either,
 * matching `ProjectService`'s own `archived`-is-terminal precedent (no hard delete, ADR-0016).
 */
const ALLOWED_TRANSITIONS: Readonly<
  Record<ServiceApprovalStatus, readonly ServiceApprovalStatus[]>
> = {
  draft: ["submitted", "archived"],
  submitted: ["under_review", "draft", "archived"],
  under_review: ["approved", "revision_requested", "rejected", "archived"],
  revision_requested: ["draft", "submitted", "archived"],
  approved: ["superseded", "archived"],
  rejected: ["draft", "archived"],
  superseded: [],
  archived: [],
};

@Injectable()
export class ServicesService {
  constructor(
    @Inject(SERVICE_REPOSITORY) private readonly services: ServiceRepository,
    @Inject(SERVICE_CATEGORY_REPOSITORY) private readonly categories: ServiceCategoryRepository,
    @Inject(SERVICE_RELATIONSHIP_REPOSITORY)
    private readonly relationships: ServiceRelationshipRepository,
    private readonly authorizationService: AuthorizationService,
    private readonly auditService: AuditService,
  ) {}

  private async assertCategoryExists(categoryId: string): Promise<void> {
    const category = await this.categories.findById(categoryId);
    if (!category) {
      throw new BadRequestException(`Service category not found: ${categoryId}`);
    }
  }

  async create(input: CreateServiceDto, actorUserId: string): Promise<ServiceEntity> {
    await this.assertCategoryExists(input.categoryId);
    if (input.parentServiceId) {
      const parent = await this.services.findById(input.parentServiceId);
      if (!parent) {
        throw new BadRequestException(`Parent service not found: ${input.parentServiceId}`);
      }
    }
    const existing = await this.services.findByPublicId(input.publicId);
    if (existing) {
      throw new BadRequestException(`publicId already in use: ${input.publicId}`);
    }

    const created = await withTransaction(async (transaction) => {
      const service = await this.services.create({
        ...input,
        createdBy: actorUserId,
      });
      if (input.deliverableIds) {
        await this.relationships.replaceDeliverables(service.id, input.deliverableIds, transaction);
      }
      if (input.platformIds) {
        await this.relationships.replacePlatforms(service.id, input.platformIds, transaction);
      }
      if (input.engagementModelIds) {
        await this.relationships.replaceEngagementModels(
          service.id,
          input.engagementModelIds,
          transaction,
        );
      }
      return service;
    });

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      entityType: "service",
      entityId: created.id,
      action: "create",
      afterState: { canonicalName: created.canonicalName, categoryId: created.categoryId },
      retentionCategory: "audit-7y",
    });
    return created;
  }

  /** Internal existence check, used by callers that only need the entity itself (not its
   *  relationship ids) — `findById()` below layers the relationship enrichment on top of this,
   *  so `update()`/`changeApprovalStatus()` don't pay for three unused queries on every call. */
  private async findServiceOrThrow(id: string): Promise<ServiceEntity> {
    const service = await this.services.findById(id);
    if (!service) {
      throw new NotFoundException(`Service not found: ${id}`);
    }
    return service;
  }

  /** The single-get response includes the linked deliverable/platform/engagement-model ids —
   *  `create()`/`update()` accept exactly these three fields to *set* the relationships, so
   *  omitting them from the read side would make them write-only with no way to see what's
   *  actually linked. `list()` deliberately does not enrich every row this way (would be an
   *  N+1 query per list view for data no list screen needs — matches this codebase's own
   *  precedent of sub-resources living on the detail fetch, not the list one). */
  async findById(id: string): Promise<
    ServiceEntity & {
      readonly deliverableIds: readonly string[];
      readonly platformIds: readonly string[];
      readonly engagementModelIds: readonly string[];
    }
  > {
    const service = await this.findServiceOrThrow(id);
    const [deliverableIds, platformIds, engagementModelIds] = await Promise.all([
      this.relationships.listDeliverableIds(id),
      this.relationships.listPlatformIds(id),
      this.relationships.listEngagementModelIds(id),
    ]);
    return { ...service, deliverableIds, platformIds, engagementModelIds };
  }

  async list(filter: ServiceListFilter): Promise<readonly ServiceEntity[]> {
    return this.services.list(filter);
  }

  async update(id: string, patch: UpdateServiceDto, actorUserId: string): Promise<ServiceEntity> {
    await this.findServiceOrThrow(id); // 404s cleanly if missing, before touching anything else
    if (patch.categoryId) {
      await this.assertCategoryExists(patch.categoryId);
    }

    const updated = await withTransaction(async (transaction) => {
      const { deliverableIds, platformIds, engagementModelIds, ...servicePatch } = patch;
      const result = await this.services.update(
        id,
        { ...servicePatch, updatedBy: actorUserId },
        transaction,
      );
      if (deliverableIds) {
        await this.relationships.replaceDeliverables(id, deliverableIds, transaction);
      }
      if (platformIds) {
        await this.relationships.replacePlatforms(id, platformIds, transaction);
      }
      if (engagementModelIds) {
        await this.relationships.replaceEngagementModels(id, engagementModelIds, transaction);
      }
      return result;
    });
    if (!updated) {
      throw new NotFoundException(`Service not found: ${id}`);
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      entityType: "service",
      entityId: id,
      action: "update",
      afterState: { ...patch },
      retentionCategory: "audit-7y",
    });
    return updated;
  }

  async changeApprovalStatus(
    id: string,
    nextStatus: ServiceApprovalStatus,
    actorUserId: string,
  ): Promise<ServiceEntity> {
    const service = await this.findServiceOrThrow(id);
    if (service.approvalStatus === nextStatus) {
      return service; // no-op, not an error — re-requesting the current status is harmless
    }
    if (!ALLOWED_TRANSITIONS[service.approvalStatus].includes(nextStatus)) {
      throw new BadRequestException(
        `Invalid service approval status transition: ${service.approvalStatus} -> ${nextStatus}`,
      );
    }

    const requiredAction = requiredActionForTransition(nextStatus);
    const decision = await this.authorizationService.evaluate(
      actorUserId,
      MODULE_KEY,
      requiredAction,
    );
    if (!decision.allowed) {
      await this.authorizationService.recordAccessDenied(
        actorUserId,
        MODULE_KEY,
        requiredAction,
        decision.reasonCode!,
      );
      throw new ForbiddenException(`Missing permission: ${MODULE_KEY}:${requiredAction}`);
    }

    const result = await this.services.updateStatus(
      id,
      service.approvalStatus,
      nextStatus,
      actorUserId,
    );
    if (result.outcome === "not_found") {
      throw new NotFoundException(`Service not found: ${id}`);
    }
    if (result.outcome === "conflict") {
      throw new ConflictException(
        `Service ${id} approval status changed concurrently ` +
          `(expected ${service.approvalStatus}, now ${result.entity.approvalStatus}) — reload and retry`,
      );
    }

    const isApproval = nextStatus === "approved";
    try {
      await this.auditService.record({
        eventType: isApproval ? "approval" : "data_change",
        actorUserId,
        actorType: "human",
        entityType: "service",
        entityId: id,
        action: `status:${service.approvalStatus}->${nextStatus}`,
        beforeState: { approvalStatus: service.approvalStatus },
        afterState: { approvalStatus: nextStatus },
        retentionCategory: isApproval ? "approval-audit-7y" : "audit-7y",
      });
    } catch (error) {
      console.error(
        `Service ${id} approval status transition ${service.approvalStatus}->${nextStatus} ` +
          "committed, but recording its audit event failed:",
        error,
      );
    }

    return result.entity;
  }
}
