import { literal, Op } from "sequelize";
import { escapeLikePattern } from "../auth/user.repository.js";
import { getWorkflowTaskTemplateModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type {
  WorkflowTaskTemplateApprovalStatus,
  WorkflowTaskTemplateEntity,
  WorkflowTaskTemplateType,
} from "./entities.js";

/** Every field a caller may set/change on create, i.e. `WorkflowTaskTemplateEntity` minus its
 *  server-only-managed columns (`id`, `approvalStatus`, `version`, `createdAt`, `updatedAt`) —
 *  derived, not hand-retyped, mirroring `BrandLibraryRecordContentFields`'s own precedent, so a
 *  future field added to `WorkflowTaskTemplateEntity` is a compile error here until it's also
 *  handled by `create()`/`update()`, not a silent gap. */
type WorkflowTaskTemplateContentFields = Omit<
  WorkflowTaskTemplateEntity,
  "id" | "approvalStatus" | "version" | "createdAt" | "updatedAt"
>;

/** `update()`'s patch shape: every content field is optional (a partial edit), `publicId` and
 *  `templateType` are excluded (both immutable after create — `templateType` since the module's
 *  discriminator column governs which fields make sense on a record and changing it after
 *  creation would be a different record, never accepted through the update route, mirroring
 *  Brand Library's/Website Strategy Center's own identical `recordType`-immutable precedent). */
type WorkflowTaskTemplateUpdateFields = Omit<
  WorkflowTaskTemplateContentFields,
  "publicId" | "templateType"
>;

export interface WorkflowTaskTemplateListFilter {
  readonly templateType?: WorkflowTaskTemplateType;
  readonly approvalStatus?: WorkflowTaskTemplateApprovalStatus;
  readonly search?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export type UpdateWorkflowTaskTemplateStatusResult =
  | { readonly outcome: "updated"; readonly entity: WorkflowTaskTemplateEntity }
  | { readonly outcome: "not_found" }
  | { readonly outcome: "conflict"; readonly entity: WorkflowTaskTemplateEntity };

// Mirrors BrandLibraryRecordRepository's/ContentTemplateRepository's own
// DEFAULT_LIST_LIMIT/MAX_LIST_LIMIT clamping pattern.
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

/** No `projectId` scoping anywhere here — this module's records are organization-wide, matching
 *  Brand Library's/Content Template Library's/Persona Library's/Service Library's own
 *  precedent. */
export class WorkflowTaskTemplateRepository {
  private readonly model = getWorkflowTaskTemplateModels().WorkflowTaskTemplate;

  async create(
    input: Partial<WorkflowTaskTemplateContentFields> &
      Pick<
        WorkflowTaskTemplateContentFields,
        "publicId" | "templateType" | "title" | "authorizedStage"
      >,
  ): Promise<WorkflowTaskTemplateEntity> {
    const instance = await this.model.create({
      publicId: input.publicId,
      templateType: input.templateType,
      title: input.title,
      authorizedStage: input.authorizedStage,
      requiredInputs: input.requiredInputs ?? null,
      expectedOutputs: input.expectedOutputs ?? null,
      restrictions: input.restrictions ?? null,
      agentAssignment: input.agentAssignment ?? null,
      validationCriteria: input.validationCriteria ?? null,
      requiredApprovals: input.requiredApprovals ?? null,
      approvalStatus: "draft",
      version: 1,
      createdBy: input.createdBy ?? null,
      updatedBy: input.createdBy ?? null,
    });
    return toEntityWithIsoDates<WorkflowTaskTemplateEntity>(instance);
  }

  async findById(id: string): Promise<WorkflowTaskTemplateEntity | null> {
    const instance = await this.model.findByPk(id);
    return instance ? toEntityWithIsoDates<WorkflowTaskTemplateEntity>(instance) : null;
  }

  async findByPublicId(publicId: string): Promise<WorkflowTaskTemplateEntity | null> {
    const instance = await this.model.findOne({ where: { publicId } });
    return instance ? toEntityWithIsoDates<WorkflowTaskTemplateEntity>(instance) : null;
  }

  async list(
    filter: WorkflowTaskTemplateListFilter = {},
  ): Promise<readonly WorkflowTaskTemplateEntity[]> {
    const where: Record<string, unknown> = {};
    if (filter.templateType) {
      where.templateType = filter.templateType;
    }
    if (filter.approvalStatus) {
      where.approvalStatus = filter.approvalStatus;
    }
    if (filter.search) {
      where.title = { [Op.iLike]: `%${escapeLikePattern(filter.search)}%` };
    }
    const limit = Math.min(filter.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
    const rows = await this.model.findAll({
      where,
      // `id` is a secondary sort key so ties on `updatedAt` don't shift order between two
      // separate paginated queries, matching BrandLibraryRecordRepository's/
      // ContentTemplateRepository's own precedent (an already-fixed bug class in this codebase's
      // history).
      order: [
        ["updatedAt", "DESC"],
        ["id", "ASC"],
      ],
      limit,
      offset: filter.offset ?? 0,
    });
    return rows.map((row) => toEntityWithIsoDates<WorkflowTaskTemplateEntity>(row));
  }

  /**
   * Content update — `approvalStatus` is deliberately never accepted here; only
   * `updateApprovalStatus()` may change it. `version` is server-managed: incremented by 1 as part
   * of the same `UPDATE` statement via a Postgres-evaluated `version + 1` literal, with
   * `returning: true` getting the post-update row (including the server-computed `version`) back
   * from the `UPDATE` itself rather than a second round trip — mirrors
   * `BrandLibraryRecordRepository.update()`'s own identical pattern.
   *
   * `expectedApprovalStatus` is an optional CAS guard, mirroring
   * `BrandLibraryRecordRepository.update()`'s own `expectedApprovalStatus` parameter (a
   * previously-fixed bug class in this codebase): without it, the service's own terminal-state
   * check reads `approvalStatus` into application memory, but the actual write here would still
   * be unconditional — a concurrent `updateApprovalStatus()` transition landing between that read
   * and this write could let an edit silently succeed against what is now an archived/superseded
   * row.
   */
  async update(
    id: string,
    patch: Partial<WorkflowTaskTemplateUpdateFields>,
    expectedApprovalStatus?: WorkflowTaskTemplateApprovalStatus,
  ): Promise<WorkflowTaskTemplateEntity | null> {
    const where: Record<string, unknown> = { id };
    if (expectedApprovalStatus) {
      where.approvalStatus = expectedApprovalStatus;
    }
    const [affectedCount, affectedRows] = await this.model.update(
      { ...patch, version: literal("version + 1") },
      { where, returning: true },
    );
    if (affectedCount === 0 || !affectedRows[0]) {
      return null;
    }
    return toEntityWithIsoDates<WorkflowTaskTemplateEntity>(affectedRows[0]);
  }

  /** Atomic compare-and-swap on `(id, approvalStatus)` — mirrors
   *  `BrandLibraryRecordRepository.updateApprovalStatus()`'s own conditional-`UPDATE` pattern
   *  exactly, which itself mirrors `IdempotencyKeyRepository.reserve()`. Prevents two concurrent
   *  approvers from both reading the same `expectedCurrentStatus` and both "succeeding". Does not
   *  touch `version` — only content edits via `update()` increment it. */
  async updateApprovalStatus(
    id: string,
    expectedCurrentStatus: WorkflowTaskTemplateApprovalStatus,
    nextStatus: WorkflowTaskTemplateApprovalStatus,
    updatedBy: string | null,
  ): Promise<UpdateWorkflowTaskTemplateStatusResult> {
    const [affectedCount, affectedRows] = await this.model.update(
      { approvalStatus: nextStatus, updatedBy },
      { where: { id, approvalStatus: expectedCurrentStatus }, returning: true },
    );
    if (affectedCount > 0 && affectedRows[0]) {
      return {
        outcome: "updated",
        entity: toEntityWithIsoDates<WorkflowTaskTemplateEntity>(affectedRows[0]),
      };
    }
    const current = await this.model.findOne({ where: { id } });
    if (!current) {
      return { outcome: "not_found" };
    }
    return {
      outcome: "conflict",
      entity: toEntityWithIsoDates<WorkflowTaskTemplateEntity>(current),
    };
  }
}
