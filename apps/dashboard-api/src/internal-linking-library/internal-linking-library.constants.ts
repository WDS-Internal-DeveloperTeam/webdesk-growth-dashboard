/** NestJS DI token for the Internal Linking Library module — same pattern as
 *  ../keyword-and-entity-library/keyword-and-entity-library.constants.ts /
 *  ../page-inventory/page-inventory.constants.ts. */
export const INTERNAL_LINK_REPOSITORY = Symbol("INTERNAL_LINK_REPOSITORY");

/** The RBAC group key (`06_Roles_and_Permissions.md`, `00013-seed-rbac-matrix.ts:190-198`) —
 *  distinct from `module_registry.key = "internal_linking_library"`. The IDENTICAL string
 *  Keyword & Entity Library's own services already use — both modules were seeded to share this
 *  RBAC group (task package §4), not a coincidence. Declared once here, not independently in both
 *  the service and the controller, so a future RBAC-key rename can't silently diverge between the
 *  two files. */
export const INTERNAL_LINKING_LIBRARY_MODULE_KEY = "keyword_internal_links";
