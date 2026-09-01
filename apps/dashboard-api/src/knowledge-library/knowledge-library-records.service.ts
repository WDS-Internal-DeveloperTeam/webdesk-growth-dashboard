import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  KnowledgeLibraryRecordConfidentiality,
  KnowledgeLibraryRecordEntity,
  KnowledgeLibraryRecordListFilter,
  KnowledgeLibraryRecordRepository,
  KnowledgeLibraryRecordStatus,
} from "@webdesk/database";
import { KNOWLEDGE_LIBRARY_RECORD_REPOSITORY } from "./knowledge-library.constants.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuditService } from "../audit/audit.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { UsersService } from "../users/users.service.js";

/**
 * D3 — the lifecycle vocabulary: Business Knowledge Center's own 5-value vocabulary with
 * `restricted` removed, since confidentiality is now a real, separate field. `draft` is where
 * every new record starts; `deprecated` is terminal (no hard delete, ADR-0016). The status-change
 * route is gated on the `approve` action only (a static gate, not a dynamic per-transition check)
 * — mirroring `BusinessKnowledgeRecordsController`'s own already-reviewed, already-accepted shape
 * exactly, since both modules share the identical RBAC grant matrix.
 */
const ALLOWED_TRANSITIONS: Readonly<
  Record<KnowledgeLibraryRecordStatus, readonly KnowledgeLibraryRecordStatus[]>
> = {
  draft: ["mandatory", "advisory", "deprecated"],
  mandatory: ["advisory", "draft", "deprecated"],
  advisory: ["mandatory", "draft", "deprecated"],
  deprecated: [],
};

export interface CreateKnowledgeLibraryRecordInput {
  readonly title: string;
  readonly sourceType?: string | null;
  readonly location?: string | null;
  readonly ownerUserId?: string | null;
  readonly sourceDate?: string | null;
  readonly confidentiality?: KnowledgeLibraryRecordConfidentiality;
  readonly approvedForAgentUse?: boolean;
  readonly notes?: string | null;
  readonly relatedEntityIds?: readonly string[] | null;
  readonly lastReviewedAt?: string | null;
}

export type UpdateKnowledgeLibraryRecordInput = Partial<CreateKnowledgeLibraryRecordInput>;

@Injectable()
export class KnowledgeLibraryRecordsService {
  constructor(
    @Inject(KNOWLEDGE_LIBRARY_RECORD_REPOSITORY)
    private readonly records: KnowledgeLibraryRecordRepository,
    private readonly usersService: UsersService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    input: CreateKnowledgeLibraryRecordInput,
    actorUserId: string,
  ): Promise<KnowledgeLibraryRecordEntity> {
    if (input.ownerUserId) {
      await this.usersService.assertUserExists(input.ownerUserId, "ownerUserId");
    }
    const created = await this.records.create({ ...input, createdBy: actorUserId });
    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      entityType: "knowledge_library_record",
      entityId: created.id,
      action: "create",
      afterState: {
        title: created.title,
        status: created.status,
        confidentiality: created.confidentiality,
      },
      retentionCategory: "audit-7y",
    });
    return created;
  }

  async findById(id: string): Promise<KnowledgeLibraryRecordEntity> {
    const record = await this.records.findById(id);
    if (!record) {
      throw new NotFoundException(`Knowledge library record not found: ${id}`);
    }
    return record;
  }

  async list(
    filter: KnowledgeLibraryRecordListFilter,
  ): Promise<readonly KnowledgeLibraryRecordEntity[]> {
    return this.records.list(filter);
  }

  async update(
    id: string,
    patch: UpdateKnowledgeLibraryRecordInput,
    actorUserId: string,
  ): Promise<KnowledgeLibraryRecordEntity> {
    // Only re-validate ownerUserId when the patch actually sets it to a real, different id —
    // clearing it to null/undefined (leave-unchanged) never needs a lookup (mirrors
    // ProjectService.update()'s own already-reviewed pattern).
    if (patch.ownerUserId) {
      const current = await this.records.findById(id);
      if (!current) {
        throw new NotFoundException(`Knowledge library record not found: ${id}`);
      }
      if (patch.ownerUserId !== current.ownerUserId) {
        await this.usersService.assertUserExists(patch.ownerUserId, "ownerUserId");
      }
    }

    const updated = await this.records.update(id, { ...patch, updatedBy: actorUserId });
    if (!updated) {
      throw new NotFoundException(`Knowledge library record not found: ${id}`);
    }
    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      entityType: "knowledge_library_record",
      entityId: id,
      action: "update",
      afterState: { ...patch },
      retentionCategory: "audit-7y",
    });
    return updated;
  }

  async changeStatus(
    id: string,
    nextStatus: KnowledgeLibraryRecordStatus,
    actorUserId: string,
  ): Promise<KnowledgeLibraryRecordEntity> {
    const record = await this.findById(id);
    if (record.status === nextStatus) {
      return record; // no-op, not an error — re-requesting the current status is harmless
    }
    if (!ALLOWED_TRANSITIONS[record.status].includes(nextStatus)) {
      throw new BadRequestException(
        `Invalid knowledge library record status transition: ${record.status} -> ${nextStatus}`,
      );
    }

    const result = await this.records.updateStatus(id, record.status, nextStatus, actorUserId);
    if (result.outcome === "not_found") {
      throw new NotFoundException(`Knowledge library record not found: ${id}`);
    }
    if (result.outcome === "conflict") {
      throw new ConflictException(
        `Knowledge library record ${id} status changed concurrently ` +
          `(expected ${record.status}, now ${result.entity.status}) — reload and retry`,
      );
    }

    const isApproval = nextStatus === "mandatory" || nextStatus === "advisory";
    try {
      await this.auditService.record({
        eventType: isApproval ? "approval" : "data_change",
        actorUserId,
        actorType: "human",
        entityType: "knowledge_library_record",
        entityId: id,
        action: `status:${record.status}->${nextStatus}`,
        beforeState: { status: record.status },
        afterState: { status: nextStatus },
        retentionCategory: isApproval ? "approval-audit-7y" : "audit-7y",
      });
    } catch (error) {
      console.error(
        `Knowledge library record ${id} status transition ${record.status}->${nextStatus} ` +
          "committed, but recording its audit event failed:",
        error,
      );
    }

    return result.entity;
  }
}
