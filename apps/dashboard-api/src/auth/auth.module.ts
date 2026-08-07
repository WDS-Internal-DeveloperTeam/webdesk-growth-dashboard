import { Module } from "@nestjs/common";
import { AuthConfigModule } from "./config/auth-config.module.js";
import { authRepositoryProviders } from "./database.providers.js";
import { RateLimitService } from "./common/rate-limit.service.js";
import { OriginCheckGuard } from "./common/origin-check.guard.js";
import { SessionService } from "./session/session.service.js";
import { SessionController } from "./session/session.controller.js";
import { GoogleAuthService } from "./google/google-auth.service.js";
import { GoogleAuthController } from "./google/google-auth.controller.js";
import { EmergencyAdminService } from "./emergency/emergency-admin.service.js";
import { EmergencyAuthController } from "./emergency/emergency-auth.controller.js";
import { LoggingEmergencyAdminLoginNotifier } from "./emergency/emergency-admin-login-notifier.js";
import { EMERGENCY_ADMIN_LOGIN_NOTIFIER } from "./config/auth.constants.js";
import { RecoveryService } from "./recovery/recovery.service.js";

/**
 * Phase 1C — Google Workspace SSO, restricted emergency-local
 * authentication, and session management
 * (docs/task-packages/phase-1c-authentication-sessions.md). Deliberately
 * does not include: RBAC/roles (Task 6), the general audit-log subsystem
 * (Task 7), user-management CRUD (Task 8), or an HTTP surface for
 * `RecoveryService` — recovery decisions need an authorization check this
 * phase has no mechanism for yet (Task 6), so it is a service-layer
 * capability only until that exists, not a prematurely-exposed endpoint.
 */
@Module({
  imports: [AuthConfigModule],
  controllers: [GoogleAuthController, EmergencyAuthController, SessionController],
  providers: [
    ...authRepositoryProviders,
    RateLimitService,
    OriginCheckGuard,
    SessionService,
    GoogleAuthService,
    EmergencyAdminService,
    RecoveryService,
    { provide: EMERGENCY_ADMIN_LOGIN_NOTIFIER, useClass: LoggingEmergencyAdminLoginNotifier },
  ],
  exports: [SessionService, RecoveryService],
})
export class AuthModule {}
