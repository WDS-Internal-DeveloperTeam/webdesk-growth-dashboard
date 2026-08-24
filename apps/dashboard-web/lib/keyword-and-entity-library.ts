import { cookies } from "next/headers";
import type {
  ApiSuccessResponse,
  EntityRecord,
  Keyword,
  KeywordEntityRelationship,
  Page,
  PageKeywordAssignment,
} from "@webdesk/shared-types";
import { getApiBaseUrl } from "./auth";
import { formatTimestamp } from "./format-timestamp";
import {
  APPROVAL_STATUS_LABEL,
  buildEntityLibraryHref,
  buildKeywordLibraryHref,
  CONFIDENCE_LABEL,
  keywordApprovalStatusBadge,
  parseEntityLibrarySearchParams,
  parseKeywordLibrarySearchParams,
  withProjectId,
  type EntityLibraryQuery,
  type KeywordLibraryQuery,
} from "./keyword-and-entity-library-query";
import { getPages } from "./page-inventory";
import { isUuid } from "./uuid";

export {
  APPROVAL_STATUS_LABEL,
  buildEntityLibraryHref,
  buildKeywordLibraryHref,
  CONFIDENCE_LABEL,
  formatTimestamp,
  keywordApprovalStatusBadge,
  parseEntityLibrarySearchParams,
  parseKeywordLibrarySearchParams,
  withProjectId,
};
export type { EntityLibraryQuery, KeywordLibraryQuery };

/** Same "avoid an unhandled-rejection warning on a discarded promise" helper `getProjectDetail()`/
 *  `getPage()`'s own callers use — re-exported here rather than imported from `lib/business-knowledge.ts`
 *  directly, so this module's own callers don't need to reach into an unrelated module's file for a
 *  generic utility. */
export function tolerateDiscard<T>(promise: Promise<T>): Promise<T> {
  promise.catch(() => {});
  return promise;
}

export interface KeywordListResult {
  readonly items: readonly Keyword[];
  /** Same "request one row past the chosen page size" technique `getPages()`/`getProjects()`/
   *  `getServices()` use — `GET .../keywords` returns no total count to check against. */
  readonly hasNextPage: boolean;
}

/** Never degrades silently — this page's entire content IS the keyword list (once a project is
 *  selected), so a fetch failure must surface as a real error state (propagates to the nearest
 *  `error.tsx`), matching `getPages()`'s own list-fetch precedent. */
