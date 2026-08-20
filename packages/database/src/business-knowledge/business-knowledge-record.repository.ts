import { getBusinessKnowledgeModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type {
  BusinessKnowledgeRecordEntity,
  BusinessKnowledgeRecordStatus,
  BusinessKnowledgeRecordType,
} from "./entities.js";

export interface BusinessKnowledgeRecordListFilter {
  readonly recordType?: BusinessKnowledgeRecordType;
  readonly status?: BusinessKnowledgeRecordStatus;
}

/** No `projectId` scoping anywhere here — this module's records are organization-wide, not tied
 *  to a `projects` row (task package D3). */
export class BusinessKnowledgeRecordRepository {
  private readonly model = getBusinessKnowledgeModels().BusinessKnowledgeRecord;

  async create(input: {
    recordType: BusinessKnowledgeRecordType;
    title: string;
    content: string;
    notes?: string | null;
    createdBy?: string | null;
  }): Promise<BusinessKnowledgeRecordEntity> {
    const instance = await this.model.create({
      recordType: input.recordType,
      title: input.title,
      content: input.content,
      status: "draft",
      notes: input.notes ?? null,
      createdBy: input.createdBy ?? null,
      updatedBy: input.createdBy ?? null,
    });
    return toEntityWithIsoDates<BusinessKnowledgeRecordEntity>(instance);
  }

  async findById(id: string): Promise<BusinessKnowledgeRecordEntity | null> {
    const instance = await this.model.findOne({ where: { id } });
    return instance ? toEntityWithIsoDates<BusinessKnowledgeRecordEntity>(instance) : null;
  }

  async list(
    filter: BusinessKnowledgeRecordListFilter,
  ): Promise<readonly BusinessKnowledgeRecordEntity[]> {
    const where: Record<string, unknown> = {};
    if (filter.recordType) {
      where.recordType = filter.recordType;
    }
    if (filter.status) {
      where.status = filter.status;
    }
    const rows = await this.model.findAll({ where, order: [["createdAt", "ASC"]] });
    return rows.map((row) => toEntityWithIsoDates<BusinessKnowledgeRecordEntity>(row));
  }

  /** Content-only update — `status` is deliberately never accepted here (task package D4); only
   *  `updateStatus()` may change it. */
  async update(
    id: string,
    patch: Partial<{
      title: string;
      content: string;
      notes: string | null;
      updatedBy: string | null;
    }>,
  ): Promise<BusinessKnowledgeRecordEntity | null> {
    const instance = await this.model.findOne({ where: { id } });
    if (!instance) {
      return null;
    }
    await instance.update(patch);
    return toEntityWithIsoDates<BusinessKnowledgeRecordEntity>(instance);
  }

  async updateStatus(
    id: string,
    status: BusinessKnowledgeRecordStatus,
    updatedBy: string | null,
  ): Promise<BusinessKnowledgeRecordEntity | null> {
    const instance = await this.model.findOne({ where: { id } });
    if (!instance) {
      return null;
    }
    await instance.update({ status, updatedBy });
    return toEntityWithIsoDates<BusinessKnowledgeRecordEntity>(instance);
  }
}
