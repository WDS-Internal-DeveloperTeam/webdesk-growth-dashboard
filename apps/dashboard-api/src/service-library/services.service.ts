import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { withTransaction } from "@webdesk/database";
import type {
  DeliverableRepository,
  EngagementModelRepository,
  PlatformTechnologyRepository,
  ServiceApprovalStatus,
  ServiceCategoryRepository,
  ServiceEntity,
  ServiceListFilter,
  ServiceRelationshipRepository,
  ServiceRepository,
} from "@webdesk/database";
import {
  DELIVERABLE_REPOSITORY,
  ENGAGEMENT_MODEL_REPOSITORY,
  PLATFORM_TECHNOLOGY_REPOSITORY,
  SERVICE_CATEGORY_REPOSITORY,
  SERVICE_RELATIONSHIP_REPOSITORY,
  SERVICE_REPOSITORY,
} from "./service-library.constants.js";
import type { CreateServiceDto, UpdateServiceDto } from "./service-library.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuditService } from "../audit/audit.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuthorizationService } from "../authz/authorization.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { UsersService } from "../users/users.service.js";

const MODULE_KEY = "service_persona_proof";

/** The real, seeded RBAC action (`06_Roles_and_Permissions.md:42`) required for a given
 *  `approvalStatus` transition. */
type ServiceApprovalAction = "submit" | "review" | "approve";

/** The service, enriched with the linked deliverable/platform/engagement-model ids —
 *  `create()`/`update()` accept exactly these three fields to *set* the relationships, so
 *  returning only the bare `ServiceEntity` would make them write-only with no way for a client to
 *  see what's actually linked without an extra `GET` (code-review finding, fixed here: `create()`/
 *  `update()` now return this enriched shape too, matching `findById()`). */
export type ServiceWithRelationshipIds = ServiceEntity & {
  readonly deliverableIds: readonly string[];
  readonly platformIds: readonly string[];
  readonly engagementModelIds: readonly string[];
};

/**
 * Sourced from `05_Workflow_State_Machines.md §2`'s generic artifact lifecycle (task package D5).
 * A single source of truth for both "is this transition legal" (a key's presence) and "what RBAC
 * action does it require" (the value) — previously two independently-maintained structures
 * (`ALLOWED_TRANSITIONS` + a `requiredActionForTransition()` if-chain) with nothing enforcing they
 * stayed in sync, which let every `-> draft` transition silently fall through to a default
 * `"approve"` requirement even though the canonical spec names the submitter/editor, not the
 * approver, as who drives the revise-and-resubmit loop back through `draft` — a
 * `marketing_editor` (submit+review, no approve) who authored a service and got it into
 * `revision_requested`/`rejected` could never move it back to `draft` to fix and resubmit
 * (code-review finding, fixed here — `submitted`/`revision_requested`/`rejected -> draft` now all
 * require `submit`, matching the tier that owns authoring). `archived`/`superseded` are both
 * terminal — no code path resurrects a record from either, matching `ProjectService`'s own
 * `archived`-is-terminal precedent (no hard delete, ADR-0016).
 */
const TRANSITIONS: Readonly<
  Record<
    ServiceApprovalStatus,
    Readonly<Partial<Record<ServiceApprovalStatus, ServiceApprovalAction>>>
  >
> = {
  draft: { submitted: "submit", archived: "approve" },
  submitted: { under_review: "review", draft: "submit", archived: "approve" },
  under_review: {
    approved: "approve",
    revision_requested: "review",
    rejected: "approve",
    archived: "approve",
  },
  revision_requested: { draft: "submit", submitted: "submit", archived: "approve" },
  approved: { superseded: "approve", archived: "approve" },
  rejected: { draft: "submit", archived: "approve" },
  superseded: {},
  archived: {},
};

