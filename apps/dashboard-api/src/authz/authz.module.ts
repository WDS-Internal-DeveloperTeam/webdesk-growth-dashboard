import { Module } from "@nestjs/common";
import { AuthEventRepository, UserRepository } from "@webdesk/database";
import { AuditModule } from "../audit/audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { AUTH_EVENT_REPOSITORY, USER_REPOSITORY } from "../auth/config/auth.constants.js";
import { authzRepositoryProviders } from "./database.providers.js";
import { AuthorizationService } from "./authorization.service.js";
import { PermissionGuard } from "./permission.guard.js";
import { RoleAssignmentService } from "./role-assignment.service.js";
import { RoleAssignmentController } from "./role-assignment.controller.js";
import { CapabilitiesController } from "./capabilities.controller.js";
import { CatalogService } from "./catalog.service.js";
import { CatalogController } from "./catalog.controller.js";

/**
 * Phase 1D — RBAC (docs/task-packages/phase-1d-rbac-authorization.md,
 * expanded by docs/task-packages/phase-1d-rbac-permissions-expanded.md).
 * Imports `AuthModule` (never the reverse, see its own doc comment) for
 * `SessionGuard`/`SessionService`. Re-declares its own providers for the
 * `USER_REPOSITORY`/`AUTH_EVENT_REPOSITORY` tokens rather than importing
 * `AuthModule`'s provider array — those repositories have no constructor
 * dependencies, so a second registration against the same DI token is
 * simpler and safer than NestJS's cross-module provider-export mechanics.
 * Also imports `AuditModule` (Phase 1E) directly — `AuditModule` has no
 * dependency on either `AuthModule` or `AuthzModule`, so both can import it
 * without any circularity, same as `AuthModule` already does.
 */
@Module({
  imports: [AuthModule, AuditModule],
  controllers: [RoleAssignmentController, CapabilitiesController, CatalogController],
  providers: [
    ...authzRepositoryProviders,
    { provide: USER_REPOSITORY, useFactory: () => new UserRepository() },
    { provide: AUTH_EVENT_REPOSITORY, useFactory: () => new AuthEventRepository() },
    AuthorizationService,
    PermissionGuard,
    RoleAssignmentService,
    CatalogService,
  ],
  exports: [AuthorizationService, PermissionGuard],
})
export class AuthzModule {}
