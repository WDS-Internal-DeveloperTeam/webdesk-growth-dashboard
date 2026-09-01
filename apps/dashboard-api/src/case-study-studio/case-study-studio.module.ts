import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { AuthzModule } from "../authz/authz.module.js";
import { ServiceLibraryModule } from "../service-library/service-library.module.js";
import { ProofAndClaimsLibraryModule } from "../proof-and-claims-library/proof-and-claims-library.module.js";
import { AssetLibraryModule } from "../asset-library/asset-library.module.js";
import { UsersModule } from "../users/users.module.js";
import { caseStudyStudioRepositoryProviders } from "./database.providers.js";
import { CaseStudiesService } from "./case-studies.service.js";
import { CaseStudiesController } from "./case-studies.controller.js";
import { CaseStudyAssetsService } from "./case-study-assets.service.js";
import { CaseStudyAssetsController } from "./case-study-assets.controller.js";
import { CaseStudyConsentsService } from "./case-study-consents.service.js";
import { CaseStudyConsentsController } from "./case-study-consents.controller.js";

/**
 * Case Study Studio — module #23 on the Recommended Module Roadmap. Imports `AuthModule` for
 * `SessionGuard`/`OriginCheckGuard`, `AuthzModule` for `PermissionGuard`/`AuthorizationService`
 * (the dynamic per-transition permission check in `CaseStudiesService.changeStatus()`),
 * `AuditModule` for `AuditService` (create/update/status-transition and every sub-resource
 * mutation are audited), `ServiceLibraryModule` for its exported `ServicesService`
 * (`relatedServiceIds` existence validation via `ServicesService.existingServiceIds()`),
 * `ProofAndClaimsLibraryModule` for its exported `ClaimsService` (`relatedClaimIds` existence
 * validation via `ClaimsService.existingClaimIds()` — supersedes the canonical data-model doc's
 * own `case_study_claims` table name, D2), `AssetLibraryModule` for its exported `AssetsService`
 * (`case_study_assets.assetId` existence validation via `AssetsService.existingAssetIds()`, D3),
 * and `UsersModule` for its exported `UsersService` (`assignedReviewerUserId` existence
 * validation via `UsersService.assertUserExists()`).
 *
 * No `AuthorizationService.canViewConfidential()` usage — no confidential-field mechanism exists
 * here (D9), matching Persona Library/Website Strategy Center: the module registry's own seeded
 * `confidentiality_level` for `case_study_studio` is `null`.
 */
@Module({
  imports: [
    AuthModule,
    AuthzModule,
    AuditModule,
    ServiceLibraryModule,
    ProofAndClaimsLibraryModule,
    AssetLibraryModule,
    UsersModule,
  ],
  controllers: [CaseStudiesController, CaseStudyAssetsController, CaseStudyConsentsController],
  providers: [
    ...caseStudyStudioRepositoryProviders,
    CaseStudiesService,
    CaseStudyAssetsService,
    CaseStudyConsentsService,
  ],
  exports: [CaseStudiesService],
})
export class CaseStudyStudioModule {}