@Injectable()
export class ServicesService {
  constructor(
    @Inject(SERVICE_REPOSITORY) private readonly services: ServiceRepository,
    @Inject(SERVICE_CATEGORY_REPOSITORY) private readonly categories: ServiceCategoryRepository,
    @Inject(DELIVERABLE_REPOSITORY) private readonly deliverables: DeliverableRepository,
    @Inject(PLATFORM_TECHNOLOGY_REPOSITORY)
    private readonly platforms: PlatformTechnologyRepository,
    @Inject(ENGAGEMENT_MODEL_REPOSITORY)
    private readonly engagementModels: EngagementModelRepository,
    @Inject(SERVICE_RELATIONSHIP_REPOSITORY)
    private readonly relationships: ServiceRelationshipRepository,
    private readonly usersService: UsersService,
    private readonly authorizationService: AuthorizationService,
    private readonly auditService: AuditService,
  ) {}

  private async assertCategoryExists(categoryId: string): Promise<void> {
    const category = await this.categories.findById(categoryId);
    if (!category) {
      throw new BadRequestException(`Service category not found: ${categoryId}`);
    }
  }

  private async assertParentServiceExists(parentServiceId: string): Promise<void> {
    const parent = await this.services.findById(parentServiceId);
    if (!parent) {
      throw new BadRequestException(`Parent service not found: ${parentServiceId}`);
    }
  }

  /**
   * `ownerUserId` is FK-constrained at the database layer (migration `00050`), so a garbage id was
   * never able to corrupt data — but the FK violation itself surfaces as an opaque, unhandled 500
   * rather than a clean 400. Checked explicitly here, mirroring `ProjectService.assertOwnerExists()`
   * (code-review finding: this field had no existence check at all before this fix, unlike
   * `categoryId`).
   */
  private async assertOwnerExists(ownerUserId: string): Promise<void> {
    try {
      await this.usersService.findById(ownerUserId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new BadRequestException(
          `ownerUserId does not resolve to an active user: ${ownerUserId}`,
        );
      }
      throw error;
    }
  }

