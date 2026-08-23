/** NestJS DI tokens for the Keyword & Entity Library module — kept in one file, same pattern as
 *  ../page-inventory/page-inventory.constants.ts / ../proof-and-claims-library/proof-and-claims-library.constants.ts. */
export const KEYWORD_REPOSITORY = Symbol("KEYWORD_REPOSITORY");
export const ENTITY_REPOSITORY = Symbol("ENTITY_REPOSITORY");
export const KEYWORD_ENTITY_RELATIONSHIP_REPOSITORY = Symbol(
  "KEYWORD_ENTITY_RELATIONSHIP_REPOSITORY",
);
export const PAGE_KEYWORD_ASSIGNMENT_REPOSITORY = Symbol("PAGE_KEYWORD_ASSIGNMENT_REPOSITORY");
