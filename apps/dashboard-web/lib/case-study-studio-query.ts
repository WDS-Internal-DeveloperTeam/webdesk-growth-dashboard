import type {
  CaseStudyAssetRole,
  CaseStudyConsentType,
  CaseStudyStatus,
  CaseStudyVisibility,
} from "@webdesk/shared-types";
import type { StatusToken } from "@webdesk/ui";
import { DEFAULT_PAGE_SIZE, parsePageSize, type PageSize } from "./pagination";
import { firstValue } from "./search-params";

/**
 * `CaseStudyStudioQuery`/`parseCaseStudyStudioSearchParams`/`buildCaseStudyStudioHref` live in
 * their own file with zero non-type imports, rather than in `lib/case-study-studio.ts` where the
 * server-side fetch functions live — so a `"use client"` component (the create/edit form, the
 * status-actions island, the assets/consents sub-resource sections) can import the real functions
 * directly without pulling in `lib/case-study-studio.ts`'s `next/headers` import. Same precedent as
 * `lib/proof-and-claims-library-query.ts`/`lib/persona-library-query.ts`.
 *
 * D1's own bespoke 14-stage lifecycle has no cross-module precedent to reuse (unlike the shared
 * 8-value `ArtifactApprovalStatus` every other content-library module shares via
 * `artifact-approval-status.ts`), so status labels/values/badge tokens live directly in this
 * module's own query file, matching Internal Linking Library's own precedent for its bespoke
 * 4-state workflow.
 */

export const STATUS_VALUES: readonly CaseStudyStatus[] = [
  "intake",
  "upload",
  "completeness_review",
  "ready_for_claude",
  "missing_information",
  "draft",
  "search_review",
  "fact_confidentiality_review",
  "internal_approval",
  "client_approval",
  "scheduled",
  "published",
  "unpublished",
  "archived",
];

export const STATUS_LABEL: Readonly<Record<CaseStudyStatus, string>> = {
  intake: "Intake",
  upload: "Upload",
  completeness_review: "Completeness Review",
  ready_for_claude: "Ready for Claude",
  missing_information: "Missing Information",
  draft: "Draft",
  search_review: "Search Review",
  fact_confidentiality_review: "Fact & Confidentiality Review",
  internal_approval: "Internal Approval",
  client_approval: "Client Approval",
  scheduled: "Scheduled",
  published: "Published",
  unpublished: "Unpublished",
  archived: "Archived",
};

// 14 real statuses onto a fixed 5-token badge palette, grouped by real workflow phase rather than
// alphabetically: the early intake/authoring states (intake/upload/draft/missing_information) are
// a neutral "not yet in review" bucket; every genuine review/approval stage
// (completeness_review/ready_for_claude/search_review/fact_confidentiality_review/
// internal_approval/client_approval) shares the "in progress" degraded token; scheduled/published
// share the live "healthy" token (a scheduled case study is functionally approved and awaiting its
// publish date, not still under review); unpublished gets its own distinct token — deliberately
// NOT the same token as archived, since unlike archived it is not terminal and can be republished;
// archived alone is the genuinely dead/terminal state.
const STATUS_BADGE: Readonly<Record<CaseStudyStatus, { token: StatusToken; label: string }>> = {
  intake: { token: "unknown", label: STATUS_LABEL.intake },
  upload: { token: "unknown", label: STATUS_LABEL.upload },
  draft: { token: "unknown", label: STATUS_LABEL.draft },
  missing_information: { token: "unknown", label: STATUS_LABEL.missing_information },
  completeness_review: { token: "degraded", label: STATUS_LABEL.completeness_review },
  ready_for_claude: { token: "degraded", label: STATUS_LABEL.ready_for_claude },
  search_review: { token: "degraded", label: STATUS_LABEL.search_review },
  fact_confidentiality_review: {
    token: "degraded",
    label: STATUS_LABEL.fact_confidentiality_review,
  },
  internal_approval: { token: "degraded", label: STATUS_LABEL.internal_approval },
  client_approval: { token: "degraded", label: STATUS_LABEL.client_approval },
  scheduled: { token: "healthy", label: STATUS_LABEL.scheduled },
  published: { token: "healthy", label: STATUS_LABEL.published },
  unpublished: { token: "notConfigured", label: STATUS_LABEL.unpublished },
  archived: { token: "unavailable", label: STATUS_LABEL.archived },
};

