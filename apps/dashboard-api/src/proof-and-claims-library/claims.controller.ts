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
import type { ProofClaimEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import {
  changeProofClaimApprovalStatusSchema,
  createProofClaimSchema,
  listProofClaimsQuerySchema,
  updateProofClaimSchema,
  type ChangeProofClaimApprovalStatusDto,
  type CreateProofClaimDto,
  type ListProofClaimsQueryDto,
  type UpdateProofClaimDto,
} from "./proof-and-claims-library.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { ClaimsService } from "./claims.service.js";

type ProofAndClaimsLibraryRequest = AuthenticatedRequest & RequestWithCorrelationId;

const MODULE_KEY = "service_persona_proof";

@ApiTags("proof-and-claims-library")
@Controller("proof-and-claims-library/claims")
@UseGuards(SessionGuard)
export class ClaimsController {
  constructor(private readonly claims: ClaimsService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "List proof claims, optionally filtered" })
  async list(
    @Query(new ZodValidationPipe(listProofClaimsQuerySchema)) query: ListProofClaimsQueryDto,
    @Req() req: ProofAndClaimsLibraryRequest,
  ): Promise<ApiSuccessResponse<readonly ProofClaimEntity[]>> {
    const data = await this.claims.list(query);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":id")
  @UseGuards(PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "Get one proof claim" })
  async findOne(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: ProofAndClaimsLibraryRequest,
  ): Promise<ApiSuccessResponse<ProofClaimEntity>> {
    const data = await this.claims.findById(id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "create")
  @ApiOperation({ summary: "Create a proof claim (always starts draft)" })
  async create(
    @Body(new ZodValidationPipe(createProofClaimSchema)) body: CreateProofClaimDto,
    @Req() req: ProofAndClaimsLibraryRequest,
  ): Promise<ApiSuccessResponse<ProofClaimEntity>> {
    const data = await this.claims.create(body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/update")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "edit")
  @ApiOperation({
    summary: "Edit a proof claim's content fields (never touches approvalStatus)",
  })
  async update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updateProofClaimSchema)) body: UpdateProofClaimDto,
    @Req() req: ProofAndClaimsLibraryRequest,
  ): Promise<ApiSuccessResponse<ProofClaimEntity>> {
    const data = await this.claims.update(id, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/status")
  @HttpCode(HttpStatus.OK)
  // No @RequirePermission("approve") here — the real gate varies per requested transition
  // (submit/review/approve) and is checked dynamically inside the service itself, the same
  // layered pattern services.controller.ts's/personas.controller.ts's own status route already
  // established. PermissionGuard still runs (via @UseGuards below) checking only module `view`,
  // so a caller with no access to this module at all is still rejected at the route.
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "Transition a proof claim's approval status" })
  async changeStatus(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(changeProofClaimApprovalStatusSchema))
    body: ChangeProofClaimApprovalStatusDto,
    @Req() req: ProofAndClaimsLibraryRequest,
  ): Promise<ApiSuccessResponse<ProofClaimEntity>> {
    const data = await this.claims.changeApprovalStatus(id, body.approvalStatus, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }
}
