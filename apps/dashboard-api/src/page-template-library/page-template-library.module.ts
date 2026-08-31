import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { AuthzModule } from "../authz/authz.module.js";
import { ComponentLibraryModule } from "../component-library/component-library.module.js";
import { SectionAndPatternLibraryModule } from "../section-and-pattern-library/section-and-pattern-library.module.js";
import { pageTemplateLibraryRepositoryProviders } from "./database.providers.js";
import { PageTemplatesService } from "./page-templates.service.js";
import { PageTemplatesController } from "./page-templates.controller.js";

/**
 * The Page Template Library module — module #19 on the Recommended Module Roadmap, built on the
 * Phase 1F application shell / canonical module registry, mirroring Component Library's own
 * real-version-history pattern. Imports `AuthModule` for `SessionGuard`/`OriginCheckGuard`,
 * `AuthzModule` for `PermissionGuard`/`AuthorizationService` (the dynamic per-transition
 * permission check in `PageTemplatesService.changeApprovalStatus()`), `AuditModule` for
 * `AuditService` (create/update/new-version/status transitions are all audited),
 * `SectionAndPatternLibraryModule` for its exported `SectionPatternsService`
 * (`requiredSectionIds`/`optionalSectionIds` existence validation via
 * `SectionPatternsService.existingRecordIds()`, design decision D2), and `ComponentLibraryModule`
 * for its exported `ComponentsService` (`supportedComponentIds` existence validation via
 * `ComponentsService.existingComponentIds()`, design decision D3) — both narrow, read-only
 * delegating methods, not the write-capable repository tokens directly, mirroring
 * `ComponentLibraryModule`'s own `DesignTokenLibraryModule` import for the identical reason.
 * `wireframeReferences` is a plain, unvalidated string array (design decision D4) — no module
 * import for it, since `wireframe_library` doesn't exist yet. No
 * `AuthorizationService.canViewConfidential()` usage — no confidential-field mechanism exists
 * here, matching Design Token Library/Component Library/Section and Pattern Library: the module
 * registry's own seeded `confidentialityLevel` for `page_template_library` is `null`
 * (migration `00035`). No publish/unpublish wiring — `creative_design`'s seeded `P`/`X` grants
 * stay unwired here too, matching Component Library's own established precedent (design
 * decision D6).
 */
@Module({
  imports: [
    AuthModule,
    AuthzModule,
    AuditModule,
    SectionAndPatternLibraryModule,
    ComponentLibraryModule,
  ],
  controllers: [PageTemplatesController],
  providers: [...pageTemplateLibraryRepositoryProviders, PageTemplatesService],
  exports: [PageTemplatesService],
})
export class PageTemplateLibraryModule {}
