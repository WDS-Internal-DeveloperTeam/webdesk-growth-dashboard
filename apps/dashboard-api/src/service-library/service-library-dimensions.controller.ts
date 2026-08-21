import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type {
  DeliverableEntity,
  EngagementModelEntity,
  PlatformTechnologyEntity,
  ServiceCategoryEntity,
} from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { ServiceLibraryDimensionsService } from "./service-library-dimensions.service.js";

type ServiceLibraryRequest = AuthenticatedRequest & RequestWithCorrelationId;

const MODULE_KEY = "service_persona_proof";

/** Read-only list routes for the four dimension tables — categories, deliverables, platforms, and
 *  engagement models (task package §7). Authoring them is deferred. */
@ApiTags("service-library")
@Controller("service-library")
@UseGuards(SessionGuard, PermissionGuard)
export class ServiceLibraryDimensionsController {
  constructor(private readonly dimensions: ServiceLibraryDimensionsService) {}

  @Get("categories")
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "List service categories" })
  async listCategories(
    @Req() req: ServiceLibraryRequest,
  ): Promise<ApiSuccessResponse<readonly ServiceCategoryEntity[]>> {
    const data = await this.dimensions.listCategories();
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get("deliverables")
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "List deliverables" })
  async listDeliverables(
    @Req() req: ServiceLibraryRequest,
  ): Promise<ApiSuccessResponse<readonly DeliverableEntity[]>> {
    const data = await this.dimensions.listDeliverables();
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get("platforms")
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "List platforms/technologies" })
  async listPlatforms(
    @Req() req: ServiceLibraryRequest,
  ): Promise<ApiSuccessResponse<readonly PlatformTechnologyEntity[]>> {
    const data = await this.dimensions.listPlatforms();
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get("engagement-models")
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "List engagement models" })
  async listEngagementModels(
    @Req() req: ServiceLibraryRequest,
  ): Promise<ApiSuccessResponse<readonly EngagementModelEntity[]>> {
    const data = await this.dimensions.listEngagementModels();
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }
}