  /**
   * `deliverableIds`/`platformIds`/`engagementModelIds` are all FK-constrained at the join-table
   * layer, but were never existence-checked before this fix — a bad id passed Zod's UUID-format
   * check, then failed as an opaque 500 mid-transaction (code-review finding). Reuses each
   * dimension repository's own `findByIds()` — previously unused (dead code) — rather than adding
   * a fourth, hand-rolled existence-check shape.
   */
  private async assertIdsExist(
    ids: readonly string[] | undefined,
    finder: (ids: readonly string[]) => Promise<readonly { readonly id: string }[]>,
    label: string,
  ): Promise<void> {
    if (!ids || ids.length === 0) {
      return;
    }
    const found = await finder(ids);
    const foundIds = new Set(found.map((row) => row.id));
    const missing = ids.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      throw new BadRequestException(`${label} not found: ${missing.join(", ")}`);
    }
  }

  async create(input: CreateServiceDto, actorUserId: string): Promise<ServiceWithRelationshipIds> {
    // Independent checks (different tables, none consumes another's result) — run concurrently
    // rather than as up to 6 sequential round trips (code-review finding).
    const [existing] = await Promise.all([
      this.services.findByPublicId(input.publicId),
      this.assertCategoryExists(input.categoryId),
      input.parentServiceId
        ? this.assertParentServiceExists(input.parentServiceId)
        : Promise.resolve(),
      input.ownerUserId ? this.assertOwnerExists(input.ownerUserId) : Promise.resolve(),
      this.assertIdsExist(
        input.deliverableIds,
        (ids) => this.deliverables.findByIds(ids),
        "Deliverable id(s)",
      ),
      this.assertIdsExist(
        input.platformIds,
        (ids) => this.platforms.findByIds(ids),
        "Platform id(s)",
      ),
      this.assertIdsExist(
        input.engagementModelIds,
        (ids) => this.engagementModels.findByIds(ids),
        "Engagement model id(s)",
      ),
    ]);
    if (existing) {
      throw new BadRequestException(`publicId already in use: ${input.publicId}`);
    }

    const created = await withTransaction(async (transaction) => {
      const service = await this.services.create({
        ...input,
        createdBy: actorUserId,
      });
      // skipDestroy: `service.id` was just inserted in this same transaction, so the join tables
      // are guaranteed empty — the destroy-before-insert `replace*()` semantics built for update()
      // would only ever issue a guaranteed no-op DELETE here (code-review finding).
      if (input.deliverableIds) {
        await this.relationships.replaceDeliverables(
          service.id,
          input.deliverableIds,
          transaction,
          {
            skipDestroy: true,
          },
        );
      }
      if (input.platformIds) {
        await this.relationships.replacePlatforms(service.id, input.platformIds, transaction, {
          skipDestroy: true,
        });
      }
      if (input.engagementModelIds) {
        await this.relationships.replaceEngagementModels(
          service.id,
          input.engagementModelIds,
          transaction,
          { skipDestroy: true },
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

    // A freshly created row's relationships are exactly what was just written (or none) — no need
    // to re-query them, unlike update()'s findById() re-fetch below (code-review finding).
    return {
      ...created,
      deliverableIds: input.deliverableIds ?? [],
      platformIds: input.platformIds ?? [],
      engagementModelIds: input.engagementModelIds ?? [],
    };
  }

  /** Internal existence check, used by callers that only need the entity itself (not its
   *  relationship ids) — `findById()` below layers the relationship enrichment on top of this,
   *  so `changeApprovalStatus()` doesn't pay for three unused queries on every call. */
  private async findServiceOrThrow(id: string): Promise<ServiceEntity> {
    const service = await this.services.findById(id);
    if (!service) {
      throw new NotFoundException(`Service not found: ${id}`);
    }
    return service;
  }

  /** The single-get response includes the linked deliverable/platform/engagement-model ids —
   *  `list()` deliberately does not enrich every row this way (would be an N+1 query per list
   *  view for data no list screen needs — matches this codebase's own precedent of sub-resources
   *  living on the detail fetch, not the list one). */
  async findById(id: string): Promise<ServiceWithRelationshipIds> {
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

  async update(
    id: string,
    patch: UpdateServiceDto,
    actorUserId: string,
  ): Promise<ServiceWithRelationshipIds> {
    const current = await this.findServiceOrThrow(id); // 404s cleanly if missing, before anything else

    // Only re-validate an FK-constrained field when the patch is actually CHANGING it — a save
    // that resends the record's own unchanged categoryId/parentServiceId/ownerUserId (the common
    // case for any form that resends full entity state) shouldn't pay for (or fail on) a
    // redundant existence check, mirroring `ProjectService.update()`'s own fix for the identical
    // `ownerUserId` pattern (code-review finding).
    await Promise.all([
      patch.categoryId && patch.categoryId !== current.categoryId
        ? this.assertCategoryExists(patch.categoryId)
        : Promise.resolve(),
      patch.parentServiceId && patch.parentServiceId !== current.parentServiceId
        ? this.assertParentServiceExists(patch.parentServiceId)
        : Promise.resolve(),
      patch.ownerUserId && patch.ownerUserId !== current.ownerUserId
        ? this.assertOwnerExists(patch.ownerUserId)
        : Promise.resolve(),
      this.assertIdsExist(
        patch.deliverableIds,
        (ids) => this.deliverables.findByIds(ids),
        "Deliverable id(s)",
      ),
      this.assertIdsExist(
        patch.platformIds,
        (ids) => this.platforms.findByIds(ids),
        "Platform id(s)",
      ),
      this.assertIdsExist(
        patch.engagementModelIds,
        (ids) => this.engagementModels.findByIds(ids),
        "Engagement model id(s)",
      ),
    ]);

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

    // Unlike create(), an omitted relationship field here means "unchanged", not "empty" — the
    // current linked set isn't knowable without a query, so a re-fetch (via the already-enriched
    // findById()) is the correct cost here, not needless waste.
    return this.findById(id);
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

    const requiredAction = TRANSITIONS[service.approvalStatus][nextStatus];
    if (!requiredAction) {
      throw new BadRequestException(
        `Invalid service approval status transition: ${service.approvalStatus} -> ${nextStatus}`,
      );
    }
    await this.authorizationService.assertAllowed(actorUserId, MODULE_KEY, requiredAction);

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
