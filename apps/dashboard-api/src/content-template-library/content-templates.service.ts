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
import { sanitizeNullableRichText, sanitizeNullableRichTextIfChanged } from "@webdesk/validation";
import {
  CONTENT_TEMPLATE_LIBRARY_MODULE_KEY,
  CONTENT_TEMPLATE_REPOSITORY,
} from "./content-template-library.constants.js";
import type {
  CreateContentTemplateDto,
  UpdateContentTemplateDto,
} from "./content-template-library.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuditService } from "../audit/audit.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuthorizationService } from "../authz/authorization.service.js";

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
      // Each of the 6 rich-text fields hand-enumerated once, the same shape Persona Library's/
      // Service Library's own create() rich-text wiring already establishes (2026-08-22 standing
      // rule: every dashboard-web long-text field uses RichTextEditor, paired with real backend
      // sanitization) — a 3rd+ near-identical occurrence with no shared "sanitize these N named
      // fields" helper, the same accepted, tracked-debt duplication Persona Library's own
      // create() already records for itself.
      created = await this.templates.create({
        ...input,
        purpose: sanitizeNullableRichText(input.purpose),
        proofRules: sanitizeNullableRichText(input.proofRules),
        seoAeoGeoRequirements: sanitizeNullableRichText(input.seoAeoGeoRequirements),
        schema: sanitizeNullableRichText(input.schema),
        ctaRules: sanitizeNullableRichText(input.ctaRules),
        contentDepthGuidance: sanitizeNullableRichText(input.contentDepthGuidance),
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
    const current = await this.findById(id);

    // archived/superseded are both terminal (TRANSITIONS's own entries for both are `{}` — no
    // code path resurrects a record from either) — content on a terminal row must never change
    // (code-review finding: this guard was missing entirely, unlike Website Strategy Center's/
    // Page Inventory's own identical `update()` guard, which this mirrors).
    if (current.approvalStatus === "archived" || current.approvalStatus === "superseded") {
      throw new BadRequestException(
        `Content template ${id} is ${current.approvalStatus} and can no longer be edited`,
      );
    }

    // current.approvalStatus is passed as a CAS guard (code-review finding: the terminal-state
    // check above reads approvalStatus into application memory, but without this the actual write
    // was still unconditional — a concurrent changeApprovalStatus() transition landing between the
    // read and this write could let this edit silently succeed against what is now an
    // archived/superseded row, the exact race Website Strategy Center's own
    // updateInPlace()/expectedApprovalStatus already closed once for the identical bug class).
    //
    // sanitizeNullableRichTextIfChanged() (2026-08-22 standing rule) reuses `current`'s own values
    // — already fetched above for the terminal-status check — to skip re-sanitizing a rich-text
    // field the patch resends unchanged, the same optimization Persona Library's/Service Library's
    // own update() already applies for their own rich-text fields.
    const updated = await this.templates.update(
      id,
      {
        ...patch,
        purpose: sanitizeNullableRichTextIfChanged(patch.purpose, current.purpose),
        proofRules: sanitizeNullableRichTextIfChanged(patch.proofRules, current.proofRules),
        seoAeoGeoRequirements: sanitizeNullableRichTextIfChanged(
          patch.seoAeoGeoRequirements,
          current.seoAeoGeoRequirements,
        ),
        schema: sanitizeNullableRichTextIfChanged(patch.schema, current.schema),
        ctaRules: sanitizeNullableRichTextIfChanged(patch.ctaRules, current.ctaRules),
        contentDepthGuidance: sanitizeNullableRichTextIfChanged(
          patch.contentDepthGuidance,
          current.contentDepthGuidance,
        ),
        updatedBy: actorUserId,
      },
      current.approvalStatus,
    );
    if (!updated) {
      // 0 affected rows means either the row is genuinely gone (no hard-delete exists for this
      // module today, but this still guards a hypothetical future one, matching every sibling
      // module's own identical belt-and-suspenders check) or — the real case the CAS guard above
      // exists for — its approvalStatus changed concurrently since the read. Distinguish the two
      // with a fresh read rather than assuming either, mirroring
      // WebsiteStrategyRecordsService.update()'s/PagesService.update()'s own disambiguation.
      const stillExists = await this.templates.findById(id);
      if (!stillExists) {
        throw new NotFoundException(`Content template not found: ${id}`);
      }
      throw new ConflictException(
        `Content template ${id} approval status changed concurrently while editing — reload and retry`,
      );
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
    await this.authorizationService.assertAllowed(
      actorUserId,
      CONTENT_TEMPLATE_LIBRARY_MODULE_KEY,
      requiredAction,
    );

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
   *
   * `template.approvalStatus` (`"approved"`, the value the check above just confirmed) is also
   * passed as a CAS guard to `updatePublishState()` — the check above only reads
   * `approvalStatus` into application memory; without also guarding the write on it, a concurrent
   * `changeApprovalStatus()` transition (e.g. `approved -> archived`) landing between the read and
   * this write could still let the publish succeed, since `isPublished` alone was still `false`
   * (code-review finding — the module's own migration doc comment already says this exact
   * combination, published while non-`approved`, must never happen).
   */
  async publish(id: string, actorUserId: string): Promise<ContentTemplateEntity> {
    const template = await this.findById(id);
    if (template.approvalStatus !== "approved") {
      throw new BadRequestException(
        `Content template ${id} cannot be published while its approval status is ` +
          `'${template.approvalStatus}' — only an approved template may be published.`,
      );
    }
    await this.authorizationService.assertAllowed(
      actorUserId,
      CONTENT_TEMPLATE_LIBRARY_MODULE_KEY,
      "publish",
    );

    const NOT_YET_PUBLISHED = false;
    const NOW_PUBLISHED = true;
    const result = await this.templates.updatePublishState(
      id,
      NOT_YET_PUBLISHED,
      NOW_PUBLISHED,
      actorUserId,
      template.approvalStatus,
    );
    if (result.outcome === "not_found") {
      throw new NotFoundException(`Content template not found: ${id}`);
    }
    if (result.outcome === "conflict") {
      throw new ConflictException(
        `Content template ${id} was published concurrently, is already published, or its ` +
          `approval status changed concurrently — reload and retry.`,
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
    await this.authorizationService.assertAllowed(
      actorUserId,
      CONTENT_TEMPLATE_LIBRARY_MODULE_KEY,
      "unpublish",
    );

    const CURRENTLY_PUBLISHED = true;
    const NOW_UNPUBLISHED = false;
    const result = await this.templates.updatePublishState(
      id,
      CURRENTLY_PUBLISHED,
      NOW_UNPUBLISHED,
      actorUserId,
    );
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
