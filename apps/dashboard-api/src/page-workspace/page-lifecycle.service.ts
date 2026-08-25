import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { PageEntity, PageLifecycleRepository, PageLifecycleStage } from "@webdesk/database";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuditService } from "../audit/audit.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuthorizationService } from "../authz/authorization.service.js";
import {
  PAGE_LIFECYCLE_REPOSITORY,
  PAGE_WORKSPACE_BASE_MODULE_KEY,
} from "./page-workspace.constants.js";
import type { ChangeLifecycleStageDto } from "./page-workspace.dto.js";

type LifecycleAction = "edit" | "submit" | "review" | "approve";

/**
 * The five "interrupt" states from `05_Workflow_State_Machines.md §3`'s alternative-states list
 * that any active stage can drop into, plus `archived`. Declared once and spread into every
 * active stage's entry rather than hand-repeated 16 times.
 */
const INTERRUPT_TARGETS: Readonly<Partial<Record<PageLifecycleStage, LifecycleAction>>> = {
  revision_requested: "review",
  blocked: "edit",
  paused: "edit",
  failed: "edit",
  archived: "approve",
};

/** The stages a page can only leave by resuming to wherever it came from (tracked in
 *  `lifecyclePreviousStage`) or by being archived — see `resolveTarget()`. Task package D5:
 *  this is what keeps every transition allowlisted instead of needing an open-ended
 *  "resume to anything" edge. */
const INTERRUPT_STAGES: readonly PageLifecycleStage[] = [
  "revision_requested",
  "blocked",
  "paused",
  "failed",
  "rolled_back",
];

function active(
  next: PageLifecycleStage,
  action: LifecycleAction,
  extra: Partial<Record<PageLifecycleStage, LifecycleAction>> = {},
): Readonly<Partial<Record<PageLifecycleStage, LifecycleAction>>> {
  return { [next]: action, ...INTERRUPT_TARGETS, ...extra };
}

/**
 * Leaving an interrupt stage: resume, archive, or fall into a DIFFERENT interrupt — a paused page
 * that then becomes blocked is a real situation, and `nextPreviousStage()` deliberately carries
 * the original resume point across such a chain so the page is never stranded.
 *
 * The resume edge itself is not listed here: its only legal target is whatever
 * `lifecyclePreviousStage` records, which is per-row state rather than something a static table
 * can express, so `resolveAction()` validates it dynamically.
 */
const RESUME_OR_ARCHIVE: Readonly<Partial<Record<PageLifecycleStage, LifecycleAction>>> =
  INTERRUPT_TARGETS;

/**
 * The page delivery lifecycle allowlist (`05_Workflow_State_Machines.md §3`, task package D5) —
 * the same unified "one table encodes both the legal transition and the action it requires" shape
 * `VERSION_TRANSITIONS` and `ServicesService`'s own `TRANSITIONS` use.
 *
 * Roadmap row 12: "**No automatic progression through stages.**" Nothing in this module advances
 * a stage as a side effect of anything else — every entry here is reachable only by an explicit,
 * separately permission-checked call to `changeStage()`.
 *
 * Actions are checked against this module's baseline `page_content` group rather than a
 * per-artifact group: the lifecycle is a property of the whole page, not of any one tab. That
 * lands correctly against the seeded matrix — `approve` on `page_content` is held only by
 * `super_admin`/`owner_growth_approver`, which is the right bar for `production_approved`.
 */
const LIFECYCLE_TRANSITIONS: Readonly<
  Record<PageLifecycleStage, Readonly<Partial<Record<PageLifecycleStage, LifecycleAction>>>>
> = {
  proposed: active("approved_for_planning", "approve"),
  approved_for_planning: active("in_strategy", "edit"),
  in_strategy: active("search_approved", "approve"),
  search_approved: active("content_approved", "approve"),
  content_approved: active("design_approved", "approve"),
  design_approved: active("ready_for_development", "approve"),
  ready_for_development: active("in_development", "edit"),
  in_development: active("code_review", "submit"),
  code_review: active("security_qa", "review"),
  security_qa: active("ready_for_staging", "approve"),
  ready_for_staging: active("staging_deployed", "edit"),
  staging_deployed: active("staging_approved", "approve", { rolled_back: "approve" }),
  staging_approved: active("production_approved", "approve"),
  production_approved: active("production_deployed", "edit"),
  production_deployed: active("verified", "review", { rolled_back: "approve" }),
  // `verified` is the end of the happy path: nothing follows it but archival.
  verified: { archived: "approve" },
  revision_requested: RESUME_OR_ARCHIVE,
  blocked: RESUME_OR_ARCHIVE,
  paused: RESUME_OR_ARCHIVE,
  failed: RESUME_OR_ARCHIVE,
  rolled_back: RESUME_OR_ARCHIVE,
  // Terminal, matching this codebase's archived-is-terminal precedent (ADR-0016, no hard delete).
  archived: {},
};

