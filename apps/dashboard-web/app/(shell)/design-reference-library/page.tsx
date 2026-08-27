import Link from "next/link";
import type { DesignReferenceRecord } from "@webdesk/shared-types";
import { ContentContainer, EmptyState, PageHeader, StatusBadge } from "@webdesk/ui";
import { PageSizeSelect } from "@/components/page-size-select";
import { primaryActionLinkStyle } from "@/lib/action-link-style";
import {
  APPROVAL_STATUS_LABEL,
  APPROVAL_STATUS_VALUES,
} from "@/lib/design-reference-library-query";
import {
  buildDesignReferenceLibraryHref,
  designReferenceApprovalStatusBadge,
  designReferencePublishBadge,
  formatTimestamp,
  getDesignReferenceRecords,
  parseDesignReferenceLibrarySearchParams,
} from "@/lib/design-reference-library";
import {
  filterSelectStyle as selectStyle,
  filterSubmitButtonStyle as submitButtonStyle,
} from "@/lib/list-filter-styles";
import { listTableCellStyle, listTableHeaderCellStyle } from "@/lib/list-table-styles";
import { buildHrefBySize } from "@/lib/pagination";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface DesignReferenceLibraryListPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * No approved wireframe/screen spec exists for this module
 * (`03_Detailed_Module_Specifications.md` is a flat field list, no screen description) — renders
 * exactly what `GET /design-reference-library/records` returns and supports (an `approvalStatus`
 * filter, an `isPublished` filter, `search`, and offset pagination, no sort, no `recordType` filter
 * — unlike Brand Library, this module has no discriminator), matching every sibling list page's
 * own "smallest honest reading" precedent for an unsourced screen.
 */
export default async function DesignReferenceLibraryListPage({
  searchParams,
}: DesignReferenceLibraryListPageProps) {
  // The (shell) layout already redirects unauthenticated callers to sign-in before this page
  // renders — this defensive fallback avoids firing the list fetch in parallel with a redirect
  // that would just discard the result, matching every other page in this app.
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const query = parseDesignReferenceLibrarySearchParams(await searchParams);
  const { items: records, hasNextPage } = await getDesignReferenceRecords(query);
  const hasFilters = query.approvalStatus !== null || query.isPublished !== null;
  const isPastLastPage = records.length === 0 && query.offset > 0;

  return (
    <ContentContainer>
      <PageHeader
        title="Design Reference Library"
        contextActions={
          <Link href="/design-reference-library/new" style={primaryActionLinkStyle}>
            New record
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
              on first mount (see brand-library/page.tsx's own identical note). */}
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
            href="/design-reference-library"
            style={{ alignSelf: "flex-end", fontSize: "0.875rem", padding: "0.4rem 0" }}
          >
            Clear filters
          </Link>
        ) : null}
      </form>

      {records.length === 0 ? (
        <EmptyState
          title={
            isPastLastPage
              ? "No more design reference records"
              : hasFilters || query.search
                ? "No design reference records match your filters"
                : "No design reference records yet"
          }
          description={
            isPastLastPage
              ? "You've gone past the last page of results."
              : hasFilters || query.search
                ? "Try a different status or search term."
                : "Design reference records created for this organization will appear here."
          }
          action={
            isPastLastPage ? (
              <Link
                href={buildDesignReferenceLibraryHref(query, {
                  offset: Math.max(0, query.offset - query.pageSize),
                })}
                style={{ fontSize: "0.875rem" }}
              >
                Previous
              </Link>
            ) : hasFilters || query.search ? (
              <Link href="/design-reference-library" style={{ fontSize: "0.875rem" }}>
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
                  <th style={thStyle}>Page/section type</th>
                  <th style={thStyle}>Approval</th>
                  <th style={thStyle}>Publish status</th>
                  <th style={thStyle}>Updated</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <DesignReferenceRow key={record.id} record={record} />
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
              Showing {query.offset + 1}–{query.offset + records.length}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
              <PageSizeSelect
                value={query.pageSize}
                hrefBySize={buildHrefBySize((pageSize) =>
                  buildDesignReferenceLibraryHref(query, { pageSize }),
                )}
              />
              <div style={{ display: "flex", gap: "0.75rem" }}>
                {query.offset > 0 ? (
                  <Link
                    href={buildDesignReferenceLibraryHref(query, {
                      offset: Math.max(0, query.offset - query.pageSize),
                    })}
                  >
                    Previous
                  </Link>
                ) : null}
                {hasNextPage ? (
                  <Link
                    href={buildDesignReferenceLibraryHref(query, {
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

function DesignReferenceRow({ record }: { readonly record: DesignReferenceRecord }) {
  const approvalBadge = designReferenceApprovalStatusBadge(record.approvalStatus);
  const publishBadge = designReferencePublishBadge(record.isPublished);
  return (
    <tr>
      <td style={tdStyle}>
        <Link href={`/design-reference-library/${record.id}`}>{record.title}</Link>
      </td>
      <td style={tdStyle}>{record.pageSectionType ?? "—"}</td>
      <td style={tdStyle}>
        <StatusBadge status={approvalBadge.token} label={approvalBadge.label} />
      </td>
      <td style={tdStyle}>
        <StatusBadge status={publishBadge.token} label={publishBadge.label} />
      </td>
      <td style={{ ...tdStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}>
        {formatTimestamp(record.updatedAt)}
      </td>
    </tr>
  );
}
