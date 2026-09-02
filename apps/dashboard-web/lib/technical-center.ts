import { cookies } from "next/headers";
import type {
  ApiSuccessResponse,
  TechnicalCheckDefinition,
  TechnicalCheckRun,
  TechnicalFinding,
} from "@webdesk/shared-types";
import { getApiBaseUrl } from "./auth";
import { formatTimestamp } from "./format-timestamp";
import {
  buildTechnicalCheckDefinitionsHref,
  parseTechnicalCheckDefinitionsSearchParams,
  technicalCheckRunStatusBadge,
  technicalFindingSeverityBadge,
  technicalFindingStatusBadge,
  TECHNICAL_CHECK_MODE_LABEL,
  TECHNICAL_CHECK_RUN_STATUS_LABEL,
  TECHNICAL_CHECK_RUN_TRIGGER_TYPE_LABEL,
  TECHNICAL_CHECK_TYPE_LABEL,
  TECHNICAL_CHECK_TYPE_VALUES,
  TECHNICAL_FINDING_SEVERITY_LABEL,
  TECHNICAL_FINDING_STATUS_LABEL,
  type TechnicalCheckDefinitionsQuery,
} from "./technical-center-query";
import { isUuid } from "./uuid";
import { withProjectId } from "./project-scoped-href";

export {
  buildTechnicalCheckDefinitionsHref,
  formatTimestamp,
  parseTechnicalCheckDefinitionsSearchParams,
  technicalCheckRunStatusBadge,
  technicalFindingSeverityBadge,
  technicalFindingStatusBadge,
  TECHNICAL_CHECK_MODE_LABEL,
  TECHNICAL_CHECK_RUN_STATUS_LABEL,
  TECHNICAL_CHECK_RUN_TRIGGER_TYPE_LABEL,
  TECHNICAL_CHECK_TYPE_LABEL,
  TECHNICAL_CHECK_TYPE_VALUES,
  TECHNICAL_FINDING_SEVERITY_LABEL,
  TECHNICAL_FINDING_STATUS_LABEL,
  withProjectId,
};
export type { TechnicalCheckDefinitionsQuery };

/** The largest real page-size option (100) — the same bound `getScanRunsForDefinition()`/
 *  `getScanFindingsForRun()` accept for a sub-list with no pagination UI of its own. A
 *  definition's own runs, and a run's own findings, are both rendered as a flat, unpaginated list
 *  on their parent's detail page (matching `getScanRunsForDefinition()`'s own established
 *  sub-resource precedent) — accepted, tracked debt for a project with an unusually large check
 *  history, same class of debt every prior sub-resource section in this app already carries. */
const SUB_LIST_LIMIT = 100;

export interface TechnicalCheckDefinitionListResult {
  readonly items: readonly TechnicalCheckDefinition[];
  /** Same "request one row past the chosen page size" technique `getScanDefinitions()`/
   *  `getPages()` use — `GET .../definitions` returns no total count to check against. */
  readonly hasNextPage: boolean;
}

/** Never degrades silently — this page's entire content IS the definition list, so a fetch
 *  failure must surface as a real error state (propagates to the nearest `error.tsx`), matching
 *  every sibling module's own list-fetch precedent. */
