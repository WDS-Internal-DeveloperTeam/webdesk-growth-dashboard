import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { AuthzModule } from "../authz/authz.module.js";
import { contentTemplateLibraryRepositoryProviders } from "./database.providers.js";
import { ContentTemplatesService } from "./content-templates.service.js";
import { ContentTemplatesController } from "./content-templates.controller.js";

/**
 * The Content Template Library module — module #10 on the Recommended Module Roadmap, the 10th
 * real business module built on the Phase 1F application shell / canonical module registry.
 * Imports `AuthModule` for `SessionGuard`/`OriginCheckGuard`, `AuthzModule` for
 * `PermissionGuard`/`AuthorizationService` (the dynamic per-transition permission check in
 * `ContentTemplatesService.changeApprovalStatus()`, and the dynamic `publish`/`unpublish` checks
 * in `publish()`/`unpublish()` — the first real consumer of those two RBAC actions), and
 * `AuditModule` for `AuditService` (create/update/status-transition/publish/unpublish are all
 * audited). No other module import — task package D6/D7/D9 fabricate no cross-module relationship
 * fields (`pageType` is a free-text category label, not a validated FK into Page Inventory's
 * `pages` table), so unlike Persona Library/Proof and Claims Library (which import
 * `ServiceLibraryModule`), there is nothing here to validate against another module. No
 * `AuthorizationService.canViewConfidential()` usage — no confidential-field mechanism exists here
 * (D9, the module registry's own seeded `confidentialityLevel` for `content_template_library` is
 * `null`).
 */
@Module({
  imports: [AuthModule, AuthzModule, AuditModule],
  controllers: [ContentTemplatesController],
  providers: [...contentTemplateLibraryRepositoryProviders, ContentTemplatesService],
  exports: [ContentTemplatesService],
})
export class ContentTemplateLibraryModule {}
