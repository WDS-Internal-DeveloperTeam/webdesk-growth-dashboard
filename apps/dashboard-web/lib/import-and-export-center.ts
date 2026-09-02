import { cookies } from "next/headers";
import type {
  ApiSuccessResponse,
  ExportRun,
  ImportError,
  ImportRow,
  ImportRun,
  ImportTemplate,
} from "@webdesk/shared-types";
import { getApiBaseUrl } from "./auth";
import { formatTimestamp } from "./format-timestamp";
import {
  buildExportRunsHref,
  buildImportRunsHref,
  buildImportTemplatesHref,
  EXPORT_RUN_STATUS_LABEL,
  EXPORT_RUN_STATUS_VALUES,
  exportRunStatusBadge,
  IMPORT_DUPLICATE_STRATEGY_LABEL,
  IMPORT_DUPLICATE_STRATEGY_VALUES,
  IMPORT_EXPORT_FILE_FORMAT_LABEL,
  IMPORT_EXPORT_FILE_FORMAT_VALUES,
  IMPORT_ROW_RESOLUTION_LABEL,
  IMPORT_ROW_STATUS_LABEL,
  IMPORT_ROW_STATUS_VALUES,
  importRowStatusBadge,
  IMPORT_RUN_STATUS_LABEL,
  IMPORT_RUN_STATUS_VALUES,
  importRunStatusBadge,
  moduleDisplayName,
  parseExportRunsSearchParams,
  parseImportRunsSearchParams,
  parseImportTemplatesSearchParams,
  sortModulesForPicker,
  type ExportRunsQuery,
  type ImportRunsQuery,
  type ImportTemplatesQuery,
} from "./import-and-export-center-query";
import { isUuid } from "./uuid";

export {
  buildExportRunsHref,
  buildImportRunsHref,
  buildImportTemplatesHref,
  EXPORT_RUN_STATUS_LABEL,
  EXPORT_RUN_STATUS_VALUES,
  exportRunStatusBadge,
  formatTimestamp,
  IMPORT_DUPLICATE_STRATEGY_LABEL,
  IMPORT_DUPLICATE_STRATEGY_VALUES,
  IMPORT_EXPORT_FILE_FORMAT_LABEL,
  IMPORT_EXPORT_FILE_FORMAT_VALUES,
  IMPORT_ROW_RESOLUTION_LABEL,
  IMPORT_ROW_STATUS_LABEL,
  IMPORT_ROW_STATUS_VALUES,
  importRowStatusBadge,
  IMPORT_RUN_STATUS_LABEL,
  IMPORT_RUN_STATUS_VALUES,
  importRunStatusBadge,
  moduleDisplayName,
  parseExportRunsSearchParams,
  parseImportRunsSearchParams,
  parseImportTemplatesSearchParams,
  sortModulesForPicker,
};
export type { ExportRunsQuery, ImportRunsQuery, ImportTemplatesQuery };

/** The largest real page-size option (100) — the same bound `getScanRunsForDefinition()`/
 *  `getReadyForClaudeTasksForDependencyPicker()` accept for a sub-list with no pagination UI of
 *  its own. A run's own rows/errors are rendered as a flat, unpaginated list on the run's own
 *  detail page. */
const SUB_LIST_LIMIT = 100;

export interface ImportTemplateListResult {
  readonly items: readonly ImportTemplate[];
  /** Same "request one row past the chosen page size" technique `getScanDefinitions()`/
   *  `getReadyForClaudeTasks()` use — `GET .../templates` returns no total count to check
   *  against. */
  readonly hasNextPage: boolean;
}

/** Never degrades silently — this page's entire content IS the template list, so a fetch failure
 *  must surface as a real error state (propagates to the nearest `error.tsx`), matching every
 *  sibling module's own list-fetch precedent. */
