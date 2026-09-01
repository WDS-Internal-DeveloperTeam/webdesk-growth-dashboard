import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  withTransaction,
  type CaseStudyApprovalRepository,
  type CaseStudyApprovalType,
  type CaseStudyEntity,
  type CaseStudyListFilter,
  type CaseStudyRepository,
  type CaseStudyStatus,
} from "@webdesk/database";
import {
  isSequelizeUniqueConstraintError,
  sanitizeNullableRichText,
  sanitizeNullableRichTextIfChanged,
} from "@webdesk/validation";
import {
  CASE_STUDY_APPROVAL_REPOSITORY,
  CASE_STUDY_REPOSITORY,
  CASE_STUDY_STUDIO_MODULE_KEY,
} from "./case-study-studio.constants.js";
import type {
  ChangeCaseStudyStatusDto,
  CreateCaseStudyDto,
  UpdateCaseStudyDto,
} from "./case-study-studio.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuditService } from "../audit/audit.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuthorizationService } from "../authz/authorization.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { ServicesService } from "../service-library/services.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { ClaimsService } from "../proof-and-claims-library/claims.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { UsersService } from "../users/users.service.js";

/** A malformed (non-UUID) id can never resolve to a real service/claim — filtered out before
 *  querying rather than sent to Postgres, whose `uuid` column type would otherwise reject it with
 *  a raw driver error the global exception filter turns into an opaque 500 instead of a clean 400
 *  (same guard `ClaimsService.assertServiceIdsExist()`/`PersonasService.assertServiceIdsExist()`
 *  both already use for the identical reason). */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The real, seeded RBAC action (`06_Roles_and_Permissions.md` — `case_studies` group, D6)
 *  required for a given `status` transition. */
type CaseStudyTransitionAction = "submit" | "review" | "approve" | "publish" | "unpublish";

interface CaseStudyTransition {
  readonly action: CaseStudyTransitionAction;
  /** Set only for a transition that departs FROM an approval stage (`internal_approval`/
   *  `client_approval`) — drives whether `changeStatus()` also inserts a `case_study_approvals`
   *  row in the same transaction as the CAS status write (D7). */
  readonly approvalType?: CaseStudyApprovalType;
}

/** Every key is a template-literal type over the real `CaseStudyStatus` union (code-review
 *  finding — a plain `string` key gave a typo'd `from`/`to` value no compile-time signal, only a
 *  runtime "Invalid case study status transition"), so an invalid status token in either the
 *  key list below or the lookup expression is now a compile error. */
type CaseStudyTransitionKey = `${CaseStudyStatus}->${CaseStudyStatus}`;

/**
 * D7's full transition→action map, keyed by `${from}->${to}`. A flat map (not a nested
 * `Record<Status, Record<Status, ...>>`) reads more directly against D7's own bullet-point
 * grouping in the task package, since several transitions share one action across otherwise
 * unrelated `from` states (e.g. every `->archived` transition requires `approve`).
 */
const TRANSITIONS: ReadonlyMap<CaseStudyTransitionKey, CaseStudyTransition> = new Map<
  CaseStudyTransitionKey,
  CaseStudyTransition
>([
  // submit
  ["intake->upload", { action: "submit" }],
  ["upload->completeness_review", { action: "submit" }],
  ["ready_for_claude->draft", { action: "submit" }],
  ["draft->search_review", { action: "submit" }],
  ["missing_information->draft", { action: "submit" }],
  // review
  ["completeness_review->ready_for_claude", { action: "review" }],
  ["search_review->fact_confidentiality_review", { action: "review" }],
  ["fact_confidentiality_review->internal_approval", { action: "review" }],
  ["completeness_review->missing_information", { action: "review" }],
  ["ready_for_claude->missing_information", { action: "review" }],
  ["search_review->missing_information", { action: "review" }],
  ["fact_confidentiality_review->missing_information", { action: "review" }],
  // approve — internal/client approval stage forward/reject transitions
  ["internal_approval->client_approval", { action: "approve", approvalType: "internal" }],
  ["internal_approval->scheduled", { action: "approve", approvalType: "internal" }],
  ["client_approval->scheduled", { action: "approve", approvalType: "client" }],
  ["internal_approval->missing_information", { action: "approve", approvalType: "internal" }],
  ["client_approval->missing_information", { action: "approve", approvalType: "client" }],
  // archive — a permanent, hard-to-reverse action from any non-terminal status, gated at the
  // same tier as approval (D7). Includes archiving from an approval stage, which is likewise
  // recorded as a rejection on that stage's own approvals log.
  ["intake->archived", { action: "approve" }],
  ["upload->archived", { action: "approve" }],
  ["completeness_review->archived", { action: "approve" }],
  ["ready_for_claude->archived", { action: "approve" }],
  ["missing_information->archived", { action: "approve" }],
  ["draft->archived", { action: "approve" }],
  ["search_review->archived", { action: "approve" }],
  ["fact_confidentiality_review->archived", { action: "approve" }],
  ["internal_approval->archived", { action: "approve", approvalType: "internal" }],
  ["client_approval->archived", { action: "approve", approvalType: "client" }],
  ["scheduled->archived", { action: "approve" }],
  ["published->archived", { action: "approve" }],
  ["unpublished->archived", { action: "approve" }],
  // publish / unpublish
  ["scheduled->published", { action: "publish" }],
  ["unpublished->published", { action: "publish" }],
  ["published->unpublished", { action: "unpublish" }],
]);

