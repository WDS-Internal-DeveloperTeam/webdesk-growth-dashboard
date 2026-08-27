/** NestJS DI tokens for the Design Reference Library module — kept in one file, same pattern as
 *  ../brand-library/brand-library.constants.ts. */
export const DESIGN_REFERENCE_RECORD_REPOSITORY = Symbol("DESIGN_REFERENCE_RECORD_REPOSITORY");

/** The RBAC group key (`06_Roles_and_Permissions.md`, `00013-seed-rbac-matrix.ts:136-144`) —
 *  distinct from `module_registry.key = "design_reference_library"`. Declared once here, not
 *  independently in both the service and the controller, so a future RBAC-key rename can't
 *  silently diverge between the two files, mirroring `BRAND_LIBRARY_MODULE_KEY`'s own identical
 *  fix for the same bug class. Reuses the same `creative_design` group Brand Library uses (D0 —
 *  the same RBAC permission group is seeded for both modules). */
export const DESIGN_REFERENCE_LIBRARY_MODULE_KEY = "creative_design";
