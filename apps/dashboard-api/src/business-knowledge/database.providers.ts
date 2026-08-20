import type { Provider } from "@nestjs/common";
import {
  BusinessKnowledgeAttachmentRepository,
  BusinessKnowledgeRecordRepository,
} from "@webdesk/database";
import { VercelBlobAdapter } from "@webdesk/integrations";
import {
  BLOB_STORAGE_ADAPTER,
  BUSINESS_KNOWLEDGE_ATTACHMENT_REPOSITORY,
  BUSINESS_KNOWLEDGE_RECORD_REPOSITORY,
} from "./business-knowledge.constants.js";

/** DI wiring — same `useFactory` pattern as ../projects/database.providers.ts. */
export const businessKnowledgeRepositoryProviders: Provider[] = [
  {
    provide: BUSINESS_KNOWLEDGE_RECORD_REPOSITORY,
    useFactory: () => new BusinessKnowledgeRecordRepository(),
  },
  {
    provide: BUSINESS_KNOWLEDGE_ATTACHMENT_REPOSITORY,
    useFactory: () => new BusinessKnowledgeAttachmentRepository(),
  },
  {
    provide: BLOB_STORAGE_ADAPTER,
    useFactory: () => new VercelBlobAdapter(),
  },
];
