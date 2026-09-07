import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { AuthzModule } from "../authz/authz.module.js";
import { integrationsRepositoryProviders } from "./database.providers.js";
import { IntegrationsService } from "./integrations.service.js";
import { IntegrationsController } from "./integrations.controller.js";
import { IntegrationEnvironmentsService } from "./integration-environments.service.js";
import { IntegrationEnvironmentsController } from "./integration-environments.controller.js";
import { WebhookEventsService } from "./webhook-events.service.js";
import {
  WebhookEventsController,
  WebhookEventsGlobalController,
} from "./webhook-events.controller.js";
import { SecretMetadataService } from "./secret-metadata.service.js";
import { SecretMetadataController } from "./secret-metadata.controller.js";

/**
 * The Integrations module (module #41, `docs/implementation/module-integrations.md`) —
 * record-keeping only (D1): tracks external-service connection status/config metadata and lets an
 * admin manually record a verification result, with no real outbound call to any provider. Four
 * tables: `integrations` (the primary record), `integration_environments` (a real one-to-many
 * sub-resource), `webhook_events` (an append-only delivery log), `secret_metadata` (which secret
 * exists, never the value).
 *
 * Imports `AuthModule` for `SessionGuard`/`OriginCheckGuard` and `AuditModule` for `AuditService`
 * (every create/update/verify/toggle-active/delete is audited). Imports `AuthzModule` only for
 * `PermissionGuard` — unlike Brand Library's/Service Library's own dynamic per-transition
 * `AuthorizationService.assertAllowed()` pattern, this module has no content-approval workflow;
 * every action here is a single flat RBAC action (`view`/`create`/`edit`/`review`/`configure`)
 * checked statically at the route via `@RequirePermission`, so no dynamic service-layer check is
 * needed. No `AuthorizationService.canViewConfidential()` usage — the module registry's own
 * seeded `confidentialityLevel` note ("secret values never stored") describes a schema design
 * constraint, not a redaction axis; no field here is ever conditionally hidden from an
 * authorized, `view`-holding caller.
 */
@Module({
  imports: [AuthModule, AuthzModule, AuditModule],
  controllers: [
    IntegrationsController,
    IntegrationEnvironmentsController,
    WebhookEventsController,
    WebhookEventsGlobalController,
    SecretMetadataController,
  ],
  providers: [
    ...integrationsRepositoryProviders,
    IntegrationsService,
    IntegrationEnvironmentsService,
    WebhookEventsService,
    SecretMetadataService,
  ],
  exports: [
    IntegrationsService,
    IntegrationEnvironmentsService,
    WebhookEventsService,
    SecretMetadataService,
  ],
})
export class IntegrationsModule {}
