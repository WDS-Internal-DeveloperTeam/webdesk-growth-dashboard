import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { AuthzModule } from "../authz/authz.module.js";
import { sectionAndPatternLibraryRepositoryProviders } from "./database.providers.js";
import { SectionPatternsService } from "./section-patterns.service.js";
import { SectionPatternsController } from "./section-patterns.controller.js";

/**
 * The Section and Pattern Library module — module #15 on the Recommended Module Roadmap, built on
 * the Phase 1F application shell / canonical module registry, mirroring Design Token Library's own
 * real-version-history pattern. Imports `AuthModule` for `SessionGuard`/`OriginCheckGuard`,
 * `AuthzModule` for `PermissionGuard`/`AuthorizationService` (the dynamic per-transition
 * permission check in `SectionPatternsService.changeApprovalStatus()`), and `AuditModule` for
 * `AuditService` (create/update/new-version/status transitions are all audited). No other module
 * import — `jsDependencies`/`tokenReferences`/`relatedComponentIds` are all plain, unvalidated
 * string arrays (design decision), so there is nothing here to validate against another module.
 * No `AuthorizationService.canViewConfidential()` usage — no confidential-field mechanism exists
 * here, matching Design Token Library/Persona Library/Proof and Claims Library/Website Strategy
 * Center: the module registry's own seeded `confidentialityLevel` for `section_and_pattern_library`
 * is `null` (migration `00035`).
 */
@Module({
  imports: [AuthModule, AuthzModule, AuditModule],
  controllers: [SectionPatternsController],
  providers: [...sectionAndPatternLibraryRepositoryProviders, SectionPatternsService],
  exports: [SectionPatternsService],
})
export class SectionAndPatternLibraryModule {}
