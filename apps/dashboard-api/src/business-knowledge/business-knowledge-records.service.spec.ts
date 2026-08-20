import { BadRequestException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  BusinessKnowledgeRecordEntity,
  BusinessKnowledgeRecordRepository,
} from "@webdesk/database";
import { BusinessKnowledgeRecordsService } from "./business-knowledge-records.service.js";

const NOW = "2026-08-20T00:00:00.000Z";

function record(
  overrides: Partial<BusinessKnowledgeRecordEntity> = {},
): BusinessKnowledgeRecordEntity {
  return {
    id: "record-1",
    recordType: "vto",
    title: "VTO",
    content: "Content",
    status: "draft",
    notes: null,
    createdBy: "user-1",
    updatedBy: "user-1",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("BusinessKnowledgeRecordsService", () => {
  let repository: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateStatus: ReturnType<typeof vi.fn>;
  };
  let auditService: { record: ReturnType<typeof vi.fn> };
  let service: BusinessKnowledgeRecordsService;

  beforeEach(() => {
    repository = {
      create: vi.fn(),
      findById: vi.fn(),
      list: vi.fn(),
      update: vi.fn(),
      updateStatus: vi.fn(),
    };
    auditService = { record: vi.fn() };
    service = new BusinessKnowledgeRecordsService(
      repository as unknown as BusinessKnowledgeRecordRepository,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- AuditService constructor injection, mocked directly.
      auditService as any,
    );
  });

  describe("create", () => {
    it("delegates to the repository with the actor as createdBy", async () => {
      repository.create.mockResolvedValue(record());
      const result = await service.create(
        { recordType: "vto", title: "VTO", content: "Content" },
        "user-1",
      );
      expect(repository.create).toHaveBeenCalledWith({
        recordType: "vto",
        title: "VTO",
        content: "Content",
        createdBy: "user-1",
      });
      expect(result).toEqual(record());
    });
  });

  describe("findById", () => {
    it("returns the record when found", async () => {
      repository.findById.mockResolvedValue(record());
      await expect(service.findById("record-1")).resolves.toEqual(record());
    });

    it("throws NotFoundException when missing", async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.findById("missing")).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("list", () => {
    it("delegates the filter straight through", async () => {
      repository.list.mockResolvedValue([record()]);
      const result = await service.list({ recordType: "vto" });
      expect(repository.list).toHaveBeenCalledWith({ recordType: "vto" });
      expect(result).toEqual([record()]);
    });
  });

  describe("update", () => {
    it("passes the patch plus updatedBy to the repository", async () => {
      repository.update.mockResolvedValue(record({ title: "New title" }));
      const result = await service.update("record-1", { title: "New title" }, "user-2");
      expect(repository.update).toHaveBeenCalledWith("record-1", {
        title: "New title",
        updatedBy: "user-2",
      });
      expect(result.title).toBe("New title");
    });

    it("throws NotFoundException when the repository returns null", async () => {
      repository.update.mockResolvedValue(null);
      await expect(service.update("missing", { title: "x" }, "user-2")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe("changeStatus", () => {
    it("is a no-op returning the current record when the status is unchanged", async () => {
      repository.findById.mockResolvedValue(record({ status: "draft" }));
      const result = await service.changeStatus("record-1", "draft", "user-2");
      expect(result.status).toBe("draft");
      expect(repository.updateStatus).not.toHaveBeenCalled();
      expect(auditService.record).not.toHaveBeenCalled();
    });

    it("rejects a transition not in the allowed-transitions map", async () => {
      repository.findById.mockResolvedValue(record({ status: "deprecated" }));
      await expect(service.changeStatus("record-1", "mandatory", "user-2")).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(repository.updateStatus).not.toHaveBeenCalled();
    });

    it("performs an allowed transition and records an 'approval' audit event for mandatory/advisory", async () => {
      repository.findById.mockResolvedValue(record({ status: "draft" }));
      repository.updateStatus.mockResolvedValue(record({ status: "mandatory" }));

      const result = await service.changeStatus("record-1", "mandatory", "user-2");

      expect(repository.updateStatus).toHaveBeenCalledWith("record-1", "mandatory", "user-2");
      expect(result.status).toBe("mandatory");
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "approval",
          action: "status:draft->mandatory",
          entityType: "business_knowledge_record",
          entityId: "record-1",
        }),
      );
    });

    it("records a 'data_change' audit event for a non-approval transition (e.g. to deprecated)", async () => {
      repository.findById.mockResolvedValue(record({ status: "mandatory" }));
      repository.updateStatus.mockResolvedValue(record({ status: "deprecated" }));

      await service.changeStatus("record-1", "deprecated", "user-2");

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "data_change",
          action: "status:mandatory->deprecated",
        }),
      );
    });

    it("throws NotFoundException if the record disappears between findById and updateStatus", async () => {
      repository.findById.mockResolvedValue(record({ status: "draft" }));
      repository.updateStatus.mockResolvedValue(null);
      await expect(service.changeStatus("record-1", "mandatory", "user-2")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
