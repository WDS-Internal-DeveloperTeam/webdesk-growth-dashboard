import type {
  ReleaseArtifactEntity,
  ReleaseArtifactRepository,
  ReleaseEntity,
} from "@webdesk/database";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditService } from "../audit/audit.service.js";
import type { ReleasesService } from "./releases.service.js";
import { ReleaseArtifactsService } from "./release-artifacts.service.js";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";

function release(overrides: Partial<ReleaseEntity> = {}): ReleaseEntity {
  return {
    id: "release-1",
    projectId: PROJECT_ID,
    publicId: "REL-001",
    releaseType: "staging",
    title: "September release",
    status: "proposed",
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
    rolledBackAt: null,
    createdBy: "actor-1",
    updatedBy: "actor-1",
    createdAt: "2026-09-02T00:00:00.000Z",
    updatedAt: "2026-09-02T00:00:00.000Z",
    ...overrides,
  };
}

function artifact(overrides: Partial<ReleaseArtifactEntity> = {}): ReleaseArtifactEntity {
  return {
    id: "artifact-1",
    releaseId: "release-1",
    projectId: PROJECT_ID,
    repoOwner: "webdesk",
    repoName: "growth-dashboard",
    commitSha: "abc123",
    prUrl: null,
    createdBy: "actor-1",
    createdAt: "2026-09-02T00:00:00.000Z",
    updatedAt: "2026-09-02T00:00:00.000Z",
    ...overrides,
  };
}

describe("ReleaseArtifactsService", () => {
  let artifacts: {
    create: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  let releasesService: { findById: ReturnType<typeof vi.fn> };
  let auditService: { record: ReturnType<typeof vi.fn> };
  let svc: ReleaseArtifactsService;

  beforeEach(() => {
    artifacts = { create: vi.fn(), list: vi.fn(), remove: vi.fn() };
    releasesService = { findById: vi.fn().mockResolvedValue(release()) };
    auditService = { record: vi.fn() };
    svc = new ReleaseArtifactsService(
      artifacts as unknown as ReleaseArtifactRepository,
      releasesService as unknown as ReleasesService,
      auditService as unknown as AuditService,
    );
  });

  describe("create", () => {
    it("validates the parent release first, then creates the artifact", async () => {
      artifacts.create.mockResolvedValue(artifact());
      const result = await svc.create(
        PROJECT_ID,
        "release-1",
        { repoOwner: "webdesk", repoName: "growth-dashboard", commitSha: "abc123" },
        "actor-1",
      );
      expect(releasesService.findById).toHaveBeenCalledWith("release-1", PROJECT_ID);
      expect(result.repoOwner).toBe("webdesk");
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "data_change", action: "create" }),
      );
    });
  });

  describe("remove", () => {
    it("rejects removal once the release is completed", async () => {
      releasesService.findById.mockResolvedValue(release({ status: "completed" }));
      await expect(svc.remove(PROJECT_ID, "release-1", "artifact-1", "actor-1")).rejects.toThrow(
        BadRequestException,
      );
      expect(artifacts.remove).not.toHaveBeenCalled();
    });

    it("rejects removal once the release is rolled_back", async () => {
      releasesService.findById.mockResolvedValue(release({ status: "rolled_back" }));
      await expect(svc.remove(PROJECT_ID, "release-1", "artifact-1", "actor-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("removes the artifact when the release is non-terminal", async () => {
      artifacts.remove.mockResolvedValue(true);
      await svc.remove(PROJECT_ID, "release-1", "artifact-1", "actor-1");
      expect(artifacts.remove).toHaveBeenCalledWith("artifact-1", "release-1");
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "delete" }),
      );
    });

    it("throws NotFoundException when the artifact doesn't belong to this release", async () => {
      artifacts.remove.mockResolvedValue(false);
      await expect(svc.remove(PROJECT_ID, "release-1", "artifact-1", "actor-1")).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
