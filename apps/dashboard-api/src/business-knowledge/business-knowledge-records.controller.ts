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
import type { BusinessKnowledgeRecordEntity } from "@webdesk/database";
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

// A `restricted` record's substantive content is hidden from anyone without a real
// `view_confidential` grant on this module (zero-seeded today — see the confidential-field
// mechanism established in Phase 1D-expanded, mirroring operational-contacts.controller.ts's own
// `CONFIDENTIAL_CONTACT_FIELDS`/`redactContact` pattern). `title`/`recordType`/`status` stay
// visible so a list view isn't left showing an unexplained gap; the sensitive prose does not.
const CONFIDENTIAL_RESTRICTED_FIELDS: readonly (keyof BusinessKnowledgeRecordEntity)[] = [
  "content",
  "notes",
];

function redactIfRestricted(
  record: BusinessKnowledgeRecordEntity,
  canViewConfidential: boolean,
): BusinessKnowledgeRecordEntity {
  if (canViewConfidential || record.status !== "restricted") {
    return record;
  }
  return redactConfidentialFields(
    record as unknown as Record<string, unknown>,
    CONFIDENTIAL_RESTRICTED_FIELDS,
    false,
  ) as unknown as BusinessKnowledgeRecordEntity;
}

/** `redactConfidentialFieldsFromList()` applies uniformly to every list entry via one shared
 *  boolean — unusable directly here since only `restricted` records in a mixed-status list should
 *  ever be redacted, so each record is checked individually via `redactIfRestricted()`. */
function redactRestrictedRecords(
  records: readonly BusinessKnowledgeRecordEntity[],
  canViewConfidential: boolean,
): readonly BusinessKnowledgeRecordEntity[] {
  if (canViewConfidential) {
    return records;
  }
  return records.map((record) => redactIfRestricted(record, canViewConfidential));
}

@ApiTags("business-knowledge")
@Controller("business-knowledge/records")
@UseGuards(SessionGuard)
export class BusinessKnowledgeRecordsController {
  constructor(
    private readonly records: BusinessKnowledgeRecordsService,
    private readonly authorizationService: AuthorizationService,
  ) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "List business knowledge records, optionally filtered" })
  async list(
    @Query(new ZodValidationPipe(listBusinessKnowledgeRecordsQuerySchema))
    query: ListBusinessKnowledgeRecordsQueryDto,
    @Req() req: BusinessKnowledgeRequest,
  ): Promise<ApiSuccessResponse<readonly BusinessKnowledgeRecordEntity[]>> {
    const [records, canViewConfidential] = await Promise.all([
      this.records.list(query),
      this.authorizationService.canViewConfidential(req.authUser!.id, MODULE_KEY),
    ]);
    const data = redactRestrictedRecords(records, canViewConfidential);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":id")
  @UseGuards(PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "Get one business knowledge record" })
  async findOne(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: BusinessKnowledgeRequest,
  ): Promise<ApiSuccessResponse<BusinessKnowledgeRecordEntity>> {
    const [record, canViewConfidential] = await Promise.all([
      this.records.findById(id),
      this.authorizationService.canViewConfidential(req.authUser!.id, MODULE_KEY),
    ]);
    const data = redactIfRestricted(record, canViewConfidential);
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
    // A brand-new record is always `draft` (never `restricted`), so no redaction check is needed
    // here — nothing this endpoint returns can ever be a confidential record.
    const data = await this.records.create(body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/update")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "edit")
  @ApiOperation({ summary: "Edit a business knowledge record's title/content/notes" })
  async update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updateBusinessKnowledgeRecordSchema))
    body: UpdateBusinessKnowledgeRecordDto,
    @Req() req: BusinessKnowledgeRequest,
  ): Promise<ApiSuccessResponse<BusinessKnowledgeRecordEntity>> {
    const [updated, canViewConfidential] = await Promise.all([
      this.records.update(id, body, req.authUser!.id),
      this.authorizationService.canViewConfidential(req.authUser!.id, MODULE_KEY),
    ]);
    const data = redactIfRestricted(updated, canViewConfidential);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/status")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "approve")
  @ApiOperation({ summary: "Transition a business knowledge record's status" })
  async changeStatus(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(changeBusinessKnowledgeRecordStatusSchema))
    body: ChangeBusinessKnowledgeRecordStatusDto,
    @Req() req: BusinessKnowledgeRequest,
  ): Promise<ApiSuccessResponse<BusinessKnowledgeRecordEntity>> {
    const [updated, canViewConfidential] = await Promise.all([
      this.records.changeStatus(id, body.status, req.authUser!.id),
      this.authorizationService.canViewConfidential(req.authUser!.id, MODULE_KEY),
    ]);
    const data = redactIfRestricted(updated, canViewConfidential);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }
}
