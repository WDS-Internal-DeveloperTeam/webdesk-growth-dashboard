import { col, fn, literal, Op, type Transaction } from "sequelize";
import { escapeLikePattern } from "../auth/user.repository.js";
import { getReleaseCenterModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type { ReleaseEntity, ReleaseStatus, ReleaseType } from "./entities.js";

type ReleaseContentFields = Omit<
  ReleaseEntity,
  | "id"
  | "status"
  | "productionApproverUserId"
  | "stagingDeployedAt"
  | "stagingVerifiedAt"
  | "productionDeployedAt"
  | "productionVerifiedAt"
  | "completedAt"
  | "hotfixRequiredAt"
  | "rolledBackAt"
  | "createdAt"
  | "updatedAt"
>;

/** `update()`'s patch shape: `projectId`/`publicId`/`releaseType` are all immutable after create
 *  (`releaseType` is this module's own discriminator field, matching every sibling module's own
 *  create-only discriminator contract), `createdBy` is never re-set. */
type ReleaseUpdateFields = Omit<
  ReleaseContentFields,
  "projectId" | "publicId" | "releaseType" | "createdBy"
>;

export interface ReleaseListFilter {
  readonly projectId: string;
  readonly releaseType?: ReleaseType;
  readonly status?: ReleaseStatus;
  /** Fuzzy match on `title` (uses the `pg_trgm` index). */
  readonly search?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export type UpdateReleaseStatusResult =
  | { readonly outcome: "updated"; readonly entity: ReleaseEntity }
  | { readonly outcome: "not_found" }
  | { readonly outcome: "conflict"; readonly entity: ReleaseEntity };

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

export class ReleaseRepository {
  private readonly model = getReleaseCenterModels().Release;

  async create(
    input: Partial<ReleaseContentFields> &
      Pick<ReleaseContentFields, "projectId" | "publicId" | "releaseType" | "title">,
  ): Promise<ReleaseEntity> {
    const instance = await this.model.create({
      projectId: input.projectId,
      publicId: input.publicId,
      releaseType: input.releaseType,
      title: input.title,
      status: "proposed",
      notes: input.notes ?? null,
      hotfixReason: input.hotfixReason ?? null,
      assignedDeveloperUserId: input.assignedDeveloperUserId ?? null,
      assignedReviewerUserId: input.assignedReviewerUserId ?? null,
      productionApproverUserId: null,
      stagingDeployedAt: null,
      stagingVerifiedAt: null,
      productionDeployedAt: null,
      productionVerifiedAt: null,
      completedAt: null,
      hotfixRequiredAt: null,
      rolledBackAt: null,
      createdBy: input.createdBy ?? null,
      updatedBy: input.createdBy ?? null,
    });
    return toEntityWithIsoDates<ReleaseEntity>(instance);
  }

  async findById(id: string, transaction?: Transaction): Promise<ReleaseEntity | null> {
    const instance = await this.model.findByPk(id, { transaction });
    return instance ? toEntityWithIsoDates<ReleaseEntity>(instance) : null;
  }

  async findByPublicId(publicId: string): Promise<ReleaseEntity | null> {
    const instance = await this.model.findOne({ where: { publicId } });
    return instance ? toEntityWithIsoDates<ReleaseEntity>(instance) : null;
  }

  async list(filter: ReleaseListFilter): Promise<readonly ReleaseEntity[]> {
    const where: Record<string, unknown> = { projectId: filter.projectId };
    if (filter.releaseType) {
      where.releaseType = filter.releaseType;
    }
    if (filter.status) {
      where.status = filter.status;
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
    return rows.map((row) => toEntityWithIsoDates<ReleaseEntity>(row));
  }

  /** Content update — `status` and every server-stamped column are deliberately never accepted
   *  here; only `updateStatus()` may change them, same discipline as
   *  `CaseStudyRepository.update()`. A single atomic `UPDATE ... RETURNING`. */
  async update(id: string, patch: Partial<ReleaseUpdateFields>): Promise<ReleaseEntity | null> {
    const [affectedCount, affectedRows] = await this.model.update(patch, {
      where: { id },
      returning: true,
    });
    if (affectedCount === 0 || !affectedRows[0]) {
      return null;
    }
    return toEntityWithIsoDates<ReleaseEntity>(affectedRows[0]);
  }

  /**
   * Atomic compare-and-swap on `(id, status)`, mirroring `CaseStudyRepository.updateStatus()`'s own
   * conditional-`UPDATE` pattern exactly. Also conditionally stamps whichever of the seven
   * server-managed timestamp columns the target status implies, each via a
   * `COALESCE(column, NOW())` SQL literal so "stamp once, never overwrite" stays atomic with the
   * CAS guard itself:
   *   - `staging_deployed` -> `stagingDeployedAt`
   *   - `staging_approved` -> `stagingVerifiedAt` (the one edge into this status is
   *     `staging_verification -> staging_approved`, i.e. staging verification having passed)
   *   - `production_deployed` -> `productionDeployedAt`, and — ONLY when the transition departs
   *     FROM `production_approval` specifically (not the `verification_failed -> production_deployed`
   *     redeploy path) — `productionApproverUserId`, via `fn("COALESCE", col(...), actorUserId)`
   *     rather than `literal()` (mirrors `ChangeRecordRepository.updateStatus()`'s own precedent):
   *     `fn()`'s own arguments are bound as real, parameterized query values, so `actorUserId`
   *     never needs to be interpolated into raw SQL.
   *   - `completed` -> `completedAt` AND `productionVerifiedAt` together (the one edge into this
   *     status is `production_verification -> completed`, i.e. production verification having
   *     passed at the same moment the release completes)
   *   - `hotfix_required` -> `hotfixRequiredAt`
   *   - `rolled_back` -> `rolledBackAt`
   */
  async updateStatus(
    id: string,
    expectedCurrentStatus: ReleaseStatus,
    nextStatus: ReleaseStatus,
    actorUserId: string,
    transaction?: Transaction,
  ): Promise<UpdateReleaseStatusResult> {
    const values: Record<string, unknown> = { status: nextStatus, updatedBy: actorUserId };

    if (nextStatus === "staging_deployed") {
      values.stagingDeployedAt = literal('COALESCE("staging_deployed_at", NOW())');
    }
    if (nextStatus === "staging_approved") {
      values.stagingVerifiedAt = literal('COALESCE("staging_verified_at", NOW())');
    }
    if (nextStatus === "production_deployed") {
      values.productionDeployedAt = literal('COALESCE("production_deployed_at", NOW())');
      if (expectedCurrentStatus === "production_approval") {
        values.productionApproverUserId = fn(
          "COALESCE",
          col("production_approver_user_id"),
          actorUserId,
        );
      }
    }
    if (nextStatus === "completed") {
      values.completedAt = literal('COALESCE("completed_at", NOW())');
      values.productionVerifiedAt = literal('COALESCE("production_verified_at", NOW())');
    }
    if (nextStatus === "hotfix_required") {
      values.hotfixRequiredAt = literal('COALESCE("hotfix_required_at", NOW())');
    }
    if (nextStatus === "rolled_back") {
      values.rolledBackAt = literal('COALESCE("rolled_back_at", NOW())');
    }

    const [affectedCount, affectedRows] = await this.model.update(values, {
      where: { id, status: expectedCurrentStatus },
      returning: true,
      transaction,
    });
    if (affectedCount > 0 && affectedRows[0]) {
      return { outcome: "updated", entity: toEntityWithIsoDates<ReleaseEntity>(affectedRows[0]) };
    }
    const current = await this.model.findOne({ where: { id }, transaction });
    if (!current) {
      return { outcome: "not_found" };
    }
    return { outcome: "conflict", entity: toEntityWithIsoDates<ReleaseEntity>(current) };
  }
}
