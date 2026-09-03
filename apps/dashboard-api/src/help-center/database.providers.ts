import type { Provider } from "@nestjs/common";
import { HelpArticleRepository } from "@webdesk/database";
import { HELP_ARTICLE_REPOSITORY } from "./help-center.constants.js";

/** DI wiring — same `useFactory` pattern as ../content-template-library/database.providers.ts. */
export const helpCenterRepositoryProviders: Provider[] = [
  { provide: HELP_ARTICLE_REPOSITORY, useFactory: () => new HelpArticleRepository() },
];
