import type { Transaction } from "sequelize";
import { getCaseStudyStudioModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type {
  CaseStudyApprovalDecision,
  CaseStudyApprovalEntity,
  CaseStudyApprovalType,
} from "./entities.js";

export interface CreateCaseStudyApprovalInput {
  readonly caseStudyId: string;
  readonly approvalType: CaseStudyApprovalType;
  readonly decision: CaseStudyApprovalDecision;
  readonly decidedByUserId: string | null;
  readonly notes?: string | null;
  /** Defaults to `now()` at the database layer when omitted — a caller that already computed a
   *  single, shared timestamp for both this row and the parent `case_studies` status write passes
   *  it explicitly so both records agree exactly, mirroring
   *  `ReviewDecisionRepository.create()`'s own `decidedAt` precedent. */
  readonly decidedAt?: Date;
}

/** Append-only by application convention (like every other module's audit-adjacent table in this
 *  codebase, e.g. `ReviewDecisionRepository`) — no `update()`/`remove()` method exists here at
 *  all. This is Case Study Studio's own queryable local approval history, distinct from the real,
 *  DB-trigger-enforced `audit_events` table `AuditService` also writes to on every successful
 *  transition. */
export class CaseStudyApprovalRepository {
  private readonly model = getCaseStudyStudioModels().CaseStudyApproval;

  /** `transaction`, when supplied, lets the caller (`CaseStudiesService.changeStatus()`) commit
   *  this write atomically alongside the parent `case_studies` CAS status update, mirroring
   *  `ReviewDecisionRepository.create()`'s own identical `transaction` parameter — a transient
   *  failure here after the CAS write already committed would otherwise leave the case study's new
   *  status durably persisted with zero record of who decided it or why. */
  async create(
    input: CreateCaseStudyApprovalInput,
    transaction?: Transaction,
  ): Promise<CaseStudyApprovalEntity> {
    const instance = await this.model.create(
      {
        caseStudyId: input.caseStudyId,
        approvalType: input.approvalType,
        decision: input.decision,
        decidedByUserId: input.decidedByUserId,
        notes: input.notes ?? null,
        ...(input.decidedAt ? { decidedAt: input.decidedAt } : {}),
      },
      { transaction },
    );
    return toEntityWithIsoDates<CaseStudyApprovalEntity>(instance);
  }

  async listByCaseStudy(caseStudyId: string): Promise<readonly CaseStudyApprovalEntity[]> {
    const rows = await this.model.findAll({
      where: { caseStudyId },
      order: [
        ["decidedAt", "DESC"],
        ["id", "ASC"],
      ],
    });
    return rows.map((row) => toEntityWithIsoDates<CaseStudyApprovalEntity>(row));
  }
}
