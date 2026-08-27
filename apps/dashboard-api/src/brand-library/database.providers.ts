import type { Provider } from "@nestjs/common";
import { BrandLibraryRecordRepository } from "@webdesk/database";
import { BRAND_LIBRARY_RECORD_REPOSITORY } from "./brand-library.constants.js";

/** DI wiring — same `useFactory` pattern as ../content-template-library/database.providers.ts. */
export const brandLibraryRepositoryProviders: Provider[] = [
  {
    provide: BRAND_LIBRARY_RECORD_REPOSITORY,
    useFactory: () => new BrandLibraryRecordRepository(),
  },
];
