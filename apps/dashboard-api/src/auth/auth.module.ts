import { Module } from "@nestjs/common";
import { AuthorizationActionRepository } from "@webdesk/database";
import { AuditModule } from "../audit/audit.module.js";
import { AuthConfigModule } from "./config/auth-config.module.js";
import { authRepositoryProviders } from "./database.providers.js";
import { RateLimitService } from "./common/rate-limit.service.js";
import { OriginCheckGuard } from "./common/origin-check.guard.js";
import { SeparationOfDutiesService } from "./common/separation-of-duties.service.js";
import { SessionService } from "./session/session.service.js";
import { SessionGuard } from "./session/session.guard.js";
import { SessionController } from "./session/session.controller.js";
import { MeController } from "./me.controller.js";
import { GoogleAuthService } from "./google/google-auth.service.js";
import { GoogleAuthController } from "./google/google-auth.controller.js";
import { EmergencyAdminService } from "./emergency/emergency-admin.service.js";
import { EmergencyAuthController } from "./emergency/emergency-auth.controller.js";
import { LoggingEmergencyAdminLoginNotifier } from "./emergency/emergency-admin-login-notifier.js";
import { EMERGENCY_ADMIN_LOGIN_NOTIFIER } from "./config/auth.constants.js";
import { AUTHORIZATION_ACTION_REPOSITORY } from "../authz/authz.constants.js";
import { RecoveryService } from "./recovery/recovery.service.js";

/**
 * Phase 1C — Google Workspace SSO, restricted emergency-local
 * authentication, and session management
 * (docs/task-packages/phase-1c-authentication-sessions.md). Deliberately
 * does not include: user-management CRUD (Task 8), or an HTTP surface for
 * `RecoveryService` — no real approval workflow exists yet to wire it into
 * (docs/task-packages/phase-1d-rbac-authorization.md §5). Imports
 * `AuditModule` (Phase 1E) so `RecoveryService` can record general
 * ADR-0017 audit events alongside its existing narrow `auth_events` writes
 * — see docs/task-packages/phase-1e-audit-foundation.md.
 *
 * Exports `SessionService`/`SessionGuard`/`SeparationOfDutiesService` for
 * `AuthzModule` (Phase 1D) to consume — `AuthzModule` imports this module,
 * never the reverse, to avoid a circular module dependency (its
 * role-assignment feature needs session revocation and the session guard;
 * `RecoveryService` here needs the separation-of-duties primitive, which
 * lives in `auth/common` rather than `authz/` for exactly this reason).
 * `SeparationOfDutiesService` itself now needs `AUTHORIZATION_ACTION_REPOSITORY`
 * (a Phase 1D-expanded token) — re-declared here directly from
 * `authz.constants.js` (a plain Symbol export, no circularity) rather than
 * importing `AuthzModule`, same "re-declare, don't cross-import" pattern
 * `AuthzModule` itself already uses for `USER_REPOSITORY`.
 */
@Module({
  imports: [AuthConfigModule, AuditModule],
  controllers: [GoogleAuthController, EmergencyAuthController, SessionController, MeController],
  providers: [
    ...authRepositoryProviders,
    RateLimitService,
    OriginCheckGuard,
    {
      provide: AUTHORIZATION_ACTION_REPOSITORY,
      useFactory: () => new AuthorizationActionRepository(),
    },
    SeparationOfDutiesService,
    SessionService,
    SessionGuard,
    GoogleAuthService,
    EmergencyAdminService,
    RecoveryService,
    { provide: EMERGENCY_ADMIN_LOGIN_NOTIFIER, useClass: LoggingEmergencyAdminLoginNotifier },
  ],
  exports: [SessionService, SessionGuard, SeparationOfDutiesService, RecoveryService],
})
export class AuthModule {}
