import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { APPROVED_NAVIGATION_GROUPS } from "@webdesk/shared-types";
import { ModuleRegistryRepository, ModuleRepository } from "./authz/index.js";
import { validateModuleRegistry } from "./authz/module-registry-validation.js";
import { closeConnection } from "./connection.js";

/**
 * Module-registry + permission-mapping validation CLI, `node dist/validate-module-registry.js`
 * (Phase 1F brief §26/§27, `docs/task-packages/phase-1f-application-shell.md`). Read-only — no
 * DDL, no writes. Wired into CI's `database-migration-test` job, which already has a freshly
 * migrated disposable database to check against.
 *
 * Validated against the LIVE database, not just migration source — this catches real drift
 * between what's actually deployed and what the approved manifest/source expects, not just
 * inconsistency within the TypeScript source tree. The actual validation rules live in
 * `authz/module-registry-validation.ts`, unit-tested there without a real database.
 */

// packages/database/dist/validate-module-registry.js -> repo root is 3 levels up.
const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));

async function main(): Promise<void> {
  const moduleRegistry = new ModuleRegistryRepository();
  const modules = new ModuleRepository();

  const [registryEntries, permissionGroups] = await Promise.all([
    moduleRegistry.listAll(),
    modules.listAll(),
  ]);

  const errors = validateModuleRegistry(registryEntries, permissionGroups, {
    approvedNavigationGroups: APPROVED_NAVIGATION_GROUPS,
    documentationReferenceExists: (reference) => existsSync(`${REPO_ROOT}${reference}`),
  });

  await closeConnection();

  if (errors.length > 0) {
    console.error(`Module-registry validation FAILED — ${errors.length} issue(s):\n`);
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  // eslint-disable-next-line no-console -- this IS the CLI's own diagnostic output.
  console.log(
    `Module-registry validation passed — ${registryEntries.length} modules, ${permissionGroups.length} permission groups, all references resolve.`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
