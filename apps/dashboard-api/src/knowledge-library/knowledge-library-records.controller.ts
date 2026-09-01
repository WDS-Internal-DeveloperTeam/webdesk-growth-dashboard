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
import type { KnowledgeLibraryRecordEntity } from "@webdesk/database";
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
  changeKnowledgeLibraryRecordStatusSchema,
  createKnowledgeLibraryRecordSchema,
  listKnowledgeLibraryRecordsQuerySchema,
  updateKnowledgeLibraryRecordSchema,
  type ChangeKnowledgeLibraryRecordStatusDto,
  type CreateKnowledgeLibraryRecordDto,
  type ListKnowledgeLibraryRecordsQueryDto,
  type UpdateKnowledgeLibraryRecordDto,
} from "./knowledge-library.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { KnowledgeLibraryRecordsService } from "./knowledge-library-records.service.js";

type KnowledgeLibraryRequest = AuthenticatedRequest & RequestWithCorrelationId;

// The RBAC permission-group key ("business_knowledge", 00013-seed-rbac-matrix.ts) — Knowledge
// Library reuses Business Knowledge Center's identical RBAC group verbatim (no new RBAC
// migration) — not the module-registry navigation key ("knowledge_library"), same distinction
// business-knowledge-records.controller.ts draws for its own module.
const MODULE_KEY = "business_knowledge";

// A `restricted` record's `location`/`sourceType`/`notes` are hidden from anyone without a real
// `view_confidential` grant on this module (zero-seeded today, mirroring
// business-knowledge-records.controller.ts's own `CONFIDENTIAL_RESTRICTED_FIELDS`/
// `redactIfRestricted` pattern) — unlike Business Knowledge Center, `confidentiality` here is a
// field independent of `status` (D1), so a record can be `restricted` at any lifecycle stage,
// including `draft`. `sourceType` is included (unlike BKC's own visible `recordType`, a closed
// enum) because it's free text with no taxonomy (D4) and can itself carry sensitive provenance —
// code-review finding.
const CONFIDENTIAL_RESTRICTED_FIELDS: readonly (keyof KnowledgeLibraryRecordEntity)[] = [
  "sourceType",
  "location",
  "notes",
];

function redactIfRestricted(
  record: KnowledgeLibraryRecordEntity,
  canViewConfidential: boolean,
): KnowledgeLibraryRecordEntity {
  if (canViewConfidential || record.confidentiality !== "restricted") {
    return record;
  }
  return redactConfidentialFields(
    record as unknown as Record<string, unknown>,
    CONFIDENTIAL_RESTRICTED_FIELDS,
    false,
  ) as unknown as KnowledgeLibraryRecordEntity;
}

/** `redactConfidentialFieldsFromList()` applies uniformly to every list entry via one shared
 *  boolean — unusable directly here since only `restricted` records in a mixed-confidentiality
 *  list should ever be redacted, so each record is checked individually. */
function redactRestrictedRecords(
  records: readonly KnowledgeLibraryRecordEntity[],
  canViewConfidential: boolean,
): readonly KnowledgeLibraryRecordEntity[] {
  if (canViewConfidential) {
    return records;
  }
  return records.map((record) => redactIfRestricted(record, canViewConfidential));
}

@ApiTags("knowledge-library")
@Controller("knowledge-library/records")
@UseGuards(SessionGuard)
export class KnowledgeLibraryRecordsController {
  constructor(
    private readonly records: KnowledgeLibraryRecordsService,
    private readonly authorizationService: AuthorizationService,
  ) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "List knowledge library records, optionally filtered" })
  async list(
    @Query(new ZodValidationPipe(listKnowledgeLibraryRecordsQuerySchema))
    query: ListKnowledgeLibraryRecordsQueryDto,
    @Req() req: KnowledgeLibraryRequest,
  ): Promise<ApiSuccessResponse<readonly KnowledgeLibraryRecordEntity[]>> {
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
  @ApiOperation({ summary: "Get one knowledge library record" })
  async findOne(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: KnowledgeLibraryRequest,
  ): Promise<ApiSuccessResponse<KnowledgeLibraryRecordEntity>> {
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
  @ApiOperation({ summary: "Create a knowledge library record (always starts as draft)" })
  async create(
    @Body(new ZodValidationPipe(createKnowledgeLibraryRecordSchema))
    body: CreateKnowledgeLibraryRecordDto,
    @Req() req: KnowledgeLibraryRequest,
  ): Promise<ApiSuccessResponse<KnowledgeLibraryRecordEntity>> {
    // A new record can be created directly as `restricted` (D1 — confidentiality is independent
    // of status, unlike Business Knowledge Center), so the redaction check does apply here too.
    const [created, canViewConfidential] = await Promise.all([
      this.records.create(body, req.authUser!.id),
      this.authorizationService.canViewConfidential(req.authUser!.id, MODULE_KEY),
    ]);
    const data = redactIfRestricted(created, canViewConfidential);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/update")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "edit")
  @ApiOperation({ summary: "Edit a knowledge library record's fields" })
  async update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updateKnowledgeLibraryRecordSchema))
    body: UpdateKnowledgeLibraryRecordDto,
    @Req() req: KnowledgeLibraryRequest,
  ): Promise<ApiSuccessResponse<KnowledgeLibraryRecordEntity>> {
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
  @ApiOperation({ summary: "Transition a knowledge library record's status" })
  async changeStatus(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(changeKnowledgeLibraryRecordStatusSchema))
    body: ChangeKnowledgeLibraryRecordStatusDto,
    @Req() req: KnowledgeLibraryRequest,
  ): Promise<ApiSuccessResponse<KnowledgeLibraryRecordEntity>> {
    const [updated, canViewConfidential] = await Promise.all([
      this.records.changeStatus(id, body.status, req.authUser!.id),
      this.authorizationService.canViewConfidential(req.authUser!.id, MODULE_KEY),
    ]);
    const data = redactIfRestricted(updated, canViewConfidential);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }
}
