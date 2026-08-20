import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { AuthzModule } from "../authz/authz.module.js";
import { businessKnowledgeRepositoryProviders } from "./database.providers.js";
import { BusinessKnowledgeRecordsService } from "./business-knowledge-records.service.js";
import { BusinessKnowledgeRecordsController } from "./business-knowledge-records.controller.js";

/**
 * The Business Knowledge Center module
 * (`docs/task-packages/module-business-knowledge-center.md`) — the second real business module
 * built on the Phase 1F application shell / canonical module registry, after Projects. Imports
 * `AuthModule` for `SessionGuard`/`OriginCheckGuard`, `AuthzModule` for `PermissionGuard`, and
 * `AuditModule` for `AuditService` (status transitions are audited — task package §7).
 */
@Module({
  imports: [AuthModule, AuthzModule, AuditModule],
  controllers: [BusinessKnowledgeRecordsController],
  providers: [...businessKnowledgeRepositoryProviders, BusinessKnowledgeRecordsService],
  exports: [BusinessKnowledgeRecordsService],
})
export class BusinessKnowledgeModule {}
