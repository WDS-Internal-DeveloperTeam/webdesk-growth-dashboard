import type { Provider } from "@nestjs/common";
import { WebsiteStrategyRecordRepository } from "@webdesk/database";
import { WEBSITE_STRATEGY_RECORD_REPOSITORY } from "./website-strategy-center.constants.js";

/** DI wiring — same `useFactory` pattern as ../persona-library/database.providers.ts. */
export const websiteStrategyCenterRepositoryProviders: Provider[] = [
  {
    provide: WEBSITE_STRATEGY_RECORD_REPOSITORY,
    useFactory: () => new WebsiteStrategyRecordRepository(),
  },
];
