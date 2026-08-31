import type { Provider } from "@nestjs/common";
import { SectionPatternRecordRepository } from "@webdesk/database";
import { SECTION_PATTERN_RECORD_REPOSITORY } from "./section-and-pattern-library.constants.js";

/** DI wiring — same `useFactory` pattern as ../design-token-library/database.providers.ts /
 *  ../website-strategy-center/database.providers.ts. */
export const sectionAndPatternLibraryRepositoryProviders: Provider[] = [
  {
    provide: SECTION_PATTERN_RECORD_REPOSITORY,
    useFactory: () => new SectionPatternRecordRepository(),
  },
];
