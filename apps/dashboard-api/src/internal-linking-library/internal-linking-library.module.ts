import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { AuthzModule } from "../authz/authz.module.js";
import { PageInventoryModule } from "../page-inventory/page-inventory.module.js";
import { ProjectsModule } from "../projects/projects.module.js";
import { UsersModule } from "../users/users.module.js";
import { internalLinkingLibraryRepositoryProviders } from "./database.providers.js";
import { InternalLinksService } from "./internal-links.service.js";
import { InternalLinksController } from "./internal-links.controller.js";

/**
 * The Internal Linking Library module (module #9,
 * `docs/task-packages/module-internal-linking-library.md`) — the 9th real business module built
 * on the Phase 1F application shell / canonical module registry. Project-scoped (task package D3),
 * same shape as Page Inventory/Keyword & Entity Library. Imports `AuthModule` for
 * `SessionGuard`/`OriginCheckGuard`, `AuthzModule` for `PermissionGuard`/`AuthorizationService`
 * (the dynamic per-transition permission check in `InternalLinksService.changeStatus()`),
 * `AuditModule` for `AuditService` (every create/update/status-transition is audited),
 * `ProjectsModule` for its exported `ProjectService` (validating a link's `projectId` actually
 * exists, a clean 404 rather than a raw FK-violation 500), `PageInventoryModule` for its exported
 * `PagesService` (`existsInProject()` — a narrow, read-only delegating method, not the
 * write-capable `PAGE_REPOSITORY` token directly — validates `sourcePageId`/`targetPageId`, task
 * package D4), and `UsersModule` for its exported `UsersService`
 * (`assignedApproverUserId` existence validation, task package D7, mirroring
 * `ProjectService.assertOwnerExists()`'s own precedent). No `AuthorizationService.canViewConfidential()`
 * usage — no confidential-field mechanism exists here (task package D9): the module registry's own
 * seeded `confidentialityLevel` for `internal_linking_library` is `null`, matching Persona
 * Library's/Proof and Claims Library's/Keyword & Entity Library's own identical precedent.
 */
@Module({
  imports: [AuthModule, AuthzModule, AuditModule, ProjectsModule, PageInventoryModule, UsersModule],
  controllers: [InternalLinksController],
  providers: [...internalLinkingLibraryRepositoryProviders, InternalLinksService],
  exports: [InternalLinksService],
})
export class InternalLinkingLibraryModule {}
