import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { AuthzModule } from "../authz/authz.module.js";
import { brandLibraryRepositoryProviders } from "./database.providers.js";
import { BrandLibraryService } from "./brand-library.service.js";
import { BrandLibraryController } from "./brand-library.controller.js";

/**
 * The Brand Library module — module #13 on the Recommended Module Roadmap, the 13th real
 * business module built on the Phase 1F application shell / canonical module registry. Imports
 * `AuthModule` for `SessionGuard`/`OriginCheckGuard`, `AuthzModule` for
 * `PermissionGuard`/`AuthorizationService` (the dynamic per-transition permission check in
 * `BrandLibraryService.changeApprovalStatus()`, and the dynamic `publish`/`unpublish` checks in
 * `publish()`/`unpublish()`), and `AuditModule` for `AuditService` (create/update/status-
 * transition/publish/unpublish are all audited). No other module import — D7 names no
 * cross-module relationship fields for this module. No `AuthorizationService.canViewConfidential()`
 * usage — no confidential-field mechanism exists here (the module registry's own seeded
 * `confidentialityLevel` for `brand_library` is `null`).
 */
@Module({
  imports: [AuthModule, AuthzModule, AuditModule],
  controllers: [BrandLibraryController],
  providers: [...brandLibraryRepositoryProviders, BrandLibraryService],
  exports: [BrandLibraryService],
})
export class BrandLibraryModule {}
