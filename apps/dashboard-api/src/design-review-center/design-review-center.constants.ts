/** NestJS DI tokens for the Design Review Center module — kept in one file, same pattern as
 *  ../review-and-approval-center/review-and-approval-center.constants.ts. */
export const DESIGN_REVIEW_REPOSITORY = Symbol("DESIGN_REVIEW_REPOSITORY");
export const DESIGN_REVIEW_DECISION_REPOSITORY = Symbol("DESIGN_REVIEW_DECISION_REPOSITORY");

/** The RBAC group key (`06_Roles_and_Permissions.md`, `00013-seed-rbac-matrix.ts:208-215`) —
 *  Design Review Center shares the already-seeded `review_center` group with Review and Approval
 *  Center (module #11), per this module's own scope doc — distinct from
 *  `module_registry.key = "design_review_center"`. Declared once here, not independently in both
 *  the service and the controller, matching `REVIEW_AND_APPROVAL_CENTER_MODULE_KEY`'s own
 *  established fix pattern for this exact bug class. */
export const DESIGN_REVIEW_CENTER_MODULE_KEY = "review_center";
