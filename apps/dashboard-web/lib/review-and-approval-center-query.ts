import type {
  ModuleRegistrySummary,
  ReviewDecisionAction,
  ReviewStatus,
} from "@webdesk/shared-types";
import type { StatusToken } from "@webdesk/ui";
import { DEFAULT_PAGE_SIZE, parsePageSize, type PageSize } from "./pagination";
import { firstValue } from "./search-params";

/**
 * `ReviewsQuery`/`parseReviewsSearchParams`/`buildReviewsHref`/badge and label maps live in their
 * own file with zero non-type imports, rather than in `lib/review-and-approval-center.ts` where
 * the server-side fetch functions live — so a `"use client"` component (`ReviewForm`,
 * `ReviewDecisionActions`) can import the real functions directly without pulling in that file's
 * `next/headers` import. Same precedent as `lib/website-strategy-center-query.ts`/
 * `lib/persona-library-query.ts`.
 */

// Mirrors apps/dashboard-api/src/review-and-approval-center/review-and-approval-center.dto.ts's
// REVIEW_STATUS_VALUES — kept in sync by hand, same approach every sibling module's own
// `-query.ts` file uses for its own enum. Deliberately NOT ArtifactApprovalStatus (the 8-value
// workflow Service/Persona/Proof-and-Claims/Website Strategy/Content Template Library all share) —
// this module's own workflow is a genuinely different, smaller vocabulary (task package D2).
export const REVIEW_STATUS_VALUES: readonly ReviewStatus[] = [
  "submitted",
  "revision_requested",
  "approved",
  "rejected",
];

export const REVIEW_STATUS_LABEL: Readonly<Record<ReviewStatus, string>> = {
  submitted: "Submitted",
  revision_requested: "Revision Requested",
  approved: "Approved",
  rejected: "Rejected",
};

const REVIEW_STATUS_BADGE: Readonly<Record<ReviewStatus, { token: StatusToken; label: string }>> = {
  submitted: { token: "notConfigured", label: "Submitted" },
  revision_requested: { token: "degraded", label: "Revision Requested" },
  approved: { token: "healthy", label: "Approved" },
  rejected: { token: "unavailable", label: "Rejected" },
};

export function reviewStatusBadge(status: ReviewStatus): {
  readonly token: StatusToken;
  readonly label: string;
} {
  return REVIEW_STATUS_BADGE[status];
}

/** Labels every value in the full 7-action `ReviewDecisionAction` vocabulary (the 4 approval-shaped
 *  `decide()` actions plus `pause`/`resume`/`delegate`) — used by the detail page's server-rendered
 *  Decision History section. */
export const REVIEW_DECISION_ACTION_LABEL: Readonly<Record<ReviewDecisionAction, string>> = {
  approve: "Approved",
  approve_with_notes: "Approved (with notes)",
  request_revision: "Requested revision",
  reject: "Rejected",
  pause: "Paused",
  resume: "Resumed",
  delegate: "Delegated",
};

export interface ReviewsQuery {
  readonly status: ReviewStatus | null;
  readonly targetModuleKey: string | null;
  readonly search: string | null;
  /** Defaults to `true` (the inbox view) whenever no explicit value is present in the URL — only
   *  an explicit `assignedToMe=false` (from the list page's own "View all reviews" link) switches
   *  to the unfiltered view. This default lives here, in the URL-parsing helper itself, so it's an
   *  explicit, inspectable behavior rather than an implicit server-side-only assumption. */
  readonly assignedToMe: boolean;
  readonly offset: number;
  readonly pageSize: PageSize;
}

/**
 * Next.js `searchParams` is untrusted client input — validated against the same enum
 * `GET /reviews` itself accepts (`listReviewsQuerySchema`) rather than passed through raw, so a
 * garbled URL degrades to the default query instead of round-tripping an invalid value to the
 * backend. `targetModuleKey` has no fixed frontend enum to validate against (unlike `status`) —
 * the 43 real module keys are backend-owned, dynamic data (`GET /authz/module-registry`), so this
 * only clamps its length to the same 64-char max the backend's own schema enforces; a stale/
 * hand-edited value that doesn't match any real module key just returns an empty result set,
 * harmlessly.
 */
export function parseReviewsSearchParams(
  raw: Record<string, string | string[] | undefined>,
): ReviewsQuery {
  const status = firstValue(raw.status);
  const targetModuleKey = firstValue(raw.targetModuleKey);
  const search = firstValue(raw.search);
  const assignedToMeRaw = firstValue(raw.assignedToMe);
  const offsetRaw = firstValue(raw.offset);
  const offset = offsetRaw ? Number.parseInt(offsetRaw, 10) : 0;

  return {
    status: REVIEW_STATUS_VALUES.includes(status as ReviewStatus) ? (status as ReviewStatus) : null,
    targetModuleKey: targetModuleKey ? targetModuleKey.slice(0, 64) : null,
    // Clamped to the same 500-char max the backend's own listReviewsQuerySchema enforces —
    // matches every sibling list page's own defense-in-depth precedent for its own search field.
    search: search ? search.slice(0, 500) : null,
    assignedToMe: assignedToMeRaw !== "false",
    offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
    pageSize: parsePageSize(firstValue(raw.pageSize)),
  };
}

/**
 * Builds a `/review-and-approval-center?...` href — `overrides` wins over `current`, and changing
 * anything other than `offset` itself resets `offset` to 0, same convention as
 * `buildWebsiteStrategyCenterHref`/`buildPersonaLibraryHref`. `assignedToMe` is only ever emitted
 * as an explicit `false` — the default (`true`) stays implicit, so a plain
 * `/review-and-approval-center` URL remains the canonical inbox view.
 */
export function buildReviewsHref(current: ReviewsQuery, overrides: Partial<ReviewsQuery>): string {
  const next: ReviewsQuery = {
    ...current,
    ...overrides,
    offset: overrides.offset !== undefined ? overrides.offset : 0,
  };
  const params = new URLSearchParams();
  if (next.status) params.set("status", next.status);
  if (next.targetModuleKey) params.set("targetModuleKey", next.targetModuleKey);
  if (next.search) params.set("search", next.search);
  if (!next.assignedToMe) params.set("assignedToMe", "false");
  if (next.pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(next.pageSize));
  if (next.offset > 0) params.set("offset", String(next.offset));
  const queryString = params.toString();
  return queryString ? `/review-and-approval-center?${queryString}` : "/review-and-approval-center";
}

/** The label the target-module `<select>` (list-page filter, create-form field) shows for a
 *  `ModuleRegistrySummary` row — `displayName` when set, falling back to the raw registry `name`. */
export function moduleDisplayName(module: ModuleRegistrySummary): string {
  return module.displayName ?? module.name;
}

/** Sorted alphabetically by display name for a predictable, scannable `<select>` — the module
 *  registry's own row order has no guaranteed relationship to display order. */
export function sortModulesForPicker(
  modules: readonly ModuleRegistrySummary[],
): readonly ModuleRegistrySummary[] {
  return [...modules].sort((a, b) => moduleDisplayName(a).localeCompare(moduleDisplayName(b)));
}
