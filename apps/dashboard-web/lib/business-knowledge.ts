import { cookies } from "next/headers";
import type {
  ApiSuccessResponse,
  BusinessKnowledgeAttachment,
  BusinessKnowledgeRecord,
} from "@webdesk/shared-types";
import { getApiBaseUrl } from "./auth";
import {
  buildBusinessKnowledgeHref,
  businessKnowledgeStatusBadge,
  parseBusinessKnowledgeSearchParams,
  RECORD_TYPE_LABEL,
  type BusinessKnowledgeQuery,
} from "./business-knowledge-query";
import { formatTimestamp } from "./format-timestamp";
import { isUuid } from "./uuid";

export {
  buildBusinessKnowledgeHref,
  businessKnowledgeStatusBadge,
  formatTimestamp,
  parseBusinessKnowledgeSearchParams,
  RECORD_TYPE_LABEL,
};
export type { BusinessKnowledgeQuery };

export interface BusinessKnowledgeListResult {
  readonly items: readonly BusinessKnowledgeRecord[];
  /** Same "request one row past the chosen page size" technique `getProjects()` uses — `GET
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
  params.set("limit", String(query.pageSize + 1));
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
    items: body.data.slice(0, query.pageSize),
    hasNextPage: body.data.length > query.pageSize,
  };
}

/**
 * Fetches a single record. Returns `null` on a 404 (the caller renders `notFound()`), and throws
 * on any other non-OK status (403/5xx) — same contract as `getProjectDetail()`. `recordId` is
 * untrusted (a reader can type anything into the URL); the `isUuid()` short-circuit rejects an
 * obviously-malformed value before any network call, treating it the same as "not found." (`dashboard-api`
 * also validates `:id` route params via `ParseUUIDPipe`, returning a clean `400` rather than a raw
 * `500` — this check saves the network round trip entirely for an obviously-garbled URL.)
 */
export async function getBusinessKnowledgeRecord(
  recordId: string,
): Promise<BusinessKnowledgeRecord | null> {
  if (!isUuid(recordId)) {
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

/**
 * Same technique `getProjectDetail()` already uses for its own concurrently-fired sub-resource
 * fetches: attaches a no-op `.catch()` so a promise the caller ultimately discards (the record
 * turned out not to exist, so its attachments were never actually awaited) doesn't produce a
 * Node/Next.js "unhandled rejection" warning, while the original `promise` still rejects normally
 * for a caller that does await it.
 */
export function tolerateDiscard<T>(promise: Promise<T>): Promise<T> {
  promise.catch(() => {});
  return promise;
}

/** An empty array is a real, valid answer here (no attachments, or a restricted record redacting
 *  them for this viewer — `GET .../attachments` itself already returns `[]` for that case, no
 *  separate signal is needed) — never thrown as an error, matching how the record's own redacted
 *  `content`/`notes` degrade to an absent key rather than a failure. */
export async function getBusinessKnowledgeAttachments(
  recordId: string,
): Promise<readonly BusinessKnowledgeAttachment[]> {
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const response = await fetch(`${apiBaseUrl}/business-knowledge/records/${recordId}/attachments`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Failed to load attachments (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<readonly BusinessKnowledgeAttachment[]>)
    .data;
}
