import type { Provider } from "@nestjs/common";
import {
  DeploymentRepository,
  ReleaseApprovalRepository,
  ReleaseArtifactRepository,
  ReleaseRepository,
  RollbackRecordRepository,
  SmokeTestRepository,
} from "@webdesk/database";
import {
  DEPLOYMENT_REPOSITORY,
  RELEASE_APPROVAL_REPOSITORY,
  RELEASE_ARTIFACT_REPOSITORY,
  RELEASE_REPOSITORY,
  ROLLBACK_RECORD_REPOSITORY,
  SMOKE_TEST_REPOSITORY,
} from "./release-center.constants.js";

/** DI wiring — same `useFactory` pattern as ../technical-center/database.providers.ts. */
export const releaseCenterRepositoryProviders: Provider[] = [
  { provide: RELEASE_REPOSITORY, useFactory: () => new ReleaseRepository() },
  { provide: RELEASE_ARTIFACT_REPOSITORY, useFactory: () => new ReleaseArtifactRepository() },
  { provide: RELEASE_APPROVAL_REPOSITORY, useFactory: () => new ReleaseApprovalRepository() },
  { provide: DEPLOYMENT_REPOSITORY, useFactory: () => new DeploymentRepository() },
  { provide: SMOKE_TEST_REPOSITORY, useFactory: () => new SmokeTestRepository() },
  { provide: ROLLBACK_RECORD_REPOSITORY, useFactory: () => new RollbackRecordRepository() },
];
