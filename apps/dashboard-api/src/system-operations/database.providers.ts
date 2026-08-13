import type { Provider } from "@nestjs/common";
import {
  SystemComponentRepository,
  SystemEventRepository,
  SystemHealthCheckRepository,
} from "@webdesk/database";
import {
  SYSTEM_COMPONENT_REPOSITORY,
  SYSTEM_EVENT_REPOSITORY,
  SYSTEM_HEALTH_CHECK_REPOSITORY,
} from "./system-operations.constants.js";

/** DI wiring — same `useFactory` pattern as ../audit/database.providers.ts and ../jobs/database.providers.ts. */
export const systemOperationsRepositoryProviders: Provider[] = [
  { provide: SYSTEM_EVENT_REPOSITORY, useFactory: () => new SystemEventRepository() },
  { provide: SYSTEM_COMPONENT_REPOSITORY, useFactory: () => new SystemComponentRepository() },
  {
    provide: SYSTEM_HEALTH_CHECK_REPOSITORY,
    useFactory: () => new SystemHealthCheckRepository(),
  },
];
