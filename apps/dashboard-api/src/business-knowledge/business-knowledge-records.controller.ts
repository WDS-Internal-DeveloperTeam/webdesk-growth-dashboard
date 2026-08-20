import {
  Body,
  Controller,
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
import type { BusinessKnowledgeRecordEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import {
  changeBusinessKnowledgeRecordStatusSchema,
  createBusinessKnowledgeRecordSchema,
  listBusinessKnowledgeRecordsQuerySchema,
  updateBusinessKnowledgeRecordSchema,
  type ChangeBusinessKnowledgeRecordStatusDto,
  type CreateBusinessKnowledgeRecordDto,
  type ListBusinessKnowledgeRecordsQueryDto,
  type UpdateBusinessKnowledgeRecordDto,
} from "./business-knowledge.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { BusinessKnowledgeRecordsService } from "./business-knowledge-records.service.js";

type BusinessKnowledgeRequest = AuthenticatedRequest & RequestWithCorrelationId;

// The RBAC permission-group key ("business_knowledge", 00013-seed-rbac-matrix.ts), not the
// module-registry navigation key ("business_knowledge_center") — same distinction
// projects.controller.ts draws between "project_configuration" and "projects" (task package §0).
const MODULE_KEY = "business_knowledge";

@ApiTags("business-knowledge")
@Controller("business-knowledge/records")
@UseGuards(SessionGuard)
export class BusinessKnowledgeRecordsController {
  constructor(private readonly records: BusinessKnowledgeRecordsService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "List business knowledge records, optionally filtered" })
  async list(
    @Query(new ZodValidationPipe(listBusinessKnowledgeRecordsQuerySchema))
    query: ListBusinessKnowledgeRecordsQueryDto,
    @Req() req: BusinessKnowledgeRequest,
  ): Promise<ApiSuccessResponse<readonly BusinessKnowledgeRecordEntity[]>> {
    const data = await this.records.list(query);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":id")
  @UseGuards(PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "Get one business knowledge record" })
  async findOne(
    @Param("id") id: string,
    @Req() req: BusinessKnowledgeRequest,
  ): Promise<ApiSuccessResponse<BusinessKnowledgeRecordEntity>> {
    const data = await this.records.findById(id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "create")
  @ApiOperation({ summary: "Create a business knowledge record (always starts as draft)" })
  async create(
    @Body(new ZodValidationPipe(createBusinessKnowledgeRecordSchema))
    body: CreateBusinessKnowledgeRecordDto,
    @Req() req: BusinessKnowledgeRequest,
  ): Promise<ApiSuccessResponse<BusinessKnowledgeRecordEntity>> {
    const data = await this.records.create(body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/update")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "edit")
  @ApiOperation({ summary: "Edit a business knowledge record's title/content/notes" })
  async update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateBusinessKnowledgeRecordSchema))
    body: UpdateBusinessKnowledgeRecordDto,
    @Req() req: BusinessKnowledgeRequest,
  ): Promise<ApiSuccessResponse<BusinessKnowledgeRecordEntity>> {
    const data = await this.records.update(id, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/status")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "approve")
  @ApiOperation({ summary: "Transition a business knowledge record's status" })
  async changeStatus(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(changeBusinessKnowledgeRecordStatusSchema))
    body: ChangeBusinessKnowledgeRecordStatusDto,
    @Req() req: BusinessKnowledgeRequest,
  ): Promise<ApiSuccessResponse<BusinessKnowledgeRecordEntity>> {
    const data = await this.records.changeStatus(id, body.status, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }
}
