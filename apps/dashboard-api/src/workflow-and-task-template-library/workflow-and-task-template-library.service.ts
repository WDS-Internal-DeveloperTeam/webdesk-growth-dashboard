import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  WorkflowTaskTemplateApprovalStatus,
  WorkflowTaskTemplateEntity,
  WorkflowTaskTemplateListFilter,
  WorkflowTaskTemplateRepository,
} from "@webdesk/database";
import { isSequelizeUniqueConstraintError } from "@webdesk/validation";
import {
  WORKFLOW_TASK_TEMPLATE_LIBRARY_MODULE_KEY,
  WORKFLOW_TASK_TEMPLATE_REPOSITORY,
} from "./workflow-and-task-template-library.constants.js";
import type {
  CreateWorkflowTaskTemplateDto,
  UpdateWorkflowTaskTemplateDto,
} from "./workflow-and-task-template-library.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuditService } from "../audit/audit.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuthorizationService } from "../authz/authorization.service.js";

/** The real, seeded RBAC action (`06_Roles_and_Permissions.md`) required for a given
 *  `approvalStatus` transition — identical vocabulary to Brand Library's/Content Template
 *  Library's/Persona Library's/Service Library's own. */
type WorkflowTaskTemplateApprovalAction = "submit" | "review" | "approve";

/**
 * Reused verbatim (byte-for-byte) from `BrandLibraryService`'s own (already code-reviewed)
 * `TRANSITIONS` table — a single source of truth for both "is this transition legal" (a key's
 * presence) and "what RBAC action does it require" (the value). `submitted`/
 * `revision_requested`/`rejected -> draft` all require `submit` (the submitter/editor drives the
 * revise-and-resubmit loop, not the approver). `archived`/`superseded` are both terminal — no code
 * path resurrects a record from either. The real seeded `ready_for_claude` matrix
 * (`00013-seed-rbac-matrix.ts:199-207`) gives a genuine separation of duties — only
 * `super_admin`/`owner_growth_approver` hold `review`/`approve`, while
 * `marketing_editor`/`designer_creative_reviewer`/`developer`/`qa_security_reviewer` all hold
 * `submit` (and `create`/`edit`) but not `review`/`approve`. This is NOT the same split as
 * `creative_design` (Brand Library's own group): there, `designer_creative_reviewer` holds
 * `submit`+`review`+`approve` together (self-approval is possible), whereas here no single role
 * can both submit and review/approve a template — see this module's own e2e spec for the
 * regression test locking this distinction in.
 */
const TRANSITIONS: Readonly<
  Record<
    WorkflowTaskTemplateApprovalStatus,
    Readonly<
      Partial<Record<WorkflowTaskTemplateApprovalStatus, WorkflowTaskTemplateApprovalAction>>
    >
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
export class WorkflowAndTaskTemplateLibraryService {
  constructor(
    @Inject(WORKFLOW_TASK_TEMPLATE_REPOSITORY)
    private readonly templates: WorkflowTaskTemplateRepository,
    private readonly authorizationService: AuthorizationService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    input: CreateWorkflowTaskTemplateDto,
    actorUserId: string,
  ): Promise<WorkflowTaskTemplateEntity> {
    const existing = await this.templates.findByPublicId(input.publicId);
    if (existing) {
      throw new BadRequestException(`publicId already in use: ${input.publicId}`);
    }

    let created: WorkflowTaskTemplateEntity;
    try {
      created = await this.templates.create({
        ...input,
        createdBy: actorUserId,
      });
    } catch (error) {
      // The publicId uniqueness check above is TOCTOU (two concurrent creates with the same
      // publicId can both pass it before either INSERT commits) — the real unique index catches
      // the race loser, but without this catch it would otherwise surface as a raw 500 instead of
      // the same clean 400 the check above already gives the non-racing caller. Uses the shared
      // `isSequelizeUniqueConstraintError()` helper (`@webdesk/validation`), not a hand-rolled
      // `error.name === "SequelizeUniqueConstraintError"` check.
      if (isSequelizeUniqueConstraintError(error)) {
        throw new BadRequestException(`publicId already in use: ${input.publicId}`);
      }
      throw error;
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      entityType: "workflow_task_template",
      entityId: created.id,
      action: "create",
      afterState: { templateType: created.templateType, title: created.title },
      retentionCategory: "audit-7y",
    });

