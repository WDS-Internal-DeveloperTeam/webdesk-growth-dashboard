import Link from "next/link";
import type { BusinessKnowledgeRecord } from "@webdesk/shared-types";
import { ContentContainer, EmptyState, PageHeader, StatusBadge } from "@webdesk/ui";
import { PageSizeSelect } from "@/components/page-size-select";
import { primaryActionLinkStyle } from "@/lib/action-link-style";
import {
  buildBusinessKnowledgeHref,
  businessKnowledgeStatusBadge,
  formatTimestamp,
  getBusinessKnowledgeRecords,
  parseBusinessKnowledgeSearchParams,
  RECORD_TYPE_LABEL,
} from "@/lib/business-knowledge";
import { RECORD_TYPE_VALUES, STATUS_VALUES } from "@/lib/business-knowledge-query";
import { listTableCellStyle, listTableHeaderCellStyle } from "@/lib/list-table-styles";
import { buildHrefBySize } from "@/lib/pagination";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface BusinessKnowledgeListPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** No approved wireframe or spec exists for this screen (the canonical spec names 10 record types
 *  and a 5-value status vocabulary, but no field schema or screens) — renders exactly what
 *  `GET /business-knowledge/records` actually returns and supports: `recordType`/`status` filters
 *  and offset pagination, no search or sort (the backend's `list()` has neither), matching the
 *  Projects list page's own "smallest honest reading" precedent. Each row's title links to
 *  `/business-knowledge-center/:id`, the real detail page. */
export default async function BusinessKnowledgeListPage({
  searchParams,
}: BusinessKnowledgeListPageProps) {
  // The (shell) layout already redirects unauthenticated callers to sign-in before this page
  // renders — this defensive fallback avoids firing getBusinessKnowledgeRecords() in parallel with
  // a redirect that would just discard the result, matching every other page in this app.
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const query = parseBusinessKnowledgeSearchParams(await searchParams);
  const { items: records, hasNextPage } = await getBusinessKnowledgeRecords(query);
  const hasFilters = query.recordType !== null || query.status !== null;
  const isPastLastPage = records.length === 0 && query.offset > 0;

  return (
    <ContentContainer>
      <PageHeader
        title="Business Knowledge Center"
        contextActions={
          <Link href="/business-knowledge-center/new" style={primaryActionLinkStyle}>
            New record
          </Link>
        }
      />

      <form
        method="get"
        style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1.5rem" }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <span
            style={{
              fontSize: "0.75rem",
              color: "var(--webdesk-dashboard-color-foreground-muted)",
            }}
          >
            Record type
          </span>
          {/* `key` forces React to remount this select whenever the underlying filter value
              changes, including back to "" on Clear filters. Without it, a Next.js `<Link>`
              soft-navigation re-renders this same DOM node in place, and an uncontrolled
              `<select>`'s `defaultValue` is only honored on the node's *first* mount — the
              browser keeps showing whatever the reader last picked even after the URL (and every
              other prop) has reset. */}
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
            Status
          </span>
          <select
            key={query.status ?? "all-statuses"}
            name="status"
            defaultValue={query.status ?? ""}
            style={selectStyle}
          >
            <option value="">All statuses</option>
            {STATUS_VALUES.map((value) => (
              <option key={value} value={value}>
                {businessKnowledgeStatusBadge(value).label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" style={submitButtonStyle}>
          Apply
        </button>
        {hasFilters ? (
          <Link
            href="/business-knowledge-center"
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
              : hasFilters
                ? "No records match your filters"
                : "No records yet"
          }
          description={
            isPastLastPage
              ? "You've gone past the last page of results."
              : hasFilters
                ? "Try a different record type or status."
                : "Business knowledge records created for this organization will appear here."
          }
          action={
            isPastLastPage ? (
              <Link
                href={buildBusinessKnowledgeHref(query, {
                  offset: Math.max(0, query.offset - query.pageSize),
                })}
                style={{ fontSize: "0.875rem" }}
              >
                Previous
              </Link>
            ) : hasFilters ? (
              <Link href="/business-knowledge-center" style={{ fontSize: "0.875rem" }}>
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
                  <th style={thStyle}>Record type</th>
                  <th style={thStyle}>Status</th>
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
                  buildBusinessKnowledgeHref(query, { pageSize }),
                )}
              />
              <div style={{ display: "flex", gap: "0.75rem" }}>
                {query.offset > 0 ? (
                  <Link
                    href={buildBusinessKnowledgeHref(query, {
                      offset: Math.max(0, query.offset - query.pageSize),
                    })}
                  >
                    Previous
                  </Link>
                ) : null}
                {hasNextPage ? (
                  <Link
                    href={buildBusinessKnowledgeHref(query, {
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

const selectStyle: React.CSSProperties = {
  padding: "0.4rem 0.6rem",
  border: "1px solid var(--webdesk-dashboard-color-border)",
  borderRadius: "0.25rem",
  fontSize: "0.875rem",
  minWidth: "12rem",
};

const submitButtonStyle: React.CSSProperties = {
  alignSelf: "flex-end",
  padding: "0.4rem 0.9rem",
  border: "1px solid var(--webdesk-dashboard-color-border)",
  borderRadius: "0.25rem",
  background: "var(--webdesk-dashboard-color-surface)",
  fontSize: "0.875rem",
  cursor: "pointer",
};

const thStyle = listTableHeaderCellStyle;

const tdStyle = listTableCellStyle;

function RecordRow({ record }: { readonly record: BusinessKnowledgeRecord }) {
  const badge = businessKnowledgeStatusBadge(record.status);
  return (
    <tr>
      <td style={tdStyle}>
        <Link href={`/business-knowledge-center/${record.id}`}>{record.title}</Link>
      </td>
      <td style={{ ...tdStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}>
        {RECORD_TYPE_LABEL[record.recordType]}
      </td>
      <td style={tdStyle}>
        <StatusBadge status={badge.token} label={badge.label} />
      </td>
      <td style={{ ...tdStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}>
        {formatTimestamp(record.updatedAt)}
      </td>
    </tr>
  );
}
