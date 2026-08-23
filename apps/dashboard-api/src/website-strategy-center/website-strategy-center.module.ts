import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { AuthzModule } from "../authz/authz.module.js";
import { websiteStrategyCenterRepositoryProviders } from "./database.providers.js";
import { WebsiteStrategyRecordsService } from "./website-strategy-records.service.js";
import { WebsiteStrategyRecordsController } from "./website-strategy-records.controller.js";

/**
 * The Website Strategy Center module — the 6th real business module built on the Phase 1F
 * application shell / canonical module registry, after Projects, Business Knowledge Center,
 * Service Library, Persona Library, and Proof and Claims Library. Imports `AuthModule` for
 * `SessionGuard`/`OriginCheckGuard`, `AuthzModule` for `PermissionGuard`/`AuthorizationService`
 * (the dynamic per-transition permission check in
 * `WebsiteStrategyRecordsService.changeApprovalStatus()`), and `AuditModule` for `AuditService`
 * (create/update/new-version/status transitions are all audited). No other module import — task
 * package D8 explicitly fabricates no cross-module relationship fields (the module registry's
 * own seeded `dependencies: ["page_inventory", "internal_linking_library"]` names two modules
 * that don't exist yet, and there is a real circular metadata dependency between this module and
 * `internal_linking_library` in the registry's own seed data — each names the other), so unlike
 * Persona Library/Proof and Claims Library (which both import `ServiceLibraryModule` for
 * `relatedServiceIds` existence validation), there is nothing here to validate against another
 * module. No `AuthorizationService.canViewConfidential()` usage — no confidential-field mechanism
 * exists here, matching Persona Library/Proof and Claims Library: the module registry's own
 * seeded `confidentialityLevel` for `website_strategy_center` is `null` (migration `00035`).
 */
@Module({
  imports: [AuthModule, AuthzModule, AuditModule],
  controllers: [WebsiteStrategyRecordsController],
  providers: [...websiteStrategyCenterRepositoryProviders, WebsiteStrategyRecordsService],
  exports: [WebsiteStrategyRecordsService],
})
export class WebsiteStrategyCenterModule {}
