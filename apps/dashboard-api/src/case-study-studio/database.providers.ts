import type { Provider } from "@nestjs/common";
import {
  CaseStudyApprovalRepository,
  CaseStudyAssetRepository,
  CaseStudyConsentRepository,
  CaseStudyRepository,
} from "@webdesk/database";
import {
  CASE_STUDY_APPROVAL_REPOSITORY,
  CASE_STUDY_ASSET_REPOSITORY,
  CASE_STUDY_CONSENT_REPOSITORY,
  CASE_STUDY_REPOSITORY,
} from "./case-study-studio.constants.js";

/** DI wiring — same `useFactory` pattern as ../proof-and-claims-library/database.providers.ts. */
export const caseStudyStudioRepositoryProviders: Provider[] = [
  { provide: CASE_STUDY_REPOSITORY, useFactory: () => new CaseStudyRepository() },
  { provide: CASE_STUDY_ASSET_REPOSITORY, useFactory: () => new CaseStudyAssetRepository() },
  { provide: CASE_STUDY_CONSENT_REPOSITORY, useFactory: () => new CaseStudyConsentRepository() },
  { provide: CASE_STUDY_APPROVAL_REPOSITORY, useFactory: () => new CaseStudyApprovalRepository() },
];
