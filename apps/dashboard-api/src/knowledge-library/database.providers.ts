import type { Provider } from "@nestjs/common";
import { KnowledgeLibraryRecordRepository } from "@webdesk/database";
import { KNOWLEDGE_LIBRARY_RECORD_REPOSITORY } from "./knowledge-library.constants.js";

/** DI wiring — same `useFactory` pattern as ../business-knowledge/database.providers.ts. */
export const knowledgeLibraryRepositoryProviders: Provider[] = [
  {
    provide: KNOWLEDGE_LIBRARY_RECORD_REPOSITORY,
    useFactory: () => new KnowledgeLibraryRecordRepository(),
  },
];
