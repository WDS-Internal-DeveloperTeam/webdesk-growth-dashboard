import { cookies } from "next/headers";
import type { ApiSuccessResponse, BusinessKnowledgeRecord } from "@webdesk/shared-types";
import { getApiBaseUrl } from "./auth";
import {
  BUSINESS_KNOWLEDGE_PAGE_SIZE,
  buildBusinessKnowledgeHref,
  businessKnowledgeStatusBadge,
  parseBusinessKnowledgeSearchParams,
  RECORD_TYPE_LABEL,
  type BusinessKnowledgeQuery,
} from "./business-knowledge-query";
import { formatTimestamp } from "./format-timestamp";

export {
  BUSINESS_KNOWLEDGE_PAGE_SIZE,
  buildBusinessKnowledgeHref,
  businessKnowledgeStatusBadge,
  formatTimestamp,
  parseBusinessKnowledgeSearchParams,
  RECORD_TYPE_LABEL,
};
export type { BusinessKnowledgeQuery };

/** Matches the `id` UUID column `business_knowledge_records` uses (migration `00047`) — same
 *  short-circuit precedent as `lib/projects.ts`'s `UUID_PATTERN`: `dashboard-api` now validates
 *  `:id` route params via `ParseUUIDPipe` (a malformed id gets a clean `400`, not a raw `500`), but
 *  rejecting it here too avoids the network round trip entirely for an obviously-garbled URL. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface BusinessKnowledgeListResult {
  readonly items: readonly BusinessKnowledgeRecord[];
  /** Same "request one row past the display page size" technique `getProjects()` uses — `GET
   *  /business-knowledge/records` returns no total count to check against. */
  readonly hasNextPage: boolean;
}

/** Never degrades silently — this page's entire content IS the record list, so a fetch failure
 *  must surface as a real error state (propagates to the nearest `error.tsx`), matching
 *  `getProjects()`'s own precedent. */
export async function getBusinessKnowledgeRecords(
  query: BusinessKnowledgeQuery,
): Promise<BusinessKnowledgeListResult> {
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const params = new URLSearchParams();
  if (query.recordType) params.set("recordType", query.recordType);
  if (query.status) params.set("status", query.status);
  params.set("limit", String(BUSINESS_KNOWLEDGE_PAGE_SIZE + 1));
  params.set("offset", String(query.offset));

  const response = await fetch(`${apiBaseUrl}/business-knowledge/records?${params.toString()}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Failed to load business knowledge records (status ${response.status})`);
  }
  const body = (await response.json()) as ApiSuccessResponse<readonly BusinessKnowledgeRecord[]>;
  return {
    items: body.data.slice(0, BUSINESS_KNOWLEDGE_PAGE_SIZE),
    hasNextPage: body.data.length > BUSINESS_KNOWLEDGE_PAGE_SIZE,
  };
}

/**
 * Fetches a single record. Returns `null` on a 404 (the caller renders `notFound()`), and throws
 * on any other non-OK status (403/5xx) — same contract as `getProjectDetail()`. `recordId` is
 * untrusted (a reader can type anything into the URL); the `UUID_PATTERN` short-circuit rejects an
 * obviously-malformed value before any network call, treating it the same as "not found."
 */
export async function getBusinessKnowledgeRecord(
  recordId: string,
): Promise<BusinessKnowledgeRecord | null> {
  if (!UUID_PATTERN.test(recordId)) {
    return null;
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const response = await fetch(`${apiBaseUrl}/business-knowledge/records/${recordId}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load business knowledge record (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<BusinessKnowledgeRecord>).data;
}
