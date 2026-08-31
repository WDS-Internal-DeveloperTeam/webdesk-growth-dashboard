import type { PageTemplateApprovalStatus, PageType } from "@webdesk/shared-types";
import type { StatusToken } from "@webdesk/ui";
import {
  ARTIFACT_APPROVAL_STATUS_LABEL,
  ARTIFACT_APPROVAL_STATUS_VALUES,
  artifactApprovalStatusBadge,
} from "./artifact-approval-status";
import { DEFAULT_PAGE_SIZE, parsePageSize, type PageSize } from "./pagination";
import { firstValue } from "./search-params";

/**
 * `PageTemplateLibraryQuery`/`parsePageTemplateLibrarySearchParams`/
 * `buildPageTemplateLibraryHref` live in their own file with zero non-type imports, rather than in
 * `lib/page-template-library.ts` where the server-side fetch functions live — so a `"use client"`
 * component (the create/edit form, the status-actions island) can import the real functions
 * directly without pulling in `lib/page-template-library.ts`'s `next/headers` import. Same
 * precedent as `lib/component-library-query.ts`/`lib/section-and-pattern-library-query.ts`/
 * `lib/website-strategy-center-query.ts`/`lib/persona-library-query.ts`/
 * `lib/service-library-query.ts`.
 */

// PageTemplateApprovalStatus is structurally identical to ArtifactApprovalStatus (the shared
// 8-value workflow, reused verbatim by Design Token/Component/Section and Pattern/Service/
// Persona/Proof-and-Claims/Website Strategy Center Library) — reused directly rather than
// re-declared here, matching every sibling module's own `-query.ts` file.
const APPROVAL_STATUS_VALUES: readonly PageTemplateApprovalStatus[] =
  ARTIFACT_APPROVAL_STATUS_VALUES;

export const APPROVAL_STATUS_LABEL: Readonly<Record<PageTemplateApprovalStatus, string>> =
  ARTIFACT_APPROVAL_STATUS_LABEL;

export function pageTemplateApprovalStatusBadge(status: PageTemplateApprovalStatus): {
  readonly token: StatusToken;
  readonly label: string;
} {
  return artifactApprovalStatusBadge(status);
}

// Mirrors apps/dashboard-api/src/page-template-library/page-template-library.dto.ts's
// PAGE_TYPE_VALUES — kept in sync by hand, same approach every sibling module's own `-query.ts`
// file uses for its own enum.
export const PAGE_TYPE_VALUES: readonly PageType[] = [
  "homepage",
  "service",
  "platform",
  "industry",
  "location",
  "case_study",
  "portfolio",
  "landing",
  "article",
  "about",
  "contact",
  "team",
  "careers",
  "archive_category",
  "confirmation",
  "not_found",
  "campaign_event",
];

export const PAGE_TYPE_LABEL: Readonly<Record<PageType, string>> = {
  homepage: "Homepage",
  service: "Service",
  platform: "Platform",
  industry: "Industry",
  location: "Location",
  case_study: "Case study",
  portfolio: "Portfolio",
  landing: "Landing",
  article: "Article",
  about: "About",
  contact: "Contact",
  team: "Team",
  careers: "Careers",
  archive_category: "Archive / category",
  confirmation: "Confirmation",
  not_found: "Not found",
  campaign_event: "Campaign / event",
};

export interface PageTemplateLibraryQuery {
  readonly pageType: PageType | null;
  readonly approvalStatus: PageTemplateApprovalStatus | null;
  readonly search: string | null;
  readonly offset: number;
  readonly pageSize: PageSize;
}

/**
 * Next.js `searchParams` is untrusted client input — validated against the same enums
 * `GET /page-template-library/page-templates` itself accepts
 * (`apps/dashboard-api/src/page-template-library/page-template-library.dto.ts`'s
 * `listPageTemplatesQuerySchema`) rather than passed through raw, so a garbled URL degrades to
 * the default query instead of round-tripping an invalid value to the backend. No
 * `sortBy`/`sortOrder` param — the backend's `list()` supports neither, matching
 * `ComponentLibraryQuery`'s own precedent.
 */
export function parsePageTemplateLibrarySearchParams(
  raw: Record<string, string | string[] | undefined>,
): PageTemplateLibraryQuery {
  const pageType = firstValue(raw.pageType);
  const approvalStatus = firstValue(raw.approvalStatus);
  const search = firstValue(raw.search);
  const offsetRaw = firstValue(raw.offset);
  const offset = offsetRaw ? Number.parseInt(offsetRaw, 10) : 0;

  return {
    pageType: PAGE_TYPE_VALUES.includes(pageType as PageType) ? (pageType as PageType) : null,
    approvalStatus: APPROVAL_STATUS_VALUES.includes(approvalStatus as PageTemplateApprovalStatus)
      ? (approvalStatus as PageTemplateApprovalStatus)
      : null,
    // Clamped to the same 255-char max the backend's own listPageTemplatesQuerySchema enforces —
    // matches every sibling list page's own defense-in-depth precedent.
    search: search ? search.slice(0, 255) : null,
    offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
    pageSize: parsePageSize(firstValue(raw.pageSize)),
  };
}

/**
 * Builds a `/page-template-library?...` href — `overrides` wins over `current`, and changing
 * anything other than `offset` itself resets `offset` to 0, same convention as
 * `buildComponentLibraryHref`/`buildSectionAndPatternLibraryHref`/`buildWebsiteStrategyCenterHref`.
 */
export function buildPageTemplateLibraryHref(
  current: PageTemplateLibraryQuery,
  overrides: Partial<PageTemplateLibraryQuery>,
): string {
  const next: PageTemplateLibraryQuery = {
    ...current,
    ...overrides,
    offset: overrides.offset !== undefined ? overrides.offset : 0,
  };
  const params = new URLSearchParams();
  if (next.pageType) params.set("pageType", next.pageType);
  if (next.approvalStatus) params.set("approvalStatus", next.approvalStatus);
  if (next.search) params.set("search", next.search);
  if (next.pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(next.pageSize));
  if (next.offset > 0) params.set("offset", String(next.offset));
  const queryString = params.toString();
  return queryString ? `/page-template-library?${queryString}` : "/page-template-library";
}
