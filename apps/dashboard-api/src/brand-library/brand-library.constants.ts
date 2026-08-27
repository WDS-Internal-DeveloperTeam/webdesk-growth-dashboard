/** NestJS DI tokens for the Brand Library module — kept in one file, same pattern as
 *  ../content-template-library/content-template-library.constants.ts. */
export const BRAND_LIBRARY_RECORD_REPOSITORY = Symbol("BRAND_LIBRARY_RECORD_REPOSITORY");

/** The RBAC group key (`06_Roles_and_Permissions.md`, `00013-seed-rbac-matrix.ts:136-144`) —
 *  distinct from `module_registry.key = "brand_library"`. Declared once here, not independently in
 *  both the service and the controller, so a future RBAC-key rename can't silently diverge between
 *  the two files, mirroring `CONTENT_TEMPLATE_LIBRARY_MODULE_KEY`'s own identical fix for the same
 *  bug class. */
export const BRAND_LIBRARY_MODULE_KEY = "creative_design";
