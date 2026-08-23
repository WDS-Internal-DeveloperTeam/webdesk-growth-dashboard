import type { Provider } from "@nestjs/common";
import { PageRepository, PageUrlRepository } from "@webdesk/database";
import { PAGE_REPOSITORY, PAGE_URL_REPOSITORY } from "./page-inventory.constants.js";

/** DI wiring — same `useFactory` pattern as ../proof-and-claims-library/database.providers.ts. */
export const pageInventoryRepositoryProviders: Provider[] = [
  { provide: PAGE_REPOSITORY, useFactory: () => new PageRepository() },
  { provide: PAGE_URL_REPOSITORY, useFactory: () => new PageUrlRepository() },
];
