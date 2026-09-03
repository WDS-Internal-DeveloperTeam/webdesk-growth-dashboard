import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import { USERS_ROLES_PERMISSIONS_MODULE_KEY } from "./users-roles-permissions.constants.js";
import type { PermissionMatrix } from "./permission-matrix.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime, see google-auth.service.ts's note.
import { PermissionMatrixService } from "./permission-matrix.service.js";

type UsersRolesPermissionsRequest = AuthenticatedRequest & RequestWithCorrelationId;

/** Read-only global permission-matrix viewer — see `PermissionMatrixService`'s own doc comment. */
@ApiTags("users-roles-permissions")
@Controller("users-roles-and-permissions")
@UseGuards(SessionGuard)
export class PermissionMatrixController {
  constructor(private readonly permissionMatrix: PermissionMatrixService) {}

  @Get("matrix")
  @UseGuards(PermissionGuard)
  @RequirePermission(USERS_ROLES_PERMISSIONS_MODULE_KEY, "view")
  @ApiOperation({
    summary: "Read-only roles × modules × actions permission matrix (global scope only)",
  })
  async getMatrix(
    @Req() req: UsersRolesPermissionsRequest,
  ): Promise<ApiSuccessResponse<PermissionMatrix>> {
    const data = await this.permissionMatrix.getMatrix();
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }
}
