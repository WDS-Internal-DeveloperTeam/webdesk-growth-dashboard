import type { WorkflowTaskTemplateEntity, WorkflowTaskTemplateRepository } from "@webdesk/database";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditService } from "../audit/audit.service.js";
import type { AuthorizationService } from "../authz/authorization.service.js";
import { WorkflowAndTaskTemplateLibraryService } from "./workflow-and-task-template-library.service.js";

const NOW = new Date("2026-09-01T00:00:00.000Z");

/** A stand-in for Sequelize's real `UniqueConstraintError` — checked by `.name` in
 *  `WorkflowAndTaskTemplateLibraryService.create()` rather than `instanceof`, since
 *  `dashboard-api` never imports `sequelize` directly (only `packages/database` may). */
function uniqueConstraintError(): Error {
  const error = new Error("Validation error");
  error.name = "SequelizeUniqueConstraintError";
  return error;
}

function template(overrides: Partial<WorkflowTaskTemplateEntity> = {}): WorkflowTaskTemplateEntity {
  return {
    id: "template-1",
    publicId: "WTT-CONTENT-001",
    templateType: "content",
    title: "Blog Post Template",
    authorizedStage: "content_production",
    requiredInputs: null,
    expectedOutputs: null,
    restrictions: null,
    agentAssignment: null,
    validationCriteria: null,
    requiredApprovals: null,
    approvalStatus: "draft",
    version: 1,
    createdBy: "actor-1",
    updatedBy: "actor-1",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("WorkflowAndTaskTemplateLibraryService", () => {
  let templates: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findByPublicId: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateApprovalStatus: ReturnType<typeof vi.fn>;
  };
  let authorizationService: { assertAllowed: ReturnType<typeof vi.fn> };
  let auditService: { record: ReturnType<typeof vi.fn> };
  let svc: WorkflowAndTaskTemplateLibraryService;

  beforeEach(() => {
    templates = {
      create: vi.fn(),
      findById: vi.fn(),
      findByPublicId: vi.fn(),
      list: vi.fn(),
      update: vi.fn(),
      updateApprovalStatus: vi.fn(),
    };
    authorizationService = { assertAllowed: vi.fn() };
    auditService = { record: vi.fn() };
    svc = new WorkflowAndTaskTemplateLibraryService(
      templates as unknown as WorkflowTaskTemplateRepository,
      authorizationService as unknown as AuthorizationService,
      auditService as unknown as AuditService,
    );
  });

  describe("create", () => {
    it("creates a workflow task template after validating the publicId is free", async () => {
      templates.findByPublicId.mockResolvedValue(null);
      templates.create.mockResolvedValue(template());

      const result = await svc.create(
        {
          publicId: "WTT-CONTENT-001",
          templateType: "content",
          title: "Blog Post Template",
          authorizedStage: "content_production",
        },
        "actor-1",
      );

      expect(result).toEqual(template());
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "create", entityType: "workflow_task_template" }),
      );
    });

    it("rejects a duplicate publicId", async () => {
      templates.findByPublicId.mockResolvedValue(template());

      await expect(
        svc.create(
          {
            publicId: "WTT-CONTENT-001",
            templateType: "content",
            title: "X",
            authorizedStage: "content_production",
          },
          "actor-1",
        ),
      ).rejects.toThrow(BadRequestException);
      expect(templates.create).not.toHaveBeenCalled();
    });

    it("translates a concurrent publicId collision into a clean 400, not a raw 500", async () => {
      templates.findByPublicId.mockResolvedValue(null);
      templates.create.mockRejectedValue(uniqueConstraintError());

      await expect(
        svc.create(
          {
            publicId: "WTT-RACE",
            templateType: "content",
            title: "X",
            authorizedStage: "content_production",
          },
          "actor-1",
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("re-throws a non-uniqueness error from create() unchanged", async () => {
      templates.findByPublicId.mockResolvedValue(null);
      const dbError = new Error("connection reset");
      templates.create.mockRejectedValue(dbError);

      await expect(
        svc.create(
          {
            publicId: "WTT-X",
            templateType: "content",
            title: "X",
            authorizedStage: "content_production",
          },
          "actor-1",
        ),
      ).rejects.toBe(dbError);
    });
  });

  describe("findById", () => {
    it("throws NotFoundException when the record does not exist", async () => {
      templates.findById.mockResolvedValue(null);
      await expect(svc.findById("missing")).rejects.toThrow(NotFoundException);
    });

    it("returns the record when it exists", async () => {
      templates.findById.mockResolvedValue(template());
      await expect(svc.findById("template-1")).resolves.toEqual(template());
    });
  });

  describe("list", () => {
    it("delegates the filter straight through to the repository", async () => {
      templates.list.mockResolvedValue([template()]);
      const result = await svc.list({ approvalStatus: "draft" });
      expect(templates.list).toHaveBeenCalledWith({ approvalStatus: "draft" });
      expect(result).toEqual([template()]);
    });
  });

  describe("update", () => {
    it("throws NotFoundException when the record doesn't exist", async () => {
      templates.findById.mockResolvedValue(null);

      await expect(svc.update("missing", { title: "New" }, "actor-1")).rejects.toThrow(
        NotFoundException,
      );
      expect(templates.update).not.toHaveBeenCalled();
    });

    it.each(["archived", "superseded"] as const)(
      "rejects with a clean 400 when the record is %s (terminal, no code path resurrects it)",
      async (approvalStatus) => {
        templates.findById.mockResolvedValue(template({ approvalStatus }));

        await expect(svc.update("template-1", { title: "New" }, "actor-1")).rejects.toThrow(
          BadRequestException,
        );
        expect(templates.update).not.toHaveBeenCalled();
      },
    );

    it("throws ConflictException when the CAS write finds 0 affected rows but the row still exists", async () => {
      templates.findById
        .mockResolvedValueOnce(template({ approvalStatus: "draft" }))
        .mockResolvedValueOnce(template({ approvalStatus: "submitted" }));
      templates.update.mockResolvedValue(null);

      await expect(svc.update("template-1", { title: "New" }, "actor-1")).rejects.toThrow(
        ConflictException,
      );
    });

    it("passes the current approvalStatus as a CAS guard to the repository", async () => {
      templates.findById.mockResolvedValue(template({ approvalStatus: "draft" }));
      templates.update.mockResolvedValue(template({ title: "Renamed", version: 2 }));

      await svc.update("template-1", { title: "Renamed" }, "actor-1");

      expect(templates.update).toHaveBeenCalledWith(
        "template-1",
        expect.objectContaining({ title: "Renamed", updatedBy: "actor-1" }),
        "draft",
      );
    });

    it("never accepts approvalStatus/version/templateType through the general update patch", async () => {
      templates.findById.mockResolvedValue(template({ approvalStatus: "draft" }));
      templates.update.mockResolvedValue(template({ title: "Renamed", version: 2 }));

      await svc.update("template-1", { title: "Renamed" }, "actor-1");

      const [, patchArg] = templates.update.mock.calls[0] as [string, Record<string, unknown>];
      expect(patchArg).not.toHaveProperty("approvalStatus");
      expect(patchArg).not.toHaveProperty("version");
      expect(patchArg).not.toHaveProperty("templateType");
    });

    it("returns the repository's updated entity, with version incremented server-side", async () => {
      templates.findById.mockResolvedValue(template({ approvalStatus: "draft" }));
      templates.update.mockResolvedValue(template({ title: "Renamed", version: 4 }));

      const result = await svc.update("template-1", { title: "Renamed" }, "actor-1");

      expect(result.version).toBe(4);
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "update", entityType: "workflow_task_template" }),
      );
    });
  });

  describe("changeApprovalStatus", () => {
    it("is a no-op returning the current entity when the requested status matches the current one", async () => {
      templates.findById.mockResolvedValue(template({ approvalStatus: "draft" }));
      const result = await svc.changeApprovalStatus("template-1", "draft", "actor-1");
      expect(result.approvalStatus).toBe("draft");
      expect(authorizationService.assertAllowed).not.toHaveBeenCalled();
    });

    it("does not increment version on a status transition", async () => {
      templates.findById.mockResolvedValue(template({ approvalStatus: "draft", version: 5 }));
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      templates.updateApprovalStatus.mockResolvedValue({
        outcome: "updated",
        entity: template({ approvalStatus: "submitted", version: 5 }),
      });

      const result = await svc.changeApprovalStatus("template-1", "submitted", "actor-1");
      expect(result.version).toBe(5);
    });

    it("rejects a transition not in the allowlist", async () => {
      templates.findById.mockResolvedValue(template({ approvalStatus: "draft" }));
      await expect(svc.changeApprovalStatus("template-1", "approved", "actor-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it.each([
      ["draft", "submitted", "submit"],
      ["submitted", "under_review", "review"],
      ["under_review", "approved", "approve"],
      ["under_review", "revision_requested", "review"],
      ["under_review", "rejected", "approve"],
      ["approved", "superseded", "approve"],
      ["draft", "archived", "approve"],
    ] as const)("requires the '%s -> %s' transition's '%s' action", async (from, to, action) => {
      templates.findById.mockResolvedValue(template({ approvalStatus: from }));
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      templates.updateApprovalStatus.mockResolvedValue({
        outcome: "updated",
        entity: template({ approvalStatus: to }),
      });

      await svc.changeApprovalStatus("template-1", to, "actor-1");

      expect(authorizationService.assertAllowed).toHaveBeenCalledWith(
        "actor-1",
        "ready_for_claude",
        action,
      );
    });

    it("rejects every transition out of the terminal 'archived'/'superseded' states", async () => {
      templates.findById.mockResolvedValueOnce(template({ approvalStatus: "archived" }));
      await expect(svc.changeApprovalStatus("template-1", "draft", "actor-1")).rejects.toThrow(
        BadRequestException,
      );

      templates.findById.mockResolvedValueOnce(template({ approvalStatus: "superseded" }));
      await expect(svc.changeApprovalStatus("template-1", "draft", "actor-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("propagates a denial from assertAllowed and never attempts the status write", async () => {
      templates.findById.mockResolvedValue(template({ approvalStatus: "under_review" }));
      authorizationService.assertAllowed.mockRejectedValue(
        new ForbiddenException("Missing permission: ready_for_claude:approve"),
      );

      await expect(svc.changeApprovalStatus("template-1", "approved", "actor-1")).rejects.toThrow(
        ForbiddenException,
      );
      expect(templates.updateApprovalStatus).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when the atomic status write reports not_found", async () => {
      templates.findById.mockResolvedValue(template({ approvalStatus: "draft" }));
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      templates.updateApprovalStatus.mockResolvedValue({ outcome: "not_found" });

      await expect(svc.changeApprovalStatus("template-1", "submitted", "actor-1")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws ConflictException when the atomic status write loses a race", async () => {
      templates.findById.mockResolvedValue(template({ approvalStatus: "draft" }));
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      templates.updateApprovalStatus.mockResolvedValue({
        outcome: "conflict",
        entity: template({ approvalStatus: "archived" }),
      });

      await expect(svc.changeApprovalStatus("template-1", "submitted", "actor-1")).rejects.toThrow(
        ConflictException,
      );
    });

    it("logs (not throws) when the audit call fails after a successful status write", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      templates.findById.mockResolvedValue(template({ approvalStatus: "draft" }));
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      templates.updateApprovalStatus.mockResolvedValue({
        outcome: "updated",
        entity: template({ approvalStatus: "submitted" }),
      });
      auditService.record.mockRejectedValue(new Error("audit down"));

      const result = await svc.changeApprovalStatus("template-1", "submitted", "actor-1");

      expect(result.approvalStatus).toBe("submitted");
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });
});
