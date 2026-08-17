import { Module } from "@nestjs/common";
import { UserRepository } from "@webdesk/database";
import { AuthModule } from "../auth/auth.module.js";
import { AuthzModule } from "../authz/authz.module.js";
import { USER_REPOSITORY } from "../auth/config/auth.constants.js";
import { UsersController } from "./users.controller.js";
import { UsersService } from "./users.service.js";

/**
 * The minimal, read-only user-lookup capability that unblocks the Projects module's owner/team/
 * approver picker UIs (`CLAUDE.md`'s "Remaining Projects module gaps" entry, 2026-08-17) —
 * explicitly not Task 8's user-management CRUD (`auth/auth.module.ts`'s own doc comment) and not
 * module #39 (Users/Roles/Permissions) from the recommended roadmap. Imports `AuthModule` for
 * `SessionGuard` and `AuthzModule` for `PermissionGuard`, same as `ProjectsModule`. Provides its
 * own `USER_REPOSITORY` binding rather than importing it from `AuthModule` (which doesn't export
 * it) — the same "re-declare, don't cross-import" pattern `AuthModule` itself already uses for
 * `AUTHORIZATION_ACTION_REPOSITORY`.
 */
@Module({
  imports: [AuthModule, AuthzModule],
  controllers: [UsersController],
  providers: [{ provide: USER_REPOSITORY, useFactory: () => new UserRepository() }, UsersService],
})
export class UsersModule {}
