import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  KnowledgeLibraryRecordEntity,
  KnowledgeLibraryRecordRepository,
  UpdateKnowledgeLibraryRecordStatusResult,
} from "@webdesk/database";
import { KnowledgeLibraryRecordsService } from "./knowledge-library-records.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import used only as a mock's type cast.
import { UsersService } from "../users/users.service.js";

const NOW = "2026-09-01T00:00:00.000Z";

function record(
  overrides: Partial<KnowledgeLibraryRecordEntity> = {},
): KnowledgeLibraryRecordEntity {
  return {
    id: "record-1",
    title: "Reference doc",
    sourceType: "internal_wiki",
    location: "https://wiki.internal.example/page",
    ownerUserId: null,
    sourceDate: "2026-01-01",
    confidentiality: "public",
    approvedForAgentUse: false,
    status: "draft",
    notes: null,
    relatedEntityIds: [],
    version: 1,
    lastReviewedAt: null,
    createdBy: "user-1",
    updatedBy: "user-1",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("KnowledgeLibraryRecordsService", () => {
  let repository: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateStatus: ReturnType<typeof vi.fn>;
  };
  let usersService: { assertUserExists: ReturnType<typeof vi.fn> };
  let auditService: { record: ReturnType<typeof vi.fn> };
  let service: KnowledgeLibraryRecordsService;

  beforeEach(() => {
    repository = {
      create: vi.fn(),
      findById: vi.fn(),
      list: vi.fn(),
      update: vi.fn(),
      updateStatus: vi.fn(),
    };
    usersService = { assertUserExists: vi.fn() };
    auditService = { record: vi.fn() };
    service = new KnowledgeLibraryRecordsService(
      repository as unknown as KnowledgeLibraryRecordRepository,
      usersService as unknown as UsersService,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- AuditService constructor injection, mocked directly.
      auditService as any,
    );
  });

  describe("create", () => {
    it("delegates to the repository with the actor as createdBy, then records an audit event", async () => {
      repository.create.mockResolvedValue(record());
      const result = await service.create({ title: "Reference doc" }, "user-1");
      expect(repository.create).toHaveBeenCalledWith({
        title: "Reference doc",
        createdBy: "user-1",
      });
      expect(result).toEqual(record());
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "data_change",
          actorUserId: "user-1",
          entityType: "knowledge_library_record",
          entityId: "record-1",
          action: "create",
          retentionCategory: "audit-7y",
        }),
      );
    });

    it("existence-checks ownerUserId before creating when one is provided", async () => {
      usersService.assertUserExists.mockResolvedValue(undefined);
      repository.create.mockResolvedValue(record({ ownerUserId: "owner-1" }));

      await service.create({ title: "x", ownerUserId: "owner-1" }, "user-1");

      expect(usersService.assertUserExists).toHaveBeenCalledWith("owner-1", "ownerUserId");
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ ownerUserId: "owner-1" }),
      );
    });

    it("propagates a BadRequestException when ownerUserId does not resolve to an active user", async () => {
      usersService.assertUserExists.mockRejectedValue(
        new BadRequestException("ownerUserId does not resolve to an active user: bad-id"),
      );

      await expect(
        service.create({ title: "x", ownerUserId: "bad-id" }, "user-1"),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it("does not existence-check ownerUserId when none is provided", async () => {
      repository.create.mockResolvedValue(record());
      await service.create({ title: "x" }, "user-1");
      expect(usersService.assertUserExists).not.toHaveBeenCalled();
    });

    it("sanitizes notes before writing it, per the 2026-08-22 RichTextEditor standing rule", async () => {
      repository.create.mockResolvedValue(record());
      await service.create({ title: "x", notes: "<p>Safe</p><script>alert(1)</script>" }, "user-1");
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ notes: "<p>Safe</p>" }),
      );
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
      const result = await service.list({ status: "draft" });
      expect(repository.list).toHaveBeenCalledWith({ status: "draft" });
      expect(result).toEqual([record()]);
    });
  });

  describe("update", () => {
    it("passes the patch plus updatedBy to the repository, then records an audit event", async () => {
      repository.findById.mockResolvedValue(record({ status: "draft" }));
      repository.update.mockResolvedValue(record({ title: "New title" }));
      const result = await service.update("record-1", { title: "New title" }, "user-2");
      expect(repository.update).toHaveBeenCalledWith("record-1", {
        title: "New title",
        updatedBy: "user-2",
      });
      expect(result.title).toBe("New title");
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "data_change",
          actorUserId: "user-2",
          entityId: "record-1",
          action: "update",
          retentionCategory: "audit-7y",
        }),
      );
    });

    it("throws NotFoundException when the repository returns null, without recording an audit event", async () => {
      repository.update.mockResolvedValue(null);
      await expect(service.update("missing", { title: "x" }, "user-2")).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(auditService.record).not.toHaveBeenCalled();
    });

    it("re-validates a changed ownerUserId before writing", async () => {
      repository.findById.mockResolvedValue(record({ ownerUserId: "owner-1" }));
      usersService.assertUserExists.mockResolvedValue(undefined);
      repository.update.mockResolvedValue(record({ ownerUserId: "owner-2" }));

      await service.update("record-1", { ownerUserId: "owner-2" }, "user-2");

      expect(usersService.assertUserExists).toHaveBeenCalledWith("owner-2", "ownerUserId");
      expect(repository.update).toHaveBeenCalledWith("record-1", {
        ownerUserId: "owner-2",
        updatedBy: "user-2",
      });
    });

    it("does not re-validate ownerUserId when the patch resends the unchanged current value", async () => {
      repository.findById.mockResolvedValue(record({ ownerUserId: "owner-1" }));
      repository.update.mockResolvedValue(record({ ownerUserId: "owner-1" }));

      await service.update("record-1", { ownerUserId: "owner-1" }, "user-2");

      expect(usersService.assertUserExists).not.toHaveBeenCalled();
    });

    it("does not existence-check ownerUserId when the patch clears it to null", async () => {
      repository.findById.mockResolvedValue(record({ ownerUserId: "owner-1", status: "draft" }));
      repository.update.mockResolvedValue(record({ ownerUserId: null }));
      await service.update("record-1", { ownerUserId: null }, "user-2");
      expect(usersService.assertUserExists).not.toHaveBeenCalled();
    });

    it("rejects editing a deprecated (terminal) record", async () => {
      repository.findById.mockResolvedValue(record({ status: "deprecated" }));
      await expect(
        service.update("record-1", { title: "New title" }, "user-2"),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.update).not.toHaveBeenCalled();
      expect(auditService.record).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when re-validating ownerUserId against a record that has since disappeared", async () => {
      repository.findById.mockResolvedValue(null);
      await expect(
        service.update("missing", { ownerUserId: "owner-2" }, "user-2"),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(usersService.assertUserExists).not.toHaveBeenCalled();
    });

    it("sanitizes a changed notes value before writing it", async () => {
      repository.findById.mockResolvedValue(record({ notes: "<p>Old</p>" }));
      repository.update.mockResolvedValue(record({ notes: "<p>New</p>" }));
      await service.update("record-1", { notes: "<p>New</p><script>alert(1)</script>" }, "user-2");
      expect(repository.update).toHaveBeenCalledWith(
        "record-1",
        expect.objectContaining({ notes: "<p>New</p>" }),
      );
    });

    it("skips re-sanitizing notes when the patch resends the unchanged, already-sanitized value", async () => {
      repository.findById.mockResolvedValue(record({ notes: "<p>Unchanged</p>" }));
      repository.update.mockResolvedValue(record({ notes: "<p>Unchanged</p>" }));
      await service.update("record-1", { notes: "<p>Unchanged</p>" }, "user-2");
      expect(repository.update).toHaveBeenCalledWith(
        "record-1",
        expect.objectContaining({ notes: "<p>Unchanged</p>" }),
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

    it("allows mandatory -> draft directly", async () => {
      repository.findById.mockResolvedValue(record({ status: "mandatory" }));
      const updateResult: UpdateKnowledgeLibraryRecordStatusResult = {
        outcome: "updated",
        entity: record({ status: "draft" }),
      };
      repository.updateStatus.mockResolvedValue(updateResult);

      const result = await service.changeStatus("record-1", "draft", "user-2");

      expect(repository.updateStatus).toHaveBeenCalledWith(
        "record-1",
        "mandatory",
        "draft",
        "user-2",
      );
      expect(result.status).toBe("draft");
    });

    it("performs an allowed transition and records an 'approval' audit event with the approval retention category for mandatory/advisory", async () => {
      repository.findById.mockResolvedValue(record({ status: "draft" }));
      const updateResult: UpdateKnowledgeLibraryRecordStatusResult = {
        outcome: "updated",
        entity: record({ status: "mandatory" }),
      };
      repository.updateStatus.mockResolvedValue(updateResult);

      const result = await service.changeStatus("record-1", "mandatory", "user-2");

      expect(repository.updateStatus).toHaveBeenCalledWith(
        "record-1",
        "draft",
        "mandatory",
        "user-2",
      );
      expect(result.status).toBe("mandatory");
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "approval",
          action: "status:draft->mandatory",
          entityType: "knowledge_library_record",
          entityId: "record-1",
          retentionCategory: "approval-audit-7y",
        }),
      );
    });

    it("records a 'data_change' audit event with the plain audit retention category for a non-approval transition (e.g. to deprecated)", async () => {
      repository.findById.mockResolvedValue(record({ status: "mandatory" }));
      const updateResult: UpdateKnowledgeLibraryRecordStatusResult = {
        outcome: "updated",
        entity: record({ status: "deprecated" }),
      };
      repository.updateStatus.mockResolvedValue(updateResult);

      await service.changeStatus("record-1", "deprecated", "user-2");

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "data_change",
          action: "status:mandatory->deprecated",
          retentionCategory: "audit-7y",
        }),
      );
    });

    it("throws NotFoundException if the record disappears between findById and updateStatus", async () => {
      repository.findById.mockResolvedValue(record({ status: "draft" }));
      const updateResult: UpdateKnowledgeLibraryRecordStatusResult = { outcome: "not_found" };
      repository.updateStatus.mockResolvedValue(updateResult);
      await expect(service.changeStatus("record-1", "mandatory", "user-2")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("throws ConflictException (and records no audit event) when the status changed concurrently", async () => {
      repository.findById.mockResolvedValue(record({ status: "draft" }));
      const updateResult: UpdateKnowledgeLibraryRecordStatusResult = {
        outcome: "conflict",
        entity: record({ status: "deprecated" }),
      };
      repository.updateStatus.mockResolvedValue(updateResult);

      await expect(service.changeStatus("record-1", "mandatory", "user-2")).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(auditService.record).not.toHaveBeenCalled();
    });

    it("still returns the updated record even when recording its audit event fails", async () => {
      repository.findById.mockResolvedValue(record({ status: "draft" }));
      const updateResult: UpdateKnowledgeLibraryRecordStatusResult = {
        outcome: "updated",
        entity: record({ status: "mandatory" }),
      };
      repository.updateStatus.mockResolvedValue(updateResult);
      auditService.record.mockRejectedValue(new Error("audit store unavailable"));
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await service.changeStatus("record-1", "mandatory", "user-2");

      expect(result.status).toBe("mandatory");
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });
});
