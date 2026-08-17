import { Controller, Get, Param, Query, Req, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import { searchUsersQuerySchema, type SearchUsersQueryDto } from "./users.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { UsersService, type UserSummary } from "./users.service.js";

type UsersRequest = AuthenticatedRequest & RequestWithCorrelationId;

/**
 * Read-only user identity lookup for picker UIs — not a general Users/Roles/Permissions admin
 * surface (module #39 on the recommended roadmap remains its own, separate, not-yet-authorized
 * scope). Gated on `users_roles:view`, the same grant that already lets `super_admin`/
 * `owner_growth_approver` view role assignments (`role-assignment.controller.ts`) — the only two
 * roles that can ever reach a project owner/team/approver picker in the first place, since every
 * other role is view-only on `project_configuration`.
 */
@ApiTags("users")
@Controller("users")
@UseGuards(SessionGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission("users_roles", "view")
  @ApiOperation({ summary: "Search active users by name or email" })
  async search(
    @Query(new ZodValidationPipe(searchUsersQuerySchema)) query: SearchUsersQueryDto,
    @Req() req: UsersRequest,
  ): Promise<ApiSuccessResponse<readonly UserSummary[]>> {
    const data = await this.users.search(query);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":userId")
  @UseGuards(PermissionGuard)
  @RequirePermission("users_roles", "view")
  @ApiOperation({ summary: "Resolve a single active user id to a display summary" })
  async getById(
    @Param("userId") userId: string,
    @Req() req: UsersRequest,
  ): Promise<ApiSuccessResponse<UserSummary>> {
    const data = await this.users.findById(userId);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }
}
