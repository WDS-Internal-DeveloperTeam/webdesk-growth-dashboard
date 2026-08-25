import type { Provider } from "@nestjs/common";
import {
  ReviewCommentRepository,
  ReviewDecisionRepository,
  ReviewRepository,
} from "@webdesk/database";
import {
  REVIEW_COMMENT_REPOSITORY,
  REVIEW_DECISION_REPOSITORY,
  REVIEW_REPOSITORY,
} from "./review-and-approval-center.constants.js";

/** DI wiring — same `useFactory` pattern as ../content-template-library/database.providers.ts. */
export const reviewAndApprovalCenterRepositoryProviders: Provider[] = [
  { provide: REVIEW_REPOSITORY, useFactory: () => new ReviewRepository() },
  { provide: REVIEW_COMMENT_REPOSITORY, useFactory: () => new ReviewCommentRepository() },
  { provide: REVIEW_DECISION_REPOSITORY, useFactory: () => new ReviewDecisionRepository() },
];
