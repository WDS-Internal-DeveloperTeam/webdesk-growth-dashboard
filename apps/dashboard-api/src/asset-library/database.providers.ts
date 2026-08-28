import type { Provider } from "@nestjs/common";
import { AssetRelatedRecordRepository, AssetRepository } from "@webdesk/database";
import { ASSET_RELATED_RECORD_REPOSITORY, ASSET_REPOSITORY } from "./asset-library.constants.js";

/** DI wiring — same `useFactory` pattern as ../brand-library/database.providers.ts. */
export const assetLibraryRepositoryProviders: Provider[] = [
  {
    provide: ASSET_REPOSITORY,
    useFactory: () => new AssetRepository(),
  },
  {
    provide: ASSET_RELATED_RECORD_REPOSITORY,
    useFactory: () => new AssetRelatedRecordRepository(),
  },
];
