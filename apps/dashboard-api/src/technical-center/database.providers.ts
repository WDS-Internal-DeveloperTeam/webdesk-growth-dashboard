import type { Provider } from "@nestjs/common";
import {
  TechnicalCheckDefinitionRepository,
  TechnicalCheckRunRepository,
  TechnicalFindingRepository,
} from "@webdesk/database";
import {
  TECHNICAL_CHECK_DEFINITION_REPOSITORY,
  TECHNICAL_CHECK_RUN_REPOSITORY,
  TECHNICAL_FINDING_REPOSITORY,
} from "./technical-center.constants.js";

/** DI wiring — same `useFactory` pattern as ../scan-center/database.providers.ts. */
export const technicalCenterRepositoryProviders: Provider[] = [
  {
    provide: TECHNICAL_CHECK_DEFINITION_REPOSITORY,
    useFactory: () => new TechnicalCheckDefinitionRepository(),
  },
  { provide: TECHNICAL_CHECK_RUN_REPOSITORY, useFactory: () => new TechnicalCheckRunRepository() },
  { provide: TECHNICAL_FINDING_REPOSITORY, useFactory: () => new TechnicalFindingRepository() },
];
