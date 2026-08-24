import { literal, Op } from "sequelize";
import { escapeLikePattern } from "../auth/user.repository.js";
import { getInternalLinkingLibraryModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type { InternalLinkEntity, InternalLinkPriority, InternalLinkStatus } from "./entities.js";

/** Every field a caller may set/change on create, i.e. `InternalLinkEntity` minus its server-only-
 *  managed columns (`id`, `status`, `implementedAt`, `verifiedAt`, `createdAt`, `updatedAt`) —
 *  derived, not hand-retyped, mirroring `KeywordContentFields`'s own precedent
 *  (`packages/database/src/keyword-and-entity-library/keyword.repository.ts`). */
type InternalLinkContentFields = Omit<
  InternalLinkEntity,
  "id" | "status" | "implementedAt" | "verifiedAt" | "createdAt" | "updatedAt"
>;

/** `update()`'s patch shape: every content field is optional (a partial edit); `publicId` and
 *  `projectId` are excluded — both immutable after create, mirroring `KeywordUpdateFields`'s own
 *  precedent (a link never moves between projects). */
type InternalLinkUpdateFields = Omit<InternalLinkContentFields, "publicId" | "projectId">;

export interface InternalLinkListFilter {
  /** Required — links are project-scoped (task package D3); there is no cross-project "list every
   *  link" concept in this module. */
  readonly projectId: string;
  readonly sourcePageId?: string;
  readonly targetPageId?: string;
  readonly status?: InternalLinkStatus;
  readonly priority?: InternalLinkPriority;
  readonly linkType?: string;
  /** Fuzzy match on `anchor` (uses the `pg_trgm` index). */
  readonly search?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export type UpdateInternalLinkStatusResult =
  | { readonly outcome: "updated"; readonly entity: InternalLinkEntity }
  | { readonly outcome: "not_found" }
  | { readonly outcome: "conflict"; readonly entity: InternalLinkEntity };

// Mirrors KeywordRepository's/PageRepository's own DEFAULT_LIST_LIMIT/MAX_LIST_LIMIT clamping
// pattern.
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

export class InternalLinkRepository {
  private readonly model = getInternalLinkingLibraryModels().InternalLink;

  async create(
    input: Partial<InternalLinkContentFields> &
      Pick<InternalLinkContentFields, "projectId" | "publicId" | "sourcePageId" | "targetPageId">,
  ): Promise<InternalLinkEntity> {
    const instance = await this.model.create({
      projectId: input.projectId,
      publicId: input.publicId,
      sourcePageId: input.sourcePageId,
      targetPageId: input.targetPageId,
      relationship: input.relationship ?? null,
      anchor: input.anchor ?? null,
      context: input.context ?? null,
      linkType: input.linkType ?? null,
      priority: input.priority ?? null,
      status: "proposed",
      detector: input.detector ?? null,
      assignedApproverUserId: input.assignedApproverUserId ?? null,
      relatedStrategyRecordId: input.relatedStrategyRecordId ?? null,
      createdBy: input.createdBy ?? null,
      updatedBy: input.createdBy ?? null,
    });
    return toEntityWithIsoDates<InternalLinkEntity>(instance);
  }

  async findById(id: string): Promise<InternalLinkEntity | null> {
    const instance = await this.model.findByPk(id);
    return instance ? toEntityWithIsoDates<InternalLinkEntity>(instance) : null;
  }

  async findByPublicId(publicId: string): Promise<InternalLinkEntity | null> {
    const instance = await this.model.findOne({ where: { publicId } });
    return instance ? toEntityWithIsoDates<InternalLinkEntity>(instance) : null;
  }

  async list(filter: InternalLinkListFilter): Promise<readonly InternalLinkEntity[]> {
    const where: Record<string, unknown> = { projectId: filter.projectId };
    if (filter.sourcePageId) {
      where.sourcePageId = filter.sourcePageId;
    }
    if (filter.targetPageId) {
      where.targetPageId = filter.targetPageId;
    }
    if (filter.status) {
      where.status = filter.status;
    }
    if (filter.priority) {
      where.priority = filter.priority;
    }
    if (filter.linkType) {
      where.linkType = filter.linkType;
    }
    if (filter.search) {
      where.anchor = { [Op.iLike]: `%${escapeLikePattern(filter.search)}%` };
    }

    const limit = Math.min(filter.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
    const rows = await this.model.findAll({
      where,
      // `id` is a secondary sort key so ties on `updatedAt` don't shift order between two separate
      // paginated queries, matching KeywordRepository's/PageRepository's own precedent.
      order: [
        ["updatedAt", "DESC"],
        ["id", "ASC"],
      ],
      limit,
      offset: filter.offset ?? 0,
    });
    return rows.map((row) => toEntityWithIsoDates<InternalLinkEntity>(row));
  }

  /**
   * Content update — `status` is deliberately never accepted here; only `updateStatus()` may
   * change it, same discipline as `KeywordRepository.update()`/`PageRepository.update()`. A single
   * atomic `UPDATE ... RETURNING`, not a separate `findOne()` + `instance.update()`.
   */
  async update(
    id: string,
    patch: Partial<InternalLinkUpdateFields>,
    expectedStatus?: InternalLinkStatus,
  ): Promise<InternalLinkEntity | null> {
    const where: Record<string, unknown> = { id };
    if (expectedStatus) {
      // A CAS guard, mirroring KeywordRepository.update()'s own expectedApprovalStatus parameter
      // and PageRepository.update()'s own expectedWorkflowStage parameter — this project's own
      // already-fixed precedent for the identical bug class: without it, a concurrent
      // updateStatus() transition (its own atomic CAS below) landing between the service's
      // findById() read and this write would let an in-place edit silently succeed against a
      // status the caller never actually saw.
      where.status = expectedStatus;
    }
    const [affectedCount, affectedRows] = await this.model.update(patch, {
      where,
      returning: true,
    });
    if (affectedCount === 0 || !affectedRows[0]) {
      return null;
    }
    return toEntityWithIsoDates<InternalLinkEntity>(affectedRows[0]);
  }

  /**
   * Atomic compare-and-swap on `(id, status)` — mirrors `KeywordRepository.updateStatus()`'s/
   * `PageRepository.updateStatus()`'s own conditional-`UPDATE` pattern exactly, which itself
   * mirrors `IdempotencyKeyRepository.reserve()`. Prevents two concurrent reviewers from both
   * reading the same `expectedCurrentStatus` and both "succeeding".
   *
   * Also conditionally stamps `implementedAt`/`verifiedAt` in the SAME atomic `UPDATE` — task
   * package D2's own "server-stamped automatically by the corresponding status transition, never
   * overwritten once first set" contract. `nextStatus` alone determines which column (if any) gets
   * stamped, so a repeat entry into `implemented` (e.g. `verified -> implemented` via the
   * backward `review` transition) does NOT reset `implementedAt` to a later time — a
   * `COALESCE(implemented_at, NOW())` SQL expression via `sequelize.literal()`, since no in-repo
   * precedent exists for this exact "stamp once, never overwrite, same statement as a CAS write"
   * shape (checked directly — no other module needed it). Read-then-write would defeat the CAS
   * guard's own atomicity, so the conditional column value is baked directly into the same
   * `model.update()` call as the `(id, status)` compare-and-swap.
   */
  async updateStatus(
    id: string,
    expectedCurrentStatus: InternalLinkStatus,
    nextStatus: InternalLinkStatus,
    updatedBy: string | null,
  ): Promise<UpdateInternalLinkStatusResult> {
    const values: Record<string, unknown> = { status: nextStatus, updatedBy };
    if (nextStatus === "implemented") {
      values.implementedAt = literal('COALESCE("implemented_at", NOW())');
    } else if (nextStatus === "verified") {
      values.verifiedAt = literal('COALESCE("verified_at", NOW())');
    }

    const [affectedCount, affectedRows] = await this.model.update(values, {
      where: { id, status: expectedCurrentStatus },
      returning: true,
    });
    if (affectedCount > 0 && affectedRows[0]) {
      return {
        outcome: "updated",
        entity: toEntityWithIsoDates<InternalLinkEntity>(affectedRows[0]),
      };
    }
    const current = await this.model.findOne({ where: { id } });
    if (!current) {
      return { outcome: "not_found" };
    }
    return { outcome: "conflict", entity: toEntityWithIsoDates<InternalLinkEntity>(current) };
  }
}
