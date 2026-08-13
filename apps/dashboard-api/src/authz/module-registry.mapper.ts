import type { ModuleRegistryEntity } from "@webdesk/database";
import type { ModuleRegistrySummary } from "@webdesk/shared-types";

/**
 * Shared `ModuleRegistryEntity` → `ModuleRegistrySummary` mapping, used by both the admin catalog
 * endpoint (`CatalogService`) and the navigation endpoint (`NavigationService`) so there is one
 * conversion, not two drifting copies. `canView` is left undefined here — only
 * `NavigationService` sets it, per capability.
 */
export function toModuleRegistrySummary(
  entry: ModuleRegistryEntity,
  permissionGroupKeyById: ReadonlyMap<string, string>,
): ModuleRegistrySummary {
  return {
    id: entry.id,
    key: entry.key,
    name: entry.name,
    permissionGroupKey: permissionGroupKeyById.get(entry.permissionGroupId) ?? "unknown",
    displayName: entry.displayName,
    description: entry.description,
    navigationGroup: entry.navigationGroup,
    navigationOrder: entry.navigationOrder,
    route: entry.route,
    iconReference: entry.iconReference,
    v1InclusionStatus: entry.v1InclusionStatus,
    implementationStatus: entry.implementationStatus,
    viewPermissionAction: entry.viewPermissionAction,
    actionPermissions: entry.actionPermissions,
    featureStatus: entry.featureStatus,
    documentationReference: entry.documentationReference,
    helpDocumentReference: entry.helpDocumentReference,
    owner: entry.owner,
    dependencies: entry.dependencies,
    confidentialityLevel: entry.confidentialityLevel,
    badgeSupport: entry.badgeSupport,
    deprecationReference: entry.deprecationReference,
  };
}
