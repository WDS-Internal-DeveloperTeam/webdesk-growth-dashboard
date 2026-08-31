import { cookies } from "next/headers";
import type {
  ApiSuccessResponse,
  ComponentRecord,
  PageTemplateRecord,
  SectionPatternRecord,
} from "@webdesk/shared-types";
import { getApiBaseUrl } from "./auth";
import { getComponents } from "./component-library";
import { formatTimestamp } from "./format-timestamp";
import {
  APPROVAL_STATUS_LABEL,
  buildPageTemplateLibraryHref,
  pageTemplateApprovalStatusBadge,
  parsePageTemplateLibrarySearchParams,
  type PageTemplateLibraryQuery,
} from "./page-template-library-query";
import { getSectionPatterns } from "./section-and-pattern-library";
import { isUuid } from "./uuid";

export {
  APPROVAL_STATUS_LABEL,
  buildPageTemplateLibraryHref,
  formatTimestamp,
  pageTemplateApprovalStatusBadge,
  parsePageTemplateLibrarySearchParams,
};
export type { PageTemplateLibraryQuery };

export interface PageTemplateListResult {
  readonly items: readonly PageTemplateRecord[];
  /** Same "request one row past the chosen page size" technique `getComponents()`/
   *  `getSectionPatterns()`/`getServices()`/`getPersonas()` use —
   *  `GET /page-template-library/page-templates` returns no total count to check against. */
  readonly hasNextPage: boolean;
}

/** Never degrades silently — this page's entire content IS the page-template list, so a fetch
 *  failure must surface as a real error state (propagates to the nearest `error.tsx`), matching
 *  every sibling module's own list-fetch precedent. */
