import type { ModuleEntity, ModuleRegistryEntity } from "./entities.js";
import { EXPECTED_MODULE_REGISTRY_KEYS } from "./module-registry.expected-keys.js";

/**
 * Pure module-registry + permission-mapping validation logic (Phase 1F brief §26/§27,
 * `docs/task-packages/phase-1f-application-shell.md`). Separated from
 * `../validate-module-registry.ts`'s CLI entrypoint so it's unit-testable without a real
 * database connection — the CLI script fetches the live rows and calls this.
 */

export const APPROVED_V1_INCLUSION_STATUSES: readonly string[] = ["included", "deferred", "future"];

export const APPROVED_IMPLEMENTATION_STATUSES: readonly string[] = [
  "not_started",
  "foundation_only",
  "in_development",
  "ready_for_review",
  "approved",
  "available",
  "deferred",
  "blocked",
  "deprecated",
];

export interface ModuleRegistryValidationOptions {
  /** Approved nav-group list (`@webdesk/shared-types`'s `APPROVED_NAVIGATION_GROUPS`). */
  readonly approvedNavigationGroups: readonly string[];
  /** Injectable so unit tests don't touch the real filesystem. */
  readonly documentationReferenceExists: (reference: string) => boolean;
}

export function validateModuleRegistry(
  registryEntries: readonly ModuleRegistryEntity[],
  permissionGroups: readonly ModuleEntity[],
  options: ModuleRegistryValidationOptions,
): string[] {
  const errors: string[] = [];
  const permissionGroupById = new Map(permissionGroups.map((m) => [m.id, m]));

  // --- §26: module-registry validation ---

  if (registryEntries.length !== EXPECTED_MODULE_REGISTRY_KEYS.length) {
    errors.push(
      `Expected ${EXPECTED_MODULE_REGISTRY_KEYS.length} module_registry rows (per module-registry.expected-keys.ts), found ${registryEntries.length}.`,
    );
  }

  const liveKeys = new Set(registryEntries.map((e) => e.key));
  const expectedKeys = new Set(EXPECTED_MODULE_REGISTRY_KEYS);
  for (const key of expectedKeys) {
    if (!liveKeys.has(key)) {
      errors.push(`Approved module "${key}" is missing from the live module_registry table.`);
    }
  }
  for (const key of liveKeys) {
    if (!expectedKeys.has(key)) {
      errors.push(
        `Unauthorized module "${key}" exists in module_registry but is not in the approved manifest (module-registry.expected-keys.ts).`,
      );
    }
  }

  const keyCounts = new Map<string, number>();
  const routeCounts = new Map<string, number>();
  for (const entry of registryEntries) {
    keyCounts.set(entry.key, (keyCounts.get(entry.key) ?? 0) + 1);
    routeCounts.set(entry.route, (routeCounts.get(entry.route) ?? 0) + 1);
  }
  for (const [key, count] of keyCounts) {
    if (count > 1) errors.push(`Duplicate module_registry key "${key}" (${count} rows).`);
  }
  for (const [route, count] of routeCounts) {
    if (count > 1) errors.push(`Duplicate module_registry route "${route}" (${count} rows).`);
  }

  for (const entry of registryEntries) {
    const label = `module_registry["${entry.key}"]`;

    if (!entry.route || !entry.route.startsWith("/")) {
      errors.push(`${label}: route "${entry.route}" is missing or does not start with "/".`);
    }
    if (!options.approvedNavigationGroups.includes(entry.navigationGroup)) {
      errors.push(
        `${label}: navigation_group "${entry.navigationGroup}" is not one of the approved groups.`,
      );
    }
    if (!APPROVED_V1_INCLUSION_STATUSES.includes(entry.v1InclusionStatus)) {
      errors.push(
        `${label}: v1_inclusion_status "${entry.v1InclusionStatus}" is not a valid value.`,
      );
    }
    if (!APPROVED_IMPLEMENTATION_STATUSES.includes(entry.implementationStatus)) {
      errors.push(
        `${label}: implementation_status "${entry.implementationStatus}" is not a valid value.`,
      );
    }
    if (!entry.viewPermissionAction) {
      errors.push(`${label}: view_permission_action is empty — every module needs a view action.`);
    }
    if (entry.documentationReference) {
      if (!options.documentationReferenceExists(entry.documentationReference)) {
        errors.push(
          `${label}: documentation_reference "${entry.documentationReference}" does not resolve to a real file.`,
        );
      }
    } else {
      errors.push(`${label}: documentation_reference is empty.`);
    }

    // --- §27: permission mapping validation ---
    const permissionGroup = permissionGroupById.get(entry.permissionGroupId);
    if (!permissionGroup) {
      errors.push(
        `${label}: permission_group_id "${entry.permissionGroupId}" does not resolve to any row in the modules (permission-group) table.`,
      );
    }
  }

  if (permissionGroups.length !== 21) {
    errors.push(
      `Expected 21 seeded permission groups (migration 00013), found ${permissionGroups.length} — the 43-module registry's permission mapping assumes exactly this set.`,
    );
  }

  return errors;
}
