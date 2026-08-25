import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { AuthzModule } from "../authz/authz.module.js";
import { UsersModule } from "../users/users.module.js";
import { reviewAndApprovalCenterRepositoryProviders } from "./database.providers.js";
import { ReviewsService } from "./reviews.service.js";
import { ReviewsController } from "./reviews.controller.js";
import { ReviewCommentsService } from "./review-comments.service.js";
import { ReviewCommentsController } from "./review-comments.controller.js";

/**
 * The Review and Approval Center module — module #11 on the Recommended Module Roadmap, the 11th
 * real business module built on the Phase 1F application shell / canonical module registry, and
 * the first that is a cross-cutting **engine** attaching to records owned by OTHER modules
 * (`target_module_key`/`target_id`), not a single content-record library of its own (task package
 * §1/D1). Imports `AuthModule` for `SessionGuard`/`OriginCheckGuard`/`SeparationOfDutiesService`
 * (`ReviewsService.decide()`'s own separation-of-duties check, task package D4 — the first real
 * consumer of `SeparationOfDutiesService.assertDistinctActors()` outside `RoleAssignmentService`/
 * `RecoveryService`), `AuthzModule` for `PermissionGuard`/`AuthorizationService` (the dynamic
 * per-action `decide()` check, and `isValidModuleKey()` — `create()`'s own `target_module_key`
 * validation, task package D6), `AuditModule` for `AuditService` (every `decide()` call is
 * approval-shaped and mirrored into `audit_events`, task package D5), and `UsersModule` for
 * `UsersService` (`assignedToUserId`/`delegate()`'s target-user existence checks, mirroring
 * `InternalLinksService`'s own precedent). No `dashboard-web` UI exists yet for this module (task
 * package §5, backend-only pass).
 */
@Module({
  imports: [AuthModule, AuthzModule, AuditModule, UsersModule],
  controllers: [ReviewsController, ReviewCommentsController],
  providers: [...reviewAndApprovalCenterRepositoryProviders, ReviewsService, ReviewCommentsService],
  exports: [ReviewsService],
})
export class ReviewAndApprovalCenterModule {}
