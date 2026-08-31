/** NestJS DI token for the Section and Pattern Library module — kept in one file, same pattern as
 *  ../design-token-library/design-token-library.constants.ts /
 *  ../website-strategy-center/website-strategy-center.constants.ts. */
export const SECTION_PATTERN_RECORD_REPOSITORY = Symbol("SECTION_PATTERN_RECORD_REPOSITORY");

/** The seeded RBAC permission group this module reuses verbatim (`00013-seed-rbac-matrix.ts`) —
 *  the same group Brand Library, Design Reference Library, and Design Token Library already use,
 *  no new RBAC migration. Kept here as the single source of truth rather than duplicated as a
 *  local literal in both the service and the controller, matching Design Token Library's own
 *  precedent — see `docs/implementation/module-section-and-pattern-library.md`'s "As-built"
 *  section. */
export const MODULE_KEY = "creative_design";
