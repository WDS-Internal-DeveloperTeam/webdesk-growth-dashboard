import type { ComponentEntity, ComponentRepository } from "@webdesk/database";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditService } from "../audit/audit.service.js";
import type { AuthorizationService } from "../authz/authorization.service.js";
import type { DesignTokensService } from "../design-token-library/design-tokens.service.js";
import { ComponentsService } from "./components.service.js";

// withTransaction() opens a real Sequelize connection (needs DATABASE_URL) — irrelevant to this
// service's own logic, so it's stubbed to just invoke the callback, matching
// DesignTokensService's/WebsiteStrategyRecordsService's own identical spec-file pattern.
// update()'s "-> new version" branch and changeApprovalStatus()'s "-> approved" branch both go
// through it.
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

const NOW = new Date("2026-08-31T00:00:00.000Z");

/** A stand-in for Sequelize's real `UniqueConstraintError` — checked by `.name` in
 *  `ComponentsService.create()` (via the shared `isSequelizeUniqueConstraintError()` helper)
 *  rather than `instanceof`, since `dashboard-api` never imports `sequelize` directly (only
 *  `packages/database` may). */
function uniqueConstraintError(): Error {
  const error = new Error("Validation error");
  error.name = "SequelizeUniqueConstraintError";
  return error;
}

