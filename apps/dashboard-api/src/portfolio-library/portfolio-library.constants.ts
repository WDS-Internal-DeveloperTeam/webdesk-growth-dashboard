/** The real, seeded RBAC permission-group key for Portfolio Library
 *  (`06_Roles_and_Permissions.md`, `00013-seed-rbac-matrix.ts:172-179` — `portfolio`), same key as
 *  the module registry's own `portfolio_library` key coincidentally, but declared independently
 *  here per this codebase's own "RBAC group key, not module registry key" precedent
 *  (`CASE_STUDY_STUDIO_MODULE_KEY`/`CONTENT_TEMPLATE_LIBRARY_MODULE_KEY`) — declared once here, not
 *  independently in both the service and the controller, so a future RBAC-key rename can't
 *  silently diverge between the two files. */
export const PORTFOLIO_LIBRARY_MODULE_KEY = "portfolio";

/** NestJS DI tokens — kept in one file, same pattern as
 *  ../content-template-library/content-template-library.constants.ts/
 *  ../case-study-studio/case-study-studio.constants.ts. */
export const PORTFOLIO_RECORD_REPOSITORY = Symbol("PORTFOLIO_RECORD_REPOSITORY");
export const PORTFOLIO_ASSET_REPOSITORY = Symbol("PORTFOLIO_ASSET_REPOSITORY");
