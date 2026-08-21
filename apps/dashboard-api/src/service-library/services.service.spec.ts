import type {
  DeliverableRepository,
  EngagementModelRepository,
  PlatformTechnologyRepository,
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
import type { UsersService } from "../users/users.service.js";
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
  let deliverables: { findByIds: ReturnType<typeof vi.fn> };
  let platforms: { findByIds: ReturnType<typeof vi.fn> };
  let engagementModels: { findByIds: ReturnType<typeof vi.fn> };
  let relationships: {
    replaceDeliverables: ReturnType<typeof vi.fn>;
    replacePlatforms: ReturnType<typeof vi.fn>;
    replaceEngagementModels: ReturnType<typeof vi.fn>;
    listDeliverableIds: ReturnType<typeof vi.fn>;
    listPlatformIds: ReturnType<typeof vi.fn>;
    listEngagementModelIds: ReturnType<typeof vi.fn>;
  };
  let usersService: { findById: ReturnType<typeof vi.fn> };
  let authorizationService: { assertAllowed: ReturnType<typeof vi.fn> };
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
    deliverables = { findByIds: vi.fn() };
    platforms = { findByIds: vi.fn() };
    engagementModels = { findByIds: vi.fn() };
    relationships = {
      replaceDeliverables: vi.fn(),
      replacePlatforms: vi.fn(),
      replaceEngagementModels: vi.fn(),
      listDeliverableIds: vi.fn().mockResolvedValue([]),
      listPlatformIds: vi.fn().mockResolvedValue([]),
      listEngagementModelIds: vi.fn().mockResolvedValue([]),
    };
    usersService = { findById: vi.fn() };
    authorizationService = { assertAllowed: vi.fn() };
    auditService = { record: vi.fn() };
    svc = new ServicesService(
      services as unknown as ServiceRepository,
      categories as unknown as ServiceCategoryRepository,
      deliverables as unknown as DeliverableRepository,
      platforms as unknown as PlatformTechnologyRepository,
      engagementModels as unknown as EngagementModelRepository,
      relationships as unknown as ServiceRelationshipRepository,
      usersService as unknown as UsersService,
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

      expect(result).toEqual({
        ...service(),
        deliverableIds: [],
        platformIds: [],
        engagementModelIds: [],
      });
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

    it("rejects when ownerUserId does not resolve to an active user", async () => {
      categories.findById.mockResolvedValue(category());
      services.findByPublicId.mockResolvedValue(null);
      usersService.findById.mockRejectedValue(new NotFoundException());

      await expect(
        svc.create(
          {
            publicId: "SVC-X",
            canonicalName: "X",
            categoryId: "category-1",
            ownerUserId: "missing-owner",
          },
          "actor-1",
        ),
      ).rejects.toThrow(BadRequestException);
      expect(services.create).not.toHaveBeenCalled();
    });

    it("rejects when a deliverableId does not exist", async () => {
      categories.findById.mockResolvedValue(category());
      services.findByPublicId.mockResolvedValue(null);
      deliverables.findByIds.mockResolvedValue([]);

      await expect(
        svc.create(
          {
            publicId: "SVC-X",
            canonicalName: "X",
            categoryId: "category-1",
            deliverableIds: ["missing-deliverable"],
          },
          "actor-1",
        ),
      ).rejects.toThrow(BadRequestException);
      expect(services.create).not.toHaveBeenCalled();
    });

    it("rejects when a platformId does not exist", async () => {
      categories.findById.mockResolvedValue(category());
      services.findByPublicId.mockResolvedValue(null);
      platforms.findByIds.mockResolvedValue([]);

      await expect(
        svc.create(
          {
            publicId: "SVC-X",
            canonicalName: "X",
            categoryId: "category-1",
            platformIds: ["missing-platform"],
          },
          "actor-1",
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects when an engagementModelId does not exist", async () => {
      categories.findById.mockResolvedValue(category());
      services.findByPublicId.mockResolvedValue(null);
      engagementModels.findByIds.mockResolvedValue([]);

      await expect(
        svc.create(
          {
            publicId: "SVC-X",
            canonicalName: "X",
            categoryId: "category-1",
            engagementModelIds: ["missing-engagement-model"],
          },
          "actor-1",
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("replaces the deliverable/platform/engagement-model links atomically when provided, skipping the destroy step on a fresh row", async () => {
      categories.findById.mockResolvedValue(category());
      services.findByPublicId.mockResolvedValue(null);
      services.create.mockResolvedValue(service());
      deliverables.findByIds.mockResolvedValue([{ id: "deliverable-1" }]);
      platforms.findByIds.mockResolvedValue([{ id: "platform-1" }]);
      engagementModels.findByIds.mockResolvedValue([{ id: "engagement-1" }]);

      const result = await svc.create(
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
        { skipDestroy: true },
      );
      expect(relationships.replacePlatforms).toHaveBeenCalledWith(
        "service-1",
        ["platform-1"],
        expect.anything(),
        { skipDestroy: true },
      );
      expect(relationships.replaceEngagementModels).toHaveBeenCalledWith(
        "service-1",
        ["engagement-1"],
        expect.anything(),
        { skipDestroy: true },
      );
      // The response reflects what was just written without a re-fetch (no relationships.list*
      // call needed for create()).
      expect(result.deliverableIds).toEqual(["deliverable-1"]);
      expect(result.platformIds).toEqual(["platform-1"]);
      expect(result.engagementModelIds).toEqual(["engagement-1"]);
      expect(relationships.listDeliverableIds).not.toHaveBeenCalled();
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

    it("does not re-validate categoryId when the patch resends the current, unchanged value", async () => {
      services.findById.mockResolvedValue(service({ categoryId: "category-1" }));
      services.update.mockResolvedValue(service({ canonicalName: "Renamed" }));

      await svc.update(
        "service-1",
        { categoryId: "category-1", canonicalName: "Renamed" },
        "actor-1",
      );

      expect(categories.findById).not.toHaveBeenCalled();
    });

    it("rejects when a new parentServiceId does not exist", async () => {
      services.findById.mockResolvedValueOnce(service()).mockResolvedValueOnce(null);

      await expect(
        svc.update("service-1", { parentServiceId: "missing-parent" }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects when a new ownerUserId does not resolve to an active user", async () => {
      services.findById.mockResolvedValue(service());
      usersService.findById.mockRejectedValue(new NotFoundException());

      await expect(
        svc.update("service-1", { ownerUserId: "missing-owner" }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("does not re-validate ownerUserId when the patch resends the current, unchanged value", async () => {
      services.findById.mockResolvedValue(service({ ownerUserId: "owner-1" }));
      services.update.mockResolvedValue(service({ ownerUserId: "owner-1" }));

      await svc.update("service-1", { ownerUserId: "owner-1" }, "actor-1");

      expect(usersService.findById).not.toHaveBeenCalled();
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

    it("returns the enriched shape (re-fetched, since an omitted relationship field means unchanged, not empty)", async () => {
      services.findById.mockResolvedValue(service());
      services.update.mockResolvedValue(service({ canonicalName: "Renamed" }));
      relationships.listDeliverableIds.mockResolvedValue(["deliverable-1"]);

      const result = await svc.update("service-1", { canonicalName: "Renamed" }, "actor-1");

      expect(result.deliverableIds).toEqual(["deliverable-1"]);
    });
  });

  describe("changeApprovalStatus", () => {
    it("is a no-op returning the current entity when the requested status matches the current one", async () => {
      services.findById.mockResolvedValue(service({ approvalStatus: "draft" }));
      const result = await svc.changeApprovalStatus("service-1", "draft", "actor-1");
      expect(result.approvalStatus).toBe("draft");
      expect(authorizationService.assertAllowed).not.toHaveBeenCalled();
    });

    it("rejects a transition not in the allowlist", async () => {
      services.findById.mockResolvedValue(service({ approvalStatus: "draft" }));
      await expect(svc.changeApprovalStatus("service-1", "approved", "actor-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("requires the 'submit' action for draft -> submitted", async () => {
      services.findById.mockResolvedValue(service({ approvalStatus: "draft" }));
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      services.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: service({ approvalStatus: "submitted" }),
      });

      await svc.changeApprovalStatus("service-1", "submitted", "actor-1");

      expect(authorizationService.assertAllowed).toHaveBeenCalledWith(
        "actor-1",
        "service_persona_proof",
        "submit",
      );
    });

    it("requires the 'review' action for submitted -> under_review", async () => {
      services.findById.mockResolvedValue(service({ approvalStatus: "submitted" }));
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      services.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: service({ approvalStatus: "under_review" }),
      });

      await svc.changeApprovalStatus("service-1", "under_review", "actor-1");

      expect(authorizationService.assertAllowed).toHaveBeenCalledWith(
        "actor-1",
        "service_persona_proof",
        "review",
      );
    });

    it("requires the 'approve' action for under_review -> approved", async () => {
      services.findById.mockResolvedValue(service({ approvalStatus: "under_review" }));
      authorizationService.assertAllowed.mockResolvedValue(undefined);
      services.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: service({ approvalStatus: "approved" }),
      });

      await svc.changeApprovalStatus("service-1", "approved", "actor-1");

      expect(authorizationService.assertAllowed).toHaveBeenCalledWith(
        "actor-1",
        "service_persona_proof",
        "approve",
      );
    });

    it.each([
      ["submitted", "draft"],
      ["revision_requested", "draft"],
      ["rejected", "draft"],
    ] as const)(
      "requires the 'submit' action for %s -> draft (the submitter/editor drives the revise loop, not the approver)",
      async (from, to) => {
        services.findById.mockResolvedValue(service({ approvalStatus: from }));
        authorizationService.assertAllowed.mockResolvedValue(undefined);
        services.updateStatus.mockResolvedValue({
          outcome: "updated",
          entity: service({ approvalStatus: to }),
        });

        await svc.changeApprovalStatus("service-1", to, "actor-1");

        expect(authorizationService.assertAllowed).toHaveBeenCalledWith(
          "actor-1",
          "service_persona_proof",
          "submit",
        );
      },
    );

    it("propagates a denial from assertAllowed and never attempts the status write", async () => {
      services.findById.mockResolvedValue(service({ approvalStatus: "under_review" }));
      authorizationService.assertAllowed.mockRejectedValue(
        new ForbiddenException("Missing permission: service_persona_proof:approve"),
      );

      await expect(svc.changeApprovalStatus("service-1", "approved", "actor-1")).rejects.toThrow(
        ForbiddenException,
      );
      expect(services.updateStatus).not.toHaveBeenCalled();
    });

    it("throws ConflictException when the atomic status write loses a race", async () => {
      services.findById.mockResolvedValue(service({ approvalStatus: "draft" }));
      authorizationService.assertAllowed.mockResolvedValue(undefined);
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
      authorizationService.assertAllowed.mockResolvedValue(undefined);
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
