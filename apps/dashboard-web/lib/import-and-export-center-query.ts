import type {
  ExportRunStatus,
  ImportDuplicateStrategy,
  ImportExportFileFormat,
  ImportRowResolution,
  ImportRowStatus,
  ImportRunStatus,
} from "@webdesk/shared-types";
import type { StatusToken } from "@webdesk/ui";
import { DEFAULT_PAGE_SIZE, parsePageSize, type PageSize } from "./pagination";
import { firstValue } from "./search-params";

/**
 * `ImportTemplatesQuery`/`ImportRunsQuery`/`ExportRunsQuery` and their parse/build/label/badge
 * helpers live in their own file with zero non-type imports, rather than in
 * `lib/import-and-export-center.ts` where the server-side fetch functions live — so a
 * `"use client"` component (`ImportTemplateForm`, `CreateImportRunButton`,
 * `ImportRunStatusActions`, `ExportRunForm`, `ExportRunStatusActions`) can import the real
 * functions directly without pulling in that file's `next/headers` import. Same precedent as
 * `lib/scan-center-query.ts`/`lib/ready-for-claude-queue-query.ts`.
 *
 * `moduleDisplayName`/`sortModulesForPicker` are NOT redeclared here — this module reuses Review
 * and Approval Center's own copies directly (re-exported below), matching Ready for Claude
 * Queue's/this codebase's own standing feedback to reuse before duplicating.
 */
export { moduleDisplayName, sortModulesForPicker } from "./review-and-approval-center-query";

// Mirrors apps/dashboard-api/src/import-and-export-center/import-and-export-center.dto.ts's
// importDuplicateStrategySchema/importExportFileFormatSchema — kept in sync by hand, same
// approach every sibling module's own `-query.ts` file uses for its own enum.
export const IMPORT_DUPLICATE_STRATEGY_VALUES: readonly ImportDuplicateStrategy[] = [
  "skip",
  "overwrite",
  "create_new",
];
export const IMPORT_DUPLICATE_STRATEGY_LABEL: Readonly<Record<ImportDuplicateStrategy, string>> = {
  skip: "Skip",
  overwrite: "Overwrite",
  create_new: "Create new",
};

export const IMPORT_EXPORT_FILE_FORMAT_VALUES: readonly ImportExportFileFormat[] = [
  "csv",
  "xlsx",
  "json",
];
export const IMPORT_EXPORT_FILE_FORMAT_LABEL: Readonly<Record<ImportExportFileFormat, string>> = {
  csv: "CSV",
  xlsx: "XLSX",
  json: "JSON",
};

// Mirrors ImportRunsService's own TRANSITIONS table — kept in sync by hand.
export const IMPORT_RUN_STATUS_VALUES: readonly ImportRunStatus[] = [
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
];

export const IMPORT_RUN_STATUS_LABEL: Readonly<Record<ImportRunStatus, string>> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  validating: "Validating",
  dry_run_completed: "Dry Run Completed",
  importing: "Importing",
  completed: "Completed",
  partially_completed: "Partially Completed",
  failed: "Failed",
  cancelled: "Cancelled",
  rejected: "Rejected",
  rolled_back: "Rolled Back",
};

/**
 * The 12-state workflow mapped onto `StatusBadge`'s own 5-token vocabulary
 * (`healthy`/`degraded`/`unavailable`/`notConfigured`/`unknown`), the same older `StatusBadge`/
 * `StatusToken` pair every sibling bespoke-workflow module (`ScanRunStatus`,
 * `ReadyForClaudeTaskStatus`) already uses. No status name, no meaning is invented — this only
 * assigns each existing value a visual bucket: pending/pre-execution states
 * (`draft`/`submitted`/`approved`/`validating`/`dry_run_completed`) get `notConfigured`; active or
 * mixed-outcome states (`importing`/`partially_completed`) share `degraded`; `completed` (the
 * clean success outcome) gets `healthy`; `failed`/`cancelled`/`rejected`/`rolled_back` (did not
 * conclude as a clean success) share `unavailable`.
 */
const IMPORT_RUN_STATUS_BADGE: Readonly<
  Record<ImportRunStatus, { token: StatusToken; label: string }>
> = {
  draft: { token: "notConfigured", label: "Draft" },
  submitted: { token: "notConfigured", label: "Submitted" },
  approved: { token: "notConfigured", label: "Approved" },
  validating: { token: "notConfigured", label: "Validating" },
  dry_run_completed: { token: "notConfigured", label: "Dry Run Completed" },
  importing: { token: "degraded", label: "Importing" },
  completed: { token: "healthy", label: "Completed" },
  partially_completed: { token: "degraded", label: "Partially Completed" },
  failed: { token: "unavailable", label: "Failed" },
  cancelled: { token: "unavailable", label: "Cancelled" },
  rejected: { token: "unavailable", label: "Rejected" },
  rolled_back: { token: "unavailable", label: "Rolled Back" },
};

