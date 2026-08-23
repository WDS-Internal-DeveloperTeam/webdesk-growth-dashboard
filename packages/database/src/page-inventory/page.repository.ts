import { Op } from "sequelize";
import { escapeLikePattern } from "../auth/user.repository.js";
import { getPageInventoryModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type {
  PageClassification,
  PageEntity,
  PageExistingOrProposed,
  PageIndexStatus,
  PageWorkflowStage,
} from "./entities.js";

/** Every field a caller may set/change on create, i.e. `PageEntity` minus its server-only-managed
 *  columns (`id`, `workflowStage`, `createdAt`, `updatedAt`) — derived, not hand-retyped, so a
 *  future field added to `PageEntity` is a compile error here until it's also handled by
 *  `create()`/`update()`, not a silent gap (mirrors `ProofClaimContentFields`'s own precedent). */
type PageContentFields = Omit<PageEntity, "id" | "workflowStage" | "createdAt" | "updatedAt">;

/** `update()`'s patch shape: every content field is optional (a partial edit); `publicId` and
 *  `projectId` are excluded — both immutable after create (mirrors `ProjectService`'s own
 *  precedent: a page never moves between projects, matching how a project's own `publicId` is
 *  never regenerated once assigned). */
type PageUpdateFields = Omit<PageContentFields, "publicId" | "projectId">;

export interface PageListFilter {
  /** Required — pages are project-scoped (task package D2); there is no cross-project "list every
   *  page" concept in this module. */
  readonly projectId: string;
  readonly pageType?: string;
  readonly workflowStage?: PageWorkflowStage;
  readonly roadmapPhaseId?: string;
  readonly indexStatus?: PageIndexStatus;
  readonly template?: string;
  /** Fuzzy match on `pageName` (uses the `pg_trgm` index) — the spec's own generic "search"
   *  concept, distinct from the `targetKeyword` filter below (the spec's own "keyword" filter). */
  readonly search?: string;
  readonly targetKeyword?: string;
  readonly lastScanBefore?: string;
  readonly lastScanAfter?: string;
  readonly lastDeploymentBefore?: string;
  readonly lastDeploymentAfter?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export type UpdatePageStatusResult =
  | { readonly outcome: "updated"; readonly entity: PageEntity }
  | { readonly outcome: "not_found" }
  | { readonly outcome: "conflict"; readonly entity: PageEntity };

// Mirrors PersonaRepository's/ServiceRepository's/ProofClaimRepository's own
// DEFAULT_LIST_LIMIT/MAX_LIST_LIMIT clamping pattern.
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

export class PageRepository {
  private readonly model = getPageInventoryModels().Page;

  async create(
    input: Partial<PageContentFields> &
      Pick<PageContentFields, "projectId" | "publicId" | "pageName">,
  ): Promise<PageEntity> {
    const instance = await this.model.create({
      projectId: input.projectId,
      publicId: input.publicId,
      pageName: input.pageName,
      pageType: input.pageType ?? null,
      existingOrProposed: input.existingOrProposed ?? "proposed",
      indexStatus: input.indexStatus ?? "unknown",
      template: input.template ?? null,
      roadmapPhaseId: input.roadmapPhaseId ?? null,
      workflowStage: "draft",
      targetKeyword: input.targetKeyword ?? null,
      designVersion: input.designVersion ?? null,
      repositoryFiles: input.repositoryFiles ?? null,
      wordpressPageId: input.wordpressPageId ?? null,
      wordpressPostId: input.wordpressPostId ?? null,
      lastScanAt: input.lastScanAt ?? null,
      lastDeploymentAt: input.lastDeploymentAt ?? null,
      classification: input.classification ?? null,
      createdBy: input.createdBy ?? null,
      updatedBy: input.createdBy ?? null,
    });
    return toEntityWithIsoDates<PageEntity>(instance);
  }

  async findById(id: string): Promise<PageEntity | null> {
    const instance = await this.model.findByPk(id);
    return instance ? toEntityWithIsoDates<PageEntity>(instance) : null;
  }

  async findByPublicId(publicId: string): Promise<PageEntity | null> {
    const instance = await this.model.findOne({ where: { publicId } });
    return instance ? toEntityWithIsoDates<PageEntity>(instance) : null;
  }

  async list(filter: PageListFilter): Promise<readonly PageEntity[]> {
    const where: Record<string, unknown> = { projectId: filter.projectId };
    if (filter.pageType) {
      where.pageType = filter.pageType;
    }
    if (filter.workflowStage) {
      where.workflowStage = filter.workflowStage;
    }
    if (filter.roadmapPhaseId) {
      where.roadmapPhaseId = filter.roadmapPhaseId;
    }
    if (filter.indexStatus) {
      where.indexStatus = filter.indexStatus;
    }
    if (filter.template) {
      where.template = filter.template;
    }
    if (filter.search) {
      where.pageName = { [Op.iLike]: `%${escapeLikePattern(filter.search)}%` };
    }
    if (filter.targetKeyword) {
      where.targetKeyword = { [Op.iLike]: `%${escapeLikePattern(filter.targetKeyword)}%` };
    }
    if (filter.lastScanBefore || filter.lastScanAfter) {
      const range: Record<symbol, string> = {};
      if (filter.lastScanBefore) {
        range[Op.lte] = filter.lastScanBefore;
      }
      if (filter.lastScanAfter) {
        range[Op.gte] = filter.lastScanAfter;
      }
      where.lastScanAt = range;
    }
    if (filter.lastDeploymentBefore || filter.lastDeploymentAfter) {
      const range: Record<symbol, string> = {};
      if (filter.lastDeploymentBefore) {
        range[Op.lte] = filter.lastDeploymentBefore;
      }
      if (filter.lastDeploymentAfter) {
        range[Op.gte] = filter.lastDeploymentAfter;
      }
      where.lastDeploymentAt = range;
    }

    const limit = Math.min(filter.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
    const rows = await this.model.findAll({
      where,
      // `id` is a secondary sort key so ties on `updatedAt` don't shift order between two separate
      // paginated queries, matching ProofClaimRepository's/PersonaRepository's own precedent.
      order: [
        ["updatedAt", "DESC"],
        ["id", "ASC"],
      ],
      limit,
      offset: filter.offset ?? 0,
    });
    return rows.map((row) => toEntityWithIsoDates<PageEntity>(row));
  }

  /**
   * Content update — `workflowStage` is deliberately never accepted here; only `updateStatus()`
   * may change it, same discipline as `PersonaRepository.update()`/`ProofClaimRepository.update()`.
   * A single atomic `UPDATE ... RETURNING`, not a separate `findOne()` + `instance.update()`.
   */
  async update(id: string, patch: Partial<PageUpdateFields>): Promise<PageEntity | null> {
    const [affectedCount, affectedRows] = await this.model.update(patch, {
      where: { id },
      returning: true,
    });
    if (affectedCount === 0 || !affectedRows[0]) {
      return null;
    }
    return toEntityWithIsoDates<PageEntity>(affectedRows[0]);
  }

  /** Atomic compare-and-swap on `(id, workflowStage)` — mirrors `ProofClaimRepository.updateStatus()`'s/
   *  `PersonaRepository.updateStatus()`'s own conditional-`UPDATE` pattern exactly, which itself
   *  mirrors `IdempotencyKeyRepository.reserve()`. Prevents two concurrent reviewers from both
   *  reading the same `expectedCurrentStage` and both "succeeding". */
  async updateStatus(
    id: string,
    expectedCurrentStage: PageWorkflowStage,
    nextStage: PageWorkflowStage,
    updatedBy: string | null,
  ): Promise<UpdatePageStatusResult> {
    const [affectedCount, affectedRows] = await this.model.update(
      { workflowStage: nextStage, updatedBy },
      { where: { id, workflowStage: expectedCurrentStage }, returning: true },
    );
    if (affectedCount > 0 && affectedRows[0]) {
      return { outcome: "updated", entity: toEntityWithIsoDates<PageEntity>(affectedRows[0]) };
    }
    const current = await this.model.findOne({ where: { id } });
    if (!current) {
      return { outcome: "not_found" };
    }
    return { outcome: "conflict", entity: toEntityWithIsoDates<PageEntity>(current) };
  }
}
