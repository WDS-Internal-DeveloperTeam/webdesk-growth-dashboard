/**
 * The Import and Export Center module foundation (module #34,
 * `docs/implementation/module-import-and-export-center.md`) — persistence-layer shapes for
 * `import_templates`, `import_runs`, `import_rows`, `import_errors`, `export_runs` (migration
 * `00107`). Organization-wide — no `projectId` field anywhere in this file.
 */

export type ImportDuplicateStrategy = "skip" | "overwrite" | "create_new";
export type ImportExportFileFormat = "csv" | "xlsx" | "json";

/**
 * A reusable, versioned import configuration — WHAT to import, and how source columns map onto a
 * target module's own fields. `version` is server-managed: incremented by 1 as part of the same
 * `UPDATE` statement (`ImportTemplateRepository.update()`), mirroring `PersonaRepository.update()`'s
 * own atomic `literal("version + 1")` pattern, no read-then-write race.
 */
export interface ImportTemplateEntity {
  readonly id: string;
  readonly publicId: string;
  readonly name: string;
  readonly targetModuleKey: string;
  readonly columnMapping: Record<string, unknown> | null;
  readonly duplicateStrategyDefault: ImportDuplicateStrategy;
  readonly fileFormat: ImportExportFileFormat;
  readonly version: number;
  readonly isActive: boolean;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type ImportRunStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "validating"
  | "dry_run_completed"
  | "importing"
  | "completed"
  | "partially_completed"
  | "failed"
  | "cancelled"
  | "rejected"
  | "rolled_back";

/**
 * One execution of an `ImportTemplateEntity`, through a real two-tier submit/review/approve gate
 * before any mechanical validation/import. `templateVersion` is a snapshot of the template's own
 * `version` at run-creation time — NOT a live join. `totalRows`/`successCount`/`errorCount`/
 * `skippedCount` are server-computed only, via a `GROUP BY status, COUNT(*)` query over
 * `import_rows` after each bulk row-insert — never trusted from caller input. `startedAt`/
 * `completedAt` are server-stamped only, by `ImportRunRepository.updateStatus()`'s own atomic
 * conditional write — never accepted as caller input, never overwritten once first set.
 */
export interface ImportRunEntity {
  readonly id: string;
  readonly publicId: string;
  readonly importTemplateId: string;
  readonly templateVersion: number;
  readonly isDryRun: boolean;
  readonly duplicateStrategy: ImportDuplicateStrategy | null;
  readonly sourceFileReference: string | null;
  readonly sourceChecksum: string | null;
  readonly status: ImportRunStatus;
  readonly totalRows: number;
  readonly successCount: number;
  readonly errorCount: number;
  readonly skippedCount: number;
  readonly errorSummary: string | null;
  readonly rollbackNotes: string | null;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly requestedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type ImportRowStatus = "pending" | "valid" | "invalid" | "imported" | "skipped" | "failed";
export type ImportRowResolution = "created" | "overwritten" | "skipped_duplicate";

/**
 * One row of a run's own source data and its outcome. No `publicId` — a row is identified by
 * `(importRunId, rowNumber)` or its own `id`, matching the "no public identity" precedent for the
 * deepest sub-resource in a pipeline (`claim_sources`, `case_study_assets`). Created only as a
 * side effect of a run transitioning into `validating -> dry_run_completed`/`validating ->
importing` with a non-empty `rows` payload — there is no standalone create route for this table.
 */
export interface ImportRowEntity {
  readonly id: string;
  readonly importRunId: string;
  readonly rowNumber: number;
  readonly externalId: string | null;
  readonly rawData: Record<string, unknown> | null;
  readonly status: ImportRowStatus;
  readonly resolution: ImportRowResolution | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Immutable, append-only — no update route exists for this table (ADR-0016). `importRowId` is
 * nullable — a run-level error (e.g. "file not found") has no specific row. Created only as a
 * side effect of a run's own status transition, same as `ImportRowEntity`.
 */
export interface ImportErrorEntity {
  readonly id: string;
  readonly importRunId: string;
  readonly importRowId: string | null;
  readonly errorCode: string | null;
  readonly message: string;
  readonly fieldName: string | null;
  readonly createdAt: string;
}

export type ExportRunStatus = "requested" | "processing" | "completed" | "failed" | "cancelled";

/**
 * A simple, no-approval-gate 5-state pipeline (the `exports` RBAC group has no submit/review/
 * approve letters — `export` itself functions as the create-gate). `excludesConfidentialFields`
 * is always `true` at creation — see this module's own doc comment in the migration for why.
 * `startedAt`/`completedAt` are server-stamped, the same atomic pattern as `ImportRunEntity`.
 */
export interface ExportRunEntity {
  readonly id: string;
  readonly publicId: string;
  readonly targetModuleKey: string;
  readonly filterCriteria: Record<string, unknown> | null;
  readonly format: ImportExportFileFormat;
  readonly status: ExportRunStatus;
  readonly rowCount: number | null;
  readonly fileReference: string | null;
  readonly excludesConfidentialFields: boolean;
  readonly errorSummary: string | null;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly requestedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
