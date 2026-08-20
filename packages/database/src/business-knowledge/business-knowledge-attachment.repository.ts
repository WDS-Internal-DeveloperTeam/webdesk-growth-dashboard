import { getBusinessKnowledgeModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type {
  BusinessKnowledgeAttachmentEntity,
  BusinessKnowledgeAttachmentScanStatus,
} from "./entities.js";

/** No `record_id` scoping ambiguity here — every method that reads/writes a specific attachment
 *  also takes the owning `recordId` and matches on both, mirroring the Projects module's own
 *  sub-resource IDOR fix (`entity-mapping.ts`'s own history) — a caller authorized on one record
 *  must never be able to reach another record's attachment by guessing its id. */
export class BusinessKnowledgeAttachmentRepository {
  private readonly model = getBusinessKnowledgeModels().BusinessKnowledgeAttachment;

  async create(input: {
    recordId: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    checksumSha256: string;
    blobPathname: string;
    extractedPreviewHtml: string | null;
    scanStatus: BusinessKnowledgeAttachmentScanStatus;
    uploadedBy: string | null;
  }): Promise<BusinessKnowledgeAttachmentEntity> {
    const instance = await this.model.create({ ...input });
    return toEntityWithIsoDates<BusinessKnowledgeAttachmentEntity>(instance);
  }

  async listForRecord(recordId: string): Promise<readonly BusinessKnowledgeAttachmentEntity[]> {
    const rows = await this.model.findAll({
      where: { recordId },
      order: [["createdAt", "ASC"]],
    });
    return rows.map((row) => toEntityWithIsoDates<BusinessKnowledgeAttachmentEntity>(row));
  }

  async findByIdForRecord(
    id: string,
    recordId: string,
  ): Promise<BusinessKnowledgeAttachmentEntity | null> {
    const instance = await this.model.findOne({ where: { id, recordId } });
    return instance ? toEntityWithIsoDates<BusinessKnowledgeAttachmentEntity>(instance) : null;
  }

  /** Returns whether a row was actually removed — `false` means either the id doesn't exist or it
   *  belongs to a different record, both of which the caller treats identically (a clean 404, not
   *  a 500 or a false "success"). */
  async deleteForRecord(id: string, recordId: string): Promise<boolean> {
    const affectedCount = await this.model.destroy({ where: { id, recordId } });
    return affectedCount > 0;
  }
}
