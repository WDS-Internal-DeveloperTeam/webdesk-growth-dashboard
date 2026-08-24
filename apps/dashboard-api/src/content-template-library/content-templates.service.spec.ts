import type { ContentTemplateEntity, ContentTemplateRepository } from "@webdesk/database";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditService } from "../audit/audit.service.js";
import type { AuthorizationService } from "../authz/authorization.service.js";
import { ContentTemplatesService } from "./content-templates.service.js";

const NOW = new Date("2026-08-24T00:00:00.000Z");

/** A stand-in for Sequelize's real `UniqueConstraintError` — checked by `.name` in
 *  `ContentTemplatesService.create()` rather than `instanceof`, since `dashboard-api` never
 *  imports `sequelize` directly (only `packages/database` may). */
function uniqueConstraintError(): Error {
  const error = new Error("Validation error");
  error.name = "SequelizeUniqueConstraintError";
  return error;
}

function template(overrides: Partial<ContentTemplateEntity> = {}): ContentTemplateEntity {
  return {
    id: "template-1",
    publicId: "TEMPLATE-SERVICE-PAGE",
    pageType: "Service Page",
    purpose: null,
    requiredSections: null,
    optionalSections: null,
    proofRules: null,
    seoAeoGeoRequirements: null,
    schema: null,
    ctaRules: null,
    contentDepthGuidance: null,
    approvalStatus: "draft",
    version: 1,
    isPublished: false,
    publishedAt: null,
    createdBy: "actor-1",
    updatedBy: "actor-1",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("ContentTemplatesService", () => {
  let templates: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findByPublicId: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateApprovalStatus: ReturnType<typeof vi.fn>;
    updatePublishState: ReturnType<typeof vi.fn>;
  };
  let authorizationService: { assertAllowed: ReturnType<typeof vi.fn> };
  let auditService: { record: ReturnType<typeof vi.fn> };
  let svc: ContentTemplatesService;

  beforeEach(() => {
    templates = {
      create: vi.fn(),
      findById: vi.fn(),
      findByPublicId: vi.fn(),
      list: vi.fn(),
      update: vi.fn(),
      updateApprovalStatus: vi.fn(),
      updatePublishState: vi.fn(),
    };
    authorizationService = { assertAllowed: vi.fn() };
    auditService = { record: vi.fn() };
    svc = new ContentTemplatesService(
      templates as unknown as ContentTemplateRepository,
      authorizationService as unknown as AuthorizationService,
      auditService as unknown as AuditService,
    );
  });

  describe("create", () => {
    it("creates a content template after validating the publicId is free", async () => {
      templates.findByPublicId.mockResolvedValue(null);
      templates.create.mockResolvedValue(template());

      const result = await svc.create(
        { publicId: "TEMPLATE-SERVICE-PAGE", pageType: "Service Page" },
        "actor-1",
      );

      expect(result).toEqual(template());
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "create", entityType: "content_template" }),
      );
    });

    it("rejects a duplicate publicId", async () => {
      templates.findByPublicId.mockResolvedValue(template());

      await expect(
        svc.create({ publicId: "TEMPLATE-SERVICE-PAGE", pageType: "X" }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
      expect(templates.create).not.toHaveBeenCalled();
    });

    it("translates a concurrent publicId collision into a clean 400, not a raw 500", async () => {
      templates.findByPublicId.mockResolvedValue(null);
      templates.create.mockRejectedValue(uniqueConstraintError());

      await expect(
        svc.create({ publicId: "TEMPLATE-RACE", pageType: "X" }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("re-throws a non-uniqueness error from create() unchanged", async () => {
      templates.findByPublicId.mockResolvedValue(null);
      const dbError = new Error("connection reset");
      templates.create.mockRejectedValue(dbError);

      await expect(svc.create({ publicId: "TEMPLATE-X", pageType: "X" }, "actor-1")).rejects.toBe(
        dbError,
      );
    });
  });

  describe("findById", () => {
    it("throws NotFoundException when the template does not exist", async () => {
      templates.findById.mockResolvedValue(null);
      await expect(svc.findById("missing")).rejects.toThrow(NotFoundException);
    });

    it("returns the template when it exists", async () => {
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
    it("throws NotFoundException when the repository update finds nothing to update", async () => {
      templates.update.mockResolvedValue(null);

      await expect(svc.update("missing", { pageType: "New" }, "actor-1")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("never accepts approvalStatus/version/isPublished/publishedAt through the general update patch", async () => {
      templates.update.mockResolvedValue(template({ pageType: "Renamed", version: 2 }));

      // TypeScript's own UpdateContentTemplateDto type already excludes these fields; this proves
      // the service layer doesn't forward whatever extra keys a patch object might carry.
      await svc.update("template-1", { pageType: "Renamed" }, "actor-1");

      const [, patchArg] = templates.update.mock.calls[0] as [string, Record<string, unknown>];
      expect(patchArg).not.toHaveProperty("approvalStatus");
      expect(patchArg).not.toHaveProperty("version");
      expect(patchArg).not.toHaveProperty("isPublished");
      expect(patchArg).not.toHaveProperty("publishedAt");
    });

    it("returns the repository's updated entity, with version incremented server-side", async () => {
      templates.update.mockResolvedValue(template({ pageType: "Renamed", version: 4 }));

      const result = await svc.update("template-1", { pageType: "Renamed" }, "actor-1");

      expect(result.version).toBe(4);
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "update", entityType: "content_template" }),
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
        "page_content",
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
        new ForbiddenException("Missing permission: page_content:approve"),
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

  describe("publish", () => {
    it("rejects with a clean 400 when the template is not approved, before checking authorization", async () => {
      templates.findById.mockResolvedValue(template({ approvalStatus: "draft" }));

      await expect(svc.publish("template-1", "actor-1")).rejects.toThrow(BadRequestException);
      expect(authorizationService.assertAllowed).not.toHaveBeenCalled();
      expect(templates.updatePublishState).not.toHaveBeenCalled();
    });

    it("publishes an approved template, checking the 'publish' action", async () => {
      templates.findById.mockResolvedValue(
        template({ approvalStatus: "approved", isPublished: false }),
      );
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      templates.updatePublishState.mockResolvedValue({
        outcome: "updated",
        entity: template({
          approvalStatus: "approved",
          isPublished: true,
          publishedAt: NOW.toISOString(),
        }),
      });

      const result = await svc.publish("template-1", "actor-1");

      expect(authorizationService.assertAllowed).toHaveBeenCalledWith(
        "actor-1",
        "page_content",
        "publish",
      );
      expect(templates.updatePublishState).toHaveBeenCalledWith(
        "template-1",
        false,
        true,
        "actor-1",
      );
      expect(result.isPublished).toBe(true);
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "publish", action: "publish" }),
      );
    });

    it("propagates a denial from assertAllowed and never attempts the CAS write", async () => {
      templates.findById.mockResolvedValue(template({ approvalStatus: "approved" }));
      authorizationService.assertAllowed.mockRejectedValue(
        new ForbiddenException("Missing permission: page_content:publish"),
      );

      await expect(svc.publish("template-1", "actor-1")).rejects.toThrow(ForbiddenException);
      expect(templates.updatePublishState).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when the atomic publish write reports not_found", async () => {
      templates.findById.mockResolvedValue(template({ approvalStatus: "approved" }));
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      templates.updatePublishState.mockResolvedValue({ outcome: "not_found" });

      await expect(svc.publish("template-1", "actor-1")).rejects.toThrow(NotFoundException);
    });

    it("throws ConflictException on a double-publish race (already published)", async () => {
      templates.findById.mockResolvedValue(
        template({ approvalStatus: "approved", isPublished: true }),
      );
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      templates.updatePublishState.mockResolvedValue({
        outcome: "conflict",
        entity: template({ approvalStatus: "approved", isPublished: true }),
      });

      await expect(svc.publish("template-1", "actor-1")).rejects.toThrow(ConflictException);
    });

    it("logs (not throws) when the audit call fails after a successful publish", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      templates.findById.mockResolvedValue(template({ approvalStatus: "approved" }));
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      templates.updatePublishState.mockResolvedValue({
        outcome: "updated",
        entity: template({ approvalStatus: "approved", isPublished: true }),
      });
      auditService.record.mockRejectedValue(new Error("audit down"));

      const result = await svc.publish("template-1", "actor-1");

      expect(result.isPublished).toBe(true);
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe("unpublish", () => {
    it("is allowed regardless of approvalStatus (no pre-fetch/content gate)", async () => {
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      templates.updatePublishState.mockResolvedValue({
        outcome: "updated",
        entity: template({ approvalStatus: "archived", isPublished: false }),
      });

      const result = await svc.unpublish("template-1", "actor-1");

      expect(templates.findById).not.toHaveBeenCalled();
      expect(authorizationService.assertAllowed).toHaveBeenCalledWith(
        "actor-1",
        "page_content",
        "unpublish",
      );
      expect(templates.updatePublishState).toHaveBeenCalledWith(
        "template-1",
        true,
        false,
        "actor-1",
      );
      expect(result.isPublished).toBe(false);
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "unpublish", action: "unpublish" }),
      );
    });

    it("propagates a denial from assertAllowed and never attempts the CAS write", async () => {
      authorizationService.assertAllowed.mockRejectedValue(
        new ForbiddenException("Missing permission: page_content:unpublish"),
      );

      await expect(svc.unpublish("template-1", "actor-1")).rejects.toThrow(ForbiddenException);
      expect(templates.updatePublishState).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when the atomic unpublish write reports not_found", async () => {
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      templates.updatePublishState.mockResolvedValue({ outcome: "not_found" });

      await expect(svc.unpublish("template-1", "actor-1")).rejects.toThrow(NotFoundException);
    });

    it("throws ConflictException on a double-unpublish race (already unpublished)", async () => {
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      templates.updatePublishState.mockResolvedValue({
        outcome: "conflict",
        entity: template({ isPublished: false }),
      });

      await expect(svc.unpublish("template-1", "actor-1")).rejects.toThrow(ConflictException);
    });

    it("never touches publishedAt (server-stamped by the repository, not the service)", async () => {
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      templates.updatePublishState.mockResolvedValue({
        outcome: "updated",
        entity: template({ isPublished: false, publishedAt: "2026-08-01T00:00:00.000Z" }),
      });

      const result = await svc.unpublish("template-1", "actor-1");
      expect(result.publishedAt).toBe("2026-08-01T00:00:00.000Z");
    });

    it("logs (not throws) when the audit call fails after a successful unpublish", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      templates.updatePublishState.mockResolvedValue({
        outcome: "updated",
        entity: template({ isPublished: false }),
      });
      auditService.record.mockRejectedValue(new Error("audit down"));

      const result = await svc.unpublish("template-1", "actor-1");

      expect(result.isPublished).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });
});
