import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  BusinessKnowledgeRecordEntity,
  BusinessKnowledgeRecordListFilter,
  BusinessKnowledgeRecordRepository,
  BusinessKnowledgeRecordStatus,
  BusinessKnowledgeRecordType,
} from "@webdesk/database";
import { BUSINESS_KNOWLEDGE_RECORD_REPOSITORY } from "./business-knowledge.constants.js";
import { sanitizeRecordContentHtml } from "./sanitize-html.util.js";
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
  // Symmetric with `restricted`'s own reachability of `draft` below — an approved record can be
  // sent back to drafting just as directly as a restricted one can, not only via the detour of
  // first reclassifying it `restricted`.
  mandatory: ["advisory", "restricted", "draft", "deprecated"],
  advisory: ["mandatory", "restricted", "draft", "deprecated"],
  restricted: ["mandatory", "advisory", "draft", "deprecated"],
  deprecated: [],
};

/** `content` is optional at create time (task package: a record may be created empty, with the
 *  author's real intent being to attach a file right afterward) — sanitize only when a real value
 *  was actually sent, otherwise pass `null` straight through to the now-nullable column. */
function sanitizeContentOrNull(content: string | undefined): string | null {
  return content !== undefined ? sanitizeRecordContentHtml(content) : null;
}

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
      content?: string;
      notes?: string | null;
    },
    actorUserId: string,
  ): Promise<BusinessKnowledgeRecordEntity> {
    const created = await this.records.create({
      ...input,
      content: sanitizeContentOrNull(input.content),
      createdBy: actorUserId,
    });
    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      entityType: "business_knowledge_record",
      entityId: created.id,
      action: "create",
      afterState: { recordType: created.recordType, title: created.title, status: created.status },
      retentionCategory: "audit-7y",
    });
    return created;
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
    patch: { title?: string; content?: string | null; notes?: string | null },
    actorUserId: string,
  ): Promise<BusinessKnowledgeRecordEntity> {
    const updated = await this.records.update(id, {
      ...patch,
      // Three real, distinct states: `undefined` means "leave content unchanged" (the key is
      // omitted from the repository patch entirely, so Sequelize never touches the column);
      // `null` means "clear it" (the rich-text editor was emptied out, patch.content === null);
      // a real string is sanitized before being written. `patch.content` already only reaches
      // here when present, Object.assign-style, via `...patch`, so this must not accidentally
      // coerce every edit into an explicit content: null overwrite.
      ...(patch.content !== undefined
        ? { content: patch.content === null ? null : sanitizeRecordContentHtml(patch.content) }
        : {}),
      updatedBy: actorUserId,
    });
    if (!updated) {
      throw new NotFoundException(`Business knowledge record not found: ${id}`);
    }
    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      entityType: "business_knowledge_record",
      entityId: id,
      action: "update",
      afterState: { ...patch },
      retentionCategory: "audit-7y",
    });
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

    const result = await this.records.updateStatus(id, record.status, nextStatus, actorUserId);
    if (result.outcome === "not_found") {
      throw new NotFoundException(`Business knowledge record not found: ${id}`);
    }
    if (result.outcome === "conflict") {
      // Someone else changed this record's status between our read and our write — the write
      // never happened, so no audit event is recorded either. The caller re-reads and retries.
      throw new ConflictException(
        `Business knowledge record ${id} status changed concurrently ` +
          `(expected ${record.status}, now ${result.entity.status}) — reload and retry`,
      );
    }

    const isApproval = nextStatus === "mandatory" || nextStatus === "advisory";
    try {
      await this.auditService.record({
        eventType: isApproval ? "approval" : "data_change",
        actorUserId,
        actorType: "human",
        entityType: "business_knowledge_record",
        entityId: id,
        action: `status:${record.status}->${nextStatus}`,
        beforeState: { status: record.status },
        afterState: { status: nextStatus },
        // The status write above already committed by this point (no shared-transaction support
        // exists between AuditService and this repository — same non-atomic ordering already
        // accepted for ProjectService.changeStatus()'s identical pattern). A logged failure here
        // at least surfaces the gap instead of silently dropping it.
        retentionCategory: isApproval ? "approval-audit-7y" : "audit-7y",
      });
    } catch (error) {
      console.error(
        `Business knowledge record ${id} status transition ${record.status}->${nextStatus} ` +
          "committed, but recording its audit event failed:",
        error,
      );
    }

    return result.entity;
  }
}
