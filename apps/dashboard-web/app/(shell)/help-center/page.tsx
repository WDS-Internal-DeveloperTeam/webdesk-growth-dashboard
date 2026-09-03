import Link from "next/link";
import type { HelpArticle } from "@webdesk/shared-types";
import { ContentContainer, EmptyState, PageHeader, StatusBadge } from "@webdesk/ui";
import { PageSizeSelect } from "@/components/page-size-select";
import { primaryActionLinkStyle } from "@/lib/action-link-style";
import { CATEGORY_LABEL, CATEGORY_VALUES } from "@/lib/help-center-query";
import {
  buildHelpCenterHref,
  formatTimestamp,
  getHelpArticles,
  helpArticlePublishBadge,
  parseHelpCenterSearchParams,
} from "@/lib/help-center";
import {
  filterSelectStyle as selectStyle,
  filterSubmitButtonStyle as submitButtonStyle,
} from "@/lib/list-filter-styles";
import { listTableCellStyle, listTableHeaderCellStyle } from "@/lib/list-table-styles";
import { buildHrefBySize } from "@/lib/pagination";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface HelpCenterListPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * No approved wireframe/screen spec exists for this module (`03_Detailed_Module_Specifications.md
 * §38` is a topics list, no screen description) — renders exactly what `GET /help-center/articles`
 * returns and supports (a `category` filter, an `isPublished` filter, `search`, and offset
 * pagination, no sort), matching the Content Template/Persona Library list pages' own "smallest
 * honest reading" precedent for an unsourced screen.
 */
export default async function HelpCenterListPage({ searchParams }: HelpCenterListPageProps) {
  // The (shell) layout already redirects unauthenticated callers to sign-in before this page
  // renders — this defensive fallback avoids firing the list fetch in parallel with a redirect
  // that would just discard the result, matching every other page in this app.
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const query = parseHelpCenterSearchParams(await searchParams);
  const { items: articles, hasNextPage } = await getHelpArticles(query);
  const hasFilters = query.category !== null || query.isPublished !== null;
  const isPastLastPage = articles.length === 0 && query.offset > 0;

  return (
    <ContentContainer>
      <PageHeader
        title="Help Center"
        contextActions={
          <Link href="/help-center/new" style={primaryActionLinkStyle}>
            New article
          </Link>
        }
      />

      <form
        method="get"
        style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1.5rem" }}
      >
        {/* Preserves the reader's page-size choice across a filter submit — without it, a native
            GET form submission builds its target URL purely from this form's own named fields,
            silently dropping any existing `?pageSize=` and resetting it back to the default. */}
        <input type="hidden" name="pageSize" value={query.pageSize} />
        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <span
            style={{
              fontSize: "0.75rem",
              color: "var(--webdesk-dashboard-color-foreground-muted)",
            }}
          >
            Category
          </span>
          {/* `key` forces a remount whenever the underlying filter value changes, including back
              to "" on Clear filters — a Next.js <Link> soft-navigation otherwise re-renders this
              same DOM node in place, and an uncontrolled <select>'s defaultValue only takes effect
              on first mount (see content-template-library/page.tsx's own identical note). */}
          <select
            key={query.category ?? "all-categories"}
            name="category"
            defaultValue={query.category ?? ""}
            style={selectStyle}
          >
            <option value="">All categories</option>
            {CATEGORY_VALUES.map((value) => (
              <option key={value} value={value}>
                {CATEGORY_LABEL[value]}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <span
            style={{
              fontSize: "0.75rem",
              color: "var(--webdesk-dashboard-color-foreground-muted)",
            }}
          >
            Publish status
          </span>
          <select
            key={query.isPublished === null ? "all-publish-statuses" : String(query.isPublished)}
            name="isPublished"
            defaultValue={query.isPublished === null ? "" : String(query.isPublished)}
            style={selectStyle}
          >
            <option value="">All publish statuses</option>
            <option value="true">Published</option>
            <option value="false">Unpublished</option>
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <span
            style={{
              fontSize: "0.75rem",
              color: "var(--webdesk-dashboard-color-foreground-muted)",
            }}
          >
            Search
          </span>
          <input
            key={query.search ?? "no-search"}
            type="text"
            name="search"
            defaultValue={query.search ?? ""}
            maxLength={255}
            style={selectStyle}
          />
        </label>
        <button type="submit" style={submitButtonStyle}>
          Apply
        </button>
        {hasFilters || query.search ? (
          <Link
            href="/help-center"
            style={{ alignSelf: "flex-end", fontSize: "0.875rem", padding: "0.4rem 0" }}
          >
            Clear filters
          </Link>
        ) : null}
      </form>

      {articles.length === 0 ? (
        <EmptyState
          title={
            isPastLastPage
              ? "No more help articles"
              : hasFilters || query.search
                ? "No help articles match your filters"
                : "No help articles yet"
          }
          description={
            isPastLastPage
              ? "You've gone past the last page of results."
              : hasFilters || query.search
                ? "Try a different category or search term."
                : "Help articles created for this organization will appear here."
          }
          action={
            isPastLastPage ? (
              <Link
                href={buildHelpCenterHref(query, {
                  offset: Math.max(0, query.offset - query.pageSize),
                })}
                style={{ fontSize: "0.875rem" }}
              >
                Previous
              </Link>
            ) : hasFilters || query.search ? (
              <Link href="/help-center" style={{ fontSize: "0.875rem" }}>
                Clear filters
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
              <thead>
                <tr>
                  <th style={thStyle}>Title</th>
                  <th style={thStyle}>Category</th>
                  <th style={thStyle}>Publish status</th>
                  <th style={thStyle}>Updated</th>
                </tr>
              </thead>
              <tbody>
                {articles.map((article) => (
                  <HelpArticleRow key={article.id} article={article} />
                ))}
              </tbody>
            </table>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "1rem",
              fontSize: "0.875rem",
            }}
          >
            <span style={{ color: "var(--webdesk-dashboard-color-foreground-muted)" }}>
              Showing {query.offset + 1}–{query.offset + articles.length}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
              <PageSizeSelect
                value={query.pageSize}
                hrefBySize={buildHrefBySize((pageSize) => buildHelpCenterHref(query, { pageSize }))}
              />
              <div style={{ display: "flex", gap: "0.75rem" }}>
                {query.offset > 0 ? (
                  <Link
                    href={buildHelpCenterHref(query, {
                      offset: Math.max(0, query.offset - query.pageSize),
                    })}
                  >
                    Previous
                  </Link>
                ) : null}
                {hasNextPage ? (
                  <Link
                    href={buildHelpCenterHref(query, {
                      offset: query.offset + query.pageSize,
                    })}
                  >
                    Next
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </>
      )}
    </ContentContainer>
  );
}

const thStyle = listTableHeaderCellStyle;

const tdStyle = listTableCellStyle;

function HelpArticleRow({ article }: { readonly article: HelpArticle }) {
  const publishBadge = helpArticlePublishBadge(article.isPublished);
  return (
    <tr>
      <td style={tdStyle}>
        <Link href={`/help-center/${article.id}`}>{article.title}</Link>
      </td>
      <td style={tdStyle}>{CATEGORY_LABEL[article.category]}</td>
      <td style={tdStyle}>
        <StatusBadge status={publishBadge.token} label={publishBadge.label} />
      </td>
      <td style={{ ...tdStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}>
        {formatTimestamp(article.updatedAt)}
      </td>
    </tr>
  );
}
