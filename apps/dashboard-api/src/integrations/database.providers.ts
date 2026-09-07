import type { Provider } from "@nestjs/common";
import {
  IntegrationEnvironmentRepository,
  IntegrationRepository,
  SecretMetadataRepository,
  WebhookEventRepository,
} from "@webdesk/database";
import {
  INTEGRATION_ENVIRONMENT_REPOSITORY,
  INTEGRATION_REPOSITORY,
  SECRET_METADATA_REPOSITORY,
  WEBHOOK_EVENT_REPOSITORY,
} from "./integrations.constants.js";

/** DI wiring — same `useFactory` pattern as ../scan-center/database.providers.ts. */
export const integrationsRepositoryProviders: Provider[] = [
  { provide: INTEGRATION_REPOSITORY, useFactory: () => new IntegrationRepository() },
  {
    provide: INTEGRATION_ENVIRONMENT_REPOSITORY,
    useFactory: () => new IntegrationEnvironmentRepository(),
  },
  { provide: WEBHOOK_EVENT_REPOSITORY, useFactory: () => new WebhookEventRepository() },
  { provide: SECRET_METADATA_REPOSITORY, useFactory: () => new SecretMetadataRepository() },
];
