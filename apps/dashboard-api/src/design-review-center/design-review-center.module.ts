import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { AuthzModule } from "../authz/authz.module.js";
import { UsersModule } from "../users/users.module.js";
import { designReviewCenterRepositoryProviders } from "./database.providers.js";
import { DesignReviewsService } from "./design-reviews.service.js";
import { DesignReviewsController } from "./design-reviews.controller.js";

/**
 * The Design Review Center module — module #21 on the canonical module registry, mirroring
 * Review and Approval Center's own module wiring file-for-file. Imports `AuthModule` for
 * `SessionGuard`/`OriginCheckGuard`/`SeparationOfDutiesService` (`DesignReviewsService.decide()`'s
 * own separation-of-duties check, D6), `AuthzModule` for `PermissionGuard`/`AuthorizationService`
 * (the dynamic per-action `decide()` check, and `isValidModuleKey()` — `create()`'s own
 * `targetModuleKey` validation, D9), `AuditModule` for `AuditService` (every `decide()` call,
 * including the automatic supersede side effect, is approval-shaped and mirrored into
 * `audit_events`, D7), and `UsersModule` for `UsersService` (`assignedToUserId`'s target-user
 * existence check). No `dashboard-web` UI exists yet for this module (backend-only pass).
 */
@Module({
  imports: [AuthModule, AuthzModule, AuditModule, UsersModule],
  controllers: [DesignReviewsController],
  providers: [...designReviewCenterRepositoryProviders, DesignReviewsService],
  exports: [DesignReviewsService],
})
export class DesignReviewCenterModule {}
