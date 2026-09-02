import type { Provider } from "@nestjs/common";
import {
  ExportRunRepository,
  ImportErrorRepository,
  ImportRowRepository,
  ImportRunRepository,
  ImportTemplateRepository,
} from "@webdesk/database";
import {
  EXPORT_RUN_REPOSITORY,
  IMPORT_ERROR_REPOSITORY,
  IMPORT_ROW_REPOSITORY,
  IMPORT_RUN_REPOSITORY,
  IMPORT_TEMPLATE_REPOSITORY,
} from "./import-and-export-center.constants.js";

/** DI wiring — same `useFactory` pattern as ../scan-center/database.providers.ts. */
export const importAndExportCenterRepositoryProviders: Provider[] = [
  { provide: IMPORT_TEMPLATE_REPOSITORY, useFactory: () => new ImportTemplateRepository() },
  { provide: IMPORT_RUN_REPOSITORY, useFactory: () => new ImportRunRepository() },
  { provide: IMPORT_ROW_REPOSITORY, useFactory: () => new ImportRowRepository() },
  { provide: IMPORT_ERROR_REPOSITORY, useFactory: () => new ImportErrorRepository() },
  { provide: EXPORT_RUN_REPOSITORY, useFactory: () => new ExportRunRepository() },
];
