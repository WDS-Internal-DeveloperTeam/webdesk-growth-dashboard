import { cookies } from "next/headers";
import type {
  ApiSuccessResponse,
  ScanDefinition,
  ScanEvidence,
  ScanFinding,
  ScanRun,
} from "@webdesk/shared-types";
import { getApiBaseUrl } from "./auth";
import { formatTimestamp } from "./format-timestamp";
import {
  buildScanDefinitionsHref,
  parseScanDefinitionsSearchParams,
  scanFindingSeverityBadge,
  scanFindingStatusBadge,
  scanRunStatusBadge,
  SCAN_FINDING_SEVERITY_LABEL,
  SCAN_FINDING_STATUS_LABEL,
  SCAN_MODE_LABEL,
  SCAN_RUN_STATUS_LABEL,
  SCAN_RUN_TRIGGER_TYPE_LABEL,
  SCAN_TYPE_LABEL,
  SCAN_TYPE_VALUES,
  type ScanDefinitionsQuery,
} from "./scan-center-query";
import { isUuid } from "./uuid";
import { withProjectId } from "./project-scoped-href";

export {
  buildScanDefinitionsHref,
  formatTimestamp,
  parseScanDefinitionsSearchParams,
  scanFindingSeverityBadge,
  scanFindingStatusBadge,
  scanRunStatusBadge,
  SCAN_FINDING_SEVERITY_LABEL,
  SCAN_FINDING_STATUS_LABEL,
  SCAN_MODE_LABEL,
  SCAN_RUN_STATUS_LABEL,
  SCAN_RUN_TRIGGER_TYPE_LABEL,
  SCAN_TYPE_LABEL,
  SCAN_TYPE_VALUES,
  withProjectId,
};
export type { ScanDefinitionsQuery };

/** The largest real page-size option (100) — the same bound `getServicesForPersonaPicker()`/
 *  `getReadyForClaudeTasksForDependencyPicker()` accept for a sub-list with no pagination UI of
 *  its own. A definition's own runs, a run's own findings, and a finding's own evidence are all
 *  rendered as a flat, unpaginated list on their parent's detail page (matching
 *  `PageUrlsSection`'s/`ClaimSourcesSection`'s own established sub-resource precedent) — accepted,
 *  tracked debt for a project with an unusually large scan history, same class of debt every prior
 *  sub-resource section in this app already carries. */
const SUB_LIST_LIMIT = 100;

export interface ScanDefinitionListResult {
  readonly items: readonly ScanDefinition[];
  /** Same "request one row past the chosen page size" technique `getPages()`/`getServices()` use —
   *  `GET .../definitions` returns no total count to check against. */
  readonly hasNextPage: boolean;
}

/** Never degrades silently — this page's entire content IS the definition list, so a fetch
 *  failure must surface as a real error state (propagates to the nearest `error.tsx`), matching
 *  every sibling module's own list-fetch precedent. */
