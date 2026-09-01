import type { PortfolioRecordEntity, PortfolioRecordRepository } from "@webdesk/database";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditService } from "../audit/audit.service.js";
import type { AuthorizationService } from "../authz/authorization.service.js";
import type { ClaimsService } from "../proof-and-claims-library/claims.service.js";
import { PortfolioRecordsService } from "./portfolio-records.service.js";

const NOW = new Date("2026-09-01T00:00:00.000Z");
const FAKE_CLAIM_ID = "55555555-5555-4555-8555-555555555555";

/** A stand-in for Sequelize's real `UniqueConstraintError` — checked by `.name` in
 *  `PortfolioRecordsService.create()` rather than `instanceof`, since `dashboard-api` never
 *  imports `sequelize` directly (only `packages/database` may). */
function uniqueConstraintError(): Error {
  const error = new Error("Validation error");
  error.name = "SequelizeUniqueConstraintError";
  return error;
}

function record(overrides: Partial<PortfolioRecordEntity> = {}): PortfolioRecordEntity {
  return {
    id: "record-1",
    publicId: "PORTFOLIO-SERVICE-PAGE",
    projectOrClientName: "Acme Co.",
    url: null,
    primaryCategory: null,
    additionalCategories: [],
    tags: [],
    industry: null,
    platform: null,
    serviceType: null,
    launchDate: null,
    relatedProofIds: [],
    visibility: "internal_only",
    approvalStatus: "draft",
    isPublished: false,
    publishedAt: null,
    version: 1,
    createdBy: "actor-1",
    updatedBy: "actor-1",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("PortfolioRecordsService", () => {
  let portfolioRecords: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findByPublicId: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateApprovalStatus: ReturnType<typeof vi.fn>;
    updatePublishState: ReturnType<typeof vi.fn>;
  };
  let claims: { existingClaimIds: ReturnType<typeof vi.fn> };
  let authorizationService: { assertAllowed: ReturnType<typeof vi.fn> };
  let auditService: { record: ReturnType<typeof vi.fn> };
  let svc: PortfolioRecordsService;

  beforeEach(() => {
    portfolioRecords = {
      create: vi.fn(),
      findById: vi.fn(),
      findByPublicId: vi.fn(),
      list: vi.fn(),
      update: vi.fn(),
      updateApprovalStatus: vi.fn(),
      updatePublishState: vi.fn(),
    };
    claims = { existingClaimIds: vi.fn().mockResolvedValue(new Set()) };
    authorizationService = { assertAllowed: vi.fn() };
    auditService = { record: vi.fn() };
    svc = new PortfolioRecordsService(
      portfolioRecords as unknown as PortfolioRecordRepository,
      claims as unknown as ClaimsService,
      authorizationService as unknown as AuthorizationService,
      auditService as unknown as AuditService,
    );
  });

  describe("create", () => {
    it("creates a portfolio record after validating the publicId is free", async () => {
      portfolioRecords.findByPublicId.mockResolvedValue(null);
      portfolioRecords.create.mockResolvedValue(record());

      const result = await svc.create(
        { publicId: "PORTFOLIO-SERVICE-PAGE", projectOrClientName: "Acme Co." },
        "actor-1",
      );

      expect(result).toEqual(record());
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "create", entityType: "portfolio_record" }),
      );
    });

    it("rejects a duplicate publicId", async () => {
      portfolioRecords.findByPublicId.mockResolvedValue(record());

      await expect(
        svc.create({ publicId: "PORTFOLIO-SERVICE-PAGE", projectOrClientName: "X" }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
      expect(portfolioRecords.create).not.toHaveBeenCalled();
    });

    it("rejects a relatedProofIds entry that doesn't resolve to a real proof claim (D3, no DB-level FK)", async () => {
      portfolioRecords.findByPublicId.mockResolvedValue(null);
      claims.existingClaimIds.mockResolvedValue(new Set());

      await expect(
        svc.create(
          {
            publicId: "PORTFOLIO-X",
            projectOrClientName: "X",
            relatedProofIds: [FAKE_CLAIM_ID],
          },
          "actor-1",
        ),
      ).rejects.toThrow(BadRequestException);
      expect(portfolioRecords.create).not.toHaveBeenCalled();
    });

    it("accepts a relatedProofIds entry that does resolve to a real proof claim", async () => {
      portfolioRecords.findByPublicId.mockResolvedValue(null);
      claims.existingClaimIds.mockResolvedValue(new Set([FAKE_CLAIM_ID]));
      portfolioRecords.create.mockResolvedValue(record({ relatedProofIds: [FAKE_CLAIM_ID] }));

      const result = await svc.create(
        { publicId: "PORTFOLIO-X", projectOrClientName: "X", relatedProofIds: [FAKE_CLAIM_ID] },
        "actor-1",
      );

      expect(result.relatedProofIds).toEqual([FAKE_CLAIM_ID]);
    });

    it("translates a concurrent publicId collision into a clean 400, not a raw 500", async () => {
      portfolioRecords.findByPublicId.mockResolvedValue(null);
      portfolioRecords.create.mockRejectedValue(uniqueConstraintError());

      await expect(
        svc.create({ publicId: "PORTFOLIO-RACE", projectOrClientName: "X" }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("re-throws a non-uniqueness error from create() unchanged", async () => {
      portfolioRecords.findByPublicId.mockResolvedValue(null);
      const dbError = new Error("connection reset");
      portfolioRecords.create.mockRejectedValue(dbError);

      await expect(
        svc.create({ publicId: "PORTFOLIO-X", projectOrClientName: "X" }, "actor-1"),
      ).rejects.toBe(dbError);
    });
  });

  describe("findById", () => {
    it("throws NotFoundException when the record does not exist", async () => {
      portfolioRecords.findById.mockResolvedValue(null);
      await expect(svc.findById("missing")).rejects.toThrow(NotFoundException);
    });

    it("returns the record when it exists", async () => {
      portfolioRecords.findById.mockResolvedValue(record());
      await expect(svc.findById("record-1")).resolves.toEqual(record());
    });
  });

  describe("list", () => {
    it("delegates the filter straight through to the repository", async () => {
      portfolioRecords.list.mockResolvedValue([record()]);
      const result = await svc.list({ approvalStatus: "draft" });
      expect(portfolioRecords.list).toHaveBeenCalledWith({ approvalStatus: "draft" });
      expect(result).toEqual([record()]);
    });
  });

  describe("update", () => {
    it("throws NotFoundException when the record doesn't exist", async () => {
      portfolioRecords.findById.mockResolvedValue(null);

      await expect(
        svc.update("missing", { projectOrClientName: "New" }, "actor-1"),
      ).rejects.toThrow(NotFoundException);
      expect(portfolioRecords.update).not.toHaveBeenCalled();
    });

    it.each(["archived", "superseded"] as const)(
      "rejects with a clean 400 when the record is %s (terminal, no code path resurrects it)",
      async (approvalStatus) => {
        portfolioRecords.findById.mockResolvedValue(record({ approvalStatus }));

        await expect(
          svc.update("record-1", { projectOrClientName: "New" }, "actor-1"),
        ).rejects.toThrow(BadRequestException);
        expect(portfolioRecords.update).not.toHaveBeenCalled();
      },
    );

    it("rejects a relatedProofIds entry that doesn't resolve to a real proof claim on update", async () => {
      portfolioRecords.findById.mockResolvedValue(record({ approvalStatus: "draft" }));
      claims.existingClaimIds.mockResolvedValue(new Set());

      await expect(
        svc.update("record-1", { relatedProofIds: [FAKE_CLAIM_ID] }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
      expect(portfolioRecords.update).not.toHaveBeenCalled();
    });

    it("throws ConflictException when the CAS write finds 0 affected rows but the row still exists", async () => {
      portfolioRecords.findById
        .mockResolvedValueOnce(record({ approvalStatus: "draft" }))
        .mockResolvedValueOnce(record({ approvalStatus: "submitted" }));
      portfolioRecords.update.mockResolvedValue(null);

      await expect(
        svc.update("record-1", { projectOrClientName: "New" }, "actor-1"),
      ).rejects.toThrow(ConflictException);
    });

    it("passes the current approvalStatus as a CAS guard to the repository", async () => {
      portfolioRecords.findById.mockResolvedValue(record({ approvalStatus: "draft" }));
      portfolioRecords.update.mockResolvedValue(
        record({ projectOrClientName: "Renamed", version: 2 }),
      );

      await svc.update("record-1", { projectOrClientName: "Renamed" }, "actor-1");

      expect(portfolioRecords.update).toHaveBeenCalledWith(
        "record-1",
        expect.objectContaining({ projectOrClientName: "Renamed", updatedBy: "actor-1" }),
        "draft",
      );
    });

    it("never accepts approvalStatus/version/isPublished/publishedAt through the general update patch", async () => {
      portfolioRecords.findById.mockResolvedValue(record({ approvalStatus: "draft" }));
      portfolioRecords.update.mockResolvedValue(
        record({ projectOrClientName: "Renamed", version: 2 }),
      );

      await svc.update("record-1", { projectOrClientName: "Renamed" }, "actor-1");

      const [, patchArg] = portfolioRecords.update.mock.calls[0] as [
        string,
        Record<string, unknown>,
      ];
      expect(patchArg).not.toHaveProperty("approvalStatus");
      expect(patchArg).not.toHaveProperty("version");
      expect(patchArg).not.toHaveProperty("isPublished");
      expect(patchArg).not.toHaveProperty("publishedAt");
    });

    it("returns the repository's updated entity, with version incremented server-side", async () => {
      portfolioRecords.findById.mockResolvedValue(record({ approvalStatus: "draft" }));
      portfolioRecords.update.mockResolvedValue(
        record({ projectOrClientName: "Renamed", version: 4 }),
      );

      const result = await svc.update("record-1", { projectOrClientName: "Renamed" }, "actor-1");

      expect(result.version).toBe(4);
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "update", entityType: "portfolio_record" }),
      );
    });
  });

  describe("changeApprovalStatus", () => {
    it("is a no-op returning the current entity when the requested status matches the current one", async () => {
      portfolioRecords.findById.mockResolvedValue(record({ approvalStatus: "draft" }));
      const result = await svc.changeApprovalStatus("record-1", "draft", "actor-1");
      expect(result.approvalStatus).toBe("draft");
      expect(authorizationService.assertAllowed).not.toHaveBeenCalled();
    });

    it("does not increment version on a status transition", async () => {
      portfolioRecords.findById.mockResolvedValue(record({ approvalStatus: "draft", version: 5 }));
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      portfolioRecords.updateApprovalStatus.mockResolvedValue({
        outcome: "updated",
        entity: record({ approvalStatus: "submitted", version: 5 }),
      });

      const result = await svc.changeApprovalStatus("record-1", "submitted", "actor-1");
      expect(result.version).toBe(5);
    });

    it("rejects a transition not in the allowlist", async () => {
      portfolioRecords.findById.mockResolvedValue(record({ approvalStatus: "draft" }));
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
      portfolioRecords.findById.mockResolvedValue(record({ approvalStatus: from }));
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      portfolioRecords.updateApprovalStatus.mockResolvedValue({
        outcome: "updated",
        entity: record({ approvalStatus: to }),
      });

      await svc.changeApprovalStatus("record-1", to, "actor-1");

      expect(authorizationService.assertAllowed).toHaveBeenCalledWith(
        "actor-1",
        "portfolio",
        action,
      );
    });

    it("rejects every transition out of the terminal 'archived'/'superseded' states", async () => {
      portfolioRecords.findById.mockResolvedValueOnce(record({ approvalStatus: "archived" }));
      await expect(svc.changeApprovalStatus("record-1", "draft", "actor-1")).rejects.toThrow(
        BadRequestException,
      );

      portfolioRecords.findById.mockResolvedValueOnce(record({ approvalStatus: "superseded" }));
      await expect(svc.changeApprovalStatus("record-1", "draft", "actor-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("propagates a denial from assertAllowed and never attempts the status write", async () => {
      portfolioRecords.findById.mockResolvedValue(record({ approvalStatus: "under_review" }));
      authorizationService.assertAllowed.mockRejectedValue(
        new ForbiddenException("Missing permission: portfolio:approve"),
      );

      await expect(svc.changeApprovalStatus("record-1", "approved", "actor-1")).rejects.toThrow(
        ForbiddenException,
      );
      expect(portfolioRecords.updateApprovalStatus).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when the atomic status write reports not_found", async () => {
      portfolioRecords.findById.mockResolvedValue(record({ approvalStatus: "draft" }));
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      portfolioRecords.updateApprovalStatus.mockResolvedValue({ outcome: "not_found" });

      await expect(svc.changeApprovalStatus("record-1", "submitted", "actor-1")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws ConflictException when the atomic status write loses a race", async () => {
      portfolioRecords.findById.mockResolvedValue(record({ approvalStatus: "draft" }));
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      portfolioRecords.updateApprovalStatus.mockResolvedValue({
        outcome: "conflict",
        entity: record({ approvalStatus: "archived" }),
      });

      await expect(svc.changeApprovalStatus("record-1", "submitted", "actor-1")).rejects.toThrow(
        ConflictException,
      );
    });

    it("logs (not throws) when the audit call fails after a successful status write", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      portfolioRecords.findById.mockResolvedValue(record({ approvalStatus: "draft" }));
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      portfolioRecords.updateApprovalStatus.mockResolvedValue({
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
      portfolioRecords.findById.mockResolvedValue(record({ approvalStatus: "draft" }));

      await expect(svc.publish("record-1", "actor-1")).rejects.toThrow(BadRequestException);
      expect(authorizationService.assertAllowed).not.toHaveBeenCalled();
      expect(portfolioRecords.updatePublishState).not.toHaveBeenCalled();
    });

    it("publishes an approved record, checking the 'publish' action", async () => {
      portfolioRecords.findById.mockResolvedValue(
        record({ approvalStatus: "approved", isPublished: false }),
      );
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      portfolioRecords.updatePublishState.mockResolvedValue({
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
        "portfolio",
        "publish",
      );
      expect(portfolioRecords.updatePublishState).toHaveBeenCalledWith(
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
      portfolioRecords.findById.mockResolvedValue(
        record({ approvalStatus: "approved", isPublished: false }),
      );
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      // Simulates a concurrent changeApprovalStatus() call flipping the row to `archived` between
      // this publish() call's own findById() read and its updatePublishState() write — the CAS
      // guard on approvalStatus makes the write fail, surfacing a clean 409 instead of silently
      // publishing a non-approved record.
      portfolioRecords.updatePublishState.mockResolvedValue({
        outcome: "conflict",
        entity: record({ approvalStatus: "archived", isPublished: false }),
      });

      await expect(svc.publish("record-1", "actor-1")).rejects.toThrow(ConflictException);
      expect(portfolioRecords.updatePublishState).toHaveBeenCalledWith(
        "record-1",
        false,
        true,
        "actor-1",
        "approved",
      );
    });

    it("propagates a denial from assertAllowed and never attempts the CAS write", async () => {
      portfolioRecords.findById.mockResolvedValue(record({ approvalStatus: "approved" }));
      authorizationService.assertAllowed.mockRejectedValue(
        new ForbiddenException("Missing permission: portfolio:publish"),
      );

      await expect(svc.publish("record-1", "actor-1")).rejects.toThrow(ForbiddenException);
      expect(portfolioRecords.updatePublishState).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when the atomic publish write reports not_found", async () => {
      portfolioRecords.findById.mockResolvedValue(record({ approvalStatus: "approved" }));
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      portfolioRecords.updatePublishState.mockResolvedValue({ outcome: "not_found" });

      await expect(svc.publish("record-1", "actor-1")).rejects.toThrow(NotFoundException);
    });

    it("throws ConflictException on a double-publish race (already published)", async () => {
      portfolioRecords.findById.mockResolvedValue(
        record({ approvalStatus: "approved", isPublished: true }),
      );
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      portfolioRecords.updatePublishState.mockResolvedValue({
        outcome: "conflict",
        entity: record({ approvalStatus: "approved", isPublished: true }),
      });

      await expect(svc.publish("record-1", "actor-1")).rejects.toThrow(ConflictException);
    });

    it("logs (not throws) when the audit call fails after a successful publish", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      portfolioRecords.findById.mockResolvedValue(record({ approvalStatus: "approved" }));
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      portfolioRecords.updatePublishState.mockResolvedValue({
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
      portfolioRecords.updatePublishState.mockResolvedValue({
        outcome: "updated",
        entity: record({ approvalStatus: "archived", isPublished: false }),
      });

      const result = await svc.unpublish("record-1", "actor-1");

      expect(portfolioRecords.findById).not.toHaveBeenCalled();
      expect(authorizationService.assertAllowed).toHaveBeenCalledWith(
        "actor-1",
        "portfolio",
        "unpublish",
      );
      expect(portfolioRecords.updatePublishState).toHaveBeenCalledWith(
        "record-1",
        true,
        false,
        "actor-1",
      );
      expect(result.isPublished).toBe(false);
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "unpublish", action: "unpublish" }),
      );
    });

    it("propagates a denial from assertAllowed and never attempts the CAS write", async () => {
      authorizationService.assertAllowed.mockRejectedValue(
        new ForbiddenException("Missing permission: portfolio:unpublish"),
      );

      await expect(svc.unpublish("record-1", "actor-1")).rejects.toThrow(ForbiddenException);
      expect(portfolioRecords.updatePublishState).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when the atomic unpublish write reports not_found", async () => {
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      portfolioRecords.updatePublishState.mockResolvedValue({ outcome: "not_found" });

      await expect(svc.unpublish("record-1", "actor-1")).rejects.toThrow(NotFoundException);
    });

    it("throws ConflictException on a double-unpublish race (already unpublished)", async () => {
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      portfolioRecords.updatePublishState.mockResolvedValue({
        outcome: "conflict",
        entity: record({ isPublished: false }),
      });

      await expect(svc.unpublish("record-1", "actor-1")).rejects.toThrow(ConflictException);
    });

    it("never touches publishedAt (server-stamped by the repository, not the service)", async () => {
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      portfolioRecords.updatePublishState.mockResolvedValue({
        outcome: "updated",
        entity: record({ isPublished: false, publishedAt: "2026-08-01T00:00:00.000Z" }),
      });

      const result = await svc.unpublish("record-1", "actor-1");
      expect(result.publishedAt).toBe("2026-08-01T00:00:00.000Z");
    });

    it("logs (not throws) when the audit call fails after a successful unpublish", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      portfolioRecords.updatePublishState.mockResolvedValue({
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
