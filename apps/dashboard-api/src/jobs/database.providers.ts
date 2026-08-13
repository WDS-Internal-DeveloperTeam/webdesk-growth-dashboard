import type { Provider } from "@nestjs/common";
import { IdempotencyKeyRepository, JobAttemptRepository, JobRepository } from "@webdesk/database";
import {
  IDEMPOTENCY_KEY_REPOSITORY,
  JOB_ATTEMPT_REPOSITORY,
  JOB_REPOSITORY,
} from "./jobs.constants.js";

/** DI wiring for `packages/database`'s job/idempotency repositories — same `useFactory` pattern as ../audit/database.providers.ts (no constructor dependencies to resolve). */
export const jobsRepositoryProviders: Provider[] = [
  { provide: JOB_REPOSITORY, useFactory: () => new JobRepository() },
  { provide: JOB_ATTEMPT_REPOSITORY, useFactory: () => new JobAttemptRepository() },
  { provide: IDEMPOTENCY_KEY_REPOSITORY, useFactory: () => new IdempotencyKeyRepository() },
];
