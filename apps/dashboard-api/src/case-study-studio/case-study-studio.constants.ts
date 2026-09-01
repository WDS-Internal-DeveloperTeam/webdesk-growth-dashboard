/** The real, seeded RBAC permission-group key for Case Study Studio (`06_Roles_and_Permissions.md`,
 *  `00013-seed-rbac-matrix.ts` — `case_studies`, distinct from `case_study_library`'s own module
 *  registry key but sharing the same permission group), not the module registry's own
 *  `case_study_studio` key — mirrors `ASSET_LIBRARY_MODULE_KEY`'s own "permission group key, not
 *  module registry key" precedent. */
export const CASE_STUDY_STUDIO_MODULE_KEY = "case_studies";

/** NestJS DI tokens — kept in one file, same pattern as
 *  ../proof-and-claims-library/proof-and-claims-library.constants.ts. */
export const CASE_STUDY_REPOSITORY = Symbol("CASE_STUDY_REPOSITORY");
export const CASE_STUDY_ASSET_REPOSITORY = Symbol("CASE_STUDY_ASSET_REPOSITORY");
export const CASE_STUDY_CONSENT_REPOSITORY = Symbol("CASE_STUDY_CONSENT_REPOSITORY");
export const CASE_STUDY_APPROVAL_REPOSITORY = Symbol("CASE_STUDY_APPROVAL_REPOSITORY");
