import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type {
  ApiSuccessResponse,
  ModuleRegistrySummary,
  ModuleSummary,
} from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime, see google-auth.service.ts's note.
import { CatalogService } from "./catalog.service.js";
import { PermissionGuard } from "./permission.guard.js";
import { RequirePermission } from "./require-permission.decorator.js";

type CatalogRequest = AuthenticatedRequest & RequestWithCorrelationId;

/**
 * Read-only catalog endpoints for the "Users/roles" module (task package
 * §20's "/admin/permissions" endpoint category) — gated the same way as
 * `RoleAssignmentController`'s own routes, not a special-cased bypass.
 */
@ApiTags("authz")
@Controller("authz")
@UseGuards(SessionGuard)
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get("modules")
  @UseGuards(PermissionGuard)
  @RequirePermission("users_roles", "view")
  @ApiOperation({
    summary: "List the 21 permission-group modules the real seeded matrix grants against",
  })
  async listModules(
    @Req() req: CatalogRequest,
  ): Promise<ApiSuccessResponse<readonly ModuleSummary[]>> {
    const modules = await this.catalog.listPermissionGroups();
    return { success: true, data: modules, correlationId: req.correlationId ?? "unknown" };
  }

  @Get("module-registry")
  @UseGuards(PermissionGuard)
  @RequirePermission("users_roles", "view")
  @ApiOperation({
    summary: "List the 43 real dashboard modules, each mapped to its gating permission group",
  })
  async listModuleRegistry(
    @Req() req: CatalogRequest,
  ): Promise<ApiSuccessResponse<readonly ModuleRegistrySummary[]>> {
    const entries = await this.catalog.listModuleRegistry();
    return { success: true, data: entries, correlationId: req.correlationId ?? "unknown" };
  }
}
