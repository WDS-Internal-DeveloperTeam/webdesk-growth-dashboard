import type { ReleaseEntity, SmokeTestEntity, SmokeTestRepository } from "@webdesk/database";
import { BadRequestException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditService } from "../audit/audit.service.js";
import type { ReleasesService } from "./releases.service.js";
import { SmokeTestsService } from "./smoke-tests.service.js";

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

function smokeTest(overrides: Partial<SmokeTestEntity> = {}): SmokeTestEntity {
  return {
    id: "smoke-test-1",
    releaseId: "release-1",
    projectId: PROJECT_ID,
    environment: "staging",
    name: "Homepage loads",
    result: "passed",
    ranAt: "2026-09-02T00:00:00.000Z",
    notes: null,
    createdAt: "2026-09-02T00:00:00.000Z",
    updatedAt: "2026-09-02T00:00:00.000Z",
    ...overrides,
  };
}

describe("SmokeTestsService", () => {
  let smokeTests: { create: ReturnType<typeof vi.fn>; list: ReturnType<typeof vi.fn> };
  let releasesService: { findById: ReturnType<typeof vi.fn> };
  let auditService: { record: ReturnType<typeof vi.fn> };
  let svc: SmokeTestsService;

  beforeEach(() => {
    smokeTests = { create: vi.fn(), list: vi.fn() };
    releasesService = { findById: vi.fn().mockResolvedValue(release()) };
    auditService = { record: vi.fn() };
    svc = new SmokeTestsService(
      smokeTests as unknown as SmokeTestRepository,
      releasesService as unknown as ReleasesService,
      auditService as unknown as AuditService,
    );
  });

  it("validates the parent release first, then records the smoke-test result", async () => {
    smokeTests.create.mockResolvedValue(smokeTest());
    const result = await svc.create(
      PROJECT_ID,
      "release-1",
      { environment: "staging", name: "Homepage loads", result: "passed" },
      "actor-1",
    );
    expect(releasesService.findById).toHaveBeenCalledWith("release-1", PROJECT_ID);
    expect(result.result).toBe("passed");
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "data_change", action: "create" }),
    );
  });

  it("rejects recording a smoke test against a completed release — code-review fix, this guard was previously missing entirely", async () => {
    releasesService.findById.mockResolvedValue(release({ status: "completed" }));
    await expect(
      svc.create(
        PROJECT_ID,
        "release-1",
        { environment: "production", name: "Homepage loads", result: "passed" },
        "actor-1",
      ),
    ).rejects.toThrow(BadRequestException);
    expect(smokeTests.create).not.toHaveBeenCalled();
  });

  it("rejects recording a smoke test against a rolled_back release", async () => {
    releasesService.findById.mockResolvedValue(release({ status: "rolled_back" }));
    await expect(
      svc.create(
        PROJECT_ID,
        "release-1",
        { environment: "staging", name: "Homepage loads", result: "failed" },
        "actor-1",
      ),
    ).rejects.toThrow(BadRequestException);
    expect(smokeTests.create).not.toHaveBeenCalled();
  });

  it("re-validates the parent release when listing (IDOR prevention delegated to ReleasesService)", async () => {
    smokeTests.list.mockResolvedValue([smokeTest()]);
    await svc.list(PROJECT_ID, "release-1", {});
    expect(releasesService.findById).toHaveBeenCalledWith("release-1", PROJECT_ID);
    expect(smokeTests.list).toHaveBeenCalledWith(
      expect.objectContaining({ releaseId: "release-1" }),
    );
  });
});
