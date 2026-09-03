import type { HelpArticleCategory } from "@webdesk/shared-types";
import type { StatusToken } from "@webdesk/ui";
import { DEFAULT_PAGE_SIZE, parsePageSize, type PageSize } from "./pagination";
import { firstValue } from "./search-params";

/**
 * `HelpCenterQuery`/`parseHelpCenterSearchParams`/`buildHelpCenterHref`/category vocabulary live in
 * their own file with zero non-type imports, rather than in `lib/help-center.ts` where the
 * server-side fetch functions live — so a `"use client"` component (the create/edit form, the
 * publish-actions island) can import the real functions directly without pulling in
 * `lib/help-center.ts`'s `next/headers` import. Same precedent as `lib/persona-library-query.ts`/
 * `lib/content-template-library-query.ts`.
 */

// Taken verbatim from `03_Detailed_Module_Specifications.md §38`'s own topic list, matching
// `apps/dashboard-api/src/help-center/help-center.dto.ts`'s `helpArticleCategorySchema` exactly.
export const CATEGORY_VALUES: readonly HelpArticleCategory[] = [
  "onboarding",
  "project_setup",
  "wordpress_publishing",
  "review_approval",
  "staging_to_production",
  "import_export",
  "search_filtering",
  "design_libraries",
  "page_workspace",
  "security_qa",
  "backup_rollback",
  "faq",
  "videos",
  "known_issues",
  "feedback",
  "version_history",
];

export const CATEGORY_LABEL: Readonly<Record<HelpArticleCategory, string>> = {
  onboarding: "Onboarding",
  project_setup: "Project setup",
  wordpress_publishing: "WordPress publishing",
  review_approval: "Review/approval",
  staging_to_production: "Staging-to-production",
  import_export: "Import/export",
  search_filtering: "Search/filtering",
  design_libraries: "Design libraries",
  page_workspace: "Page Workspace",
  security_qa: "Security/QA",
  backup_rollback: "Backup/rollback",
  faq: "FAQ",
  videos: "Videos",
  known_issues: "Known issues",
  feedback: "Feedback",
  version_history: "Version history",
};

/**
 * `isPublished` badge presentation — this module has no `approvalStatus` at all (the simplest
 * content-library module built to date), so unlike `contentTemplatePublishBadge()`/
 * `brandLibraryPublishBadge()` there is no sibling approval-status badge on the same screen to
 * avoid colliding with; `healthy`/`notConfigured` are still used for consistency with every other
 * publish-badge pairing in this app.
 */
export function helpArticlePublishBadge(isPublished: boolean): {
  readonly token: StatusToken;
  readonly label: string;
} {
  return isPublished
    ? { token: "healthy", label: "Published" }
    : { token: "notConfigured", label: "Unpublished" };
}

export interface HelpCenterQuery {
  readonly category: HelpArticleCategory | null;
  readonly isPublished: boolean | null;
  readonly search: string | null;
  readonly offset: number;
  readonly pageSize: PageSize;
}

/**
 * Next.js `searchParams` is untrusted client input — validated against the same values
 * `GET /help-center/articles` itself accepts
 * (`apps/dashboard-api/src/help-center/help-center.dto.ts`'s `listHelpArticlesQuerySchema`) rather
 * than passed through raw, so a garbled URL degrades to the default query instead of round-tripping
 * an invalid value to the backend. No `sortBy`/`sortOrder` param — the backend's `list()` supports
 * neither.
 */
export function parseHelpCenterSearchParams(
  raw: Record<string, string | string[] | undefined>,
): HelpCenterQuery {
  const category = firstValue(raw.category);
  const isPublishedRaw = firstValue(raw.isPublished);
  const search = firstValue(raw.search);
  const offsetRaw = firstValue(raw.offset);
  const offset = offsetRaw ? Number.parseInt(offsetRaw, 10) : 0;

  return {
    category: CATEGORY_VALUES.includes(category as HelpArticleCategory)
      ? (category as HelpArticleCategory)
      : null,
    isPublished: isPublishedRaw === "true" ? true : isPublishedRaw === "false" ? false : null,
    // Clamped to the same 255-char max the backend's own listHelpArticlesQuerySchema enforces —
    // matches every sibling list page's own defense-in-depth precedent.
    search: search ? search.slice(0, 255) : null,
    offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
    pageSize: parsePageSize(firstValue(raw.pageSize)),
  };
}

/**
 * Builds a `/help-center?...` href — `overrides` wins over `current`, and changing anything other
 * than `offset` itself resets `offset` to 0, same convention as `buildContentTemplateLibraryHref`.
 */
export function buildHelpCenterHref(
  current: HelpCenterQuery,
  overrides: Partial<HelpCenterQuery>,
): string {
  const next: HelpCenterQuery = {
    ...current,
    ...overrides,
    offset: overrides.offset !== undefined ? overrides.offset : 0,
  };
  const params = new URLSearchParams();
  if (next.category) params.set("category", next.category);
  if (next.isPublished !== null) params.set("isPublished", String(next.isPublished));
  if (next.search) params.set("search", next.search);
  if (next.pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(next.pageSize));
  if (next.offset > 0) params.set("offset", String(next.offset));
  const queryString = params.toString();
  return queryString ? `/help-center?${queryString}` : "/help-center";
}