export function importRunStatusBadge(status: ImportRunStatus): {
  readonly token: StatusToken;
  readonly label: string;
} {
  return IMPORT_RUN_STATUS_BADGE[status];
}

export const IMPORT_ROW_STATUS_VALUES: readonly ImportRowStatus[] = [
  "pending",
  "valid",
  "invalid",
  "imported",
  "skipped",
  "failed",
];

export const IMPORT_ROW_STATUS_LABEL: Readonly<Record<ImportRowStatus, string>> = {
  pending: "Pending",
  valid: "Valid",
  invalid: "Invalid",
  imported: "Imported",
  skipped: "Skipped",
  failed: "Failed",
};

/** `pending` (not yet processed) -> `notConfigured`; `valid`/`imported` (the clean outcomes) ->
 *  `healthy`; `skipped` (a deliberate, non-error disposition) -> `notConfigured`; `invalid`/
 *  `failed` (a genuine problem with this row) -> `unavailable`. */
const IMPORT_ROW_STATUS_BADGE: Readonly<
  Record<ImportRowStatus, { token: StatusToken; label: string }>
> = {
  pending: { token: "notConfigured", label: "Pending" },
  valid: { token: "healthy", label: "Valid" },
  invalid: { token: "unavailable", label: "Invalid" },
  imported: { token: "healthy", label: "Imported" },
  skipped: { token: "notConfigured", label: "Skipped" },
  failed: { token: "unavailable", label: "Failed" },
};

export function importRowStatusBadge(status: ImportRowStatus): {
  readonly token: StatusToken;
  readonly label: string;
} {
  return IMPORT_ROW_STATUS_BADGE[status];
}

export const IMPORT_ROW_RESOLUTION_LABEL: Readonly<Record<ImportRowResolution, string>> = {
  created: "Created",
  overwritten: "Overwritten",
  skipped_duplicate: "Skipped (duplicate)",
};

// Mirrors ExportRunsService's own TRANSITIONS table — kept in sync by hand.
export const EXPORT_RUN_STATUS_VALUES: readonly ExportRunStatus[] = [
  "requested",
  "processing",
  "completed",
  "failed",
  "cancelled",
];

