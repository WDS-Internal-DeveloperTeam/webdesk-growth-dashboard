/** NestJS DI tokens for the Review and Approval Center module — kept in one file, same pattern as
 *  ../content-template-library/content-template-library.constants.ts/../internal-linking-library/
 *  internal-linking-library.constants.ts. */
export const REVIEW_REPOSITORY = Symbol("REVIEW_REPOSITORY");
export const REVIEW_COMMENT_REPOSITORY = Symbol("REVIEW_COMMENT_REPOSITORY");
export const REVIEW_DECISION_REPOSITORY = Symbol("REVIEW_DECISION_REPOSITORY");

/** The RBAC group key (`06_Roles_and_Permissions.md`, `00013-seed-rbac-matrix.ts:208-215`) —
 *  distinct from `module_registry.key = "review_and_approval_center"`. Declared once here, not
 *  independently in both the service and the controller, so a future RBAC-key rename can't
 *  silently diverge between the two files — the established fix pattern for this exact bug class
 *  (Internal Linking Library's `INTERNAL_LINKING_LIBRARY_MODULE_KEY`, Content Template Library's
 *  `CONTENT_TEMPLATE_LIBRARY_MODULE_KEY`). */
export const REVIEW_AND_APPROVAL_CENTER_MODULE_KEY = "review_center";
