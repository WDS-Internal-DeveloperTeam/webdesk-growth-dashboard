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
import type { PersonaEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import {
  changePersonaApprovalStatusSchema,
  createPersonaSchema,
  listPersonasQuerySchema,
  updatePersonaSchema,
  type ChangePersonaApprovalStatusDto,
  type CreatePersonaDto,
  type ListPersonasQueryDto,
  type UpdatePersonaDto,
} from "./persona-library.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { PersonasService } from "./personas.service.js";

type PersonaLibraryRequest = AuthenticatedRequest & RequestWithCorrelationId;

// Known, accepted coupling (code-review finding, dashboard-web-persona-library): this literal is
// independently declared here, in personas.service.ts, and again in
// service-library/services.controller.ts/services.service.ts, with no shared constant tying them
// together. dashboard-web's own relationship picker (lib/persona-library.ts's
// getServicesForPersonaPicker()) calls Service Library's own GET /service-library/services
// endpoint, gated on this identical key, to populate Persona Library's create/edit form — that
// only works today because both modules happen to share the same RBAC module key. If Persona
// Library is ever given its own distinct module key, that fetch would start 403ing for any role
// that can view personas but lacks the Service Library grant specifically, with nothing catching
// the divergence at compile time. Left unfixed here — giving each module a real shared RBAC
// constant is a larger architectural change out of scope for a dashboard-web-only review-fix pass.
const MODULE_KEY = "service_persona_proof";

@ApiTags("persona-library")
@Controller("persona-library/personas")
@UseGuards(SessionGuard)
export class PersonasController {
  constructor(private readonly personas: PersonasService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "List personas, optionally filtered" })
  async list(
    @Query(new ZodValidationPipe(listPersonasQuerySchema)) query: ListPersonasQueryDto,
    @Req() req: PersonaLibraryRequest,
  ): Promise<ApiSuccessResponse<readonly PersonaEntity[]>> {
    const data = await this.personas.list(query);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":id")
  @UseGuards(PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "Get one persona" })
  async findOne(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: PersonaLibraryRequest,
  ): Promise<ApiSuccessResponse<PersonaEntity>> {
    const data = await this.personas.findById(id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "create")
  @ApiOperation({ summary: "Create a persona (always starts draft)" })
  async create(
    @Body(new ZodValidationPipe(createPersonaSchema)) body: CreatePersonaDto,
    @Req() req: PersonaLibraryRequest,
  ): Promise<ApiSuccessResponse<PersonaEntity>> {
    const data = await this.personas.create(body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/update")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "edit")
  @ApiOperation({
    summary: "Edit a persona's content fields (increments version, never touches approvalStatus)",
  })
  async update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updatePersonaSchema)) body: UpdatePersonaDto,
    @Req() req: PersonaLibraryRequest,
  ): Promise<ApiSuccessResponse<PersonaEntity>> {
    const data = await this.personas.update(id, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/status")
  @HttpCode(HttpStatus.OK)
  // No @RequirePermission("approve") here — the real gate varies per requested transition
  // (submit/review/approve) and is checked dynamically inside the service itself, the same
  // layered pattern services.controller.ts's own status route already established.
  // PermissionGuard still runs (via @UseGuards below) checking only module `view`, so a caller
  // with no access to this module at all is still rejected at the route.
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "Transition a persona's approval status" })
  async changeStatus(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(changePersonaApprovalStatusSchema))
    body: ChangePersonaApprovalStatusDto,
    @Req() req: PersonaLibraryRequest,
  ): Promise<ApiSuccessResponse<PersonaEntity>> {
    const data = await this.personas.changeApprovalStatus(
      id,
      body.approvalStatus,
      req.authUser!.id,
    );
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }
}
