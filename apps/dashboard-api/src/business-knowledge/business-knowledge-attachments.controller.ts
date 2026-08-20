import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import type { BusinessKnowledgeAttachmentEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuthorizationService } from "../authz/authorization.service.js";
import {
  confirmBusinessKnowledgeAttachmentSchema,
  type ConfirmBusinessKnowledgeAttachmentDto,
} from "./business-knowledge.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { BusinessKnowledgeAttachmentsService } from "./business-knowledge-attachments.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { BusinessKnowledgeRecordsService } from "./business-knowledge-records.service.js";

type BusinessKnowledgeRequest = AuthenticatedRequest & RequestWithCorrelationId;

// Same permission-group key the sibling records controller uses — attachment actions reuse the
// record's own `view`/`edit` actions exactly, no separate "attachment" action (task package §6).
const MODULE_KEY = "business_knowledge";

@ApiTags("business-knowledge")
@Controller("business-knowledge/records/:id/attachments")
@UseGuards(SessionGuard)
export class BusinessKnowledgeAttachmentsController {
  constructor(
    private readonly attachments: BusinessKnowledgeAttachmentsService,
    private readonly records: BusinessKnowledgeRecordsService,
    private readonly authorizationService: AuthorizationService,
  ) {}

  /** Whether attachments are visible to this caller for this record at all — mirrors the records
   *  controller's own `redactIfRestricted()`: a `restricted` record's attachments are hidden from
   *  anyone without `view_confidential`, exactly like its `content`/`notes` (task package D8). */
  private async canSeeAttachments(recordId: string, actorUserId: string): Promise<boolean> {
    const [record, canViewConfidential] = await Promise.all([
      this.records.findById(recordId),
      this.authorizationService.canViewConfidential(actorUserId, MODULE_KEY),
    ]);
    return record.status !== "restricted" || canViewConfidential;
  }

  @Post("upload-route")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "edit")
  @ApiOperation({
    summary:
      "Vercel Blob client-upload token endpoint (real auth happens in onBeforeGenerateToken)",
  })
  async uploadRoute(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
    @Req() req: BusinessKnowledgeRequest,
  ): Promise<Record<string, unknown>> {
    return this.attachments.handleUploadRoute(id, body, req);
  }

  @Post("confirm")
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "edit")
  @ApiOperation({ summary: "Confirm a completed direct-to-Blob upload and generate its preview" })
  async confirm(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(confirmBusinessKnowledgeAttachmentSchema))
    body: ConfirmBusinessKnowledgeAttachmentDto,
    @Req() req: BusinessKnowledgeRequest,
  ): Promise<ApiSuccessResponse<BusinessKnowledgeAttachmentEntity>> {
    const data = await this.attachments.confirm(id, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "List a record's attachments" })
  async list(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: BusinessKnowledgeRequest,
  ): Promise<ApiSuccessResponse<readonly BusinessKnowledgeAttachmentEntity[]>> {
    const canSee = await this.canSeeAttachments(id, req.authUser!.id);
    const data = canSee ? await this.attachments.list(id) : [];
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":attachmentId/content")
  @UseGuards(PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({
    summary: "Stream an attachment's raw file content (private, proxied, never a public URL)",
  })
  async content(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Param("attachmentId", new ParseUUIDPipe()) attachmentId: string,
    @Req() req: BusinessKnowledgeRequest,
    @Res() res: Response,
  ): Promise<void> {
    const canSee = await this.canSeeAttachments(id, req.authUser!.id);
    if (!canSee) {
      // Same "treat as not found" redaction semantics as the records controller's own
      // `restricted`-status omission — a caller without `view_confidential` never learns whether
      // a given attachment exists on a restricted record.
      res.status(HttpStatus.NOT_FOUND).json({
        success: false,
        error: { code: "NotFoundException", message: `Attachment not found: ${attachmentId}` },
        correlationId: req.correlationId ?? "unknown",
      });
      return;
    }
    const { attachment, body, contentType } = await this.attachments.getContent(id, attachmentId);
    // Matches Vercel's own recommended headers for serving a private blob through your own
    // Function (`private, no-cache` — never CDN-cacheable, always revalidated against this app's
    // own auth check) plus `nosniff` since this streams an arbitrary uploaded file's raw bytes.
    res
      .status(HttpStatus.OK)
      .set({
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(attachment.filename)}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-cache",
      })
      .send(body);
  }

  @Delete(":attachmentId")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "edit")
  @ApiOperation({ summary: "Delete an attachment" })
  async remove(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Param("attachmentId", new ParseUUIDPipe()) attachmentId: string,
    @Req() req: BusinessKnowledgeRequest,
  ): Promise<ApiSuccessResponse<{ deleted: true }>> {
    await this.attachments.delete(id, attachmentId, req.authUser!.id);
    return {
      success: true,
      data: { deleted: true },
      correlationId: req.correlationId ?? "unknown",
    };
  }
}
