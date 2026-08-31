import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { AuthzModule } from "../authz/authz.module.js";
import { ComponentLibraryModule } from "../component-library/component-library.module.js";
import { motionAndInteractionLibraryRepositoryProviders } from "./database.providers.js";
import { MotionInteractionsService } from "./motion-interactions.service.js";
import { MotionInteractionsController } from "./motion-interactions.controller.js";

/**
 * The Motion and Interaction Library module — module #20 on the Recommended Module Roadmap,
 * built on the Phase 1F application shell / canonical module registry, mirroring Section and
 * Pattern Library's/Page Template Library's own real-version-history pattern. Imports
 * `AuthModule` for `SessionGuard`/`OriginCheckGuard`, `AuthzModule` for
 * `PermissionGuard`/`AuthorizationService` (the dynamic per-transition permission check in
 * `MotionInteractionsService.changeApprovalStatus()`), `AuditModule` for `AuditService`
 * (create/update/new-version/status transitions are all audited), and `ComponentLibraryModule`
 * for its exported `ComponentsService` (`relatedComponentIds` existence validation via
 * `ComponentsService.existingComponentIds()`, mirroring Page Template Library's own
 * `supportedComponentIds` import) — a narrow, read-only delegating method, not the write-capable
 * repository token directly, mirroring `PageTemplateLibraryModule`'s own identical reasoning. No
 * `AuthorizationService.canViewConfidential()` usage — no confidential-field mechanism exists
 * here, matching Section and Pattern Library/Page Template Library/Design Token Library: the
 * module registry's own seeded `confidentialityLevel` for `motion_and_interaction_library` is
 * `null` (migration `00035`). No publish/unpublish wiring — nothing in this module's own spec
 * entry names a publish concept, matching Design Token Library/Section and Pattern Library.
 */
@Module({
  imports: [AuthModule, AuthzModule, AuditModule, ComponentLibraryModule],
  controllers: [MotionInteractionsController],
  providers: [...motionAndInteractionLibraryRepositoryProviders, MotionInteractionsService],
  exports: [MotionInteractionsService],
})
export class MotionAndInteractionLibraryModule {}
