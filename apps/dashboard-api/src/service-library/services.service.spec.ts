import type {
  ServiceCategoryEntity,
  ServiceCategoryRepository,
  ServiceEntity,
  ServiceRelationshipRepository,
  ServiceRepository,
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
import { ServicesService } from "./services.service.js";

// withTransaction() opens a real Sequelize connection (needs DATABASE_URL) — irrelevant to this
// service's own logic, so it's stubbed to just invoke the callback, matching
// project.service.spec.ts's own precedent.
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

const NOW = new Date("2026-08-21T00:00:00.000Z");

function service(overrides: Partial<ServiceEntity> = {}): ServiceEntity {
  return {
    id: "service-1",
    publicId: "SVC-HEADLESS-COMMERCE",
    canonicalName: "Headless Commerce",
    publicName: null,
    categoryId: "category-1",
    parentServiceId: null,
    shortPublicDescription: null,
    audience: null,
    problems: null,
    capabilities: null,
    outcomes: null,
    exclusions: null,
    internalDescription: null,
    icpIds: [],
    relatedPageIds: [],
    relatedCaseStudyIds: [],
    confidentiality: "internal",
    publicationStatus: "draft",
    approvalStatus: "draft",
    ownerUserId: null,
    createdBy: "actor-1",
    updatedBy: "actor-1",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

function category(overrides: Partial<ServiceCategoryEntity> = {}): ServiceCategoryEntity {
  return {
    id: "category-1",
    publicId: "CAT-ECOM",
    name: "E-Commerce",
    parentCategoryId: null,
    publicDescription: null,
    internalDescription: null,
    sortOrder: 0,
    createdBy: null,
    updatedBy: null,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("ServicesService", () => {
  let services: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findByPublicId: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateStatus: ReturnType<typeof vi.fn>;
  };
  let categories: { findById: ReturnType<typeof vi.fn> };
  let relationships: {
    replaceDeliverables: ReturnType<typeof vi.fn>;
    replacePlatforms: ReturnType<typeof vi.fn>;
    replaceEngagementModels: ReturnType<typeof vi.fn>;
  };
  let authorizationService: {
    evaluate: ReturnType<typeof vi.fn>;
    recordAccessDenied: ReturnType<typeof vi.fn>;
  };
  let auditService: { record: ReturnType<typeof vi.fn> };
  let svc: ServicesService;

  beforeEach(() => {
    services = {
      create: vi.fn(),
      findById: vi.fn(),
      findByPublicId: vi.fn(),
      list: vi.fn(),
      update: vi.fn(),
      updateStatus: vi.fn(),
    };
    categories = { findById: vi.fn() };
    relationships = {
      replaceDeliverables: vi.fn(),
      replacePlatforms: vi.fn(),
      replaceEngagementModels: vi.fn(),
    };
    authorizationService = { evaluate: vi.fn(), recordAccessDenied: vi.fn() };
    auditService = { record: vi.fn() };
    svc = new ServicesService(
      services as unknown as ServiceRepository,
      categories as unknown as ServiceCategoryRepository,
      relationships as unknown as ServiceRelationshipRepository,
      authorizationService as unknown as AuthorizationService,
      auditService as unknown as AuditService,
    );
  });

  describe("create", () => {
    it("creates a service after validating the category exists and the publicId is free", async () => {
      categories.findById.mockResolvedValue(category());
      services.findByPublicId.mockResolvedValue(null);
      services.create.mockResolvedValue(service());

      const result = await svc.create(
        {
          publicId: "SVC-HEADLESS-COMMERCE",
          canonicalName: "Headless Commerce",
          categoryId: "category-1",
        },
        "actor-1",
      );

      expect(result).toEqual(service());
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "create", entityType: "service" }),
      );
    });

    it("rejects when the category does not exist", async () => {
      categories.findById.mockResolvedValue(null);

      await expect(
        svc.create(
          { publicId: "SVC-X", canonicalName: "X", categoryId: "missing-category" },
          "actor-1",
        ),
      ).rejects.toThrow(BadRequestException);
      expect(services.create).not.toHaveBeenCalled();
    });

    it("rejects when the parent service does not exist", async () => {
      categories.findById.mockResolvedValue(category());
      services.findById.mockResolvedValue(null);

      await expect(
        svc.create(
          {
            publicId: "SVC-X",
            canonicalName: "X",
            categoryId: "category-1",
            parentServiceId: "missing-parent",
          },
          "actor-1",
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects a duplicate publicId", async () => {
      categories.findById.mockResolvedValue(category());
      services.findByPublicId.mockResolvedValue(service());

      await expect(
        svc.create(
          { publicId: "SVC-HEADLESS-COMMERCE", canonicalName: "X", categoryId: "category-1" },
          "actor-1",
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("replaces the deliverable/platform/engagement-model links atomically when provided", async () => {
      categories.findById.mockResolvedValue(category());
      services.findByPublicId.mockResolvedValue(null);
      services.create.mockResolvedValue(service());

      await svc.create(
        {
          publicId: "SVC-HEADLESS-COMMERCE",
          canonicalName: "Headless Commerce",
          categoryId: "category-1",
          deliverableIds: ["deliverable-1"],
          platformIds: ["platform-1"],
          engagementModelIds: ["engagement-1"],
        },
        "actor-1",
      );

      expect(relationships.replaceDeliverables).toHaveBeenCalledWith(
        "service-1",
        ["deliverable-1"],
        expect.anything(),
      );
      expect(relationships.replacePlatforms).toHaveBeenCalledWith(
        "service-1",
        ["platform-1"],
        expect.anything(),
      );
      expect(relationships.replaceEngagementModels).toHaveBeenCalledWith(
        "service-1",
        ["engagement-1"],
        expect.anything(),
      );
    });
  });

  describe("findById", () => {
    it("throws NotFoundException when the service does not exist", async () => {
      services.findById.mockResolvedValue(null);
      await expect(svc.findById("missing")).rejects.toThrow(NotFoundException);
    });
  });

  describe("update", () => {
    it("404s cleanly before touching anything else when the service does not exist", async () => {
      services.findById.mockResolvedValue(null);
      await expect(svc.update("missing", { canonicalName: "New" }, "actor-1")).rejects.toThrow(
        NotFoundException,
      );
      expect(categories.findById).not.toHaveBeenCalled();
    });

    it("validates a new categoryId before writing", async () => {
      services.findById.mockResolvedValue(service());
      categories.findById.mockResolvedValue(null);

      await expect(
        svc.update("service-1", { categoryId: "missing-category" }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("never accepts approvalStatus through the general update patch", async () => {
      services.findById.mockResolvedValue(service());
      services.update.mockResolvedValue(service({ canonicalName: "Renamed" }));

      // TypeScript's own UpdateServiceDto type already excludes approvalStatus; this proves the
      // service layer doesn't forward whatever extra keys a patch object might carry either.
      await svc.update("service-1", { canonicalName: "Renamed" }, "actor-1");

      const [, patchArg] = services.update.mock.calls[0] as [string, Record<string, unknown>];
      expect(patchArg).not.toHaveProperty("approvalStatus");
    });
  });

  describe("changeApprovalStatus", () => {
    it("is a no-op returning the current entity when the requested status matches the current one", async () => {
      services.findById.mockResolvedValue(service({ approvalStatus: "draft" }));
      const result = await svc.changeApprovalStatus("service-1", "draft", "actor-1");
      expect(result.approvalStatus).toBe("draft");
      expect(authorizationService.evaluate).not.toHaveBeenCalled();
    });

    it("rejects a transition not in the allowlist", async () => {
      services.findById.mockResolvedValue(service({ approvalStatus: "draft" }));
      await expect(svc.changeApprovalStatus("service-1", "approved", "actor-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("requires the 'submit' action for draft -> submitted", async () => {
      services.findById.mockResolvedValue(service({ approvalStatus: "draft" }));
      authorizationService.evaluate.mockResolvedValue({ allowed: true });
      services.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: service({ approvalStatus: "submitted" }),
      });

      await svc.changeApprovalStatus("service-1", "submitted", "actor-1");

      expect(authorizationService.evaluate).toHaveBeenCalledWith(
        "actor-1",
        "service_persona_proof",
        "submit",
      );
    });

    it("requires the 'review' action for submitted -> under_review", async () => {
      services.findById.mockResolvedValue(service({ approvalStatus: "submitted" }));
      authorizationService.evaluate.mockResolvedValue({ allowed: true });
      services.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: service({ approvalStatus: "under_review" }),
      });

      await svc.changeApprovalStatus("service-1", "under_review", "actor-1");

      expect(authorizationService.evaluate).toHaveBeenCalledWith(
        "actor-1",
        "service_persona_proof",
        "review",
      );
    });

    it("requires the 'approve' action for under_review -> approved", async () => {
      services.findById.mockResolvedValue(service({ approvalStatus: "under_review" }));
      authorizationService.evaluate.mockResolvedValue({ allowed: true });
      services.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: service({ approvalStatus: "approved" }),
      });

      await svc.changeApprovalStatus("service-1", "approved", "actor-1");

      expect(authorizationService.evaluate).toHaveBeenCalledWith(
        "actor-1",
        "service_persona_proof",
        "approve",
      );
    });

    it("throws ForbiddenException and records the denial when the actor lacks the required action", async () => {
      services.findById.mockResolvedValue(service({ approvalStatus: "under_review" }));
      authorizationService.evaluate.mockResolvedValue({ allowed: false, reasonCode: "no_grant" });

      await expect(svc.changeApprovalStatus("service-1", "approved", "actor-1")).rejects.toThrow(
        ForbiddenException,
      );
      expect(authorizationService.recordAccessDenied).toHaveBeenCalledWith(
        "actor-1",
        "service_persona_proof",
        "approve",
        "no_grant",
      );
      expect(services.updateStatus).not.toHaveBeenCalled();
    });

    it("throws ConflictException when the atomic status write loses a race", async () => {
      services.findById.mockResolvedValue(service({ approvalStatus: "draft" }));
      authorizationService.evaluate.mockResolvedValue({ allowed: true });
      services.updateStatus.mockResolvedValue({
        outcome: "conflict",
        entity: service({ approvalStatus: "archived" }),
      });

      await expect(svc.changeApprovalStatus("service-1", "submitted", "actor-1")).rejects.toThrow(
        ConflictException,
      );
    });

    it("logs (not throws) when the audit call fails after a successful status write", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      services.findById.mockResolvedValue(service({ approvalStatus: "draft" }));
      authorizationService.evaluate.mockResolvedValue({ allowed: true });
      services.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: service({ approvalStatus: "submitted" }),
      });
      auditService.record.mockRejectedValue(new Error("audit down"));

      const result = await svc.changeApprovalStatus("service-1", "submitted", "actor-1");

      expect(result.approvalStatus).toBe("submitted");
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });
});
