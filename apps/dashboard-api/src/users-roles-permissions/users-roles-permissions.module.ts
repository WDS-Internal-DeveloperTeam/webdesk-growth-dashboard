import { Module } from "@nestjs/common";
import { UserRepository } from "@webdesk/database";
import { AuditModule } from "../audit/audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { AuthzModule } from "../authz/authz.module.js";
import { USER_REPOSITORY } from "../auth/config/auth.constants.js";
import { authzRepositoryProviders } from "../authz/database.providers.js";
import { UsersDirectoryController } from "./users-directory.controller.js";
import { UsersDirectoryService } from "./users-directory.service.js";
import { PermissionMatrixController } from "./permission-matrix.controller.js";
import { PermissionMatrixService } from "./permission-matrix.service.js";

/**
 * Module registry key `users_roles_permissions` — the "Users, Roles and Permissions" admin
 * surface (module #39 on the recommended roadmap), built directly on top of the already-built
 * RBAC core (Phase 1D: roles table, `role_permissions` matrix, `user_roles` assignments,
 * `PermissionGuard`/`AuthorizationService`), not a redesign of it. Two independent surfaces: a
 * real user directory (list/search every user regardless of status, view a user's full detail,
 * activate/deactivate) and a read-only global permission-matrix viewer.
 *
 * Imports `AuthModule` for `SessionGuard`/`SessionService`, `AuthzModule` for `PermissionGuard`,
 * and `AuditModule` for `AuditService` — the same trio `AuthzModule` itself already imports
 * without circularity (see that module's own doc comment). Re-declares its own
 * `USER_REPOSITORY` binding and reuses the already-exported `authzRepositoryProviders` array
 * (`ROLE_REPOSITORY`/`MODULE_REPOSITORY`/`ROLE_PERMISSION_REPOSITORY`/`USER_ROLE_REPOSITORY`/
 * `MODULE_REGISTRY_REPOSITORY`/`AUTHORIZATION_ACTION_REPOSITORY`) rather than relying on
 * `AuthzModule`'s own `exports` array, which only exports `ROLE_REPOSITORY` among these tokens —
 * the same "re-declare, don't cross-import" pattern `AuthzModule`/`UsersModule` already use for
 * `USER_REPOSITORY`/`AUTH_EVENT_REPOSITORY`; every one of these repositories has no constructor
 * dependencies, so a second registration against the same DI token is simpler and safer than
 * widening `AuthzModule`'s own exports for a need only this module has.
 */
@Module({
  imports: [AuthModule, AuthzModule, AuditModule],
  controllers: [UsersDirectoryController, PermissionMatrixController],
  providers: [
    ...authzRepositoryProviders,
    { provide: USER_REPOSITORY, useFactory: () => new UserRepository() },
    UsersDirectoryService,
    PermissionMatrixService,
  ],
})
export class UsersRolesPermissionsModule {}