export async function getPageTemplates(
  query: PageTemplateLibraryQuery,
): Promise<PageTemplateListResult> {
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const params = new URLSearchParams();
  if (query.pageType) params.set("pageType", query.pageType);
  if (query.approvalStatus) params.set("approvalStatus", query.approvalStatus);
  if (query.search) params.set("search", query.search);
  params.set("limit", String(query.pageSize + 1));
  params.set("offset", String(query.offset));

  const response = await fetch(
    `${apiBaseUrl}/page-template-library/page-templates?${params.toString()}`,
    {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to load page templates (status ${response.status})`);
  }
  const body = (await response.json()) as ApiSuccessResponse<readonly PageTemplateRecord[]>;
  return {
    items: body.data.slice(0, query.pageSize),
    hasNextPage: body.data.length > query.pageSize,
  };
}

/**
 * Fetches the CURRENT version of one page template, by its stable `recordId` — not the row `id`
 * (which changes across a version fork). Returns `null` on a 404 (the caller renders
 * `notFound()`) or a malformed id (rejected via `isUuid()` before any network call, the same
 * short-circuit `getComponent()`/`getSectionPattern()`/`getWebsiteStrategyRecord()`/`getPersona()`
 * use), and throws on any other non-OK status (403/5xx).
 */
export async function getPageTemplate(recordId: string): Promise<PageTemplateRecord | null> {
  if (!isUuid(recordId)) {
    return null;
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const response = await fetch(`${apiBaseUrl}/page-template-library/page-templates/${recordId}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load page template (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<PageTemplateRecord>).data;
}

/**
 * Fetches every version of one page template, oldest first (the backend's own order — see
 * `PageTemplateRepository.listVersions()`), for the detail page's "Version history" section.
 * Returns an empty array rather than throwing on a malformed id (the same short-circuit
 * `getPageTemplate()` uses) or on a 404 — the detail page already gates its own rendering on
 * `getPageTemplate()`'s own `null`/`notFound()` result, so a genuinely-missing record never
 * reaches a point where this function's result matters; degrading here instead of throwing just
 * avoids a second, redundant not-found code path. Any other non-OK status still throws, matching
 * every other fetch function in this module.
 */
export async function getPageTemplateVersions(
  recordId: string,
): Promise<readonly PageTemplateRecord[]> {
  if (!isUuid(recordId)) {
    return [];
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const response = await fetch(
    `${apiBaseUrl}/page-template-library/page-templates/${recordId}/versions`,
    {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    },
  );
  if (response.status === 404) {
    return [];
  }
  if (!response.ok) {
    throw new Error(`Failed to load page template versions (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<readonly PageTemplateRecord[]>).data;
}

/**
 * Fetches Section and Pattern Library records to populate the `requiredSectionIds`/
 * `optionalSectionIds` `RelationshipPicker`s' option set — reuses `getSectionPatterns()` (Section
 * and Pattern Library's own list fetch) rather than a new function, at the largest real
 * `PageSize` option (100), mirroring `getDesignTokensForComponentPicker()`'s own precedent. The
 * backend's own list cap is 200 (`MAX_LIST_LIMIT`), so a catalog larger than 100 rows silently
 * shows only its first page here — the identical bound every dimension-list-backed picker in this
 * app already accepts, not fixed in this pass.
 *
 * Degrades to an empty list on failure rather than throwing (mirrors
 * `getDesignTokensForComponentPicker()`'s own reasoning) — this is enrichment for the relationship
 * pickers, not the page template's own primary content, and every caller runs it alongside
 * `getPageTemplate()`/renders it on its own page. Without this, a transient Section and Pattern
 * Library outage would crash the entire detail/edit/new page template page even when the page
 * template itself loaded fine. The one real cost is a silently-empty picker on failure, logged
 * here so it's diagnosable server-side rather than invisible.
 */
export async function getSectionPatternsForPageTemplatePicker(): Promise<
  readonly SectionPatternRecord[]
> {
  try {
    const { items } = await getSectionPatterns({
      patternType: null,
      approvalStatus: null,
      search: null,
      offset: 0,
      pageSize: 100,
    });
    return items;
  } catch (error) {
    console.error(
      "Failed to load section/pattern records for the page-template relationship pickers:",
      error,
    );
    return [];
  }
}

/**
 * Fetches Component Library records to populate the `supportedComponentIds` `RelationshipPicker`'s
 * option set — reuses `getComponents()` (Component Library's own list fetch), same reasoning as
 * `getSectionPatternsForPageTemplatePicker()` immediately above.
 */
export async function getComponentsForPageTemplatePicker(): Promise<readonly ComponentRecord[]> {
  try {
    const { items } = await getComponents({
      category: null,
      approvalStatus: null,
      search: null,
      offset: 0,
      pageSize: 100,
    });
    return items;
  } catch (error) {
    console.error("Failed to load components for the page-template relationship picker:", error);
    return [];
  }
}

/**
 * Fetches page templates to populate the `replacementRecordId` `SinglePageTemplatePicker`'s
 * option set — reuses `getPageTemplates()` (this module's own list fetch) at the largest real
 * `PageSize` option (100), mirroring `getComponentsForReplacementPicker()`'s own reasoning. Unlike
 * the two cross-module fetches above, this is an IN-module self-reference — a page template
 * picking which OTHER page template (by `recordId`) replaces it — so the currently-edited record
 * is excluded client-side by the picker itself (`SinglePageTemplatePicker`'s own
 * `excludeRecordId` prop), not here.
 *
 * Degrades to an empty list on failure rather than throwing, same reasoning as
 * `getSectionPatternsForPageTemplatePicker()` — a transient failure here must not crash the whole
 * detail/edit/new page.
 */
export async function getPageTemplatesForReplacementPicker(): Promise<
  readonly PageTemplateRecord[]
> {
  try {
    const { items } = await getPageTemplates({
      pageType: null,
      approvalStatus: null,
      search: null,
      offset: 0,
      pageSize: 100,
    });
    return items;
  } catch (error) {
    console.error("Failed to load page templates for the replacement-page-template picker:", error);
    return [];
  }
}
