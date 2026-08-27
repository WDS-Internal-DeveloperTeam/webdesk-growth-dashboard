import type { Provider } from "@nestjs/common";
import { DesignReferenceRecordRepository } from "@webdesk/database";
import { DESIGN_REFERENCE_RECORD_REPOSITORY } from "./design-reference-library.constants.js";

/** DI wiring — same `useFactory` pattern as ../brand-library/database.providers.ts. */
export const designReferenceLibraryRepositoryProviders: Provider[] = [
  {
    provide: DESIGN_REFERENCE_RECORD_REPOSITORY,
    useFactory: () => new DesignReferenceRecordRepository(),
  },
];
