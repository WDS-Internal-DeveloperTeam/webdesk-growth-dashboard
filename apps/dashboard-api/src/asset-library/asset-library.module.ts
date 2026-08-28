import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { AuthzModule } from "../authz/authz.module.js";
import { assetLibraryRepositoryProviders } from "./database.providers.js";
import { AssetsService } from "./assets.service.js";
import { AssetRelatedRecordsService } from "./asset-related-records.service.js";
import { AssetsController } from "./assets.controller.js";
import { AssetRelatedRecordsController } from "./asset-related-records.controller.js";

/**
 * The Asset Library module — module #15 on the Recommended Module Roadmap, the 14th real business
 * module built on the Phase 1F application shell / canonical module registry.
 *
 * Imports `AuthModule` for `SessionGuard`/`OriginCheckGuard`, `AuthzModule` for
 * `PermissionGuard`/`AuthorizationService`, and `AuditModule` for `AuditService`
 * (create/update/status-transition/publish/unpublish and every relationship mutation are audited).
 *
 * `AuthorizationService` is used for three distinct things here, more than most sibling modules:
 * the dynamic per-transition permission check in `AssetsService.changeApprovalStatus()`, the
 * dynamic `publish`/`unpublish` checks, and — unlike Brand Library — a real
 * `canViewConfidential()` gate driving `AssetsController`'s confidential-field redaction (D2),
 * since this module's own seeded `module_registry.confidentiality_level` is a real "record-level"
 * value rather than `null`. It also supplies `isValidModuleKey()`, which
 * `AssetRelatedRecordsService` uses to validate the polymorphic `moduleKey` against the real
 * module registry (D3) — deliberately via that narrow delegating method rather than importing
 * `ModuleRegistryRepository` across the module boundary.
 *
 * No other module import: D3's polymorphic relationships carry no foreign key, so nothing here
 * needs to reach into another business module's repositories.
 */
@Module({
  imports: [AuthModule, AuthzModule, AuditModule],
  controllers: [AssetsController, AssetRelatedRecordsController],
  providers: [...assetLibraryRepositoryProviders, AssetsService, AssetRelatedRecordsService],
  exports: [AssetsService, AssetRelatedRecordsService],
})
export class AssetLibraryModule {}
