import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { AuthzModule } from "../authz/authz.module.js";
import { DesignTokenLibraryModule } from "../design-token-library/design-token-library.module.js";
import { componentLibraryRepositoryProviders } from "./database.providers.js";
import { ComponentsService } from "./components.service.js";
import { ComponentsController } from "./components.controller.js";

/**
 * The Component Library module — module #17 on the Recommended Module Roadmap, built on the
 * Phase 1F application shell / canonical module registry, mirroring Design Token Library's own
 * real-version-history pattern. Imports `AuthModule` for `SessionGuard`/`OriginCheckGuard`,
 * `AuthzModule` for `PermissionGuard`/`AuthorizationService` (the dynamic per-transition
 * permission check in `ComponentsService.changeApprovalStatus()`), `AuditModule` for
 * `AuditService` (create/update/new-version/status transitions are all audited), and
 * `DesignTokenLibraryModule` for its exported `DesignTokensService` (`tokenIds` existence
 * validation via `DesignTokensService.existingTokenIds()`, a narrow read-only delegating method,
 * not the write-capable `DESIGN_TOKEN_REPOSITORY` token directly — mirrors
 * `PersonaLibraryModule`'s own `ServiceLibraryModule` import for the identical reason). No
 * `AuthorizationService.canViewConfidential()` usage — no confidential-field mechanism exists
 * here, matching Design Token Library/Persona Library/Proof and Claims Library: the module
 * registry's own seeded `confidentialityLevel` for `component_library` is `null`
 * (migration `00035`). No publish/unpublish wiring — `creative_design`'s seeded `P`/`X` grants
 * stay unwired here too, matching Design Token Library's own established precedent (design
 * decision 5).
 */
@Module({
  imports: [AuthModule, AuthzModule, AuditModule, DesignTokenLibraryModule],
  controllers: [ComponentsController],
  providers: [...componentLibraryRepositoryProviders, ComponentsService],
  exports: [ComponentsService],
})
export class ComponentLibraryModule {}
