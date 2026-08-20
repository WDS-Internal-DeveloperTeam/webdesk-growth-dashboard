import type { Provider } from "@nestjs/common";
import { BusinessKnowledgeRecordRepository } from "@webdesk/database";
import { BUSINESS_KNOWLEDGE_RECORD_REPOSITORY } from "./business-knowledge.constants.js";

/** DI wiring — same `useFactory` pattern as ../projects/database.providers.ts. */
export const businessKnowledgeRepositoryProviders: Provider[] = [
  {
    provide: BUSINESS_KNOWLEDGE_RECORD_REPOSITORY,
    useFactory: () => new BusinessKnowledgeRecordRepository(),
  },
];
