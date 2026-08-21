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
import type { ServiceEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import {
  changeServiceApprovalStatusSchema,
  createServiceSchema,
  listServicesQuerySchema,
  updateServiceSchema,
  type ChangeServiceApprovalStatusDto,
  type CreateServiceDto,
  type ListServicesQueryDto,
  type UpdateServiceDto,
} from "./service-library.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { ServicesService } from "./services.service.js";

type ServiceLibraryRequest = AuthenticatedRequest & RequestWithCorrelationId;

const MODULE_KEY = "service_persona_proof";

@ApiTags("service-library")
@Controller("service-library/services")
@UseGuards(SessionGuard)
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "List services, optionally filtered" })
  async list(
    @Query(new ZodValidationPipe(listServicesQuerySchema)) query: ListServicesQueryDto,
    @Req() req: ServiceLibraryRequest,
  ): Promise<ApiSuccessResponse<readonly ServiceEntity[]>> {
    const data = await this.services.list(query);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":id")
  @UseGuards(PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "Get one service" })
  async findOne(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: ServiceLibraryRequest,
  ): Promise<ApiSuccessResponse<ServiceEntity>> {
    const data = await this.services.findById(id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "create")
  @ApiOperation({ summary: "Create a service (always starts draft/draft)" })
  async create(
    @Body(new ZodValidationPipe(createServiceSchema)) body: CreateServiceDto,
    @Req() req: ServiceLibraryRequest,
  ): Promise<ApiSuccessResponse<ServiceEntity>> {
    const data = await this.services.create(body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/update")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "edit")
  @ApiOperation({ summary: "Edit a service's content/relationship/publication fields" })
  async update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updateServiceSchema)) body: UpdateServiceDto,
    @Req() req: ServiceLibraryRequest,
  ): Promise<ApiSuccessResponse<ServiceEntity>> {
    const data = await this.services.update(id, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/status")
  @HttpCode(HttpStatus.OK)
  // No @RequirePermission("approve") here — the real gate varies per requested transition
  // (submit/review/approve, task package D5) and is checked dynamically inside the service
  // itself, the same layered pattern project-approvers.service.ts's assign() already
  // established. PermissionGuard still runs (via @UseGuards below) checking only module `view`,
  // so a caller with no access to this module at all is still rejected at the route.
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "Transition a service's approval status" })
  async changeStatus(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(changeServiceApprovalStatusSchema))
    body: ChangeServiceApprovalStatusDto,
    @Req() req: ServiceLibraryRequest,
  ): Promise<ApiSuccessResponse<ServiceEntity>> {
    const data = await this.services.changeApprovalStatus(
      id,
      body.approvalStatus,
      req.authUser!.id,
    );
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }
}
