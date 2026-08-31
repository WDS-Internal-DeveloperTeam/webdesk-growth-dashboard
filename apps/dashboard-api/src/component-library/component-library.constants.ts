/** NestJS DI token for the Component Library module — kept in one file, same pattern as
 *  ../design-token-library/design-token-library.constants.ts /
 *  ../persona-library/persona-library.constants.ts. */
export const COMPONENT_REPOSITORY = Symbol("COMPONENT_REPOSITORY");

/** The seeded RBAC permission group this module reuses verbatim (`00013-seed-rbac-matrix.ts`) —
 *  the same group Design Token Library/Brand Library/Design Reference Library already use, no new
 *  RBAC migration. Kept here as the single source of truth rather than duplicated as a local
 *  literal in both the service and the controller — see
 *  `docs/implementation/module-component-library.md`'s "As-built" section. */
export const MODULE_KEY = "creative_design";
