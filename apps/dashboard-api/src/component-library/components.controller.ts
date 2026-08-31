import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { ComponentEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import { MODULE_KEY } from "./component-library.constants.js";
import {
  changeComponentApprovalStatusSchema,
  createComponentSchema,
  listComponentsQuerySchema,
  updateComponentSchema,
  type ChangeComponentApprovalStatusDto,
  type CreateComponentDto,
  type ListComponentsQueryDto,
  type UpdateComponentDto,
} from "./component-library.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { ComponentsService } from "./components.service.js";

type ComponentLibraryRequest = AuthenticatedRequest & RequestWithCorrelationId;

@ApiTags("component-library")
@Controller("component-library/components")
@UseGuards(SessionGuard)
export class ComponentsController {
  constructor(private readonly components: ComponentsService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "List components (current versions only)" })
  async list(
    @Query(new ZodValidationPipe(listComponentsQuerySchema))
    query: ListComponentsQueryDto,
    @Req() req: ComponentLibraryRequest,
  ): Promise<ApiSuccessResponse<readonly ComponentEntity[]>> {
    const data = await this.components.list(query);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":recordId")
  @UseGuards(PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "Get the current version of one component" })
  async findOne(
    @Param("recordId", new ParseUUIDPipe()) recordId: string,
    @Req() req: ComponentLibraryRequest,
  ): Promise<ApiSuccessResponse<ComponentEntity>> {
    const data = await this.components.findCurrent(recordId);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":recordId/versions")
  @UseGuards(PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "Get the full version history of one component" })
  async versions(
    @Param("recordId", new ParseUUIDPipe()) recordId: string,
    @Req() req: ComponentLibraryRequest,
  ): Promise<ApiSuccessResponse<readonly ComponentEntity[]>> {
    const data = await this.components.listVersions(recordId);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "create")
  @ApiOperation({ summary: "Create a component (always starts draft, version 1)" })
  async create(
    @Body(new ZodValidationPipe(createComponentSchema))
    body: CreateComponentDto,
    @Req() req: ComponentLibraryRequest,
  ): Promise<ApiSuccessResponse<ComponentEntity>> {
    const data = await this.components.create(body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":recordId/update")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "edit")
  @ApiOperation({
    summary:
      "Edit a component's fields — mutates the current version in place if it isn't approved " +
      "yet, otherwise creates a new draft version",
  })
  async update(
    @Param("recordId", new ParseUUIDPipe()) recordId: string,
    @Body(new ZodValidationPipe(updateComponentSchema))
    body: UpdateComponentDto,
    @Req() req: ComponentLibraryRequest,
  ): Promise<ApiSuccessResponse<ComponentEntity>> {
    const data = await this.components.update(recordId, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":recordId/status")
  @HttpCode(HttpStatus.OK)
  // No @RequirePermission("approve") here — the real gate varies per requested transition
  // (submit/review/approve) and is checked dynamically inside the service itself, the same
  // layered pattern design-tokens.controller.ts's/website-strategy-records.controller.ts's/
  // claims.controller.ts's/services.controller.ts's/personas.controller.ts's own status route
  // already established. PermissionGuard still runs (via @UseGuards below) checking only module
  // `view`, so a caller with no access to this module at all is still rejected at the route. A
  // successful "-> approved" transition additionally, atomically, supersedes the record's
  // previously-current-approved version, if one exists.
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "Transition a component's approval status" })
  async changeStatus(
    @Param("recordId", new ParseUUIDPipe()) recordId: string,
    @Body(new ZodValidationPipe(changeComponentApprovalStatusSchema))
    body: ChangeComponentApprovalStatusDto,
    @Req() req: ComponentLibraryRequest,
  ): Promise<ApiSuccessResponse<ComponentEntity>> {
    const data = await this.components.changeApprovalStatus(
      recordId,
      body.approvalStatus,
      req.authUser!.id,
    );
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }
}
