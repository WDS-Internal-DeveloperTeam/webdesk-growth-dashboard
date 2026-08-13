import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { AuthzModule } from "../authz/authz.module.js";
import { jobsRepositoryProviders } from "./database.providers.js";
import { IdempotencyService } from "./idempotency.service.js";
import { JobService } from "./job.service.js";
import { JobRetryService } from "./job-retry.service.js";
import { JobCancellationService } from "./job-cancellation.service.js";
import { JobsController } from "./jobs.controller.js";

/**
 * Phase 1E — job architecture slice
 * (docs/task-packages/phase-1e-job-architecture.md). Imports `AuthModule`
 * for `SessionGuard`/`OriginCheckGuard`, `AuthzModule` for
 * `PermissionGuard`, and `AuditModule` for `AuditService` — same layering
 * `AuthzModule` itself already uses.
 */
@Module({
  imports: [AuthModule, AuthzModule, AuditModule],
  controllers: [JobsController],
  providers: [
    ...jobsRepositoryProviders,
    IdempotencyService,
    JobService,
    JobRetryService,
    JobCancellationService,
  ],
  exports: [JobService, JobRetryService, JobCancellationService],
})
export class JobsModule {}
