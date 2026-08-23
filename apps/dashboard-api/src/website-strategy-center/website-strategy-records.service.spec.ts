import type {
  WebsiteStrategyRecordEntity,
  WebsiteStrategyRecordRepository,
} from "@webdesk/database";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditService } from "../audit/audit.service.js";
import type { AuthorizationService } from "../authz/authorization.service.js";
import { WebsiteStrategyRecordsService } from "./website-strategy-records.service.js";

// withTransaction() opens a real Sequelize connection (needs DATABASE_URL) — irrelevant to this
// service's own logic, so it's stubbed to just invoke the callback, matching
// ProjectService.setActivePhase()'s/ServicesService.create()'s own identical spec-file pattern.
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

const NOW = new Date("2026-08-23T00:00:00.000Z");

/** A stand-in for Sequelize's real `UniqueConstraintError` — checked by `.name` in
 *  `WebsiteStrategyRecordsService.create()` rather than `instanceof`, since `dashboard-api` never
 *  imports `sequelize` directly (only `packages/database` may). */
function uniqueConstraintError(): Error {
  const error = new Error("Validation error");
  error.name = "SequelizeUniqueConstraintError";
  return error;
}

function record(overrides: Partial<WebsiteStrategyRecordEntity> = {}): WebsiteStrategyRecordEntity {
  return {
    id: "row-1",
    recordId: "record-1",
    publicId: "WSC-NAV-PLAN-1",
    recordType: "navigation_plan",
    versionNumber: 1,
    isCurrent: true,
    title: "Q1 Navigation Plan",
    content: null,
    notes: null,
    approvalStatus: "draft",
    createdBy: "actor-1",
    updatedBy: "actor-1",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("WebsiteStrategyRecordsService", () => {
  let records: {
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
  let svc: WebsiteStrategyRecordsService;

  beforeEach(() => {
    records = {
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
    svc = new WebsiteStrategyRecordsService(
      records as unknown as WebsiteStrategyRecordRepository,
      authorizationService as unknown as AuthorizationService,
      auditService as unknown as AuditService,
    );
  });

  describe("create", () => {
    it("creates a website strategy record after validating the publicId is free", async () => {
      records.findCurrentByPublicId.mockResolvedValue(null);
      records.create.mockResolvedValue(record());

      const result = await svc.create(
        { publicId: "WSC-NAV-PLAN-1", recordType: "navigation_plan", title: "Q1 Navigation Plan" },
        "actor-1",
      );

      expect(result).toEqual(record());
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "create", entityType: "website_strategy_record" }),
      );
    });

    it("rejects a duplicate publicId", async () => {
      records.findCurrentByPublicId.mockResolvedValue(record());

      await expect(
        svc.create(
          { publicId: "WSC-NAV-PLAN-1", recordType: "navigation_plan", title: "X" },
          "actor-1",
        ),
      ).rejects.toThrow(BadRequestException);
      expect(records.create).not.toHaveBeenCalled();
    });

    it("translates a concurrent publicId collision into a clean 400, not a raw 500", async () => {
      records.findCurrentByPublicId.mockResolvedValue(null);
      records.create.mockRejectedValue(uniqueConstraintError());

      await expect(
        svc.create({ publicId: "WSC-RACE", recordType: "navigation_plan", title: "X" }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("re-throws a non-uniqueness error from create() unchanged", async () => {
      records.findCurrentByPublicId.mockResolvedValue(null);
      const dbError = new Error("connection reset");
      records.create.mockRejectedValue(dbError);

      await expect(
        svc.create({ publicId: "WSC-X", recordType: "navigation_plan", title: "X" }, "actor-1"),
      ).rejects.toBe(dbError);
    });
  });

  describe("findCurrent", () => {
    it("throws NotFoundException when no current version exists for the recordId", async () => {
      records.findCurrentByRecordId.mockResolvedValue(null);
      await expect(svc.findCurrent("missing")).rejects.toThrow(NotFoundException);
    });

    it("returns the current version when it exists", async () => {
      records.findCurrentByRecordId.mockResolvedValue(record());
      await expect(svc.findCurrent("record-1")).resolves.toEqual(record());
    });
  });

  describe("listVersions", () => {
    it("throws NotFoundException when the recordId has zero rows at all", async () => {
      records.listVersions.mockResolvedValue([]);
      await expect(svc.listVersions("missing")).rejects.toThrow(NotFoundException);
    });

    it("returns every version, oldest first, when the recordId exists", async () => {
      const versions = [
        record({ id: "row-1", versionNumber: 1, isCurrent: false, approvalStatus: "superseded" }),
        record({ id: "row-2", versionNumber: 2, isCurrent: true, approvalStatus: "approved" }),
      ];
      records.listVersions.mockResolvedValue(versions);
      await expect(svc.listVersions("record-1")).resolves.toEqual(versions);
    });
  });

  describe("list", () => {
    it("delegates the filter straight through to the repository", async () => {
      records.list.mockResolvedValue([record()]);
      const result = await svc.list({ approvalStatus: "draft" });
      expect(records.list).toHaveBeenCalledWith({ approvalStatus: "draft" });
      expect(result).toEqual([record()]);
    });
  });

  describe("update — non-approved current version (in-place mutation)", () => {
    it("mutates the current row in place, without creating a new version row", async () => {
      records.findCurrentByRecordId.mockResolvedValue(record({ approvalStatus: "draft" }));
      records.updateInPlace.mockResolvedValue(record({ title: "Renamed" }));

      const result = await svc.update("record-1", { title: "Renamed" }, "actor-1");

      expect(result.title).toBe("Renamed");
      // The trailing "draft" is the CAS guard (code-review fix) — updateInPlace() only writes if
      // the row's approvalStatus still matches what was read, so a concurrent status change can't
      // silently land on top of it.
      expect(records.updateInPlace).toHaveBeenCalledWith(
        "row-1",
        expect.objectContaining({ title: "Renamed", updatedBy: "actor-1" }),
        undefined,
        "draft",
      );
      expect(records.createNewVersion).not.toHaveBeenCalled();
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "update", entityType: "website_strategy_record" }),
      );
    });

    it("also mutates in place for a revision_requested/rejected/submitted/under_review current version (only 'approved' triggers a new version)", async () => {
      for (const status of [
        "submitted",
        "under_review",
        "revision_requested",
        "rejected",
      ] as const) {
        records.findCurrentByRecordId.mockResolvedValue(record({ approvalStatus: status }));
        records.updateInPlace.mockResolvedValue(record({ approvalStatus: status, title: "X" }));

        await svc.update("record-1", { title: "X" }, "actor-1");

        expect(records.createNewVersion).not.toHaveBeenCalled();
      }
    });

    it("throws NotFoundException when the recordId does not resolve to a current version", async () => {
      records.findCurrentByRecordId.mockResolvedValue(null);
      await expect(svc.update("missing", { title: "X" }, "actor-1")).rejects.toThrow(
        NotFoundException,
      );
      expect(records.updateInPlace).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when the in-place update finds nothing to update AND a re-check confirms the record is genuinely gone", async () => {
      records.findCurrentByRecordId
        .mockResolvedValueOnce(record({ approvalStatus: "draft" })) // the initial findCurrent() read
        .mockResolvedValueOnce(null); // the re-check after updateInPlace() returns null
      records.updateInPlace.mockResolvedValue(null);

      await expect(svc.update("record-1", { title: "X" }, "actor-1")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws ConflictException (not NotFoundException) when updateInPlace's CAS guard finds nothing to update because approvalStatus changed concurrently (code-review fix — the record itself still exists)", async () => {
      records.findCurrentByRecordId
        .mockResolvedValueOnce(record({ approvalStatus: "draft" })) // the initial findCurrent() read
        .mockResolvedValueOnce(record({ approvalStatus: "approved" })); // the re-check — still exists, just a different status now
      records.updateInPlace.mockResolvedValue(null);

      await expect(svc.update("record-1", { title: "X" }, "actor-1")).rejects.toThrow(
        ConflictException,
      );
    });

    it("throws BadRequestException without ever calling updateInPlace when the current version is archived", async () => {
      records.findCurrentByRecordId.mockResolvedValue(record({ approvalStatus: "archived" }));

      await expect(svc.update("record-1", { title: "X" }, "actor-1")).rejects.toThrow(
        BadRequestException,
      );
      expect(records.updateInPlace).not.toHaveBeenCalled();
    });

    it("throws BadRequestException without ever calling updateInPlace when the current version is superseded", async () => {
      records.findCurrentByRecordId.mockResolvedValue(record({ approvalStatus: "superseded" }));

      await expect(svc.update("record-1", { title: "X" }, "actor-1")).rejects.toThrow(
        BadRequestException,
      );
      expect(records.updateInPlace).not.toHaveBeenCalled();
    });

    it("never accepts approvalStatus/recordType/publicId through the general update patch — the patch object forwarded to the repository only ever carries the DTO's own fields", async () => {
      records.findCurrentByRecordId.mockResolvedValue(record({ approvalStatus: "draft" }));
      records.updateInPlace.mockResolvedValue(record({ title: "Renamed" }));

      await svc.update("record-1", { title: "Renamed" }, "actor-1");

      const [, patchArg] = records.updateInPlace.mock.calls[0] as [string, Record<string, unknown>];
      expect(patchArg).not.toHaveProperty("approvalStatus");
      expect(patchArg).not.toHaveProperty("recordType");
      expect(patchArg).not.toHaveProperty("publicId");
    });
  });

  describe("update — approved current version (creates a genuinely new version)", () => {
    it("flips the old current row's isCurrent to false and inserts a new draft version row with versionNumber incremented", async () => {
      const approved = record({
        id: "row-1",
        recordId: "record-1",
        publicId: "WSC-NAV-PLAN-1",
        recordType: "navigation_plan",
        versionNumber: 3,
        isCurrent: true,
        approvalStatus: "approved",
        title: "Old title",
        content: "Old content",
        notes: "Old notes",
      });
      records.findCurrentByRecordId.mockResolvedValue(approved);
      records.updateInPlace.mockResolvedValue(record({ ...approved, isCurrent: false }));
      const newVersionRow = record({
        id: "row-2",
        recordId: "record-1",
        publicId: "WSC-NAV-PLAN-1",
        recordType: "navigation_plan",
        versionNumber: 4,
        isCurrent: true,
        approvalStatus: "draft",
        title: "New title",
      });
      records.createNewVersion.mockResolvedValue(newVersionRow);

      const result = await svc.update("record-1", { title: "New title" }, "actor-1");

      expect(result).toEqual(newVersionRow);
      // The old row is flipped to isCurrent: false first — CAS-guarded on "approved" (security-
      // review fix), so a concurrent archive/supersede can't have this fork silently proceed.
      expect(records.updateInPlace).toHaveBeenCalledWith(
        "row-1",
        expect.objectContaining({ isCurrent: false, updatedBy: "actor-1" }),
        expect.anything(),
        "approved",
      );
      // The new row copies recordId/publicId/recordType forward and increments versionNumber.
      expect(records.createNewVersion).toHaveBeenCalledWith(
        expect.objectContaining({
          recordId: "record-1",
          publicId: "WSC-NAV-PLAN-1",
          recordType: "navigation_plan",
          versionNumber: 4,
          title: "New title",
        }),
        expect.anything(),
      );
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "new_version", entityType: "website_strategy_record" }),
      );
    });

    it("falls back to the current version's own content/notes for any field the patch omits", async () => {
      const approved = record({
        approvalStatus: "approved",
        content: "Existing content",
        notes: "Existing notes",
      });
      records.findCurrentByRecordId.mockResolvedValue(approved);
      records.updateInPlace.mockResolvedValue(record({ ...approved, isCurrent: false }));
      records.createNewVersion.mockResolvedValue(record());

      // Patch only touches title — content/notes are omitted, not sent as null.
      await svc.update("record-1", { title: "New title only" }, "actor-1");

      expect(records.createNewVersion).toHaveBeenCalledWith(
        expect.objectContaining({ content: "Existing content", notes: "Existing notes" }),
        expect.anything(),
      );
    });

    it("clears content when the patch explicitly sends null (distinct from omitting it)", async () => {
      const approved = record({ approvalStatus: "approved", content: "Existing content" });
      records.findCurrentByRecordId.mockResolvedValue(approved);
      records.updateInPlace.mockResolvedValue(record({ ...approved, isCurrent: false }));
      records.createNewVersion.mockResolvedValue(record());

      await svc.update("record-1", { content: null }, "actor-1");

      expect(records.createNewVersion).toHaveBeenCalledWith(
        expect.objectContaining({ content: null }),
        expect.anything(),
      );
    });

    it("never allows recordType to change between versions — createNewVersion is always called with the CURRENT version's own recordType, not anything from the patch (the update DTO itself has no recordType field to send)", async () => {
      const approved = record({ approvalStatus: "approved", recordType: "pillar_strategy" });
      records.findCurrentByRecordId.mockResolvedValue(approved);
      records.updateInPlace.mockResolvedValue(record({ ...approved, isCurrent: false }));
      records.createNewVersion.mockResolvedValue(record({ recordType: "pillar_strategy" }));

      await svc.update("record-1", { title: "X" }, "actor-1");

      expect(records.createNewVersion).toHaveBeenCalledWith(
        expect.objectContaining({ recordType: "pillar_strategy" }),
        expect.anything(),
      );
    });

    it("throws ConflictException (not NotFoundException) when the isCurrent-flip's CAS guard finds nothing to update because the row was archived/superseded concurrently (security-review fix — a same-id-only WHERE clause here would let an edit-only caller resurrect a just-archived record)", async () => {
      const approved = record({ approvalStatus: "approved" });
      records.findCurrentByRecordId.mockResolvedValue(approved);
      records.updateInPlace.mockResolvedValue(null);

      await expect(svc.update("record-1", { title: "X" }, "actor-1")).rejects.toThrow(
        ConflictException,
      );
      // The CAS guard is real — the isCurrent-flip call must carry the observed approvalStatus.
      expect(records.updateInPlace).toHaveBeenCalledWith(
        "row-1",
        expect.objectContaining({ isCurrent: false }),
        expect.anything(),
        "approved",
      );
      expect(records.createNewVersion).not.toHaveBeenCalled();
    });

    it("translates a concurrent version-creation collision on (recordId, versionNumber) into a clean 409, not a raw error (code-review fix — mirrors create()'s own publicId-race handling)", async () => {
      const approved = record({ approvalStatus: "approved", versionNumber: 1 });
      records.findCurrentByRecordId.mockResolvedValue(approved);
      records.updateInPlace.mockResolvedValue(record({ ...approved, isCurrent: false }));
      records.createNewVersion.mockRejectedValue(uniqueConstraintError());

      await expect(svc.update("record-1", { title: "X" }, "actor-1")).rejects.toThrow(
        ConflictException,
      );
    });

    it("re-throws a non-uniqueness error from createNewVersion unchanged", async () => {
      const approved = record({ approvalStatus: "approved" });
      records.findCurrentByRecordId.mockResolvedValue(approved);
      records.updateInPlace.mockResolvedValue(record({ ...approved, isCurrent: false }));
      const dbError = new Error("connection reset");
      records.createNewVersion.mockRejectedValue(dbError);

      await expect(svc.update("record-1", { title: "X" }, "actor-1")).rejects.toBe(dbError);
    });
  });

  describe("changeApprovalStatus", () => {
    it("is a no-op returning the current entity when the requested status matches the current one", async () => {
      records.findCurrentByRecordId.mockResolvedValue(record({ approvalStatus: "draft" }));
      const result = await svc.changeApprovalStatus("record-1", "draft", "actor-1");
      expect(result.approvalStatus).toBe("draft");
      expect(authorizationService.assertAllowed).not.toHaveBeenCalled();
    });

    it("rejects a transition not in the allowlist", async () => {
      records.findCurrentByRecordId.mockResolvedValue(record({ approvalStatus: "draft" }));
      await expect(svc.changeApprovalStatus("record-1", "approved", "actor-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("rejects a direct 'approved -> superseded' request (code-review fix) — supersede is only ever an automatic side effect of a DIFFERENT version's own approval, never a directly requestable transition", async () => {
      records.findCurrentByRecordId.mockResolvedValue(record({ approvalStatus: "approved" }));

      await expect(svc.changeApprovalStatus("record-1", "superseded", "actor-1")).rejects.toThrow(
        BadRequestException,
      );
      expect(authorizationService.assertAllowed).not.toHaveBeenCalled();
      expect(records.updateApprovalStatus).not.toHaveBeenCalled();
      expect(records.supersedeOtherApprovedVersion).not.toHaveBeenCalled();
    });

    it.each([
      ["draft", "submitted", "submit"],
      ["submitted", "under_review", "review"],
      ["under_review", "revision_requested", "review"],
      ["under_review", "rejected", "approve"],
    ] as const)("requires the '%s -> %s' transition's '%s' action", async (from, to, action) => {
      records.findCurrentByRecordId.mockResolvedValue(record({ approvalStatus: from }));
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      records.updateApprovalStatus.mockResolvedValue({
        outcome: "updated",
        entity: record({ approvalStatus: to }),
      });

      await svc.changeApprovalStatus("record-1", to, "actor-1");

      expect(authorizationService.assertAllowed).toHaveBeenCalledWith(
        "actor-1",
        "website_strategy",
        action,
      );
    });

    it("rejects every transition out of the terminal 'archived'/'superseded' states", async () => {
      records.findCurrentByRecordId.mockResolvedValueOnce(record({ approvalStatus: "archived" }));
      await expect(svc.changeApprovalStatus("record-1", "draft", "actor-1")).rejects.toThrow(
        BadRequestException,
      );

      records.findCurrentByRecordId.mockResolvedValueOnce(record({ approvalStatus: "superseded" }));
      await expect(svc.changeApprovalStatus("record-1", "draft", "actor-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("propagates a denial from assertAllowed and never attempts the status write", async () => {
      records.findCurrentByRecordId.mockResolvedValue(record({ approvalStatus: "under_review" }));
      authorizationService.assertAllowed.mockRejectedValue(
        new ForbiddenException("Missing permission: website_strategy:approve"),
      );

      await expect(svc.changeApprovalStatus("record-1", "approved", "actor-1")).rejects.toThrow(
        ForbiddenException,
      );
      expect(records.updateApprovalStatus).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when the atomic status write reports not_found", async () => {
      records.findCurrentByRecordId.mockResolvedValue(record({ approvalStatus: "draft" }));
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      records.updateApprovalStatus.mockResolvedValue({ outcome: "not_found" });

      await expect(svc.changeApprovalStatus("record-1", "submitted", "actor-1")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws ConflictException when the atomic status write loses a race", async () => {
      records.findCurrentByRecordId.mockResolvedValue(record({ approvalStatus: "draft" }));
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      records.updateApprovalStatus.mockResolvedValue({
        outcome: "conflict",
        entity: record({ approvalStatus: "archived" }),
      });

      await expect(svc.changeApprovalStatus("record-1", "submitted", "actor-1")).rejects.toThrow(
        ConflictException,
      );
    });

    it("logs (not throws) when the audit call fails after a successful status write", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      records.findCurrentByRecordId.mockResolvedValue(record({ approvalStatus: "draft" }));
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      records.updateApprovalStatus.mockResolvedValue({
        outcome: "updated",
        entity: record({ approvalStatus: "submitted" }),
      });
      auditService.record.mockRejectedValue(new Error("audit down"));

      const result = await svc.changeApprovalStatus("record-1", "submitted", "actor-1");

      expect(result.approvalStatus).toBe("submitted");
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it("on a successful '-> approved' transition, also calls supersedeOtherApprovedVersion for the same recordId, excluding the just-approved row", async () => {
      records.findCurrentByRecordId.mockResolvedValue(
        record({ id: "row-2", recordId: "record-1", approvalStatus: "under_review" }),
      );
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      records.updateApprovalStatus.mockResolvedValue({
        outcome: "updated",
        entity: record({ id: "row-2", recordId: "record-1", approvalStatus: "approved" }),
      });
      records.supersedeOtherApprovedVersion.mockResolvedValue(undefined);

      await svc.changeApprovalStatus("record-1", "approved", "actor-1");

      expect(records.supersedeOtherApprovedVersion).toHaveBeenCalledWith(
        "record-1",
        "row-2",
        "actor-1",
        expect.anything(),
      );
    });

    it("on a successful '-> approved' transition with no prior approved version, still calls supersedeOtherApprovedVersion (a safe no-op at the repository layer) without erroring", async () => {
      records.findCurrentByRecordId.mockResolvedValue(
        record({ id: "row-1", recordId: "record-1", approvalStatus: "under_review" }),
      );
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      records.updateApprovalStatus.mockResolvedValue({
        outcome: "updated",
        entity: record({ id: "row-1", recordId: "record-1", approvalStatus: "approved" }),
      });
      records.supersedeOtherApprovedVersion.mockResolvedValue(undefined);

      const result = await svc.changeApprovalStatus("record-1", "approved", "actor-1");

      expect(result.approvalStatus).toBe("approved");
      expect(records.supersedeOtherApprovedVersion).toHaveBeenCalledTimes(1);
    });

    it("does NOT call supersedeOtherApprovedVersion when the CAS write itself loses the race (outcome !== 'updated')", async () => {
      records.findCurrentByRecordId.mockResolvedValue(
        record({ id: "row-1", recordId: "record-1", approvalStatus: "under_review" }),
      );
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      records.updateApprovalStatus.mockResolvedValue({
        outcome: "conflict",
        entity: record({ id: "row-1", recordId: "record-1", approvalStatus: "archived" }),
      });

      await expect(svc.changeApprovalStatus("record-1", "approved", "actor-1")).rejects.toThrow(
        ConflictException,
      );
      expect(records.supersedeOtherApprovedVersion).not.toHaveBeenCalled();
    });

    it("does NOT call supersedeOtherApprovedVersion for a non-approval transition", async () => {
      records.findCurrentByRecordId.mockResolvedValue(record({ approvalStatus: "draft" }));
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      records.updateApprovalStatus.mockResolvedValue({
        outcome: "updated",
        entity: record({ approvalStatus: "submitted" }),
      });

      await svc.changeApprovalStatus("record-1", "submitted", "actor-1");

      expect(records.supersedeOtherApprovedVersion).not.toHaveBeenCalled();
    });
  });
});
