import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { AuthzModule } from "../authz/authz.module.js";
import { AssetLibraryModule } from "../asset-library/asset-library.module.js";
import { ProofAndClaimsLibraryModule } from "../proof-and-claims-library/proof-and-claims-library.module.js";
import { portfolioLibraryRepositoryProviders } from "./database.providers.js";
import { PortfolioRecordsService } from "./portfolio-records.service.js";
import { PortfolioAssetsService } from "./portfolio-assets.service.js";
import {
  PortfolioAssetsController,
  PortfolioLibraryController,
} from "./portfolio-library.controller.js";

/**
 * The Portfolio Library module — module #25 on the Recommended Module Roadmap. Imports
 * `AuthModule` for `SessionGuard`/`OriginCheckGuard`, `AuthzModule` for
 * `PermissionGuard`/`AuthorizationService` (the dynamic per-transition permission check in
 * `PortfolioRecordsService.changeApprovalStatus()`, and the dynamic `publish`/`unpublish` checks
 * in `publish()`/`unpublish()`), `AuditModule` for `AuditService` (create/update/status-transition/
 * publish/unpublish and every screenshot-sub-resource mutation are audited),
 * `ProofAndClaimsLibraryModule` for its exported `ClaimsService` (`relatedProofIds` existence
 * validation via `ClaimsService.existingClaimIds()`, D3), and `AssetLibraryModule` for its
 * exported `AssetsService` (`portfolio_assets.assetId` existence validation via
 * `AssetsService.existingAssetIds()`, D2). No `AuthorizationService.canViewConfidential()` usage
 * — no confidential-field mechanism exists here; the module registry's own seeded
 * `confidentiality_level` for `portfolio_library` is a plain business-field description
 * ("record-level (has a visibility field; level unspecified)"), not an RBAC confidential-field
 * axis — `visibility` is the real business concept here (D4/D8), matching Case Study Studio's/
 * Persona Library's own precedent.
 */
@Module({
  imports: [AuthModule, AuthzModule, AuditModule, ProofAndClaimsLibraryModule, AssetLibraryModule],
  controllers: [PortfolioLibraryController, PortfolioAssetsController],
  providers: [
    ...portfolioLibraryRepositoryProviders,
    PortfolioRecordsService,
    PortfolioAssetsService,
  ],
  exports: [PortfolioRecordsService],
})
export class PortfolioLibraryModule {}
