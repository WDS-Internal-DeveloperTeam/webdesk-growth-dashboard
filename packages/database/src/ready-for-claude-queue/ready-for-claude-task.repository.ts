import { Op } from "sequelize";
import { escapeLikePattern } from "../auth/user.repository.js";
import { getReadyForClaudeQueueModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type {
  ReadyForClaudeTaskEntity,
  ReadyForClaudeTaskPriority,
  ReadyForClaudeTaskStatus,
} from "./entities.js";

/** Every field a caller may set on create, i.e. `ReadyForClaudeTaskEntity` minus its server-only-
 *  managed columns (`id`, `status`, `createdAt`, `updatedAt`) — derived, not hand-retyped,
 *  mirroring `InternalLinkContentFields`'s own precedent. */
type ReadyForClaudeTaskContentFields = Omit<
  ReadyForClaudeTaskEntity,
  "id" | "status" | "createdAt" | "updatedAt"
>;

/** `update()`'s patch shape: every content field is optional (a partial edit); `publicId` and
 *  `projectId` are excluded — both immutable after create, mirroring `InternalLinkUpdateFields`'s
 *  own precedent (a task never moves between projects, and its identity never changes). */
type ReadyForClaudeTaskUpdateFields = Omit<
  ReadyForClaudeTaskContentFields,
  "publicId" | "projectId"
>;

export interface ReadyForClaudeTaskListFilter {
  readonly status?: ReadyForClaudeTaskStatus;
  readonly priority?: ReadyForClaudeTaskPriority;
  /** Optional (D5) — unlike every prior project-scoped module, this is a filter, not a mandatory
   *  route-derived scope: a task may be organization-wide. */
  readonly projectId?: string;
  /** Exact match, not a fuzzy/ILIKE search — module keys are a closed, known vocabulary
   *  (validated against the real module registry at the service layer, D1), not free text,
   *  matching `ReviewListFilter.targetModuleKey`'s own identical choice. */
  readonly targetModuleKey?: string;
  readonly agent?: string;
  /** Fuzzy match on `title` (uses the `pg_trgm` index). */
  readonly search?: string;
  readonly limit?: number;
  readonly offset?: number;
}

/**
 * Per-module CAS-outcome union, matching this codebase's own established precedent — Design Review
 * Center declared its own `DesignReviewCasResult<T>` rather than importing Review and Approval
 * Center's `CasResult<T>`, and Internal Linking Library declared a non-generic
 * `UpdateInternalLinkStatusResult`. No shared, module-neutral CAS type exists anywhere in
 * `packages/database` to import instead (checked directly): `CasResult<T>` lives inside
 * `review-and-approval-center/review.repository.ts`, and reaching across a module boundary for it
 * would couple this module to that one for a three-line structural type.
 */
export type ReadyForClaudeTaskCasResult<T> =
  | { readonly outcome: "updated"; readonly entity: T }
  | { readonly outcome: "not_found" }
  | { readonly outcome: "conflict"; readonly entity: T };

// Mirrors InternalLinkRepository's/ReviewRepository's own DEFAULT_LIST_LIMIT/MAX_LIST_LIMIT
// clamping pattern.
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

export class ReadyForClaudeTaskRepository {
  private readonly model = getReadyForClaudeQueueModels().ReadyForClaudeTask;

  async create(
    input: Partial<ReadyForClaudeTaskContentFields> &
      Pick<ReadyForClaudeTaskContentFields, "publicId" | "title">,
  ): Promise<ReadyForClaudeTaskEntity> {
    const instance = await this.model.create({
      publicId: input.publicId,
      title: input.title,
      description: input.description ?? null,
      priority: input.priority ?? "medium",
      agent: input.agent ?? null,
      agentVersion: input.agentVersion ?? null,
      projectId: input.projectId ?? null,
      targetModuleKey: input.targetModuleKey ?? null,
      targetId: input.targetId ?? null,
      // Always the initial state — never accepted as caller input on create, the same discipline
      // every sibling module's own create() applies to its own status column.
      status: "draft",
      stage: input.stage ?? null,
      dependencies: input.dependencies ?? [],
      operatorUserId: input.operatorUserId ?? null,
      developerUserId: input.developerUserId ?? null,
      featureBranch: input.featureBranch ?? null,
      sourceCommit: input.sourceCommit ?? null,
      prId: input.prId ?? null,
      prUrl: input.prUrl ?? null,
      prStatus: input.prStatus ?? null,
      reviewerUserId: input.reviewerUserId ?? null,
      codeReviewResult: input.codeReviewResult ?? null,
      stagingCommit: input.stagingCommit ?? null,
      stagingDeployment: input.stagingDeployment ?? null,
      stagingUrl: input.stagingUrl ?? null,
      dashboardReview: input.dashboardReview ?? null,
      changesRequestedNotes: input.changesRequestedNotes ?? null,
      productionApproval: input.productionApproval ?? false,
      productionApproverUserId: input.productionApproverUserId ?? null,
      productionCommit: input.productionCommit ?? null,
      productionDeployment: input.productionDeployment ?? null,
      productionVerification: input.productionVerification ?? null,
      rollbackVersion: input.rollbackVersion ?? null,
      failureReason: input.failureReason ?? null,
      retryCount: input.retryCount ?? 0,
      dueDate: input.dueDate ?? null,
      auditReference: input.auditReference ?? null,
      createdBy: input.createdBy ?? null,
      updatedBy: input.createdBy ?? null,
    });
    return toEntityWithIsoDates<ReadyForClaudeTaskEntity>(instance);
  }

  async findById(id: string): Promise<ReadyForClaudeTaskEntity | null> {
    const instance = await this.model.findByPk(id);
    return instance ? toEntityWithIsoDates<ReadyForClaudeTaskEntity>(instance) : null;
  }

  async findByPublicId(publicId: string): Promise<ReadyForClaudeTaskEntity | null> {
    const instance = await this.model.findOne({ where: { publicId } });
    return instance ? toEntityWithIsoDates<ReadyForClaudeTaskEntity>(instance) : null;
  }

  /**
   * A narrow existence check for the `dependencies` array validation (D2) — deliberately returns
   * a bare boolean rather than the entity, so the service's own dependency check never pulls a
   * whole task row per element just to discard it. Mirrors `PagesService.existsInProject()`'s own
   * narrow-read precedent.
   */
  async existsById(id: string): Promise<boolean> {
    return (await this.model.count({ where: { id } })) > 0;
  }

  async list(
    filter: ReadyForClaudeTaskListFilter = {},
  ): Promise<readonly ReadyForClaudeTaskEntity[]> {
    const where: Record<string, unknown> = {};
    if (filter.status) {
      where.status = filter.status;
    }
    if (filter.priority) {
      where.priority = filter.priority;
    }
    if (filter.projectId) {
      where.projectId = filter.projectId;
    }
    if (filter.targetModuleKey) {
      where.targetModuleKey = filter.targetModuleKey;
    }
    if (filter.agent) {
      where.agent = filter.agent;
    }
    if (filter.search) {
      where.title = { [Op.iLike]: `%${escapeLikePattern(filter.search)}%` };
    }

    const limit = Math.min(filter.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
    const rows = await this.model.findAll({
      where,
      // `id` is a secondary sort key so ties on `updatedAt` don't shift order between two separate
      // paginated queries, matching every sibling module's own established precedent.
      order: [
        ["updatedAt", "DESC"],
        ["id", "ASC"],
      ],
      limit,
      offset: filter.offset ?? 0,
    });
    return rows.map((row) => toEntityWithIsoDates<ReadyForClaudeTaskEntity>(row));
  }

  /**
   * Content update — `status` is deliberately never accepted here; only `updateStatus()` may
   * change it, same discipline as `InternalLinkRepository.update()`/`KeywordRepository.update()`.
   * A single atomic `UPDATE ... RETURNING`, not a separate `findOne()` + `instance.update()`.
   *
   * That exclusion is enforced at RUNTIME (`status` is destructured off the patch), not only in
   * the `ReadyForClaudeTaskUpdateFields` type — a real integration test in
   * `test/module-ready-for-claude-queue.integration.test.ts` proves it. The sibling repositories
   * this one mirrors rely on the type alone, which holds for every current caller (the DTO's Zod
   * schema strips an unrecognized `status` key before the service ever sees it) but would silently
   * stop holding for any future non-HTTP caller. Cheap to close here; deliberately not retrofitted
   * onto the already-shipped siblings, which is its own separate change.
   *
   * `expectedStatus` is a CAS guard, mirroring `InternalLinkRepository.update()`'s own identical
   * parameter — without it, a concurrent `updateStatus()` transition landing between the service's
   * `findById()` read and this write would let an in-place edit silently succeed against a status
   * the caller never actually saw (including, critically here, a status that has since become
   * terminal).
   */
  async update(
    id: string,
    patch: Partial<ReadyForClaudeTaskUpdateFields>,
    expectedStatus?: ReadyForClaudeTaskStatus,
  ): Promise<ReadyForClaudeTaskEntity | null> {
    const where: Record<string, unknown> = { id };
    if (expectedStatus) {
      where.status = expectedStatus;
    }
    const { status: _ignoredStatus, ...contentPatch } =
      patch as Partial<ReadyForClaudeTaskUpdateFields> & { status?: unknown };
    const [affectedCount, affectedRows] = await this.model.update(contentPatch, {
      where,
      returning: true,
    });
    if (affectedCount === 0 || !affectedRows[0]) {
      return null;
    }
    return toEntityWithIsoDates<ReadyForClaudeTaskEntity>(affectedRows[0]);
  }

  /**
   * Atomic compare-and-swap on `(id, status)` — mirrors `InternalLinkRepository.updateStatus()`'s/
   * `ReviewRepository.updateStatus()`'s own conditional-`UPDATE` pattern exactly (itself mirroring
   * `IdempotencyKeyRepository.reserve()`). Prevents two concurrent callers from both reading the
   * same `expectedCurrentStatus` and both "succeeding".
   *
   * No timestamp column is conditionally stamped here (unlike `InternalLinkRepository.updateStatus()`'s
   * `COALESCE`-based `implementedAt`/`verifiedAt` write) — this module's own field list names no
   * per-status timestamp; the audit trail (`AuditService`) is the record of when each transition
   * happened.
   */
  async updateStatus(
    id: string,
    expectedCurrentStatus: ReadyForClaudeTaskStatus,
    nextStatus: ReadyForClaudeTaskStatus,
    updatedBy: string | null,
  ): Promise<ReadyForClaudeTaskCasResult<ReadyForClaudeTaskEntity>> {
    const [affectedCount, affectedRows] = await this.model.update(
      { status: nextStatus, updatedBy },
      { where: { id, status: expectedCurrentStatus }, returning: true },
    );
    if (affectedCount > 0 && affectedRows[0]) {
      return {
        outcome: "updated",
        entity: toEntityWithIsoDates<ReadyForClaudeTaskEntity>(affectedRows[0]),
      };
    }
    const current = await this.model.findOne({ where: { id } });
    if (!current) {
      return { outcome: "not_found" };
    }
    return {
      outcome: "conflict",
      entity: toEntityWithIsoDates<ReadyForClaudeTaskEntity>(current),
    };
  }
}
