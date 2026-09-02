import { getScanCenterModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type { ScanEvidenceEntity } from "./entities.js";

type ScanEvidenceContentFields = Omit<ScanEvidenceEntity, "id" | "createdAt" | "updatedAt">;

export interface ScanEvidenceListFilter {
  /** Required — evidence is always browsed within one finding. */
  readonly scanFindingId: string;
  readonly limit?: number;
  readonly offset?: number;
}

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

/** No `update()`/`delete()` — evidence is immutable once created (task-level D8, ADR-0016). */
export class ScanEvidenceRepository {
  private readonly model = getScanCenterModels().ScanEvidence;

  async create(
    input: Partial<ScanEvidenceContentFields> &
      Pick<ScanEvidenceContentFields, "projectId" | "publicId" | "scanFindingId">,
  ): Promise<ScanEvidenceEntity> {
    const instance = await this.model.create({
      projectId: input.projectId,
      publicId: input.publicId,
      scanFindingId: input.scanFindingId,
      evidenceType: input.evidenceType ?? null,
      reference: input.reference ?? null,
      notes: input.notes ?? null,
      capturedAt: input.capturedAt ?? null,
      createdBy: input.createdBy ?? null,
    });
    return toEntityWithIsoDates<ScanEvidenceEntity>(instance);
  }

  async findById(id: string): Promise<ScanEvidenceEntity | null> {
    const instance = await this.model.findByPk(id);
    return instance ? toEntityWithIsoDates<ScanEvidenceEntity>(instance) : null;
  }

  async list(filter: ScanEvidenceListFilter): Promise<readonly ScanEvidenceEntity[]> {
    const limit = Math.min(filter.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
    const rows = await this.model.findAll({
      where: { scanFindingId: filter.scanFindingId },
      order: [
        ["createdAt", "DESC"],
        ["id", "ASC"],
      ],
      limit,
      offset: filter.offset ?? 0,
    });
    return rows.map((row) => toEntityWithIsoDates<ScanEvidenceEntity>(row));
  }
}
