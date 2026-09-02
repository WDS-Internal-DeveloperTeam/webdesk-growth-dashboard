import type { Provider } from "@nestjs/common";
import {
  ScanDefinitionRepository,
  ScanEvidenceRepository,
  ScanFindingRepository,
  ScanRunRepository,
} from "@webdesk/database";
import {
  SCAN_DEFINITION_REPOSITORY,
  SCAN_EVIDENCE_REPOSITORY,
  SCAN_FINDING_REPOSITORY,
  SCAN_RUN_REPOSITORY,
} from "./scan-center.constants.js";

/** DI wiring — same `useFactory` pattern as ../internal-linking-library/database.providers.ts. */
export const scanCenterRepositoryProviders: Provider[] = [
  { provide: SCAN_DEFINITION_REPOSITORY, useFactory: () => new ScanDefinitionRepository() },
  { provide: SCAN_RUN_REPOSITORY, useFactory: () => new ScanRunRepository() },
  { provide: SCAN_FINDING_REPOSITORY, useFactory: () => new ScanFindingRepository() },
  { provide: SCAN_EVIDENCE_REPOSITORY, useFactory: () => new ScanEvidenceRepository() },
];
