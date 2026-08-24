import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  ContentTemplateApprovalStatus,
  ContentTemplateEntity,
  ContentTemplateListFilter,
  ContentTemplateRepository,
} from "@webdesk/database";
import { CONTENT_TEMPLATE_REPOSITORY } from "./content-template-library.constants.js";
import type {
  CreateContentTemplateDto,
  UpdateContentTemplateDto,
} from "./content-template-library.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuditService } from "../audit/audit.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuthorizationService } from "../authz/authorization.service.js";

// The real, seeded RBAC permission group for this module (task package §0) —
// `00013-seed-rbac-matrix.ts:127-135`. This module is the first real consumer of both this group
// and the real, previously-unused `publish`/`unpublish` RBAC actions.
const MODULE_KEY = "page_content";

/** The real, seeded RBAC action (`06_Roles_and_Permissions.md`) required for a given
 *  `approvalStatus` transition — identical vocabulary to Persona Library's/Service Library's own. */
type ContentTemplateApprovalAction = "submit" | "review" | "approve";

/**
 * Reused verbatim (byte-for-byte, D4) from `PersonasService`'s own (already code-reviewed)
 * `TRANSITIONS` table — a single source of truth for both "is this transition legal" (a key's
 * presence) and "what RBAC action does it require" (the value). `submitted`/
 * `revision_requested`/`rejected -> draft` all require `submit` (the submitter/editor drives the
 * revise-and-resubmit loop, not the approver). `archived`/`superseded` are both terminal — no
 * code path resurrects a record from either.
 */
const TRANSITIONS: Readonly<
  Record<
    ContentTemplateApprovalStatus,
    Readonly<Partial<Record<ContentTemplateApprovalStatus, ContentTemplateApprovalAction>>>
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
export class ContentTemplatesService {
  constructor(
    @Inject(CONTENT_TEMPLATE_REPOSITORY) private readonly templates: ContentTemplateRepository,
    private readonly authorizationService: AuthorizationService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    input: CreateContentTemplateDto,
    actorUserId: string,
  ): Promise<ContentTemplateEntity> {
    const existing = await this.templates.findByPublicId(input.publicId);
    if (existing) {
      throw new BadRequestException(`publicId already in use: ${input.publicId}`);
    }

    let created: ContentTemplateEntity;
    try {
      created = await this.templates.create({
        ...input,
        createdBy: actorUserId,
      });
    } catch (error) {
      // The publicId uniqueness check above is TOCTOU (two concurrent creates with the same
      // publicId can both pass it before either INSERT commits) — the real unique index catches
      // the race loser, but without this catch it would otherwise surface as a raw 500 instead of
      // the same clean 400 the check above already gives the non-racing caller. Checked by
      // `.name`, not `instanceof`, since `dashboard-api` never imports `sequelize` directly
      // (ADR-0006/`only-database-package-touches-sequelize`) — `SequelizeUniqueConstraintError` is
      // the fixed, documented name Sequelize's own `UniqueConstraintError` class always carries.
      if (error instanceof Error && error.name === "SequelizeUniqueConstraintError") {
        throw new BadRequestException(`publicId already in use: ${input.publicId}`);
      }
      throw error;
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      entityType: "content_template",
      entityId: created.id,
      action: "create",
      afterState: { pageType: created.pageType },
      retentionCategory: "audit-7y",
    });

