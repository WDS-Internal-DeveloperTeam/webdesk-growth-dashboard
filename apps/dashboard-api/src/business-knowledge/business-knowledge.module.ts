import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { AuthzModule } from "../authz/authz.module.js";
import { businessKnowledgeRepositoryProviders } from "./database.providers.js";
import { BusinessKnowledgeRecordsService } from "./business-knowledge-records.service.js";
import { BusinessKnowledgeRecordsController } from "./business-knowledge-records.controller.js";
import { BusinessKnowledgeAttachmentsService } from "./business-knowledge-attachments.service.js";
import { BusinessKnowledgeAttachmentsController } from "./business-knowledge-attachments.controller.js";

/**
 * The Business Knowledge Center module
 * (`docs/task-packages/module-business-knowledge-center.md`,
 * `docs/task-packages/business-knowledge-center-rich-content-attachments.md`) — the second real
 * business module built on the Phase 1F application shell / canonical module registry, after
 * Projects. Imports `AuthModule` for `SessionGuard`/`OriginCheckGuard`, `AuthzModule` for
 * `PermissionGuard`, and `AuditModule` for `AuditService` (status transitions and attachment
 * upload/delete are all audited).
 */
@Module({
  imports: [AuthModule, AuthzModule, AuditModule],
  controllers: [BusinessKnowledgeRecordsController, BusinessKnowledgeAttachmentsController],
  providers: [
    ...businessKnowledgeRepositoryProviders,
    BusinessKnowledgeRecordsService,
    BusinessKnowledgeAttachmentsService,
  ],
  exports: [BusinessKnowledgeRecordsService],
})
export class BusinessKnowledgeModule {}
