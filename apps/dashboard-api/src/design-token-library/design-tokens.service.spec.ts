import type { DesignTokenEntity, DesignTokenRepository } from "@webdesk/database";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditService } from "../audit/audit.service.js";
import type { AuthorizationService } from "../authz/authorization.service.js";
import { DesignTokensService } from "./design-tokens.service.js";

// withTransaction() opens a real Sequelize connection (needs DATABASE_URL) — irrelevant to this
// service's own logic, so it's stubbed to just invoke the callback, matching
// WebsiteStrategyRecordsService's/ProjectService.setActivePhase()'s own identical spec-file
// pattern. update()'s "-> new version" branch and changeApprovalStatus()'s "-> approved" branch
// both go through it.
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

const NOW = new Date("2026-08-27T00:00:00.000Z");

/** A stand-in for Sequelize's real `UniqueConstraintError` — checked by `.name` in
 *  `DesignTokensService.create()` rather than `instanceof`, since `dashboard-api` never imports
 *  `sequelize` directly (only `packages/database` may). */
function uniqueConstraintError(): Error {
  const error = new Error("Validation error");
  error.name = "SequelizeUniqueConstraintError";
  return error;
}

function token(overrides: Partial<DesignTokenEntity> = {}): DesignTokenEntity {
  return {
    id: "row-1",
    recordId: "record-1",
    publicId: "DTL-COLOR-PRIMARY-500",
    group: "colors",
    versionNumber: 1,
    isCurrent: true,
    name: "Primary 500",
    value: "#0F172A",
    unit: null,
    semanticPurpose: "Primary brand color",
    responsiveVariation: null,
    themeVariation: "light",
    usageReferences: [],
    approvalStatus: "draft",
    createdBy: "actor-1",
    updatedBy: "actor-1",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("DesignTokensService", () => {
  let tokens: {
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
  let svc: DesignTokensService;

  beforeEach(() => {
    tokens = {
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
    svc = new DesignTokensService(
      tokens as unknown as DesignTokenRepository,
      authorizationService as unknown as AuthorizationService,
      auditService as unknown as AuditService,
    );
  });

  describe("create", () => {
    it("creates a design token after validating the publicId is free", async () => {
      tokens.findCurrentByPublicId.mockResolvedValue(null);
      tokens.create.mockResolvedValue(token());

      const result = await svc.create(
        {
          publicId: "DTL-COLOR-PRIMARY-500",
          group: "colors",
          name: "Primary 500",
          value: "#0F172A",
        },
        "actor-1",
      );

      expect(result).toEqual(token());
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "create", entityType: "design_token" }),
      );
    });

    it("defaults usageReferences to an empty array when omitted", async () => {
      tokens.findCurrentByPublicId.mockResolvedValue(null);
      tokens.create.mockResolvedValue(token());

      await svc.create(
        { publicId: "DTL-X", group: "spacing", name: "Space 4", value: "16px" },
        "actor-1",
      );

      const [writtenInput] = tokens.create.mock.calls[0] as [Record<string, unknown>];
      expect(writtenInput.usageReferences).toEqual([]);
    });

    it("passes through a real usageReferences array unchanged", async () => {
      tokens.findCurrentByPublicId.mockResolvedValue(null);
      tokens.create.mockResolvedValue(token());

      await svc.create(
        {
          publicId: "DTL-X",
          group: "spacing",
          name: "Space 4",
          value: "16px",
          usageReferences: ["hero-section", "footer"],
        },
        "actor-1",
      );

      const [writtenInput] = tokens.create.mock.calls[0] as [Record<string, unknown>];
      expect(writtenInput.usageReferences).toEqual(["hero-section", "footer"]);
    });

    it("rejects a duplicate publicId", async () => {
      tokens.findCurrentByPublicId.mockResolvedValue(token());

      await expect(
        svc.create(
          { publicId: "DTL-COLOR-PRIMARY-500", group: "colors", name: "X", value: "X" },
          "actor-1",
        ),
      ).rejects.toThrow(BadRequestException);
      expect(tokens.create).not.toHaveBeenCalled();
    });

    it("translates a concurrent publicId collision into a clean 400, not a raw 500", async () => {
      tokens.findCurrentByPublicId.mockResolvedValue(null);
      tokens.create.mockRejectedValue(uniqueConstraintError());

      await expect(
        svc.create({ publicId: "DTL-RACE", group: "colors", name: "X", value: "X" }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("re-throws a non-uniqueness error from create() unchanged", async () => {
      tokens.findCurrentByPublicId.mockResolvedValue(null);
      const dbError = new Error("connection reset");
      tokens.create.mockRejectedValue(dbError);

      await expect(
        svc.create({ publicId: "DTL-X", group: "colors", name: "X", value: "X" }, "actor-1"),
      ).rejects.toBe(dbError);
    });
  });

  describe("findCurrent", () => {
    it("throws NotFoundException when no current version exists for the recordId", async () => {
      tokens.findCurrentByRecordId.mockResolvedValue(null);
      await expect(svc.findCurrent("missing")).rejects.toThrow(NotFoundException);
    });

    it("returns the current version when it exists", async () => {
      tokens.findCurrentByRecordId.mockResolvedValue(token());
      await expect(svc.findCurrent("record-1")).resolves.toEqual(token());
    });
  });

  describe("listVersions", () => {
    it("throws NotFoundException when the recordId has zero rows at all", async () => {
      tokens.listVersions.mockResolvedValue([]);
      await expect(svc.listVersions("missing")).rejects.toThrow(NotFoundException);
    });

    it("returns every version, oldest first, when the recordId exists", async () => {
      const versions = [
        token({ id: "row-1", versionNumber: 1, isCurrent: false, approvalStatus: "superseded" }),
        token({ id: "row-2", versionNumber: 2, isCurrent: true, approvalStatus: "approved" }),
      ];
      tokens.listVersions.mockResolvedValue(versions);
      await expect(svc.listVersions("record-1")).resolves.toEqual(versions);
    });
  });

  describe("list", () => {
    it("delegates the filter straight through to the repository", async () => {
      tokens.list.mockResolvedValue([token()]);
      const result = await svc.list({ approvalStatus: "draft" });
      expect(tokens.list).toHaveBeenCalledWith({ approvalStatus: "draft" });
      expect(result).toEqual([token()]);
    });
  });

  describe("update — non-approved current version (in-place mutation)", () => {
    it("mutates the current row in place, without creating a new version row", async () => {
      tokens.findCurrentByRecordId.mockResolvedValue(token({ approvalStatus: "draft" }));
      tokens.updateInPlace.mockResolvedValue(token({ name: "Renamed" }));

      const result = await svc.update("record-1", { name: "Renamed" }, "actor-1");

      expect(result.name).toBe("Renamed");
      // The trailing "draft" is the CAS guard — updateInPlace() only writes if the row's
      // approvalStatus still matches what was read, so a concurrent status change can't silently
      // land on top of it.
      expect(tokens.updateInPlace).toHaveBeenCalledWith(
        "row-1",
        expect.objectContaining({ name: "Renamed", updatedBy: "actor-1" }),
        undefined,
        "draft",
      );
      expect(tokens.createNewVersion).not.toHaveBeenCalled();
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "update", entityType: "design_token" }),
      );
    });

    it("also mutates in place for a revision_requested/rejected/submitted/under_review current version (only 'approved' triggers a new version)", async () => {
      for (const status of [
        "submitted",
        "under_review",
        "revision_requested",
        "rejected",
      ] as const) {
        tokens.findCurrentByRecordId.mockResolvedValue(token({ approvalStatus: status }));
        tokens.updateInPlace.mockResolvedValue(token({ approvalStatus: status, name: "X" }));

        await svc.update("record-1", { name: "X" }, "actor-1");

        expect(tokens.createNewVersion).not.toHaveBeenCalled();
      }
    });

    it("throws NotFoundException when the recordId does not resolve to a current version", async () => {
      tokens.findCurrentByRecordId.mockResolvedValue(null);
      await expect(svc.update("missing", { name: "X" }, "actor-1")).rejects.toThrow(
        NotFoundException,
      );
      expect(tokens.updateInPlace).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when the in-place update finds nothing to update AND a re-check confirms the record is genuinely gone", async () => {
      tokens.findCurrentByRecordId
        .mockResolvedValueOnce(token({ approvalStatus: "draft" })) // the initial findCurrent() read
        .mockResolvedValueOnce(null); // the re-check after updateInPlace() returns null
      tokens.updateInPlace.mockResolvedValue(null);

      await expect(svc.update("record-1", { name: "X" }, "actor-1")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws ConflictException (not NotFoundException) when updateInPlace's CAS guard finds nothing to update because approvalStatus changed concurrently (the record itself still exists)", async () => {
      tokens.findCurrentByRecordId
        .mockResolvedValueOnce(token({ approvalStatus: "draft" })) // the initial findCurrent() read
        .mockResolvedValueOnce(token({ approvalStatus: "approved" })); // the re-check — still exists, just a different status now
      tokens.updateInPlace.mockResolvedValue(null);

      await expect(svc.update("record-1", { name: "X" }, "actor-1")).rejects.toThrow(
        ConflictException,
      );
    });

    it("throws BadRequestException without ever calling updateInPlace when the current version is archived", async () => {
      tokens.findCurrentByRecordId.mockResolvedValue(token({ approvalStatus: "archived" }));

      await expect(svc.update("record-1", { name: "X" }, "actor-1")).rejects.toThrow(
        BadRequestException,
      );
      expect(tokens.updateInPlace).not.toHaveBeenCalled();
    });

    it("throws BadRequestException without ever calling updateInPlace when the current version is superseded", async () => {
      tokens.findCurrentByRecordId.mockResolvedValue(token({ approvalStatus: "superseded" }));

      await expect(svc.update("record-1", { name: "X" }, "actor-1")).rejects.toThrow(
        BadRequestException,
      );
      expect(tokens.updateInPlace).not.toHaveBeenCalled();
    });

    it("never accepts approvalStatus/group/publicId through the general update patch — the patch object forwarded to the repository only ever carries the DTO's own fields", async () => {
      tokens.findCurrentByRecordId.mockResolvedValue(token({ approvalStatus: "draft" }));
      tokens.updateInPlace.mockResolvedValue(token({ name: "Renamed" }));

      await svc.update("record-1", { name: "Renamed" }, "actor-1");

      const [, patchArg] = tokens.updateInPlace.mock.calls[0] as [string, Record<string, unknown>];
      expect(patchArg).not.toHaveProperty("approvalStatus");
      expect(patchArg).not.toHaveProperty("group");
      expect(patchArg).not.toHaveProperty("publicId");
    });
  });

  describe("update — approved current version (creates a genuinely new version)", () => {
    it("flips the old current row's isCurrent to false and inserts a new draft version row with versionNumber incremented", async () => {
      const approved = token({
        id: "row-1",
        recordId: "record-1",
        publicId: "DTL-COLOR-PRIMARY-500",
        group: "colors",
        versionNumber: 3,
        isCurrent: true,
        approvalStatus: "approved",
        name: "Old name",
        value: "#000000",
      });
      tokens.findCurrentByRecordId.mockResolvedValue(approved);
      tokens.updateInPlace.mockResolvedValue(token({ ...approved, isCurrent: false }));
      const newVersionRow = token({
        id: "row-2",
        recordId: "record-1",
        publicId: "DTL-COLOR-PRIMARY-500",
        group: "colors",
        versionNumber: 4,
        isCurrent: true,
        approvalStatus: "draft",
        name: "New name",
      });
      tokens.createNewVersion.mockResolvedValue(newVersionRow);

      const result = await svc.update("record-1", { name: "New name" }, "actor-1");

      expect(result).toEqual(newVersionRow);
      // The old row is flipped to isCurrent: false first — CAS-guarded on "approved", so a
      // concurrent archive/supersede can't have this fork silently proceed.
      expect(tokens.updateInPlace).toHaveBeenCalledWith(
        "row-1",
        expect.objectContaining({ isCurrent: false, updatedBy: "actor-1" }),
        expect.anything(),
        "approved",
      );
      // The new row copies recordId/publicId/group forward and increments versionNumber.
      expect(tokens.createNewVersion).toHaveBeenCalledWith(
        expect.objectContaining({
          recordId: "record-1",
          publicId: "DTL-COLOR-PRIMARY-500",
          group: "colors",
          versionNumber: 4,
          name: "New name",
        }),
        expect.anything(),
      );
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "new_version", entityType: "design_token" }),
      );
    });

    it("falls back to the current version's own fields for any field the patch omits", async () => {
      const approved = token({
        approvalStatus: "approved",
        value: "#123456",
        unit: "hex",
        semanticPurpose: "Existing purpose",
      });
      tokens.findCurrentByRecordId.mockResolvedValue(approved);
      tokens.updateInPlace.mockResolvedValue(token({ ...approved, isCurrent: false }));
      tokens.createNewVersion.mockResolvedValue(token());

      // Patch only touches name — value/unit/semanticPurpose are omitted, not sent as null.
      await svc.update("record-1", { name: "New name only" }, "actor-1");

      expect(tokens.createNewVersion).toHaveBeenCalledWith(
        expect.objectContaining({
          value: "#123456",
          unit: "hex",
          semanticPurpose: "Existing purpose",
        }),
        expect.anything(),
      );
    });

    it("clears a nullable field when the patch explicitly sends null (distinct from omitting it)", async () => {
      const approved = token({ approvalStatus: "approved", unit: "px" });
      tokens.findCurrentByRecordId.mockResolvedValue(approved);
      tokens.updateInPlace.mockResolvedValue(token({ ...approved, isCurrent: false }));
      tokens.createNewVersion.mockResolvedValue(token());

      await svc.update("record-1", { unit: null }, "actor-1");

      expect(tokens.createNewVersion).toHaveBeenCalledWith(
        expect.objectContaining({ unit: null }),
        expect.anything(),
      );
    });

    it("never allows group to change between versions — createNewVersion is always called with the CURRENT version's own group, not anything from the patch (the update DTO itself has no group field to send)", async () => {
      const approved = token({ approvalStatus: "approved", group: "typography" });
      tokens.findCurrentByRecordId.mockResolvedValue(approved);
      tokens.updateInPlace.mockResolvedValue(token({ ...approved, isCurrent: false }));
      tokens.createNewVersion.mockResolvedValue(token({ group: "typography" }));

      await svc.update("record-1", { name: "X" }, "actor-1");

      expect(tokens.createNewVersion).toHaveBeenCalledWith(
        expect.objectContaining({ group: "typography" }),
        expect.anything(),
      );
    });

    it("throws ConflictException (not NotFoundException) when the isCurrent-flip's CAS guard finds nothing to update because the row was archived/superseded concurrently (a same-id-only WHERE clause here would let an edit-only caller resurrect a just-archived record)", async () => {
      const approved = token({ approvalStatus: "approved" });
      tokens.findCurrentByRecordId.mockResolvedValue(approved);
      tokens.updateInPlace.mockResolvedValue(null);

      await expect(svc.update("record-1", { name: "X" }, "actor-1")).rejects.toThrow(
        ConflictException,
      );
      // The CAS guard is real — the isCurrent-flip call must carry the observed approvalStatus.
      expect(tokens.updateInPlace).toHaveBeenCalledWith(
        "row-1",
        expect.objectContaining({ isCurrent: false }),
        expect.anything(),
        "approved",
      );
      expect(tokens.createNewVersion).not.toHaveBeenCalled();
    });

    it("translates a concurrent version-creation collision on (recordId, versionNumber) into a clean 409, not a raw error (mirrors create()'s own publicId-race handling)", async () => {
      const approved = token({ approvalStatus: "approved", versionNumber: 1 });
      tokens.findCurrentByRecordId.mockResolvedValue(approved);
      tokens.updateInPlace.mockResolvedValue(token({ ...approved, isCurrent: false }));
      tokens.createNewVersion.mockRejectedValue(uniqueConstraintError());

      await expect(svc.update("record-1", { name: "X" }, "actor-1")).rejects.toThrow(
        ConflictException,
      );
    });

    it("re-throws a non-uniqueness error from createNewVersion unchanged", async () => {
      const approved = token({ approvalStatus: "approved" });
      tokens.findCurrentByRecordId.mockResolvedValue(approved);
      tokens.updateInPlace.mockResolvedValue(token({ ...approved, isCurrent: false }));
      const dbError = new Error("connection reset");
      tokens.createNewVersion.mockRejectedValue(dbError);

      await expect(svc.update("record-1", { name: "X" }, "actor-1")).rejects.toBe(dbError);
    });
  });

  describe("changeApprovalStatus", () => {
    it("is a no-op returning the current entity when the requested status matches the current one", async () => {
      tokens.findCurrentByRecordId.mockResolvedValue(token({ approvalStatus: "draft" }));
      const result = await svc.changeApprovalStatus("record-1", "draft", "actor-1");
      expect(result.approvalStatus).toBe("draft");
      expect(authorizationService.assertAllowed).not.toHaveBeenCalled();
    });

    it("rejects a transition not in the allowlist", async () => {
      tokens.findCurrentByRecordId.mockResolvedValue(token({ approvalStatus: "draft" }));
      await expect(svc.changeApprovalStatus("record-1", "approved", "actor-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("rejects a direct 'approved -> superseded' request — supersede is only ever an automatic side effect of a DIFFERENT version's own approval, never a directly requestable transition", async () => {
      tokens.findCurrentByRecordId.mockResolvedValue(token({ approvalStatus: "approved" }));

      await expect(svc.changeApprovalStatus("record-1", "superseded", "actor-1")).rejects.toThrow(
        BadRequestException,
      );
      expect(authorizationService.assertAllowed).not.toHaveBeenCalled();
      expect(tokens.updateApprovalStatus).not.toHaveBeenCalled();
      expect(tokens.supersedeOtherApprovedVersion).not.toHaveBeenCalled();
    });

    it.each([
      ["draft", "submitted", "submit"],
      ["submitted", "under_review", "review"],
      ["under_review", "revision_requested", "review"],
      ["under_review", "rejected", "approve"],
    ] as const)("requires the '%s -> %s' transition's '%s' action", async (from, to, action) => {
      tokens.findCurrentByRecordId.mockResolvedValue(token({ approvalStatus: from }));
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      tokens.updateApprovalStatus.mockResolvedValue({
        outcome: "updated",
        entity: token({ approvalStatus: to }),
      });

      await svc.changeApprovalStatus("record-1", to, "actor-1");

      expect(authorizationService.assertAllowed).toHaveBeenCalledWith(
        "actor-1",
        "creative_design",
        action,
      );
    });

    it("rejects every transition out of the terminal 'archived'/'superseded' states", async () => {
      tokens.findCurrentByRecordId.mockResolvedValueOnce(token({ approvalStatus: "archived" }));
      await expect(svc.changeApprovalStatus("record-1", "draft", "actor-1")).rejects.toThrow(
        BadRequestException,
      );

      tokens.findCurrentByRecordId.mockResolvedValueOnce(token({ approvalStatus: "superseded" }));
      await expect(svc.changeApprovalStatus("record-1", "draft", "actor-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("propagates a denial from assertAllowed and never attempts the status write", async () => {
      tokens.findCurrentByRecordId.mockResolvedValue(token({ approvalStatus: "under_review" }));
      authorizationService.assertAllowed.mockRejectedValue(
        new ForbiddenException("Missing permission: creative_design:approve"),
      );

      await expect(svc.changeApprovalStatus("record-1", "approved", "actor-1")).rejects.toThrow(
        ForbiddenException,
      );
      expect(tokens.updateApprovalStatus).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when the atomic status write reports not_found", async () => {
      tokens.findCurrentByRecordId.mockResolvedValue(token({ approvalStatus: "draft" }));
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      tokens.updateApprovalStatus.mockResolvedValue({ outcome: "not_found" });

      await expect(svc.changeApprovalStatus("record-1", "submitted", "actor-1")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws ConflictException when the atomic status write loses a race", async () => {
      tokens.findCurrentByRecordId.mockResolvedValue(token({ approvalStatus: "draft" }));
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      tokens.updateApprovalStatus.mockResolvedValue({
        outcome: "conflict",
        entity: token({ approvalStatus: "archived" }),
      });

      await expect(svc.changeApprovalStatus("record-1", "submitted", "actor-1")).rejects.toThrow(
        ConflictException,
      );
    });

    it("logs (not throws) when the audit call fails after a successful status write", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      tokens.findCurrentByRecordId.mockResolvedValue(token({ approvalStatus: "draft" }));
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      tokens.updateApprovalStatus.mockResolvedValue({
        outcome: "updated",
        entity: token({ approvalStatus: "submitted" }),
      });
      auditService.record.mockRejectedValue(new Error("audit down"));

      const result = await svc.changeApprovalStatus("record-1", "submitted", "actor-1");

      expect(result.approvalStatus).toBe("submitted");
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it("on a successful '-> approved' transition, also calls supersedeOtherApprovedVersion for the same recordId, excluding the just-approved row", async () => {
      tokens.findCurrentByRecordId.mockResolvedValue(
        token({ id: "row-2", recordId: "record-1", approvalStatus: "under_review" }),
      );
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      tokens.updateApprovalStatus.mockResolvedValue({
        outcome: "updated",
        entity: token({ id: "row-2", recordId: "record-1", approvalStatus: "approved" }),
      });
      tokens.supersedeOtherApprovedVersion.mockResolvedValue(undefined);

      await svc.changeApprovalStatus("record-1", "approved", "actor-1");

      expect(tokens.supersedeOtherApprovedVersion).toHaveBeenCalledWith(
        "record-1",
        "row-2",
        "actor-1",
        expect.anything(),
      );
    });

    it("on a successful '-> approved' transition with no prior approved version, still calls supersedeOtherApprovedVersion (a safe no-op at the repository layer) without erroring", async () => {
      tokens.findCurrentByRecordId.mockResolvedValue(
        token({ id: "row-1", recordId: "record-1", approvalStatus: "under_review" }),
      );
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      tokens.updateApprovalStatus.mockResolvedValue({
        outcome: "updated",
        entity: token({ id: "row-1", recordId: "record-1", approvalStatus: "approved" }),
      });
      tokens.supersedeOtherApprovedVersion.mockResolvedValue(undefined);

      const result = await svc.changeApprovalStatus("record-1", "approved", "actor-1");

      expect(result.approvalStatus).toBe("approved");
      expect(tokens.supersedeOtherApprovedVersion).toHaveBeenCalledTimes(1);
    });

    it("does NOT call supersedeOtherApprovedVersion when the CAS write itself loses the race (outcome !== 'updated')", async () => {
      tokens.findCurrentByRecordId.mockResolvedValue(
        token({ id: "row-1", recordId: "record-1", approvalStatus: "under_review" }),
      );
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      tokens.updateApprovalStatus.mockResolvedValue({
        outcome: "conflict",
        entity: token({ id: "row-1", recordId: "record-1", approvalStatus: "archived" }),
      });

      await expect(svc.changeApprovalStatus("record-1", "approved", "actor-1")).rejects.toThrow(
        ConflictException,
      );
      expect(tokens.supersedeOtherApprovedVersion).not.toHaveBeenCalled();
    });

    it("does NOT call supersedeOtherApprovedVersion for a non-approval transition", async () => {
      tokens.findCurrentByRecordId.mockResolvedValue(token({ approvalStatus: "draft" }));
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      tokens.updateApprovalStatus.mockResolvedValue({
        outcome: "updated",
        entity: token({ approvalStatus: "submitted" }),
      });

      await svc.changeApprovalStatus("record-1", "submitted", "actor-1");

      expect(tokens.supersedeOtherApprovedVersion).not.toHaveBeenCalled();
    });
  });
});
