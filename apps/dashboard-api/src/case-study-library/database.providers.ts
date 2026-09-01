import type { Provider } from "@nestjs/common";
import { CaseStudyLibraryRecordRepository } from "@webdesk/database";
import { CASE_STUDY_LIBRARY_RECORD_REPOSITORY } from "./case-study-library.constants.js";

/** DI wiring — same `useFactory` pattern as ../case-study-studio/database.providers.ts. */
export const caseStudyLibraryRepositoryProviders: Provider[] = [
  {
    provide: CASE_STUDY_LIBRARY_RECORD_REPOSITORY,
    useFactory: () => new CaseStudyLibraryRecordRepository(),
  },
];
