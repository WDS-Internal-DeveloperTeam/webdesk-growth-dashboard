import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { JobEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import {
  createJobSchema,
  listJobsQuerySchema,
  type CreateJobDto,
  type ListJobsQueryDto,
} from "./jobs.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime, see google-auth.service.ts's note.
import { JobService } from "./job.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- same reason as JobService above.
import { JobRetryService } from "./job-retry.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- same reason as JobService above.
import { JobCancellationService } from "./job-cancellation.service.js";

type JobsRequest = AuthenticatedRequest & RequestWithCorrelationId;

/**
 * The job domain's own HTTP surface (brief §28) — proves the framework
 * the same way Phase 1D's "Users/roles" controller proved `PermissionGuard`
 * before any of the 20 other business modules existed. Every route reuses
 * the existing `system_settings` module (no dedicated "jobs" module in the
 * approved 43-module registry) with new, zero-seeded actions
 * (`jobs_view`/`jobs_create`/`jobs_retry`/`jobs_cancel`) — deny-by-default
 * until a separate, later authorization seeds real grants. See
 * docs/task-packages/phase-1e-job-architecture.md §3.
 */
@ApiTags("jobs")
@Controller("jobs")
@UseGuards(SessionGuard)
export class JobsController {
  constructor(
    private readonly jobService: JobService,
    private readonly jobRetryService: JobRetryService,
    private readonly jobCancellationService: JobCancellationService,
  ) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission("system_settings", "jobs_view")
  @ApiOperation({ summary: "List jobs, optionally filtered by status/project/type" })
  async list(
    @Query(new ZodValidationPipe(listJobsQuerySchema)) query: ListJobsQueryDto,
    @Req() req: JobsRequest,
  ): Promise<ApiSuccessResponse<readonly JobEntity[]>> {
    const jobs = await this.jobService.list(query);
    return { success: true, data: jobs, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":id")
  @UseGuards(PermissionGuard)
  @RequirePermission("system_settings", "jobs_view")
  @ApiOperation({ summary: "Get a single job by id" })
  async getById(
    @Param("id") id: string,
    @Req() req: JobsRequest,
  ): Promise<ApiSuccessResponse<JobEntity>> {
    const job = await this.jobService.findById(id);
    return { success: true, data: job, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission("system_settings", "jobs_create")
  @ApiOperation({
    summary:
      "Create a job — the domain-model proof surface; no real job producer exists yet, so this is how the framework is exercised",
  })
  async create(
    @Body(new ZodValidationPipe(createJobSchema)) body: CreateJobDto,
    @Req() req: JobsRequest,
  ): Promise<ApiSuccessResponse<JobEntity>> {
    const job = await this.jobService.create({
      jobType: body.jobType,
      projectId: body.projectId ?? null,
      resourceType: body.resourceType ?? null,
      resourceId: body.resourceId ?? null,
      requestedByUserId: req.authUser!.id,
      idempotencyKey: body.idempotencyKey ?? null,
      maxAttempts: body.maxAttempts,
      timeoutSeconds: body.timeoutSeconds ?? null,
      correlationId: req.correlationId ?? null,
    });
    return { success: true, data: job, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/retry")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission("system_settings", "jobs_retry")
  @ApiOperation({ summary: "Manually retry a failed job — moves it back to queued" })
  async retry(
    @Param("id") id: string,
    @Req() req: JobsRequest,
  ): Promise<ApiSuccessResponse<JobEntity>> {
    const job = await this.jobRetryService.manualRetry(id, req.authUser!.id);
    return { success: true, data: job, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/cancel")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission("system_settings", "jobs_cancel")
  @ApiOperation({
    summary:
      "Request cancellation — immediate for a not-yet-started job, request-only for a running one",
  })
  async cancel(
    @Param("id") id: string,
    @Req() req: JobsRequest,
  ): Promise<ApiSuccessResponse<JobEntity>> {
    const job = await this.jobCancellationService.requestCancellation(id, req.authUser!.id);
    return { success: true, data: job, correlationId: req.correlationId ?? "unknown" };
  }
}
