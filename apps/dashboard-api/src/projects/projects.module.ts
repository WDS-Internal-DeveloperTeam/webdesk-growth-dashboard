import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { AuthzModule } from "../authz/authz.module.js";
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
 * delegating to `RoleAssignmentService` — security-review finding, this branch), and `AuditModule`
 * for `AuditService`.
 */
@Module({
  imports: [AuthModule, AuthzModule, AuditModule],
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
  exports: [ProjectService],
})
export class ProjectsModule {}
