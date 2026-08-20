import { createHash } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  BusinessKnowledgeAttachmentEntity,
  BusinessKnowledgeAttachmentRepository,
} from "@webdesk/database";
import type { BlobStorageAdapter } from "@webdesk/integrations";
import {
  BLOB_STORAGE_ADAPTER,
  BUSINESS_KNOWLEDGE_ATTACHMENT_ALLOWED_MIME_TYPES,
  BUSINESS_KNOWLEDGE_ATTACHMENT_MAX_SIZE_BYTES,
  BUSINESS_KNOWLEDGE_ATTACHMENT_REPOSITORY,
} from "./business-knowledge.constants.js";
import { generateAttachmentPreviewHtml } from "./preview-generation.util.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { BusinessKnowledgeRecordsService } from "./business-knowledge-records.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuditService } from "../audit/audit.service.js";

function attachmentPathnamePrefix(recordId: string): string {
  return `business-knowledge/${recordId}/`;
}

export interface AttachmentContent {
  readonly attachment: BusinessKnowledgeAttachmentEntity;
  readonly body: Buffer;
  readonly contentType: string;
}

@Injectable()
export class BusinessKnowledgeAttachmentsService {
  constructor(
    @Inject(BUSINESS_KNOWLEDGE_ATTACHMENT_REPOSITORY)
    private readonly attachments: BusinessKnowledgeAttachmentRepository,
    @Inject(BLOB_STORAGE_ADAPTER) private readonly blob: BlobStorageAdapter,
    private readonly records: BusinessKnowledgeRecordsService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * The server half of Vercel Blob's direct-to-Blob client-upload protocol
   * (`@vercel/blob/client`'s `handleUpload()`, wrapped by `VercelBlobAdapter`). Real auth/format/
   * size enforcement happens here, in `onBeforeGenerateToken` — the only phase a real
   * authenticated browser call reaches. `onUploadCompleted` is intentionally a no-op: it's Vercel
   * Blob's own server-to-server completion webhook, called with no session cookie at all (this
   * route stays behind `SessionGuard`/`PermissionGuard` for the token-generation phase, so the
   * webhook phase simply 401s and Vercel retries a few times — harmless, since this app's real
   * "upload confirmed" signal is the client's own explicit call to `confirm()` below once its
   * `upload()` call resolves, not this webhook).
   */
  async handleUploadRoute(
    recordId: string,
    body: unknown,
    request: IncomingMessage,
  ): Promise<Record<string, unknown>> {
    await this.records.findById(recordId); // throws NotFoundException if missing
    return this.blob.handleClientUploadRequest({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith(attachmentPathnamePrefix(recordId))) {
          throw new Error(
            `Attachment pathname must be under ${attachmentPathnamePrefix(recordId)}`,
          );
        }
        return {
          allowedContentTypes: BUSINESS_KNOWLEDGE_ATTACHMENT_ALLOWED_MIME_TYPES,
          maximumSizeInBytes: BUSINESS_KNOWLEDGE_ATTACHMENT_MAX_SIZE_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ recordId }),
        };
      },
      onUploadCompleted: async () => {},
    });
  }

  /** Real confirmation: downloads the just-uploaded object, re-validates its actual content type
   *  and size (never trusting the client's own claims — `knowledge/08`'s server-side validation
   *  rule), computes a real checksum, generates a format-specific preview, and persists the
   *  attachment row. */
  async confirm(
    recordId: string,
    input: { pathname: string; filename: string },
    actorUserId: string,
  ): Promise<BusinessKnowledgeAttachmentEntity> {
    await this.records.findById(recordId);
    if (!input.pathname.startsWith(attachmentPathnamePrefix(recordId))) {
      throw new BadRequestException("Attachment pathname does not belong to this record");
    }

    const object = await this.blob.getObject(input.pathname);
    if (!object) {
      throw new BadRequestException(
        "Uploaded file not found in storage — the upload may have failed or expired",
      );
    }
    if (
      !(BUSINESS_KNOWLEDGE_ATTACHMENT_ALLOWED_MIME_TYPES as readonly string[]).includes(
        object.contentType,
      )
    ) {
      await this.blob.deleteObject(input.pathname);
      throw new BadRequestException(`Unsupported file type: ${object.contentType}`);
    }
    if (object.body.length > BUSINESS_KNOWLEDGE_ATTACHMENT_MAX_SIZE_BYTES) {
      await this.blob.deleteObject(input.pathname);
      throw new BadRequestException("File exceeds the maximum allowed size (25 MB)");
    }

    const checksumSha256 = createHash("sha256").update(object.body).digest("hex");
    const extractedPreviewHtml = await generateAttachmentPreviewHtml(
      object.contentType,
      object.body,
    );

    const created = await this.attachments.create({
      recordId,
      filename: input.filename,
      mimeType: object.contentType,
      sizeBytes: object.body.length,
      checksumSha256,
      blobPathname: input.pathname,
      extractedPreviewHtml,
      // knowledge/08's honesty rule — malware scanning is deferred project-wide; this status
      // never asserts the file is safe.
      scanStatus: "scan_not_configured",
      uploadedBy: actorUserId,
    });

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      entityType: "business_knowledge_attachment",
      entityId: created.id,
      action: "upload",
      afterState: {
        recordId,
        filename: created.filename,
        mimeType: created.mimeType,
        sizeBytes: created.sizeBytes,
      },
      retentionCategory: "audit-7y",
    });

    return created;
  }

  async list(recordId: string): Promise<readonly BusinessKnowledgeAttachmentEntity[]> {
    await this.records.findById(recordId);
    return this.attachments.listForRecord(recordId);
  }

  async getContent(recordId: string, attachmentId: string): Promise<AttachmentContent> {
    const attachment = await this.attachments.findByIdForRecord(attachmentId, recordId);
    if (!attachment) {
      throw new NotFoundException(`Attachment not found: ${attachmentId}`);
    }
    const object = await this.blob.getObject(attachment.blobPathname);
    if (!object) {
      throw new NotFoundException("This attachment's content is no longer available");
    }
    return { attachment, body: object.body, contentType: object.contentType };
  }

  async delete(recordId: string, attachmentId: string, actorUserId: string): Promise<void> {
    const attachment = await this.attachments.findByIdForRecord(attachmentId, recordId);
    if (!attachment) {
      throw new NotFoundException(`Attachment not found: ${attachmentId}`);
    }
    await this.blob.deleteObject(attachment.blobPathname);
    await this.attachments.deleteForRecord(attachmentId, recordId);
    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      entityType: "business_knowledge_attachment",
      entityId: attachmentId,
      action: "delete",
      beforeState: { recordId, filename: attachment.filename },
      retentionCategory: "audit-7y",
    });
  }
}
