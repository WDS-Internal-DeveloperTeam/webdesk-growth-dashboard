import { Module } from "@nestjs/common";
import { AuthEventRepository, UserRepository } from "@webdesk/database";
import { AuthModule } from "../auth/auth.module.js";
import { AUTH_EVENT_REPOSITORY, USER_REPOSITORY } from "../auth/config/auth.constants.js";
import { authzRepositoryProviders } from "./database.providers.js";
import { PermissionService } from "./permission.service.js";
import { PermissionGuard } from "./permission.guard.js";
import { RoleAssignmentService } from "./role-assignment.service.js";
import { RoleAssignmentController } from "./role-assignment.controller.js";

/**
 * Phase 1D — RBAC (docs/task-packages/phase-1d-rbac-authorization.md).
 * Imports `AuthModule` (never the reverse, see its own doc comment) for
 * `SessionGuard`/`SessionService`. Re-declares its own providers for the
 * `USER_REPOSITORY`/`AUTH_EVENT_REPOSITORY` tokens rather than importing
 * `AuthModule`'s provider array — those repositories have no constructor
 * dependencies, so a second registration against the same DI token is
 * simpler and safer than NestJS's cross-module provider-export mechanics.
 */
@Module({
  imports: [AuthModule],
  controllers: [RoleAssignmentController],
  providers: [
    ...authzRepositoryProviders,
    { provide: USER_REPOSITORY, useFactory: () => new UserRepository() },
    { provide: AUTH_EVENT_REPOSITORY, useFactory: () => new AuthEventRepository() },
    PermissionService,
    PermissionGuard,
    RoleAssignmentService,
  ],
  exports: [PermissionService, PermissionGuard],
})
export class AuthzModule {}
