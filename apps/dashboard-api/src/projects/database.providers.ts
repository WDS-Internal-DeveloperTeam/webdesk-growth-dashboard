import type { Provider } from "@nestjs/common";
import {
  ProjectEnvironmentRepository,
  ProjectObjectiveRepository,
  ProjectRepository,
  ProjectRepositoryRepository,
  ProjectUserRepository,
  RoadmapItemRepository,
} from "@webdesk/database";
import {
  PROJECT_ENVIRONMENT_REPOSITORY,
  PROJECT_OBJECTIVE_REPOSITORY,
  PROJECT_REPOSITORY,
  PROJECT_REPOSITORY_REPOSITORY,
  PROJECT_USER_REPOSITORY,
  ROADMAP_ITEM_REPOSITORY,
} from "./projects.constants.js";

/** DI wiring — same `useFactory` pattern as ../audit/database.providers.ts and ../operational-contacts/database.providers.ts. */
export const projectsRepositoryProviders: Provider[] = [
  { provide: PROJECT_REPOSITORY, useFactory: () => new ProjectRepository() },
  { provide: PROJECT_ENVIRONMENT_REPOSITORY, useFactory: () => new ProjectEnvironmentRepository() },
  { provide: PROJECT_REPOSITORY_REPOSITORY, useFactory: () => new ProjectRepositoryRepository() },
  { provide: PROJECT_USER_REPOSITORY, useFactory: () => new ProjectUserRepository() },
  { provide: PROJECT_OBJECTIVE_REPOSITORY, useFactory: () => new ProjectObjectiveRepository() },
  { provide: ROADMAP_ITEM_REPOSITORY, useFactory: () => new RoadmapItemRepository() },
];
