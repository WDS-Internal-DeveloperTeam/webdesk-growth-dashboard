import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthorizationService } from "./authorization.service.js";
import { NavigationService } from "./navigation.service.js";

describe("NavigationService", () => {
  let modules: { listAll: ReturnType<typeof vi.fn> };
  let moduleRegistry: { listForNavigation: ReturnType<typeof vi.fn> };
  let authorization: { getEffectiveCapabilities: ReturnType<typeof vi.fn> };
  let service: NavigationService;

  const registryEntry = (overrides: Record<string, unknown>) => ({
    id: overrides.key,
    key: overrides.key,
    name: overrides.key,
    permissionGroupId: "g1",
    displayName: null,
    description: null,
    navigationGroup: "settings",
    navigationOrder: 1,
    route: `/${overrides.key}`,
    iconReference: null,
    v1InclusionStatus: "included",
    implementationStatus: "not_started",
    viewPermissionAction: `${overrides.key}_view`,
    actionPermissions: null,
    featureStatus: null,
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
    createdAt: "x",
    updatedAt: "x",
    ...overrides,
  });

  beforeEach(() => {
    modules = { listAll: vi.fn() };
    moduleRegistry = { listForNavigation: vi.fn() };
    authorization = { getEffectiveCapabilities: vi.fn() };
    service = new NavigationService(
      modules as never,
      moduleRegistry as never,
      authorization as unknown as AuthorizationService,
    );
  });

  it("includes only modules the caller can view", async () => {
    moduleRegistry.listForNavigation.mockResolvedValue([
      registryEntry({ key: "home", permissionGroupId: "g1" }),
      registryEntry({ key: "system_settings", permissionGroupId: "g2" }),
    ]);
    modules.listAll.mockResolvedValue([
      { id: "g1", key: "project_configuration", name: "Project configuration" },
      { id: "g2", key: "system_settings", name: "System settings" },
    ]);
    authorization.getEffectiveCapabilities.mockResolvedValue({
      project_configuration: ["home_view"],
      // no system_settings grants at all
    });

    const result = await service.getNavigation("user-1");

    expect(result.map((m) => m.key)).toEqual(["home"]);
    expect(result[0]?.canView).toBe(true);
  });

  it("excludes a module whose granted actions don't include its specific view action", async () => {
    moduleRegistry.listForNavigation.mockResolvedValue([
      registryEntry({ key: "system_settings", permissionGroupId: "g1" }),
    ]);
    modules.listAll.mockResolvedValue([
      { id: "g1", key: "system_settings", name: "System settings" },
    ]);
    // Granted a DIFFERENT action under the same group, not system_settings_view.
    authorization.getEffectiveCapabilities.mockResolvedValue({
      system_settings: ["retention_view"],
    });

    const result = await service.getNavigation("user-1");
    expect(result).toEqual([]);
  });

  it("excludes deferred/future modules regardless of capability", async () => {
    moduleRegistry.listForNavigation.mockResolvedValue([
      registryEntry({ key: "future_module", permissionGroupId: "g1", v1InclusionStatus: "future" }),
    ]);
    modules.listAll.mockResolvedValue([{ id: "g1", key: "project_configuration", name: "x" }]);
    authorization.getEffectiveCapabilities.mockResolvedValue({
      project_configuration: ["future_module_view"],
    });

    const result = await service.getNavigation("user-1");
    expect(result).toEqual([]);
  });

  it("returns nothing for a user with no effective capabilities", async () => {
    moduleRegistry.listForNavigation.mockResolvedValue([
      registryEntry({ key: "home", permissionGroupId: "g1" }),
    ]);
    modules.listAll.mockResolvedValue([{ id: "g1", key: "project_configuration", name: "x" }]);
    authorization.getEffectiveCapabilities.mockResolvedValue({});

    const result = await service.getNavigation("user-1");
    expect(result).toEqual([]);
  });
});
