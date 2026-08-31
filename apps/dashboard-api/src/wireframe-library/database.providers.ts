import type { Provider } from "@nestjs/common";
import { WireframeRecordRepository } from "@webdesk/database";
import { WIREFRAME_RECORD_REPOSITORY } from "./wireframe-library.constants.js";

/** DI wiring — same `useFactory` pattern as ../section-and-pattern-library/database.providers.ts. */
export const wireframeLibraryRepositoryProviders: Provider[] = [
  {
    provide: WIREFRAME_RECORD_REPOSITORY,
    useFactory: () => new WireframeRecordRepository(),
  },
];
