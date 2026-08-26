import type { Provider } from "@nestjs/common";
import {
  PageArtifactRepository,
  PageArtifactVersionRepository,
  PageLifecycleRepository,
} from "@webdesk/database";
import {
  PAGE_ARTIFACT_REPOSITORY,
  PAGE_ARTIFACT_VERSION_REPOSITORY,
  PAGE_LIFECYCLE_REPOSITORY,
} from "./page-workspace.constants.js";

/** DI wiring — same `useFactory` pattern as ../page-inventory/database.providers.ts. */
export const pageWorkspaceRepositoryProviders: Provider[] = [
  { provide: PAGE_ARTIFACT_REPOSITORY, useFactory: () => new PageArtifactRepository() },
  {
    provide: PAGE_ARTIFACT_VERSION_REPOSITORY,
    useFactory: () => new PageArtifactVersionRepository(),
  },
  { provide: PAGE_LIFECYCLE_REPOSITORY, useFactory: () => new PageLifecycleRepository() },
];