    return created;
  }

  async findById(id: string): Promise<ContentTemplateEntity> {
    const template = await this.templates.findById(id);
    if (!template) {
      throw new NotFoundException(`Content template not found: ${id}`);
    }
    return template;
  }

  async list(filter: ContentTemplateListFilter): Promise<readonly ContentTemplateEntity[]> {
    return this.templates.list(filter);
  }

  async update(
    id: string,
    patch: UpdateContentTemplateDto,
    actorUserId: string,
  ): Promise<ContentTemplateEntity> {
    const updated = await this.templates.update(id, { ...patch, updatedBy: actorUserId });
    if (!updated) {
      throw new NotFoundException(`Content template not found: ${id}`);
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      entityType: "content_template",
      entityId: id,
      action: "update",
      afterState: { ...patch },
      retentionCategory: "audit-7y",
    });

    return updated;
  }

  async changeApprovalStatus(
    id: string,
    nextStatus: ContentTemplateApprovalStatus,
    actorUserId: string,
  ): Promise<ContentTemplateEntity> {
    const template = await this.findById(id);
    if (template.approvalStatus === nextStatus) {
      return template; // no-op, not an error — re-requesting the current status is harmless
    }

    const requiredAction = TRANSITIONS[template.approvalStatus][nextStatus];
    if (!requiredAction) {
      throw new BadRequestException(
        `Invalid content template approval status transition: ${template.approvalStatus} -> ${nextStatus}`,
      );
    }
    await this.authorizationService.assertAllowed(actorUserId, MODULE_KEY, requiredAction);

    const result = await this.templates.updateApprovalStatus(
      id,
      template.approvalStatus,
      nextStatus,
      actorUserId,
    );
    if (result.outcome === "not_found") {
      throw new NotFoundException(`Content template not found: ${id}`);
    }
    if (result.outcome === "conflict") {
      throw new ConflictException(
        `Content template ${id} approval status changed concurrently ` +
          `(expected ${template.approvalStatus}, now ${result.entity.approvalStatus}) — reload and retry`,
      );
    }

    const isApproval = nextStatus === "approved";
    try {
      await this.auditService.record({
        eventType: isApproval ? "approval" : "data_change",
        actorUserId,
        actorType: "human",
        entityType: "content_template",
        entityId: id,
        action: `status:${template.approvalStatus}->${nextStatus}`,
        beforeState: { approvalStatus: template.approvalStatus },
        afterState: { approvalStatus: nextStatus },
        retentionCategory: isApproval ? "approval-audit-7y" : "audit-7y",
      });
    } catch (error) {
      console.error(
        `Content template ${id} approval status transition ${template.approvalStatus}->${nextStatus} ` +
          "committed, but recording its audit event failed:",
        error,
      );
    }

    return result.entity;
  }

  /**
   * Publish an `approved` content template (D1/D2). Rejects with a clean 400 BEFORE attempting
   * the CAS write if the template isn't currently `approved` — the only status/publish
   * interaction this module enforces (D2). A concurrent double-publish (or a repeat call once
   * already published) surfaces as a clean 409 via the atomic compare-and-swap, never a silent
   * no-op success — deliberately asymmetric with `changeApprovalStatus()`'s own
   * same-status-is-a-no-op short circuit, per D2's explicit "returning a clean 409... rather than
   * silently succeeding twice."
   */
  async publish(id: string, actorUserId: string): Promise<ContentTemplateEntity> {
    const template = await this.findById(id);
    if (template.approvalStatus !== "approved") {
      throw new BadRequestException(
        `Content template ${id} cannot be published while its approval status is ` +
          `'${template.approvalStatus}' — only an approved template may be published.`,
      );
    }
    await this.authorizationService.assertAllowed(actorUserId, MODULE_KEY, "publish");

    const result = await this.templates.updatePublishState(id, false, true, actorUserId);
    if (result.outcome === "not_found") {
      throw new NotFoundException(`Content template not found: ${id}`);
    }
    if (result.outcome === "conflict") {
      throw new ConflictException(
        `Content template ${id} was published concurrently, or is already published — reload and retry.`,
      );
    }

    try {
      await this.auditService.record({
        eventType: "publish",
        actorUserId,
        actorType: "human",
        entityType: "content_template",
        entityId: id,
        action: "publish",
        afterState: { isPublished: true },
        retentionCategory: "audit-7y",
      });
    } catch (error) {
      console.error(
        `Content template ${id} publish committed, but recording its audit event failed:`,
        error,
      );
    }

    return result.entity;
  }

  /**
   * Unpublish a content template — always allowed regardless of current `approvalStatus` (D2): an
   * operator must always be able to pull a published template down, even one that has since moved
   * to `superseded`/`archived` (D3, no automatic unpublish on a later status transition). A
   * concurrent double-unpublish (or a repeat call once already unpublished) surfaces as a clean
   * 409 via the atomic compare-and-swap, the same asymmetric-with-`changeApprovalStatus()`
   * reasoning as `publish()`. `publishedAt` is never touched here — it records only the first
   * publish time, preserved as permanent history (D2).
   */
  async unpublish(id: string, actorUserId: string): Promise<ContentTemplateEntity> {
    await this.authorizationService.assertAllowed(actorUserId, MODULE_KEY, "unpublish");

    const result = await this.templates.updatePublishState(id, true, false, actorUserId);
    if (result.outcome === "not_found") {
      throw new NotFoundException(`Content template not found: ${id}`);
    }
    if (result.outcome === "conflict") {
      throw new ConflictException(
        `Content template ${id} was unpublished concurrently, or is already unpublished — reload and retry.`,
      );
    }

    try {
      await this.auditService.record({
        eventType: "unpublish",
        actorUserId,
        actorType: "human",
        entityType: "content_template",
        entityId: id,
        action: "unpublish",
        afterState: { isPublished: false },
        retentionCategory: "audit-7y",
      });
    } catch (error) {
      console.error(
        `Content template ${id} unpublish committed, but recording its audit event failed:`,
        error,
      );
    }

    return result.entity;
  }
}
