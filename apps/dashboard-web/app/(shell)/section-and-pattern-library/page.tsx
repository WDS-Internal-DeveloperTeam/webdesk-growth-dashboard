import Link from "next/link";
import type { SectionPatternRecord } from "@webdesk/shared-types";
import { ContentContainer, EmptyState, PageHeader, StatusBadge } from "@webdesk/ui";
import { PageSizeSelect } from "@/components/page-size-select";
import { primaryActionLinkStyle } from "@/lib/action-link-style";
import { ARTIFACT_APPROVAL_STATUS_VALUES } from "@/lib/artifact-approval-status";
import {
  filterSelectStyle as selectStyle,
  filterSubmitButtonStyle as submitButtonStyle,
} from "@/lib/list-filter-styles";
import { listTableCellStyle, listTableHeaderCellStyle } from "@/lib/list-table-styles";
import { buildHrefBySize } from "@/lib/pagination";
import {
  APPROVAL_STATUS_LABEL,
  buildSectionAndPatternLibraryHref,
  formatTimestamp,
  getSectionPatterns,
  PATTERN_TYPE_LABEL,
  PATTERN_TYPE_VALUES,
  parseSectionAndPatternLibrarySearchParams,
  sectionPatternApprovalStatusBadge,
} from "@/lib/section-and-pattern-library";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface SectionAndPatternLibraryListPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * No approved wireframe/screen spec exists for this module — renders exactly what
 * `GET /section-and-pattern-library/records` returns and supports (CURRENT versions only, a
 * `patternType` filter, an `approvalStatus` filter, `search`, and offset pagination, no sort),
 * matching every sibling module's own "smallest honest reading" precedent for an unsourced screen.
 */
export default async function SectionAndPatternLibraryListPage({
  searchParams,
}: SectionAndPatternLibraryListPageProps) {
  // The (shell) layout already redirects unauthenticated callers to sign-in before this page
  // renders — this defensive fallback avoids firing the list fetch in parallel with a redirect
  // that would just discard the result, matching every other page in this app.
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const query = parseSectionAndPatternLibrarySearchParams(await searchParams);
  const { items: records, hasNextPage } = await getSectionPatterns(query);
  const hasFilters = query.patternType !== null || query.approvalStatus !== null;
  const isPastLastPage = records.length === 0 && query.offset > 0;

  return (
    <ContentContainer>
      <PageHeader
        title="Section and Pattern Library"
        contextActions={
          <Link href="/section-and-pattern-library/new" style={primaryActionLinkStyle}>
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
            Pattern type
          </span>
          {/* `key` forces a remount whenever the underlying filter value changes, including back
              to "" on Clear filters — a Next.js <Link> soft-navigation otherwise re-renders this
              same DOM node in place, and an uncontrolled <select>'s defaultValue only takes effect
              on first mount (see design-token-library/page.tsx's own identical note). */}
          <select
            key={query.patternType ?? "all-pattern-types"}
            name="patternType"
            defaultValue={query.patternType ?? ""}
            style={selectStyle}
          >
            <option value="">All pattern types</option>
            {PATTERN_TYPE_VALUES.map((value) => (
              <option key={value} value={value}>
                {PATTERN_TYPE_LABEL[value]}
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
            href="/section-and-pattern-library"
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
              ? "No more records"
              : hasFilters || query.search
                ? "No records match your filters"
                : "No section/pattern records yet"
          }
          description={
            isPastLastPage
              ? "You've gone past the last page of results."
              : hasFilters || query.search
                ? "Try a different pattern type, status, or search term."
                : "Records created for this organization will appear here."
          }
          action={
            isPastLastPage ? (
              <Link
                href={buildSectionAndPatternLibraryHref(query, {
                  offset: Math.max(0, query.offset - query.pageSize),
                })}
                style={{ fontSize: "0.875rem" }}
              >
                Previous
              </Link>
            ) : hasFilters || query.search ? (
              <Link href="/section-and-pattern-library" style={{ fontSize: "0.875rem" }}>
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
                  <th style={thStyle}>Pattern type</th>
                  <th style={thStyle}>Approval</th>
                  <th style={thStyle}>Version</th>
                  <th style={thStyle}>Updated</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <RecordRow key={record.id} record={record} />
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
                  buildSectionAndPatternLibraryHref(query, { pageSize }),
                )}
              />
              <div style={{ display: "flex", gap: "0.75rem" }}>
                {query.offset > 0 ? (
                  <Link
                    href={buildSectionAndPatternLibraryHref(query, {
                      offset: Math.max(0, query.offset - query.pageSize),
                    })}
                  >
                    Previous
                  </Link>
                ) : null}
                {hasNextPage ? (
                  <Link
                    href={buildSectionAndPatternLibraryHref(query, {
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

function RecordRow({ record }: { readonly record: SectionPatternRecord }) {
  const approvalBadge = sectionPatternApprovalStatusBadge(record.approvalStatus);
  return (
    <tr>
      <td style={tdStyle}>
        <Link href={`/section-and-pattern-library/${record.recordId}`}>{record.name}</Link>
      </td>
      <td style={{ ...tdStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}>
        {PATTERN_TYPE_LABEL[record.patternType]}
      </td>
      <td style={tdStyle}>
        <StatusBadge status={approvalBadge.token} label={approvalBadge.label} />
      </td>
      <td style={{ ...tdStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}>
        v{record.versionNumber}
      </td>
      <td style={{ ...tdStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}>
        {formatTimestamp(record.updatedAt)}
      </td>
    </tr>
  );
}