@Injectable()
export class PageLifecycleService {
  constructor(
    @Inject(PAGE_LIFECYCLE_REPOSITORY) private readonly pages: PageLifecycleRepository,
    private readonly authorizationService: AuthorizationService,
    private readonly auditService: AuditService,
  ) {}

  async get(projectId: string, pageId: string): Promise<PageEntity> {
    const page = await this.pages.findById(pageId, projectId);
    if (!page) {
      throw new NotFoundException(`Page not found: ${pageId}`);
    }
    return page;
  }

  /**
   * Resolves the required action for a requested transition, handling the one edge the static
   * table cannot express: resuming out of an interrupt stage back to whatever
   * `lifecyclePreviousStage` records. Returns `null` when the transition is not allowed at all.
   */
  private resolveAction(page: PageEntity, target: PageLifecycleStage): LifecycleAction | null {
    const isResume =
      INTERRUPT_STAGES.includes(page.lifecycleStage) &&
      page.lifecyclePreviousStage !== null &&
      target === page.lifecyclePreviousStage;
    if (isResume) {
      return "edit";
    }
    return LIFECYCLE_TRANSITIONS[page.lifecycleStage][target] ?? null;
  }

  /**
   * `lifecyclePreviousStage` is written in the same statement as the stage itself so the two can
   * never drift: dropping into an interrupt stage records where the page came from, and any other
   * transition clears it. An interrupt reached FROM an interrupt keeps the original resume point
   * rather than overwriting it with another dead end.
   */
  private nextPreviousStage(
    page: PageEntity,
    target: PageLifecycleStage,
  ): PageLifecycleStage | null {
    if (!INTERRUPT_STAGES.includes(target)) {
      return null;
    }
    return INTERRUPT_STAGES.includes(page.lifecycleStage)
      ? page.lifecyclePreviousStage
      : page.lifecycleStage;
  }

  async changeStage(
    userId: string,
    projectId: string,
    pageId: string,
    input: ChangeLifecycleStageDto,
  ): Promise<PageEntity> {
    const page = await this.get(projectId, pageId);

    if (page.lifecycleStage === input.stage) {
      return page;
    }

    const requiredAction = this.resolveAction(page, input.stage);
    if (!requiredAction) {
      throw new BadRequestException(
        `Cannot transition page ${pageId} from ${page.lifecycleStage} to ${input.stage}`,
      );
    }
    await this.authorizationService.assertAllowed(
      userId,
      PAGE_WORKSPACE_BASE_MODULE_KEY,
      requiredAction,
      projectId,
    );

    const result = await this.pages.updateLifecycleStage(
      pageId,
      projectId,
      page.lifecycleStage,
      input.stage,
      this.nextPreviousStage(page, input.stage),
      userId,
    );
    if (result.outcome === "not_found") {
      throw new NotFoundException(`Page not found: ${pageId}`);
    }
    if (result.outcome === "conflict") {
      throw new ConflictException(
        `Page ${pageId} lifecycle stage changed concurrently ` +
          `(expected ${page.lifecycleStage}, now ${result.entity.lifecycleStage}) — reload and retry`,
      );
    }

    // `05_Workflow_State_Machines.md §1`: every transition creates an audit event. The stages that
    // represent a real approval gate inherit the longer approval retention, matching how
    // PagesService.changeWorkflowStage() classifies its own.
    const isApproval = input.stage.endsWith("_approved") || input.stage === "verified";
    try {
      await this.auditService.record({
        eventType: isApproval ? "approval" : "data_change",
        actorUserId: userId,
        actorType: "human",
        projectId,
        entityType: "page",
        entityId: pageId,
        action: `lifecycle:${page.lifecycleStage}->${input.stage}`,
        beforeState: {
          lifecycleStage: page.lifecycleStage,
          lifecyclePreviousStage: page.lifecyclePreviousStage,
        },
        afterState: {
          lifecycleStage: result.entity.lifecycleStage,
          lifecyclePreviousStage: result.entity.lifecyclePreviousStage,
        },
        reason: input.reason ?? null,
        retentionCategory: isApproval ? "approval-audit-7y" : "audit-7y",
      });
    } catch (error) {
      console.error(
        `Page ${pageId} lifecycle transition ${page.lifecycleStage}->${input.stage} committed, ` +
          "but recording its audit event failed:",
        error,
      );
    }

    return result.entity;
  }
}
