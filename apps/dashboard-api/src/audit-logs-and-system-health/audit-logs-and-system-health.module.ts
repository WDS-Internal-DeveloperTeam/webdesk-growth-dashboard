import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { AuthzModule } from "../authz/authz.module.js";
import { AuditLogsAndSystemHealthController } from "./audit-logs-and-system-health.controller.js";
import { AuditLogsAndSystemHealthService } from "./audit-logs-and-system-health.service.js";

/**
 * Module #43 — Audit Logs and System Health. Imports `AuthModule` for `SessionGuard`,
 * `AuthzModule` for `PermissionGuard`, and `AuditModule` for `AuditService` (this module's own
 * read-only delegation target, the same as Decision and Activity Log — see
 * `AuditService.list()`'s own doc comment for why it's exported from there rather than exporting
 * `AUDIT_EVENT_REPOSITORY` directly).
 */
@Module({
  imports: [AuthModule, AuthzModule, AuditModule],
  controllers: [AuditLogsAndSystemHealthController],
  providers: [AuditLogsAndSystemHealthService],
})
export class AuditLogsAndSystemHealthModule {}
