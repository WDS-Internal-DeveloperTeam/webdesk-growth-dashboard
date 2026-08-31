import type { WireframeRecordEntity, WireframeRecordRepository } from "@webdesk/database";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditService } from "../audit/audit.service.js";
import type { AuthorizationService } from "../authz/authorization.service.js";
import type { UsersService } from "../users/users.service.js";
import { WireframesService } from "./wireframes.service.js";

// withTransaction() opens a real Sequelize connection (needs DATABASE_URL) — irrelevant to this
// service's own logic, so it's stubbed to just invoke the callback, matching
// SectionPatternsService's own identical spec-file pattern. update()'s "-> new version" branch and
// changeApprovalStatus()'s "-> approved" branch both go through it.
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

/** A stand-in for Sequelize's real `UniqueConstraintError` — checked via the shared
 *  `isSequelizeUniqueConstraintError()` helper in `WireframesService`, not `instanceof`, since
 *  `dashboard-api` never imports `sequelize` directly. */
function uniqueConstraintError(): Error {
  const error = new Error("Validation error");
  error.name = "SequelizeUniqueConstraintError";
  return error;
}

function record(overrides: Partial<WireframeRecordEntity> = {}): WireframeRecordEntity {
  return {
    id: "row-1",
    recordId: "record-1",
    publicId: "WF-HOMEPAGE",
    pageOrModule: "Homepage",
    versionNumber: 1,
    isCurrent: true,
    viewport: "desktop",
    fileReference: "https://www.figma.com/file/abc123",
    annotations: "Existing annotation",
    interactionNotes: null,
    relatedTemplateId: null,
    reviewerUserId: null,
    approvalStatus: "draft",
    createdBy: "actor-1",
    updatedBy: "actor-1",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("WireframesService", () => {
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
  let usersService: { assertUserExists: ReturnType<typeof vi.fn> };
  let svc: WireframesService;

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
    usersService = { assertUserExists: vi.fn().mockResolvedValue(undefined) };
    svc = new WireframesService(
      records as unknown as WireframeRecordRepository,
      authorizationService as unknown as AuthorizationService,
      auditService as unknown as AuditService,
      usersService as unknown as UsersService,
    );
  });

  describe("create", () => {
    it("creates a wireframe record after validating the publicId is free", async () => {
      records.findCurrentByPublicId.mockResolvedValue(null);
      records.create.mockResolvedValue(record());

      const result = await svc.create(
        { publicId: "WF-HOMEPAGE", pageOrModule: "Homepage", viewport: "desktop" },
        "actor-1",
      );

      expect(result).toEqual(record());
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "create", entityType: "wireframe_record" }),
      );
    });

    it("validates reviewerUserId existence before creating", async () => {
      records.findCurrentByPublicId.mockResolvedValue(null);
      records.create.mockResolvedValue(record());

      await svc.create(
        {
          publicId: "WF-HOMEPAGE",
          pageOrModule: "Homepage",
          viewport: "desktop",
          reviewerUserId: "reviewer-1",
        },
        "actor-1",
      );

      expect(usersService.assertUserExists).toHaveBeenCalledWith("reviewer-1", "reviewerUserId");
    });

    it("propagates a BadRequestException from a nonexistent reviewerUserId and never calls create()", async () => {
      records.findCurrentByPublicId.mockResolvedValue(null);
      usersService.assertUserExists.mockRejectedValue(
        new BadRequestException("reviewerUserId does not resolve to an active user"),
      );

      await expect(
        svc.create(
          {
            publicId: "WF-HOMEPAGE",
            pageOrModule: "Homepage",
            viewport: "desktop",
            reviewerUserId: "missing-user",
          },
          "actor-1",
        ),
      ).rejects.toThrow(BadRequestException);
      expect(records.create).not.toHaveBeenCalled();
    });

    it("sanitizes rich-text fields (annotations/interactionNotes) before writing", async () => {
      records.findCurrentByPublicId.mockResolvedValue(null);
      records.create.mockResolvedValue(record());

      await svc.create(
        {
          publicId: "WF-X",
          pageOrModule: "Contact page",
          viewport: "mobile",
          annotations: "<p>Safe</p><script>alert(1)</script>",
          interactionNotes: "<p>Tap to expand</p>",
        },
        "actor-1",
      );

      const [writtenInput] = records.create.mock.calls[0] as [Record<string, unknown>];
      expect(writtenInput.annotations).not.toContain("<script>");
      expect(writtenInput.interactionNotes).toContain("Tap to expand");
    });

    it("rejects a duplicate publicId", async () => {
      records.findCurrentByPublicId.mockResolvedValue(record());

      await expect(
        svc.create(
          { publicId: "WF-HOMEPAGE", pageOrModule: "Homepage", viewport: "desktop" },
          "actor-1",
        ),
      ).rejects.toThrow(BadRequestException);
      expect(records.create).not.toHaveBeenCalled();
    });

    it("translates a concurrent publicId collision into a clean 400, not a raw 500", async () => {
      records.findCurrentByPublicId.mockResolvedValue(null);
      records.create.mockRejectedValue(uniqueConstraintError());

      await expect(
        svc.create({ publicId: "WF-RACE", pageOrModule: "X", viewport: "desktop" }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("re-throws a non-uniqueness error from create() unchanged", async () => {
      records.findCurrentByPublicId.mockResolvedValue(null);
      const dbError = new Error("connection reset");
      records.create.mockRejectedValue(dbError);

      await expect(
        svc.create({ publicId: "WF-X", pageOrModule: "X", viewport: "desktop" }, "actor-1"),
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
      records.updateInPlace.mockResolvedValue(record({ viewport: "tablet" }));

      const result = await svc.update("record-1", { viewport: "tablet" }, "actor-1");

      expect(result.viewport).toBe("tablet");
      // The trailing "draft" is the CAS guard — updateInPlace() only writes if the row's
      // approvalStatus still matches what was read, so a concurrent status change can't silently
      // land on top of it.
      expect(records.updateInPlace).toHaveBeenCalledWith(
        "row-1",
        expect.objectContaining({ viewport: "tablet", updatedBy: "actor-1" }),
        undefined,
        "draft",
      );
      expect(records.createNewVersion).not.toHaveBeenCalled();
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "update", entityType: "wireframe_record" }),
      );
    });

    it("validates reviewerUserId existence before an in-place update", async () => {
      records.findCurrentByRecordId.mockResolvedValue(record({ approvalStatus: "draft" }));
      records.updateInPlace.mockResolvedValue(record());

      await svc.update("record-1", { reviewerUserId: "reviewer-2" }, "actor-1");

      expect(usersService.assertUserExists).toHaveBeenCalledWith("reviewer-2", "reviewerUserId");
    });

    it("also mutates in place for a revision_requested/rejected/submitted/under_review current version (only 'approved' triggers a new version)", async () => {
      for (const status of [
        "submitted",
        "under_review",
        "revision_requested",
        "rejected",
      ] as const) {
        records.findCurrentByRecordId.mockResolvedValue(record({ approvalStatus: status }));
        records.updateInPlace.mockResolvedValue(record({ approvalStatus: status }));

        await svc.update("record-1", { viewport: "mobile" }, "actor-1");

        expect(records.createNewVersion).not.toHaveBeenCalled();
      }
    });

    it("throws NotFoundException when the recordId does not resolve to a current version", async () => {
      records.findCurrentByRecordId.mockResolvedValue(null);
      await expect(svc.update("missing", { viewport: "mobile" }, "actor-1")).rejects.toThrow(
        NotFoundException,
      );
      expect(records.updateInPlace).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when the in-place update finds nothing to update AND a re-check confirms the record is genuinely gone", async () => {
      records.findCurrentByRecordId
        .mockResolvedValueOnce(record({ approvalStatus: "draft" })) // the initial findCurrent() read
        .mockResolvedValueOnce(null); // the re-check after updateInPlace() returns null
      records.updateInPlace.mockResolvedValue(null);

      await expect(svc.update("record-1", { viewport: "mobile" }, "actor-1")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws ConflictException (not NotFoundException) when updateInPlace's CAS guard finds nothing to update because approvalStatus changed concurrently (the record itself still exists)", async () => {
      records.findCurrentByRecordId
        .mockResolvedValueOnce(record({ approvalStatus: "draft" })) // the initial findCurrent() read
        .mockResolvedValueOnce(record({ approvalStatus: "approved" })); // the re-check — still exists, just a different status now
      records.updateInPlace.mockResolvedValue(null);

      await expect(svc.update("record-1", { viewport: "mobile" }, "actor-1")).rejects.toThrow(
        ConflictException,
      );
    });

    it("throws BadRequestException without ever calling updateInPlace when the current version is archived", async () => {
      records.findCurrentByRecordId.mockResolvedValue(record({ approvalStatus: "archived" }));

      await expect(svc.update("record-1", { viewport: "mobile" }, "actor-1")).rejects.toThrow(
        BadRequestException,
      );
      expect(records.updateInPlace).not.toHaveBeenCalled();
    });

    it("throws BadRequestException without ever calling updateInPlace when the current version is superseded", async () => {
      records.findCurrentByRecordId.mockResolvedValue(record({ approvalStatus: "superseded" }));

      await expect(svc.update("record-1", { viewport: "mobile" }, "actor-1")).rejects.toThrow(
        BadRequestException,
      );
      expect(records.updateInPlace).not.toHaveBeenCalled();
    });

    it("never accepts approvalStatus/pageOrModule/publicId through the general update patch — the patch object forwarded to the repository only ever carries the DTO's own fields", async () => {
      records.findCurrentByRecordId.mockResolvedValue(record({ approvalStatus: "draft" }));
      records.updateInPlace.mockResolvedValue(record({ viewport: "mobile" }));

      await svc.update("record-1", { viewport: "mobile" }, "actor-1");

      const [, patchArg] = records.updateInPlace.mock.calls[0] as [string, Record<string, unknown>];
      expect(patchArg).not.toHaveProperty("approvalStatus");
      expect(patchArg).not.toHaveProperty("pageOrModule");
      expect(patchArg).not.toHaveProperty("publicId");
    });
  });

  describe("update — approved current version (creates a genuinely new version)", () => {
    it("flips the old current row's isCurrent to false and inserts a new draft version row with versionNumber incremented", async () => {
      const approved = record({
        id: "row-1",
        recordId: "record-1",
        publicId: "WF-HOMEPAGE",
        pageOrModule: "Homepage",
        versionNumber: 3,
        isCurrent: true,
        approvalStatus: "approved",
        viewport: "desktop",
      });
      records.findCurrentByRecordId.mockResolvedValue(approved);
      records.updateInPlace.mockResolvedValue(record({ ...approved, isCurrent: false }));
      const newVersionRow = record({
        id: "row-2",
        recordId: "record-1",
        publicId: "WF-HOMEPAGE",
        pageOrModule: "Homepage",
        versionNumber: 4,
        isCurrent: true,
        approvalStatus: "draft",
        viewport: "mobile",
      });
      records.createNewVersion.mockResolvedValue(newVersionRow);

      const result = await svc.update("record-1", { viewport: "mobile" }, "actor-1");

      expect(result).toEqual(newVersionRow);
      // The old row is flipped to isCurrent: false first — CAS-guarded on "approved", so a
      // concurrent archive/supersede can't have this fork silently proceed.
      expect(records.updateInPlace).toHaveBeenCalledWith(
        "row-1",
        expect.objectContaining({ isCurrent: false, updatedBy: "actor-1" }),
        expect.anything(),
        "approved",
      );
      // The new row copies recordId/publicId/pageOrModule forward and increments versionNumber.
      expect(records.createNewVersion).toHaveBeenCalledWith(
        expect.objectContaining({
          recordId: "record-1",
          publicId: "WF-HOMEPAGE",
          pageOrModule: "Homepage",
          versionNumber: 4,
          viewport: "mobile",
        }),
        expect.anything(),
      );
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "new_version", entityType: "wireframe_record" }),
      );
    });

    it("falls back to the current version's own fields for any field the patch omits", async () => {
      const approved = record({
        approvalStatus: "approved",
        fileReference: "https://www.figma.com/file/kept",
        relatedTemplateId: "template-123",
      });
      records.findCurrentByRecordId.mockResolvedValue(approved);
      records.updateInPlace.mockResolvedValue(record({ ...approved, isCurrent: false }));
      records.createNewVersion.mockResolvedValue(record());

      // Patch only touches viewport — fileReference/relatedTemplateId are omitted, not sent as null.
      await svc.update("record-1", { viewport: "tablet" }, "actor-1");

      expect(records.createNewVersion).toHaveBeenCalledWith(
        expect.objectContaining({
          fileReference: "https://www.figma.com/file/kept",
          relatedTemplateId: "template-123",
        }),
        expect.anything(),
      );
    });

    it("clears a nullable field when the patch explicitly sends null (distinct from omitting it)", async () => {
      const approved = record({ approvalStatus: "approved", fileReference: "https://x.test/a" });
      records.findCurrentByRecordId.mockResolvedValue(approved);
      records.updateInPlace.mockResolvedValue(record({ ...approved, isCurrent: false }));
      records.createNewVersion.mockResolvedValue(record());

      await svc.update("record-1", { fileReference: null }, "actor-1");

      expect(records.createNewVersion).toHaveBeenCalledWith(
        expect.objectContaining({ fileReference: null }),
        expect.anything(),
      );
    });

    it("sanitizes a genuinely new rich-text patch value on fork, and inherits the current (already-sanitized) value when omitted", async () => {
      const approved = record({
        approvalStatus: "approved",
        annotations: "Existing annotation",
      });
      records.findCurrentByRecordId.mockResolvedValue(approved);
      records.updateInPlace.mockResolvedValue(record({ ...approved, isCurrent: false }));
      records.createNewVersion.mockResolvedValue(record());

      await svc.update(
        "record-1",
        { annotations: "<p>New</p><script>alert(1)</script>" },
        "actor-1",
      );

      const [writtenInput] = records.createNewVersion.mock.calls[0] as [Record<string, unknown>];
      expect(writtenInput.annotations).not.toContain("<script>");

      records.createNewVersion.mockClear();
      records.findCurrentByRecordId.mockResolvedValue(approved);
      records.updateInPlace.mockResolvedValue(record({ ...approved, isCurrent: false }));
      records.createNewVersion.mockResolvedValue(record());

      await svc.update("record-1", { viewport: "mobile" }, "actor-1");
      expect(records.createNewVersion).toHaveBeenCalledWith(
        expect.objectContaining({ annotations: "Existing annotation" }),
        expect.anything(),
      );
    });

    it("never allows pageOrModule to change between versions — createNewVersion is always called with the CURRENT version's own pageOrModule, not anything from the patch (the update DTO itself has no pageOrModule field to send)", async () => {
      const approved = record({ approvalStatus: "approved", pageOrModule: "Pricing page" });
      records.findCurrentByRecordId.mockResolvedValue(approved);
      records.updateInPlace.mockResolvedValue(record({ ...approved, isCurrent: false }));
      records.createNewVersion.mockResolvedValue(record({ pageOrModule: "Pricing page" }));

      await svc.update("record-1", { viewport: "mobile" }, "actor-1");

      expect(records.createNewVersion).toHaveBeenCalledWith(
        expect.objectContaining({ pageOrModule: "Pricing page" }),
        expect.anything(),
      );
    });

    it("allows viewport to change between versions (NOT immutable, unlike pageOrModule)", async () => {
      const approved = record({ approvalStatus: "approved", viewport: "desktop" });
      records.findCurrentByRecordId.mockResolvedValue(approved);
      records.updateInPlace.mockResolvedValue(record({ ...approved, isCurrent: false }));
      records.createNewVersion.mockResolvedValue(record({ viewport: "mobile" }));

      await svc.update("record-1", { viewport: "mobile" }, "actor-1");

      expect(records.createNewVersion).toHaveBeenCalledWith(
        expect.objectContaining({ viewport: "mobile" }),
        expect.anything(),
      );
    });

    it("throws ConflictException (not NotFoundException) when the isCurrent-flip's CAS guard finds nothing to update because the row was archived/superseded concurrently (a same-id-only WHERE clause here would let an edit-only caller resurrect a just-archived record)", async () => {
      const approved = record({ approvalStatus: "approved" });
      records.findCurrentByRecordId.mockResolvedValue(approved);
      records.updateInPlace.mockResolvedValue(null);

      await expect(svc.update("record-1", { viewport: "mobile" }, "actor-1")).rejects.toThrow(
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

    it("translates a concurrent version-creation collision on (recordId, versionNumber) into a clean 409, not a raw error (mirrors create()'s own publicId-race handling)", async () => {
      const approved = record({ approvalStatus: "approved", versionNumber: 1 });
      records.findCurrentByRecordId.mockResolvedValue(approved);
      records.updateInPlace.mockResolvedValue(record({ ...approved, isCurrent: false }));
      records.createNewVersion.mockRejectedValue(uniqueConstraintError());

      await expect(svc.update("record-1", { viewport: "mobile" }, "actor-1")).rejects.toThrow(
        ConflictException,
      );
    });

    it("re-throws a non-uniqueness error from createNewVersion unchanged", async () => {
      const approved = record({ approvalStatus: "approved" });
      records.findCurrentByRecordId.mockResolvedValue(approved);
      records.updateInPlace.mockResolvedValue(record({ ...approved, isCurrent: false }));
      const dbError = new Error("connection reset");
      records.createNewVersion.mockRejectedValue(dbError);

      await expect(svc.update("record-1", { viewport: "mobile" }, "actor-1")).rejects.toBe(dbError);
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

    it("rejects a direct 'approved -> superseded' request — supersede is only ever an automatic side effect of a DIFFERENT version's own approval, never a directly requestable transition", async () => {
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
        "creative_design",
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
        new ForbiddenException("Missing permission: creative_design:approve"),
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
