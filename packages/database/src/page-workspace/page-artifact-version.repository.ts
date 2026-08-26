import { Op, type Transaction } from "sequelize";
import { getPageWorkspaceModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type { PageArtifactVersionEntity, PageArtifactVersionStatus } from "./entities.js";

/** Every field a caller may set when creating a version, i.e. the entity minus its
 *  server-managed columns — derived, not hand-retyped, so a future field added to the entity is
 *  a compile error here until it is also handled, not a silent gap (mirrors `PageContentFields`
 *  and `ProofClaimContentFields`'s own precedent). */
export type PageArtifactVersionContentFields = Omit<
  PageArtifactVersionEntity,
  "id" | "status" | "versionNumber" | "approvedByUserId" | "approvedAt" | "createdAt" | "updatedAt"
>;

/** `update()`'s patch shape: the immutable identity/lineage columns are excluded outright — a
 *  version never moves between artifacts, pages or projects, and its reopen lineage is written
 *  once by `reopen()` and never edited afterward. */
export type PageArtifactVersionUpdateFields = Omit<
  PageArtifactVersionContentFields,
  "artifactId" | "pageId" | "projectId" | "reopenedReason" | "reopenedFromVersionId" | "createdBy"
>;

export type UpdateVersionStatusResult =
  | { readonly outcome: "updated"; readonly entity: PageArtifactVersionEntity }
  | { readonly outcome: "not_found" }
  | { readonly outcome: "conflict"; readonly entity: PageArtifactVersionEntity };

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

/**
 * `page_artifact_versions` — the real versioned artifact content.
 *
 * Like `PageArtifactRepository`, every read and write is scoped by `projectId` in the WHERE
 * clause, not just by primary key (task package D11) — real IDOR prevention at the persistence
 * layer rather than service-code discipline.
 */
export class PageArtifactVersionRepository {
  private readonly model = getPageWorkspaceModels().PageArtifactVersion;

  async create(
    input: Partial<PageArtifactVersionContentFields> &
      Pick<PageArtifactVersionContentFields, "artifactId" | "pageId" | "projectId"> & {
        readonly versionNumber: number;
        readonly status?: PageArtifactVersionStatus;
      },
    transaction?: Transaction,
  ): Promise<PageArtifactVersionEntity> {
    const instance = await this.model.create(
      {
        artifactId: input.artifactId,
        pageId: input.pageId,
        projectId: input.projectId,
        versionNumber: input.versionNumber,
        status: input.status ?? "draft",
        content: input.content ?? null,
        notes: input.notes ?? null,
        repository: input.repository ?? null,
        path: input.path ?? null,
        branch: input.branch ?? null,
        commitSha: input.commitSha ?? null,
        contentChecksum: input.contentChecksum ?? null,
        reopenedReason: input.reopenedReason ?? null,
        reopenedFromVersionId: input.reopenedFromVersionId ?? null,
        approvedByUserId: null,
        approvedAt: null,
        createdBy: input.createdBy ?? null,
        updatedBy: input.createdBy ?? null,
      },
      transaction ? { transaction } : {},
    );
    return toEntityWithIsoDates<PageArtifactVersionEntity>(instance);
  }

  async findById(id: string, projectId: string): Promise<PageArtifactVersionEntity | null> {
    const instance = await this.model.findOne({ where: { id, projectId } });
    return instance ? toEntityWithIsoDates<PageArtifactVersionEntity>(instance) : null;
  }

  async listForArtifact(
    artifactId: string,
    projectId: string,
    options: { readonly limit?: number; readonly offset?: number } = {},
  ): Promise<readonly PageArtifactVersionEntity[]> {
    const limit = Math.min(options.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
    const rows = await this.model.findAll({
      where: { artifactId, projectId },
      // Newest version first. `versionNumber` is unique per artifact, so it needs no tiebreaker —
      // unlike the `updatedAt`-ordered list queries elsewhere in this codebase.
      order: [["versionNumber", "DESC"]],
      limit,
      offset: options.offset ?? 0,
    });
    return rows.map((row) => toEntityWithIsoDates<PageArtifactVersionEntity>(row));
  }

  /** Highest existing version number for an artifact, or 0 when it has none yet. Read inside the
   *  same transaction as the subsequent insert so two concurrent creates cannot both compute the
   *  same next number; the `(artifact_id, version_number)` unique index is the real backstop, and
   *  the service maps its violation to a clean 409. */
  async findLatestVersionNumber(
    artifactId: string,
    projectId: string,
    transaction?: Transaction,
  ): Promise<number> {
    const instance = await this.model.findOne({
      where: { artifactId, projectId },
      order: [["versionNumber", "DESC"]],
      ...(transaction ? { transaction, lock: transaction.LOCK.UPDATE } : {}),
    });
    if (!instance) {
      return 0;
    }
    const { versionNumber } = toEntityWithIsoDates<PageArtifactVersionEntity>(instance);
    return versionNumber;
  }

  /**
   * The artifact's current non-terminal version, if any. "Live" means a version that can still be
   * worked on or decided — anything outside {superseded, archived, rejected}. `reopen()` uses this
   * to guarantee an artifact never ends up with two simultaneously editable versions.
   */
  async findLiveVersion(
    artifactId: string,
    projectId: string,
    transaction?: Transaction,
  ): Promise<PageArtifactVersionEntity | null> {
    const instance = await this.model.findOne({
      where: {
        artifactId,
        projectId,
        status: { [Op.notIn]: ["superseded", "archived", "rejected"] },
      },
      order: [["versionNumber", "DESC"]],
      ...(transaction ? { transaction } : {}),
    });
    return instance ? toEntityWithIsoDates<PageArtifactVersionEntity>(instance) : null;
  }

  /**
   * In-place content edit. `status` is deliberately never accepted here — only `updateStatus()`
   * may change it, the same discipline `PageRepository.update()`/`PersonaRepository.update()`
   * already enforce.
   *
   * `expectedStatus` is a compare-and-swap guard, mirroring `PageRepository.update()`'s own
   * `expectedWorkflowStage` (itself the fix for a real security-review finding on this exact bug
   * class). Without it, a concurrent `updateStatus()` landing between the service's read and this
   * write would let an edit silently succeed against a now-approved version — exactly the
   * "approved artifacts are immutable" invariant (`04_Data_Model_and_Ownership.md §5`) that the
   * service's own upfront guard exists to enforce.
   */
  async update(
    id: string,
    projectId: string,
    patch: Partial<PageArtifactVersionUpdateFields>,
    expectedStatus?: PageArtifactVersionStatus,
  ): Promise<PageArtifactVersionEntity | null> {
    const where: Record<string, unknown> = { id, projectId };
    if (expectedStatus) {
      where.status = expectedStatus;
    }
    const [affectedCount, affectedRows] = await this.model.update(patch, {
      where,
      returning: true,
    });
    if (affectedCount === 0 || !affectedRows[0]) {
      return null;
    }
    return toEntityWithIsoDates<PageArtifactVersionEntity>(affectedRows[0]);
  }

  /**
   * Atomic compare-and-swap on `(id, projectId, status)` — mirrors
   * `PageRepository.updateStatus()`'s own conditional-UPDATE pattern exactly, which itself
   * mirrors `IdempotencyKeyRepository.reserve()`. Prevents two concurrent reviewers from both
   * reading the same `expectedStatus` and both "succeeding".
   *
   * When the target status is `approved`, the approver and decision timestamp are stamped in the
   * SAME statement — `05_Workflow_State_Machines.md §12` requires every approval to record both,
   * bound to the exact version, so they can never drift apart from the status they describe.
   */
  async updateStatus(
    id: string,
    projectId: string,
    expectedStatus: PageArtifactVersionStatus,
    nextStatus: PageArtifactVersionStatus,
    actorUserId: string | null,
    transaction?: Transaction,
  ): Promise<UpdateVersionStatusResult> {
    const patch: Record<string, unknown> = { status: nextStatus, updatedBy: actorUserId };
    if (nextStatus === "approved") {
      patch.approvedByUserId = actorUserId;
      patch.approvedAt = new Date();
    }
    const [affectedCount, affectedRows] = await this.model.update(patch, {
      where: { id, projectId, status: expectedStatus },
      returning: true,
      ...(transaction ? { transaction } : {}),
    });
    if (affectedCount > 0 && affectedRows[0]) {
      return {
        outcome: "updated",
        entity: toEntityWithIsoDates<PageArtifactVersionEntity>(affectedRows[0]),
      };
    }
    const current = await this.model.findOne({
      where: { id, projectId },
      ...(transaction ? { transaction } : {}),
    });
    if (!current) {
      return { outcome: "not_found" };
    }
    return {
      outcome: "conflict",
      entity: toEntityWithIsoDates<PageArtifactVersionEntity>(current),
    };
  }
}
