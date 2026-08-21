import type { Provider } from "@nestjs/common";
import {
  DeliverableRepository,
  EngagementModelRepository,
  PlatformTechnologyRepository,
  ServiceCategoryRepository,
  ServiceRelationshipRepository,
  ServiceRepository,
} from "@webdesk/database";
import {
  DELIVERABLE_REPOSITORY,
  ENGAGEMENT_MODEL_REPOSITORY,
  PLATFORM_TECHNOLOGY_REPOSITORY,
  SERVICE_CATEGORY_REPOSITORY,
  SERVICE_RELATIONSHIP_REPOSITORY,
  SERVICE_REPOSITORY,
} from "./service-library.constants.js";

/** DI wiring — same `useFactory` pattern as ../projects/database.providers.ts. */
export const serviceLibraryRepositoryProviders: Provider[] = [
  { provide: SERVICE_REPOSITORY, useFactory: () => new ServiceRepository() },
  { provide: SERVICE_CATEGORY_REPOSITORY, useFactory: () => new ServiceCategoryRepository() },
  { provide: DELIVERABLE_REPOSITORY, useFactory: () => new DeliverableRepository() },
  {
    provide: PLATFORM_TECHNOLOGY_REPOSITORY,
    useFactory: () => new PlatformTechnologyRepository(),
  },
  { provide: ENGAGEMENT_MODEL_REPOSITORY, useFactory: () => new EngagementModelRepository() },
  {
    provide: SERVICE_RELATIONSHIP_REPOSITORY,
    useFactory: () => new ServiceRelationshipRepository(),
  },
];
