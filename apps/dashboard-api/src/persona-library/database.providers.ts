import type { Provider } from "@nestjs/common";
import { PersonaRepository } from "@webdesk/database";
import { PERSONA_REPOSITORY } from "./persona-library.constants.js";

/** DI wiring — same `useFactory` pattern as ../service-library/database.providers.ts. */
export const personaLibraryRepositoryProviders: Provider[] = [
  { provide: PERSONA_REPOSITORY, useFactory: () => new PersonaRepository() },
];
