import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { AuthzModule } from "../authz/authz.module.js";
import { PageInventoryModule } from "../page-inventory/page-inventory.module.js";
import { ProjectsModule } from "../projects/projects.module.js";
import { keywordAndEntityLibraryRepositoryProviders } from "./database.providers.js";
import { KeywordsService } from "./keywords.service.js";
import { KeywordsController } from "./keywords.controller.js";
import { EntitiesService } from "./entities.service.js";
import { EntitiesController } from "./entities.controller.js";
import { KeywordEntityRelationshipsService } from "./keyword-entity-relationships.service.js";
import { KeywordEntityRelationshipsController } from "./keyword-entity-relationships.controller.js";
import { PageKeywordAssignmentsService } from "./page-keyword-assignments.service.js";
import { PageKeywordAssignmentsController } from "./page-keyword-assignments.controller.js";

/**
 * The Keyword & Entity Library module (module #8,
 * `docs/task-packages/module-keyword-and-entity-library.md`) — the 8th real business module built
 * on the Phase 1F application shell / canonical module registry. Project-scoped (task package D2),
 * same shape as Page Inventory. Imports `AuthModule` for `SessionGuard`/`OriginCheckGuard`,
 * `AuthzModule` for `PermissionGuard`/`AuthorizationService` (the dynamic per-transition
 * permission check in `KeywordsService.changeApprovalStatus()`), `AuditModule` for `AuditService`
 * (every create/update/delete/status-transition across all four entities is audited),
 * `ProjectsModule` for its exported `ProjectService` (validating a keyword's/entity's `projectId`
 * actually exists, a clean 404 rather than a raw FK-violation 500), and `PageInventoryModule` for
 * its exported `PagesService` (`existsInProject()` — a narrow, read-only delegating method, not
 * the write-capable `PAGE_REPOSITORY` token directly — validates a `page_keyword_assignments`
 * `pageId`, task package D1/D10). No `AuthorizationService.canViewConfidential()` usage — no
 * confidential-field mechanism exists here (task package D4): the module registry's own seeded
 * `confidentialityLevel` for `keyword_and_entity_library` describes the approval workflow, not an
 * access-control tier, matching Persona Library's/Proof and Claims Library's own identical
 * precedent.
 */
@Module({
  imports: [AuthModule, AuthzModule, AuditModule, ProjectsModule, PageInventoryModule],
  controllers: [
    KeywordsController,
    EntitiesController,
    KeywordEntityRelationshipsController,
    PageKeywordAssignmentsController,
  ],
  providers: [
    ...keywordAndEntityLibraryRepositoryProviders,
    KeywordsService,
    EntitiesService,
    KeywordEntityRelationshipsService,
    PageKeywordAssignmentsService,
  ],
  exports: [KeywordsService, EntitiesService],
})
export class KeywordAndEntityLibraryModule {}
