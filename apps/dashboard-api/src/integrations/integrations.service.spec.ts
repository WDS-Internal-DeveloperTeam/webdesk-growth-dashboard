import type { IntegrationEntity, IntegrationRepository } from "@webdesk/database";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditService } from "../audit/audit.service.js";
import { IntegrationsService } from "./integrations.service.js";

const NOW = new Date("2026-09-07T00:00:00.000Z");

/** A stand-in for Sequelize's real `UniqueConstraintError` — checked by `.name` in
 *  `IntegrationsService.create()` rather than `instanceof`, since `dashboard-api` never imports
 *  `sequelize` directly (only `packages/database` may). */
function uniqueConstraintError(): Error {
  const error = new Error("Validation error");
  error.name = "SequelizeUniqueConstraintError";
  return error;
}

function integration(overrides: Partial<IntegrationEntity> = {}): IntegrationEntity {
  return {
    id: "integration-1",
    publicId: "INT-GITHUB",
    provider: "github",
    displayName: "GitHub",
    status: "not_configured",
    configReference: null,
    notes: null,
    lastVerifiedAt: null,
    lastVerifiedByUserId: null,
    lastVerificationResult: null,
    lastVerificationNotes: null,
    isActive: true,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("IntegrationsService", () => {
  let repo: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findByPublicId: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    recordVerification: ReturnType<typeof vi.fn>;
    setActive: ReturnType<typeof vi.fn>;
  };
  let auditService: { record: ReturnType<typeof vi.fn> };
  let svc: IntegrationsService;

  beforeEach(() => {
    repo = {
      create: vi.fn(),
      findById: vi.fn(),
      findByPublicId: vi.fn(),
      list: vi.fn(),
      update: vi.fn(),
      recordVerification: vi.fn(),
      setActive: vi.fn(),
    };
    auditService = { record: vi.fn() };
    svc = new IntegrationsService(
      repo as unknown as IntegrationRepository,
      auditService as unknown as AuditService,
    );
  });

  describe("create", () => {
    it("creates an integration after validating the publicId is free", async () => {
      repo.findByPublicId.mockResolvedValue(null);
      repo.create.mockResolvedValue(integration());

      const result = await svc.create(
        { publicId: "INT-GITHUB", provider: "github", displayName: "GitHub" },
        "actor-1",
      );

      expect(result).toEqual(integration());
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "create", entityType: "integration" }),
      );
    });

    it("rejects a duplicate publicId", async () => {
      repo.findByPublicId.mockResolvedValue(integration());

      await expect(
        svc.create({ publicId: "INT-GITHUB", provider: "github", displayName: "X" }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it("translates a concurrent publicId collision into a clean 400, not a raw 500", async () => {
      repo.findByPublicId.mockResolvedValue(null);
      repo.create.mockRejectedValue(uniqueConstraintError());

      await expect(
        svc.create({ publicId: "INT-RACE", provider: "other", displayName: "X" }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("re-throws a non-uniqueness error from create() unchanged", async () => {
      repo.findByPublicId.mockResolvedValue(null);
      const dbError = new Error("connection reset");
      repo.create.mockRejectedValue(dbError);

      await expect(
        svc.create({ publicId: "INT-X", provider: "other", displayName: "X" }, "actor-1"),
      ).rejects.toBe(dbError);
    });
  });

  describe("findById", () => {
    it("throws NotFoundException when the integration does not exist", async () => {
      repo.findById.mockResolvedValue(null);
      await expect(svc.findById("missing")).rejects.toThrow(NotFoundException);
    });

    it("returns the integration when it exists", async () => {
      repo.findById.mockResolvedValue(integration());
      await expect(svc.findById("integration-1")).resolves.toEqual(integration());
    });
  });

  describe("list", () => {
    it("delegates the filter straight through to the repository", async () => {
      repo.list.mockResolvedValue([integration()]);
      const result = await svc.list({ provider: "github" });
      expect(repo.list).toHaveBeenCalledWith({ provider: "github" });
      expect(result).toEqual([integration()]);
    });
  });

  describe("update", () => {
    it("throws NotFoundException when the integration doesn't exist", async () => {
      // No `findById()` pre-fetch — `update()` relies solely on the repository's own null
      // return, saving a DB round trip (code-review finding, fixed).
      repo.update.mockResolvedValue(null);

      await expect(svc.update("missing", { displayName: "New" }, "actor-1")).rejects.toThrow(
        NotFoundException,
      );
      expect(repo.update).toHaveBeenCalledWith("missing", { displayName: "New" });
    });

    it("stays editable even when isActive is false (no terminal-state concept)", async () => {
      repo.findById.mockResolvedValue(integration({ isActive: false }));
      repo.update.mockResolvedValue(integration({ isActive: false, displayName: "Renamed" }));

      const result = await svc.update("integration-1", { displayName: "Renamed" }, "actor-1");
      expect(result.displayName).toBe("Renamed");
    });

    it("never accepts status/lastVerified*/isActive through the general update patch", async () => {
      repo.findById.mockResolvedValue(integration());
      repo.update.mockResolvedValue(integration({ displayName: "Renamed" }));

      await svc.update("integration-1", { displayName: "Renamed" }, "actor-1");

      const [, patchArg] = repo.update.mock.calls[0] as [string, Record<string, unknown>];
      expect(patchArg).not.toHaveProperty("status");
      expect(patchArg).not.toHaveProperty("lastVerifiedAt");
      expect(patchArg).not.toHaveProperty("isActive");
    });
  });

  describe("verify", () => {
    it("moves status to connected on a success result", async () => {
      repo.findById.mockResolvedValue(integration({ status: "not_configured" }));
      repo.recordVerification.mockResolvedValue(integration({ status: "connected" }));

      const result = await svc.verify("integration-1", { result: "success" }, "actor-1");

      expect(repo.recordVerification).toHaveBeenCalledWith(
        "integration-1",
        expect.objectContaining({ status: "connected", result: "success" }),
      );
      expect(result.status).toBe("connected");
    });

    it("moves status to error on a failure result", async () => {
      repo.findById.mockResolvedValue(integration({ status: "connected" }));
      repo.recordVerification.mockResolvedValue(integration({ status: "error" }));

      await svc.verify("integration-1", { result: "failure" }, "actor-1");

      expect(repo.recordVerification).toHaveBeenCalledWith(
        "integration-1",
        expect.objectContaining({ status: "error", result: "failure" }),
      );
    });

    it("leaves status untouched on an unknown result", async () => {
      repo.findById.mockResolvedValue(integration({ status: "connected" }));
      repo.recordVerification.mockResolvedValue(integration({ status: "connected" }));

      await svc.verify("integration-1", { result: "unknown" }, "actor-1");

      expect(repo.recordVerification).toHaveBeenCalledWith(
        "integration-1",
        expect.objectContaining({ status: "connected", result: "unknown" }),
      );
    });

    it("throws NotFoundException when the write reports 0 affected rows", async () => {
      repo.findById.mockResolvedValue(integration());
      repo.recordVerification.mockResolvedValue(null);

      await expect(svc.verify("integration-1", { result: "success" }, "actor-1")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("logs (not throws) when the audit call fails after a successful verification", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      repo.findById.mockResolvedValue(integration());
      repo.recordVerification.mockResolvedValue(integration({ status: "connected" }));
      auditService.record.mockRejectedValue(new Error("audit down"));

      const result = await svc.verify("integration-1", { result: "success" }, "actor-1");

      expect(result.status).toBe("connected");
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe("setActive", () => {
    it("toggles isActive and records an audit event", async () => {
      repo.findById.mockResolvedValue(integration({ isActive: true }));
      repo.setActive.mockResolvedValue(integration({ isActive: false }));

      const result = await svc.setActive("integration-1", false, "actor-1");

      expect(repo.setActive).toHaveBeenCalledWith("integration-1", false);
      expect(result.isActive).toBe(false);
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "deactivate" }),
      );
    });

    it("throws NotFoundException when the integration doesn't exist", async () => {
      // No `findById()` pre-fetch — `setActive()` relies solely on the repository's own null
      // return, saving a DB round trip (code-review finding, fixed).
      repo.setActive.mockResolvedValue(null);
      await expect(svc.setActive("missing", true, "actor-1")).rejects.toThrow(NotFoundException);
      expect(repo.setActive).toHaveBeenCalledWith("missing", true);
    });
  });
});
