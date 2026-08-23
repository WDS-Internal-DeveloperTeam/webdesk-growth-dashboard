import type { Provider } from "@nestjs/common";
import { ClaimSourceRepository, ProofClaimRepository } from "@webdesk/database";
import {
  CLAIM_SOURCE_REPOSITORY,
  PROOF_CLAIM_REPOSITORY,
} from "./proof-and-claims-library.constants.js";

/** DI wiring — same `useFactory` pattern as ../persona-library/database.providers.ts. */
export const proofAndClaimsLibraryRepositoryProviders: Provider[] = [
  { provide: PROOF_CLAIM_REPOSITORY, useFactory: () => new ProofClaimRepository() },
  { provide: CLAIM_SOURCE_REPOSITORY, useFactory: () => new ClaimSourceRepository() },
];
