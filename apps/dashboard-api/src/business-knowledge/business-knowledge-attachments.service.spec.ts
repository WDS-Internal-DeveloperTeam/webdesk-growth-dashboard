import { createHash } from "node:crypto";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BusinessKnowledgeAttachmentEntity } from "@webdesk/database";
import { BusinessKnowledgeAttachmentsService } from "./business-knowledge-attachments.service.js";

vi.mock("./preview-generation.util.js", () => ({
  generateAttachmentPreviewHtml: vi.fn().mockResolvedValue("<p>preview</p>"),
}));

const RECORD_ID = "record-1";

function attachment(
  overrides: Partial<BusinessKnowledgeAttachmentEntity> = {},
): BusinessKnowledgeAttachmentEntity {
  return {
    id: "attachment-1",
    recordId: RECORD_ID,
    filename: "report.pdf",
    mimeType: "application/pdf",
    sizeBytes: 100,
    checksumSha256: "x".repeat(64),
    blobPathname: `business-knowledge/${RECORD_ID}/report.pdf`,
    extractedPreviewHtml: null,
    scanStatus: "scan_not_configured",
    uploadedBy: "user-1",
    createdAt: "2026-08-20T00:00:00.000Z",
    ...overrides,
  };
}

describe("BusinessKnowledgeAttachmentsService", () => {
  let attachmentsRepo: {
    create: ReturnType<typeof vi.fn>;
    listForRecord: ReturnType<typeof vi.fn>;
    findByIdForRecord: ReturnType<typeof vi.fn>;
    deleteForRecord: ReturnType<typeof vi.fn>;
  };
  let blob: {
    handleClientUploadRequest: ReturnType<typeof vi.fn>;
    getObject: ReturnType<typeof vi.fn>;
    deleteObject: ReturnType<typeof vi.fn>;
  };
  let records: { findById: ReturnType<typeof vi.fn> };
  let auditService: { record: ReturnType<typeof vi.fn> };
  let service: BusinessKnowledgeAttachmentsService;

  beforeEach(() => {
    attachmentsRepo = {
      create: vi.fn(),
      listForRecord: vi.fn(),
      findByIdForRecord: vi.fn(),
      deleteForRecord: vi.fn(),
    };
    blob = {
      handleClientUploadRequest: vi.fn(),
      getObject: vi.fn(),
      deleteObject: vi.fn(),
    };
    records = { findById: vi.fn().mockResolvedValue({ id: RECORD_ID, status: "draft" }) };
    auditService = { record: vi.fn() };
    service = new BusinessKnowledgeAttachmentsService(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- repository/adapter constructor injection, mocked directly.
      attachmentsRepo as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      blob as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      records as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      auditService as any,
    );
  });

  describe("handleUploadRoute", () => {
    it("throws NotFoundException when the record doesn't exist, without calling the adapter", async () => {
      records.findById.mockRejectedValue(new NotFoundException("not found"));
      await expect(service.handleUploadRoute(RECORD_ID, {}, {} as never)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(blob.handleClientUploadRequest).not.toHaveBeenCalled();
    });

    it("delegates to the adapter, and onBeforeGenerateToken rejects a pathname outside this record's own prefix", async () => {
      blob.handleClientUploadRequest.mockImplementation(async (input) => {
        await expect(
          input.onBeforeGenerateToken("business-knowledge/OTHER-RECORD/x.pdf", null),
        ).rejects.toThrow(/must be under/);
        return { type: "blob.generate-client-token" };
      });

      await service.handleUploadRoute(
        RECORD_ID,
        { type: "blob.generate-client-token" },
        {} as never,
      );
      expect(blob.handleClientUploadRequest).toHaveBeenCalledTimes(1);
    });

    it("onBeforeGenerateToken returns the real format/size allowlist for a correctly-prefixed pathname", async () => {
      let authorization: unknown;
      blob.handleClientUploadRequest.mockImplementation(async (input) => {
        authorization = await input.onBeforeGenerateToken(
          `business-knowledge/${RECORD_ID}/report.pdf`,
          null,
        );
        return { type: "blob.generate-client-token" };
      });

      await service.handleUploadRoute(RECORD_ID, {}, {} as never);

      expect(authorization).toEqual(
        expect.objectContaining({
          allowedContentTypes: expect.arrayContaining(["application/pdf"]),
          maximumSizeInBytes: 25 * 1024 * 1024,
          addRandomSuffix: true,
        }),
      );
    });

    it("onUploadCompleted is a true no-op — never touches the repository or audit service", async () => {
      blob.handleClientUploadRequest.mockImplementation(async (input) => {
        await input.onUploadCompleted({
          blob: { url: "x", pathname: "y", contentType: "application/pdf" },
          tokenPayload: null,
        });
        return { type: "blob.upload-completed", response: "ok" };
      });

      await service.handleUploadRoute(RECORD_ID, {}, {} as never);

      expect(attachmentsRepo.create).not.toHaveBeenCalled();
      expect(auditService.record).not.toHaveBeenCalled();
    });
  });

  describe("confirm", () => {
    const PATHNAME = `business-knowledge/${RECORD_ID}/report.pdf`;

    it("rejects a pathname that doesn't belong to this record", async () => {
      await expect(
        service.confirm(
          RECORD_ID,
          { pathname: "business-knowledge/OTHER/report.pdf", filename: "report.pdf" },
          "user-1",
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(blob.getObject).not.toHaveBeenCalled();
    });

    it("rejects when the uploaded object can't be found in storage", async () => {
      blob.getObject.mockResolvedValue(null);
      await expect(
        service.confirm(RECORD_ID, { pathname: PATHNAME, filename: "report.pdf" }, "user-1"),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("deletes the object and rejects when its real content type isn't in the allowlist — defense-in-depth beyond the token-level restriction", async () => {
      blob.getObject.mockResolvedValue({
        body: Buffer.from("x"),
        contentType: "application/zip",
      });
      await expect(
        service.confirm(RECORD_ID, { pathname: PATHNAME, filename: "report.zip" }, "user-1"),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(blob.deleteObject).toHaveBeenCalledWith(PATHNAME);
      expect(attachmentsRepo.create).not.toHaveBeenCalled();
    });

    it("deletes the object and rejects when it exceeds the real size ceiling — never trusts a client-declared size", async () => {
      blob.getObject.mockResolvedValue({
        body: Buffer.alloc(26 * 1024 * 1024),
        contentType: "application/pdf",
      });
      await expect(
        service.confirm(RECORD_ID, { pathname: PATHNAME, filename: "report.pdf" }, "user-1"),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(blob.deleteObject).toHaveBeenCalledWith(PATHNAME);
    });

    it("computes a real checksum, generates a preview, persists the attachment, and records an audit event", async () => {
      const body = Buffer.from("real pdf bytes");
      blob.getObject.mockResolvedValue({ body, contentType: "application/pdf" });
      attachmentsRepo.create.mockResolvedValue(attachment());

      const result = await service.confirm(
        RECORD_ID,
        { pathname: PATHNAME, filename: "report.pdf" },
        "user-1",
      );

      const expectedChecksum = createHash("sha256").update(body).digest("hex");
      expect(attachmentsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recordId: RECORD_ID,
          filename: "report.pdf",
          mimeType: "application/pdf",
          sizeBytes: body.length,
          checksumSha256: expectedChecksum,
          blobPathname: PATHNAME,
          scanStatus: "scan_not_configured",
          uploadedBy: "user-1",
        }),
      );
      expect(result).toEqual(attachment());
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "upload", entityType: "business_knowledge_attachment" }),
      );
    });
  });

  describe("list", () => {
    it("throws NotFoundException when the record doesn't exist", async () => {
      records.findById.mockRejectedValue(new NotFoundException("not found"));
      await expect(service.list(RECORD_ID)).rejects.toBeInstanceOf(NotFoundException);
    });

    it("returns the repository's list for an existing record", async () => {
      attachmentsRepo.listForRecord.mockResolvedValue([attachment()]);
      await expect(service.list(RECORD_ID)).resolves.toEqual([attachment()]);
    });
  });

  describe("getContent", () => {
    it("throws NotFoundException when the attachment doesn't exist for this record", async () => {
      attachmentsRepo.findByIdForRecord.mockResolvedValue(null);
      await expect(service.getContent(RECORD_ID, "missing")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("throws NotFoundException when the row exists but the Blob object is gone", async () => {
      attachmentsRepo.findByIdForRecord.mockResolvedValue(attachment());
      blob.getObject.mockResolvedValue(null);
      await expect(service.getContent(RECORD_ID, "attachment-1")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("returns the attachment metadata plus the real object bytes/contentType", async () => {
      attachmentsRepo.findByIdForRecord.mockResolvedValue(attachment());
      blob.getObject.mockResolvedValue({
        body: Buffer.from("bytes"),
        contentType: "application/pdf",
      });
      const result = await service.getContent(RECORD_ID, "attachment-1");
      expect(result.attachment).toEqual(attachment());
      expect(result.body.toString()).toBe("bytes");
      expect(result.contentType).toBe("application/pdf");
    });
  });

  describe("delete", () => {
    it("throws NotFoundException without touching storage when the attachment doesn't exist", async () => {
      attachmentsRepo.findByIdForRecord.mockResolvedValue(null);
      await expect(service.delete(RECORD_ID, "missing", "user-1")).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(blob.deleteObject).not.toHaveBeenCalled();
    });

    it("deletes the Blob object, the row, and records an audit event", async () => {
      attachmentsRepo.findByIdForRecord.mockResolvedValue(attachment());
      await service.delete(RECORD_ID, "attachment-1", "user-1");
      expect(blob.deleteObject).toHaveBeenCalledWith(attachment().blobPathname);
      expect(attachmentsRepo.deleteForRecord).toHaveBeenCalledWith("attachment-1", RECORD_ID);
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "delete", entityType: "business_knowledge_attachment" }),
      );
    });
  });
});