export async function getImportTemplates(
  query: ImportTemplatesQuery,
): Promise<ImportTemplateListResult> {
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const params = new URLSearchParams();
  if (query.targetModuleKey) params.set("targetModuleKey", query.targetModuleKey);
  if (query.isActive !== null) params.set("isActive", String(query.isActive));
  if (query.search) params.set("search", query.search);
  params.set("limit", String(query.pageSize + 1));
  params.set("offset", String(query.offset));

  const response = await fetch(
    `${apiBaseUrl}/import-and-export-center/templates?${params.toString()}`,
    { headers: { cookie: cookieHeader }, cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error(`Failed to load import templates (status ${response.status})`);
  }
  const body = (await response.json()) as ApiSuccessResponse<readonly ImportTemplate[]>;
  return {
    items: body.data.slice(0, query.pageSize),
    hasNextPage: body.data.length > query.pageSize,
  };
}

/** Fetches one import template. Returns `null` on a 404 or a malformed id (rejected via
 *  `isUuid()` before any network call, the same short-circuit `getScanDefinition()`/
 *  `getReadyForClaudeTask()` use), and throws on any other non-OK status (403/5xx). */
export async function getImportTemplate(id: string): Promise<ImportTemplate | null> {
  if (!isUuid(id)) {
    return null;
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const response = await fetch(`${apiBaseUrl}/import-and-export-center/templates/${id}`, {
    headers: { cookie: cookieStore.toString() },
    cache: "no-store",
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load import template (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<ImportTemplate>).data;
}

export interface ImportRunListResult {
  readonly items: readonly ImportRun[];
  readonly hasNextPage: boolean;
}

/** Never degrades silently on the runs list page (same reasoning as `getImportTemplates()`), but
 *  when called for a template's own "Recent runs" sub-list (`limit`/no pagination expected), the
 *  caller should treat a thrown error as recoverable — see the template detail page's own
 *  `tolerateDiscard()` usage. */
export async function getImportRuns(query: ImportRunsQuery): Promise<ImportRunListResult> {
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const params = new URLSearchParams();
  if (query.importTemplateId) params.set("importTemplateId", query.importTemplateId);
  if (query.status) params.set("status", query.status);
  params.set("limit", String(query.pageSize + 1));
  params.set("offset", String(query.offset));

  const response = await fetch(`${apiBaseUrl}/import-and-export-center/runs?${params.toString()}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Failed to load import runs (status ${response.status})`);
  }
  const body = (await response.json()) as ApiSuccessResponse<readonly ImportRun[]>;
  return {
    items: body.data.slice(0, query.pageSize),
    hasNextPage: body.data.length > query.pageSize,
  };
}

/** Fetches one import run. Returns `null` on a 404 or a malformed id, throws on any other
 *  non-OK status — same contract as `getImportTemplate()`. */
export async function getImportRun(id: string): Promise<ImportRun | null> {
  if (!isUuid(id)) {
    return null;
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const response = await fetch(`${apiBaseUrl}/import-and-export-center/runs/${id}`, {
    headers: { cookie: cookieStore.toString() },
    cache: "no-store",
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load import run (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<ImportRun>).data;
}

/** Fetches a run's own rows, newest-first (the backend's own default ordering) — a flat,
 *  unpaginated sub-list (`SUB_LIST_LIMIT`), matching `getScanFindingsForRun()`'s own precedent.
 *  Degrades to an empty array on a malformed id or a non-404 failure rather than crashing the
 *  whole run detail page for a genuinely secondary section, logging the latter so a real backend
 *  regression here doesn't go unnoticed. */
export async function getImportRunRows(runId: string): Promise<readonly ImportRow[]> {
  if (!isUuid(runId)) {
    return [];
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const params = new URLSearchParams({ limit: String(SUB_LIST_LIMIT) });
  const response = await fetch(
    `${apiBaseUrl}/import-and-export-center/runs/${runId}/rows?${params.toString()}`,
    { headers: { cookie: cookieStore.toString() }, cache: "no-store" },
  );
  if (response.status === 404) {
    return [];
  }
  if (!response.ok) {
    console.error(`Failed to load import rows for run ${runId} (status ${response.status})`);
    return [];
  }
  return ((await response.json()) as ApiSuccessResponse<readonly ImportRow[]>).data;
}

/** Fetches a run's own errors — same flat, unpaginated sub-list / degrade-and-log contract as
 *  `getImportRunRows()`. */
export async function getImportRunErrors(runId: string): Promise<readonly ImportError[]> {
  if (!isUuid(runId)) {
    return [];
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const params = new URLSearchParams({ limit: String(SUB_LIST_LIMIT) });
  const response = await fetch(
    `${apiBaseUrl}/import-and-export-center/runs/${runId}/errors?${params.toString()}`,
    { headers: { cookie: cookieStore.toString() }, cache: "no-store" },
  );
  if (response.status === 404) {
    return [];
  }
  if (!response.ok) {
    console.error(`Failed to load import errors for run ${runId} (status ${response.status})`);
    return [];
  }
  return ((await response.json()) as ApiSuccessResponse<readonly ImportError[]>).data;
}

export interface ExportRunListResult {
  readonly items: readonly ExportRun[];
  readonly hasNextPage: boolean;
}

/** Never degrades silently — this page's entire content IS the export run list, matching every
 *  sibling module's own list-fetch precedent. */
export async function getExportRuns(query: ExportRunsQuery): Promise<ExportRunListResult> {
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const params = new URLSearchParams();
  if (query.targetModuleKey) params.set("targetModuleKey", query.targetModuleKey);
  if (query.status) params.set("status", query.status);
  params.set("limit", String(query.pageSize + 1));
  params.set("offset", String(query.offset));

  const response = await fetch(
    `${apiBaseUrl}/import-and-export-center/exports?${params.toString()}`,
    { headers: { cookie: cookieHeader }, cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error(`Failed to load export runs (status ${response.status})`);
  }
  const body = (await response.json()) as ApiSuccessResponse<readonly ExportRun[]>;
  return {
    items: body.data.slice(0, query.pageSize),
    hasNextPage: body.data.length > query.pageSize,
  };
}

/** Fetches one export run. Returns `null` on a 404 or a malformed id, throws on any other non-OK
 *  status — same contract as `getImportTemplate()`/`getImportRun()`. */
export async function getExportRun(id: string): Promise<ExportRun | null> {
  if (!isUuid(id)) {
    return null;
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const response = await fetch(`${apiBaseUrl}/import-and-export-center/exports/${id}`, {
    headers: { cookie: cookieStore.toString() },
    cache: "no-store",
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load export run (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<ExportRun>).data;
}
