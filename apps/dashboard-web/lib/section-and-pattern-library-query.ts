import type { SectionPatternApprovalStatus, SectionPatternType } from "@webdesk/shared-types";
import type { StatusToken } from "@webdesk/ui";
import {
  ARTIFACT_APPROVAL_STATUS_LABEL,
  ARTIFACT_APPROVAL_STATUS_VALUES,
  artifactApprovalStatusBadge,
} from "./artifact-approval-status";
import { DEFAULT_PAGE_SIZE, parsePageSize, type PageSize } from "./pagination";
import { firstValue } from "./search-params";

/**
 * `SectionAndPatternLibraryQuery`/`parseSectionAndPatternLibrarySearchParams`/
 * `buildSectionAndPatternLibraryHref` live in their own file with zero non-type imports, rather
 * than in `lib/section-and-pattern-library.ts` where the server-side fetch functions live — so a
 * `"use client"` component (the create/edit form, the status-actions island) can import the real
 * functions directly without pulling in `lib/section-and-pattern-library.ts`'s `next/headers`
 * import. Same precedent as `lib/design-token-library-query.ts`/
 * `lib/website-strategy-center-query.ts`/`lib/persona-library-query.ts`/
 * `lib/service-library-query.ts`.
 */

// SectionPatternApprovalStatus is structurally identical to ArtifactApprovalStatus (the shared
// 8-value workflow, reused verbatim by Design Token/Service/Persona/Proof-and-Claims/Website
// Strategy Center Library) — reused directly rather than re-declared here, matching every sibling
// module's own `-query.ts` file.
const APPROVAL_STATUS_VALUES: readonly SectionPatternApprovalStatus[] =
  ARTIFACT_APPROVAL_STATUS_VALUES;

export const APPROVAL_STATUS_LABEL: Readonly<Record<SectionPatternApprovalStatus, string>> =
  ARTIFACT_APPROVAL_STATUS_LABEL;

export function sectionPatternApprovalStatusBadge(status: SectionPatternApprovalStatus): {
  readonly token: StatusToken;
  readonly label: string;
} {
  return artifactApprovalStatusBadge(status);
}

// Mirrors apps/dashboard-api/src/section-and-pattern-library/section-and-pattern-library.dto.ts's
// PATTERN_TYPE_VALUES — kept in sync by hand, same approach every sibling module's own
// `-query.ts` file uses for its own enum.
export const PATTERN_TYPE_VALUES: readonly SectionPatternType[] = [
  "homepage_storytelling",
  "service",
  "industry",
  "location",
  "landing_conversion",
  "portfolio_showcase",
  "social_proof",
  "results_metrics",
  "engagement_models",
  "team_expertise",
  "content_hub",
  "article",
  "lead_capture",
  "download",
  "multi_step_form",
  "search_filter",
  "trust",
  "objection_handling",
  "cross_sell",
  "error_no_results",
];

export const PATTERN_TYPE_LABEL: Readonly<Record<SectionPatternType, string>> = {
  homepage_storytelling: "Homepage storytelling",
  service: "Service",
  industry: "Industry",
  location: "Location",
  landing_conversion: "Landing / conversion",
  portfolio_showcase: "Portfolio showcase",
  social_proof: "Social proof",
  results_metrics: "Results / metrics",
  engagement_models: "Engagement models",
  team_expertise: "Team / expertise",
  content_hub: "Content hub",
  article: "Article",
  lead_capture: "Lead capture",
  download: "Download",
  multi_step_form: "Multi-step form",
  search_filter: "Search / filter",
  trust: "Trust",
  objection_handling: "Objection handling",
  cross_sell: "Cross-sell",
  error_no_results: "Error / no results",
};

export interface SectionAndPatternLibraryQuery {
  readonly patternType: SectionPatternType | null;
  readonly approvalStatus: SectionPatternApprovalStatus | null;
  readonly search: string | null;
  readonly offset: number;
  readonly pageSize: PageSize;
}

/**
 * Next.js `searchParams` is untrusted client input — validated against the same enums
 * `GET /section-and-pattern-library/records` itself accepts
 * (`apps/dashboard-api/src/section-and-pattern-library/section-and-pattern-library.dto.ts`'s
 * `listSectionPatternRecordsQuerySchema`) rather than passed through raw, so a garbled URL
 * degrades to the default query instead of round-tripping an invalid value to the backend. No
 * `sortBy`/`sortOrder` param — the backend's `list()` supports neither, matching
 * `DesignTokenLibraryQuery`'s own precedent.
 */
export function parseSectionAndPatternLibrarySearchParams(
  raw: Record<string, string | string[] | undefined>,
): SectionAndPatternLibraryQuery {
  const patternType = firstValue(raw.patternType);
  const approvalStatus = firstValue(raw.approvalStatus);
  const search = firstValue(raw.search);
  const offsetRaw = firstValue(raw.offset);
  const offset = offsetRaw ? Number.parseInt(offsetRaw, 10) : 0;

  return {
    patternType: PATTERN_TYPE_VALUES.includes(patternType as SectionPatternType)
      ? (patternType as SectionPatternType)
      : null,
    approvalStatus: APPROVAL_STATUS_VALUES.includes(approvalStatus as SectionPatternApprovalStatus)
      ? (approvalStatus as SectionPatternApprovalStatus)
      : null,
    // Clamped to the same 255-char max the backend's own listSectionPatternRecordsQuerySchema
    // enforces — matches the Projects/Service Library/Persona Library/Design Token Library list
    // pages' own defense-in-depth precedent.
    search: search ? search.slice(0, 255) : null,
    offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
    pageSize: parsePageSize(firstValue(raw.pageSize)),
  };
}

/**
 * Builds a `/section-and-pattern-library?...` href — `overrides` wins over `current`, and
 * changing anything other than `offset` itself resets `offset` to 0, same convention as
 * `buildDesignTokenLibraryHref`/`buildWebsiteStrategyCenterHref`/`buildPersonaLibraryHref`.
 */
export function buildSectionAndPatternLibraryHref(
  current: SectionAndPatternLibraryQuery,
  overrides: Partial<SectionAndPatternLibraryQuery>,
): string {
  const next: SectionAndPatternLibraryQuery = {
    ...current,
    ...overrides,
    offset: overrides.offset !== undefined ? overrides.offset : 0,
  };
  const params = new URLSearchParams();
  if (next.patternType) params.set("patternType", next.patternType);
  if (next.approvalStatus) params.set("approvalStatus", next.approvalStatus);
  if (next.search) params.set("search", next.search);
  if (next.pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(next.pageSize));
  if (next.offset > 0) params.set("offset", String(next.offset));
  const queryString = params.toString();
  return queryString
    ? `/section-and-pattern-library?${queryString}`
    : "/section-and-pattern-library";
}
