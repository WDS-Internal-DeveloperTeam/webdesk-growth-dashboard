import type { Provider } from "@nestjs/common";
import { ChangeRecordRepository } from "@webdesk/database";
import { CHANGE_RECORD_REPOSITORY } from "./change-center.constants.js";

/** DI wiring — same `useFactory` pattern as ../scan-center/database.providers.ts. */
export const changeCenterRepositoryProviders: Provider[] = [
  { provide: CHANGE_RECORD_REPOSITORY, useFactory: () => new ChangeRecordRepository() },
];
