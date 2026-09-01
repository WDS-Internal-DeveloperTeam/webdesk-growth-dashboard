import type {
  MotionInteractionRecordEntity,
  MotionInteractionRecordRepository,
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
import type { ComponentsService } from "../component-library/components.service.js";
import { MotionInteractionsService } from "./motion-interactions.service.js";

// withTransaction() opens a real Sequelize connection (needs DATABASE_URL) — irrelevant to this
// service's own logic, so it's stubbed to just invoke the callback, matching
// SectionPatternsService's/PageTemplatesService's own identical spec-file pattern. update()'s
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

/** A stand-in for Sequelize's real `UniqueConstraintError` — checked via the shared
 *  `isSequelizeUniqueConstraintError()` helper in `MotionInteractionsService`, not `instanceof`,
 *  since `dashboard-api` never imports `sequelize` directly. */
function uniqueConstraintError(): Error {
  const error = new Error("Validation error");
  error.name = "SequelizeUniqueConstraintError";
  return error;
}

function record(
  overrides: Partial<MotionInteractionRecordEntity> = {},
): MotionInteractionRecordEntity {
  return {
    id: "row-1",
    recordId: "record-1",
    publicId: "MIL-MODAL-OPEN",
    category: "modal_drawer",
    versionNumber: 1,
    isCurrent: true,
    name: "Modal open transition",
    description: "Fades and scales the modal into view",
    triggerAndBehavior: "Triggered on click of the modal-open control",
    timingAndEasing: "200ms ease-out",
    implementationSpec: ".modal { transition: opacity 200ms; }",
    accessibilityNotes: "Focus moves to the modal on open",
    fallbackBehavior: "Appears instantly with no transition",
    designReference: "https://www.figma.com/file/abc123",
    relatedComponentIds: [],
    approvalStatus: "draft",
    createdBy: "actor-1",
    updatedBy: "actor-1",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("MotionInteractionsService", () => {
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
    findByIds: ReturnType<typeof vi.fn>;
  };
  let authorizationService: { assertAllowed: ReturnType<typeof vi.fn> };
  let auditService: { record: ReturnType<typeof vi.fn> };
  let componentsService: { existingComponentIds: ReturnType<typeof vi.fn> };
  let svc: MotionInteractionsService;

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
      findByIds: vi.fn(),
    };
    authorizationService = { assertAllowed: vi.fn() };
    auditService = { record: vi.fn() };
    componentsService = { existingComponentIds: vi.fn().mockResolvedValue(new Set()) };
    svc = new MotionInteractionsService(
      records as unknown as MotionInteractionRecordRepository,
      authorizationService as unknown as AuthorizationService,
      auditService as unknown as AuditService,
      componentsService as unknown as ComponentsService,
    );
  });

  describe("existingRecordIds", () => {
    it("returns the recordIds that resolve to a real, current motion/interaction record", async () => {
      records.findByIds.mockResolvedValue([
        record({ recordId: "motion-1" }),
        record({ recordId: "motion-2" }),
      ]);

      const result = await svc.existingRecordIds(["motion-1", "motion-2", "missing"]);

      expect(records.findByIds).toHaveBeenCalledWith(["motion-1", "motion-2", "missing"]);
      expect(result).toEqual(new Set(["motion-1", "motion-2"]));
    });
  });

  describe("create", () => {
    it("creates a motion/interaction record after validating the publicId is free", async () => {
      records.findCurrentByPublicId.mockResolvedValue(null);
      records.create.mockResolvedValue(record());

      const result = await svc.create(
        {
          publicId: "MIL-MODAL-OPEN",
          category: "modal_drawer",
          name: "Modal open transition",
        },
        "actor-1",
      );

      expect(result).toEqual(record());
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "create", entityType: "motion_interaction_record" }),
      );
    });

    it("defaults relatedComponentIds to an empty array when omitted", async () => {
      records.findCurrentByPublicId.mockResolvedValue(null);
      records.create.mockResolvedValue(record());

      await svc.create({ publicId: "MIL-X", category: "loader", name: "Loader" }, "actor-1");

      const [writtenInput] = records.create.mock.calls[0] as [Record<string, unknown>];
      expect(writtenInput.relatedComponentIds).toEqual([]);
    });

    it("sanitizes rich-text fields (description/triggerAndBehavior/accessibilityNotes) before writing", async () => {
      records.findCurrentByPublicId.mockResolvedValue(null);
      records.create.mockResolvedValue(record());

      await svc.create(
        {
          publicId: "MIL-X",
          category: "loader",
          name: "Loader",
          description: "<p>Safe</p><script>alert(1)</script>",
          triggerAndBehavior: "<p>On page load</p>",
          accessibilityNotes: "<p>Announced via aria-busy</p>",
        },
        "actor-1",
      );

      const [writtenInput] = records.create.mock.calls[0] as [Record<string, unknown>];
      expect(writtenInput.description).not.toContain("<script>");
      expect(writtenInput.triggerAndBehavior).toContain("On page load");
      expect(writtenInput.accessibilityNotes).toContain("Announced via aria-busy");
    });

    it("never sanitizes timingAndEasing/implementationSpec/fallbackBehavior (plain code/spec fields)", async () => {
      records.findCurrentByPublicId.mockResolvedValue(null);
      records.create.mockResolvedValue(record());

      await svc.create(
        {
          publicId: "MIL-X",
          category: "loader",
          name: "Loader",
          timingAndEasing: "300ms cubic-bezier(0.4, 0, 0.2, 1)",
          implementationSpec: ".spinner { animation: spin 1s linear infinite; }",
          fallbackBehavior: "Static loading text",
        },
        "actor-1",
      );

      const [writtenInput] = records.create.mock.calls[0] as [Record<string, unknown>];
      expect(writtenInput.timingAndEasing).toBe("300ms cubic-bezier(0.4, 0, 0.2, 1)");
      expect(writtenInput.implementationSpec).toBe(
        ".spinner { animation: spin 1s linear infinite; }",
      );
      expect(writtenInput.fallbackBehavior).toBe("Static loading text");
    });

    it("validates relatedComponentIds against real Component Library records before creating", async () => {
      records.findCurrentByPublicId.mockResolvedValue(null);
      componentsService.existingComponentIds.mockResolvedValue(new Set(["component-1"]));
      records.create.mockResolvedValue(record({ relatedComponentIds: ["component-1"] }));

      await svc.create(
        {
          publicId: "MIL-X",
          category: "modal_drawer",
          name: "Modal",
          relatedComponentIds: ["component-1"],
        },
        "actor-1",
      );

      expect(componentsService.existingComponentIds).toHaveBeenCalledWith(["component-1"]);
      expect(records.create).toHaveBeenCalled();
    });

    it("rejects creation when a relatedComponentIds entry does not resolve to a real component", async () => {
      records.findCurrentByPublicId.mockResolvedValue(null);
      componentsService.existingComponentIds.mockResolvedValue(new Set());

      await expect(
        svc.create(
          {
            publicId: "MIL-X",
            category: "modal_drawer",
            name: "Modal",
            relatedComponentIds: ["missing-component"],
          },
          "actor-1",
        ),
      ).rejects.toThrow(BadRequestException);
      expect(records.create).not.toHaveBeenCalled();
    });

    it("rejects creation when publicId is already in use", async () => {
      records.findCurrentByPublicId.mockResolvedValue(record());

      await expect(
        svc.create(
          { publicId: "MIL-MODAL-OPEN", category: "modal_drawer", name: "Dup" },
          "actor-1",
        ),
      ).rejects.toThrow(BadRequestException);
      expect(records.create).not.toHaveBeenCalled();
    });

    it("translates a TOCTOU unique-constraint race on publicId into a clean 400", async () => {
      records.findCurrentByPublicId.mockResolvedValue(null);
      records.create.mockRejectedValue(uniqueConstraintError());

      await expect(
        svc.create({ publicId: "MIL-RACE", category: "loader", name: "Race" }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("findCurrent / listVersions", () => {
    it("findCurrent throws NotFoundException for an unknown recordId", async () => {
      records.findCurrentByRecordId.mockResolvedValue(null);
      await expect(svc.findCurrent("missing")).rejects.toThrow(NotFoundException);
    });

    it("listVersions throws NotFoundException when the repository returns zero rows", async () => {
      records.listVersions.mockResolvedValue([]);
      await expect(svc.listVersions("missing")).rejects.toThrow(NotFoundException);
    });

    it("listVersions returns every version, oldest first", async () => {
      const v1 = record({ id: "row-1", versionNumber: 1 });
      const v2 = record({ id: "row-2", versionNumber: 2 });
      records.listVersions.mockResolvedValue([v1, v2]);
      await expect(svc.listVersions("record-1")).resolves.toEqual([v1, v2]);
    });
  });

  describe("list", () => {
    it("delegates straight to the repository", async () => {
      records.list.mockResolvedValue([record()]);
      const result = await svc.list({ category: "loader" });
      expect(records.list).toHaveBeenCalledWith({ category: "loader" });
      expect(result).toEqual([record()]);
    });
  });

  describe("update — non-approved current version (in-place)", () => {
    it("mutates the current row in place and never touches category/publicId", async () => {
      records.findCurrentByRecordId.mockResolvedValue(record());
      records.updateInPlace.mockResolvedValue(record({ name: "Renamed" }));

      const result = await svc.update("record-1", { name: "Renamed" }, "actor-1");

      expect(result.name).toBe("Renamed");
      expect(records.updateInPlace).toHaveBeenCalledWith(
        "row-1",
        expect.objectContaining({ name: "Renamed", updatedBy: "actor-1" }),
        undefined,
        "draft",
      );
      expect(records.createNewVersion).not.toHaveBeenCalled();
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "update", entityType: "motion_interaction_record" }),
      );
    });

    it("validates relatedComponentIds before applying an in-place edit", async () => {
      records.findCurrentByRecordId.mockResolvedValue(record());
      componentsService.existingComponentIds.mockResolvedValue(new Set());

      await expect(
        svc.update("record-1", { relatedComponentIds: ["missing"] }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
      expect(records.updateInPlace).not.toHaveBeenCalled();
    });

    it("throws ConflictException when the CAS guard reports 0 affected rows but the record still exists", async () => {
      records.findCurrentByRecordId
        .mockResolvedValueOnce(record())
        .mockResolvedValueOnce(record({ approvalStatus: "approved" }));
      records.updateInPlace.mockResolvedValue(null);

      await expect(svc.update("record-1", { name: "Renamed" }, "actor-1")).rejects.toThrow(
        ConflictException,
      );
    });

    it("throws NotFoundException when the CAS guard reports 0 affected rows and the record is genuinely gone", async () => {
      records.findCurrentByRecordId.mockResolvedValueOnce(record()).mockResolvedValueOnce(null);
      records.updateInPlace.mockResolvedValue(null);

      await expect(svc.update("record-1", { name: "Renamed" }, "actor-1")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("rejects editing an archived record with BadRequestException, without calling updateInPlace", async () => {
      records.findCurrentByRecordId.mockResolvedValue(record({ approvalStatus: "archived" }));

      await expect(svc.update("record-1", { name: "Renamed" }, "actor-1")).rejects.toThrow(
        BadRequestException,
      );
      expect(records.updateInPlace).not.toHaveBeenCalled();
    });

    it("rejects editing a superseded record with BadRequestException", async () => {
      records.findCurrentByRecordId.mockResolvedValue(record({ approvalStatus: "superseded" }));

      await expect(svc.update("record-1", { name: "Renamed" }, "actor-1")).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("update — approved current version (forks a new version)", () => {
    it("flips the old row's isCurrent to false and creates a new draft version", async () => {
      const approved = record({ approvalStatus: "approved" });
      records.findCurrentByRecordId.mockResolvedValue(approved);
      records.updateInPlace.mockResolvedValue(record({ isCurrent: false }));
      const newVersion = record({
        id: "row-2",
        versionNumber: 2,
        name: "Modal open transition (revised)",
        approvalStatus: "draft",
      });
      records.createNewVersion.mockResolvedValue(newVersion);

      const result = await svc.update(
        "record-1",
        { name: "Modal open transition (revised)" },
        "actor-1",
      );

      expect(result).toEqual(newVersion);
      expect(records.updateInPlace).toHaveBeenCalledWith(
        "row-1",
        { isCurrent: false, updatedBy: "actor-1" },
        { fakeTransaction: true },
        "approved",
      );
      expect(records.createNewVersion).toHaveBeenCalledWith(
        expect.objectContaining({
          recordId: "record-1",
          publicId: "MIL-MODAL-OPEN",
          category: "modal_drawer",
          versionNumber: 2,
          name: "Modal open transition (revised)",
        }),
        { fakeTransaction: true },
      );
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "new_version" }),
      );
    });

    it("inherits omitted fields from the current version when forking", async () => {
      const approved = record({ approvalStatus: "approved", timingAndEasing: "150ms ease" });
      records.findCurrentByRecordId.mockResolvedValue(approved);
      records.updateInPlace.mockResolvedValue(record({ isCurrent: false }));
      records.createNewVersion.mockResolvedValue(record({ id: "row-2", versionNumber: 2 }));

      await svc.update("record-1", { name: "New name only" }, "actor-1");

      const [writtenInput] = records.createNewVersion.mock.calls[0] as [Record<string, unknown>];
      expect(writtenInput.timingAndEasing).toBe("150ms ease");
    });

    it("throws ConflictException when flipping the old row fails (concurrent approval->archived race)", async () => {
      const approved = record({ approvalStatus: "approved" });
      records.findCurrentByRecordId.mockResolvedValue(approved);
      records.updateInPlace.mockResolvedValue(null);

      await expect(svc.update("record-1", { name: "Renamed" }, "actor-1")).rejects.toThrow(
        ConflictException,
      );
      expect(records.createNewVersion).not.toHaveBeenCalled();
    });

    it("translates a concurrent version-creation collision (record_id, version_number) into a clean 409", async () => {
      const approved = record({ approvalStatus: "approved" });
      records.findCurrentByRecordId.mockResolvedValue(approved);
      records.updateInPlace.mockResolvedValue(record({ isCurrent: false }));
      records.createNewVersion.mockRejectedValue(uniqueConstraintError());

      await expect(svc.update("record-1", { name: "Renamed" }, "actor-1")).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe("changeApprovalStatus", () => {
    it("no-ops (returns current, does not write) when nextStatus equals the current status", async () => {
      const current = record({ approvalStatus: "draft" });
      records.findCurrentByRecordId.mockResolvedValue(current);

      const result = await svc.changeApprovalStatus("record-1", "draft", "actor-1");

      expect(result).toEqual(current);
      expect(records.updateApprovalStatus).not.toHaveBeenCalled();
    });

    it("rejects an invalid transition with BadRequestException", async () => {
      records.findCurrentByRecordId.mockResolvedValue(record({ approvalStatus: "draft" }));

      await expect(svc.changeApprovalStatus("record-1", "approved", "actor-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("rejects a direct approved -> superseded transition (supersede is automatic-only)", async () => {
      records.findCurrentByRecordId.mockResolvedValue(record({ approvalStatus: "approved" }));

      await expect(svc.changeApprovalStatus("record-1", "superseded", "actor-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it.each([
      ["draft", "submitted", "submit"],
      ["submitted", "under_review", "review"],
      ["under_review", "approved", "approve"],
      ["under_review", "revision_requested", "review"],
      ["under_review", "rejected", "approve"],
      ["revision_requested", "draft", "submit"],
      ["rejected", "draft", "submit"],
      ["draft", "archived", "approve"],
      ["approved", "archived", "approve"],
    ] as const)(
      "requires the %s -> %s transition to check the %s action against RBAC",
      async (from, to, action) => {
        records.findCurrentByRecordId.mockResolvedValue(record({ approvalStatus: from }));
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
      },
    );

    it("propagates a ForbiddenException from the RBAC check without writing", async () => {
      records.findCurrentByRecordId.mockResolvedValue(record({ approvalStatus: "draft" }));
      authorizationService.assertAllowed.mockRejectedValue(new ForbiddenException());

      await expect(svc.changeApprovalStatus("record-1", "submitted", "actor-1")).rejects.toThrow(
        ForbiddenException,
      );
      expect(records.updateApprovalStatus).not.toHaveBeenCalled();
    });

    it("on a successful '-> approved' transition, supersedes the other approved version inside the same transaction", async () => {
      records.findCurrentByRecordId.mockResolvedValue(record({ approvalStatus: "under_review" }));
      records.updateApprovalStatus.mockResolvedValue({
        outcome: "updated",
        entity: record({ approvalStatus: "approved" }),
      });

      await svc.changeApprovalStatus("record-1", "approved", "actor-1");

      expect(records.updateApprovalStatus).toHaveBeenCalledWith(
        "row-1",
        "under_review",
        "approved",
        "actor-1",
        { fakeTransaction: true },
      );
      expect(records.supersedeOtherApprovedVersion).toHaveBeenCalledWith(
        "record-1",
        "row-1",
        "actor-1",
        { fakeTransaction: true },
      );
    });

    it("does not call supersedeOtherApprovedVersion for a non-approval transition", async () => {
      records.findCurrentByRecordId.mockResolvedValue(record({ approvalStatus: "draft" }));
      records.updateApprovalStatus.mockResolvedValue({
        outcome: "updated",
        entity: record({ approvalStatus: "submitted" }),
      });

      await svc.changeApprovalStatus("record-1", "submitted", "actor-1");

      expect(records.supersedeOtherApprovedVersion).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when the CAS write reports not_found", async () => {
      records.findCurrentByRecordId.mockResolvedValue(record({ approvalStatus: "draft" }));
      records.updateApprovalStatus.mockResolvedValue({ outcome: "not_found" });

      await expect(svc.changeApprovalStatus("record-1", "submitted", "actor-1")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws ConflictException when the CAS write reports a conflict", async () => {
      records.findCurrentByRecordId.mockResolvedValue(record({ approvalStatus: "draft" }));
      records.updateApprovalStatus.mockResolvedValue({
        outcome: "conflict",
        entity: record({ approvalStatus: "approved" }),
      });

      await expect(svc.changeApprovalStatus("record-1", "submitted", "actor-1")).rejects.toThrow(
        ConflictException,
      );
    });

    it("swallows (only console.error's) an audit-write failure without failing the request", async () => {
      records.findCurrentByRecordId.mockResolvedValue(record({ approvalStatus: "draft" }));
      records.updateApprovalStatus.mockResolvedValue({
        outcome: "updated",
        entity: record({ approvalStatus: "submitted" }),
      });
      auditService.record.mockRejectedValue(new Error("audit sink unavailable"));
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

      const result = await svc.changeApprovalStatus("record-1", "submitted", "actor-1");

      expect(result.approvalStatus).toBe("submitted");
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });
});
