import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { AuthzModule } from "../authz/authz.module.js";
import { UsersModule } from "../users/users.module.js";
import { serviceLibraryRepositoryProviders } from "./database.providers.js";
import { ServicesService } from "./services.service.js";
import { ServicesController } from "./services.controller.js";
import { ServiceLibraryDimensionsService } from "./service-library-dimensions.service.js";
import { ServiceLibraryDimensionsController } from "./service-library-dimensions.controller.js";

/**
 * The Service Library module (`docs/task-packages/module-service-library.md`) — the third real
 * business module built on the Phase 1F application shell / canonical module registry, after
 * Projects and Business Knowledge Center. Imports `AuthModule` for
 * `SessionGuard`/`OriginCheckGuard`, `AuthzModule` for `PermissionGuard`/`AuthorizationService`
 * (the dynamic per-transition permission check in `ServicesService.changeApprovalStatus()`),
 * `AuditModule` for `AuditService` (create/update/status transitions are all audited), and
 * `UsersModule` for `UsersService` (`ownerUserId` existence validation, mirroring
 * `ProjectService.assertOwnerExists()`'s own precedent — code-review finding). `ServicesService`
 * (not the write-capable `SERVICE_REPOSITORY` token itself) is what `PersonaLibraryModule`/
 * `ProofAndClaimsLibraryModule` import to validate their own `relatedServiceIds` fields against
 * real services, via `ServicesService.existingServiceIds()` — a narrow, read-only delegating
 * method (code-review finding, `module-proof-and-claims-library` branch: exporting the raw
 * repository directly was accepted as debt for a single consumer, Persona Library, on the
 * explicit condition it be closed once a second consumer appeared; Proof and Claims Library was
 * that second consumer, mirroring the identical `USER_ROLE_REPOSITORY`/`AuthzModule` fix already
 * made once for this exact pattern).
 */
@Module({
  imports: [AuthModule, AuthzModule, AuditModule, UsersModule],
  controllers: [ServicesController, ServiceLibraryDimensionsController],
  providers: [
    ...serviceLibraryRepositoryProviders,
    ServicesService,
    ServiceLibraryDimensionsService,
  ],
  exports: [ServicesService],
})
export class ServiceLibraryModule {}
