import type { SystemSettingEntity, SystemSettingRepository } from "@webdesk/database";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditService } from "../audit/audit.service.js";
import type { AuthorizationService } from "../authz/authorization.service.js";
import { SystemSettingsService } from "./system-settings.service.js";

const NOW = new Date("2026-09-07T00:00:00.000Z");

/** A stand-in for Sequelize's real `UniqueConstraintError` — checked by `.name` in
 *  `SystemSettingsService.create()`/`update()` rather than `instanceof`, since `dashboard-api`
 *  never imports `sequelize` directly (only `packages/database` may). */
function uniqueConstraintError(): Error {
  const error = new Error("Validation error");
  error.name = "SequelizeUniqueConstraintError";
  return error;
}

function setting(overrides: Partial<SystemSettingEntity> = {}): SystemSettingEntity {
  return {
    id: "setting-1",
    publicId: "SETTING-GIT-BRANCH-PATTERN",
    settingType: "git_rule",
    key: "branch-naming-pattern",
    value: { pattern: "^(feature|fix)/[a-z0-9-]+$" },
    description: null,
    isActive: true,
    createdBy: "actor-1",
    updatedBy: "actor-1",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("SystemSettingsService", () => {
  let settings: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findByPublicId: ReturnType<typeof vi.fn>;
    findByTypeAndKey: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateActiveState: ReturnType<typeof vi.fn>;
  };
  let authorizationService: { assertAllowed: ReturnType<typeof vi.fn> };
  let auditService: { record: ReturnType<typeof vi.fn> };
  let svc: SystemSettingsService;

  beforeEach(() => {
    settings = {
      create: vi.fn(),
      findById: vi.fn(),
      findByPublicId: vi.fn(),
      findByTypeAndKey: vi.fn(),
      list: vi.fn(),
      update: vi.fn(),
      updateActiveState: vi.fn(),
    };
    authorizationService = { assertAllowed: vi.fn() };
    auditService = { record: vi.fn() };
    svc = new SystemSettingsService(
      settings as unknown as SystemSettingRepository,
      authorizationService as unknown as AuthorizationService,
      auditService as unknown as AuditService,
    );
  });

  describe("create", () => {
    it("creates a system setting after validating publicId and (settingType, key) are free", async () => {
      settings.findByPublicId.mockResolvedValue(null);
      settings.findByTypeAndKey.mockResolvedValue(null);
      settings.create.mockResolvedValue(setting());

      const result = await svc.create(
        {
          publicId: "SETTING-GIT-BRANCH-PATTERN",
          settingType: "git_rule",
          key: "branch-naming-pattern",
          value: { pattern: "^(feature|fix)/[a-z0-9-]+$" },
        },
        "actor-1",
      );

      expect(result).toEqual(setting());
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "create", entityType: "system_setting" }),
      );
    });

    it("rejects a duplicate publicId", async () => {
      settings.findByPublicId.mockResolvedValue(setting());

      await expect(
        svc.create(
          { publicId: "SETTING-GIT-BRANCH-PATTERN", settingType: "git_rule", key: "x", value: {} },
          "actor-1",
        ),
      ).rejects.toThrow(BadRequestException);
      expect(settings.create).not.toHaveBeenCalled();
    });

    it("rejects a duplicate (settingType, key) pair", async () => {
      settings.findByPublicId.mockResolvedValue(null);
      settings.findByTypeAndKey.mockResolvedValue(setting());

      await expect(
        svc.create(
          {
            publicId: "SETTING-OTHER",
            settingType: "git_rule",
            key: "branch-naming-pattern",
            value: {},
          },
          "actor-1",
        ),
      ).rejects.toThrow(BadRequestException);
      expect(settings.create).not.toHaveBeenCalled();
    });

    it("translates a concurrent uniqueness collision into a clean 400, not a raw 500", async () => {
      settings.findByPublicId.mockResolvedValue(null);
      settings.findByTypeAndKey.mockResolvedValue(null);
      settings.create.mockRejectedValue(uniqueConstraintError());

      await expect(
        svc.create(
          { publicId: "SETTING-RACE", settingType: "git_rule", key: "race-key", value: {} },
          "actor-1",
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("re-throws a non-uniqueness error from create() unchanged", async () => {
      settings.findByPublicId.mockResolvedValue(null);
      settings.findByTypeAndKey.mockResolvedValue(null);
      const dbError = new Error("connection reset");
      settings.create.mockRejectedValue(dbError);

      await expect(
        svc.create(
          { publicId: "SETTING-X", settingType: "git_rule", key: "x", value: {} },
          "actor-1",
        ),
      ).rejects.toBe(dbError);
    });
  });

  describe("findById", () => {
    it("throws NotFoundException when the setting does not exist", async () => {
      settings.findById.mockResolvedValue(null);
      await expect(svc.findById("missing")).rejects.toThrow(NotFoundException);
    });

    it("returns the setting when it exists", async () => {
      settings.findById.mockResolvedValue(setting());
      await expect(svc.findById("setting-1")).resolves.toEqual(setting());
    });
  });

  describe("list", () => {
    it("delegates the filter straight through to the repository", async () => {
      settings.list.mockResolvedValue([setting()]);
      const result = await svc.list({ settingType: "git_rule" });
      expect(settings.list).toHaveBeenCalledWith({ settingType: "git_rule" });
      expect(result).toEqual([setting()]);
    });
  });

  describe("update", () => {
    it("throws NotFoundException when the setting doesn't exist", async () => {
      settings.findById.mockResolvedValue(null);

      await expect(svc.update("missing", { key: "new-key" }, "actor-1")).rejects.toThrow(
        NotFoundException,
      );
      expect(settings.update).not.toHaveBeenCalled();
    });

    it("edits content fields regardless of isActive (no terminal-state concept)", async () => {
      settings.findById.mockResolvedValue(setting({ isActive: false }));
      settings.update.mockResolvedValue(setting({ isActive: false, key: "renamed-key" }));

      const result = await svc.update("setting-1", { key: "renamed-key" }, "actor-1");

      expect(result.key).toBe("renamed-key");
      expect(settings.update).toHaveBeenCalledWith("setting-1", {
        key: "renamed-key",
        updatedBy: "actor-1",
      });
    });

    it("translates a concurrent (settingType, key) collision on update into a clean 400", async () => {
      settings.findById.mockResolvedValue(setting());
      settings.update.mockRejectedValue(uniqueConstraintError());

      await expect(svc.update("setting-1", { key: "already-taken" }, "actor-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("never accepts isActive through the general update patch", async () => {
      settings.findById.mockResolvedValue(setting());
      settings.update.mockResolvedValue(setting({ key: "renamed" }));

      await svc.update("setting-1", { key: "renamed" }, "actor-1");

      const [, patchArg] = settings.update.mock.calls[0] as [string, Record<string, unknown>];
      expect(patchArg).not.toHaveProperty("isActive");
    });

    it("returns the repository's updated entity and records an audit event", async () => {
      settings.findById.mockResolvedValue(setting());
      settings.update.mockResolvedValue(setting({ key: "renamed" }));

      const result = await svc.update("setting-1", { key: "renamed" }, "actor-1");

      expect(result.key).toBe("renamed");
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "update", entityType: "system_setting" }),
      );
    });

    it("throws NotFoundException if the row is gone by the time the write runs", async () => {
      settings.findById.mockResolvedValue(setting());
      settings.update.mockResolvedValue(null);

      await expect(svc.update("setting-1", { key: "renamed" }, "actor-1")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("updateActiveState", () => {
    it("checks the 'configure' action (not 'edit') before toggling", async () => {
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      settings.updateActiveState.mockResolvedValue({
        outcome: "updated",
        entity: setting({ isActive: false }),
      });

      const result = await svc.updateActiveState("setting-1", false, "actor-1");

      expect(authorizationService.assertAllowed).toHaveBeenCalledWith(
        "actor-1",
        "system_settings",
        "configure",
      );
      expect(result.isActive).toBe(false);
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "deactivate", entityType: "system_setting" }),
      );
    });

    it("passes an optional expectedIsActive through to the repository as a CAS guard", async () => {
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      settings.updateActiveState.mockResolvedValue({
        outcome: "updated",
        entity: setting({ isActive: true }),
      });

      await svc.updateActiveState("setting-1", true, "actor-1", false);

      expect(settings.updateActiveState).toHaveBeenCalledWith("setting-1", true, "actor-1", false);
    });

    it("propagates a denial from assertAllowed and never attempts the write", async () => {
      authorizationService.assertAllowed.mockRejectedValue(
        new ForbiddenException("Missing permission: system_settings:configure"),
      );

      await expect(svc.updateActiveState("setting-1", false, "actor-1")).rejects.toThrow(
        ForbiddenException,
      );
      expect(settings.updateActiveState).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when the atomic write reports not_found", async () => {
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      settings.updateActiveState.mockResolvedValue({ outcome: "not_found" });

      await expect(svc.updateActiveState("setting-1", true, "actor-1")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws ConflictException when the CAS guard rejects a stale expectedIsActive", async () => {
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      settings.updateActiveState.mockResolvedValue({
        outcome: "conflict",
        entity: setting({ isActive: true }),
      });

      await expect(svc.updateActiveState("setting-1", false, "actor-1", false)).rejects.toThrow(
        ConflictException,
      );
    });

    it("logs (not throws) when the audit call fails after a successful active-state write", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      settings.updateActiveState.mockResolvedValue({
        outcome: "updated",
        entity: setting({ isActive: true }),
      });
      auditService.record.mockRejectedValue(new Error("audit down"));

      const result = await svc.updateActiveState("setting-1", true, "actor-1");

      expect(result.isActive).toBe(true);
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });
});
