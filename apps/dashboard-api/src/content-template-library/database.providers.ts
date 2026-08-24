import type { Provider } from "@nestjs/common";
import { ContentTemplateRepository } from "@webdesk/database";
import { CONTENT_TEMPLATE_REPOSITORY } from "./content-template-library.constants.js";

/** DI wiring — same `useFactory` pattern as ../persona-library/database.providers.ts. */
export const contentTemplateLibraryRepositoryProviders: Provider[] = [
  { provide: CONTENT_TEMPLATE_REPOSITORY, useFactory: () => new ContentTemplateRepository() },
];
