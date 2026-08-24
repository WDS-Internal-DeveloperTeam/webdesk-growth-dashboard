import type { Provider } from "@nestjs/common";
import { InternalLinkRepository } from "@webdesk/database";
import { INTERNAL_LINK_REPOSITORY } from "./internal-linking-library.constants.js";

/** DI wiring — same `useFactory` pattern as ../keyword-and-entity-library/database.providers.ts. */
export const internalLinkingLibraryRepositoryProviders: Provider[] = [
  { provide: INTERNAL_LINK_REPOSITORY, useFactory: () => new InternalLinkRepository() },
];
