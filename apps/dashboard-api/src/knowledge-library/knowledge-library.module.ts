import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { AuthzModule } from "../authz/authz.module.js";
import { UsersModule } from "../users/users.module.js";
import { knowledgeLibraryRepositoryProviders } from "./database.providers.js";
import { KnowledgeLibraryRecordsService } from "./knowledge-library-records.service.js";
import { KnowledgeLibraryRecordsController } from "./knowledge-library-records.controller.js";

/**
 * The Knowledge Library module (`docs/implementation/module-knowledge-library.md`) — module #28,
 * reusing Business Knowledge Center's identical RBAC permission group (`business_knowledge`)
 * verbatim. Imports `AuthModule` for `SessionGuard`/`OriginCheckGuard`, `AuthzModule` for
 * `PermissionGuard`/`AuthorizationService` (confidential-field redaction, D1), `AuditModule` for
 * `AuditService`, and `UsersModule` for `UsersService.assertUserExists()` (`ownerUserId`'s
 * existence check, D6, mirroring `ProjectService.assertOwnerExists()`'s own pattern via the
 * shared `UsersService` helper).
 */
@Module({
  imports: [AuthModule, AuthzModule, AuditModule, UsersModule],
  controllers: [KnowledgeLibraryRecordsController],
  providers: [...knowledgeLibraryRepositoryProviders, KnowledgeLibraryRecordsService],
  exports: [KnowledgeLibraryRecordsService],
})
export class KnowledgeLibraryModule {}
