import { cookies } from "next/headers";
import type {
  ApiSuccessResponse,
  Deployment,
  Release,
  ReleaseApproval,
  ReleaseArtifact,
  RollbackRecord,
  SmokeTest,
} from "@webdesk/shared-types";
import { getApiBaseUrl } from "./auth";
import { formatTimestamp } from "./format-timestamp";
import {
  buildReleasesHref,
  parseReleasesSearchParams,
  releaseStatusBadge,
  RELEASE_STATUS_LABEL,
  RELEASE_STATUS_VALUES,
  RELEASE_TYPE_LABEL,
  RELEASE_TYPE_VALUES,
  type ReleasesQuery,
} from "./release-center-query";
import { isUuid } from "./uuid";
import { withProjectId } from "./project-scoped-href";

export {
  buildReleasesHref,
  formatTimestamp,
  parseReleasesSearchParams,
  releaseStatusBadge,
  RELEASE_STATUS_LABEL,
  RELEASE_STATUS_VALUES,
  RELEASE_TYPE_LABEL,
  RELEASE_TYPE_VALUES,
  withProjectId,
};
export type { ReleasesQuery };

/** Same flat, unpaginated sub-list bound every sibling module's own sub-resource sections use
 *  (`getScanRunsForDefinition()`, `getTechnicalCheckRunsForDefinition()`) — accepted, tracked debt
 *  for a release with an unusually large artifact/deployment/smoke-test history. */
const SUB_LIST_LIMIT = 100;

export interface ReleaseListResult {
  readonly items: readonly Release[];
  /** Same "request one row past the chosen page size" technique every sibling list fetch uses —
   *  `GET .../releases` returns no total count to check against. */
  readonly hasNextPage: boolean;
}

/** Never degrades silently — this page's entire content IS the release list, so a fetch failure
 *  must surface as a real error state (propagates to the nearest `error.tsx`), matching every
 *  sibling module's own list-fetch precedent. */
