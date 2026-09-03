import { cookies } from "next/headers";
import type { ApiSuccessResponse, HelpArticle } from "@webdesk/shared-types";
import { getApiBaseUrl } from "./auth";
import {
  CATEGORY_LABEL,
  CATEGORY_VALUES,
  buildHelpCenterHref,
  helpArticlePublishBadge,
  parseHelpCenterSearchParams,
  type HelpCenterQuery,
} from "./help-center-query";
import { formatTimestamp } from "./format-timestamp";
import { isUuid } from "./uuid";

export {
  CATEGORY_LABEL,
  CATEGORY_VALUES,
  buildHelpCenterHref,
  formatTimestamp,
  helpArticlePublishBadge,
  parseHelpCenterSearchParams,
};
export type { HelpCenterQuery };

export interface HelpArticleListResult {
  readonly items: readonly HelpArticle[];
  /** Same "request one row past the chosen page size" technique `getContentTemplates()`/
   *  `getPersonas()` use — `GET /help-center/articles` returns no total count to check against. */
  readonly hasNextPage: boolean;
}

/** Never degrades silently — this page's entire content IS the article list, so a fetch failure
 *  must surface as a real error state (propagates to the nearest `error.tsx`), matching
 *  `getContentTemplates()`'s/`getPersonas()`'s own precedent. */
export async function getHelpArticles(query: HelpCenterQuery): Promise<HelpArticleListResult> {
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const params = new URLSearchParams();
  if (query.category) params.set("category", query.category);
  if (query.isPublished !== null) params.set("isPublished", String(query.isPublished));
  if (query.search) params.set("search", query.search);
  params.set("limit", String(query.pageSize + 1));
  params.set("offset", String(query.offset));

  const response = await fetch(`${apiBaseUrl}/help-center/articles?${params.toString()}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Failed to load help articles (status ${response.status})`);
  }
  const body = (await response.json()) as ApiSuccessResponse<readonly HelpArticle[]>;
  return {
    items: body.data.slice(0, query.pageSize),
    hasNextPage: body.data.length > query.pageSize,
  };
}

/**
 * Fetches one help article. Returns `null` on a 404 (the caller renders `notFound()`) or a
 * malformed id (rejected via `isUuid()` before any network call, the same short-circuit
 * `getContentTemplate()`/`getPersona()` use), and throws on any other non-OK status (403/5xx).
 */
export async function getHelpArticle(articleId: string): Promise<HelpArticle | null> {
  if (!isUuid(articleId)) {
    return null;
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const response = await fetch(`${apiBaseUrl}/help-center/articles/${articleId}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load help article (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<HelpArticle>).data;
}
