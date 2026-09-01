import type {
  DesignReviewDecisionAction,
  DesignReviewStatus,
  DesignReviewType,
} from "@webdesk/shared-types";
import type { StatusToken } from "@webdesk/ui";
import { DEFAULT_PAGE_SIZE, parsePageSize, type PageSize } from "./pagination";
import { moduleDisplayName, sortModulesForPicker } from "./review-and-approval-center-query";
import { firstValue } from "./search-params";

/**
 * `DesignReviewsQuery`/`parseDesignReviewsSearchParams`/`buildDesignReviewsHref` and the
 * status/review-type/decision-action label maps live in their own file with zero non-type
 * imports, rather than in `lib/design-review-center.ts` where the server-side fetch functions
 * live — so a `"use client"` component (`DesignReviewForm`, `DesignReviewDecisionActions`) can
 * import the real functions directly without pulling in that file's `next/headers` import. Same
 * precedent as `lib/review-and-approval-center-query.ts`.
 *
 * `moduleDisplayName`/`sortModulesForPicker` are re-exported from `review-and-approval-center-
 * query.ts` rather than re-declared here — this is the second cross-cutting-engine module (after
 * Review and Approval Center) needing the identical "target module" picker behavior, past this
 * project's own "extract after the 2nd occurrence" convention, and neither function has any
 * review-and-approval-center-specific content (both operate on the generic `ModuleRegistrySummary`
 * shape).
 */
export { moduleDisplayName, sortModulesForPicker };

// Mirrors apps/dashboard-api/src/design-review-center/design-review-center.dto.ts's
// DESIGN_REVIEW_STATUS_VALUES — kept in sync by hand, same approach every sibling module's own
// `-query.ts` file uses for its own enum.
export const DESIGN_REVIEW_STATUS_VALUES: readonly DesignReviewStatus[] = [
  "submitted",
  "revision_requested",
  "approved",
  "rejected",
  "superseded",
];

export const DESIGN_REVIEW_STATUS_LABEL: Readonly<Record<DesignReviewStatus, string>> = {
  submitted: "Submitted",
  revision_requested: "Revision Requested",
  approved: "Approved",
  rejected: "Rejected",
  superseded: "Superseded",
};

const DESIGN_REVIEW_STATUS_BADGE: Readonly<
  Record<DesignReviewStatus, { token: StatusToken; label: string }>
> = {
  submitted: { token: "notConfigured", label: "Submitted" },
  revision_requested: { token: "degraded", label: "Revision Requested" },
  approved: { token: "healthy", label: "Approved" },
  rejected: { token: "unavailable", label: "Rejected" },
  superseded: { token: "notConfigured", label: "Superseded" },
};

export function designReviewStatusBadge(status: DesignReviewStatus): {
  readonly token: StatusToken;
  readonly label: string;
} {
  return DESIGN_REVIEW_STATUS_BADGE[status];
}

// Mirrors apps/dashboard-api/src/design-review-center/design-review-center.dto.ts's
// DESIGN_REVIEW_TYPE_VALUES — taken verbatim from 03_Detailed_Module_Specifications.md §19.
export const DESIGN_REVIEW_TYPE_VALUES: readonly DesignReviewType[] = [
  "creative_direction",
  "ux",
  "conversion",
  "ui",
  "accessibility_by_design",
  "responsive_behavior",
  "component_consistency",
  "motion",
  "performance_impact",
];

export const DESIGN_REVIEW_TYPE_LABEL: Readonly<Record<DesignReviewType, string>> = {
  creative_direction: "Creative Direction",
  ux: "UX",
  conversion: "Conversion",
  ui: "UI",
  accessibility_by_design: "Accessibility by Design",
  responsive_behavior: "Responsive Behavior",
  component_consistency: "Component Consistency",
  motion: "Motion",
  performance_impact: "Performance Impact",
};

/** Labels every value in the full 5-action `DesignReviewDecisionAction` vocabulary (the 4
 *  approval-shaped `decide()` actions plus the automatic `supersede` side effect) — used by the
 *  detail page's server-rendered Decision History section. */
