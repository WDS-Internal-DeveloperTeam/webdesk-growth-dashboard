/** `case_study_library` shares the same real, seeded RBAC permission group (`case_studies`) as
 *  `case_study_studio` (`00013-seed-rbac-matrix.ts`, `00015-seed-module-registry.ts`) — a
 *  coincidentally-identical value, not a real coupling between the two modules. Declared
 *  independently here (code-review finding) rather than imported from
 *  `case-study-studio.constants.ts`, matching every other sibling module's own convention for a
 *  shared permission-group value (e.g. Persona Library independently redeclares Service Library's
 *  identical `service_persona_proof` value rather than importing its symbol) — importing the
 *  sibling's actual constant would create a real cross-module coupling where none is intended, and
 *  would read as if this module were checking Case Study Studio's own permissions. */
export const CASE_STUDY_LIBRARY_MODULE_KEY = "case_studies";

/** NestJS DI token — kept in one file, same pattern as
 *  ../case-study-studio/case-study-studio.constants.ts. */
export const CASE_STUDY_LIBRARY_RECORD_REPOSITORY = Symbol("CASE_STUDY_LIBRARY_RECORD_REPOSITORY");
