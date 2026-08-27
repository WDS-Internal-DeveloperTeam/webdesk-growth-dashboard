import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { AuthzModule } from "../authz/authz.module.js";
import { designTokenLibraryRepositoryProviders } from "./database.providers.js";
import { DesignTokensService } from "./design-tokens.service.js";
import { DesignTokensController } from "./design-tokens.controller.js";

/**
 * The Design Token Library module — module #14 on the Recommended Module Roadmap, built on the
 * Phase 1F application shell / canonical module registry, mirroring Website Strategy Center's own
 * real-version-history pattern. Imports `AuthModule` for `SessionGuard`/`OriginCheckGuard`,
 * `AuthzModule` for `PermissionGuard`/`AuthorizationService` (the dynamic per-transition
 * permission check in `DesignTokensService.changeApprovalStatus()`), and `AuditModule` for
 * `AuditService` (create/update/new-version/status transitions are all audited). No other module
 * import — `usageReferences` is a plain, unvalidated string array (design decision 3), so unlike
 * Persona Library/Proof and Claims Library (which both import `ServiceLibraryModule` for
 * `relatedServiceIds` existence validation), there is nothing here to validate against another
 * module. No `AuthorizationService.canViewConfidential()` usage — no confidential-field mechanism
 * exists here, matching Persona Library/Proof and Claims Library/Website Strategy Center: the
 * module registry's own seeded `confidentialityLevel` for `design_token_library` is `null`
 * (migration `00035`).
 */
@Module({
  imports: [AuthModule, AuthzModule, AuditModule],
  controllers: [DesignTokensController],
  providers: [...designTokenLibraryRepositoryProviders, DesignTokensService],
  exports: [DesignTokensService],
})
export class DesignTokenLibraryModule {}
