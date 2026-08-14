import type { ModuleRegistryRepository, ModuleRepository } from "@webdesk/database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CatalogService } from "./catalog.service.js";

describe("CatalogService", () => {
  let modules: { listAll: ReturnType<typeof vi.fn> };
  let moduleRegistry: { listAll: ReturnType<typeof vi.fn> };
  let service: CatalogService;

  beforeEach(() => {
    modules = { listAll: vi.fn() };
    moduleRegistry = { listAll: vi.fn() };
    service = new CatalogService(
      modules as unknown as ModuleRepository,
      moduleRegistry as unknown as ModuleRegistryRepository,
    );
  });

  describe("listPermissionGroups", () => {
    it("maps module entities to their public summary shape", async () => {
      modules.listAll.mockResolvedValue([
        {
          id: "m1",
          key: "business_knowledge",
          name: "Business Knowledge",
          createdAt: "x",
          updatedAt: "x",
        },
      ]);
      expect(await service.listPermissionGroups()).toEqual([
        { id: "m1", key: "business_knowledge", name: "Business Knowledge" },
      ]);
    });
  });

  const registryEntryFixture = {
    id: "r1",
    key: "case_study_library",
    name: "Case Study Library",
    permissionGroupId: "m1",
    displayName: "Case Study Library",
    description: "Published and unpublished case studies.",
    navigationGroup: "libraries",
    navigationOrder: 4,
    route: "/case-study-library",
    iconReference: "library",
    v1InclusionStatus: "included",
    implementationStatus: "not_started",
    viewPermissionAction: "case_study_library_view",
    actionPermissions: null,
    featureStatus: "Not Started",
    documentationReference: "docs.md",
    helpDocumentReference: null,
    owner: "TBD",
    dependencies: null,
    confidentialityLevel: null,
    badgeSupport: true,
    visibilityRules: null,
    deprecationReference: null,
    registryVersion: 1,
    lastReviewedAt: null,
  };

  describe("listModuleRegistry", () => {
    it("resolves each entry's permission group id to its key", async () => {
      moduleRegistry.listAll.mockResolvedValue([registryEntryFixture]);
      modules.listAll.mockResolvedValue([{ id: "m1", key: "case_studies", name: "Case studies" }]);

      const result = await service.listModuleRegistry();
      expect(result).toEqual([
        {
          id: "r1",
          key: "case_study_library",
          name: "Case Study Library",
          permissionGroupKey: "case_studies",
          displayName: "Case Study Library",
          description: "Published and unpublished case studies.",
          navigationGroup: "libraries",
          navigationOrder: 4,
          route: "/case-study-library",
          iconReference: "library",
          v1InclusionStatus: "included",
          implementationStatus: "not_started",
          viewPermissionAction: "case_study_library_view",
          actionPermissions: null,
          featureStatus: "Not Started",
          documentationReference: "docs.md",
          helpDocumentReference: null,
          owner: "TBD",
          dependencies: null,
          confidentialityLevel: null,
          badgeSupport: true,
          deprecationReference: null,
        },
      ]);
    });

    it("falls back to 'unknown' if a registry entry's permission group can't be resolved", async () => {
      moduleRegistry.listAll.mockResolvedValue([
        { ...registryEntryFixture, id: "r1", key: "orphan", permissionGroupId: "does-not-exist" },
      ]);
      modules.listAll.mockResolvedValue([]);

      const result = await service.listModuleRegistry();
      expect(result[0]?.permissionGroupKey).toBe("unknown");
    });
  });
});
