import type { Provider } from "@nestjs/common";
import { DesignTokenRepository } from "@webdesk/database";
import { DESIGN_TOKEN_REPOSITORY } from "./design-token-library.constants.js";

/** DI wiring — same `useFactory` pattern as ../website-strategy-center/database.providers.ts /
 *  ../persona-library/database.providers.ts. */
export const designTokenLibraryRepositoryProviders: Provider[] = [
  {
    provide: DESIGN_TOKEN_REPOSITORY,
    useFactory: () => new DesignTokenRepository(),
  },
];
