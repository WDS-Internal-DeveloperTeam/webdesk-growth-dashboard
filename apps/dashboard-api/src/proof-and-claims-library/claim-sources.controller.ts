import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { ClaimSourceEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import {
  createClaimSourceSchema,
  updateClaimSourceSchema,
  type CreateClaimSourceDto,
  type UpdateClaimSourceDto,
} from "./proof-and-claims-library.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { ClaimSourcesService } from "./claim-sources.service.js";

type ProofAndClaimsLibraryRequest = AuthenticatedRequest & RequestWithCorrelationId;
const MODULE_KEY = "service_persona_proof";

/** Sources aren't independently governed by the parent claim's approval workflow — gated on the
 *  same `MODULE_KEY` with `view`/`edit` actions, mirroring `RoadmapItemsController`'s own
 *  sub-resource gating pattern (`apps/dashboard-api/src/projects/roadmap-items.controller.ts`). */
@ApiTags("proof-and-claims-library")
@Controller("proof-and-claims-library/claims/:claimId/sources")
@UseGuards(SessionGuard)
export class ClaimSourcesController {
  constructor(private readonly claimSources: ClaimSourcesService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "List a claim's sources" })
  async list(
    @Param("claimId", new ParseUUIDPipe()) claimId: string,
    @Req() req: ProofAndClaimsLibraryRequest,
  ): Promise<ApiSuccessResponse<readonly ClaimSourceEntity[]>> {
    const data = await this.claimSources.listByClaim(claimId);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "edit")
  @ApiOperation({ summary: "Add a source to a claim" })
  async create(
    @Param("claimId", new ParseUUIDPipe()) claimId: string,
    @Body(new ZodValidationPipe(createClaimSourceSchema)) body: CreateClaimSourceDto,
    @Req() req: ProofAndClaimsLibraryRequest,
  ): Promise<ApiSuccessResponse<ClaimSourceEntity>> {
    const data = await this.claimSources.create(claimId, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/update")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "edit")
  @ApiOperation({ summary: "Update a claim source" })
  async update(
    @Param("claimId", new ParseUUIDPipe()) claimId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updateClaimSourceSchema)) body: UpdateClaimSourceDto,
    @Req() req: ProofAndClaimsLibraryRequest,
  ): Promise<ApiSuccessResponse<ClaimSourceEntity>> {
    const data = await this.claimSources.update(id, claimId, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/delete")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "edit")
  @ApiOperation({ summary: "Remove a claim source" })
  async remove(
    @Param("claimId", new ParseUUIDPipe()) claimId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: ProofAndClaimsLibraryRequest,
  ): Promise<void> {
    await this.claimSources.remove(id, claimId, req.authUser!.id);
  }
}
