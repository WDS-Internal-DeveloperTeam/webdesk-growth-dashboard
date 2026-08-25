import { cookies } from "next/headers";
import type {
  ApiSuccessResponse,
  Review,
  ReviewComment,
  ReviewDecision,
} from "@webdesk/shared-types";
import { getApiBaseUrl } from "./auth";
import { formatTimestamp } from "./format-timestamp";
import { isUuid } from "./uuid";
import {
  buildReviewsHref,
  moduleDisplayName,
  parseReviewsSearchParams,
  REVIEW_DECISION_ACTION_LABEL,
  REVIEW_STATUS_LABEL,
  REVIEW_STATUS_VALUES,
  reviewStatusBadge,
  sortModulesForPicker,
  type ReviewsQuery,
} from "./review-and-approval-center-query";

export {
  buildReviewsHref,
  formatTimestamp,
  moduleDisplayName,
  parseReviewsSearchParams,
  REVIEW_DECISION_ACTION_LABEL,
  REVIEW_STATUS_LABEL,
  REVIEW_STATUS_VALUES,
  reviewStatusBadge,
  sortModulesForPicker,
};
export type { ReviewsQuery };

export interface ReviewListResult {
  readonly items: readonly Review[];
  /** Same "request one row past the chosen page size" technique `getWebsiteStrategyRecords()`/
   *  `getServices()`/`getPersonas()` use — `GET /reviews` returns no total count to check against. */
  readonly hasNextPage: boolean;
}

/** Never degrades silently — this page's entire content IS the review list, so a fetch failure
 *  must surface as a real error state (propagates to the nearest `error.tsx`), matching every
 *  sibling module's own list-fetch precedent. */
export async function getReviews(query: ReviewsQuery): Promise<ReviewListResult> {
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const params = new URLSearchParams();
  if (query.status) params.set("status", query.status);
  if (query.targetModuleKey) params.set("targetModuleKey", query.targetModuleKey);
  if (query.search) params.set("search", query.search);
  if (query.assignedToMe) params.set("assignedToMe", "true");
  params.set("limit", String(query.pageSize + 1));
  params.set("offset", String(query.offset));

  const response = await fetch(`${apiBaseUrl}/reviews?${params.toString()}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Failed to load reviews (status ${response.status})`);
  }
  const body = (await response.json()) as ApiSuccessResponse<readonly Review[]>;
  return {
    items: body.data.slice(0, query.pageSize),
    hasNextPage: body.data.length > query.pageSize,
  };
}

/** Fetches one review by id. Returns `null` on a 404 or a malformed id (rejected via `isUuid()`
 *  before any network call, the same short-circuit `getPersona()`/`getService()`/
 *  `getWebsiteStrategyRecord()` use), and throws on any other non-OK status (403/5xx). */
export async function getReview(id: string): Promise<Review | null> {
  if (!isUuid(id)) {
    return null;
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const response = await fetch(`${apiBaseUrl}/reviews/${id}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load review (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<Review>).data;
}

/** Fetches a review's decision history, most recent first (the backend's own order — see
 *  `ReviewDecisionRepository.listByReview()`), for the detail page's server-rendered "Decision
 *  history" section. Degrades to an empty array rather than throwing on a malformed id or a 404 —
 *  the detail page already gates its own rendering on `getReview()`'s own `null`/`notFound()`
 *  result, so a genuinely-missing review never reaches a point where this function's result
 *  matters; degrading here instead of throwing just avoids a second, redundant not-found code
 *  path. Any other non-OK status still throws, matching every other fetch function in this
 *  module. */
export async function getReviewDecisions(id: string): Promise<readonly ReviewDecision[]> {
  if (!isUuid(id)) {
    return [];
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const response = await fetch(`${apiBaseUrl}/reviews/${id}/decisions`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (response.status === 404) {
    return [];
  }
  if (!response.ok) {
    throw new Error(`Failed to load review decisions (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<readonly ReviewDecision[]>).data;
}

/** Fetches a review's comments, oldest first (the backend's own order — see
 *  `ReviewCommentRepository.listByReview()`), for `ReviewCommentsSection`'s own server-rendered
 *  list. Same degrade-on-malformed-id/404, throw-otherwise contract as `getReviewDecisions()`. */
export async function getReviewComments(id: string): Promise<readonly ReviewComment[]> {
  if (!isUuid(id)) {
    return [];
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const response = await fetch(`${apiBaseUrl}/reviews/${id}/comments`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (response.status === 404) {
    return [];
  }
  if (!response.ok) {
    throw new Error(`Failed to load review comments (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<readonly ReviewComment[]>).data;
}

// `getModuleRegistry()` (a direct `GET /authz/module-registry` fetch, `users_roles:view`-gated —
// only 2 of 7 roles) was removed (code-review finding) in favor of `getServerSession()`'s own
// already-fetched `session.navigation` field (`GET /me/navigation`, `SessionGuard`-only, held by
// every role): both return the same `ModuleRegistrySummary[]` shape, `session.navigation` is
// already loaded on every page render (no redundant fetch), and — verified against the real seeded
// RBAC matrix — its own view-capability filter excludes only the two admin-configuration modules
// (`users_roles`/`system_settings`) that shouldn't be review targets anyway. The prior version
// silently returned an empty picker for 5 of 7 roles today, not just as a future-RBAC-change risk.
// Callers now pass `session.navigation` directly to `sortModulesForPicker()`.
