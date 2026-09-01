import Link from "next/link";
import type { KnowledgeLibraryRecord } from "@webdesk/shared-types";
import { ContentContainer, EmptyState, PageHeader, StatusBadge } from "@webdesk/ui";
import { PageSizeSelect } from "@/components/page-size-select";
import { primaryActionLinkStyle } from "@/lib/action-link-style";
import { CONFIDENTIALITY_VALUES, STATUS_VALUES } from "@/lib/knowledge-library-query";
import {
  filterSelectStyle as selectStyle,
  filterSubmitButtonStyle as submitButtonStyle,
} from "@/lib/list-filter-styles";
import {
  buildKnowledgeLibraryHref,
  CONFIDENTIALITY_LABEL,
  formatTimestamp,
  getKnowledgeLibraryRecords,
  knowledgeLibraryConfidentialityBadge,
  knowledgeLibraryStatusBadge,
  parseKnowledgeLibrarySearchParams,
  STATUS_LABEL,
} from "@/lib/knowledge-library";
import { listTableCellStyle, listTableHeaderCellStyle } from "@/lib/list-table-styles";
import { buildHrefBySize } from "@/lib/pagination";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface KnowledgeLibraryListPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * No approved wireframe/screen spec exists for this module (`03_Detailed_Module_Specifications.md
 * §28` is a flat field list, no screen description) — renders exactly what
 * `GET /knowledge-library/records` returns and supports (a `status`/`confidentiality` filter,
 * `search`, and offset pagination, no sort), matching the Persona/Business Knowledge Center list
 * pages' own "smallest honest reading" precedent for an unsourced screen. A `restricted` record's
 * `sourceType`/`location`/`notes` may be redacted for the current viewer — this list only ever
 * renders `title`, `status`, `confidentiality`, and `updatedAt`, none of which are ever redacted,
 * so no per-row redaction handling is needed here.
 */
export default async function KnowledgeLibraryListPage({
  searchParams,
}: KnowledgeLibraryListPageProps) {
  // The (shell) layout already redirects unauthenticated callers to sign-in before this page
  // renders — this defensive fallback avoids firing the list fetch in parallel with a redirect
  // that would just discard the result, matching every other page in this app.
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const query = parseKnowledgeLibrarySearchParams(await searchParams);
  const { items: records, hasNextPage } = await getKnowledgeLibraryRecords(query);
  const hasFilters = query.status !== null || query.confidentiality !== null;
  const isPastLastPage = records.length === 0 && query.offset > 0;

  return (
    <ContentContainer>
      <PageHeader
        title="Knowledge Library"
        contextActions={
          <Link href="/knowledge-library/new" style={primaryActionLinkStyle}>
            New record
          </Link>
        }
      />

      <form
        method="get"
        style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1.5rem" }}
      >
        {/* Preserves the reader's page-size choice across a filter submit — same precedent as
            every sibling list page's own hidden pageSize field. */}
        <input type="hidden" name="pageSize" value={query.pageSize} />
        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <span
            style={{
              fontSize: "0.75rem",
              color: "var(--webdesk-dashboard-color-foreground-muted)",
            }}
          >
            Status
          </span>
          {/* `key` forces a remount whenever the underlying filter value changes, including back
              to "" on Clear filters — a Next.js <Link> soft-navigation otherwise re-renders this
              same DOM node in place, and an uncontrolled <select>'s defaultValue only takes effect
              on first mount (see business-knowledge-center/page.tsx's own identical note). */}
          <select
            key={query.status ?? "all-statuses"}
            name="status"
            defaultValue={query.status ?? ""}
            style={selectStyle}
          >
            <option value="">All statuses</option>
            {STATUS_VALUES.map((value) => (
              <option key={value} value={value}>
                {STATUS_LABEL[value]}
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
            Confidentiality
          </span>
          <select
            key={query.confidentiality ?? "all-confidentiality"}
            name="confidentiality"
            defaultValue={query.confidentiality ?? ""}
            style={selectStyle}
          >
            <option value="">All confidentiality levels</option>
            {CONFIDENTIALITY_VALUES.map((value) => (
              <option key={value} value={value}>
                {CONFIDENTIALITY_LABEL[value]}
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
            href="/knowledge-library"
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
                : "No knowledge library records yet"
          }
          description={
            isPastLastPage
              ? "You've gone past the last page of results."
              : hasFilters || query.search
                ? "Try a different status, confidentiality level, or search term."
                : "Reference sources created for this organization will appear here."
          }
          action={
            isPastLastPage ? (
              <Link
                href={buildKnowledgeLibraryHref(query, {
                  offset: Math.max(0, query.offset - query.pageSize),
                })}
                style={{ fontSize: "0.875rem" }}
              >
                Previous
              </Link>
            ) : hasFilters || query.search ? (
              <Link href="/knowledge-library" style={{ fontSize: "0.875rem" }}>
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
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Confidentiality</th>
                  <th style={thStyle}>Updated</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <KnowledgeLibraryRow key={record.id} record={record} />
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
                  buildKnowledgeLibraryHref(query, { pageSize }),
                )}
              />
              <div style={{ display: "flex", gap: "0.75rem" }}>
                {query.offset > 0 ? (
                  <Link
                    href={buildKnowledgeLibraryHref(query, {
                      offset: Math.max(0, query.offset - query.pageSize),
                    })}
                  >
                    Previous
                  </Link>
                ) : null}
                {hasNextPage ? (
                  <Link
                    href={buildKnowledgeLibraryHref(query, {
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

function KnowledgeLibraryRow({ record }: { readonly record: KnowledgeLibraryRecord }) {
  const statusBadge = knowledgeLibraryStatusBadge(record.status);
  const confidentialityBadge = knowledgeLibraryConfidentialityBadge(record.confidentiality);
  return (
    <tr>
      <td style={tdStyle}>
        <Link href={`/knowledge-library/${record.id}`}>{record.title}</Link>
      </td>
      <td style={tdStyle}>
        <StatusBadge status={statusBadge.token} label={statusBadge.label} />
      </td>
      <td style={tdStyle}>
        <StatusBadge status={confidentialityBadge.token} label={confidentialityBadge.label} />
      </td>
      <td style={{ ...tdStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}>
        {formatTimestamp(record.updatedAt)}
      </td>
    </tr>
  );
}
