import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { AuthzModule } from "../authz/authz.module.js";
import { ServiceLibraryModule } from "../service-library/service-library.module.js";
import { personaLibraryRepositoryProviders } from "./database.providers.js";
import { PersonasService } from "./personas.service.js";
import { PersonasController } from "./personas.controller.js";

/**
 * The Persona Library module — the fourth real business module built on the Phase 1F application
 * shell / canonical module registry, after Projects, Business Knowledge Center, and Service
 * Library. Imports `AuthModule` for `SessionGuard`/`OriginCheckGuard`, `AuthzModule` for
 * `PermissionGuard`/`AuthorizationService` (the dynamic per-transition permission check in
 * `PersonasService.changeApprovalStatus()`), `AuditModule` for `AuditService` (create/update/
 * status transitions are all audited), and `ServiceLibraryModule` for its exported
 * `SERVICE_REPOSITORY` (`relatedServiceIds` existence validation, code-review finding — closes the
 * gap that made this field weaker than the precedent it claimed to follow, since `services`
 * already exists unlike Service Library's own genuinely-nonexistent `icpIds` targets). No
 * `UsersModule` import — unlike Service Library/Projects, this module has no
 * `ownerUserId`/`parentServiceId`-style field needing existence validation (D7), and no
 * `AuthorizationService.canViewConfidential()` usage — no confidential-field mechanism exists here
 * (D6, the module registry's own seeded `confidentialityLevel: null`).
 */
@Module({
  imports: [AuthModule, AuthzModule, AuditModule, ServiceLibraryModule],
  controllers: [PersonasController],
  providers: [...personaLibraryRepositoryProviders, PersonasService],
  exports: [PersonasService],
})
export class PersonaLibraryModule {}
