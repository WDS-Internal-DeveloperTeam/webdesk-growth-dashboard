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
import type { EntityRecordEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import {
  createEntitySchema,
  listEntitiesQuerySchema,
  updateEntitySchema,
  type CreateEntityDto,
  type ListEntitiesQueryDto,
  type UpdateEntityDto,
} from "./keyword-and-entity-library.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { EntitiesService } from "./entities.service.js";

type KeywordLibraryRequest = AuthenticatedRequest & RequestWithCorrelationId;

const MODULE_KEY = "keyword_internal_links";

/** `@RequirePermission` is placed on every individual method, never at class level — same
 *  discipline as `KeywordsController`. `:projectId` is a real route path parameter, mirroring
 *  `KeywordsController`'s own shape. */
@ApiTags("keyword-and-entity-library")
@Controller("keyword-and-entity-library/projects/:projectId/entities")
@UseGuards(SessionGuard)
export class EntitiesController {
  constructor(private readonly entities: EntitiesService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "List entities for a project, optionally filtered" })
  async list(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Query(new ZodValidationPipe(listEntitiesQuerySchema)) query: ListEntitiesQueryDto,
    @Req() req: KeywordLibraryRequest,
  ): Promise<ApiSuccessResponse<readonly EntityRecordEntity[]>> {
    const data = await this.entities.list(projectId, query);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":id")
  @UseGuards(PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "Get one entity" })
  async findOne(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: KeywordLibraryRequest,
  ): Promise<ApiSuccessResponse<EntityRecordEntity>> {
    const data = await this.entities.findById(id, projectId);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "create")
  @ApiOperation({ summary: "Create an entity" })
  async create(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Body(new ZodValidationPipe(createEntitySchema)) body: CreateEntityDto,
    @Req() req: KeywordLibraryRequest,
  ): Promise<ApiSuccessResponse<EntityRecordEntity>> {
    const data = await this.entities.create(projectId, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/update")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "edit")
  @ApiOperation({ summary: "Edit an entity" })
  async update(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updateEntitySchema)) body: UpdateEntityDto,
    @Req() req: KeywordLibraryRequest,
  ): Promise<ApiSuccessResponse<EntityRecordEntity>> {
    const data = await this.entities.update(id, projectId, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/delete")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "edit")
  @ApiOperation({ summary: "Remove an entity" })
  async remove(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: KeywordLibraryRequest,
  ): Promise<void> {
    await this.entities.remove(id, projectId, req.authUser!.id);
  }
}
