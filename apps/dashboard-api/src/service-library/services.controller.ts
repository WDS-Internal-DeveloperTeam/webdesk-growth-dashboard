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
import { redactConfidentialFields } from "../authz/confidential-field.util.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuthorizationService } from "../authz/authorization.service.js";
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
import { ServicesService, type ServiceWithRelationshipIds } from "./services.service.js";

type ServiceLibraryRequest = AuthenticatedRequest & RequestWithCorrelationId;

const MODULE_KEY = "service_persona_proof";

// A `restricted` service's internal-only prose is hidden from anyone without a real
// `view_confidential` grant on this module (zero-seeded today, mirroring
// business-knowledge-records.controller.ts's own `CONFIDENTIAL_RESTRICTED_FIELDS`/
// `redactIfRestricted` pattern, sourced from `03_Detailed_Module_Specifications.md:132`'s three
// named views — public/internal/restricted — for this exact module). Unlike Business Knowledge
// Center, `confidentiality` here is a field independent of `approvalStatus`, and both `create()`
// and `update()` accept it directly, so a caller can produce a `restricted` record on day one —
// every write path needs the same redaction the read paths do, not just status-change responses.
// `internalDescription` is the one field whose own name signals it isn't meant to leave the
// organization; `shortPublicDescription`/`audience`/`problems`/`capabilities`/`outcomes`/
// `exclusions` read as general marketing copy the spec never flags as restricted, so they stay
// visible — the same conservative, name-driven field selection BKC's own `content`/`notes` choice
// used (security-review finding, `module-service-library`).
const CONFIDENTIAL_RESTRICTED_FIELDS: readonly (keyof ServiceEntity)[] = ["internalDescription"];

function redactIfRestricted<T extends ServiceEntity>(record: T, canViewConfidential: boolean): T {
  if (canViewConfidential || record.confidentiality !== "restricted") {
    return record;
  }
  return redactConfidentialFields(
    record as unknown as Record<string, unknown>,
    CONFIDENTIAL_RESTRICTED_FIELDS,
    false,
  ) as unknown as T;
}

/** `redactConfidentialFieldsFromList()` applies uniformly to every list entry via one shared
 *  boolean — unusable directly here since only `restricted` records in a mixed-confidentiality
 *  list should ever be redacted, so each record is checked individually. */
function redactRestrictedRecords<T extends ServiceEntity>(
  records: readonly T[],
  canViewConfidential: boolean,
): readonly T[] {
  if (canViewConfidential) {
    return records;
  }
  return records.map((record) => redactIfRestricted(record, canViewConfidential));
}

@ApiTags("service-library")
@Controller("service-library/services")
@UseGuards(SessionGuard)
export class ServicesController {
  constructor(
    private readonly services: ServicesService,
    private readonly authorizationService: AuthorizationService,
  ) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "List services, optionally filtered" })
  async list(
    @Query(new ZodValidationPipe(listServicesQuerySchema)) query: ListServicesQueryDto,
    @Req() req: ServiceLibraryRequest,
  ): Promise<ApiSuccessResponse<readonly ServiceEntity[]>> {
    const [records, canViewConfidential] = await Promise.all([
      this.services.list(query),
      this.authorizationService.canViewConfidential(req.authUser!.id, MODULE_KEY),
    ]);
    const data = redactRestrictedRecords(records, canViewConfidential);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":id")
  @UseGuards(PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "Get one service" })
  async findOne(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: ServiceLibraryRequest,
  ): Promise<ApiSuccessResponse<ServiceWithRelationshipIds>> {
    const [record, canViewConfidential] = await Promise.all([
      this.services.findById(id),
      this.authorizationService.canViewConfidential(req.authUser!.id, MODULE_KEY),
    ]);
    const data = redactIfRestricted(record, canViewConfidential);
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
  ): Promise<ApiSuccessResponse<ServiceWithRelationshipIds>> {
    // Unlike Business Knowledge Center's create() (always draft, never restricted), this schema
    // accepts `confidentiality` directly — a caller can create an already-`restricted` record, so
    // the response needs the same redaction check as every read path.
    const [record, canViewConfidential] = await Promise.all([
      this.services.create(body, req.authUser!.id),
      this.authorizationService.canViewConfidential(req.authUser!.id, MODULE_KEY),
    ]);
    const data = redactIfRestricted(record, canViewConfidential);
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
  ): Promise<ApiSuccessResponse<ServiceWithRelationshipIds>> {
    const [updated, canViewConfidential] = await Promise.all([
      this.services.update(id, body, req.authUser!.id),
      this.authorizationService.canViewConfidential(req.authUser!.id, MODULE_KEY),
    ]);
    const data = redactIfRestricted(updated, canViewConfidential);
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
    const [updated, canViewConfidential] = await Promise.all([
      this.services.changeApprovalStatus(id, body.approvalStatus, req.authUser!.id),
      this.authorizationService.canViewConfidential(req.authUser!.id, MODULE_KEY),
    ]);
    const data = redactIfRestricted(updated, canViewConfidential);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }
}
