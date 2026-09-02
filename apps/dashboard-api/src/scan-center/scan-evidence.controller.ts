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
import type { ScanEvidenceEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import {
  createScanEvidenceSchema,
  listScanEvidenceQuerySchema,
  type CreateScanEvidenceDto,
  type ListScanEvidenceQueryDto,
} from "./scan-center.dto.js";
import { SCAN_CENTER_MODULE_KEY } from "./scan-center.constants.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { ScanEvidenceService } from "./scan-evidence.service.js";

type ScanCenterRequest = AuthenticatedRequest & RequestWithCorrelationId;

@ApiTags("scan-center")
@Controller("scan-center/projects/:projectId/findings/:findingId/evidence")
@UseGuards(SessionGuard)
export class ScanEvidenceController {
  constructor(private readonly evidence: ScanEvidenceService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(SCAN_CENTER_MODULE_KEY, "view")
  @ApiOperation({ summary: "List evidence attached to one scan finding" })
  async list(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("findingId", new ParseUUIDPipe()) findingId: string,
    @Query(new ZodValidationPipe(listScanEvidenceQuerySchema)) query: ListScanEvidenceQueryDto,
    @Req() req: ScanCenterRequest,
  ): Promise<ApiSuccessResponse<readonly ScanEvidenceEntity[]>> {
    const data = await this.evidence.list(projectId, findingId, query);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(SCAN_CENTER_MODULE_KEY, "create")
  @ApiOperation({ summary: "Attach a new piece of evidence to a scan finding" })
  async create(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("findingId", new ParseUUIDPipe()) findingId: string,
    @Body(new ZodValidationPipe(createScanEvidenceSchema)) body: CreateScanEvidenceDto,
    @Req() req: ScanCenterRequest,
  ): Promise<ApiSuccessResponse<ScanEvidenceEntity>> {
    const data = await this.evidence.create(projectId, findingId, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }
}
