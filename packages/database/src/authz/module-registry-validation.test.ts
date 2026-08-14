import { describe, expect, it } from "vitest";
import type { ModuleEntity, ModuleRegistryEntity } from "./entities.js";
import { EXPECTED_MODULE_REGISTRY_KEYS } from "./module-registry.expected-keys.js";
import { validateModuleRegistry } from "./module-registry-validation.js";

const APPROVED_NAVIGATION_GROUPS = ["home", "libraries", "settings"];

function permissionGroup(id: string): ModuleEntity {
  return { id, key: `group_${id}`, name: `Group ${id}`, createdAt: "x", updatedAt: "x" };
}

function registryEntry(
  overrides: Partial<ModuleRegistryEntity> & { key: string },
): ModuleRegistryEntity {
  const base = {
    id: overrides.key,
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
  } satisfies Omit<ModuleRegistryEntity, "key">;
  return { ...base, ...overrides, key: overrides.key };
}

/** Builds a full, valid 43-row registry matching EXPECTED_MODULE_REGISTRY_KEYS exactly. */
function fullApprovedRegistry(): ModuleRegistryEntity[] {
  return EXPECTED_MODULE_REGISTRY_KEYS.map((key) =>
    registryEntry({ key, permissionGroupId: "g1" }),
  );
}

function fullPermissionGroups(): ModuleEntity[] {
  const groups = [permissionGroup("g1")];
  for (let i = 2; i <= 21; i += 1) groups.push(permissionGroup(`g${i}`));
  return groups;
}

const alwaysExists = () => true;

describe("validateModuleRegistry", () => {
  it("passes for the full, valid 43-module registry against 21 permission groups", () => {
    const errors = validateModuleRegistry(fullApprovedRegistry(), fullPermissionGroups(), {
      approvedNavigationGroups: APPROVED_NAVIGATION_GROUPS,
      documentationReferenceExists: alwaysExists,
    });
    expect(errors).toEqual([]);
  });

  it("flags an unauthorized module not in the approved key manifest", () => {
    const entries = [...fullApprovedRegistry(), registryEntry({ key: "fake_extra_module" })];
    const errors = validateModuleRegistry(entries, fullPermissionGroups(), {
      approvedNavigationGroups: APPROVED_NAVIGATION_GROUPS,
      documentationReferenceExists: alwaysExists,
    });
    expect(errors.some((e) => e.includes("Unauthorized module"))).toBe(true);
    expect(errors.some((e) => e.includes("Expected 43"))).toBe(true);
  });

  it("flags a missing approved module", () => {
    const entries = fullApprovedRegistry().filter((e) => e.key !== "home");
    const errors = validateModuleRegistry(entries, fullPermissionGroups(), {
      approvedNavigationGroups: APPROVED_NAVIGATION_GROUPS,
      documentationReferenceExists: alwaysExists,
    });
    expect(errors.some((e) => e.includes('Approved module "home" is missing'))).toBe(true);
  });

  it("flags a duplicate route", () => {
    const entries = fullApprovedRegistry();
    entries[1] = registryEntry({ ...entries[1]!, route: entries[0]!.route });
    const errors = validateModuleRegistry(entries, fullPermissionGroups(), {
      approvedNavigationGroups: APPROVED_NAVIGATION_GROUPS,
      documentationReferenceExists: alwaysExists,
    });
    expect(errors.some((e) => e.includes("Duplicate module_registry route"))).toBe(true);
  });

  it("flags an invalid navigation group", () => {
    const entries = fullApprovedRegistry();
    entries[0] = registryEntry({ ...entries[0]!, navigationGroup: "not-a-real-group" });
    const errors = validateModuleRegistry(entries, fullPermissionGroups(), {
      approvedNavigationGroups: APPROVED_NAVIGATION_GROUPS,
      documentationReferenceExists: alwaysExists,
    });
    expect(errors.some((e) => e.includes("navigation_group"))).toBe(true);
  });

  it("flags an invalid implementation_status and v1_inclusion_status", () => {
    const entries = fullApprovedRegistry();
    entries[0] = registryEntry({
      ...entries[0]!,
      implementationStatus: "shipped" as ModuleRegistryEntity["implementationStatus"],
      v1InclusionStatus: "maybe" as ModuleRegistryEntity["v1InclusionStatus"],
    });
    const errors = validateModuleRegistry(entries, fullPermissionGroups(), {
      approvedNavigationGroups: APPROVED_NAVIGATION_GROUPS,
      documentationReferenceExists: alwaysExists,
    });
    expect(errors.some((e) => e.includes("implementation_status"))).toBe(true);
    expect(errors.some((e) => e.includes("v1_inclusion_status"))).toBe(true);
  });

  it("flags a permission_group_id that doesn't resolve to any permission group", () => {
    const entries = fullApprovedRegistry();
    entries[0] = registryEntry({ ...entries[0]!, permissionGroupId: "does-not-exist" });
    const errors = validateModuleRegistry(entries, fullPermissionGroups(), {
      approvedNavigationGroups: APPROVED_NAVIGATION_GROUPS,
      documentationReferenceExists: alwaysExists,
    });
    expect(errors.some((e) => e.includes("does not resolve to any row in the modules"))).toBe(true);
  });

  it("flags a documentation_reference that doesn't resolve to a real file", () => {
    const errors = validateModuleRegistry(fullApprovedRegistry(), fullPermissionGroups(), {
      approvedNavigationGroups: APPROVED_NAVIGATION_GROUPS,
      documentationReferenceExists: () => false,
    });
    expect(errors.some((e) => e.includes("does not resolve to a real file"))).toBe(true);
  });

  it("flags an unexpected permission-group count", () => {
    const errors = validateModuleRegistry(fullApprovedRegistry(), [permissionGroup("g1")], {
      approvedNavigationGroups: APPROVED_NAVIGATION_GROUPS,
      documentationReferenceExists: alwaysExists,
    });
    expect(errors.some((e) => e.includes("Expected 21 seeded permission groups"))).toBe(true);
  });
});
