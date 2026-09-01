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
import type { WorkflowTaskTemplateEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import {
  changeWorkflowTaskTemplateApprovalStatusSchema,
  createWorkflowTaskTemplateSchema,
  listWorkflowTaskTemplatesQuerySchema,
  updateWorkflowTaskTemplateSchema,
  type ChangeWorkflowTaskTemplateApprovalStatusDto,
  type CreateWorkflowTaskTemplateDto,
  type ListWorkflowTaskTemplatesQueryDto,
  type UpdateWorkflowTaskTemplateDto,
} from "./workflow-and-task-template-library.dto.js";
import { WORKFLOW_TASK_TEMPLATE_LIBRARY_MODULE_KEY } from "./workflow-and-task-template-library.constants.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { WorkflowAndTaskTemplateLibraryService } from "./workflow-and-task-template-library.service.js";

type WorkflowTaskTemplateRequest = AuthenticatedRequest & RequestWithCorrelationId;

@ApiTags("workflow-and-task-template-library")
@Controller("workflow-and-task-template-library/templates")
@UseGuards(SessionGuard)
export class WorkflowAndTaskTemplateLibraryController {
  constructor(
    private readonly workflowTaskTemplateLibrary: WorkflowAndTaskTemplateLibraryService,
  ) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(WORKFLOW_TASK_TEMPLATE_LIBRARY_MODULE_KEY, "view")
  @ApiOperation({ summary: "List workflow and task templates, optionally filtered" })
  async list(
    @Query(new ZodValidationPipe(listWorkflowTaskTemplatesQuerySchema))
    query: ListWorkflowTaskTemplatesQueryDto,
    @Req() req: WorkflowTaskTemplateRequest,
  ): Promise<ApiSuccessResponse<readonly WorkflowTaskTemplateEntity[]>> {
    const data = await this.workflowTaskTemplateLibrary.list(query);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":id")
  @UseGuards(PermissionGuard)
  @RequirePermission(WORKFLOW_TASK_TEMPLATE_LIBRARY_MODULE_KEY, "view")
  @ApiOperation({ summary: "Get one workflow and task template" })
  async findOne(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: WorkflowTaskTemplateRequest,
  ): Promise<ApiSuccessResponse<WorkflowTaskTemplateEntity>> {
    const data = await this.workflowTaskTemplateLibrary.findById(id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(WORKFLOW_TASK_TEMPLATE_LIBRARY_MODULE_KEY, "create")
  @ApiOperation({ summary: "Create a workflow and task template (always starts draft)" })
  async create(
    @Body(new ZodValidationPipe(createWorkflowTaskTemplateSchema))
    body: CreateWorkflowTaskTemplateDto,
    @Req() req: WorkflowTaskTemplateRequest,
  ): Promise<ApiSuccessResponse<WorkflowTaskTemplateEntity>> {
    const data = await this.workflowTaskTemplateLibrary.create(body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/update")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(WORKFLOW_TASK_TEMPLATE_LIBRARY_MODULE_KEY, "edit")
  @ApiOperation({
    summary:
      "Edit a workflow and task template's content fields (increments version, never touches " +
      "approvalStatus)",
  })
  async update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updateWorkflowTaskTemplateSchema))
    body: UpdateWorkflowTaskTemplateDto,
    @Req() req: WorkflowTaskTemplateRequest,
  ): Promise<ApiSuccessResponse<WorkflowTaskTemplateEntity>> {
    const data = await this.workflowTaskTemplateLibrary.update(id, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/status")
  @HttpCode(HttpStatus.OK)
  // No @RequirePermission("approve") here — the real gate varies per requested transition
  // (submit/review/approve) and is checked dynamically inside the service itself, the same
  // layered pattern brand-library.controller.ts's own status route already established.
  // PermissionGuard still runs (via @UseGuards below) checking only module `view`, so a caller
  // with no access to this module at all is still rejected at the route.
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(WORKFLOW_TASK_TEMPLATE_LIBRARY_MODULE_KEY, "view")
  @ApiOperation({ summary: "Transition a workflow and task template's approval status" })
  async changeStatus(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(changeWorkflowTaskTemplateApprovalStatusSchema))
    body: ChangeWorkflowTaskTemplateApprovalStatusDto,
    @Req() req: WorkflowTaskTemplateRequest,
  ): Promise<ApiSuccessResponse<WorkflowTaskTemplateEntity>> {
    const data = await this.workflowTaskTemplateLibrary.changeApprovalStatus(
      id,
      body.approvalStatus,
      req.authUser!.id,
    );
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }
}