@Injectable()
export class CaseStudiesService {
  constructor(
    @Inject(CASE_STUDY_REPOSITORY) private readonly caseStudies: CaseStudyRepository,
    @Inject(CASE_STUDY_APPROVAL_REPOSITORY)
    private readonly caseStudyApprovals: CaseStudyApprovalRepository,
    private readonly services: ServicesService,
    private readonly claims: ClaimsService,
    private readonly usersService: UsersService,
    private readonly authorizationService: AuthorizationService,
    private readonly auditService: AuditService,
  ) {}

  /** Mirrors `ClaimsService.assertServiceIdsExist()`'s own already-reviewed shape — a byte-for-byte
   *  copy is accepted, tracked debt across this codebase (Persona/Service/Proof and Claims Library
   *  each already have their own copy); a real fix means a shared `@webdesk/validation` helper,
   *  out of proportion for a new module's own first build. */
  private async assertServiceIdsExist(ids: readonly string[] | null | undefined): Promise<void> {
    if (!ids || ids.length === 0) {
      return;
    }
    const wellFormedIds = ids.filter((id) => UUID_PATTERN.test(id));
    const foundIds =
      wellFormedIds.length > 0
        ? await this.services.existingServiceIds(wellFormedIds)
        : new Set<string>();
    const missing = ids.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      throw new BadRequestException(`relatedServiceIds not found: ${missing.join(", ")}`);
    }
  }

  private async assertClaimIdsExist(ids: readonly string[] | null | undefined): Promise<void> {
    if (!ids || ids.length === 0) {
      return;
    }
    const wellFormedIds = ids.filter((id) => UUID_PATTERN.test(id));
    const foundIds =
      wellFormedIds.length > 0
        ? await this.claims.existingClaimIds(wellFormedIds)
        : new Set<string>();
    const missing = ids.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      throw new BadRequestException(`relatedClaimIds not found: ${missing.join(", ")}`);
    }
  }

  async create(input: CreateCaseStudyDto, actorUserId: string): Promise<CaseStudyEntity> {
    // Independent checks (different tables, none consumes another's result) — run concurrently,
    // matching ServicesService.create()'s own established pattern.
    const [existing] = await Promise.all([
      this.caseStudies.findByPublicId(input.publicId),
      this.assertServiceIdsExist(input.relatedServiceIds),
      this.assertClaimIdsExist(input.relatedClaimIds),
      input.assignedReviewerUserId
        ? this.usersService.assertUserExists(input.assignedReviewerUserId, "assignedReviewerUserId")
        : Promise.resolve(),
    ]);
    if (existing) {
      throw new BadRequestException(`publicId already in use: ${input.publicId}`);
    }

    let created: CaseStudyEntity;
    try {
      created = await this.caseStudies.create({
        ...input,
        challenge: sanitizeNullableRichText(input.challenge),
        solution: sanitizeNullableRichText(input.solution),
        implementation: sanitizeNullableRichText(input.implementation),
        results: sanitizeNullableRichText(input.results),
        createdBy: actorUserId,
      });
    } catch (error) {
      // The publicId uniqueness check above is TOCTOU (two concurrent creates with the same
      // publicId can both pass it before either INSERT commits) — the real unique index catches
      // the race loser, but without this catch it would otherwise surface as a raw 500 instead of
      // the same clean 400 the check above already gives the non-racing caller. Uses the shared
      // `@webdesk/validation` helper (code-review finding — this previously hand-rolled the
      // `error.name === "SequelizeUniqueConstraintError"` check the helper already exists to
      // replace, per ADR-0006 — `dashboard-api` never imports `sequelize` directly).
      if (isSequelizeUniqueConstraintError(error)) {
        throw new BadRequestException(`publicId already in use: ${input.publicId}`);
      }
      throw error;
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      entityType: "case_study",
      entityId: created.id,
      action: "create",
      afterState: { clientName: created.clientName, projectTitle: created.projectTitle },
      retentionCategory: "audit-7y",
    });

    return created;
  }

  async findById(id: string): Promise<CaseStudyEntity> {
    const caseStudy = await this.caseStudies.findById(id);
    if (!caseStudy) {
      throw new NotFoundException(`Case study not found: ${id}`);
    }
    return caseStudy;
  }

  async list(filter: CaseStudyListFilter): Promise<readonly CaseStudyEntity[]> {
    return this.caseStudies.list(filter);
  }

  /** Content update (D5/D8) — `status`/`publishedAt` are deliberately never accepted here; only
   *  `changeStatus()` may change them, same discipline as `ServicesService.update()`. Rejects
   *  editing an `archived` record (D8's own terminal-state guard — `unpublished` is NOT terminal,
   *  only `archived` is). */
  async update(
    id: string,
    patch: UpdateCaseStudyDto,
    actorUserId: string,
  ): Promise<CaseStudyEntity> {
    // Pre-fetch needed both for the terminal-state guard and so
    // sanitizeNullableRichTextIfChanged() can skip re-sanitizing a field the patch resends
    // unchanged, mirroring PersonasService.update()'s/ClaimsService.update()'s own established
    // ordering. Runs alongside the independent relationship-existence checks concurrently.
    const [current] = await Promise.all([
      this.findById(id),
      this.assertServiceIdsExist(patch.relatedServiceIds),
      this.assertClaimIdsExist(patch.relatedClaimIds),
      patch.assignedReviewerUserId
        ? this.usersService.assertUserExists(patch.assignedReviewerUserId, "assignedReviewerUserId")
        : Promise.resolve(),
    ]);

    if (current.status === "archived") {
      throw new BadRequestException(`Case study ${id} is archived and can no longer be edited`);
    }

    const updated = await this.caseStudies.update(id, {
      ...patch,
      challenge: sanitizeNullableRichTextIfChanged(patch.challenge, current.challenge),
      solution: sanitizeNullableRichTextIfChanged(patch.solution, current.solution),
      implementation: sanitizeNullableRichTextIfChanged(
        patch.implementation,
        current.implementation,
      ),
      results: sanitizeNullableRichTextIfChanged(patch.results, current.results),
      updatedBy: actorUserId,
    });
    if (!updated) {
      throw new NotFoundException(`Case study not found: ${id}`);
    }

    // afterState records the raw, pre-sanitization patch, not the sanitized value actually
    // written above — the byte-identical, already-accepted pattern ClaimsService.update()/
    // PersonasService.update() both have.
    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      entityType: "case_study",
      entityId: id,
      action: "update",
      afterState: { ...patch },
      retentionCategory: "audit-7y",
    });

    return updated;
  }

  /**
   * D7/D8: validates the requested transition against the `TRANSITIONS` map, checks the real
   * per-transition RBAC action dynamically, enforces the `clientApprovalRequired` branching, and
   * requires a non-empty `unpublishReason` specifically on `published -> unpublished`. For a
   * transition FROM an approval stage (`internal_approval`/`client_approval`), the atomic CAS
   * status write and a `case_study_approvals` row insert are committed together in one
   * transaction, mirroring `ReviewsService.decide()`'s own `withTransaction()` pairing.
   */
  async changeStatus(
    id: string,
    dto: ChangeCaseStudyStatusDto,
    actorUserId: string,
  ): Promise<CaseStudyEntity> {
    const caseStudy = await this.findById(id);
    const nextStatus = dto.status;

    if (caseStudy.status === nextStatus) {
      return caseStudy; // no-op, not an error — re-requesting the current status is harmless
    }

    const transitionKey: CaseStudyTransitionKey = `${caseStudy.status}->${nextStatus}`;
    const transition = TRANSITIONS.get(transitionKey);
    if (!transition) {
      throw new BadRequestException(
        `Invalid case study status transition: ${caseStudy.status} -> ${nextStatus}`,
      );
    }

    // D7's clientApprovalRequired branching — internal_approval may only go straight to
    // `scheduled` when client approval is NOT required, and may only advance to
    // `client_approval` when it IS required.
    if (caseStudy.status === "internal_approval") {
      if (nextStatus === "client_approval" && !caseStudy.clientApprovalRequired) {
        throw new BadRequestException(
          `Case study ${id} does not require client approval — transition directly to scheduled`,
        );
      }
      if (nextStatus === "scheduled" && caseStudy.clientApprovalRequired) {
        throw new BadRequestException(
          `Case study ${id} requires client approval before it can be scheduled`,
        );
      }
    }

    // D5 — the spec's own named "mandatory governance" field, enforced here on the one transition
    // that needs it, not at the schema level.
    if (nextStatus === "unpublished" && !dto.unpublishReason) {
      throw new BadRequestException("unpublishReason is required to unpublish a case study");
    }

    await this.authorizationService.assertAllowed(
      actorUserId,
      CASE_STUDY_STUDIO_MODULE_KEY,
      transition.action,
    );

    const sanitizedNotes = sanitizeNullableRichText(dto.notes) ?? null;
    const decidedAt = new Date();

    const entity = await withTransaction(async (transaction) => {
      const result = await this.caseStudies.updateStatus(
        id,
        caseStudy.status,
        nextStatus,
        actorUserId,
        {
          // COALESCE-style "stamp once, never overwrite" (code-review finding — this was a plain
          // unconditional assignment, so publishing -> unpublishing -> republishing silently
          // overwrote the original first-publish date on every republish). `caseStudy.publishedAt`
          // is the pre-transaction snapshot fetched above, which is fine: only one concurrent
          // writer can win the CAS `updateStatus()` write below regardless.
          ...(nextStatus === "published"
            ? { publishedAt: caseStudy.publishedAt ? new Date(caseStudy.publishedAt) : decidedAt }
            : {}),
          // `unpublishReason` is set on the one transition that requires it and cleared on every
          // transition back to `published` (code-review finding — it was previously never reset,
          // so a stale reason from a prior unpublish persisted on an otherwise-live, republished
          // record).
          ...(nextStatus === "unpublished" ? { unpublishReason: dto.unpublishReason ?? null } : {}),
          ...(nextStatus === "published" ? { unpublishReason: null } : {}),
        },
        transaction,
      );
      if (result.outcome === "not_found") {
        throw new NotFoundException(`Case study not found: ${id}`);
      }
      if (result.outcome === "conflict") {
        throw new ConflictException(
          `Case study ${id} status changed concurrently ` +
            `(expected ${caseStudy.status}, now ${result.entity.status}) — reload and retry`,
        );
      }

      if (transition.approvalType) {
        // Forward transitions (to client_approval/scheduled) record "approved"; a transition to
        // missing_information records "revision_requested"; a transition to archived records
        // "rejected" (D7).
        const decision =
          nextStatus === "missing_information"
            ? "revision_requested"
            : nextStatus === "archived"
              ? "rejected"
              : "approved";
        await this.caseStudyApprovals.create(
          {
            caseStudyId: id,
            approvalType: transition.approvalType,
            decision,
            decidedByUserId: actorUserId,
            notes: sanitizedNotes,
            decidedAt,
          },
          transaction,
        );
      }

      return result.entity;
    });

    // Best-effort, outside the transaction — the byte-identical, already-accepted pattern
    // ClaimsService.changeApprovalStatus()/PersonasService.changeApprovalStatus() both have.
    const isApproval = transition.action === "approve" && transition.approvalType !== undefined;
    try {
      await this.auditService.record({
        eventType: isApproval ? "approval" : "data_change",
        actorUserId,
        actorType: "human",
        entityType: "case_study",
        entityId: id,
        action: `status:${caseStudy.status}->${nextStatus}`,
        beforeState: { status: caseStudy.status },
        afterState: { status: nextStatus },
        reason: sanitizedNotes,
        retentionCategory: isApproval ? "approval-audit-7y" : "audit-7y",
      });
    } catch (error) {
      console.error(
        `Case study ${id} status transition ${caseStudy.status}->${nextStatus} committed, ` +
          "but recording its audit event failed:",
        error,
      );
    }

    return entity;
  }

  /** Read-only, gated on `view` (same as `findById`) via the controller's own `@RequirePermission`
   *  — returns `case_study_approvals` rows most-recent-first. */
  async listApprovals(id: string): ReturnType<CaseStudyApprovalRepository["listByCaseStudy"]> {
    await this.findById(id);
    return this.caseStudyApprovals.listByCaseStudy(id);
  }
}
