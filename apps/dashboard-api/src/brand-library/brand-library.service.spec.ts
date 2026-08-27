import type { BrandLibraryRecordEntity, BrandLibraryRecordRepository } from "@webdesk/database";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditService } from "../audit/audit.service.js";
import type { AuthorizationService } from "../authz/authorization.service.js";
import { BrandLibraryService } from "./brand-library.service.js";

const NOW = new Date("2026-08-27T00:00:00.000Z");

/** A stand-in for Sequelize's real `UniqueConstraintError` — checked by `.name` in
 *  `BrandLibraryService.create()` rather than `instanceof`, since `dashboard-api` never imports
 *  `sequelize` directly (only `packages/database` may). */
function uniqueConstraintError(): Error {
  const error = new Error("Validation error");
  error.name = "SequelizeUniqueConstraintError";
  return error;
}

function record(overrides: Partial<BrandLibraryRecordEntity> = {}): BrandLibraryRecordEntity {
  return {
    id: "record-1",
    publicId: "BRAND-LOGO-PRIMARY",
    recordType: "logo",
    title: "Primary Logo",
    description: null,
    fileReference: null,
    usageNotes: null,
    approvalStatus: "draft",
    version: 1,
    isPublished: false,
    publishedAt: null,
    createdBy: "actor-1",
    updatedBy: "actor-1",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("BrandLibraryService", () => {
  let records: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findByPublicId: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateApprovalStatus: ReturnType<typeof vi.fn>;
    updatePublishState: ReturnType<typeof vi.fn>;
  };
  let authorizationService: { assertAllowed: ReturnType<typeof vi.fn> };
  let auditService: { record: ReturnType<typeof vi.fn> };
  let svc: BrandLibraryService;

  beforeEach(() => {
    records = {
      create: vi.fn(),
      findById: vi.fn(),
      findByPublicId: vi.fn(),
      list: vi.fn(),
      update: vi.fn(),
      updateApprovalStatus: vi.fn(),
      updatePublishState: vi.fn(),
    };
    authorizationService = { assertAllowed: vi.fn() };
    auditService = { record: vi.fn() };
    svc = new BrandLibraryService(
      records as unknown as BrandLibraryRecordRepository,
      authorizationService as unknown as AuthorizationService,
      auditService as unknown as AuditService,
    );
  });

  describe("create", () => {
    it("creates a brand library record after validating the publicId is free", async () => {
      records.findByPublicId.mockResolvedValue(null);
      records.create.mockResolvedValue(record());

      const result = await svc.create(
        { publicId: "BRAND-LOGO-PRIMARY", recordType: "logo", title: "Primary Logo" },
        "actor-1",
      );

      expect(result).toEqual(record());
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "create", entityType: "brand_library_record" }),
      );
    });

    it("rejects a duplicate publicId", async () => {
      records.findByPublicId.mockResolvedValue(record());

      await expect(
        svc.create({ publicId: "BRAND-LOGO-PRIMARY", recordType: "logo", title: "X" }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
      expect(records.create).not.toHaveBeenCalled();
    });

    it("sanitizes rich-text fields before writing, stripping a disallowed tag", async () => {
      records.findByPublicId.mockResolvedValue(null);
      records.create.mockResolvedValue(record());

      await svc.create(
        {
          publicId: "BRAND-X",
          recordType: "tone",
          title: "X",
          description: "<script>alert(1)</script><p>Confident, direct</p>",
          usageNotes: null,
        },
        "actor-1",
      );

      const [writtenInput] = records.create.mock.calls[0] as [Record<string, unknown>];
      expect(writtenInput.description).toBe("<p>Confident, direct</p>");
      expect(writtenInput.usageNotes).toBeNull();
    });

    it("translates a concurrent publicId collision into a clean 400, not a raw 500", async () => {
      records.findByPublicId.mockResolvedValue(null);
      records.create.mockRejectedValue(uniqueConstraintError());

      await expect(
        svc.create({ publicId: "BRAND-RACE", recordType: "logo", title: "X" }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("re-throws a non-uniqueness error from create() unchanged", async () => {
      records.findByPublicId.mockResolvedValue(null);
      const dbError = new Error("connection reset");
      records.create.mockRejectedValue(dbError);

      await expect(
        svc.create({ publicId: "BRAND-X", recordType: "logo", title: "X" }, "actor-1"),
      ).rejects.toBe(dbError);
    });
  });

  describe("findById", () => {
    it("throws NotFoundException when the record does not exist", async () => {
      records.findById.mockResolvedValue(null);
      await expect(svc.findById("missing")).rejects.toThrow(NotFoundException);
    });

    it("returns the record when it exists", async () => {
      records.findById.mockResolvedValue(record());
      await expect(svc.findById("record-1")).resolves.toEqual(record());
    });
  });

  describe("list", () => {
    it("delegates the filter straight through to the repository", async () => {
      records.list.mockResolvedValue([record()]);
      const result = await svc.list({ approvalStatus: "draft" });
      expect(records.list).toHaveBeenCalledWith({ approvalStatus: "draft" });
      expect(result).toEqual([record()]);
    });
  });

  describe("update", () => {
    it("throws NotFoundException when the record doesn't exist", async () => {
      records.findById.mockResolvedValue(null);

      await expect(svc.update("missing", { title: "New" }, "actor-1")).rejects.toThrow(
        NotFoundException,
      );
      expect(records.update).not.toHaveBeenCalled();
    });

    it.each(["archived", "superseded"] as const)(
      "rejects with a clean 400 when the record is %s (terminal, no code path resurrects it)",
      async (approvalStatus) => {
        records.findById.mockResolvedValue(record({ approvalStatus }));

        await expect(svc.update("record-1", { title: "New" }, "actor-1")).rejects.toThrow(
          BadRequestException,
        );
        expect(records.update).not.toHaveBeenCalled();
      },
    );

    it("throws ConflictException when the CAS write finds 0 affected rows but the row still exists", async () => {
      records.findById
        .mockResolvedValueOnce(record({ approvalStatus: "draft" }))
        .mockResolvedValueOnce(record({ approvalStatus: "submitted" }));
      records.update.mockResolvedValue(null);

      await expect(svc.update("record-1", { title: "New" }, "actor-1")).rejects.toThrow(
        ConflictException,
      );
    });

    it("passes the current approvalStatus as a CAS guard to the repository", async () => {
      records.findById.mockResolvedValue(record({ approvalStatus: "draft" }));
      records.update.mockResolvedValue(record({ title: "Renamed", version: 2 }));

      await svc.update("record-1", { title: "Renamed" }, "actor-1");

      expect(records.update).toHaveBeenCalledWith(
        "record-1",
        expect.objectContaining({ title: "Renamed", updatedBy: "actor-1" }),
        "draft",
      );
    });

    it("sanitizes rich-text fields before writing, stripping a disallowed tag", async () => {
      records.findById.mockResolvedValue(record({ approvalStatus: "draft" }));
      records.update.mockResolvedValue(record());

      await svc.update(
        "record-1",
        { usageNotes: "<script>alert(1)</script><p>Use on white backgrounds only</p>" },
        "actor-1",
      );

      const [, writtenPatch] = records.update.mock.calls[0] as [string, Record<string, unknown>];
      expect(writtenPatch.usageNotes).toBe("<p>Use on white backgrounds only</p>");
    });

    it("skips re-sanitizing a rich-text field the patch resends unchanged from the current stored value", async () => {
      const dirtyButUnchanged = "<p>Text</p><script>still-there-if-skipped</script>";
      records.findById.mockResolvedValue(
        record({ approvalStatus: "draft", description: dirtyButUnchanged }),
      );
      records.update.mockResolvedValue(record());

      await svc.update("record-1", { description: dirtyButUnchanged }, "actor-1");

      const [, writtenPatch] = records.update.mock.calls[0] as [string, Record<string, unknown>];
      expect(writtenPatch.description).toBe(dirtyButUnchanged);
    });

    it("never accepts approvalStatus/version/isPublished/publishedAt/recordType through the general update patch", async () => {
      records.findById.mockResolvedValue(record({ approvalStatus: "draft" }));
      records.update.mockResolvedValue(record({ title: "Renamed", version: 2 }));

      await svc.update("record-1", { title: "Renamed" }, "actor-1");

      const [, patchArg] = records.update.mock.calls[0] as [string, Record<string, unknown>];
      expect(patchArg).not.toHaveProperty("approvalStatus");
      expect(patchArg).not.toHaveProperty("version");
      expect(patchArg).not.toHaveProperty("isPublished");
      expect(patchArg).not.toHaveProperty("publishedAt");
      expect(patchArg).not.toHaveProperty("recordType");
    });

    it("returns the repository's updated entity, with version incremented server-side", async () => {
      records.findById.mockResolvedValue(record({ approvalStatus: "draft" }));
      records.update.mockResolvedValue(record({ title: "Renamed", version: 4 }));

      const result = await svc.update("record-1", { title: "Renamed" }, "actor-1");

      expect(result.version).toBe(4);
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "update", entityType: "brand_library_record" }),
      );
    });
  });

  describe("changeApprovalStatus", () => {
    it("is a no-op returning the current entity when the requested status matches the current one", async () => {
      records.findById.mockResolvedValue(record({ approvalStatus: "draft" }));
      const result = await svc.changeApprovalStatus("record-1", "draft", "actor-1");
      expect(result.approvalStatus).toBe("draft");
      expect(authorizationService.assertAllowed).not.toHaveBeenCalled();
    });

    it("does not increment version on a status transition", async () => {
      records.findById.mockResolvedValue(record({ approvalStatus: "draft", version: 5 }));
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      records.updateApprovalStatus.mockResolvedValue({
        outcome: "updated",
        entity: record({ approvalStatus: "submitted", version: 5 }),
      });

      const result = await svc.changeApprovalStatus("record-1", "submitted", "actor-1");
      expect(result.version).toBe(5);
    });

    it("rejects a transition not in the allowlist", async () => {
      records.findById.mockResolvedValue(record({ approvalStatus: "draft" }));
      await expect(svc.changeApprovalStatus("record-1", "approved", "actor-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it.each([
      ["draft", "submitted", "submit"],
      ["submitted", "under_review", "review"],
      ["under_review", "approved", "approve"],
      ["under_review", "revision_requested", "review"],
      ["under_review", "rejected", "approve"],
      ["approved", "superseded", "approve"],
      ["draft", "archived", "approve"],
    ] as const)("requires the '%s -> %s' transition's '%s' action", async (from, to, action) => {
      records.findById.mockResolvedValue(record({ approvalStatus: from }));
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      records.updateApprovalStatus.mockResolvedValue({
        outcome: "updated",
        entity: record({ approvalStatus: to }),
      });

      await svc.changeApprovalStatus("record-1", to, "actor-1");

      expect(authorizationService.assertAllowed).toHaveBeenCalledWith(
        "actor-1",
        "creative_design",
        action,
      );
    });

    it("rejects every transition out of the terminal 'archived'/'superseded' states", async () => {
      records.findById.mockResolvedValueOnce(record({ approvalStatus: "archived" }));
      await expect(svc.changeApprovalStatus("record-1", "draft", "actor-1")).rejects.toThrow(
        BadRequestException,
      );

      records.findById.mockResolvedValueOnce(record({ approvalStatus: "superseded" }));
      await expect(svc.changeApprovalStatus("record-1", "draft", "actor-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("propagates a denial from assertAllowed and never attempts the status write", async () => {
      records.findById.mockResolvedValue(record({ approvalStatus: "under_review" }));
      authorizationService.assertAllowed.mockRejectedValue(
        new ForbiddenException("Missing permission: creative_design:approve"),
      );

      await expect(svc.changeApprovalStatus("record-1", "approved", "actor-1")).rejects.toThrow(
        ForbiddenException,
      );
      expect(records.updateApprovalStatus).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when the atomic status write reports not_found", async () => {
      records.findById.mockResolvedValue(record({ approvalStatus: "draft" }));
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      records.updateApprovalStatus.mockResolvedValue({ outcome: "not_found" });

      await expect(svc.changeApprovalStatus("record-1", "submitted", "actor-1")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws ConflictException when the atomic status write loses a race", async () => {
      records.findById.mockResolvedValue(record({ approvalStatus: "draft" }));
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      records.updateApprovalStatus.mockResolvedValue({
        outcome: "conflict",
        entity: record({ approvalStatus: "archived" }),
      });

      await expect(svc.changeApprovalStatus("record-1", "submitted", "actor-1")).rejects.toThrow(
        ConflictException,
      );
    });

    it("logs (not throws) when the audit call fails after a successful status write", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      records.findById.mockResolvedValue(record({ approvalStatus: "draft" }));
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      records.updateApprovalStatus.mockResolvedValue({
        outcome: "updated",
        entity: record({ approvalStatus: "submitted" }),
      });
      auditService.record.mockRejectedValue(new Error("audit down"));

      const result = await svc.changeApprovalStatus("record-1", "submitted", "actor-1");

      expect(result.approvalStatus).toBe("submitted");
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe("publish", () => {
    it("rejects with a clean 400 when the record is not approved, before checking authorization", async () => {
      records.findById.mockResolvedValue(record({ approvalStatus: "draft" }));

      await expect(svc.publish("record-1", "actor-1")).rejects.toThrow(BadRequestException);
      expect(authorizationService.assertAllowed).not.toHaveBeenCalled();
      expect(records.updatePublishState).not.toHaveBeenCalled();
    });

    it("publishes an approved record, checking the 'publish' action", async () => {
      records.findById.mockResolvedValue(
        record({ approvalStatus: "approved", isPublished: false }),
      );
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      records.updatePublishState.mockResolvedValue({
        outcome: "updated",
        entity: record({
          approvalStatus: "approved",
          isPublished: true,
          publishedAt: NOW.toISOString(),
        }),
      });

      const result = await svc.publish("record-1", "actor-1");

      expect(authorizationService.assertAllowed).toHaveBeenCalledWith(
        "actor-1",
        "creative_design",
        "publish",
      );
      expect(records.updatePublishState).toHaveBeenCalledWith(
        "record-1",
        false,
        true,
        "actor-1",
        "approved",
      );
      expect(result.isPublished).toBe(true);
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "publish", action: "publish" }),
      );
    });

    it("passes the current approvalStatus as a CAS guard, closing the concurrent-status-change race", async () => {
      records.findById.mockResolvedValue(
        record({ approvalStatus: "approved", isPublished: false }),
      );
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      records.updatePublishState.mockResolvedValue({
        outcome: "conflict",
        entity: record({ approvalStatus: "archived", isPublished: false }),
      });

      await expect(svc.publish("record-1", "actor-1")).rejects.toThrow(ConflictException);
      expect(records.updatePublishState).toHaveBeenCalledWith(
        "record-1",
        false,
        true,
        "actor-1",
        "approved",
      );
    });

    it("propagates a denial from assertAllowed and never attempts the CAS write", async () => {
      records.findById.mockResolvedValue(record({ approvalStatus: "approved" }));
      authorizationService.assertAllowed.mockRejectedValue(
        new ForbiddenException("Missing permission: creative_design:publish"),
      );

      await expect(svc.publish("record-1", "actor-1")).rejects.toThrow(ForbiddenException);
      expect(records.updatePublishState).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when the atomic publish write reports not_found", async () => {
      records.findById.mockResolvedValue(record({ approvalStatus: "approved" }));
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      records.updatePublishState.mockResolvedValue({ outcome: "not_found" });

      await expect(svc.publish("record-1", "actor-1")).rejects.toThrow(NotFoundException);
    });

    it("throws ConflictException on a double-publish race (already published)", async () => {
      records.findById.mockResolvedValue(record({ approvalStatus: "approved", isPublished: true }));
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      records.updatePublishState.mockResolvedValue({
        outcome: "conflict",
        entity: record({ approvalStatus: "approved", isPublished: true }),
      });

      await expect(svc.publish("record-1", "actor-1")).rejects.toThrow(ConflictException);
    });

    it("logs (not throws) when the audit call fails after a successful publish", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      records.findById.mockResolvedValue(record({ approvalStatus: "approved" }));
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      records.updatePublishState.mockResolvedValue({
        outcome: "updated",
        entity: record({ approvalStatus: "approved", isPublished: true }),
      });
      auditService.record.mockRejectedValue(new Error("audit down"));

      const result = await svc.publish("record-1", "actor-1");

      expect(result.isPublished).toBe(true);
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe("unpublish", () => {
    it("is allowed regardless of approvalStatus (no pre-fetch/content gate)", async () => {
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      records.updatePublishState.mockResolvedValue({
        outcome: "updated",
        entity: record({ approvalStatus: "archived", isPublished: false }),
      });

      const result = await svc.unpublish("record-1", "actor-1");

      expect(records.findById).not.toHaveBeenCalled();
      expect(authorizationService.assertAllowed).toHaveBeenCalledWith(
        "actor-1",
        "creative_design",
        "unpublish",
      );
      expect(records.updatePublishState).toHaveBeenCalledWith("record-1", true, false, "actor-1");
      expect(result.isPublished).toBe(false);
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "unpublish", action: "unpublish" }),
      );
    });

    it("propagates a denial from assertAllowed and never attempts the CAS write", async () => {
      authorizationService.assertAllowed.mockRejectedValue(
        new ForbiddenException("Missing permission: creative_design:unpublish"),
      );

      await expect(svc.unpublish("record-1", "actor-1")).rejects.toThrow(ForbiddenException);
      expect(records.updatePublishState).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when the atomic unpublish write reports not_found", async () => {
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      records.updatePublishState.mockResolvedValue({ outcome: "not_found" });

      await expect(svc.unpublish("record-1", "actor-1")).rejects.toThrow(NotFoundException);
    });

    it("throws ConflictException on a double-unpublish race (already unpublished)", async () => {
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      records.updatePublishState.mockResolvedValue({
        outcome: "conflict",
        entity: record({ isPublished: false }),
      });

      await expect(svc.unpublish("record-1", "actor-1")).rejects.toThrow(ConflictException);
    });

    it("never touches publishedAt (server-stamped by the repository, not the service)", async () => {
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      records.updatePublishState.mockResolvedValue({
        outcome: "updated",
        entity: record({ isPublished: false, publishedAt: "2026-08-01T00:00:00.000Z" }),
      });

      const result = await svc.unpublish("record-1", "actor-1");
      expect(result.publishedAt).toBe("2026-08-01T00:00:00.000Z");
    });

    it("logs (not throws) when the audit call fails after a successful unpublish", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      records.updatePublishState.mockResolvedValue({
        outcome: "updated",
        entity: record({ isPublished: false }),
      });
      auditService.record.mockRejectedValue(new Error("audit down"));

      const result = await svc.unpublish("record-1", "actor-1");

      expect(result.isPublished).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });
});
