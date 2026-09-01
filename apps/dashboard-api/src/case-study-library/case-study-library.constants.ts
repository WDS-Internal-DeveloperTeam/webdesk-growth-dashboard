/** Reuses Case Study Studio's own already-declared constant, not a second identically-valued
 *  declaration — `case_study_library` shares the same real, seeded RBAC permission group
 *  (`case_studies`) as `case_study_studio` (`00013-seed-rbac-matrix.ts`,
 *  `00015-seed-module-registry.ts`), mirroring `CASE_STUDY_STUDIO_MODULE_KEY`'s own doc comment. */
export { CASE_STUDY_STUDIO_MODULE_KEY } from "../case-study-studio/case-study-studio.constants.js";

/** NestJS DI token — kept in one file, same pattern as
 *  ../case-study-studio/case-study-studio.constants.ts. */
export const CASE_STUDY_LIBRARY_RECORD_REPOSITORY = Symbol("CASE_STUDY_LIBRARY_RECORD_REPOSITORY");