export async function getScanDefinitions(
  query: ScanDefinitionsQuery,
): Promise<ScanDefinitionListResult> {
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const params = new URLSearchParams();
  if (query.scanType) params.set("scanType", query.scanType);
  if (query.isEnabled !== null) params.set("isEnabled", String(query.isEnabled));
  if (query.search) params.set("search", query.search);
  params.set("limit", String(query.pageSize + 1));
  params.set("offset", String(query.offset));

  const response = await fetch(
    `${apiBaseUrl}/scan-center/projects/${query.projectId}/definitions?${params.toString()}`,
    { headers: { cookie: cookieHeader }, cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error(`Failed to load scan definitions (status ${response.status})`);
  }
  const body = (await response.json()) as ApiSuccessResponse<readonly ScanDefinition[]>;
  return {
    items: body.data.slice(0, query.pageSize),
    hasNextPage: body.data.length > query.pageSize,
  };
}

/** Fetches one scan definition. Returns `null` on a 404 or a malformed `projectId`/`definitionId`
 *  (rejected via `isUuid()` before any network call, the same short-circuit `getProject()`/
 *  `getPage()` use), and throws on any other non-OK status (403/5xx). */
export async function getScanDefinition(
  projectId: string,
  definitionId: string,
): Promise<ScanDefinition | null> {
  if (!isUuid(projectId) || !isUuid(definitionId)) {
    return null;
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const response = await fetch(
    `${apiBaseUrl}/scan-center/projects/${projectId}/definitions/${definitionId}`,
    { headers: { cookie: cookieStore.toString() }, cache: "no-store" },
  );
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load scan definition (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<ScanDefinition>).data;
}

/** Fetches a definition's own runs, newest first (the backend's own default ordering) — a flat,
 *  unpaginated sub-list (`SUB_LIST_LIMIT`), matching `getPageUrls()`'s own precedent. Degrades to
 *  an empty array on a malformed id or a non-404 failure, rather than crashing the whole detail
 *  page for a genuinely secondary section, logging the latter so a real backend regression here
 *  doesn't go unnoticed. */
export async function getScanRunsForDefinition(
  projectId: string,
  scanDefinitionId: string,
): Promise<readonly ScanRun[]> {
  if (!isUuid(projectId) || !isUuid(scanDefinitionId)) {
    return [];
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const params = new URLSearchParams({
    scanDefinitionId,
    limit: String(SUB_LIST_LIMIT),
  });
  const response = await fetch(
    `${apiBaseUrl}/scan-center/projects/${projectId}/runs?${params.toString()}`,
    { headers: { cookie: cookieStore.toString() }, cache: "no-store" },
  );
  if (response.status === 404) {
    return [];
  }
  if (!response.ok) {
    console.error(
      `Failed to load scan runs for definition ${scanDefinitionId} (status ${response.status})`,
    );
    return [];
  }
  return ((await response.json()) as ApiSuccessResponse<readonly ScanRun[]>).data;
}

/** Fetches one scan run. Returns `null` on a 404 or a malformed id, throws on any other non-OK
 *  status — same contract as `getScanDefinition()`. */
export async function getScanRun(projectId: string, runId: string): Promise<ScanRun | null> {
  if (!isUuid(projectId) || !isUuid(runId)) {
    return null;
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const response = await fetch(`${apiBaseUrl}/scan-center/projects/${projectId}/runs/${runId}`, {
    headers: { cookie: cookieStore.toString() },
    cache: "no-store",
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load scan run (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<ScanRun>).data;
}

/** Fetches a run's own findings — same flat, unpaginated sub-list / degrade-and-log contract as
 *  `getScanRunsForDefinition()`. */
export async function getScanFindingsForRun(
  projectId: string,
  scanRunId: string,
): Promise<readonly ScanFinding[]> {
  if (!isUuid(projectId) || !isUuid(scanRunId)) {
    return [];
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const params = new URLSearchParams({ scanRunId, limit: String(SUB_LIST_LIMIT) });
  const response = await fetch(
    `${apiBaseUrl}/scan-center/projects/${projectId}/findings?${params.toString()}`,
    { headers: { cookie: cookieStore.toString() }, cache: "no-store" },
  );
  if (response.status === 404) {
    return [];
  }
  if (!response.ok) {
    console.error(`Failed to load scan findings for run ${scanRunId} (status ${response.status})`);
    return [];
  }
  return ((await response.json()) as ApiSuccessResponse<readonly ScanFinding[]>).data;
}

/** Fetches one scan finding. Returns `null` on a 404 or a malformed id, throws on any other
 *  non-OK status — same contract as `getScanDefinition()`/`getScanRun()`. */
export async function getScanFinding(
  projectId: string,
  findingId: string,
): Promise<ScanFinding | null> {
  if (!isUuid(projectId) || !isUuid(findingId)) {
    return null;
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const response = await fetch(
    `${apiBaseUrl}/scan-center/projects/${projectId}/findings/${findingId}`,
    { headers: { cookie: cookieStore.toString() }, cache: "no-store" },
  );
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load scan finding (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<ScanFinding>).data;
}

/** Fetches a finding's own evidence — same flat, unpaginated sub-list / degrade-and-log contract
 *  as `getScanRunsForDefinition()`/`getScanFindingsForRun()`. */
export async function getScanEvidenceForFinding(
  projectId: string,
  findingId: string,
): Promise<readonly ScanEvidence[]> {
  if (!isUuid(projectId) || !isUuid(findingId)) {
    return [];
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const params = new URLSearchParams({ limit: String(SUB_LIST_LIMIT) });
  const response = await fetch(
    `${apiBaseUrl}/scan-center/projects/${projectId}/findings/${findingId}/evidence?${params.toString()}`,
    { headers: { cookie: cookieStore.toString() }, cache: "no-store" },
  );
  if (response.status === 404) {
    return [];
  }
  if (!response.ok) {
    console.error(
      `Failed to load scan evidence for finding ${findingId} (status ${response.status})`,
    );
    return [];
  }
  return ((await response.json()) as ApiSuccessResponse<readonly ScanEvidence[]>).data;
}
