import type { Provider } from "@nestjs/common";
import { DesignReviewDecisionRepository, DesignReviewRepository } from "@webdesk/database";
import {
  DESIGN_REVIEW_DECISION_REPOSITORY,
  DESIGN_REVIEW_REPOSITORY,
} from "./design-review-center.constants.js";

/** DI wiring — same `useFactory` pattern as ../review-and-approval-center/database.providers.ts. */
export const designReviewCenterRepositoryProviders: Provider[] = [
  { provide: DESIGN_REVIEW_REPOSITORY, useFactory: () => new DesignReviewRepository() },
  {
    provide: DESIGN_REVIEW_DECISION_REPOSITORY,
    useFactory: () => new DesignReviewDecisionRepository(),
  },
];
