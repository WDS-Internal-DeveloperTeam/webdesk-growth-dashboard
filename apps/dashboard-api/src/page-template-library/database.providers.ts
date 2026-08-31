import type { Provider } from "@nestjs/common";
import { PageTemplateRepository } from "@webdesk/database";
import { PAGE_TEMPLATE_REPOSITORY } from "./page-template-library.constants.js";

/** DI wiring — same `useFactory` pattern as ../component-library/database.providers.ts /
 *  ../section-and-pattern-library/database.providers.ts. */
export const pageTemplateLibraryRepositoryProviders: Provider[] = [
  {
    provide: PAGE_TEMPLATE_REPOSITORY,
    useFactory: () => new PageTemplateRepository(),
  },
];