export async function getReleases(query: ReleasesQuery): Promise<ReleaseListResult> {
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const params = new URLSearchParams();
  if (query.releaseType) params.set("releaseType", query.releaseType);
  if (query.status) params.set("status", query.status);
  if (query.search) params.set("search", query.search);
  params.set("limit", String(query.pageSize + 1));
  params.set("offset", String(query.offset));

  const response = await fetch(
    `${apiBaseUrl}/release-center/projects/${query.projectId}/releases?${params.toString()}`,
    { headers: { cookie: cookieHeader }, cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error(`Failed to load releases (status ${response.status})`);
  }
  const body = (await response.json()) as ApiSuccessResponse<readonly Release[]>;
  return {
    items: body.data.slice(0, query.pageSize),
    hasNextPage: body.data.length > query.pageSize,
  };
}

/** Fetches one release. Returns `null` on a 404 or a malformed `projectId`/`releaseId` (rejected
 *  via `isUuid()` before any network call, the same short-circuit `getScanDefinition()`/
 *  `getProject()` use), and throws on any other non-OK status (403/5xx). */
export async function getRelease(projectId: string, releaseId: string): Promise<Release | null> {
  if (!isUuid(projectId) || !isUuid(releaseId)) {
    return null;
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const response = await fetch(
    `${apiBaseUrl}/release-center/projects/${projectId}/releases/${releaseId}`,
    { headers: { cookie: cookieStore.toString() }, cache: "no-store" },
  );
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load release (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<Release>).data;
}

/** Read-only, most-recent-first — degrades to an empty array on a malformed id or a non-404
 *  failure rather than crashing the whole detail page for a genuinely secondary section, logging
 *  the latter so a real backend regression here doesn't go unnoticed (matches
 *  `getTechnicalCheckRunsForDefinition()`'s own degrade-and-log contract). */
export async function getReleaseApprovals(
  projectId: string,
  releaseId: string,
): Promise<readonly ReleaseApproval[]> {
  if (!isUuid(projectId) || !isUuid(releaseId)) {
    return [];
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const response = await fetch(
    `${apiBaseUrl}/release-center/projects/${projectId}/releases/${releaseId}/approvals`,
    { headers: { cookie: cookieStore.toString() }, cache: "no-store" },
  );
  if (response.status === 404) {
    return [];
  }
  if (!response.ok) {
    console.error(`Failed to load approvals for release ${releaseId} (status ${response.status})`);
    return [];
  }
  return ((await response.json()) as ApiSuccessResponse<readonly ReleaseApproval[]>).data;
}

/** Same degrade-and-log sub-list contract as `getReleaseApprovals()`. */
export async function getReleaseArtifacts(
  projectId: string,
  releaseId: string,
): Promise<readonly ReleaseArtifact[]> {
  if (!isUuid(projectId) || !isUuid(releaseId)) {
    return [];
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const params = new URLSearchParams({ limit: String(SUB_LIST_LIMIT) });
  const response = await fetch(
    `${apiBaseUrl}/release-center/projects/${projectId}/releases/${releaseId}/artifacts?${params.toString()}`,
    { headers: { cookie: cookieStore.toString() }, cache: "no-store" },
  );
  if (response.status === 404) {
    return [];
  }
  if (!response.ok) {
    console.error(`Failed to load artifacts for release ${releaseId} (status ${response.status})`);
    return [];
  }
  return ((await response.json()) as ApiSuccessResponse<readonly ReleaseArtifact[]>).data;
}

/** Same degrade-and-log sub-list contract as `getReleaseApprovals()`. */
export async function getReleaseDeployments(
  projectId: string,
  releaseId: string,
): Promise<readonly Deployment[]> {
  if (!isUuid(projectId) || !isUuid(releaseId)) {
    return [];
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const params = new URLSearchParams({ limit: String(SUB_LIST_LIMIT) });
  const response = await fetch(
    `${apiBaseUrl}/release-center/projects/${projectId}/releases/${releaseId}/deployments?${params.toString()}`,
    { headers: { cookie: cookieStore.toString() }, cache: "no-store" },
  );
  if (response.status === 404) {
    return [];
  }
  if (!response.ok) {
    console.error(
      `Failed to load deployments for release ${releaseId} (status ${response.status})`,
    );
    return [];
  }
  return ((await response.json()) as ApiSuccessResponse<readonly Deployment[]>).data;
}

/** Same degrade-and-log sub-list contract as `getReleaseApprovals()`. */
export async function getReleaseSmokeTests(
  projectId: string,
  releaseId: string,
): Promise<readonly SmokeTest[]> {
  if (!isUuid(projectId) || !isUuid(releaseId)) {
    return [];
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const params = new URLSearchParams({ limit: String(SUB_LIST_LIMIT) });
  const response = await fetch(
    `${apiBaseUrl}/release-center/projects/${projectId}/releases/${releaseId}/smoke-tests?${params.toString()}`,
    { headers: { cookie: cookieStore.toString() }, cache: "no-store" },
  );
  if (response.status === 404) {
    return [];
  }
  if (!response.ok) {
    console.error(
      `Failed to load smoke tests for release ${releaseId} (status ${response.status})`,
    );
    return [];
  }
  return ((await response.json()) as ApiSuccessResponse<readonly SmokeTest[]>).data;
}

/** At most one row per release — a clean 404 means no rollback has happened yet (real, valid,
 *  non-error state, matching `RollbackRecordsService.findByReleaseId()`'s own doc comment), so this
 *  degrades to `null` rather than an empty array or a thrown error. Degrades on any other non-OK
 *  status too, logging it — this is a genuinely secondary section on the detail page, not the
 *  page's entire content. */
export async function getReleaseRollbackRecord(
  projectId: string,
  releaseId: string,
): Promise<RollbackRecord | null> {
  if (!isUuid(projectId) || !isUuid(releaseId)) {
    return null;
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const response = await fetch(
    `${apiBaseUrl}/release-center/projects/${projectId}/releases/${releaseId}/rollback`,
    { headers: { cookie: cookieStore.toString() }, cache: "no-store" },
  );
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    console.error(
      `Failed to load rollback record for release ${releaseId} (status ${response.status})`,
    );
    return null;
  }
  return ((await response.json()) as ApiSuccessResponse<RollbackRecord>).data;
}
