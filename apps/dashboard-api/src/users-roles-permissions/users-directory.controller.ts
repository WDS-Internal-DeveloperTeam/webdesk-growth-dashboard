import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { UserEntity } from "@webdesk/database";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import { USERS_ROLES_PERMISSIONS_MODULE_KEY } from "./users-roles-permissions.constants.js";
import {
  listUsersQuerySchema,
  updateUserStatusSchema,
  type ListUsersQueryDto,
  type UpdateUserStatusDto,
} from "./users-roles-permissions.dto.js";
import type { UserDetail } from "./users-directory.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime, see google-auth.service.ts's note.
import { UsersDirectoryService } from "./users-directory.service.js";

type UsersRolesPermissionsRequest = AuthenticatedRequest & RequestWithCorrelationId;

/**
 * The "Users, Roles and Permissions" module's user-directory admin surface — gated by the same
 * `users_roles` RBAC group `role-assignment.controller.ts`/`users.controller.ts` already gate on.
 * Per-method `@RequirePermission`, never class-level (`PermissionGuard` only reads
 * `context.getHandler()`, a real bug class this project has hit and fixed twice already).
 */
@ApiTags("users-roles-permissions")
@Controller("users-roles-and-permissions")
@UseGuards(SessionGuard)
export class UsersDirectoryController {
  constructor(private readonly usersDirectory: UsersDirectoryService) {}

  @Get("users")
  @UseGuards(PermissionGuard)
  @RequirePermission(USERS_ROLES_PERMISSIONS_MODULE_KEY, "view")
  @ApiOperation({ summary: "List/search every user, regardless of status" })
  async listUsers(
    @Query(new ZodValidationPipe(listUsersQuerySchema)) query: ListUsersQueryDto,
    @Req() req: UsersRolesPermissionsRequest,
  ): Promise<ApiSuccessResponse<{ rows: readonly UserEntity[]; total: number }>> {
    const data = await this.usersDirectory.listUsers(query);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get("users/:userId")
  @UseGuards(PermissionGuard)
  @RequirePermission(USERS_ROLES_PERMISSIONS_MODULE_KEY, "view")
  @ApiOperation({
    summary: "Get a single user's full detail — every role assignment, global and project-scoped",
  })
  async getUserDetail(
    @Param("userId") userId: string,
    @Req() req: UsersRolesPermissionsRequest,
  ): Promise<ApiSuccessResponse<UserDetail>> {
    const detail = await this.usersDirectory.getUserDetail(userId);
    if (!detail) {
      throw new NotFoundException(`User not found: ${userId}`);
    }
    return { success: true, data: detail, correlationId: req.correlationId ?? "unknown" };
  }

  @Post("users/:userId/status")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(USERS_ROLES_PERMISSIONS_MODULE_KEY, "edit")
  @ApiOperation({
    summary:
      "Activate or deactivate a user — deactivating revokes all of the user's existing sessions. " +
      "An actor may never deactivate their own account.",
  })
  async updateStatus(
    @Param("userId") userId: string,
    @Body(new ZodValidationPipe(updateUserStatusSchema)) body: UpdateUserStatusDto,
    @Req() req: UsersRolesPermissionsRequest,
  ): Promise<ApiSuccessResponse<UserEntity>> {
    const updated = await this.usersDirectory.updateStatus(userId, body.status, req.authUser!.id);
    return { success: true, data: updated, correlationId: req.correlationId ?? "unknown" };
  }
}
