import type { Provider } from "@nestjs/common";
import {
  EntityRepository,
  KeywordEntityRelationshipRepository,
  KeywordRepository,
  PageKeywordAssignmentRepository,
} from "@webdesk/database";
import {
  ENTITY_REPOSITORY,
  KEYWORD_ENTITY_RELATIONSHIP_REPOSITORY,
  KEYWORD_REPOSITORY,
  PAGE_KEYWORD_ASSIGNMENT_REPOSITORY,
} from "./keyword-and-entity-library.constants.js";

/** DI wiring — same `useFactory` pattern as ../page-inventory/database.providers.ts. */
export const keywordAndEntityLibraryRepositoryProviders: Provider[] = [
  { provide: KEYWORD_REPOSITORY, useFactory: () => new KeywordRepository() },
  { provide: ENTITY_REPOSITORY, useFactory: () => new EntityRepository() },
  {
    provide: KEYWORD_ENTITY_RELATIONSHIP_REPOSITORY,
    useFactory: () => new KeywordEntityRelationshipRepository(),
  },
  {
    provide: PAGE_KEYWORD_ASSIGNMENT_REPOSITORY,
    useFactory: () => new PageKeywordAssignmentRepository(),
  },
];
