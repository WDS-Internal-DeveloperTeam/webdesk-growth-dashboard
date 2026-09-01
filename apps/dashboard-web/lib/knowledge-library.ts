import { cookies } from "next/headers";
import type { ApiSuccessResponse, KnowledgeLibraryRecord } from "@webdesk/shared-types";
import { getApiBaseUrl } from "./auth";
import { formatTimestamp } from "./format-timestamp";
import {
  buildKnowledgeLibraryHref,
  CONFIDENTIALITY_LABEL,
  knowledgeLibraryConfidentialityBadge,
  knowledgeLibraryStatusBadge,
  parseKnowledgeLibrarySearchParams,
  STATUS_LABEL,
  type KnowledgeLibraryQuery,
} from "./knowledge-library-query";
import { isUuid } from "./uuid";

export {
  buildKnowledgeLibraryHref,
  CONFIDENTIALITY_LABEL,
  formatTimestamp,
  knowledgeLibraryConfidentialityBadge,
  knowledgeLibraryStatusBadge,
  parseKnowledgeLibrarySearchParams,
  STATUS_LABEL,
};
export type { KnowledgeLibraryQuery };

export interface KnowledgeLibraryListResult {
  readonly items: readonly KnowledgeLibraryRecord[];
  /** Same "request one row past the chosen page size" technique `getPersonas()`/`getServices()`
   *  use — `GET /knowledge-library/records` returns no total count to check against. */
  readonly hasNextPage: boolean;
}

/** Never degrades silently — this page's entire content IS the record list, so a fetch failure
 *  must surface as a real error state (propagates to the nearest `error.tsx`), matching
 *  `getPersonas()`/`getBusinessKnowledgeRecords()`'s own precedent. */
export async function getKnowledgeLibraryRecords(
  query: KnowledgeLibraryQuery,
): Promise<KnowledgeLibraryListResult> {
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const params = new URLSearchParams();
  if (query.status) params.set("status", query.status);
  if (query.confidentiality) params.set("confidentiality", query.confidentiality);
  if (query.search) params.set("search", query.search);
  params.set("limit", String(query.pageSize + 1));
  params.set("offset", String(query.offset));

  const response = await fetch(`${apiBaseUrl}/knowledge-library/records?${params.toString()}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Failed to load knowledge library records (status ${response.status})`);
  }
  const body = (await response.json()) as ApiSuccessResponse<readonly KnowledgeLibraryRecord[]>;
  return {
    items: body.data.slice(0, query.pageSize),
    hasNextPage: body.data.length > query.pageSize,
  };
}

/**
 * Fetches one record. Returns `null` on a 404 (the caller renders `notFound()`) or a malformed id
 * (rejected via `isUuid()` before any network call, the same short-circuit `getPersona()`/
 * `getService()` use), and throws on any other non-OK status (403/5xx).
 */
export async function getKnowledgeLibraryRecord(
  recordId: string,
): Promise<KnowledgeLibraryRecord | null> {
  if (!isUuid(recordId)) {
    return null;
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const response = await fetch(`${apiBaseUrl}/knowledge-library/records/${recordId}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load knowledge library record (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<KnowledgeLibraryRecord>).data;
}
