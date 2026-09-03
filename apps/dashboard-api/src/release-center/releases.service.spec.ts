import type {
  ReleaseApprovalRepository,
  ReleaseEntity,
  ReleaseRepository,
  RollbackRecordRepository,
} from "@webdesk/database";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditService } from "../audit/audit.service.js";
import type { AuthorizationService } from "../authz/authorization.service.js";
import type { ProjectService } from "../projects/project.service.js";
import type { UsersService } from "../users/users.service.js";
import { ReleasesService } from "./releases.service.js";

// withTransaction() opens a real Sequelize connection (needs DATABASE_URL) — irrelevant to this
// service's own logic, so it's stubbed to just invoke the callback, matching
// case-studies.service.spec.ts's own established pattern for the identical mocking need.
vi.mock("@webdesk/database", async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports -- vitest's importOriginal<T>() needs the actual module's type inline; no top-level type-only equivalent exists for this generic parameter.
  const actual = await importOriginal<typeof import("@webdesk/database")>();
  return {
    ...actual,
    withTransaction: vi.fn((fn: (transaction: unknown) => unknown) =>
      fn({ fakeTransaction: true }),
    ),
  };
});

const NOW = new Date("2026-09-02T00:00:00.000Z");
const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_PROJECT_ID = "99999999-9999-4999-8999-999999999999";
const OTHER_RELEASE_ID = "88888888-8888-4888-8888-888888888888";

