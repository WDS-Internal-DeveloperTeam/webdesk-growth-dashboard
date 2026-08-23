import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { AuthzModule } from "../authz/authz.module.js";
import { UsersModule } from "../users/users.module.js";
import { projectsRepositoryProviders } from "./database.providers.js";
import { ProjectService } from "./project.service.js";
import { ProjectEnvironmentsService } from "./project-environments.service.js";
import { ProjectRepositoriesService } from "./project-repositories.service.js";
import { ProjectTeamService } from "./project-team.service.js";
import { ProjectObjectivesService } from "./project-objectives.service.js";
import { RoadmapItemsService } from "./roadmap-items.service.js";
import { ProjectApproversService } from "./project-approvers.service.js";
import { ProjectsController } from "./projects.controller.js";
import { ProjectEnvironmentsController } from "./project-environments.controller.js";
import { ProjectRepositoriesController } from "./project-repositories.controller.js";
import { ProjectTeamController } from "./project-team.controller.js";
import { ProjectObjectivesController } from "./project-objectives.controller.js";
import { RoadmapItemsController } from "./roadmap-items.controller.js";

/**
 * The Projects module (`docs/task-packages/module-projects-foundation.md`) — the first real
 * business module built on the Phase 1F application shell / canonical module registry. Imports
 * `AuthModule` for `SessionGuard`/`OriginCheckGuard`, `AuthzModule` for `PermissionGuard`,
 * `RoleAssignmentService` (project-scoped approver assignment, D4), and `AuthorizationService`
 * (the second, explicit `users_roles:edit` check `ProjectApproversService` performs before
 * delegating to `RoleAssignmentService` — security-review finding, this branch), `AuditModule`
 * for `AuditService`, and `UsersModule` for `UsersService` (resolving approver/owner user ids to
 * display summaries). Also exports `RoadmapItemsService` — the Page Inventory module
 * (`module-page-inventory`) is its first external consumer, via a narrow
 * `existsInProject()` read (mirrors `ServiceLibraryModule`'s own `ServicesService` export for the
 * identical "narrow read-only delegating method, not the raw repository token" reason).
 */
@Module({
  imports: [AuthModule, AuthzModule, AuditModule, UsersModule],
  controllers: [
    ProjectsController,
    ProjectEnvironmentsController,
    ProjectRepositoriesController,
    ProjectTeamController,
    ProjectObjectivesController,
    RoadmapItemsController,
  ],
  providers: [
    ...projectsRepositoryProviders,
    ProjectService,
    ProjectEnvironmentsService,
    ProjectRepositoriesService,
    ProjectTeamService,
    ProjectObjectivesService,
    RoadmapItemsService,
    ProjectApproversService,
  ],
  exports: [ProjectService, RoadmapItemsService],
})
export class ProjectsModule {}
