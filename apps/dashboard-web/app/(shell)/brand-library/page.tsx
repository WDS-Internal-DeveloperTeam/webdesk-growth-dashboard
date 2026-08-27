import Link from "next/link";
import type { BrandLibraryRecord } from "@webdesk/shared-types";
import { ContentContainer, EmptyState, PageHeader, StatusBadge } from "@webdesk/ui";
import { PageSizeSelect } from "@/components/page-size-select";
import { primaryActionLinkStyle } from "@/lib/action-link-style";
import {
  APPROVAL_STATUS_LABEL,
  APPROVAL_STATUS_VALUES,
  RECORD_TYPE_LABEL,
  RECORD_TYPE_VALUES,
} from "@/lib/brand-library-query";
import {
  brandLibraryApprovalStatusBadge,
  brandLibraryPublishBadge,
  buildBrandLibraryHref,
  formatTimestamp,
  getBrandLibraryRecords,
  parseBrandLibrarySearchParams,
} from "@/lib/brand-library";
import {
  filterSelectStyle as selectStyle,
  filterSubmitButtonStyle as submitButtonStyle,
} from "@/lib/list-filter-styles";
import { listTableCellStyle, listTableHeaderCellStyle } from "@/lib/list-table-styles";
import { buildHrefBySize } from "@/lib/pagination";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface BrandLibraryListPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * No approved wireframe/screen spec exists for this module (`03_Detailed_Module_Specifications.md
 * §10` is a flat field list, no screen description) — renders exactly what
 * `GET /brand-library/records` returns and supports (a `recordType` filter, an `approvalStatus`
 * filter, an `isPublished` filter, `search`, and offset pagination, no sort), matching the Content
 * Template/Persona/Service Library list pages' own "smallest honest reading" precedent for an
 * unsourced screen.
 */
export default async function BrandLibraryListPage({ searchParams }: BrandLibraryListPageProps) {
  // The (shell) layout already redirects unauthenticated callers to sign-in before this page
  // renders — this defensive fallback avoids firing the list fetch in parallel with a redirect
  // that would just discard the result, matching every other page in this app.
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const query = parseBrandLibrarySearchParams(await searchParams);
  const { items: records, hasNextPage } = await getBrandLibraryRecords(query);
  const hasFilters =
    query.recordType !== null || query.approvalStatus !== null || query.isPublished !== null;
  const isPastLastPage = records.length === 0 && query.offset > 0;

  return (
    <ContentContainer>
      <PageHeader
        title="Brand Library"
        contextActions={
          <Link href="/brand-library/new" style={primaryActionLinkStyle}>
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
            Record type
          </span>
          {/* `key` forces a remount whenever the underlying filter value changes, including back
              to "" on Clear filters — a Next.js <Link> soft-navigation otherwise re-renders this
              same DOM node in place, and an uncontrolled <select>'s defaultValue only takes effect
              on first mount (see content-template-library/page.tsx's own identical note). */}
          <select
            key={query.recordType ?? "all-record-types"}
            name="recordType"
            defaultValue={query.recordType ?? ""}
            style={selectStyle}
          >
            <option value="">All record types</option>
            {RECORD_TYPE_VALUES.map((value) => (
              <option key={value} value={value}>
                {RECORD_TYPE_LABEL[value]}
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
            Approval status
          </span>
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
            href="/brand-library"
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
              ? "No more brand library records"
              : hasFilters || query.search
                ? "No brand library records match your filters"
                : "No brand library records yet"
          }
          description={
            isPastLastPage
              ? "You've gone past the last page of results."
              : hasFilters || query.search
                ? "Try a different type, status, or search term."
                : "Brand library records created for this organization will appear here."
          }
          action={
            isPastLastPage ? (
              <Link
                href={buildBrandLibraryHref(query, {
                  offset: Math.max(0, query.offset - query.pageSize),
                })}
                style={{ fontSize: "0.875rem" }}
              >
                Previous
              </Link>
            ) : hasFilters || query.search ? (
              <Link href="/brand-library" style={{ fontSize: "0.875rem" }}>
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
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Approval</th>
                  <th style={thStyle}>Publish status</th>
                  <th style={thStyle}>Updated</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <BrandLibraryRow key={record.id} record={record} />
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
                  buildBrandLibraryHref(query, { pageSize }),
                )}
              />
              <div style={{ display: "flex", gap: "0.75rem" }}>
                {query.offset > 0 ? (
                  <Link
                    href={buildBrandLibraryHref(query, {
                      offset: Math.max(0, query.offset - query.pageSize),
                    })}
                  >
                    Previous
                  </Link>
                ) : null}
                {hasNextPage ? (
                  <Link
                    href={buildBrandLibraryHref(query, {
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

function BrandLibraryRow({ record }: { readonly record: BrandLibraryRecord }) {
  const approvalBadge = brandLibraryApprovalStatusBadge(record.approvalStatus);
  const publishBadge = brandLibraryPublishBadge(record.isPublished);
  return (
    <tr>
      <td style={tdStyle}>
        <Link href={`/brand-library/${record.id}`}>{record.title}</Link>
      </td>
      <td style={tdStyle}>{RECORD_TYPE_LABEL[record.recordType]}</td>
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