export async function getTechnicalCheckDefinitions(
  query: TechnicalCheckDefinitionsQuery,
): Promise<TechnicalCheckDefinitionListResult> {
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const params = new URLSearchParams();
  if (query.checkType) params.set("checkType", query.checkType);
  if (query.isEnabled !== null) params.set("isEnabled", String(query.isEnabled));
  if (query.search) params.set("search", query.search);
  params.set("limit", String(query.pageSize + 1));
  params.set("offset", String(query.offset));

  const response = await fetch(
    `${apiBaseUrl}/technical-center/projects/${query.projectId}/definitions?${params.toString()}`,
    { headers: { cookie: cookieHeader }, cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error(`Failed to load technical check definitions (status ${response.status})`);
  }
  const body = (await response.json()) as ApiSuccessResponse<readonly TechnicalCheckDefinition[]>;
  return {
    items: body.data.slice(0, query.pageSize),
    hasNextPage: body.data.length > query.pageSize,
  };
}

/** Fetches one technical check definition. Returns `null` on a 404 or a malformed
 *  `projectId`/`definitionId` (rejected via `isUuid()` before any network call, the same
 *  short-circuit `getScanDefinition()`/`getProject()` use), and throws on any other non-OK status
 *  (403/5xx). */
export async function getTechnicalCheckDefinition(
  projectId: string,
  definitionId: string,
): Promise<TechnicalCheckDefinition | null> {
  if (!isUuid(projectId) || !isUuid(definitionId)) {
    return null;
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const response = await fetch(
    `${apiBaseUrl}/technical-center/projects/${projectId}/definitions/${definitionId}`,
    { headers: { cookie: cookieStore.toString() }, cache: "no-store" },
  );
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load technical check definition (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<TechnicalCheckDefinition>).data;
}

/** Fetches a definition's own runs, newest first (the backend's own default ordering) — a flat,
 *  unpaginated sub-list (`SUB_LIST_LIMIT`), matching `getScanRunsForDefinition()`'s own precedent.
 *  Degrades to an empty array on a malformed id or a non-404 failure, rather than crashing the
 *  whole detail page for a genuinely secondary section, logging the latter so a real backend
 *  regression here doesn't go unnoticed. */
export async function getTechnicalCheckRunsForDefinition(
  projectId: string,
  technicalCheckDefinitionId: string,
): Promise<readonly TechnicalCheckRun[]> {
  if (!isUuid(projectId) || !isUuid(technicalCheckDefinitionId)) {
    return [];
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const params = new URLSearchParams({
    technicalCheckDefinitionId,
    limit: String(SUB_LIST_LIMIT),
  });
  const response = await fetch(
    `${apiBaseUrl}/technical-center/projects/${projectId}/runs?${params.toString()}`,
    { headers: { cookie: cookieStore.toString() }, cache: "no-store" },
  );
  if (response.status === 404) {
    return [];
  }
  if (!response.ok) {
    console.error(
      `Failed to load technical check runs for definition ${technicalCheckDefinitionId} (status ${response.status})`,
    );
    return [];
  }
  return ((await response.json()) as ApiSuccessResponse<readonly TechnicalCheckRun[]>).data;
}

/** Fetches one technical check run. Returns `null` on a 404 or a malformed id, throws on any
 *  other non-OK status — same contract as `getTechnicalCheckDefinition()`. */
export async function getTechnicalCheckRun(
  projectId: string,
  runId: string,
): Promise<TechnicalCheckRun | null> {
  if (!isUuid(projectId) || !isUuid(runId)) {
    return null;
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const response = await fetch(
    `${apiBaseUrl}/technical-center/projects/${projectId}/runs/${runId}`,
    { headers: { cookie: cookieStore.toString() }, cache: "no-store" },
  );
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load technical check run (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<TechnicalCheckRun>).data;
}

/** Fetches a run's own findings — same flat, unpaginated sub-list / degrade-and-log contract as
 *  `getTechnicalCheckRunsForDefinition()`. */
export async function getTechnicalFindingsForRun(
  projectId: string,
  technicalCheckRunId: string,
): Promise<readonly TechnicalFinding[]> {
  if (!isUuid(projectId) || !isUuid(technicalCheckRunId)) {
    return [];
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const params = new URLSearchParams({ technicalCheckRunId, limit: String(SUB_LIST_LIMIT) });
  const response = await fetch(
    `${apiBaseUrl}/technical-center/projects/${projectId}/findings?${params.toString()}`,
    { headers: { cookie: cookieStore.toString() }, cache: "no-store" },
  );
  if (response.status === 404) {
    return [];
  }
  if (!response.ok) {
    console.error(
      `Failed to load technical findings for run ${technicalCheckRunId} (status ${response.status})`,
    );
    return [];
  }
  return ((await response.json()) as ApiSuccessResponse<readonly TechnicalFinding[]>).data;
}

/** Fetches one technical finding. Returns `null` on a 404 or a malformed id, throws on any other
 *  non-OK status — same contract as `getTechnicalCheckDefinition()`/`getTechnicalCheckRun()`. */
export async function getTechnicalFinding(
  projectId: string,
  findingId: string,
): Promise<TechnicalFinding | null> {
  if (!isUuid(projectId) || !isUuid(findingId)) {
    return null;
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const response = await fetch(
    `${apiBaseUrl}/technical-center/projects/${projectId}/findings/${findingId}`,
    { headers: { cookie: cookieStore.toString() }, cache: "no-store" },
  );
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load technical finding (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<TechnicalFinding>).data;
}