export const EXPORT_RUN_STATUS_LABEL: Readonly<Record<ExportRunStatus, string>> = {
  requested: "Requested",
  processing: "Processing",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

/** `requested` (queued) -> `notConfigured`; `processing` (active work) -> `degraded`;
 *  `completed` (clean success) -> `healthy`; `failed`/`cancelled` (did not conclude as a clean
 *  success) -> `unavailable`. */
const EXPORT_RUN_STATUS_BADGE: Readonly<
  Record<ExportRunStatus, { token: StatusToken; label: string }>
> = {
  requested: { token: "notConfigured", label: "Requested" },
  processing: { token: "degraded", label: "Processing" },
  completed: { token: "healthy", label: "Completed" },
  failed: { token: "unavailable", label: "Failed" },
  cancelled: { token: "unavailable", label: "Cancelled" },
};

export function exportRunStatusBadge(status: ExportRunStatus): {
  readonly token: StatusToken;
  readonly label: string;
} {
  return EXPORT_RUN_STATUS_BADGE[status];
}

export interface ImportTemplatesQuery {
  readonly targetModuleKey: string | null;
  readonly isActive: boolean | null;
  readonly search: string | null;
  readonly offset: number;
  readonly pageSize: PageSize;
}

/**
 * Next.js `searchParams` is untrusted client input — validated against the same shapes
 * `GET .../templates` itself accepts (`listImportTemplatesQuerySchema`) rather than passed
 * through raw, so a garbled URL degrades to the default query instead of round-tripping an
 * invalid value to the backend. `targetModuleKey` has no fixed frontend enum to validate against
 * (the real module vocabulary is dynamic, backend-owned data) — mirrors
 * `parseReviewsSearchParams()`'s own identical clamp-only treatment.
 */
export function parseImportTemplatesSearchParams(
  raw: Record<string, string | string[] | undefined>,
): ImportTemplatesQuery {
  const targetModuleKey = firstValue(raw.targetModuleKey);
  const isActiveRaw = firstValue(raw.isActive);
  const search = firstValue(raw.search);
  const offsetRaw = firstValue(raw.offset);
  const offset = offsetRaw ? Number.parseInt(offsetRaw, 10) : 0;

  return {
    targetModuleKey: targetModuleKey ? targetModuleKey.slice(0, 100) : null,
    isActive: isActiveRaw === "true" ? true : isActiveRaw === "false" ? false : null,
    // Clamped to the same 255-char max the backend's own listImportTemplatesQuerySchema
    // enforces — matches every sibling list page's own defense-in-depth precedent.
    search: search ? search.slice(0, 255) : null,
    offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
    pageSize: parsePageSize(firstValue(raw.pageSize)),
  };
}

/**
 * Builds a `/import-and-export-center?...` href — `overrides` wins over `current`, and changing
 * anything other than `offset`/`pageSize` itself resets `offset` to 0, same convention as
 * `buildScanDefinitionsHref`/`buildReadyForClaudeQueueHref`.
 */
export function buildImportTemplatesHref(
  current: ImportTemplatesQuery,
  overrides: Partial<ImportTemplatesQuery>,
): string {
  const next: ImportTemplatesQuery = {
    ...current,
    ...overrides,
    offset: overrides.offset !== undefined ? overrides.offset : 0,
  };
  const params = new URLSearchParams();
  if (next.targetModuleKey) params.set("targetModuleKey", next.targetModuleKey);
  if (next.isActive !== null) params.set("isActive", String(next.isActive));
  if (next.search) params.set("search", next.search);
  if (next.pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(next.pageSize));
  if (next.offset > 0) params.set("offset", String(next.offset));
  const queryString = params.toString();
  return queryString ? `/import-and-export-center?${queryString}` : "/import-and-export-center";
}

export interface ImportRunsQuery {
  readonly importTemplateId: string | null;
  readonly status: ImportRunStatus | null;
  readonly offset: number;
  readonly pageSize: PageSize;
}

export function parseImportRunsSearchParams(
  raw: Record<string, string | string[] | undefined>,
): ImportRunsQuery {
  const importTemplateId = firstValue(raw.importTemplateId);
  const status = firstValue(raw.status);
  const offsetRaw = firstValue(raw.offset);
  const offset = offsetRaw ? Number.parseInt(offsetRaw, 10) : 0;

  return {
    // A malformed value just returns an empty result set from the backend, harmlessly — matches
    // every other id-shaped filter in this app (no isUuid()-style rejection here).
    importTemplateId: importTemplateId ? importTemplateId.slice(0, 64) : null,
    status: IMPORT_RUN_STATUS_VALUES.includes(status as ImportRunStatus)
      ? (status as ImportRunStatus)
      : null,
    offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
    pageSize: parsePageSize(firstValue(raw.pageSize)),
  };
}

export function buildImportRunsHref(
  current: ImportRunsQuery,
  overrides: Partial<ImportRunsQuery>,
): string {
  const next: ImportRunsQuery = {
    ...current,
    ...overrides,
    offset: overrides.offset !== undefined ? overrides.offset : 0,
  };
  const params = new URLSearchParams();
  if (next.importTemplateId) params.set("importTemplateId", next.importTemplateId);
  if (next.status) params.set("status", next.status);
  if (next.pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(next.pageSize));
  if (next.offset > 0) params.set("offset", String(next.offset));
  const queryString = params.toString();
  return queryString
    ? `/import-and-export-center/runs?${queryString}`
    : "/import-and-export-center/runs";
}

export interface ExportRunsQuery {
  readonly targetModuleKey: string | null;
  readonly status: ExportRunStatus | null;
  readonly offset: number;
  readonly pageSize: PageSize;
}

/**
 * No `search` field — `listExportRunsQuerySchema` deliberately has none (`export_runs` has no
 * genuine free-text field to search; `ExportRunRepository.list()`'s own doc comment), so this
 * query shape mirrors that omission rather than adding a client-side-only search that would
 * silently do nothing.
 */
export function parseExportRunsSearchParams(
  raw: Record<string, string | string[] | undefined>,
): ExportRunsQuery {
  const targetModuleKey = firstValue(raw.targetModuleKey);
  const status = firstValue(raw.status);
  const offsetRaw = firstValue(raw.offset);
  const offset = offsetRaw ? Number.parseInt(offsetRaw, 10) : 0;

  return {
    targetModuleKey: targetModuleKey ? targetModuleKey.slice(0, 100) : null,
    status: EXPORT_RUN_STATUS_VALUES.includes(status as ExportRunStatus)
      ? (status as ExportRunStatus)
      : null,
    offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
    pageSize: parsePageSize(firstValue(raw.pageSize)),
  };
}

export function buildExportRunsHref(
  current: ExportRunsQuery,
  overrides: Partial<ExportRunsQuery>,
): string {
  const next: ExportRunsQuery = {
    ...current,
    ...overrides,
    offset: overrides.offset !== undefined ? overrides.offset : 0,
  };
  const params = new URLSearchParams();
  if (next.targetModuleKey) params.set("targetModuleKey", next.targetModuleKey);
  if (next.status) params.set("status", next.status);
  if (next.pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(next.pageSize));
  if (next.offset > 0) params.set("offset", String(next.offset));
  const queryString = params.toString();
  return queryString
    ? `/import-and-export-center/exports?${queryString}`
    : "/import-and-export-center/exports";
}
