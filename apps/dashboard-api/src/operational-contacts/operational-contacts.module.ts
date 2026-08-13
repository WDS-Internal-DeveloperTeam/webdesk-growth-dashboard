import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { AuthzModule } from "../authz/authz.module.js";
import { operationalContactsRepositoryProviders } from "./database.providers.js";
import { OperationalContactService } from "./operational-contact.service.js";
import { IncidentSeverityService } from "./incident-severity.service.js";
import { OperationalContactsController } from "./operational-contacts.controller.js";
import { IncidentSeverityController } from "./incident-severity.controller.js";

/**
 * Phase 1E — operational contacts slice
 * (docs/task-packages/phase-1e-operational-contacts.md). Imports
 * `AuthModule` for `SessionGuard`/`OriginCheckGuard`, `AuthzModule` for
 * `PermissionGuard`, and `AuditModule` for `AuditService` (contact
 * create/update are genuinely audit-worthy human actions).
 */
@Module({
  imports: [AuthModule, AuthzModule, AuditModule],
  controllers: [OperationalContactsController, IncidentSeverityController],
  providers: [
    ...operationalContactsRepositoryProviders,
    OperationalContactService,
    IncidentSeverityService,
  ],
  exports: [OperationalContactService, IncidentSeverityService],
})
export class OperationalContactsModule {}