export const DESIGN_REVIEW_DECISION_ACTION_LABEL: Readonly<
  Record<DesignReviewDecisionAction, string>
> = {
  approve: "Approved",
  approve_with_notes: "Approved (with notes)",
  request_revision: "Requested revision",
  reject: "Rejected",
  supersede: "Superseded",
};

export interface DesignReviewsQuery {
  readonly status: DesignReviewStatus | null;
  readonly targetModuleKey: string | null;
  readonly reviewType: DesignReviewType | null;
  readonly search: string | null;
  /** Defaults to `true` (the inbox view) whenever no explicit value is present in the URL — same
   *  convention as `ReviewsQuery.assignedToMe` — only an explicit `assignedToMe=false` switches to
   *  the unfiltered view. */
  readonly assignedToMe: boolean;
  readonly offset: number;
  readonly pageSize: PageSize;
}

/**
 * Next.js `searchParams` is untrusted client input — validated against the same enums
 * `GET /design-reviews` itself accepts (`listDesignReviewsQuerySchema`) rather than passed
 * through raw, so a garbled URL degrades to the default query instead of round-tripping an
 * invalid value to the backend. `targetModuleKey` has no fixed frontend enum to validate against
 * (the 43 real module keys are backend-owned, dynamic data) — this only clamps its length to the
 * same 64-char max the backend's own schema enforces.
 */
export function parseDesignReviewsSearchParams(
  raw: Record<string, string | string[] | undefined>,
): DesignReviewsQuery {
  const status = firstValue(raw.status);
  const targetModuleKey = firstValue(raw.targetModuleKey);
  const reviewType = firstValue(raw.reviewType);
  const search = firstValue(raw.search);
  const assignedToMeRaw = firstValue(raw.assignedToMe);
  const offsetRaw = firstValue(raw.offset);
  const offset = offsetRaw ? Number.parseInt(offsetRaw, 10) : 0;

  return {
    status: DESIGN_REVIEW_STATUS_VALUES.includes(status as DesignReviewStatus)
      ? (status as DesignReviewStatus)
      : null,
    targetModuleKey: targetModuleKey ? targetModuleKey.slice(0, 64) : null,
    reviewType: DESIGN_REVIEW_TYPE_VALUES.includes(reviewType as DesignReviewType)
      ? (reviewType as DesignReviewType)
      : null,
    // Clamped to the same 500-char max the backend's own listDesignReviewsQuerySchema enforces —
    // matches every sibling list page's own defense-in-depth precedent for its own search field.
    search: search ? search.slice(0, 500) : null,
    assignedToMe: assignedToMeRaw !== "false",
    offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
    pageSize: parsePageSize(firstValue(raw.pageSize)),
  };
}

/**
 * Builds a `/design-review-center?...` href — `overrides` wins over `current`, and changing
 * anything other than `offset` itself resets `offset` to 0, same convention as
 * `buildReviewsHref`/`buildWebsiteStrategyCenterHref`. `assignedToMe` is only ever emitted as an
 * explicit `false` — the default (`true`) stays implicit, so a plain `/design-review-center` URL
 * remains the canonical inbox view.
 */
export function buildDesignReviewsHref(
  current: DesignReviewsQuery,
  overrides: Partial<DesignReviewsQuery>,
): string {
  const next: DesignReviewsQuery = {
    ...current,
    ...overrides,
    offset: overrides.offset !== undefined ? overrides.offset : 0,
  };
  const params = new URLSearchParams();
  if (next.status) params.set("status", next.status);
  if (next.targetModuleKey) params.set("targetModuleKey", next.targetModuleKey);
  if (next.reviewType) params.set("reviewType", next.reviewType);
  if (next.search) params.set("search", next.search);
  if (!next.assignedToMe) params.set("assignedToMe", "false");
  if (next.pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(next.pageSize));
  if (next.offset > 0) params.set("offset", String(next.offset));
  const queryString = params.toString();
  return queryString ? `/design-review-center?${queryString}` : "/design-review-center";
}
