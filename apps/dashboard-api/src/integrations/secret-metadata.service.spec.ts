import type {
  IntegrationRepository,
  SecretMetadataEntity,
  SecretMetadataRepository,
} from "@webdesk/database";
import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditService } from "../audit/audit.service.js";
import { SecretMetadataService } from "./secret-metadata.service.js";

const NOW = new Date("2026-09-07T00:00:00.000Z");
const INTEGRATION_ID = "11111111-1111-4111-8111-111111111111";

function secret(overrides: Partial<SecretMetadataEntity> = {}): SecretMetadataEntity {
  return {
    id: "secret-1",
    integrationId: INTEGRATION_ID,
    secretName: "GOOGLE_OAUTH_CLIENT_SECRET",
    storageLocation: "Vercel env var — dashboard-api",
    lastRotatedAt: null,
    rotationDueAt: null,
    notes: null,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("SecretMetadataService", () => {
  let integrations: { existsById: ReturnType<typeof vi.fn> };
  let secrets: {
    create: ReturnType<typeof vi.fn>;
    listByIntegration: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  let auditService: { record: ReturnType<typeof vi.fn> };
  let svc: SecretMetadataService;

  beforeEach(() => {
    integrations = { existsById: vi.fn().mockResolvedValue(true) };
    secrets = {
      create: vi.fn(),
      listByIntegration: vi.fn(),
      findById: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };
    auditService = { record: vi.fn() };
    svc = new SecretMetadataService(
      integrations as unknown as IntegrationRepository,
      secrets as unknown as SecretMetadataRepository,
      auditService as unknown as AuditService,
    );
  });

  describe("create", () => {
    it("validates the parent integration exists first, then creates", async () => {
      secrets.create.mockResolvedValue(secret());

      const result = await svc.create(
        INTEGRATION_ID,
        { secretName: "GOOGLE_OAUTH_CLIENT_SECRET", storageLocation: "Vercel env var" },
        "actor-1",
      );

      expect(integrations.existsById).toHaveBeenCalledWith(INTEGRATION_ID);
      expect(result.id).toBe("secret-1");
      expect(auditService.record).toHaveBeenCalled();
    });

    it("throws NotFoundException when the parent integration doesn't exist", async () => {
      integrations.existsById.mockResolvedValue(false);

      await expect(
        svc.create(INTEGRATION_ID, { secretName: "X", storageLocation: "Y" }, "actor-1"),
      ).rejects.toThrow(NotFoundException);
      expect(secrets.create).not.toHaveBeenCalled();
    });

    it("converts ISO date strings to real Date instances before writing", async () => {
      secrets.create.mockResolvedValue(secret());

      await svc.create(
        INTEGRATION_ID,
        {
          secretName: "X",
          storageLocation: "Y",
          lastRotatedAt: "2026-01-01T00:00:00.000Z",
        },
        "actor-1",
      );

      const [writtenInput] = secrets.create.mock.calls[0] as [Record<string, unknown>];
      expect(writtenInput.lastRotatedAt).toBeInstanceOf(Date);
    });
  });

  describe("listByIntegration", () => {
    it("throws NotFoundException when the parent integration doesn't exist", async () => {
      integrations.existsById.mockResolvedValue(false);
      await expect(svc.listByIntegration(INTEGRATION_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe("findById", () => {
    it("throws NotFoundException when the row (scoped by integrationId) isn't found — IDOR-safe", async () => {
      secrets.findById.mockResolvedValue(null);
      await expect(svc.findById("secret-1", INTEGRATION_ID)).rejects.toThrow(NotFoundException);
      expect(secrets.findById).toHaveBeenCalledWith("secret-1", INTEGRATION_ID);
    });
  });

  describe("update", () => {
    it("throws NotFoundException when nothing was updated", async () => {
      secrets.update.mockResolvedValue(null);
      await expect(
        svc.update("secret-1", INTEGRATION_ID, { secretName: "NEW" }, "actor-1"),
      ).rejects.toThrow(NotFoundException);
    });

    it("returns the updated record and audits it", async () => {
      secrets.update.mockResolvedValue(secret({ secretName: "NEW" }));

      const result = await svc.update("secret-1", INTEGRATION_ID, { secretName: "NEW" }, "actor-1");

      expect(result.secretName).toBe("NEW");
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "update" }),
      );
    });
  });

  describe("remove", () => {
    it("throws NotFoundException when nothing was removed (scoped by integrationId)", async () => {
      secrets.remove.mockResolvedValue(false);
      await expect(svc.remove("secret-1", INTEGRATION_ID, "actor-1")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("removes and audits on success", async () => {
      secrets.remove.mockResolvedValue(true);
      await svc.remove("secret-1", INTEGRATION_ID, "actor-1");
      expect(secrets.remove).toHaveBeenCalledWith("secret-1", INTEGRATION_ID);
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "delete" }),
      );
    });
  });
});
