import type { ChangeRecordEntity, ChangeRecordRepository } from "@webdesk/database";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditService } from "../audit/audit.service.js";
import type { AuthorizationService } from "../authz/authorization.service.js";
import type { ProjectService } from "../projects/project.service.js";
import type { ScanFindingsService } from "../scan-center/scan-findings.service.js";
import type { UsersService } from "../users/users.service.js";
import { ChangeRecordsService } from "./change-records.service.js";

const NOW = new Date("2026-09-02T00:00:00.000Z");
const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_PROJECT_ID = "99999999-9999-4999-8999-999999999999";
const SCAN_FINDING_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";

function changeRecord(overrides: Partial<ChangeRecordEntity> = {}): ChangeRecordEntity {
  return {
    id: "record-1",
    projectId: PROJECT_ID,
    publicId: "CHG-1",
    category: "plugin",
    severity: "medium",
    status: "detected",
    scanFindingId: null,
    source: null,
    targetModuleKey: null,
    targetId: null,
    recordLabel: "Plugin X 1.2.0 -> 1.3.0",
    beforeValue: null,
    afterValue: null,
    confidence: null,
    recommendation: null,
    assignedToUserId: null,
    decisionNotes: null,
    decidedByUserId: null,
    decidedAt: null,
    appliedByUserId: null,
    appliedAt: null,
    verifiedByUserId: null,
    verifiedAt: null,
    rollbackGuidance: null,
    createdBy: "actor-1",
    updatedBy: "actor-1",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("ChangeRecordsService", () => {
  let records: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findByPublicId: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateStatus: ReturnType<typeof vi.fn>;
  };
  let projects: { findById: ReturnType<typeof vi.fn> };
  let scanFindings: { findById: ReturnType<typeof vi.fn> };
  let usersService: { assertUserExists: ReturnType<typeof vi.fn> };
  let authorizationService: {
    assertAllowed: ReturnType<typeof vi.fn>;
    isValidModuleKey: ReturnType<typeof vi.fn>;
  };
  let auditService: { record: ReturnType<typeof vi.fn> };
  let svc: ChangeRecordsService;

  beforeEach(() => {
    records = {
      create: vi.fn(),
      findById: vi.fn(),
      findByPublicId: vi.fn().mockResolvedValue(null),
      list: vi.fn(),
      update: vi.fn(),
      updateStatus: vi.fn(),
    };
    projects = { findById: vi.fn().mockResolvedValue({ id: PROJECT_ID }) };
    scanFindings = {
      findById: vi.fn().mockResolvedValue({ id: SCAN_FINDING_ID, projectId: PROJECT_ID }),
    };
    usersService = { assertUserExists: vi.fn().mockResolvedValue(undefined) };
    authorizationService = {
      assertAllowed: vi.fn(),
      isValidModuleKey: vi.fn().mockResolvedValue(true),
    };
    auditService = { record: vi.fn() };
    svc = new ChangeRecordsService(
      records as unknown as ChangeRecordRepository,
      projects as unknown as ProjectService,
      scanFindings as unknown as ScanFindingsService,
      usersService as unknown as UsersService,
      authorizationService as unknown as AuthorizationService,
      auditService as unknown as AuditService,
    );
  });

  describe("create", () => {
    const input = {
      publicId: "CHG-1",
      category: "plugin" as const,
      severity: "medium" as const,
      recordLabel: "Plugin X 1.2.0 -> 1.3.0",
    };

    it("creates a change record starting at detected", async () => {
      records.create.mockResolvedValue(changeRecord());
      const result = await svc.create(PROJECT_ID, input, "actor-1");
      expect(result.status).toBe("detected");
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "data_change", action: "create" }),
      );
    });

    it("rejects a duplicate publicId with a clean 400", async () => {
      records.findByPublicId.mockResolvedValue(changeRecord());
      await expect(svc.create(PROJECT_ID, input, "actor-1")).rejects.toThrow(BadRequestException);
      expect(records.create).not.toHaveBeenCalled();
    });

    it("validates a supplied scanFindingId against the same project via ScanFindingsService", async () => {
      const withFinding = { ...input, scanFindingId: SCAN_FINDING_ID };
      records.create.mockResolvedValue(changeRecord({ scanFindingId: SCAN_FINDING_ID }));
      await svc.create(PROJECT_ID, withFinding, "actor-1");
      expect(scanFindings.findById).toHaveBeenCalledWith(SCAN_FINDING_ID, PROJECT_ID);
    });

    it("rejects a scanFindingId that doesn't resolve in this project", async () => {
      scanFindings.findById.mockRejectedValue(new NotFoundException());
      await expect(
        svc.create(PROJECT_ID, { ...input, scanFindingId: SCAN_FINDING_ID }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
      expect(records.create).not.toHaveBeenCalled();
    });

    it("validates a supplied targetModuleKey against the real module registry", async () => {
      authorizationService.isValidModuleKey.mockResolvedValue(false);
      await expect(
        svc.create(
          PROJECT_ID,
          { ...input, targetModuleKey: "business_knowledge", targetId: USER_ID },
          "actor-1",
        ),
      ).rejects.toThrow(BadRequestException);
      expect(records.create).not.toHaveBeenCalled();
    });

    it("validates a supplied assignedToUserId", async () => {
      records.create.mockResolvedValue(changeRecord({ assignedToUserId: USER_ID }));
      await svc.create(PROJECT_ID, { ...input, assignedToUserId: USER_ID }, "actor-1");
      expect(usersService.assertUserExists).toHaveBeenCalledWith(USER_ID, "assignedToUserId");
    });

    it("still returns the created record when the post-write audit call fails", async () => {
      const created = changeRecord();
      records.create.mockResolvedValue(created);
      auditService.record.mockRejectedValue(new Error("audit service unavailable"));
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const result = await svc.create(PROJECT_ID, input, "actor-1");
      expect(result).toBe(created);
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe("findById", () => {
    it("throws NotFoundException for a record in a different project (IDOR)", async () => {
      records.findById.mockResolvedValue(changeRecord({ projectId: OTHER_PROJECT_ID }));
      await expect(svc.findById("record-1", PROJECT_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe("update", () => {
    it("edits content fields while still detected", async () => {
      records.findById.mockResolvedValue(changeRecord({ status: "detected" }));
      records.update.mockResolvedValue(changeRecord({ recordLabel: "Renamed" }));
      const result = await svc.update(
        "record-1",
        PROJECT_ID,
        { recordLabel: "Renamed" },
        "actor-1",
      );
      expect(result.recordLabel).toBe("Renamed");
      expect(records.update).toHaveBeenCalledWith(
        "record-1",
        expect.objectContaining({ recordLabel: "Renamed" }),
        "detected",
      );
    });

    it("edits severity while still detected (correcting an initial miscategorization)", async () => {
      records.findById.mockResolvedValue(changeRecord({ status: "detected", severity: "medium" }));
      records.update.mockResolvedValue(changeRecord({ severity: "critical" }));
      const result = await svc.update("record-1", PROJECT_ID, { severity: "critical" }, "actor-1");
      expect(result.severity).toBe("critical");
      expect(records.update).toHaveBeenCalledWith(
        "record-1",
        expect.objectContaining({ severity: "critical" }),
        "detected",
      );
    });

    it("rejects an edit once the record has moved past detected/under_review", async () => {
      records.findById.mockResolvedValue(changeRecord({ status: "accepted" }));
      await expect(
        svc.update("record-1", PROJECT_ID, { recordLabel: "Renamed" }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
      expect(records.update).not.toHaveBeenCalled();
    });

    it("rejects a patch that would leave targetModuleKey/targetId mismatched", async () => {
      records.findById.mockResolvedValue(
        changeRecord({ status: "detected", targetModuleKey: null, targetId: null }),
      );
      await expect(
        svc.update("record-1", PROJECT_ID, { targetModuleKey: "business_knowledge" }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
      expect(records.update).not.toHaveBeenCalled();
    });

    it("surfaces a concurrent status change as a clean 409", async () => {
      records.findById.mockResolvedValueOnce(changeRecord({ status: "detected" }));
      records.update.mockResolvedValue(null);
      records.findById.mockResolvedValueOnce(changeRecord({ status: "under_review" }));
      await expect(
        svc.update("record-1", PROJECT_ID, { recordLabel: "Renamed" }, "actor-1"),
      ).rejects.toThrow(ConflictException);
    });

    it("still returns the updated record when the post-write audit call fails", async () => {
      records.findById.mockResolvedValue(changeRecord({ status: "detected" }));
      const updated = changeRecord({ recordLabel: "Renamed" });
      records.update.mockResolvedValue(updated);
      auditService.record.mockRejectedValue(new Error("audit service unavailable"));
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const result = await svc.update(
        "record-1",
        PROJECT_ID,
        { recordLabel: "Renamed" },
        "actor-1",
      );
      expect(result).toBe(updated);
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe("changeStatus", () => {
    it("returns the record unchanged and does no work on a same-status request", async () => {
      records.findById.mockResolvedValue(changeRecord({ status: "detected" }));
      const result = await svc.changeStatus(
        "record-1",
        PROJECT_ID,
        { status: "detected" },
        "actor-1",
      );
      expect(result.status).toBe("detected");
      expect(authorizationService.assertAllowed).not.toHaveBeenCalled();
      expect(records.updateStatus).not.toHaveBeenCalled();
    });

    it("rejects an invalid transition", async () => {
      records.findById.mockResolvedValue(changeRecord({ status: "detected" }));
      await expect(
        svc.changeStatus("record-1", PROJECT_ID, { status: "verified" }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("requires the review action for detected -> under_review", async () => {
      records.findById.mockResolvedValue(changeRecord({ status: "detected" }));
      records.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: changeRecord({ status: "under_review" }),
      });
      const result = await svc.changeStatus(
        "record-1",
        PROJECT_ID,
        { status: "under_review" },
        "actor-1",
      );
      expect(result.status).toBe("under_review");
      expect(authorizationService.assertAllowed).toHaveBeenCalledWith(
        "actor-1",
        "change_center",
        "review",
        PROJECT_ID,
      );
    });

    it("requires the approve action for accepted -> applying", async () => {
      records.findById.mockResolvedValue(changeRecord({ status: "accepted" }));
      records.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: changeRecord({ status: "applying" }),
      });
      await svc.changeStatus("record-1", PROJECT_ID, { status: "applying" }, "actor-1");
      expect(authorizationService.assertAllowed).toHaveBeenCalledWith(
        "actor-1",
        "change_center",
        "approve",
        PROJECT_ID,
      );
    });

    it("surfaces a concurrent status change as a clean 409", async () => {
      records.findById.mockResolvedValue(changeRecord({ status: "detected" }));
      records.updateStatus.mockResolvedValue({
        outcome: "conflict",
        entity: changeRecord({ status: "under_review" }),
      });
      await expect(
        svc.changeStatus("record-1", PROJECT_ID, { status: "under_review" }, "actor-1"),
      ).rejects.toThrow(ConflictException);
    });

    it("throws NotFoundException when the record disappears mid-transition", async () => {
      records.findById.mockResolvedValue(changeRecord({ status: "detected" }));
      records.updateStatus.mockResolvedValue({ outcome: "not_found" });
      await expect(
        svc.changeStatus("record-1", PROJECT_ID, { status: "under_review" }, "actor-1"),
      ).rejects.toThrow(NotFoundException);
    });

    it("passes rollbackGuidance through only for a transition into apply_failed", async () => {
      records.findById.mockResolvedValue(changeRecord({ status: "applying" }));
      records.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: changeRecord({ status: "apply_failed" }),
      });
      await svc.changeStatus(
        "record-1",
        PROJECT_ID,
        { status: "apply_failed", rollbackGuidance: "Revert to 1.2.0" },
        "actor-1",
      );
      expect(records.updateStatus).toHaveBeenCalledWith(
        "record-1",
        "applying",
        "apply_failed",
        "actor-1",
        expect.objectContaining({ rollbackGuidance: "Revert to 1.2.0" }),
      );
    });

    it("never forwards rollbackGuidance for a non-apply_failed transition", async () => {
      records.findById.mockResolvedValue(changeRecord({ status: "detected" }));
      records.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: changeRecord({ status: "under_review" }),
      });
      await svc.changeStatus("record-1", PROJECT_ID, { status: "under_review" }, "actor-1");
      expect(records.updateStatus).toHaveBeenCalledWith(
        "record-1",
        "detected",
        "under_review",
        "actor-1",
        expect.objectContaining({ rollbackGuidance: undefined }),
      );
    });

    it("audits a milestone transition (accepted) as an approval event", async () => {
      records.findById.mockResolvedValue(changeRecord({ status: "under_review" }));
      records.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: changeRecord({ status: "accepted" }),
      });
      await svc.changeStatus("record-1", PROJECT_ID, { status: "accepted" }, "actor-1");
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "approval", retentionCategory: "approval-audit-7y" }),
      );
    });

    it("audits a non-milestone transition (under_review) as a plain data_change event", async () => {
      records.findById.mockResolvedValue(changeRecord({ status: "detected" }));
      records.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: changeRecord({ status: "under_review" }),
      });
      await svc.changeStatus("record-1", PROJECT_ID, { status: "under_review" }, "actor-1");
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "data_change", retentionCategory: "audit-7y" }),
      );
    });

    it("does not fail the transition if the audit write throws (logged, not rethrown)", async () => {
      records.findById.mockResolvedValue(changeRecord({ status: "detected" }));
      records.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: changeRecord({ status: "under_review" }),
      });
      auditService.record.mockRejectedValue(new Error("db down"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

      const result = await svc.changeStatus(
        "record-1",
        PROJECT_ID,
        { status: "under_review" },
        "actor-1",
      );

      expect(result.status).toBe("under_review");
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
