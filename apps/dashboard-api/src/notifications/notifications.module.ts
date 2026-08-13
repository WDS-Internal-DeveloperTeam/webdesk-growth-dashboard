import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { AuthzModule } from "../authz/authz.module.js";
import { notificationsRepositoryProviders } from "./database.providers.js";
import { NotificationService } from "./notification.service.js";
import { NotificationsController } from "./notifications.controller.js";

/**
 * Phase 1E — notification foundation slice
 * (docs/task-packages/phase-1e-notification-foundation.md). Imports
 * `AuthModule` for `SessionGuard`/`OriginCheckGuard` and `AuthzModule` for
 * `PermissionGuard` — same layering `JobsModule` already uses. No
 * `AuditModule` import: this slice doesn't emit general audit events
 * (notification creation/delivery is routine operational telemetry, not an
 * actor-attributable compliance action — same reasoning
 * docs/task-packages/phase-1e-job-architecture.md §4 already established
 * for routine job state transitions).
 */
@Module({
  imports: [AuthModule, AuthzModule],
  controllers: [NotificationsController],
  providers: [...notificationsRepositoryProviders, NotificationService],
  exports: [NotificationService],
})
export class NotificationsModule {}
