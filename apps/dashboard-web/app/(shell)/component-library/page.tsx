import Link from "next/link";
import type { ComponentRecord } from "@webdesk/shared-types";
import { ContentContainer, EmptyState, PageHeader, StatusBadge } from "@webdesk/ui";
import { PageSizeSelect } from "@/components/page-size-select";
import { primaryActionLinkStyle } from "@/lib/action-link-style";
import { ARTIFACT_APPROVAL_STATUS_VALUES } from "@/lib/artifact-approval-status";
import {
  APPROVAL_STATUS_LABEL,
  buildComponentLibraryHref,
  componentApprovalStatusBadge,
  formatTimestamp,
  getComponents,
  parseComponentLibrarySearchParams,
} from "@/lib/component-library";
import {
  filterSelectStyle as selectStyle,
  filterSubmitButtonStyle as submitButtonStyle,
} from "@/lib/list-filter-styles";
import { listTableCellStyle, listTableHeaderCellStyle } from "@/lib/list-table-styles";
import { buildHrefBySize } from "@/lib/pagination";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface ComponentLibraryListPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * No approved wireframe/screen spec exists for this module — renders exactly what
 * `GET /component-library/components` returns and supports (CURRENT versions only, a `category`
 * filter — free text, matching the backend's own field, not an enum select like Design Token
 * Library's `group` — an `approvalStatus` filter, `search`, and offset pagination, no sort),
 * matching every sibling module's own "smallest honest reading" precedent for an unsourced screen.
 */
export default async function ComponentLibraryListPage({
  searchParams,
}: ComponentLibraryListPageProps) {
  // The (shell) layout already redirects unauthenticated callers to sign-in before this page
  // renders — this defensive fallback avoids firing the list fetch in parallel with a redirect
  // that would just discard the result, matching every other page in this app.
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const query = parseComponentLibrarySearchParams(await searchParams);
  const { items: components, hasNextPage } = await getComponents(query);
  const hasFilters = query.category !== null || query.approvalStatus !== null;
  const isPastLastPage = components.length === 0 && query.offset > 0;

  return (
    <ContentContainer>
      <PageHeader
        title="Component Library"
        contextActions={
          <Link href="/component-library/new" style={primaryActionLinkStyle}>
            New component
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
              same DOM node in place, and an uncontrolled <input>'s defaultValue only takes effect
              on first mount (see website-strategy-center/page.tsx's own identical note). */}
          <input
            key={query.category ?? "no-category"}
            type="text"
            name="category"
            defaultValue={query.category ?? ""}
            maxLength={100}
            style={selectStyle}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <span
            style={{
              fontSize: "0.75rem",
              color: "var(--webdesk-dashboard-color-foreground-muted)",
            }}
          >
            Approval status
          </span>
          <select
            key={query.approvalStatus ?? "all-approval-statuses"}
            name="approvalStatus"
            defaultValue={query.approvalStatus ?? ""}
            style={selectStyle}
          >
            <option value="">All approval statuses</option>
            {ARTIFACT_APPROVAL_STATUS_VALUES.map((value) => (
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
            href="/component-library"
            style={{ alignSelf: "flex-end", fontSize: "0.875rem", padding: "0.4rem 0" }}
          >
            Clear filters
          </Link>
        ) : null}
      </form>

      {components.length === 0 ? (
        <EmptyState
          title={
            isPastLastPage
              ? "No more components"
              : hasFilters || query.search
                ? "No components match your filters"
                : "No components yet"
          }
          description={
            isPastLastPage
              ? "You've gone past the last page of results."
              : hasFilters || query.search
                ? "Try a different category, status, or search term."
                : "Components created for this organization will appear here."
          }
          action={
            isPastLastPage ? (
              <Link
                href={buildComponentLibraryHref(query, {
                  offset: Math.max(0, query.offset - query.pageSize),
                })}
                style={{ fontSize: "0.875rem" }}
              >
                Previous
              </Link>
            ) : hasFilters || query.search ? (
              <Link href="/component-library" style={{ fontSize: "0.875rem" }}>
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
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Category</th>
                  <th style={thStyle}>Approval</th>
                  <th style={thStyle}>Version</th>
                  <th style={thStyle}>Updated</th>
                </tr>
              </thead>
              <tbody>
                {components.map((component) => (
                  <ComponentRow key={component.id} component={component} />
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
              Showing {query.offset + 1}–{query.offset + components.length}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
              <PageSizeSelect
                value={query.pageSize}
                hrefBySize={buildHrefBySize((pageSize) =>
                  buildComponentLibraryHref(query, { pageSize }),
                )}
              />
              <div style={{ display: "flex", gap: "0.75rem" }}>
                {query.offset > 0 ? (
                  <Link
                    href={buildComponentLibraryHref(query, {
                      offset: Math.max(0, query.offset - query.pageSize),
                    })}
                  >
                    Previous
                  </Link>
                ) : null}
                {hasNextPage ? (
                  <Link
                    href={buildComponentLibraryHref(query, {
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

function ComponentRow({ component }: { readonly component: ComponentRecord }) {
  const approvalBadge = componentApprovalStatusBadge(component.approvalStatus);
  return (
    <tr>
      <td style={tdStyle}>
        <Link href={`/component-library/${component.recordId}`}>{component.name}</Link>
      </td>
      <td style={{ ...tdStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}>
        {component.category}
      </td>
      <td style={tdStyle}>
        <StatusBadge status={approvalBadge.token} label={approvalBadge.label} />
      </td>
      <td style={{ ...tdStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}>
        v{component.versionNumber}
      </td>
      <td style={{ ...tdStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}>
        {formatTimestamp(component.updatedAt)}
      </td>
    </tr>
  );
}
