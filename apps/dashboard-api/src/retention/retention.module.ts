import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { AuthzModule } from "../authz/authz.module.js";
import { retentionRepositoryProviders } from "./database.providers.js";
import { RetentionEligibilityService } from "./retention-eligibility.service.js";
import { RetentionHoldService } from "./retention-hold.service.js";
import { RetentionCleanupService } from "./retention-cleanup.service.js";
import { RetentionController } from "./retention.controller.js";

/**
 * Phase 1E — retention architecture slice
 * (docs/task-packages/phase-1e-retention-architecture.md). Imports
 * `AuthModule` for `SessionGuard`/`OriginCheckGuard`, `AuthzModule` for
 * `PermissionGuard`, and `AuditModule` for `AuditService` (hold
 * create/release and cleanup runs are genuinely audit-worthy, unlike
 * routine job/notification telemetry). `RetentionCleanupService` is
 * exported for tests to call directly — no controller route reaches it,
 * by design.
 */
@Module({
  imports: [AuthModule, AuthzModule, AuditModule],
  controllers: [RetentionController],
  providers: [
    ...retentionRepositoryProviders,
    RetentionEligibilityService,
    RetentionHoldService,
    RetentionCleanupService,
  ],
  exports: [RetentionEligibilityService, RetentionHoldService, RetentionCleanupService],
})
export class RetentionModule {}