    return created;
  }

  async findById(id: string): Promise<WorkflowTaskTemplateEntity> {
    const record = await this.templates.findById(id);
    if (!record) {
      throw new NotFoundException(`Workflow task template not found: ${id}`);
    }
    return record;
  }

  async list(
    filter: WorkflowTaskTemplateListFilter,
  ): Promise<readonly WorkflowTaskTemplateEntity[]> {
    return this.templates.list(filter);
  }

  async update(
    id: string,
    patch: UpdateWorkflowTaskTemplateDto,
    actorUserId: string,
  ): Promise<WorkflowTaskTemplateEntity> {
    const current = await this.findById(id);

    // archived/superseded are both terminal (TRANSITIONS's own entries for both are `{}` — no
    // code path resurrects a record from either) — content on a terminal row must never change,
    // mirroring BrandLibraryService.update()'s own identical guard.
    if (current.approvalStatus === "archived" || current.approvalStatus === "superseded") {
      throw new BadRequestException(
        `Workflow task template ${id} is ${current.approvalStatus} and can no longer be edited`,
      );
    }

    // current.approvalStatus is passed as a CAS guard — the terminal-state check above reads
    // approvalStatus into application memory, but without this the actual write was still
    // unconditional — a concurrent changeApprovalStatus() transition landing between the read and
    // this write could let this edit silently succeed against what is now an archived/superseded
    // row, mirroring BrandLibraryService.update()'s own identical fix.
    const updated = await this.templates.update(
      id,
      {
        ...patch,
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
      // BrandLibraryService.update()'s own disambiguation.
      const stillExists = await this.templates.findById(id);
      if (!stillExists) {
        throw new NotFoundException(`Workflow task template not found: ${id}`);
      }
      throw new ConflictException(
        `Workflow task template ${id} approval status changed concurrently while editing — reload and retry`,
      );
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      entityType: "workflow_task_template",
      entityId: id,
      action: "update",
      afterState: { ...patch },
      retentionCategory: "audit-7y",
    });

    return updated;
  }

  async changeApprovalStatus(
    id: string,
    nextStatus: WorkflowTaskTemplateApprovalStatus,
    actorUserId: string,
  ): Promise<WorkflowTaskTemplateEntity> {
    const record = await this.findById(id);
    if (record.approvalStatus === nextStatus) {
      return record; // no-op, not an error — re-requesting the current status is harmless
    }

    const requiredAction = TRANSITIONS[record.approvalStatus][nextStatus];
    if (!requiredAction) {
      throw new BadRequestException(
        `Invalid workflow task template approval status transition: ${record.approvalStatus} -> ${nextStatus}`,
      );
    }
    await this.authorizationService.assertAllowed(
      actorUserId,
      WORKFLOW_TASK_TEMPLATE_LIBRARY_MODULE_KEY,
      requiredAction,
    );

    const result = await this.templates.updateApprovalStatus(
      id,
      record.approvalStatus,
      nextStatus,
      actorUserId,
    );
    if (result.outcome === "not_found") {
      throw new NotFoundException(`Workflow task template not found: ${id}`);
    }
    if (result.outcome === "conflict") {
      throw new ConflictException(
        `Workflow task template ${id} approval status changed concurrently ` +
          `(expected ${record.approvalStatus}, now ${result.entity.approvalStatus}) — reload and retry`,
      );
    }

    const isApproval = nextStatus === "approved";
    try {
      await this.auditService.record({
        eventType: isApproval ? "approval" : "data_change",
        actorUserId,
        actorType: "human",
        entityType: "workflow_task_template",
        entityId: id,
        action: `status:${record.approvalStatus}->${nextStatus}`,
        beforeState: { approvalStatus: record.approvalStatus },
        afterState: { approvalStatus: nextStatus },
        retentionCategory: isApproval ? "approval-audit-7y" : "audit-7y",
      });
    } catch (error) {
      console.error(
        `Workflow task template ${id} approval status transition ${record.approvalStatus}->${nextStatus} ` +
          "committed, but recording its audit event failed:",
        error,
      );
    }

    return result.entity;
  }
}
