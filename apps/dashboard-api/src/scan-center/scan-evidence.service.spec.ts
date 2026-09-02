import type {
  ScanEvidenceEntity,
  ScanEvidenceRepository,
  ScanFindingEntity,
} from "@webdesk/database";
import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditService } from "../audit/audit.service.js";
import type { ScanFindingsService } from "./scan-findings.service.js";
import { ScanEvidenceService } from "./scan-evidence.service.js";

const NOW = new Date("2026-09-01T00:00:00.000Z");
const PROJECT_ID = "11111111-1111-4111-8111-111111111111";

function finding(overrides: Partial<ScanFindingEntity> = {}): ScanFindingEntity {
  return {
    id: "finding-1",
    projectId: PROJECT_ID,
    publicId: "FND-1",
    scanRunId: "run-1",
    category: null,
    severity: "high",
    title: "Broken link",
    description: null,
    location: null,
    status: "open",
    resolvedBy: null,
    resolvedAt: null,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

function evidence(overrides: Partial<ScanEvidenceEntity> = {}): ScanEvidenceEntity {
  return {
    id: "evidence-1",
    projectId: PROJECT_ID,
    publicId: "EVD-1",
    scanFindingId: "finding-1",
    evidenceType: null,
    reference: null,
    notes: null,
    capturedAt: null,
    createdBy: "actor-1",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("ScanEvidenceService", () => {
  let repo: { create: ReturnType<typeof vi.fn>; list: ReturnType<typeof vi.fn> };
  let findingsService: { findById: ReturnType<typeof vi.fn> };
  let auditService: { record: ReturnType<typeof vi.fn> };
  let svc: ScanEvidenceService;

  beforeEach(() => {
    repo = { create: vi.fn(), list: vi.fn() };
    findingsService = { findById: vi.fn().mockResolvedValue(finding()) };
    auditService = { record: vi.fn() };
    svc = new ScanEvidenceService(
      repo as unknown as ScanEvidenceRepository,
      findingsService as unknown as ScanFindingsService,
      auditService as unknown as AuditService,
    );
  });

  describe("create", () => {
    it("validates the parent finding belongs to the project first, then creates evidence", async () => {
      repo.create.mockResolvedValue(evidence());

      const result = await svc.create(PROJECT_ID, "finding-1", { publicId: "EVD-1" }, "actor-1");

      expect(result.id).toBe("evidence-1");
      expect(findingsService.findById).toHaveBeenCalledWith("finding-1", PROJECT_ID);
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: PROJECT_ID,
          scanFindingId: "finding-1",
          createdBy: "actor-1",
        }),
      );
      expect(auditService.record).toHaveBeenCalled();
    });

    it("propagates a NotFoundException when the finding does not belong to the project", async () => {
      findingsService.findById.mockRejectedValue(new NotFoundException("not found"));
      await expect(
        svc.create(PROJECT_ID, "finding-1", { publicId: "EVD-1" }, "actor-1"),
      ).rejects.toThrow(NotFoundException);
      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  describe("list", () => {
    it("scopes the list to the validated finding's own id", async () => {
      repo.list.mockResolvedValue([evidence()]);
      const result = await svc.list(PROJECT_ID, "finding-1", {});
      expect(result).toHaveLength(1);
      expect(repo.list).toHaveBeenCalledWith(
        expect.objectContaining({ scanFindingId: "finding-1" }),
      );
    });
  });
});
