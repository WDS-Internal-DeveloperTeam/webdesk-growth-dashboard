import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { ApiSuccessResponse, RoleSummary } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { assignRoleSchema, type AssignRoleDto } from "./authz.dto.js";
import { PermissionGuard } from "./permission.guard.js";
import { RequirePermission } from "./require-permission.decorator.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime, see google-auth.service.ts's note.
import { RoleAssignmentService } from "./role-assignment.service.js";

type AuthzRequest = AuthenticatedRequest & RequestWithCorrelationId;

function toSummary(role: { id: string; key: string; name: string }): RoleSummary {
  return { id: role.id, key: role.key, name: role.name };
}

/**
 * The "Users/roles" row of `06_Roles_and_Permissions.md §3`'s own matrix —
 * every route here is gated by `PermissionGuard` against that same seeded
 * matrix (Super Admin: full; Owner/Growth Approver: limited; every other
 * role: none), not a special-cased admin bypass.
 */
@ApiTags("authz")
@Controller("authz")
@UseGuards(SessionGuard)
export class RoleAssignmentController {
  constructor(private readonly roleAssignment: RoleAssignmentService) {}

  @Get("roles")
  @UseGuards(PermissionGuard)
  @RequirePermission("users_roles", "view")
  @ApiOperation({ summary: "List the 7 seeded roles" })
  async listRoles(@Req() req: AuthzRequest): Promise<ApiSuccessResponse<readonly RoleSummary[]>> {
    const roles = await this.roleAssignment.listRoles();
    return {
      success: true,
      data: roles.map(toSummary),
      correlationId: req.correlationId ?? "unknown",
    };
  }

  @Get("users/:userId/roles")
  @UseGuards(PermissionGuard)
  @RequirePermission("users_roles", "view")
  @ApiOperation({ summary: "List a user's assigned roles" })
  async listUserRoles(
    @Param("userId") userId: string,
    @Req() req: AuthzRequest,
  ): Promise<ApiSuccessResponse<readonly RoleSummary[]>> {
    const roles = await this.roleAssignment.listRolesForUser(userId);
    return {
      success: true,
      data: roles.map(toSummary),
      correlationId: req.correlationId ?? "unknown",
    };
  }

  @Post("users/:userId/roles")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission("users_roles", "edit")
  @ApiOperation({ summary: "Assign a role to a user — revokes the user's existing sessions" })
  async assignRole(
    @Param("userId") userId: string,
    @Body(new ZodValidationPipe(assignRoleSchema)) body: AssignRoleDto,
    @Req() req: AuthzRequest,
  ): Promise<ApiSuccessResponse<{ assigned: true }>> {
    await this.roleAssignment.assignRole(userId, body.roleId, req.authUser!.id);
    return {
      success: true,
      data: { assigned: true },
      correlationId: req.correlationId ?? "unknown",
    };
  }

  @Delete("users/:userId/roles/:roleId")
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission("users_roles", "edit")
  @ApiOperation({
    summary:
      "Revoke a role from a user — revokes the user's existing sessions if it was actually held. " +
      "Pass ?projectId= to target a project-scoped grant; omitting it only matches a global-scope one.",
  })
  async revokeRole(
    @Param("userId") userId: string,
    @Param("roleId") roleId: string,
    @Query("projectId") projectId: string | undefined,
    @Req() req: AuthzRequest,
  ): Promise<ApiSuccessResponse<{ revoked: boolean }>> {
    // `revokeRole()` matches on the exact (userId, roleId, projectId) triple, so this
    // query param is required to reach a project-scoped grant — silently defaulting to
    // global scope would let a project-scoped grant survive an apparently-successful revoke
    // (security-review finding, this branch).
    const revoked = await this.roleAssignment.revokeRole(
      userId,
      roleId,
      req.authUser!.id,
      undefined,
      projectId ?? null,
    );
    return {
      success: true,
      data: { revoked },
      correlationId: req.correlationId ?? "unknown",
    };
  }
}
