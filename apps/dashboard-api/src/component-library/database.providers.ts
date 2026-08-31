import type { Provider } from "@nestjs/common";
import { ComponentRepository } from "@webdesk/database";
import { COMPONENT_REPOSITORY } from "./component-library.constants.js";

/** DI wiring — same `useFactory` pattern as ../design-token-library/database.providers.ts /
 *  ../persona-library/database.providers.ts. */
export const componentLibraryRepositoryProviders: Provider[] = [
  {
    provide: COMPONENT_REPOSITORY,
    useFactory: () => new ComponentRepository(),
  },
];