function component(overrides: Partial<ComponentEntity> = {}): ComponentEntity {
  return {
    id: "row-1",
    recordId: "record-1",
    publicId: "CMP-BUTTON-PRIMARY",
    category: "buttons",
    versionNumber: 1,
    isCurrent: true,
    name: "Primary Button",
    figmaReference: "https://figma.com/file/abc",
    tokenIds: [],
    htmlStructure: '<button class="btn-primary">{{label}}</button>',
    phpPath: "components/buttons/primary.php",
    scssClassesPath: "components/_buttons.scss",
    jsDependencies: null,
    states: "default, hover, focus, disabled",
    responsiveBehavior: null,
    browserSupport: null,
    accessibility: null,
    schema: null,
    analytics: null,
    tests: null,
    replacementRecordId: null,
    approvalStatus: "draft",
    createdBy: "actor-1",
    updatedBy: "actor-1",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("ComponentsService", () => {
  let components: {
    create: ReturnType<typeof vi.fn>;
    createNewVersion: ReturnType<typeof vi.fn>;
    findCurrentByRecordId: ReturnType<typeof vi.fn>;
    findCurrentByPublicId: ReturnType<typeof vi.fn>;
    listVersions: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    updateInPlace: ReturnType<typeof vi.fn>;
    updateApprovalStatus: ReturnType<typeof vi.fn>;
    supersedeOtherApprovedVersion: ReturnType<typeof vi.fn>;
  };
  let authorizationService: { assertAllowed: ReturnType<typeof vi.fn> };
  let auditService: { record: ReturnType<typeof vi.fn> };
  let designTokensService: { existingTokenIds: ReturnType<typeof vi.fn> };
  let svc: ComponentsService;

  beforeEach(() => {
    components = {
      create: vi.fn(),
      createNewVersion: vi.fn(),
      findCurrentByRecordId: vi.fn(),
      findCurrentByPublicId: vi.fn(),
      listVersions: vi.fn(),
      list: vi.fn(),
      updateInPlace: vi.fn(),
      updateApprovalStatus: vi.fn(),
      supersedeOtherApprovedVersion: vi.fn(),
    };
    authorizationService = { assertAllowed: vi.fn() };
    auditService = { record: vi.fn() };
    designTokensService = { existingTokenIds: vi.fn().mockResolvedValue(new Set()) };
    svc = new ComponentsService(
      components as unknown as ComponentRepository,
      authorizationService as unknown as AuthorizationService,
      auditService as unknown as AuditService,
      designTokensService as unknown as DesignTokensService,
    );
  });

  describe("create", () => {
    it("creates a component after validating the publicId is free", async () => {
      components.findCurrentByPublicId.mockResolvedValue(null);
      components.create.mockResolvedValue(component());

      const result = await svc.create(
        {
          publicId: "CMP-BUTTON-PRIMARY",
          category: "buttons",
          name: "Primary Button",
        },
        "actor-1",
      );

      expect(result).toEqual(component());
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "create", entityType: "component" }),
      );
    });

    it("defaults tokenIds to an empty array when omitted", async () => {
      components.findCurrentByPublicId.mockResolvedValue(null);
      components.create.mockResolvedValue(component());

      await svc.create({ publicId: "CMP-X", category: "cards", name: "Card" }, "actor-1");

      const [writtenInput] = components.create.mock.calls[0] as [Record<string, unknown>];
      expect(writtenInput.tokenIds).toEqual([]);
    });

    it("validates tokenIds against real design tokens before creating", async () => {
      components.findCurrentByPublicId.mockResolvedValue(null);
      designTokensService.existingTokenIds.mockResolvedValue(new Set(["token-1"]));
      components.create.mockResolvedValue(component({ tokenIds: ["token-1"] }));

      await svc.create(
        { publicId: "CMP-X", category: "cards", name: "Card", tokenIds: ["token-1"] },
        "actor-1",
      );

      expect(designTokensService.existingTokenIds).toHaveBeenCalledWith(["token-1"]);
      expect(components.create).toHaveBeenCalled();
    });

    it("rejects creation when a tokenId does not resolve to a real design token", async () => {
      components.findCurrentByPublicId.mockResolvedValue(null);
      designTokensService.existingTokenIds.mockResolvedValue(new Set());

      await expect(
        svc.create(
          { publicId: "CMP-X", category: "cards", name: "Card", tokenIds: ["missing-token"] },
          "actor-1",
        ),
      ).rejects.toThrow(BadRequestException);
      expect(components.create).not.toHaveBeenCalled();
    });

    it("rejects creation when replacementRecordId does not resolve to a real component", async () => {
      components.findCurrentByPublicId.mockResolvedValue(null);
      components.findCurrentByRecordId.mockResolvedValue(null);

      await expect(
        svc.create(
          {
            publicId: "CMP-X",
            category: "cards",
            name: "Card",
            replacementRecordId: "missing-record",
          },
          "actor-1",
        ),
      ).rejects.toThrow(BadRequestException);
      expect(components.create).not.toHaveBeenCalled();
    });

    it("allows creation when replacementRecordId resolves to a real component", async () => {
      components.findCurrentByPublicId.mockResolvedValue(null);
      components.findCurrentByRecordId.mockResolvedValue(component({ recordId: "record-2" }));
      components.create.mockResolvedValue(component());

      await svc.create(
        {
          publicId: "CMP-X",
          category: "cards",
          name: "Card",
          replacementRecordId: "record-2",
        },
        "actor-1",
      );

      expect(components.create).toHaveBeenCalled();
    });

    it("rejects a duplicate publicId", async () => {
      components.findCurrentByPublicId.mockResolvedValue(component());

      await expect(
        svc.create({ publicId: "CMP-BUTTON-PRIMARY", category: "buttons", name: "X" }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
      expect(components.create).not.toHaveBeenCalled();
    });

    it("translates a concurrent publicId collision into a clean 400, not a raw 500", async () => {
      components.findCurrentByPublicId.mockResolvedValue(null);
      components.create.mockRejectedValue(uniqueConstraintError());

      await expect(
        svc.create({ publicId: "CMP-RACE", category: "buttons", name: "X" }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("re-throws a non-uniqueness error from create() unchanged", async () => {
      components.findCurrentByPublicId.mockResolvedValue(null);
      const dbError = new Error("connection reset");
      components.create.mockRejectedValue(dbError);

      await expect(
        svc.create({ publicId: "CMP-X", category: "buttons", name: "X" }, "actor-1"),
      ).rejects.toBe(dbError);
    });
  });

  describe("findCurrent", () => {
    it("throws NotFoundException when no current version exists for the recordId", async () => {
      components.findCurrentByRecordId.mockResolvedValue(null);
      await expect(svc.findCurrent("missing")).rejects.toThrow(NotFoundException);
    });

    it("returns the current version when it exists", async () => {
      components.findCurrentByRecordId.mockResolvedValue(component());
      await expect(svc.findCurrent("record-1")).resolves.toEqual(component());
    });
  });

  describe("listVersions", () => {
    it("throws NotFoundException when the recordId has zero rows at all", async () => {
      components.listVersions.mockResolvedValue([]);
      await expect(svc.listVersions("missing")).rejects.toThrow(NotFoundException);
    });

    it("returns every version, oldest first, when the recordId exists", async () => {
      const versions = [
        component({
          id: "row-1",
          versionNumber: 1,
          isCurrent: false,
          approvalStatus: "superseded",
        }),
        component({ id: "row-2", versionNumber: 2, isCurrent: true, approvalStatus: "approved" }),
      ];
      components.listVersions.mockResolvedValue(versions);
      await expect(svc.listVersions("record-1")).resolves.toEqual(versions);
    });
  });

  describe("list", () => {
    it("delegates the filter straight through to the repository", async () => {
      components.list.mockResolvedValue([component()]);
      const result = await svc.list({ approvalStatus: "draft" });
      expect(components.list).toHaveBeenCalledWith({ approvalStatus: "draft" });
      expect(result).toEqual([component()]);
    });
  });

  describe("update — non-approved current version (in-place mutation)", () => {
    it("mutates the current row in place, without creating a new version row", async () => {
      components.findCurrentByRecordId.mockResolvedValue(component({ approvalStatus: "draft" }));
      components.updateInPlace.mockResolvedValue(component({ name: "Renamed" }));

      const result = await svc.update("record-1", { name: "Renamed" }, "actor-1");

      expect(result.name).toBe("Renamed");
      // The trailing "draft" is the CAS guard.
      expect(components.updateInPlace).toHaveBeenCalledWith(
        "row-1",
        expect.objectContaining({ name: "Renamed", updatedBy: "actor-1" }),
        undefined,
        "draft",
      );
      expect(components.createNewVersion).not.toHaveBeenCalled();
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "update", entityType: "component" }),
      );
    });

    it("validates tokenIds/replacementRecordId before mutating in place", async () => {
      components.findCurrentByRecordId
        .mockResolvedValueOnce(component({ approvalStatus: "draft" })) // findCurrent()
        .mockResolvedValueOnce(component({ recordId: "record-9" })); // assertReplacementExists()
      designTokensService.existingTokenIds.mockResolvedValue(new Set(["token-1"]));
      components.updateInPlace.mockResolvedValue(component());

      await svc.update(
        "record-1",
        { tokenIds: ["token-1"], replacementRecordId: "record-9" },
        "actor-1",
      );

      expect(designTokensService.existingTokenIds).toHaveBeenCalledWith(["token-1"]);
      expect(components.updateInPlace).toHaveBeenCalled();
    });

    it("rejects an update whose replacementRecordId is the record's own recordId", async () => {
      components.findCurrentByRecordId.mockResolvedValue(component({ approvalStatus: "draft" }));

      await expect(
        svc.update("record-1", { replacementRecordId: "record-1" }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
      expect(components.updateInPlace).not.toHaveBeenCalled();
    });

    it("rejects an update when a patched tokenId does not resolve to a real design token", async () => {
      components.findCurrentByRecordId.mockResolvedValue(component({ approvalStatus: "draft" }));
      designTokensService.existingTokenIds.mockResolvedValue(new Set());

      await expect(
        svc.update("record-1", { tokenIds: ["missing-token"] }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
      expect(components.updateInPlace).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when the recordId does not resolve to a current version", async () => {
      components.findCurrentByRecordId.mockResolvedValue(null);
      await expect(svc.update("missing", { name: "X" }, "actor-1")).rejects.toThrow(
        NotFoundException,
      );
      expect(components.updateInPlace).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when the in-place update finds nothing to update AND a re-check confirms the record is genuinely gone", async () => {
      components.findCurrentByRecordId
        .mockResolvedValueOnce(component({ approvalStatus: "draft" })) // the initial findCurrent() read
        .mockResolvedValueOnce(null); // the re-check after updateInPlace() returns null
      components.updateInPlace.mockResolvedValue(null);

      await expect(svc.update("record-1", { name: "X" }, "actor-1")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws ConflictException (not NotFoundException) when updateInPlace's CAS guard finds nothing to update because approvalStatus changed concurrently (the record itself still exists)", async () => {
      components.findCurrentByRecordId
        .mockResolvedValueOnce(component({ approvalStatus: "draft" })) // the initial findCurrent() read
        .mockResolvedValueOnce(component({ approvalStatus: "approved" })); // the re-check — still exists, just a different status now
      components.updateInPlace.mockResolvedValue(null);

      await expect(svc.update("record-1", { name: "X" }, "actor-1")).rejects.toThrow(
        ConflictException,
      );
    });

    it("throws BadRequestException without ever calling updateInPlace when the current version is archived", async () => {
      components.findCurrentByRecordId.mockResolvedValue(component({ approvalStatus: "archived" }));

      await expect(svc.update("record-1", { name: "X" }, "actor-1")).rejects.toThrow(
        BadRequestException,
      );
      expect(components.updateInPlace).not.toHaveBeenCalled();
    });

    it("throws BadRequestException without ever calling updateInPlace when the current version is superseded", async () => {
      components.findCurrentByRecordId.mockResolvedValue(
        component({ approvalStatus: "superseded" }),
      );

      await expect(svc.update("record-1", { name: "X" }, "actor-1")).rejects.toThrow(
        BadRequestException,
      );
      expect(components.updateInPlace).not.toHaveBeenCalled();
    });

    it("never accepts approvalStatus/category/publicId through the general update patch", async () => {
      components.findCurrentByRecordId.mockResolvedValue(component({ approvalStatus: "draft" }));
      components.updateInPlace.mockResolvedValue(component({ name: "Renamed" }));

      await svc.update("record-1", { name: "Renamed" }, "actor-1");

      const [, patchArg] = components.updateInPlace.mock.calls[0] as [
        string,
        Record<string, unknown>,
      ];
      expect(patchArg).not.toHaveProperty("approvalStatus");
      expect(patchArg).not.toHaveProperty("category");
      expect(patchArg).not.toHaveProperty("publicId");
    });
  });

  describe("update — approved current version (creates a genuinely new version)", () => {
    it("flips the old current row's isCurrent to false and inserts a new draft version row with versionNumber incremented", async () => {
      const approved = component({
        id: "row-1",
        recordId: "record-1",
        publicId: "CMP-BUTTON-PRIMARY",
        category: "buttons",
        versionNumber: 3,
        isCurrent: true,
        approvalStatus: "approved",
        name: "Old name",
      });
      components.findCurrentByRecordId.mockResolvedValue(approved);
      components.updateInPlace.mockResolvedValue(component({ ...approved, isCurrent: false }));
      const newVersionRow = component({
        id: "row-2",
        recordId: "record-1",
        publicId: "CMP-BUTTON-PRIMARY",
        category: "buttons",
        versionNumber: 4,
        isCurrent: true,
        approvalStatus: "draft",
        name: "New name",
      });
      components.createNewVersion.mockResolvedValue(newVersionRow);

      const result = await svc.update("record-1", { name: "New name" }, "actor-1");

      expect(result).toEqual(newVersionRow);
      expect(components.updateInPlace).toHaveBeenCalledWith(
        "row-1",
        expect.objectContaining({ isCurrent: false, updatedBy: "actor-1" }),
        expect.anything(),
        "approved",
      );
      expect(components.createNewVersion).toHaveBeenCalledWith(
        expect.objectContaining({
          recordId: "record-1",
          publicId: "CMP-BUTTON-PRIMARY",
          category: "buttons",
          versionNumber: 4,
          name: "New name",
        }),
        expect.anything(),
      );
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "new_version", entityType: "component" }),
      );
    });

    it("falls back to the current version's own fields for any field the patch omits", async () => {
      const approved = component({
        approvalStatus: "approved",
        figmaReference: "https://figma.com/existing",
        phpPath: "existing/path.php",
      });
      components.findCurrentByRecordId.mockResolvedValue(approved);
      components.updateInPlace.mockResolvedValue(component({ ...approved, isCurrent: false }));
      components.createNewVersion.mockResolvedValue(component());

      await svc.update("record-1", { name: "New name only" }, "actor-1");

      expect(components.createNewVersion).toHaveBeenCalledWith(
        expect.objectContaining({
          figmaReference: "https://figma.com/existing",
          phpPath: "existing/path.php",
        }),
        expect.anything(),
      );
    });

    it("clears a nullable field when the patch explicitly sends null (distinct from omitting it)", async () => {
      const approved = component({ approvalStatus: "approved", phpPath: "old/path.php" });
      components.findCurrentByRecordId.mockResolvedValue(approved);
      components.updateInPlace.mockResolvedValue(component({ ...approved, isCurrent: false }));
      components.createNewVersion.mockResolvedValue(component());

      await svc.update("record-1", { phpPath: null }, "actor-1");

      expect(components.createNewVersion).toHaveBeenCalledWith(
        expect.objectContaining({ phpPath: null }),
        expect.anything(),
      );
    });

    it("clears tokenIds to [] when the patch explicitly sends null, distinct from omitting it", async () => {
      const approved = component({
        approvalStatus: "approved",
        tokenIds: ["token-1", "token-2"],
      });
      components.findCurrentByRecordId.mockResolvedValue(approved);
      components.updateInPlace.mockResolvedValue(component({ ...approved, isCurrent: false }));
      components.createNewVersion.mockResolvedValue(component());

      await svc.update("record-1", { tokenIds: null }, "actor-1");

      expect(components.createNewVersion).toHaveBeenCalledWith(
        expect.objectContaining({ tokenIds: [] }),
        expect.anything(),
      );
    });

    it("inherits the current version's tokenIds when the patch omits the field entirely", async () => {
      const approved = component({
        approvalStatus: "approved",
        tokenIds: ["token-1", "token-2"],
      });
      components.findCurrentByRecordId.mockResolvedValue(approved);
      components.updateInPlace.mockResolvedValue(component({ ...approved, isCurrent: false }));
      components.createNewVersion.mockResolvedValue(component());

      await svc.update("record-1", { name: "New name only" }, "actor-1");

      expect(components.createNewVersion).toHaveBeenCalledWith(
        expect.objectContaining({ tokenIds: ["token-1", "token-2"] }),
        expect.anything(),
      );
    });

    it("never allows category to change between versions — createNewVersion is always called with the CURRENT version's own category, not anything from the patch", async () => {
      const approved = component({ approvalStatus: "approved", category: "cards" });
      components.findCurrentByRecordId.mockResolvedValue(approved);
      components.updateInPlace.mockResolvedValue(component({ ...approved, isCurrent: false }));
      components.createNewVersion.mockResolvedValue(component({ category: "cards" }));

      await svc.update("record-1", { name: "X" }, "actor-1");

      expect(components.createNewVersion).toHaveBeenCalledWith(
        expect.objectContaining({ category: "cards" }),
        expect.anything(),
      );
    });

    it("throws ConflictException (not NotFoundException) when the isCurrent-flip's CAS guard finds nothing to update because the row was archived/superseded concurrently", async () => {
      const approved = component({ approvalStatus: "approved" });
      components.findCurrentByRecordId.mockResolvedValue(approved);
      components.updateInPlace.mockResolvedValue(null);

      await expect(svc.update("record-1", { name: "X" }, "actor-1")).rejects.toThrow(
        ConflictException,
      );
      expect(components.updateInPlace).toHaveBeenCalledWith(
        "row-1",
        expect.objectContaining({ isCurrent: false }),
        expect.anything(),
        "approved",
      );
      expect(components.createNewVersion).not.toHaveBeenCalled();
    });

    it("translates a concurrent version-creation collision on (recordId, versionNumber) into a clean 409, not a raw error", async () => {
      const approved = component({ approvalStatus: "approved", versionNumber: 1 });
      components.findCurrentByRecordId.mockResolvedValue(approved);
      components.updateInPlace.mockResolvedValue(component({ ...approved, isCurrent: false }));
      components.createNewVersion.mockRejectedValue(uniqueConstraintError());

      await expect(svc.update("record-1", { name: "X" }, "actor-1")).rejects.toThrow(
        ConflictException,
      );
    });

    it("re-throws a non-uniqueness error from createNewVersion unchanged", async () => {
      const approved = component({ approvalStatus: "approved" });
      components.findCurrentByRecordId.mockResolvedValue(approved);
      components.updateInPlace.mockResolvedValue(component({ ...approved, isCurrent: false }));
      const dbError = new Error("connection reset");
      components.createNewVersion.mockRejectedValue(dbError);

      await expect(svc.update("record-1", { name: "X" }, "actor-1")).rejects.toBe(dbError);
    });
  });

  describe("changeApprovalStatus", () => {
    it("is a no-op returning the current entity when the requested status matches the current one", async () => {
      components.findCurrentByRecordId.mockResolvedValue(component({ approvalStatus: "draft" }));
      const result = await svc.changeApprovalStatus("record-1", "draft", "actor-1");
      expect(result.approvalStatus).toBe("draft");
      expect(authorizationService.assertAllowed).not.toHaveBeenCalled();
    });

    it("rejects a transition not in the allowlist", async () => {
      components.findCurrentByRecordId.mockResolvedValue(component({ approvalStatus: "draft" }));
      await expect(svc.changeApprovalStatus("record-1", "approved", "actor-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("rejects a direct 'approved -> superseded' request", async () => {
      components.findCurrentByRecordId.mockResolvedValue(component({ approvalStatus: "approved" }));

      await expect(svc.changeApprovalStatus("record-1", "superseded", "actor-1")).rejects.toThrow(
        BadRequestException,
      );
      expect(authorizationService.assertAllowed).not.toHaveBeenCalled();
      expect(components.updateApprovalStatus).not.toHaveBeenCalled();
      expect(components.supersedeOtherApprovedVersion).not.toHaveBeenCalled();
    });

    it.each([
      ["draft", "submitted", "submit"],
      ["submitted", "under_review", "review"],
      ["under_review", "revision_requested", "review"],
      ["under_review", "rejected", "approve"],
    ] as const)("requires the '%s -> %s' transition's '%s' action", async (from, to, action) => {
      components.findCurrentByRecordId.mockResolvedValue(component({ approvalStatus: from }));
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      components.updateApprovalStatus.mockResolvedValue({
        outcome: "updated",
        entity: component({ approvalStatus: to }),
      });

      await svc.changeApprovalStatus("record-1", to, "actor-1");

      expect(authorizationService.assertAllowed).toHaveBeenCalledWith(
        "actor-1",
        "creative_design",
        action,
      );
    });

    it("rejects every transition out of the terminal 'archived'/'superseded' states", async () => {
      components.findCurrentByRecordId.mockResolvedValueOnce(
        component({ approvalStatus: "archived" }),
      );
      await expect(svc.changeApprovalStatus("record-1", "draft", "actor-1")).rejects.toThrow(
        BadRequestException,
      );

      components.findCurrentByRecordId.mockResolvedValueOnce(
        component({ approvalStatus: "superseded" }),
      );
      await expect(svc.changeApprovalStatus("record-1", "draft", "actor-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("propagates a denial from assertAllowed and never attempts the status write", async () => {
      components.findCurrentByRecordId.mockResolvedValue(
        component({ approvalStatus: "under_review" }),
      );
      authorizationService.assertAllowed.mockRejectedValue(
        new ForbiddenException("Missing permission: creative_design:approve"),
      );

      await expect(svc.changeApprovalStatus("record-1", "approved", "actor-1")).rejects.toThrow(
        ForbiddenException,
      );
      expect(components.updateApprovalStatus).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when the atomic status write reports not_found", async () => {
      components.findCurrentByRecordId.mockResolvedValue(component({ approvalStatus: "draft" }));
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      components.updateApprovalStatus.mockResolvedValue({ outcome: "not_found" });

      await expect(svc.changeApprovalStatus("record-1", "submitted", "actor-1")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws ConflictException when the atomic status write loses a race", async () => {
      components.findCurrentByRecordId.mockResolvedValue(component({ approvalStatus: "draft" }));
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      components.updateApprovalStatus.mockResolvedValue({
        outcome: "conflict",
        entity: component({ approvalStatus: "archived" }),
      });

      await expect(svc.changeApprovalStatus("record-1", "submitted", "actor-1")).rejects.toThrow(
        ConflictException,
      );
    });

    it("logs (not throws) when the audit call fails after a successful status write", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      components.findCurrentByRecordId.mockResolvedValue(component({ approvalStatus: "draft" }));
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      components.updateApprovalStatus.mockResolvedValue({
        outcome: "updated",
        entity: component({ approvalStatus: "submitted" }),
      });
      auditService.record.mockRejectedValue(new Error("audit down"));

      const result = await svc.changeApprovalStatus("record-1", "submitted", "actor-1");

      expect(result.approvalStatus).toBe("submitted");
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it("on a successful '-> approved' transition, also calls supersedeOtherApprovedVersion for the same recordId, excluding the just-approved row", async () => {
      components.findCurrentByRecordId.mockResolvedValue(
        component({ id: "row-2", recordId: "record-1", approvalStatus: "under_review" }),
      );
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      components.updateApprovalStatus.mockResolvedValue({
        outcome: "updated",
        entity: component({ id: "row-2", recordId: "record-1", approvalStatus: "approved" }),
      });
      components.supersedeOtherApprovedVersion.mockResolvedValue(undefined);

      await svc.changeApprovalStatus("record-1", "approved", "actor-1");

      expect(components.supersedeOtherApprovedVersion).toHaveBeenCalledWith(
        "record-1",
        "row-2",
        "actor-1",
        expect.anything(),
      );
    });

    it("does NOT call supersedeOtherApprovedVersion when the CAS write itself loses the race (outcome !== 'updated')", async () => {
      components.findCurrentByRecordId.mockResolvedValue(
        component({ id: "row-1", recordId: "record-1", approvalStatus: "under_review" }),
      );
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      components.updateApprovalStatus.mockResolvedValue({
        outcome: "conflict",
        entity: component({ id: "row-1", recordId: "record-1", approvalStatus: "archived" }),
      });

      await expect(svc.changeApprovalStatus("record-1", "approved", "actor-1")).rejects.toThrow(
        ConflictException,
      );
      expect(components.supersedeOtherApprovedVersion).not.toHaveBeenCalled();
    });

    it("does NOT call supersedeOtherApprovedVersion for a non-approval transition", async () => {
      components.findCurrentByRecordId.mockResolvedValue(component({ approvalStatus: "draft" }));
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      components.updateApprovalStatus.mockResolvedValue({
        outcome: "updated",
        entity: component({ approvalStatus: "submitted" }),
      });

      await svc.changeApprovalStatus("record-1", "submitted", "actor-1");

      expect(components.supersedeOtherApprovedVersion).not.toHaveBeenCalled();
    });
  });
});
