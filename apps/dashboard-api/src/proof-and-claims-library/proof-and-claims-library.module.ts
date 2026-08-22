import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { AuthzModule } from "../authz/authz.module.js";
import { ServiceLibraryModule } from "../service-library/service-library.module.js";
import { proofAndClaimsLibraryRepositoryProviders } from "./database.providers.js";
import { ClaimsService } from "./claims.service.js";
import { ClaimsController } from "./claims.controller.js";
import { ClaimSourcesService } from "./claim-sources.service.js";
import { ClaimSourcesController } from "./claim-sources.controller.js";

/**
 * The Proof and Claims Library module — the fifth real business module built on the Phase 1F
 * application shell / canonical module registry, after Projects, Business Knowledge Center,
 * Service Library, and Persona Library. Imports `AuthModule` for
 * `SessionGuard`/`OriginCheckGuard`, `AuthzModule` for `PermissionGuard`/`AuthorizationService`
 * (the dynamic per-transition permission check in `ClaimsService.changeApprovalStatus()`),
 * `AuditModule` for `AuditService` (claim/source create/update/delete and status transitions are
 * all audited), and `ServiceLibraryModule` for its exported `SERVICE_REPOSITORY`
 * (`relatedServiceIds` existence validation — mirrors `PersonaLibraryModule`'s own identical
 * reuse). No `UsersModule` import — this module has no `ownerUserId`/`parentServiceId`-style
 * field needing existence validation. No `AuthorizationService.canViewConfidential()` usage — no
 * confidential-field mechanism exists here, matching Persona Library: the module registry's own
 * seeded `confidentialityLevel` for `proof_and_claims_library` is `null` (migration `00035`), the
 * same value Persona Library's own entry has, and the advisory-only
 * `Recommended_Module_Roadmap.md`'s "confidential claims need separate access control" note
 * "is recorded-for-reference only and authorizes nothing" per this project's own standing rule —
 * the module registry's own real seeded data wins.
 */
@Module({
  imports: [AuthModule, AuthzModule, AuditModule, ServiceLibraryModule],
  controllers: [ClaimsController, ClaimSourcesController],
  providers: [...proofAndClaimsLibraryRepositoryProviders, ClaimsService, ClaimSourcesService],
  exports: [ClaimsService],
})
export class ProofAndClaimsLibraryModule {}
