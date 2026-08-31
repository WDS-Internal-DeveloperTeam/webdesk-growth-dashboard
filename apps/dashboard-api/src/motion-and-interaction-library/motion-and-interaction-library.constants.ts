/** NestJS DI token for the Motion and Interaction Library module — kept in one file, same pattern
 *  as ../section-and-pattern-library/section-and-pattern-library.constants.ts /
 *  ../page-template-library/page-template-library.constants.ts. */
export const MOTION_INTERACTION_RECORD_REPOSITORY = Symbol("MOTION_INTERACTION_RECORD_REPOSITORY");

/** The seeded RBAC permission group this module reuses verbatim (`00013-seed-rbac-matrix.ts`) —
 *  the same group Brand Library/Design Reference Library/Design Token Library/Component
 *  Library/Section and Pattern Library/Page Template Library already use, no new RBAC migration.
 *  Kept here as the single source of truth rather than duplicated as a local literal in both the
 *  service and the controller, matching every sibling module's own precedent — see
 *  `docs/implementation/module-motion-and-interaction-library.md`'s "As-built" section. */
export const MODULE_KEY = "creative_design";
