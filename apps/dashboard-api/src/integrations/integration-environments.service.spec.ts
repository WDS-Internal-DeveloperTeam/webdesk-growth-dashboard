import type {
  IntegrationEnvironmentEntity,
  IntegrationEnvironmentRepository,
  IntegrationRepository,
} from "@webdesk/database";
import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditService } from "../audit/audit.service.js";
import { IntegrationEnvironmentsService } from "./integration-environments.service.js";

const NOW = new Date("2026-09-07T00:00:00.000Z");
const INTEGRATION_ID = "11111111-1111-4111-8111-111111111111";

function environment(
  overrides: Partial<IntegrationEnvironmentEntity> = {},
): IntegrationEnvironmentEntity {
  return {
    id: "env-1",
    integrationId: INTEGRATION_ID,
    environmentName: "staging",
    status: "not_configured",
    configReference: null,
    notes: null,
    lastVerifiedAt: null,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("IntegrationEnvironmentsService", () => {
  let integrations: { existsById: ReturnType<typeof vi.fn> };
  let environments: {
    create: ReturnType<typeof vi.fn>;
    listByIntegration: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  let auditService: { record: ReturnType<typeof vi.fn> };
  let svc: IntegrationEnvironmentsService;

  beforeEach(() => {
    integrations = { existsById: vi.fn().mockResolvedValue(true) };
    environments = {
      create: vi.fn(),
      listByIntegration: vi.fn(),
      findById: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };
    auditService = { record: vi.fn() };
    svc = new IntegrationEnvironmentsService(
      integrations as unknown as IntegrationRepository,
      environments as unknown as IntegrationEnvironmentRepository,
      auditService as unknown as AuditService,
    );
  });

  describe("create", () => {
    it("validates the parent integration exists first, then creates", async () => {
      environments.create.mockResolvedValue(environment());

      const result = await svc.create(INTEGRATION_ID, { environmentName: "staging" }, "actor-1");

      expect(integrations.existsById).toHaveBeenCalledWith(INTEGRATION_ID);
      expect(result.id).toBe("env-1");
      expect(auditService.record).toHaveBeenCalled();
    });

    it("throws NotFoundException when the parent integration doesn't exist", async () => {
      integrations.existsById.mockResolvedValue(false);

      await expect(
        svc.create(INTEGRATION_ID, { environmentName: "staging" }, "actor-1"),
      ).rejects.toThrow(NotFoundException);
      expect(environments.create).not.toHaveBeenCalled();
    });
  });

  describe("listByIntegration", () => {
    it("returns the repository's list once the parent integration is confirmed", async () => {
      environments.listByIntegration.mockResolvedValue([environment()]);
      const result = await svc.listByIntegration(INTEGRATION_ID);
      expect(result).toHaveLength(1);
    });

    it("throws NotFoundException when the parent integration doesn't exist", async () => {
      integrations.existsById.mockResolvedValue(false);
      await expect(svc.listByIntegration(INTEGRATION_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe("update", () => {
    it("throws NotFoundException when the row (scoped by integrationId) isn't found — IDOR-safe", async () => {
      environments.update.mockResolvedValue(null);

      await expect(
        svc.update("env-1", INTEGRATION_ID, { environmentName: "prod" }, "actor-1"),
      ).rejects.toThrow(NotFoundException);
      expect(environments.update).toHaveBeenCalledWith(
        "env-1",
        INTEGRATION_ID,
        expect.objectContaining({ environmentName: "prod" }),
      );
    });

    it("returns the updated environment and audits it", async () => {
      environments.update.mockResolvedValue(environment({ environmentName: "prod" }));

      const result = await svc.update(
        "env-1",
        INTEGRATION_ID,
        { environmentName: "prod" },
        "actor-1",
      );

      expect(result.environmentName).toBe("prod");
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "update" }),
      );
    });
  });

  describe("remove", () => {
    it("throws NotFoundException when nothing was removed (scoped by integrationId)", async () => {
      environments.remove.mockResolvedValue(false);
      await expect(svc.remove("env-1", INTEGRATION_ID, "actor-1")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("removes and audits on success", async () => {
      environments.remove.mockResolvedValue(true);
      await svc.remove("env-1", INTEGRATION_ID, "actor-1");
      expect(environments.remove).toHaveBeenCalledWith("env-1", INTEGRATION_ID);
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "delete" }),
      );
    });

    it("logs (not throws) when the audit call fails after a successful removal", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      environments.remove.mockResolvedValue(true);
      auditService.record.mockRejectedValue(new Error("audit down"));

      await svc.remove("env-1", INTEGRATION_ID, "actor-1");

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });
});
