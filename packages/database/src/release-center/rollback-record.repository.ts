import type { Transaction } from "sequelize";
import { getReleaseCenterModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type { RollbackRecordEntity } from "./entities.js";

/** Derived from `RollbackRecordEntity` itself (not hand-typed) — code-review finding: a hand-typed
 *  input interface gave no compile-time signal when the entity gained/renamed a field, unlike
 *  `ReleaseRepository.create()`'s own `Omit`-derived pattern. `rolledBackAt` is a real `Date` here
 *  (the entity's own `string` is the post-mapping ISO representation) — defaults to `now()` at the
 *  database layer when omitted; a caller that already computed a single, shared timestamp for both
 *  this row and the parent `releases` status write passes it explicitly so both records agree
 *  exactly, mirroring `ReleaseApprovalRepository.create()`'s own `decidedAt` precedent. */
export type CreateRollbackRecordInput = Omit<
  RollbackRecordEntity,
  "id" | "createdAt" | "updatedAt" | "replacementReleaseId" | "rolledBackByUserId" | "rolledBackAt"
> & {
  readonly replacementReleaseId?: string | null;
  readonly rolledBackByUserId?: string | null;
  readonly rolledBackAt?: Date;
};

/** At most one per release (`rollback_records_release_id_unique`) — auto-inserted inside the same
 *  transaction as the parent `releases` CAS status write on any `-> rolled_back` transition. No
 *  `update()`/`remove()` method exists here at all (ADR-0016). */
export class RollbackRecordRepository {
  private readonly model = getReleaseCenterModels().RollbackRecord;

  /** `transaction`, when supplied, lets the caller (`ReleasesService.changeStatus()`) commit this
   *  write atomically alongside the parent `releases` CAS status update, mirroring
   *  `ReleaseApprovalRepository.create()`'s own identical `transaction` parameter. */
  async create(
    input: CreateRollbackRecordInput,
    transaction?: Transaction,
  ): Promise<RollbackRecordEntity> {
    const instance = await this.model.create(
      {
        releaseId: input.releaseId,
        projectId: input.projectId,
        rolledBackSha: input.rolledBackSha,
        reason: input.reason,
        replacementReleaseId: input.replacementReleaseId ?? null,
        rolledBackByUserId: input.rolledBackByUserId ?? null,
        ...(input.rolledBackAt ? { rolledBackAt: input.rolledBackAt } : {}),
      },
      { transaction },
    );
    return toEntityWithIsoDates<RollbackRecordEntity>(instance);
  }

  /** Read-only lookup for `GET .../releases/:id/rollback` — returns `null` when the release has
   *  never been rolled back. */
  async findByReleaseId(releaseId: string): Promise<RollbackRecordEntity | null> {
    const instance = await this.model.findOne({ where: { releaseId } });
    return instance ? toEntityWithIsoDates<RollbackRecordEntity>(instance) : null;
  }
}
