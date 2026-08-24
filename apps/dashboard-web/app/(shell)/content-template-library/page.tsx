import Link from "next/link";
import type { ContentTemplate } from "@webdesk/shared-types";
import { ContentContainer, EmptyState, PageHeader, StatusBadge } from "@webdesk/ui";
import { PageSizeSelect } from "@/components/page-size-select";
import { primaryActionLinkStyle } from "@/lib/action-link-style";
import {
  APPROVAL_STATUS_LABEL,
  APPROVAL_STATUS_VALUES,
} from "@/lib/content-template-library-query";
import {
  buildContentTemplateLibraryHref,
  contentTemplateApprovalStatusBadge,
  contentTemplatePublishBadge,
  formatTimestamp,
  getContentTemplates,
  parseContentTemplateLibrarySearchParams,
} from "@/lib/content-template-library";
import {
  filterSelectStyle as selectStyle,
  filterSubmitButtonStyle as submitButtonStyle,
} from "@/lib/list-filter-styles";
import { listTableCellStyle, listTableHeaderCellStyle } from "@/lib/list-table-styles";
import { buildHrefBySize } from "@/lib/pagination";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface ContentTemplateLibraryListPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * No approved wireframe/screen spec exists for this module (`03_Detailed_Module_Specifications.md
 * §25` is a flat field list, no screen description) — renders exactly what
 * `GET /content-template-library/templates` returns and supports (an `approvalStatus` filter, an
 * `isPublished` filter, `search`, and offset pagination, no sort), matching the Persona/Service
 * Library list pages' own "smallest honest reading" precedent for an unsourced screen.
 */
export default async function ContentTemplateLibraryListPage({
  searchParams,
}: ContentTemplateLibraryListPageProps) {
  // The (shell) layout already redirects unauthenticated callers to sign-in before this page
  // renders — this defensive fallback avoids firing the list fetch in parallel with a redirect
  // that would just discard the result, matching every other page in this app.
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const query = parseContentTemplateLibrarySearchParams(await searchParams);
  const { items: templates, hasNextPage } = await getContentTemplates(query);
  const hasFilters = query.approvalStatus !== null || query.isPublished !== null;
  const isPastLastPage = templates.length === 0 && query.offset > 0;

  return (
    <ContentContainer>
      <PageHeader
        title="Content Template Library"
        contextActions={
          <Link href="/content-template-library/new" style={primaryActionLinkStyle}>
            New template
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
            Approval status
          </span>
          {/* `key` forces a remount whenever the underlying filter value changes, including back
              to "" on Clear filters — a Next.js <Link> soft-navigation otherwise re-renders this
              same DOM node in place, and an uncontrolled <select>'s defaultValue only takes effect
              on first mount (see persona-library/page.tsx's own identical note). */}
          <select
            key={query.approvalStatus ?? "all-approval-statuses"}
            name="approvalStatus"
            defaultValue={query.approvalStatus ?? ""}
            style={selectStyle}
          >
            <option value="">All approval statuses</option>
            {APPROVAL_STATUS_VALUES.map((value) => (
              <option key={value} value={value}>
                {APPROVAL_STATUS_LABEL[value]}
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
            href="/content-template-library"
            style={{ alignSelf: "flex-end", fontSize: "0.875rem", padding: "0.4rem 0" }}
          >
            Clear filters
          </Link>
        ) : null}
      </form>

      {templates.length === 0 ? (
        <EmptyState
          title={
            isPastLastPage
              ? "No more content templates"
              : hasFilters || query.search
                ? "No content templates match your filters"
                : "No content templates yet"
          }
          description={
            isPastLastPage
              ? "You've gone past the last page of results."
              : hasFilters || query.search
                ? "Try a different status or search term."
                : "Content templates created for this organization will appear here."
          }
          action={
            isPastLastPage ? (
              <Link
                href={buildContentTemplateLibraryHref(query, {
                  offset: Math.max(0, query.offset - query.pageSize),
                })}
                style={{ fontSize: "0.875rem" }}
              >
                Previous
              </Link>
            ) : hasFilters || query.search ? (
              <Link href="/content-template-library" style={{ fontSize: "0.875rem" }}>
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
                  <th style={thStyle}>Page type</th>
                  <th style={thStyle}>Approval</th>
                  <th style={thStyle}>Publish status</th>
                  <th style={thStyle}>Updated</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => (
                  <ContentTemplateRow key={template.id} template={template} />
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
              Showing {query.offset + 1}–{query.offset + templates.length}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
              <PageSizeSelect
                value={query.pageSize}
                hrefBySize={buildHrefBySize((pageSize) =>
                  buildContentTemplateLibraryHref(query, { pageSize }),
                )}
              />
              <div style={{ display: "flex", gap: "0.75rem" }}>
                {query.offset > 0 ? (
                  <Link
                    href={buildContentTemplateLibraryHref(query, {
                      offset: Math.max(0, query.offset - query.pageSize),
                    })}
                  >
                    Previous
                  </Link>
                ) : null}
                {hasNextPage ? (
                  <Link
                    href={buildContentTemplateLibraryHref(query, {
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

function ContentTemplateRow({ template }: { readonly template: ContentTemplate }) {
  const approvalBadge = contentTemplateApprovalStatusBadge(template.approvalStatus);
  const publishBadge = contentTemplatePublishBadge(template.isPublished);
  return (
    <tr>
      <td style={tdStyle}>
        <Link href={`/content-template-library/${template.id}`}>{template.pageType}</Link>
      </td>
      <td style={tdStyle}>
        <StatusBadge status={approvalBadge.token} label={approvalBadge.label} />
      </td>
      <td style={tdStyle}>
        <StatusBadge status={publishBadge.token} label={publishBadge.label} />
      </td>
      <td style={{ ...tdStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}>
        {formatTimestamp(template.updatedAt)}
      </td>
    </tr>
  );
}
