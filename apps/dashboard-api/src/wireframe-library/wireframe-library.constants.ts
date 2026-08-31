/** NestJS DI token for the Wireframe Library module — kept in one file, same pattern as
 *  ../section-and-pattern-library/section-and-pattern-library.constants.ts. */
export const WIREFRAME_RECORD_REPOSITORY = Symbol("WIREFRAME_RECORD_REPOSITORY");

/** The seeded RBAC permission group this module reuses verbatim (`00013-seed-rbac-matrix.ts`) —
 *  the same group Brand Library, Design Reference Library, Design Token Library, and Section and
 *  Pattern Library already use, no new RBAC migration. Kept here as the single source of truth
 *  rather than duplicated as a local literal in both the service and the controller, matching
 *  Section and Pattern Library's own precedent — see
 *  `docs/implementation/module-wireframe-library.md`'s "As-built" section. */
export const MODULE_KEY = "creative_design";
