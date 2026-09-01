import type { Provider } from "@nestjs/common";
import { PortfolioAssetRepository, PortfolioRecordRepository } from "@webdesk/database";
import {
  PORTFOLIO_ASSET_REPOSITORY,
  PORTFOLIO_RECORD_REPOSITORY,
} from "./portfolio-library.constants.js";

/** DI wiring — same `useFactory` pattern as ../content-template-library/database.providers.ts. */
export const portfolioLibraryRepositoryProviders: Provider[] = [
  { provide: PORTFOLIO_RECORD_REPOSITORY, useFactory: () => new PortfolioRecordRepository() },
  { provide: PORTFOLIO_ASSET_REPOSITORY, useFactory: () => new PortfolioAssetRepository() },
];