function uniqueConstraintError(): Error {
  const error = new Error("Validation error");
  error.name = "SequelizeUniqueConstraintError";
  return error;
}

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
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("ReleasesService", () => {
  let releases: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findByPublicId: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateStatus: ReturnType<typeof vi.fn>;
  };
  let releaseApprovals: {
    create: ReturnType<typeof vi.fn>;
    listByRelease: ReturnType<typeof vi.fn>;
  };
  let rollbackRecords: {
    create: ReturnType<typeof vi.fn>;
    findByReleaseId: ReturnType<typeof vi.fn>;
  };
  let projects: { findById: ReturnType<typeof vi.fn> };
  let usersService: { assertUserExists: ReturnType<typeof vi.fn> };
  let authorizationService: { assertAllowed: ReturnType<typeof vi.fn> };
  let auditService: { record: ReturnType<typeof vi.fn> };
  let svc: ReleasesService;

  beforeEach(() => {
    releases = {
      create: vi.fn(),
      findById: vi.fn(),
      findByPublicId: vi.fn().mockResolvedValue(null),
      list: vi.fn(),
      update: vi.fn(),
      updateStatus: vi.fn(),
    };
    releaseApprovals = { create: vi.fn(), listByRelease: vi.fn() };
    rollbackRecords = { create: vi.fn(), findByReleaseId: vi.fn() };
    projects = { findById: vi.fn().mockResolvedValue({ id: PROJECT_ID }) };
    usersService = { assertUserExists: vi.fn().mockResolvedValue(undefined) };
    authorizationService = { assertAllowed: vi.fn() };
    auditService = { record: vi.fn() };
    svc = new ReleasesService(
      releases as unknown as ReleaseRepository,
      releaseApprovals as unknown as ReleaseApprovalRepository,
      rollbackRecords as unknown as RollbackRecordRepository,
      projects as unknown as ProjectService,
      usersService as unknown as UsersService,
      authorizationService as unknown as AuthorizationService,
      auditService as unknown as AuditService,
    );
  });

  describe("create", () => {
    const input = {
      publicId: "REL-001",
      releaseType: "staging" as const,
      title: "September release",
    };

    it("creates a release starting proposed", async () => {
      releases.create.mockResolvedValue(release());
      const result = await svc.create(PROJECT_ID, input, "actor-1");
      expect(result.status).toBe("proposed");
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "data_change", action: "create" }),
      );
    });

    it("rejects a duplicate publicId (pre-check)", async () => {
      releases.findByPublicId.mockResolvedValue(release());
      await expect(svc.create(PROJECT_ID, input, "actor-1")).rejects.toThrow(BadRequestException);
      expect(releases.create).not.toHaveBeenCalled();
    });

    it("converts a TOCTOU unique-constraint race into a clean 400", async () => {
      releases.create.mockRejectedValue(uniqueConstraintError());
      await expect(svc.create(PROJECT_ID, input, "actor-1")).rejects.toThrow(BadRequestException);
    });
  });

  describe("findById", () => {
    it("throws NotFoundException for a release in a different project (IDOR)", async () => {
      releases.findById.mockResolvedValue(release({ projectId: OTHER_PROJECT_ID }));
      await expect(svc.findById("release-1", PROJECT_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe("update", () => {
    it("rejects editing a completed release", async () => {
      releases.findById.mockResolvedValue(release({ status: "completed" }));
      await expect(
        svc.update("release-1", PROJECT_ID, { title: "New title" }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
      expect(releases.update).not.toHaveBeenCalled();
    });

    it("rejects editing a rolled-back release", async () => {
      releases.findById.mockResolvedValue(release({ status: "rolled_back" }));
      await expect(
        svc.update("release-1", PROJECT_ID, { title: "New title" }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("allows editing a non-terminal release", async () => {
      releases.findById.mockResolvedValue(release({ status: "proposed" }));
      releases.update.mockResolvedValue(release({ title: "New title" }));
      const result = await svc.update("release-1", PROJECT_ID, { title: "New title" }, "actor-1");
      expect(result.title).toBe("New title");
    });
  });

  describe("changeStatus", () => {
    it("returns the release unchanged and does no work on a same-status request", async () => {
      releases.findById.mockResolvedValue(release({ status: "proposed" }));
      const result = await svc.changeStatus(
        "release-1",
        PROJECT_ID,
        { status: "proposed" },
        "actor-1",
      );
      expect(result.status).toBe("proposed");
      expect(authorizationService.assertAllowed).not.toHaveBeenCalled();
      expect(releases.updateStatus).not.toHaveBeenCalled();
    });

    it("rejects an invalid transition", async () => {
      releases.findById.mockResolvedValue(release({ status: "proposed" }));
      await expect(
        svc.changeStatus("release-1", PROJECT_ID, { status: "completed" }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("requires the submit action and performs an atomic status transition", async () => {
      releases.findById.mockResolvedValue(release({ status: "proposed" }));
      releases.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: release({ status: "checks_running" }),
      });

      const result = await svc.changeStatus(
        "release-1",
        PROJECT_ID,
        { status: "checks_running" },
        "actor-1",
      );

      expect(result.status).toBe("checks_running");
      expect(authorizationService.assertAllowed).toHaveBeenCalledWith(
        "actor-1",
        "releases",
        "submit",
        PROJECT_ID,
      );
    });

    it("surfaces a concurrent status change as a clean 409", async () => {
      releases.findById.mockResolvedValue(release({ status: "proposed" }));
      releases.updateStatus.mockResolvedValue({
        outcome: "conflict",
        entity: release({ status: "checks_running" }),
      });
      await expect(
        svc.changeStatus("release-1", PROJECT_ID, { status: "checks_running" }, "actor-1"),
      ).rejects.toThrow(ConflictException);
    });

    it("inserts a release_approvals row (approved) alongside an approve-action transition", async () => {
      releases.findById.mockResolvedValue(release({ status: "staging_verification" }));
      releases.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: release({ status: "staging_approved" }),
      });

      await svc.changeStatus(
        "release-1",
        PROJECT_ID,
        { status: "staging_approved", notes: "Looks good" },
        "actor-1",
      );

      expect(releaseApprovals.create).toHaveBeenCalledWith(
        expect.objectContaining({
          releaseId: "release-1",
          projectId: PROJECT_ID,
          approvalStage: "staging",
          decision: "approved",
          decidedByUserId: "actor-1",
          notes: "Looks good",
        }),
        expect.anything(),
      );
      expect(authorizationService.assertAllowed).toHaveBeenCalledWith(
        "actor-1",
        "releases",
        "approve",
        PROJECT_ID,
      );
    });

    it("inserts a release_approvals row (rejected) on a review-gated failure transition — code-review fix, previously never logged", async () => {
      releases.findById.mockResolvedValue(release({ status: "staging_verification" }));
      releases.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: release({ status: "verification_failed" }),
      });

      await svc.changeStatus(
        "release-1",
        PROJECT_ID,
        { status: "verification_failed", notes: "Broken login flow" },
        "actor-1",
      );

      expect(releaseApprovals.create).toHaveBeenCalledWith(
        expect.objectContaining({
          releaseId: "release-1",
          projectId: PROJECT_ID,
          approvalStage: "staging",
          decision: "rejected",
          decidedByUserId: "actor-1",
          notes: "Broken login flow",
        }),
        expect.anything(),
      );
      // This transition's own action is "review", not "approve" — confirms the gate is now
      // approvalLog presence, not action === "approve".
      expect(authorizationService.assertAllowed).toHaveBeenCalledWith(
        "actor-1",
        "releases",
        "review",
        PROJECT_ID,
      );
    });

    it("inserts a release_approvals row (hotfix_required) on a hotfix-triggering transition", async () => {
      releases.findById.mockResolvedValue(release({ status: "production_verification" }));
      releases.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: release({ status: "hotfix_required" }),
      });

      await svc.changeStatus("release-1", PROJECT_ID, { status: "hotfix_required" }, "actor-1");

      expect(releaseApprovals.create).toHaveBeenCalledWith(
        expect.objectContaining({
          approvalStage: "production",
          decision: "hotfix_required",
        }),
        expect.anything(),
      );
    });

    it("rejects a rollback transition missing reason", async () => {
      releases.findById.mockResolvedValue(release({ status: "staging_deployed" }));
      await expect(
        svc.changeStatus(
          "release-1",
          PROJECT_ID,
          { status: "rolled_back", rolledBackSha: "abc123" },
          "actor-1",
        ),
      ).rejects.toThrow(BadRequestException);
      expect(releases.updateStatus).not.toHaveBeenCalled();
    });

    it("rejects a rollback transition missing rolledBackSha", async () => {
      releases.findById.mockResolvedValue(release({ status: "staging_deployed" }));
      await expect(
        svc.changeStatus(
          "release-1",
          PROJECT_ID,
          { status: "rolled_back", reason: "bad build" },
          "actor-1",
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("creates a rollback_records row on a valid rollback transition", async () => {
      releases.findById.mockResolvedValue(release({ status: "staging_deployed" }));
      releases.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: release({ status: "rolled_back" }),
      });

      await svc.changeStatus(
        "release-1",
        PROJECT_ID,
        { status: "rolled_back", reason: "bad build", rolledBackSha: "abc123" },
        "actor-1",
      );

      expect(rollbackRecords.create).toHaveBeenCalledWith(
        expect.objectContaining({
          releaseId: "release-1",
          projectId: PROJECT_ID,
          rolledBackSha: "abc123",
          reason: "bad build",
          rolledBackByUserId: "actor-1",
        }),
        expect.anything(),
      );
      expect(authorizationService.assertAllowed).toHaveBeenCalledWith(
        "actor-1",
        "releases",
        "release",
        PROJECT_ID,
      );
    });

    it("existence-validates replacementReleaseId within the same project", async () => {
      releases.findById
        .mockResolvedValueOnce(release({ status: "staging_deployed" }))
        .mockResolvedValueOnce(null);

      await expect(
        svc.changeStatus(
          "release-1",
          PROJECT_ID,
          {
            status: "rolled_back",
            reason: "bad build",
            rolledBackSha: "abc123",
            replacementReleaseId: OTHER_RELEASE_ID,
          },
          "actor-1",
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects a replacementReleaseId that references the release itself", async () => {
      releases.findById.mockResolvedValue(release({ status: "staging_deployed" }));

      await expect(
        svc.changeStatus(
          "release-1",
          PROJECT_ID,
          {
            status: "rolled_back",
            reason: "bad build",
            rolledBackSha: "abc123",
            replacementReleaseId: "release-1",
          },
          "actor-1",
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("stamps productionApproverUserId only on production_approval -> production_deployed", async () => {
      releases.findById.mockResolvedValue(release({ status: "production_approval" }));
      releases.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: release({ status: "production_deployed" }),
      });

      await svc.changeStatus("release-1", PROJECT_ID, { status: "production_deployed" }, "actor-1");

      expect(releases.updateStatus).toHaveBeenCalledWith(
        "release-1",
        "production_approval",
        "production_deployed",
        "actor-1",
        expect.anything(),
      );
    });
  });

  describe("listApprovals", () => {
    it("scopes by project before listing", async () => {
      releases.findById.mockResolvedValue(release());
      releaseApprovals.listByRelease.mockResolvedValue([]);
      await svc.listApprovals("release-1", PROJECT_ID);
      expect(releaseApprovals.listByRelease).toHaveBeenCalledWith("release-1");
    });

    it("throws NotFoundException for a release in a different project", async () => {
      releases.findById.mockResolvedValue(release({ projectId: OTHER_PROJECT_ID }));
      await expect(svc.listApprovals("release-1", PROJECT_ID)).rejects.toThrow(NotFoundException);
    });
  });
});
