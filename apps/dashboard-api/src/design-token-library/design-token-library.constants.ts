/** NestJS DI token for the Design Token Library module — kept in one file, same pattern as
 *  ../website-strategy-center/website-strategy-center.constants.ts /
 *  ../persona-library/persona-library.constants.ts. */
export const DESIGN_TOKEN_REPOSITORY = Symbol("DESIGN_TOKEN_REPOSITORY");

/** The seeded RBAC permission group this module reuses verbatim (`00013-seed-rbac-matrix.ts`) —
 *  the same group Brand Library and Design Reference Library already use, no new RBAC migration.
 *  Kept here as the single source of truth rather than duplicated as a local literal in both the
 *  service and the controller (this project's own standing accepted-debt pattern of
 *  per-file `MODULE_KEY` duplication is real but avoidable when a constants file already exists —
 *  see `docs/implementation/module-design-token-library.md`'s "As-built" section). */
export const MODULE_KEY = "creative_design";
