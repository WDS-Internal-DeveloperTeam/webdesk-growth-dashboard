import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { AuthzModule } from "../authz/authz.module.js";
import { UsersModule } from "../users/users.module.js";
import { wireframeLibraryRepositoryProviders } from "./database.providers.js";
import { WireframesService } from "./wireframes.service.js";
import { WireframesController } from "./wireframes.controller.js";

/**
 * The Wireframe Library module — module #16 on the Recommended Module Roadmap, built on the
 * Phase 1F application shell / canonical module registry, mirroring Section and Pattern Library's
 * own real-version-history pattern. Imports `AuthModule` for `SessionGuard`/`OriginCheckGuard`,
 * `AuthzModule` for `PermissionGuard`/`AuthorizationService` (the dynamic per-transition
 * permission check in `WireframesService.changeApprovalStatus()`), `AuditModule` for
 * `AuditService` (create/update/new-version/status transitions are all audited), and `UsersModule`
 * for `UsersService.assertUserExists()` (`reviewerUserId`'s existence check). No other module
 * import — `relatedTemplateId` is a plain, unvalidated string (real dependency cycle with
 * `page_template_library`, which doesn't exist yet — see migration `00084`'s own doc comment), so
 * there is nothing here to validate against another module. No
 * `AuthorizationService.canViewConfidential()` usage — no confidential-field mechanism exists
 * here, matching Section and Pattern Library/Design Token Library/Persona Library/Proof and
 * Claims Library/Website Strategy Center: the module registry's own seeded
 * `confidentialityLevel` for `wireframe_library` is `null` (migration `00035`).
 */
@Module({
  imports: [AuthModule, AuthzModule, AuditModule, UsersModule],
  controllers: [WireframesController],
  providers: [...wireframeLibraryRepositoryProviders, WireframesService],
  exports: [WireframesService],
})
export class WireframeLibraryModule {}