export function caseStudyStatusBadge(status: CaseStudyStatus): {
  readonly token: StatusToken;
  readonly label: string;
} {
  return STATUS_BADGE[status];
}

export const VISIBILITY_VALUES: readonly CaseStudyVisibility[] = [
  "public",
  "internal_only",
  "confidential",
  "client_approval_required",
];

export const VISIBILITY_LABEL: Readonly<Record<CaseStudyVisibility, string>> = {
  public: "Public",
  internal_only: "Internal Only",
  confidential: "Confidential",
  client_approval_required: "Client Approval Required",
};

export const ASSET_ROLE_VALUES: readonly CaseStudyAssetRole[] = [
  "hero_screenshot",
  "logo",
  "testimonial_screenshot",
  "video",
  "document",
  "other",
];

export const ASSET_ROLE_LABEL: Readonly<Record<CaseStudyAssetRole, string>> = {
  hero_screenshot: "Hero screenshot",
  logo: "Logo",
  testimonial_screenshot: "Testimonial screenshot",
  video: "Video",
  document: "Document",
  other: "Other",
};

export const CONSENT_TYPE_VALUES: readonly CaseStudyConsentType[] = [
  "client_publication",
  "testimonial",
  "logo_usage",
  "other",
];

export const CONSENT_TYPE_LABEL: Readonly<Record<CaseStudyConsentType, string>> = {
  client_publication: "Client publication",
  testimonial: "Testimonial",
  logo_usage: "Logo usage",
  other: "Other",
};

export interface CaseStudyStudioQuery {
  readonly status: CaseStudyStatus | null;
  readonly search: string | null;
  readonly offset: number;
  readonly pageSize: PageSize;
}

/**
 * Next.js `searchParams` is untrusted client input — validated against the same enum
 * `GET /case-study-studio/case-studies` itself accepts
 * (`apps/dashboard-api/src/case-study-studio/case-study-studio.dto.ts`'s
 * `listCaseStudiesQuerySchema`) rather than passed through raw, so a garbled URL degrades to the
 * default query instead of round-tripping an invalid value to the backend.
 */
export function parseCaseStudyStudioSearchParams(
  raw: Record<string, string | string[] | undefined>,
): CaseStudyStudioQuery {
  const status = firstValue(raw.status);
  const search = firstValue(raw.search);
  const offsetRaw = firstValue(raw.offset);
  const offset = offsetRaw ? Number.parseInt(offsetRaw, 10) : 0;

  return {
    status: STATUS_VALUES.includes(status as CaseStudyStatus) ? (status as CaseStudyStatus) : null,
    // Clamped to the same 255-char max the backend's own listCaseStudiesQuerySchema enforces —
    // matches every sibling list page's own defense-in-depth precedent.
    search: search ? search.slice(0, 255) : null,
    offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
    pageSize: parsePageSize(firstValue(raw.pageSize)),
  };
}

/**
 * Builds a `/case-study-studio?...` href — `overrides` wins over `current`, and changing anything
 * other than `offset` itself resets `offset` to 0, same convention as every sibling module's own
 * `build*Href`.
 */
export function buildCaseStudyStudioHref(
  current: CaseStudyStudioQuery,
  overrides: Partial<CaseStudyStudioQuery>,
): string {
  const next: CaseStudyStudioQuery = {
    ...current,
    ...overrides,
    offset: overrides.offset !== undefined ? overrides.offset : 0,
  };
  const params = new URLSearchParams();
  if (next.status) params.set("status", next.status);
  if (next.search) params.set("search", next.search);
  if (next.pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(next.pageSize));
  if (next.offset > 0) params.set("offset", String(next.offset));
  const queryString = params.toString();
  return queryString ? `/case-study-studio?${queryString}` : "/case-study-studio";
}
