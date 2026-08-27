/** NestJS DI tokens for the Asset Library module — kept in one file, same pattern as
 *  ../brand-library/brand-library.constants.ts. */
export const ASSET_REPOSITORY = Symbol("ASSET_REPOSITORY");
export const ASSET_RELATED_RECORD_REPOSITORY = Symbol("ASSET_RELATED_RECORD_REPOSITORY");

/** The RBAC group key (`06_Roles_and_Permissions.md`, `00013-seed-rbac-matrix.ts:136-144`) —
 *  distinct from `module_registry.key = "asset_library"`. The same `creative_design` group Brand
 *  Library uses, so no new RBAC migration was needed for this module.
 *
 *  Declared once here, not independently in both the service and the controller, so a future
 *  RBAC-key rename can't silently diverge between the two files — mirroring
 *  `BRAND_LIBRARY_MODULE_KEY`'s/`CONTENT_TEMPLATE_LIBRARY_MODULE_KEY`'s own identical fix for the
 *  same bug class. */
export const ASSET_LIBRARY_MODULE_KEY = "creative_design";
