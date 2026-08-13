import type { Provider } from "@nestjs/common";
import { RetentionHoldRepository, RetentionPolicyRepository } from "@webdesk/database";
import { RETENTION_HOLD_REPOSITORY, RETENTION_POLICY_REPOSITORY } from "./retention.constants.js";

/** DI wiring — same `useFactory` pattern as ../audit/database.providers.ts and ../jobs/database.providers.ts. */
export const retentionRepositoryProviders: Provider[] = [
  { provide: RETENTION_POLICY_REPOSITORY, useFactory: () => new RetentionPolicyRepository() },
  { provide: RETENTION_HOLD_REPOSITORY, useFactory: () => new RetentionHoldRepository() },
];
