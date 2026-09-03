import type { Transaction } from "sequelize";
import { getReleaseCenterModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type {
  ReleaseApprovalDecision,
  ReleaseApprovalEntity,
  ReleaseApprovalStage,
} from "./entities.js";

export interface CreateReleaseApprovalInput {
  readonly releaseId: string;
  readonly projectId: string;
  readonly approvalStage: ReleaseApprovalStage;
  readonly decision: ReleaseApprovalDecision;
  readonly decidedByUserId: string | null;
  readonly notes?: string | null;
  /** Defaults to `now()` at the database layer when omitted — a caller that already computed a
   *  single, shared timestamp for both this row and the parent `releases` status write passes it
   *  explicitly so both records agree exactly, mirroring
   *  `CaseStudyApprovalRepository.create()`'s own `decidedAt` precedent. */
  readonly decidedAt?: Date;
}

/** Append-only by application convention (no `update()`/`remove()` method exists here at all),
 *  mirroring `CaseStudyApprovalRepository` file-for-file — this is Release Center's own queryable
 *  local approval history, distinct from the real, DB-trigger-enforced `audit_events` table
 *  `AuditService` also writes to on every successful transition. */
export class ReleaseApprovalRepository {
  private readonly model = getReleaseCenterModels().ReleaseApproval;

  /** `transaction`, when supplied, lets the caller (`ReleasesService.changeStatus()`) commit this
   *  write atomically alongside the parent `releases` CAS status update, mirroring
   *  `CaseStudyApprovalRepository.create()`'s own identical `transaction` parameter. */
  async create(
    input: CreateReleaseApprovalInput,
    transaction?: Transaction,
  ): Promise<ReleaseApprovalEntity> {
    const instance = await this.model.create(
      {
        releaseId: input.releaseId,
        projectId: input.projectId,
        approvalStage: input.approvalStage,
        decision: input.decision,
        decidedByUserId: input.decidedByUserId,
        notes: input.notes ?? null,
        ...(input.decidedAt ? { decidedAt: input.decidedAt } : {}),
      },
      { transaction },
    );
    return toEntityWithIsoDates<ReleaseApprovalEntity>(instance);
  }

  async listByRelease(releaseId: string): Promise<readonly ReleaseApprovalEntity[]> {
    const rows = await this.model.findAll({
      where: { releaseId },
      order: [
        ["decidedAt", "DESC"],
        ["id", "ASC"],
      ],
    });
    return rows.map((row) => toEntityWithIsoDates<ReleaseApprovalEntity>(row));
  }
}
