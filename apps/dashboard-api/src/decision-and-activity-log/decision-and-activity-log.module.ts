import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { AuthzModule } from "../authz/authz.module.js";
import { DecisionAndActivityLogController } from "./decision-and-activity-log.controller.js";
import { DecisionAndActivityLogService } from "./decision-and-activity-log.service.js";

/**
 * Module #37 — Decision and Activity Log. Imports `AuthModule` for
 * `SessionGuard`, `AuthzModule` for `PermissionGuard`, and `AuditModule`
 * for `AuditService` (this module's own read-only delegation target — see
 * `AuditService.list()`'s own doc comment for why it's exported from
 * there rather than exporting `AUDIT_EVENT_REPOSITORY` directly).
 */
@Module({
  imports: [AuthModule, AuthzModule, AuditModule],
  controllers: [DecisionAndActivityLogController],
  providers: [DecisionAndActivityLogService],
})
export class DecisionAndActivityLogModule {}
