import type { DeploymentEntity, DeploymentRepository, ReleaseEntity } from "@webdesk/database";
import { BadRequestException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditService } from "../audit/audit.service.js";
import type { ReleasesService } from "./releases.service.js";
import { DeploymentsService } from "./deployments.service.js";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";

function release(overrides: Partial<ReleaseEntity> = {}): ReleaseEntity {
  return {
    id: "release-1",
    projectId: PROJECT_ID,
    publicId: "REL-001",
    releaseType: "staging",
    title: "September release",
    status: "staging_deployed",
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

function deployment(overrides: Partial<DeploymentEntity> = {}): DeploymentEntity {
  return {
    id: "deployment-1",
    releaseId: "release-1",
    projectId: PROJECT_ID,
    environment: "staging",
    outcome: "succeeded",
    deployedByUserId: "actor-1",
    deployedAt: "2026-09-02T00:00:00.000Z",
    notes: null,
    createdAt: "2026-09-02T00:00:00.000Z",
    updatedAt: "2026-09-02T00:00:00.000Z",
    ...overrides,
  };
}

describe("DeploymentsService", () => {
  let deployments: { create: ReturnType<typeof vi.fn>; list: ReturnType<typeof vi.fn> };
  let releasesService: { findById: ReturnType<typeof vi.fn> };
  let auditService: { record: ReturnType<typeof vi.fn> };
  let svc: DeploymentsService;

  beforeEach(() => {
    deployments = { create: vi.fn(), list: vi.fn() };
    releasesService = { findById: vi.fn().mockResolvedValue(release()) };
    auditService = { record: vi.fn() };
    svc = new DeploymentsService(
      deployments as unknown as DeploymentRepository,
      releasesService as unknown as ReleasesService,
      auditService as unknown as AuditService,
    );
  });

  it("validates the parent release first, then records the deploy attempt with the actor stamped", async () => {
    deployments.create.mockResolvedValue(deployment());
    const result = await svc.create(
      PROJECT_ID,
      "release-1",
      { environment: "staging", outcome: "succeeded" },
      "actor-1",
    );
    expect(releasesService.findById).toHaveBeenCalledWith("release-1", PROJECT_ID);
    expect(deployments.create).toHaveBeenCalledWith(
      expect.objectContaining({
        releaseId: "release-1",
        projectId: PROJECT_ID,
        deployedByUserId: "actor-1",
      }),
    );
    expect(result.outcome).toBe("succeeded");
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "data_change", action: "create" }),
    );
  });

  it("rejects recording a deployment against a completed release — code-review fix, this guard was previously missing entirely", async () => {
    releasesService.findById.mockResolvedValue(release({ status: "completed" }));
    await expect(
      svc.create(
        PROJECT_ID,
        "release-1",
        { environment: "production", outcome: "succeeded" },
        "actor-1",
      ),
    ).rejects.toThrow(BadRequestException);
    expect(deployments.create).not.toHaveBeenCalled();
  });

  it("rejects recording a deployment against a rolled_back release", async () => {
    releasesService.findById.mockResolvedValue(release({ status: "rolled_back" }));
    await expect(
      svc.create(PROJECT_ID, "release-1", { environment: "staging", outcome: "failed" }, "actor-1"),
    ).rejects.toThrow(BadRequestException);
    expect(deployments.create).not.toHaveBeenCalled();
  });

  it("re-validates the parent release when listing (IDOR prevention delegated to ReleasesService)", async () => {
    deployments.list.mockResolvedValue([deployment()]);
    await svc.list(PROJECT_ID, "release-1", {});
    expect(releasesService.findById).toHaveBeenCalledWith("release-1", PROJECT_ID);
    expect(deployments.list).toHaveBeenCalledWith(
      expect.objectContaining({ releaseId: "release-1" }),
    );
  });
});
