import type { TechnicalFindingEntity, TechnicalFindingRepository } from "@webdesk/database";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditService } from "../audit/audit.service.js";
import type { AuthorizationService } from "../authz/authorization.service.js";
import { TechnicalFindingsService } from "./technical-findings.service.js";

const NOW = new Date("2026-09-02T00:00:00.000Z");
const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_PROJECT_ID = "99999999-9999-4999-8999-999999999999";

function finding(overrides: Partial<TechnicalFindingEntity> = {}): TechnicalFindingEntity {
  return {
    id: "finding-1",
    projectId: PROJECT_ID,
    publicId: "TCF-1",
    technicalCheckRunId: "run-1",
    category: null,
    severity: "high",
    title: "Missing PHPCS config",
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

describe("TechnicalFindingsService", () => {
  let repo: {
    findById: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    updateStatus: ReturnType<typeof vi.fn>;
  };
  let authorizationService: { assertAllowed: ReturnType<typeof vi.fn> };
  let auditService: { record: ReturnType<typeof vi.fn> };
  let svc: TechnicalFindingsService;

  beforeEach(() => {
    repo = { findById: vi.fn(), list: vi.fn(), updateStatus: vi.fn() };
    authorizationService = { assertAllowed: vi.fn() };
    auditService = { record: vi.fn() };
    svc = new TechnicalFindingsService(
      repo as unknown as TechnicalFindingRepository,
      authorizationService as unknown as AuthorizationService,
      auditService as unknown as AuditService,
    );
  });

  describe("findById", () => {
    it("throws NotFoundException for a finding in a different project (IDOR)", async () => {
      repo.findById.mockResolvedValue(finding({ projectId: OTHER_PROJECT_ID }));
      await expect(svc.findById("finding-1", PROJECT_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe("changeStatus", () => {
    it("is a no-op on a same-status request", async () => {
      repo.findById.mockResolvedValue(finding({ status: "open" }));
      const result = await svc.changeStatus("finding-1", PROJECT_ID, "open", "actor-1");
      expect(result.status).toBe("open");
      expect(authorizationService.assertAllowed).not.toHaveBeenCalled();
    });

    it("rejects a transition out of a terminal status", async () => {
      repo.findById.mockResolvedValue(finding({ status: "resolved" }));
      await expect(svc.changeStatus("finding-1", PROJECT_ID, "open", "actor-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("requires the review action and performs an atomic status transition", async () => {
      repo.findById.mockResolvedValue(finding({ status: "open" }));
      repo.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: finding({ status: "resolved", resolvedBy: "actor-1" }),
      });

      const result = await svc.changeStatus("finding-1", PROJECT_ID, "resolved", "actor-1");

      expect(result.status).toBe("resolved");
      expect(authorizationService.assertAllowed).toHaveBeenCalledWith(
        "actor-1",
        "development_code",
        "review",
        PROJECT_ID,
      );
      expect(repo.updateStatus).toHaveBeenCalledWith("finding-1", "open", "resolved", "actor-1");
    });

    it("surfaces a concurrent status change as a clean 409", async () => {
      repo.findById.mockResolvedValue(finding({ status: "open" }));
      repo.updateStatus.mockResolvedValue({
        outcome: "conflict",
        entity: finding({ status: "dismissed" }),
      });

      await expect(
        svc.changeStatus("finding-1", PROJECT_ID, "resolved", "actor-1"),
      ).rejects.toThrow(ConflictException);
    });

    it("allows moving from acknowledged back to open (reconsideration edge)", async () => {
      repo.findById.mockResolvedValue(finding({ status: "acknowledged" }));
      repo.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: finding({ status: "open" }),
      });

      const result = await svc.changeStatus("finding-1", PROJECT_ID, "open", "actor-1");
      expect(result.status).toBe("open");
    });
  });
});
