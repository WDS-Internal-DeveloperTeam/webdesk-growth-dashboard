import type { Provider } from "@nestjs/common";
import { SystemSettingRepository } from "@webdesk/database";
import { SYSTEM_SETTING_REPOSITORY } from "./system-settings.constants.js";

/** DI wiring — same `useFactory` pattern as ../brand-library/database.providers.ts. */
export const systemSettingsRepositoryProviders: Provider[] = [
  {
    provide: SYSTEM_SETTING_REPOSITORY,
    useFactory: () => new SystemSettingRepository(),
  },
];
