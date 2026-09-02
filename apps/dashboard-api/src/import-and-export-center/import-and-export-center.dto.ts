import { z } from "zod";

// Unlike every free-text field in this file (each carrying an explicit `.max()` character cap),
// `z.record(z.unknown())` alone imposes no size limit at all on `columnMapping`/`filterCriteria`/
// `rawData` — a caller could submit an arbitrarily large JSON object into JSONB storage, and with
// `rows` capped at MAX_ROWS_PER_TRANSITION entries each carrying its own `rawData`, one request
// could write megabytes of unvalidated JSON (independent review finding). Bounded by serialized
// byte size, not object shape (none of these three fields has any real schema to impose).
const MAX_JSON_FIELD_BYTES = 50_000;
function boundedJsonObjectSchema(fieldLabel: string) {
  return z
    .record(z.unknown())
    .refine((value) => Buffer.byteLength(JSON.stringify(value), "utf8") <= MAX_JSON_FIELD_BYTES, {
      message: `${fieldLabel} must serialize to at most ${MAX_JSON_FIELD_BYTES} bytes`,
    });
}

// Same safe-boolean-coercion fix (guards against `z.coerce.boolean()`'s truthy-string trap, where
// `?isActive=false` would otherwise coerce to `true`) named the same way at least 9 sibling DTO
// files already do (`operational-contacts.dto.ts`, `content-template-library.dto.ts`, etc.) —
// named here too so a future grep for this pattern finds this file (independent review finding).
const booleanQueryParam = z.enum(["true", "false"]).transform((value) => value === "true");

// --- shared enums ---

export const importDuplicateStrategySchema = z.enum(["skip", "overwrite", "create_new"]);
export const importExportFileFormatSchema = z.enum(["csv", "xlsx", "json"]);

const IMPORT_RUN_STATUS_VALUES = [
  "draft",
  "submitted",
  "approved",
  "validating",
  "dry_run_completed",
  "importing",
  "completed",
  "partially_completed",
  "failed",
  "cancelled",
  "rejected",
  "rolled_back",
] as const;
export const importRunStatusSchema = z.enum(IMPORT_RUN_STATUS_VALUES);

export const importRowStatusSchema = z.enum([
  "pending",
  "valid",
  "invalid",
  "imported",
  "skipped",
  "failed",
]);
export const importRowResolutionSchema = z.enum(["created", "overwritten", "skipped_duplicate"]);

export const exportRunStatusSchema = z.enum([
  "requested",
  "processing",
  "completed",
  "failed",
  "cancelled",
]);

// --- import_templates ---

// `targetModuleKey` is deliberately plain, not a closed Zod enum — the real module vocabulary is
// dynamic (the module registry), validated at the service layer via
// `AuthorizationService.isValidModuleKey()`, mirroring Review and Approval Center's/Change
// Center's own `targetModuleKey` field.
export const listImportTemplatesQuerySchema = z.object({
  targetModuleKey: z.string().min(1).max(100).optional(),
  isActive: booleanQueryParam.optional(),
  search: z.string().max(255).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type ListImportTemplatesQueryDto = z.infer<typeof listImportTemplatesQuerySchema>;

export const createImportTemplateSchema = z.object({
  publicId: z.string().min(1).max(64),
  name: z.string().min(1).max(255),
  targetModuleKey: z.string().min(1).max(100),
  // Free-form source-column -> target-field pairs — no schema imposed, since the target module's
  // own field shape varies.
  columnMapping: boundedJsonObjectSchema("columnMapping").nullish(),
  duplicateStrategyDefault: importDuplicateStrategySchema.optional(),
  fileFormat: importExportFileFormatSchema,
  isActive: z.boolean().optional(),
});
export type CreateImportTemplateDto = z.infer<typeof createImportTemplateSchema>;

// `publicId`/`targetModuleKey` are never accepted here — both immutable after creation, mirroring
// every sibling module's own `publicId`/discriminator-field create-only contract. `version` is
// server-managed and likewise never a caller-supplied field.
export const updateImportTemplateSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    columnMapping: boundedJsonObjectSchema("columnMapping").nullish(),
    duplicateStrategyDefault: importDuplicateStrategySchema.optional(),
    fileFormat: importExportFileFormatSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });
export type UpdateImportTemplateDto = z.infer<typeof updateImportTemplateSchema>;

// --- import_runs ---

