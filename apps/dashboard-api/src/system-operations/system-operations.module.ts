import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { AuthzModule } from "../authz/authz.module.js";
import { systemOperationsRepositoryProviders } from "./database.providers.js";
import { SystemActivityService } from "./system-activity.service.js";
import { SystemHealthService } from "./system-health.service.js";
import { SystemOperationsController } from "./system-operations.controller.js";

/**
 * Phase 1E — system events & health slice, the last of the 6 Phase 1E
 * architecture pieces (docs/task-packages/phase-1e-system-events-health.md).
 * Imports `AuthModule` for `SessionGuard`/`OriginCheckGuard`, `AuthzModule`
 * for `PermissionGuard`, and `AuditModule` for `AuditService` (a manually-
 * recorded health check is a genuinely human-initiated, audit-worthy
 * action).
 */
@Module({
  imports: [AuthModule, AuthzModule, AuditModule],
  controllers: [SystemOperationsController],
  providers: [...systemOperationsRepositoryProviders, SystemActivityService, SystemHealthService],
  exports: [SystemActivityService, SystemHealthService],
})
export class SystemOperationsModule {}
