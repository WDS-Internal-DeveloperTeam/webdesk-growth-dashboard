/** NestJS DI token for the Page Template Library module — kept in one file, same pattern as
 *  ../component-library/component-library.constants.ts /
 *  ../section-and-pattern-library/section-and-pattern-library.constants.ts. */
export const PAGE_TEMPLATE_REPOSITORY = Symbol("PAGE_TEMPLATE_REPOSITORY");

/** The seeded RBAC permission group this module reuses verbatim (`00013-seed-rbac-matrix.ts`) —
 *  the same group Design Token Library/Component Library/Section and Pattern Library already use,
 *  no new RBAC migration. Kept here as the single source of truth rather than duplicated as a
 *  local literal in both the service and the controller — see
 *  `docs/implementation/module-page-template-library.md`'s "As-built" section. */
export const MODULE_KEY = "creative_design";
