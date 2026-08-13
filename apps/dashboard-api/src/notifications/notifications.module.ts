import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { AuthzModule } from "../authz/authz.module.js";
import { notificationsRepositoryProviders } from "./database.providers.js";
import { NotificationService } from "./notification.service.js";
import { NotificationsController } from "./notifications.controller.js";

/**
 * Phase 1E — notification foundation slice
 * (docs/task-packages/phase-1e-notification-foundation.md). Imports
 * `AuthModule` for `SessionGuard`/`OriginCheckGuard`, `AuthzModule` for
 * `PermissionGuard`, and `AuditModule` for `AuditService` — same layering
 * `JobsModule` already uses. `AuditModule` was originally left out
 * (notification creation/delivery framed as routine operational telemetry,
 * not an actor-attributable compliance action) but
 * docs/security/threat-model-phase-1e-operational-infrastructure.md's
 * Repudiation finding flagged that a `severity: critical` notification's
 * full lifecycle then had zero record in the tamper-resistant audit trail
 * — closed by wiring `AuditService` into `NotificationService`.
 */
@Module({
  imports: [AuthModule, AuthzModule, AuditModule],
  controllers: [NotificationsController],
  providers: [...notificationsRepositoryProviders, NotificationService],
  exports: [NotificationService],
})
export class NotificationsModule {}
