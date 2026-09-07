/** NestJS DI tokens for the System Settings module — kept in one file, same pattern as
 *  ../brand-library/brand-library.constants.ts. */
export const SYSTEM_SETTING_REPOSITORY = Symbol("SYSTEM_SETTING_REPOSITORY");

/** The RBAC group key (`06_Roles_and_Permissions.md`, `00013-seed-rbac-matrix.ts:266-269`) —
 *  identical string to `module_registry.key = "system_settings"` for this module (unlike Brand
 *  Library's `creative_design`/`brand_library` split), but declared here anyway, not inlined, so
 *  the service/controller never independently hand-type the RBAC group key, mirroring
 *  `BRAND_LIBRARY_MODULE_KEY`'s own precedent for the identical bug class (a future RBAC-key
 *  rename can't silently diverge between two files). */
export const SYSTEM_SETTINGS_MODULE_KEY = "system_settings";