export const listImportRunsQuerySchema = z.object({
  importTemplateId: z.string().uuid().optional(),
  status: importRunStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type ListImportRunsQueryDto = z.infer<typeof listImportRunsQuerySchema>;

export const createImportRunSchema = z.object({
  importTemplateId: z.string().uuid(),
  publicId: z.string().min(1).max(64),
  isDryRun: z.boolean(),
  // Falls back to the template's own `duplicateStrategyDefault` when omitted — resolved by
  // readers, never copied in at write time (avoids a stale-copy bug).
  duplicateStrategy: importDuplicateStrategySchema.nullish(),
  // Deliberately NOT URL-validated — an opaque, caller-supplied identifier, mirroring
  // `scan_definitions.target`'s own precedent (no file-storage infrastructure is wired to this
  // module).
  sourceFileReference: z.string().max(10_000).nullish(),
  sourceChecksum: z.string().max(500).nullish(),
});
export type CreateImportRunDto = z.infer<typeof createImportRunSchema>;

// A single row's own source data and outcome, submitted only alongside a run's own
// `validating -> dry_run_completed`/`validating -> importing` transition — no standalone create
// route for `import_rows`. `errorMessage`/`errorCode` are an optional inline pairing the service
// turns into its own `import_errors` row (rowNumber-scoped) alongside the row itself.
export const importRowInputSchema = z.object({
  rowNumber: z.number().int().min(1),
  externalId: z.string().max(500).nullish(),
  rawData: boundedJsonObjectSchema("rawData").nullish(),
  status: importRowStatusSchema,
  resolution: importRowResolutionSchema.nullish(),
  errorMessage: z.string().max(20_000).nullish(),
  errorCode: z.string().max(100).nullish(),
  fieldName: z.string().max(255).nullish(),
});
export type ImportRowInputDto = z.infer<typeof importRowInputSchema>;

// A run-level error (e.g. "file not found") with no specific row — a separate array from `rows`,
// mirroring the schema's own `import_row_id` nullable design.
export const importRunErrorInputSchema = z.object({
  errorCode: z.string().max(100).nullish(),
  message: z.string().min(1).max(20_000),
  fieldName: z.string().max(255).nullish(),
});
export type ImportRunErrorInputDto = z.infer<typeof importRunErrorInputSchema>;

export const changeImportRunStatusSchema = z.object({
  status: importRunStatusSchema,
  errorSummary: z.string().max(20_000).nullish(),
  // Only ever meaningful on a transition INTO rolled_back — rejected outright (a clean 400, not
  // silently ignored) on any other target status, mirroring `ChangeRecordsService`'s own
  // `rollbackGuidance`-only-on-`apply_failed` precedent.
  rollbackNotes: z.string().max(20_000).nullish(),
  // Accepted ONLY alongside a transition into `dry_run_completed`/`importing`, mirroring
  // `ScanRunsService.changeStatus()`'s own `body.findings` bulk-create-on-transition pattern —
  // capped generously above Scan Center's own `.max(500)` since a real import file can
  // legitimately carry thousands of rows.
  rows: z.array(importRowInputSchema).max(5000).optional(),
  runErrors: z.array(importRunErrorInputSchema).max(200).optional(),
});
export type ChangeImportRunStatusDto = z.infer<typeof changeImportRunStatusSchema>;

// --- import_rows / import_errors (read-only routes) ---

export const listImportRowsQuerySchema = z.object({
  status: importRowStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type ListImportRowsQueryDto = z.infer<typeof listImportRowsQuerySchema>;

export const listImportErrorsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type ListImportErrorsQueryDto = z.infer<typeof listImportErrorsQuerySchema>;

// --- export_runs ---

// No `search` param — `targetModuleKey` is a closed, module-registry-validated value with no
// genuine free-text field on `export_runs` to search instead (independent review finding; see
// `ExportRunRepository.list()`'s own doc comment).
export const listExportRunsQuerySchema = z.object({
  targetModuleKey: z.string().min(1).max(100).optional(),
  status: exportRunStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type ListExportRunsQueryDto = z.infer<typeof listExportRunsQuerySchema>;

export const createExportRunSchema = z.object({
  publicId: z.string().min(1).max(64),
  targetModuleKey: z.string().min(1).max(100),
  // An opaque, caller-supplied filter description — no schema imposed, mirrors
  // `createImportTemplateSchema`'s own `columnMapping` reasoning.
  filterCriteria: boundedJsonObjectSchema("filterCriteria").nullish(),
  format: importExportFileFormatSchema,
});
export type CreateExportRunDto = z.infer<typeof createExportRunSchema>;

export const changeExportRunStatusSchema = z.object({
  status: exportRunStatusSchema,
  errorSummary: z.string().max(20_000).nullish(),
  rowCount: z.number().int().min(0).nullish(),
  // Deliberately NOT URL-validated — same reasoning as `import_runs.sourceFileReference`.
  fileReference: z.string().max(10_000).nullish(),
});
export type ChangeExportRunStatusDto = z.infer<typeof changeExportRunStatusSchema>;
