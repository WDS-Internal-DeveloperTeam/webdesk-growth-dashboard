import type { PageTemplateEntity, PageTemplateRepository } from "@webdesk/database";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditService } from "../audit/audit.service.js";
import type { AuthorizationService } from "../authz/authorization.service.js";
import type { SectionPatternsService } from "../section-and-pattern-library/section-patterns.service.js";
import type { ComponentsService } from "../component-library/components.service.js";
import { PageTemplatesService } from "./page-templates.service.js";

// withTransaction() opens a real Sequelize connection (needs DATABASE_URL) — irrelevant to this
// service's own logic, so it's stubbed to just invoke the callback, matching
// ComponentsService's/SectionPatternsService's own identical spec-file pattern. update()'s
// "-> new version" branch and changeApprovalStatus()'s "-> approved" branch both go through it.
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
 *  `PageTemplatesService.create()` (via the shared `isSequelizeUniqueConstraintError()` helper)
 *  rather than `instanceof`, since `dashboard-api` never imports `sequelize` directly (only
 *  `packages/database` may). */
function uniqueConstraintError(): Error {
  const error = new Error("Validation error");
  error.name = "SequelizeUniqueConstraintError";
  return error;
}

function pageTemplate(overrides: Partial<PageTemplateEntity> = {}): PageTemplateEntity {
  return {
    id: "row-1",
    recordId: "record-1",
    publicId: "PGT-HOMEPAGE",
    pageType: "homepage",
    versionNumber: 1,
    isCurrent: true,
    name: "Homepage Template",
    requiredSectionIds: [],
    optionalSectionIds: [],
    supportedComponentIds: [],
    wireframeReferences: [],
    contentRequirements: null,
    searchRequirements: null,
    conversionGoal: null,
    phpTemplateRelationship: null,
    replacementRecordId: null,
    approvalStatus: "draft",
    createdBy: "actor-1",
    updatedBy: "actor-1",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("PageTemplatesService", () => {
  let pageTemplates: {
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
  let sectionPatternsService: { existingRecordIds: ReturnType<typeof vi.fn> };
  let componentsService: { existingComponentIds: ReturnType<typeof vi.fn> };
  let svc: PageTemplatesService;

  beforeEach(() => {
    pageTemplates = {
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
    sectionPatternsService = { existingRecordIds: vi.fn().mockResolvedValue(new Set()) };
    componentsService = { existingComponentIds: vi.fn().mockResolvedValue(new Set()) };
    svc = new PageTemplatesService(
      pageTemplates as unknown as PageTemplateRepository,
      authorizationService as unknown as AuthorizationService,
      auditService as unknown as AuditService,
      sectionPatternsService as unknown as SectionPatternsService,
      componentsService as unknown as ComponentsService,
    );
  });

  describe("create", () => {
    it("creates a page template after validating the publicId is free", async () => {
      pageTemplates.findCurrentByPublicId.mockResolvedValue(null);
      pageTemplates.create.mockResolvedValue(pageTemplate());

      const result = await svc.create(
        { publicId: "PGT-HOMEPAGE", pageType: "homepage", name: "Homepage Template" },
        "actor-1",
      );

      expect(result).toEqual(pageTemplate());
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "create", entityType: "page_template" }),
      );
    });

    it("defaults every relationship array field to an empty array when omitted", async () => {
      pageTemplates.findCurrentByPublicId.mockResolvedValue(null);
      pageTemplates.create.mockResolvedValue(pageTemplate());

      await svc.create({ publicId: "PGT-X", pageType: "service", name: "Service" }, "actor-1");

      const [writtenInput] = pageTemplates.create.mock.calls[0] as [Record<string, unknown>];
      expect(writtenInput.requiredSectionIds).toEqual([]);
      expect(writtenInput.optionalSectionIds).toEqual([]);
      expect(writtenInput.supportedComponentIds).toEqual([]);
      expect(writtenInput.wireframeReferences).toEqual([]);
    });

    it("validates requiredSectionIds against real Section and Pattern Library records before creating", async () => {
      pageTemplates.findCurrentByPublicId.mockResolvedValue(null);
      sectionPatternsService.existingRecordIds.mockResolvedValue(new Set(["section-1"]));
      pageTemplates.create.mockResolvedValue(pageTemplate({ requiredSectionIds: ["section-1"] }));

      await svc.create(
        {
          publicId: "PGT-X",
          pageType: "service",
          name: "Service",
          requiredSectionIds: ["section-1"],
        },
        "actor-1",
      );

      expect(sectionPatternsService.existingRecordIds).toHaveBeenCalledWith(["section-1"]);
      expect(pageTemplates.create).toHaveBeenCalled();
    });

    it("rejects creation when a requiredSectionIds entry does not resolve to a real section/pattern record", async () => {
      pageTemplates.findCurrentByPublicId.mockResolvedValue(null);
      sectionPatternsService.existingRecordIds.mockResolvedValue(new Set());

      await expect(
        svc.create(
          {
            publicId: "PGT-X",
            pageType: "service",
            name: "Service",
            requiredSectionIds: ["missing-section"],
          },
          "actor-1",
        ),
      ).rejects.toThrow(BadRequestException);
      expect(pageTemplates.create).not.toHaveBeenCalled();
    });

    it("rejects creation when an optionalSectionIds entry does not resolve to a real section/pattern record", async () => {
      pageTemplates.findCurrentByPublicId.mockResolvedValue(null);
      sectionPatternsService.existingRecordIds.mockResolvedValue(new Set());

      await expect(
        svc.create(
          {
            publicId: "PGT-X",
            pageType: "service",
            name: "Service",
            optionalSectionIds: ["missing-section"],
          },
          "actor-1",
        ),
      ).rejects.toThrow(BadRequestException);
      expect(pageTemplates.create).not.toHaveBeenCalled();
    });

    it("validates supportedComponentIds against real Component Library records before creating", async () => {
      pageTemplates.findCurrentByPublicId.mockResolvedValue(null);
      componentsService.existingComponentIds.mockResolvedValue(new Set(["component-1"]));
      pageTemplates.create.mockResolvedValue(
        pageTemplate({ supportedComponentIds: ["component-1"] }),
      );

      await svc.create(
        {
          publicId: "PGT-X",
          pageType: "service",
          name: "Service",
          supportedComponentIds: ["component-1"],
        },
        "actor-1",
      );

      expect(componentsService.existingComponentIds).toHaveBeenCalledWith(["component-1"]);
      expect(pageTemplates.create).toHaveBeenCalled();
    });

    it("rejects creation when a supportedComponentIds entry does not resolve to a real component", async () => {
      pageTemplates.findCurrentByPublicId.mockResolvedValue(null);
      componentsService.existingComponentIds.mockResolvedValue(new Set());

      await expect(
        svc.create(
          {
            publicId: "PGT-X",
            pageType: "service",
            name: "Service",
            supportedComponentIds: ["missing-component"],
          },
          "actor-1",
        ),
      ).rejects.toThrow(BadRequestException);
      expect(pageTemplates.create).not.toHaveBeenCalled();
    });

    it("never validates wireframeReferences against anything (plain, unvalidated strings)", async () => {
      pageTemplates.findCurrentByPublicId.mockResolvedValue(null);
      pageTemplates.create.mockResolvedValue(
        pageTemplate({ wireframeReferences: ["WF-not-a-uuid-reference"] }),
      );

      await svc.create(
        {
          publicId: "PGT-X",
          pageType: "service",
          name: "Service",
          wireframeReferences: ["WF-not-a-uuid-reference"],
        },
        "actor-1",
      );

      expect(pageTemplates.create).toHaveBeenCalledWith(
        expect.objectContaining({ wireframeReferences: ["WF-not-a-uuid-reference"] }),
      );
    });

    it("rejects creation when replacementRecordId does not resolve to a real page template", async () => {
      pageTemplates.findCurrentByPublicId.mockResolvedValue(null);
      pageTemplates.findCurrentByRecordId.mockResolvedValue(null);

      await expect(
        svc.create(
          {
            publicId: "PGT-X",
            pageType: "service",
            name: "Service",
            replacementRecordId: "missing-record",
          },
          "actor-1",
        ),
      ).rejects.toThrow(BadRequestException);
      expect(pageTemplates.create).not.toHaveBeenCalled();
    });

    it("allows creation when replacementRecordId resolves to a real page template", async () => {
      pageTemplates.findCurrentByPublicId.mockResolvedValue(null);
      pageTemplates.findCurrentByRecordId.mockResolvedValue(pageTemplate({ recordId: "record-2" }));
      pageTemplates.create.mockResolvedValue(pageTemplate());

      await svc.create(
        {
          publicId: "PGT-X",
          pageType: "service",
          name: "Service",
          replacementRecordId: "record-2",
        },
        "actor-1",
      );

      expect(pageTemplates.create).toHaveBeenCalled();
    });

    it("rejects a duplicate publicId", async () => {
      pageTemplates.findCurrentByPublicId.mockResolvedValue(pageTemplate());

      await expect(
        svc.create({ publicId: "PGT-HOMEPAGE", pageType: "homepage", name: "X" }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
      expect(pageTemplates.create).not.toHaveBeenCalled();
    });

    it("translates a concurrent publicId collision into a clean 400, not a raw 500", async () => {
      pageTemplates.findCurrentByPublicId.mockResolvedValue(null);
      pageTemplates.create.mockRejectedValue(uniqueConstraintError());

      await expect(
        svc.create({ publicId: "PGT-RACE", pageType: "homepage", name: "X" }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("re-throws a non-uniqueness error from create() unchanged", async () => {
      pageTemplates.findCurrentByPublicId.mockResolvedValue(null);
      const dbError = new Error("connection reset");
      pageTemplates.create.mockRejectedValue(dbError);

      await expect(
        svc.create({ publicId: "PGT-X", pageType: "homepage", name: "X" }, "actor-1"),
      ).rejects.toBe(dbError);
    });
  });

  describe("findCurrent", () => {
    it("throws NotFoundException when no current version exists for the recordId", async () => {
      pageTemplates.findCurrentByRecordId.mockResolvedValue(null);
      await expect(svc.findCurrent("missing")).rejects.toThrow(NotFoundException);
    });

    it("returns the current version when it exists", async () => {
      pageTemplates.findCurrentByRecordId.mockResolvedValue(pageTemplate());
      await expect(svc.findCurrent("record-1")).resolves.toEqual(pageTemplate());
    });
  });

  describe("listVersions", () => {
    it("throws NotFoundException when the recordId has zero rows at all", async () => {
      pageTemplates.listVersions.mockResolvedValue([]);
      await expect(svc.listVersions("missing")).rejects.toThrow(NotFoundException);
    });

    it("returns every version, oldest first, when the recordId exists", async () => {
      const versions = [
        pageTemplate({
          id: "row-1",
          versionNumber: 1,
          isCurrent: false,
          approvalStatus: "superseded",
        }),
        pageTemplate({
          id: "row-2",
          versionNumber: 2,
          isCurrent: true,
          approvalStatus: "approved",
        }),
      ];
      pageTemplates.listVersions.mockResolvedValue(versions);
      await expect(svc.listVersions("record-1")).resolves.toEqual(versions);
    });
  });

  describe("list", () => {
    it("delegates the filter straight through to the repository", async () => {
      pageTemplates.list.mockResolvedValue([pageTemplate()]);
      const result = await svc.list({ approvalStatus: "draft" });
      expect(pageTemplates.list).toHaveBeenCalledWith({ approvalStatus: "draft" });
      expect(result).toEqual([pageTemplate()]);
    });
  });

  describe("update — non-approved current version (in-place mutation)", () => {
    it("mutates the current row in place, without creating a new version row", async () => {
      pageTemplates.findCurrentByRecordId.mockResolvedValue(
        pageTemplate({ approvalStatus: "draft" }),
      );
      pageTemplates.updateInPlace.mockResolvedValue(pageTemplate({ name: "Renamed" }));

      const result = await svc.update("record-1", { name: "Renamed" }, "actor-1");

      expect(result.name).toBe("Renamed");
      // The trailing "draft" is the CAS guard.
      expect(pageTemplates.updateInPlace).toHaveBeenCalledWith(
        "row-1",
        expect.objectContaining({ name: "Renamed", updatedBy: "actor-1" }),
        undefined,
        "draft",
      );
      expect(pageTemplates.createNewVersion).not.toHaveBeenCalled();
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "update", entityType: "page_template" }),
      );
    });

    it("validates relationship fields and replacementRecordId before mutating in place", async () => {
      pageTemplates.findCurrentByRecordId
        .mockResolvedValueOnce(pageTemplate({ approvalStatus: "draft" })) // findCurrent()
        .mockResolvedValueOnce(pageTemplate({ recordId: "record-9" })); // assertReplacementExists()
      sectionPatternsService.existingRecordIds.mockResolvedValue(new Set(["section-1"]));
      componentsService.existingComponentIds.mockResolvedValue(new Set(["component-1"]));
      pageTemplates.updateInPlace.mockResolvedValue(pageTemplate());

      await svc.update(
        "record-1",
        {
          requiredSectionIds: ["section-1"],
          supportedComponentIds: ["component-1"],
          replacementRecordId: "record-9",
        },
        "actor-1",
      );

      expect(sectionPatternsService.existingRecordIds).toHaveBeenCalledWith(["section-1"]);
      expect(componentsService.existingComponentIds).toHaveBeenCalledWith(["component-1"]);
      expect(pageTemplates.updateInPlace).toHaveBeenCalled();
    });

    it("rejects an update whose replacementRecordId is the record's own recordId", async () => {
      pageTemplates.findCurrentByRecordId.mockResolvedValue(
        pageTemplate({ approvalStatus: "draft" }),
      );

      await expect(
        svc.update("record-1", { replacementRecordId: "record-1" }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
      expect(pageTemplates.updateInPlace).not.toHaveBeenCalled();
    });

    it("rejects an update when a patched requiredSectionIds entry does not resolve to a real record", async () => {
      pageTemplates.findCurrentByRecordId.mockResolvedValue(
        pageTemplate({ approvalStatus: "draft" }),
      );
      sectionPatternsService.existingRecordIds.mockResolvedValue(new Set());

      await expect(
        svc.update("record-1", { requiredSectionIds: ["missing-section"] }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
      expect(pageTemplates.updateInPlace).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when the recordId does not resolve to a current version", async () => {
      pageTemplates.findCurrentByRecordId.mockResolvedValue(null);
      await expect(svc.update("missing", { name: "X" }, "actor-1")).rejects.toThrow(
        NotFoundException,
      );
      expect(pageTemplates.updateInPlace).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when the in-place update finds nothing to update AND a re-check confirms the record is genuinely gone", async () => {
      pageTemplates.findCurrentByRecordId
        .mockResolvedValueOnce(pageTemplate({ approvalStatus: "draft" })) // the initial findCurrent() read
        .mockResolvedValueOnce(null); // the re-check after updateInPlace() returns null
      pageTemplates.updateInPlace.mockResolvedValue(null);

      await expect(svc.update("record-1", { name: "X" }, "actor-1")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws ConflictException (not NotFoundException) when updateInPlace's CAS guard finds nothing to update because approvalStatus changed concurrently (the record itself still exists)", async () => {
      pageTemplates.findCurrentByRecordId
        .mockResolvedValueOnce(pageTemplate({ approvalStatus: "draft" })) // the initial findCurrent() read
        .mockResolvedValueOnce(pageTemplate({ approvalStatus: "approved" })); // the re-check — still exists, just a different status now
      pageTemplates.updateInPlace.mockResolvedValue(null);

      await expect(svc.update("record-1", { name: "X" }, "actor-1")).rejects.toThrow(
        ConflictException,
      );
    });

    it("throws BadRequestException without ever calling updateInPlace when the current version is archived", async () => {
      pageTemplates.findCurrentByRecordId.mockResolvedValue(
        pageTemplate({ approvalStatus: "archived" }),
      );

      await expect(svc.update("record-1", { name: "X" }, "actor-1")).rejects.toThrow(
        BadRequestException,
      );
      expect(pageTemplates.updateInPlace).not.toHaveBeenCalled();
    });

    it("throws BadRequestException without ever calling updateInPlace when the current version is superseded", async () => {
      pageTemplates.findCurrentByRecordId.mockResolvedValue(
        pageTemplate({ approvalStatus: "superseded" }),
      );

      await expect(svc.update("record-1", { name: "X" }, "actor-1")).rejects.toThrow(
        BadRequestException,
      );
      expect(pageTemplates.updateInPlace).not.toHaveBeenCalled();
    });

    it("never accepts approvalStatus/pageType/publicId through the general update patch", async () => {
      pageTemplates.findCurrentByRecordId.mockResolvedValue(
        pageTemplate({ approvalStatus: "draft" }),
      );
      pageTemplates.updateInPlace.mockResolvedValue(pageTemplate({ name: "Renamed" }));

      await svc.update("record-1", { name: "Renamed" }, "actor-1");

      const [, patchArg] = pageTemplates.updateInPlace.mock.calls[0] as [
        string,
        Record<string, unknown>,
      ];
      expect(patchArg).not.toHaveProperty("approvalStatus");
      expect(patchArg).not.toHaveProperty("pageType");
      expect(patchArg).not.toHaveProperty("publicId");
    });
  });

  describe("update — approved current version (creates a genuinely new version)", () => {
    it("flips the old current row's isCurrent to false and inserts a new draft version row with versionNumber incremented", async () => {
      const approved = pageTemplate({
        id: "row-1",
        recordId: "record-1",
        publicId: "PGT-HOMEPAGE",
        pageType: "homepage",
        versionNumber: 3,
        isCurrent: true,
        approvalStatus: "approved",
        name: "Old name",
      });
      pageTemplates.findCurrentByRecordId.mockResolvedValue(approved);
      pageTemplates.updateInPlace.mockResolvedValue(
        pageTemplate({ ...approved, isCurrent: false }),
      );
      const newVersionRow = pageTemplate({
        id: "row-2",
        recordId: "record-1",
        publicId: "PGT-HOMEPAGE",
        pageType: "homepage",
        versionNumber: 4,
        isCurrent: true,
        approvalStatus: "draft",
        name: "New name",
      });
      pageTemplates.createNewVersion.mockResolvedValue(newVersionRow);

      const result = await svc.update("record-1", { name: "New name" }, "actor-1");

      expect(result).toEqual(newVersionRow);
      expect(pageTemplates.updateInPlace).toHaveBeenCalledWith(
        "row-1",
        expect.objectContaining({ isCurrent: false, updatedBy: "actor-1" }),
        expect.anything(),
        "approved",
      );
      expect(pageTemplates.createNewVersion).toHaveBeenCalledWith(
        expect.objectContaining({
          recordId: "record-1",
          publicId: "PGT-HOMEPAGE",
          pageType: "homepage",
          versionNumber: 4,
          name: "New name",
        }),
        expect.anything(),
      );
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "new_version", entityType: "page_template" }),
      );
    });

    it("falls back to the current version's own fields for any field the patch omits", async () => {
      const approved = pageTemplate({
        approvalStatus: "approved",
        conversionGoal: "Existing conversion goal",
        phpTemplateRelationship: "existing/path.php",
      });
      pageTemplates.findCurrentByRecordId.mockResolvedValue(approved);
      pageTemplates.updateInPlace.mockResolvedValue(
        pageTemplate({ ...approved, isCurrent: false }),
      );
      pageTemplates.createNewVersion.mockResolvedValue(pageTemplate());

      await svc.update("record-1", { name: "New name only" }, "actor-1");

      expect(pageTemplates.createNewVersion).toHaveBeenCalledWith(
        expect.objectContaining({
          conversionGoal: "Existing conversion goal",
          phpTemplateRelationship: "existing/path.php",
        }),
        expect.anything(),
      );
    });

    it("clears a nullable field when the patch explicitly sends null (distinct from omitting it)", async () => {
      const approved = pageTemplate({
        approvalStatus: "approved",
        phpTemplateRelationship: "old/path.php",
      });
      pageTemplates.findCurrentByRecordId.mockResolvedValue(approved);
      pageTemplates.updateInPlace.mockResolvedValue(
        pageTemplate({ ...approved, isCurrent: false }),
      );
      pageTemplates.createNewVersion.mockResolvedValue(pageTemplate());

      await svc.update("record-1", { phpTemplateRelationship: null }, "actor-1");

      expect(pageTemplates.createNewVersion).toHaveBeenCalledWith(
        expect.objectContaining({ phpTemplateRelationship: null }),
        expect.anything(),
      );
    });

    it("clears requiredSectionIds to [] when the patch explicitly sends null, distinct from omitting it", async () => {
      const approved = pageTemplate({
        approvalStatus: "approved",
        requiredSectionIds: ["section-1", "section-2"],
      });
      pageTemplates.findCurrentByRecordId.mockResolvedValue(approved);
      pageTemplates.updateInPlace.mockResolvedValue(
        pageTemplate({ ...approved, isCurrent: false }),
      );
      pageTemplates.createNewVersion.mockResolvedValue(pageTemplate());

      await svc.update("record-1", { requiredSectionIds: null }, "actor-1");

      expect(pageTemplates.createNewVersion).toHaveBeenCalledWith(
        expect.objectContaining({ requiredSectionIds: [] }),
        expect.anything(),
      );
    });

    it("inherits the current version's requiredSectionIds when the patch omits the field entirely", async () => {
      const approved = pageTemplate({
        approvalStatus: "approved",
        requiredSectionIds: ["section-1", "section-2"],
      });
      pageTemplates.findCurrentByRecordId.mockResolvedValue(approved);
      pageTemplates.updateInPlace.mockResolvedValue(
        pageTemplate({ ...approved, isCurrent: false }),
      );
      pageTemplates.createNewVersion.mockResolvedValue(pageTemplate());

      await svc.update("record-1", { name: "New name only" }, "actor-1");

      expect(pageTemplates.createNewVersion).toHaveBeenCalledWith(
        expect.objectContaining({ requiredSectionIds: ["section-1", "section-2"] }),
        expect.anything(),
      );
    });

    it("never allows pageType to change between versions — createNewVersion is always called with the CURRENT version's own pageType, not anything from the patch", async () => {
      const approved = pageTemplate({ approvalStatus: "approved", pageType: "landing" });
      pageTemplates.findCurrentByRecordId.mockResolvedValue(approved);
      pageTemplates.updateInPlace.mockResolvedValue(
        pageTemplate({ ...approved, isCurrent: false }),
      );
      pageTemplates.createNewVersion.mockResolvedValue(pageTemplate({ pageType: "landing" }));

      await svc.update("record-1", { name: "X" }, "actor-1");

      expect(pageTemplates.createNewVersion).toHaveBeenCalledWith(
        expect.objectContaining({ pageType: "landing" }),
        expect.anything(),
      );
    });

    it("throws ConflictException (not NotFoundException) when the isCurrent-flip's CAS guard finds nothing to update because the row was archived/superseded concurrently", async () => {
      const approved = pageTemplate({ approvalStatus: "approved" });
      pageTemplates.findCurrentByRecordId.mockResolvedValue(approved);
      pageTemplates.updateInPlace.mockResolvedValue(null);

      await expect(svc.update("record-1", { name: "X" }, "actor-1")).rejects.toThrow(
        ConflictException,
      );
      expect(pageTemplates.updateInPlace).toHaveBeenCalledWith(
        "row-1",
        expect.objectContaining({ isCurrent: false }),
        expect.anything(),
        "approved",
      );
      expect(pageTemplates.createNewVersion).not.toHaveBeenCalled();
    });

    it("translates a concurrent version-creation collision on (recordId, versionNumber) into a clean 409, not a raw error", async () => {
      const approved = pageTemplate({ approvalStatus: "approved", versionNumber: 1 });
      pageTemplates.findCurrentByRecordId.mockResolvedValue(approved);
      pageTemplates.updateInPlace.mockResolvedValue(
        pageTemplate({ ...approved, isCurrent: false }),
      );
      pageTemplates.createNewVersion.mockRejectedValue(uniqueConstraintError());

      await expect(svc.update("record-1", { name: "X" }, "actor-1")).rejects.toThrow(
        ConflictException,
      );
    });

    it("re-throws a non-uniqueness error from createNewVersion unchanged", async () => {
      const approved = pageTemplate({ approvalStatus: "approved" });
      pageTemplates.findCurrentByRecordId.mockResolvedValue(approved);
      pageTemplates.updateInPlace.mockResolvedValue(
        pageTemplate({ ...approved, isCurrent: false }),
      );
      const dbError = new Error("connection reset");
      pageTemplates.createNewVersion.mockRejectedValue(dbError);

      await expect(svc.update("record-1", { name: "X" }, "actor-1")).rejects.toBe(dbError);
    });
  });

  describe("changeApprovalStatus", () => {
    it("is a no-op returning the current entity when the requested status matches the current one", async () => {
      pageTemplates.findCurrentByRecordId.mockResolvedValue(
        pageTemplate({ approvalStatus: "draft" }),
      );
      const result = await svc.changeApprovalStatus("record-1", "draft", "actor-1");
      expect(result.approvalStatus).toBe("draft");
      expect(authorizationService.assertAllowed).not.toHaveBeenCalled();
    });

    it("rejects a transition not in the allowlist", async () => {
      pageTemplates.findCurrentByRecordId.mockResolvedValue(
        pageTemplate({ approvalStatus: "draft" }),
      );
      await expect(svc.changeApprovalStatus("record-1", "approved", "actor-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("rejects a direct 'approved -> superseded' request", async () => {
      pageTemplates.findCurrentByRecordId.mockResolvedValue(
        pageTemplate({ approvalStatus: "approved" }),
      );

      await expect(svc.changeApprovalStatus("record-1", "superseded", "actor-1")).rejects.toThrow(
        BadRequestException,
      );
      expect(authorizationService.assertAllowed).not.toHaveBeenCalled();
      expect(pageTemplates.updateApprovalStatus).not.toHaveBeenCalled();
      expect(pageTemplates.supersedeOtherApprovedVersion).not.toHaveBeenCalled();
    });

    it.each([
      ["draft", "submitted", "submit"],
      ["submitted", "under_review", "review"],
      ["under_review", "revision_requested", "review"],
      ["under_review", "rejected", "approve"],
    ] as const)("requires the '%s -> %s' transition's '%s' action", async (from, to, action) => {
      pageTemplates.findCurrentByRecordId.mockResolvedValue(pageTemplate({ approvalStatus: from }));
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      pageTemplates.updateApprovalStatus.mockResolvedValue({
        outcome: "updated",
        entity: pageTemplate({ approvalStatus: to }),
      });

      await svc.changeApprovalStatus("record-1", to, "actor-1");

      expect(authorizationService.assertAllowed).toHaveBeenCalledWith(
        "actor-1",
        "creative_design",
        action,
      );
    });

    it("rejects every transition out of the terminal 'archived'/'superseded' states", async () => {
      pageTemplates.findCurrentByRecordId.mockResolvedValueOnce(
        pageTemplate({ approvalStatus: "archived" }),
      );
      await expect(svc.changeApprovalStatus("record-1", "draft", "actor-1")).rejects.toThrow(
        BadRequestException,
      );

      pageTemplates.findCurrentByRecordId.mockResolvedValueOnce(
        pageTemplate({ approvalStatus: "superseded" }),
      );
      await expect(svc.changeApprovalStatus("record-1", "draft", "actor-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("propagates a denial from assertAllowed and never attempts the status write", async () => {
      pageTemplates.findCurrentByRecordId.mockResolvedValue(
        pageTemplate({ approvalStatus: "under_review" }),
      );
      authorizationService.assertAllowed.mockRejectedValue(
        new ForbiddenException("Missing permission: creative_design:approve"),
      );

      await expect(svc.changeApprovalStatus("record-1", "approved", "actor-1")).rejects.toThrow(
        ForbiddenException,
      );
      expect(pageTemplates.updateApprovalStatus).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when the atomic status write reports not_found", async () => {
      pageTemplates.findCurrentByRecordId.mockResolvedValue(
        pageTemplate({ approvalStatus: "draft" }),
      );
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      pageTemplates.updateApprovalStatus.mockResolvedValue({ outcome: "not_found" });

      await expect(svc.changeApprovalStatus("record-1", "submitted", "actor-1")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws ConflictException when the atomic status write loses a race", async () => {
      pageTemplates.findCurrentByRecordId.mockResolvedValue(
        pageTemplate({ approvalStatus: "draft" }),
      );
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      pageTemplates.updateApprovalStatus.mockResolvedValue({
        outcome: "conflict",
        entity: pageTemplate({ approvalStatus: "archived" }),
      });

      await expect(svc.changeApprovalStatus("record-1", "submitted", "actor-1")).rejects.toThrow(
        ConflictException,
      );
    });

    it("logs (not throws) when the audit call fails after a successful status write", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      pageTemplates.findCurrentByRecordId.mockResolvedValue(
        pageTemplate({ approvalStatus: "draft" }),
      );
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      pageTemplates.updateApprovalStatus.mockResolvedValue({
        outcome: "updated",
        entity: pageTemplate({ approvalStatus: "submitted" }),
      });
      auditService.record.mockRejectedValue(new Error("audit down"));

      const result = await svc.changeApprovalStatus("record-1", "submitted", "actor-1");

      expect(result.approvalStatus).toBe("submitted");
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it("on a successful '-> approved' transition, also calls supersedeOtherApprovedVersion for the same recordId, excluding the just-approved row", async () => {
      pageTemplates.findCurrentByRecordId.mockResolvedValue(
        pageTemplate({ id: "row-2", recordId: "record-1", approvalStatus: "under_review" }),
      );
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      pageTemplates.updateApprovalStatus.mockResolvedValue({
        outcome: "updated",
        entity: pageTemplate({ id: "row-2", recordId: "record-1", approvalStatus: "approved" }),
      });
      pageTemplates.supersedeOtherApprovedVersion.mockResolvedValue(undefined);

      await svc.changeApprovalStatus("record-1", "approved", "actor-1");

      expect(pageTemplates.supersedeOtherApprovedVersion).toHaveBeenCalledWith(
        "record-1",
        "row-2",
        "actor-1",
        expect.anything(),
      );
    });

    it("does NOT call supersedeOtherApprovedVersion when the CAS write itself loses the race (outcome !== 'updated')", async () => {
      pageTemplates.findCurrentByRecordId.mockResolvedValue(
        pageTemplate({ id: "row-1", recordId: "record-1", approvalStatus: "under_review" }),
      );
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      pageTemplates.updateApprovalStatus.mockResolvedValue({
        outcome: "conflict",
        entity: pageTemplate({ id: "row-1", recordId: "record-1", approvalStatus: "archived" }),
      });

      await expect(svc.changeApprovalStatus("record-1", "approved", "actor-1")).rejects.toThrow(
        ConflictException,
      );
      expect(pageTemplates.supersedeOtherApprovedVersion).not.toHaveBeenCalled();
    });

    it("does NOT call supersedeOtherApprovedVersion for a non-approval transition", async () => {
      pageTemplates.findCurrentByRecordId.mockResolvedValue(
        pageTemplate({ approvalStatus: "draft" }),
      );
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      pageTemplates.updateApprovalStatus.mockResolvedValue({
        outcome: "updated",
        entity: pageTemplate({ approvalStatus: "submitted" }),
      });

      await svc.changeApprovalStatus("record-1", "submitted", "actor-1");

      expect(pageTemplates.supersedeOtherApprovedVersion).not.toHaveBeenCalled();
    });
  });
});
