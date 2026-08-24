/** NestJS DI tokens for the Content Template Library module — kept in one file, same pattern as
 *  ../persona-library/persona-library.constants.ts/../website-strategy-center/website-strategy-center.constants.ts. */
export const CONTENT_TEMPLATE_REPOSITORY = Symbol("CONTENT_TEMPLATE_REPOSITORY");

/** The RBAC group key (`06_Roles_and_Permissions.md`, `00013-seed-rbac-matrix.ts:127-135`) —
 *  distinct from `module_registry.key = "content_template_library"`. Declared once here, not
 *  independently in both the service and the controller, so a future RBAC-key rename can't
 *  silently diverge between the two files (code-review finding, mirroring Internal Linking
 *  Library's own identical `INTERNAL_LINKING_LIBRARY_MODULE_KEY` fix for the same bug class). */
export const CONTENT_TEMPLATE_LIBRARY_MODULE_KEY = "page_content";
