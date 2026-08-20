import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  BusinessKnowledgeRecordEntity,
  BusinessKnowledgeRecordListFilter,
  BusinessKnowledgeRecordRepository,
  BusinessKnowledgeRecordStatus,
  BusinessKnowledgeRecordType,
} from "@webdesk/database";
import { BUSINESS_KNOWLEDGE_RECORD_REPOSITORY } from "./business-knowledge.constants.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuditService } from "../audit/audit.service.js";

/**
 * A status transition here is the only way `mandatory`/`advisory`/`restricted` is ever reached —
 * content authoring (`create`/`update`) can never set status directly (task package D4). `draft`
 * is where every new record starts; `deprecated` is terminal, matching `ProjectService`'s own
 * `archived`-is-terminal precedent (no hard delete, ADR-0016). `restricted` is treated as a
 * classification overlay reachable from, and reversible back to, either approved tier or draft —
 * this specific transition graph is a proposed design choice (task package D4), not spec-sourced;
 * flagged for review.
 */
const ALLOWED_TRANSITIONS: Readonly<
  Record<BusinessKnowledgeRecordStatus, readonly BusinessKnowledgeRecordStatus[]>
> = {
  draft: ["mandatory", "advisory", "restricted", "deprecated"],
  mandatory: ["advisory", "restricted", "deprecated"],
  advisory: ["mandatory", "restricted", "deprecated"],
  restricted: ["mandatory", "advisory", "draft", "deprecated"],
  deprecated: [],
};

@Injectable()
export class BusinessKnowledgeRecordsService {
  constructor(
    @Inject(BUSINESS_KNOWLEDGE_RECORD_REPOSITORY)
    private readonly records: BusinessKnowledgeRecordRepository,
    private readonly auditService: AuditService,
  ) {}

  async create(
    input: {
      recordType: BusinessKnowledgeRecordType;
      title: string;
      content: string;
      notes?: string | null;
    },
    actorUserId: string,
  ): Promise<BusinessKnowledgeRecordEntity> {
    return this.records.create({ ...input, createdBy: actorUserId });
  }

  async findById(id: string): Promise<BusinessKnowledgeRecordEntity> {
    const record = await this.records.findById(id);
    if (!record) {
      throw new NotFoundException(`Business knowledge record not found: ${id}`);
    }
    return record;
  }

  async list(
    filter: BusinessKnowledgeRecordListFilter,
  ): Promise<readonly BusinessKnowledgeRecordEntity[]> {
    return this.records.list(filter);
  }

  async update(
    id: string,
    patch: { title?: string; content?: string; notes?: string | null },
    actorUserId: string,
  ): Promise<BusinessKnowledgeRecordEntity> {
    const updated = await this.records.update(id, { ...patch, updatedBy: actorUserId });
    if (!updated) {
      throw new NotFoundException(`Business knowledge record not found: ${id}`);
    }
    return updated;
  }

  async changeStatus(
    id: string,
    nextStatus: BusinessKnowledgeRecordStatus,
    actorUserId: string,
  ): Promise<BusinessKnowledgeRecordEntity> {
    const record = await this.findById(id);
    if (record.status === nextStatus) {
      return record; // no-op, not an error — re-requesting the current status is harmless
    }
    if (!ALLOWED_TRANSITIONS[record.status].includes(nextStatus)) {
      throw new BadRequestException(
        `Invalid business knowledge record status transition: ${record.status} -> ${nextStatus}`,
      );
    }

    const updated = await this.records.updateStatus(id, nextStatus, actorUserId);
    if (!updated) {
      throw new NotFoundException(`Business knowledge record not found: ${id}`);
    }

    await this.auditService.record({
      eventType:
        nextStatus === "mandatory" || nextStatus === "advisory" ? "approval" : "data_change",
      actorUserId,
      actorType: "human",
      entityType: "business_knowledge_record",
      entityId: id,
      action: `status:${record.status}->${nextStatus}`,
      beforeState: { status: record.status },
      afterState: { status: nextStatus },
      retentionCategory: "audit-7y",
    });

    return updated;
  }
}
