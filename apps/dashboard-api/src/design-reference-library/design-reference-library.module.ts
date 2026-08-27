import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { AuthzModule } from "../authz/authz.module.js";
import { designReferenceLibraryRepositoryProviders } from "./database.providers.js";
import { DesignReferenceLibraryService } from "./design-reference-library.service.js";
import { DesignReferenceLibraryController } from "./design-reference-library.controller.js";

/**
 * The Design Reference Library module — module #14 on the Recommended Module Roadmap, the 14th
 * real business module built on the Phase 1F application shell / canonical module registry.
 * Imports `AuthModule` for `SessionGuard`/`OriginCheckGuard`, `AuthzModule` for
 * `PermissionGuard`/`AuthorizationService` (the dynamic per-transition permission check in
 * `DesignReferenceLibraryService.changeApprovalStatus()`, and the dynamic `publish`/`unpublish`
 * checks in `publish()`/`unpublish()`), and `AuditModule` for `AuditService` (create/update/
 * status-transition/publish/unpublish are all audited). No other module import — D10 names no
 * cross-module relationship fields for this module. No
 * `AuthorizationService.canViewConfidential()` usage — no confidential-field mechanism exists
 * here (the module registry's own seeded `confidentialityLevel` for `design_reference_library`
 * is `null`).
 */
@Module({
  imports: [AuthModule, AuthzModule, AuditModule],
  controllers: [DesignReferenceLibraryController],
  providers: [...designReferenceLibraryRepositoryProviders, DesignReferenceLibraryService],
  exports: [DesignReferenceLibraryService],
})
export class DesignReferenceLibraryModule {}
