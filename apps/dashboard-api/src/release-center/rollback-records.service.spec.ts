import type {
  ReleaseEntity,
  RollbackRecordEntity,
  RollbackRecordRepository,
} from "@webdesk/database";
import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReleasesService } from "./releases.service.js";
import { RollbackRecordsService } from "./rollback-records.service.js";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";

function release(overrides: Partial<ReleaseEntity> = {}): ReleaseEntity {
  return {
    id: "release-1",
    projectId: PROJECT_ID,
    publicId: "REL-001",
    releaseType: "staging",
    title: "September release",
    status: "rolled_back",
    notes: null,
    hotfixReason: null,
    assignedDeveloperUserId: null,
    assignedReviewerUserId: null,
    productionApproverUserId: null,
    stagingDeployedAt: null,
    stagingVerifiedAt: null,
    productionDeployedAt: null,
    productionVerifiedAt: null,
    completedAt: null,
    hotfixRequiredAt: null,
    rolledBackAt: "2026-09-02T00:00:00.000Z",
    createdBy: "actor-1",
    updatedBy: "actor-1",
    createdAt: "2026-09-02T00:00:00.000Z",
    updatedAt: "2026-09-02T00:00:00.000Z",
    ...overrides,
  };
}

function rollbackRecord(overrides: Partial<RollbackRecordEntity> = {}): RollbackRecordEntity {
  return {
    id: "rollback-1",
    releaseId: "release-1",
    projectId: PROJECT_ID,
    rolledBackSha: "abc123",
    reason: "bad build",
    replacementReleaseId: null,
    rolledBackByUserId: "actor-1",
    rolledBackAt: "2026-09-02T00:00:00.000Z",
    createdAt: "2026-09-02T00:00:00.000Z",
    updatedAt: "2026-09-02T00:00:00.000Z",
    ...overrides,
  };
}

describe("RollbackRecordsService", () => {
  let rollbackRecords: { findByReleaseId: ReturnType<typeof vi.fn> };
  let releasesService: { findById: ReturnType<typeof vi.fn> };
  let svc: RollbackRecordsService;

  beforeEach(() => {
    rollbackRecords = { findByReleaseId: vi.fn() };
    releasesService = { findById: vi.fn().mockResolvedValue(release()) };
    svc = new RollbackRecordsService(
      rollbackRecords as unknown as RollbackRecordRepository,
      releasesService as unknown as ReleasesService,
    );
  });

  it("validates the parent release first (IDOR prevention), then returns the rollback record", async () => {
    rollbackRecords.findByReleaseId.mockResolvedValue(rollbackRecord());
    const result = await svc.findByReleaseId("release-1", PROJECT_ID);
    expect(releasesService.findById).toHaveBeenCalledWith("release-1", PROJECT_ID);
    expect(result.rolledBackSha).toBe("abc123");
  });

  it("throws a clean 404 when the release has never been rolled back", async () => {
    rollbackRecords.findByReleaseId.mockResolvedValue(null);
    await expect(svc.findByReleaseId("release-1", PROJECT_ID)).rejects.toThrow(NotFoundException);
  });
});
