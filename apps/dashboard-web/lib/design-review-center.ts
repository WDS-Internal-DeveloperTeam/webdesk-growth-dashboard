import { cookies } from "next/headers";
import type { ApiSuccessResponse, DesignReview, DesignReviewDecision } from "@webdesk/shared-types";
import { getApiBaseUrl } from "./auth";
import {
  buildDesignReviewsHref,
  DESIGN_REVIEW_DECISION_ACTION_LABEL,
  DESIGN_REVIEW_STATUS_LABEL,
  DESIGN_REVIEW_STATUS_VALUES,
  DESIGN_REVIEW_TYPE_LABEL,
  DESIGN_REVIEW_TYPE_VALUES,
  designReviewStatusBadge,
  moduleDisplayName,
  parseDesignReviewsSearchParams,
  sortModulesForPicker,
  type DesignReviewsQuery,
} from "./design-review-center-query";
import { formatTimestamp } from "./format-timestamp";
import { isUuid } from "./uuid";

export {
  buildDesignReviewsHref,
  DESIGN_REVIEW_DECISION_ACTION_LABEL,
  DESIGN_REVIEW_STATUS_LABEL,
  DESIGN_REVIEW_STATUS_VALUES,
  DESIGN_REVIEW_TYPE_LABEL,
  DESIGN_REVIEW_TYPE_VALUES,
  designReviewStatusBadge,
  formatTimestamp,
  moduleDisplayName,
  parseDesignReviewsSearchParams,
  sortModulesForPicker,
};
export type { DesignReviewsQuery };

export interface DesignReviewListResult {
  readonly items: readonly DesignReview[];
  /** Same "request one row past the chosen page size" technique `getReviews()`/
   *  `getWebsiteStrategyRecords()` use — `GET /design-reviews` returns no total count to check
   *  against. */
  readonly hasNextPage: boolean;
}

/** Never degrades silently — this page's entire content IS the review list, so a fetch failure
 *  must surface as a real error state (propagates to the nearest `error.tsx`), matching every
 *  sibling module's own list-fetch precedent. */
export async function getDesignReviews(query: DesignReviewsQuery): Promise<DesignReviewListResult> {
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const params = new URLSearchParams();
  if (query.status) params.set("status", query.status);
  if (query.targetModuleKey) params.set("targetModuleKey", query.targetModuleKey);
  if (query.reviewType) params.set("reviewType", query.reviewType);
  if (query.search) params.set("search", query.search);
  if (query.assignedToMe) params.set("assignedToMe", "true");
  params.set("limit", String(query.pageSize + 1));
  params.set("offset", String(query.offset));

  const response = await fetch(`${apiBaseUrl}/design-reviews?${params.toString()}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Failed to load design reviews (status ${response.status})`);
  }
  const body = (await response.json()) as ApiSuccessResponse<readonly DesignReview[]>;
  return {
    items: body.data.slice(0, query.pageSize),
    hasNextPage: body.data.length > query.pageSize,
  };
}

/** Fetches one design review by id. Returns `null` on a 404 or a malformed id (rejected via
 *  `isUuid()` before any network call, the same short-circuit `getReview()`/`getPersona()` use),
 *  and throws on any other non-OK status (403/5xx). */
export async function getDesignReview(id: string): Promise<DesignReview | null> {
  if (!isUuid(id)) {
    return null;
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const response = await fetch(`${apiBaseUrl}/design-reviews/${id}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load design review (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<DesignReview>).data;
}

/** Fetches a design review's decision history, most recent first (the backend's own order), for
 *  the detail page's server-rendered "Decision history" section. Degrades to an empty array
 *  rather than throwing on a malformed id or a 404 — mirrors `getReviewDecisions()`'s own
 *  precedent; the detail page already gates its own rendering on `getDesignReview()`'s own
 *  `null`/`notFound()` result, so a genuinely-missing review never reaches a point where this
 *  function's result matters. */
export async function getDesignReviewDecisions(
  id: string,
): Promise<readonly DesignReviewDecision[]> {
  if (!isUuid(id)) {
    return [];
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const response = await fetch(`${apiBaseUrl}/design-reviews/${id}/decisions`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (response.status === 404) {
    return [];
  }
  if (!response.ok) {
    throw new Error(`Failed to load design review decisions (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<readonly DesignReviewDecision[]>).data;
}