export async function getKeywords(query: KeywordLibraryQuery): Promise<KeywordListResult> {
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const params = new URLSearchParams();
  if (query.keywordType) params.set("keywordType", query.keywordType);
  if (query.intent) params.set("intent", query.intent);
  if (query.funnelStage) params.set("funnelStage", query.funnelStage);
  if (query.country) params.set("country", query.country);
  if (query.confidence) params.set("confidence", query.confidence);
  if (query.approvalStatus) params.set("approvalStatus", query.approvalStatus);
  if (query.search) params.set("search", query.search);
  // One row past the chosen page size — see KeywordListResult.hasNextPage's own doc comment.
  params.set("limit", String(query.pageSize + 1));
  params.set("offset", String(query.offset));

  const response = await fetch(
    `${apiBaseUrl}/keyword-and-entity-library/projects/${query.projectId}/keywords?${params.toString()}`,
    { headers: { cookie: cookieHeader }, cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error(`Failed to load keywords (status ${response.status})`);
  }
  const body = (await response.json()) as ApiSuccessResponse<readonly Keyword[]>;
  return {
    items: body.data.slice(0, query.pageSize),
    hasNextPage: body.data.length > query.pageSize,
  };
}

/**
 * Fetches one keyword. Returns `null` on a 404 (the caller renders `notFound()`) or a malformed
 * `projectId`/`keywordId` (rejected via `isUuid()` before any network call, the same short-circuit
 * `getPage()`/`getProject()`/`getService()` use), and throws on any other non-OK status (403/5xx).
 */
export async function getKeyword(projectId: string, keywordId: string): Promise<Keyword | null> {
  if (!isUuid(projectId) || !isUuid(keywordId)) {
    return null;
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const response = await fetch(
    `${apiBaseUrl}/keyword-and-entity-library/projects/${projectId}/keywords/${keywordId}`,
    { headers: { cookie: cookieHeader }, cache: "no-store" },
  );
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load keyword (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<Keyword>).data;
}

export interface EntityListResult {
  readonly items: readonly EntityRecord[];
  readonly hasNextPage: boolean;
}

/** Never degrades silently — same reasoning as `getKeywords()`. */
export async function getEntities(query: EntityLibraryQuery): Promise<EntityListResult> {
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const params = new URLSearchParams();
  if (query.entityType) params.set("entityType", query.entityType);
  if (query.search) params.set("search", query.search);
  params.set("limit", String(query.pageSize + 1));
  params.set("offset", String(query.offset));

  const response = await fetch(
    `${apiBaseUrl}/keyword-and-entity-library/projects/${query.projectId}/entities?${params.toString()}`,
    { headers: { cookie: cookieHeader }, cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error(`Failed to load entities (status ${response.status})`);
  }
  const body = (await response.json()) as ApiSuccessResponse<readonly EntityRecord[]>;
  return {
    items: body.data.slice(0, query.pageSize),
    hasNextPage: body.data.length > query.pageSize,
  };
}

/** Same `null`-on-malformed-id/404, throw-otherwise contract as `getKeyword()`. */
export async function getEntity(
  projectId: string,
  entityId: string,
): Promise<EntityRecord | null> {
  if (!isUuid(projectId) || !isUuid(entityId)) {
    return null;
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const response = await fetch(
    `${apiBaseUrl}/keyword-and-entity-library/projects/${projectId}/entities/${entityId}`,
    { headers: { cookie: cookieHeader }, cache: "no-store" },
  );
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load entity (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<EntityRecord>).data;
}

/**
 * Fetches a keyword's linked-entities sub-resource, for the detail page's "Linked entities"
 * section. Returns an empty array on a malformed id, a 404, OR any other non-OK status (a
 * transient backend error) — a genuine sub-resource failure must not crash the whole detail page,
 * mirroring `getPageUrls()`'s own identical degrade-but-log precedent.
 */
export async function getKeywordEntityRelationships(
  projectId: string,
  keywordId: string,
): Promise<readonly KeywordEntityRelationship[]> {
  if (!isUuid(projectId) || !isUuid(keywordId)) {
    return [];
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const response = await fetch(
    `${apiBaseUrl}/keyword-and-entity-library/projects/${projectId}/keywords/${keywordId}/entity-relationships`,
    { headers: { cookie: cookieHeader }, cache: "no-store" },
  );
  if (response.status === 404) {
    return [];
  }
  if (!response.ok) {
    console.error(
      `Failed to load entity relationships for keyword ${keywordId} (status ${response.status})`,
    );
    return [];
  }
  return ((await response.json()) as ApiSuccessResponse<readonly KeywordEntityRelationship[]>)
    .data;
}

/** Same degrade-but-log contract as `getKeywordEntityRelationships()`. */
export async function getPageKeywordAssignments(
  projectId: string,
  keywordId: string,
): Promise<readonly PageKeywordAssignment[]> {
  if (!isUuid(projectId) || !isUuid(keywordId)) {
    return [];
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const response = await fetch(
    `${apiBaseUrl}/keyword-and-entity-library/projects/${projectId}/keywords/${keywordId}/page-assignments`,
    { headers: { cookie: cookieHeader }, cache: "no-store" },
  );
  if (response.status === 404) {
    return [];
  }
  if (!response.ok) {
    console.error(
      `Failed to load page assignments for keyword ${keywordId} (status ${response.status})`,
    );
    return [];
  }
  return ((await response.json()) as ApiSuccessResponse<readonly PageKeywordAssignment[]>).data;
}

/**
 * Fetches up to 100 of a project's entities, for the `RelationshipPicker` used by
 * `KeywordEntityRelationshipsSection` — mirrors `getServicesForPersonaPicker()`'s own "fetch a
 * bounded top-N once, filter client-side" pattern (the identical largest real page-size option, 100,
 * every other picker in this app accepts). Degrades to an empty list on failure rather than
 * crashing the detail page — a real, previously-undiscovered gap (`getServicesForPersonaPicker()`'s
 * own code-review finding) that this function avoids from the start.
 */
export async function getEntitiesForKeywordPicker(
  projectId: string,
): Promise<readonly EntityRecord[]> {
  try {
    const { items } = await getEntities({
      projectId,
      entityType: null,
      search: null,
      offset: 0,
      pageSize: 100,
    });
    return items;
  } catch (error) {
    console.error("Failed to load entities for the keyword relationship picker:", error);
    return [];
  }
}

/** Same bounded-top-100, degrade-on-failure pattern as `getEntitiesForKeywordPicker()`, reusing
 *  Page Inventory's own already-reviewed `getPages()` rather than a new fetch function. */
export async function getPagesForKeywordPicker(projectId: string): Promise<readonly Page[]> {
  try {
    const { items } = await getPages({
      projectId,
      pageType: null,
      workflowStage: null,
      indexStatus: null,
      template: null,
      search: null,
      targetKeyword: null,
      roadmapPhaseId: null,
      lastScanBefore: null,
      lastScanAfter: null,
      lastDeploymentBefore: null,
      lastDeploymentAfter: null,
      offset: 0,
      pageSize: 100,
    });
    return items;
  } catch (error) {
    console.error("Failed to load pages for the keyword page-assignment picker:", error);
    return [];
  }
}
