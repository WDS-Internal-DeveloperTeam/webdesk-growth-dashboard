import Link from "next/link";
import { ContentContainer, EmptyState, PageHeader } from "@webdesk/ui";
import { PageSizeSelect } from "@/components/page-size-select";
import { primaryActionLinkStyle } from "@/lib/action-link-style";
import {
  buildCaseStudyLibraryHref,
  formatTimestamp,
  getCaseStudyLibraryRecords,
  parseCaseStudyLibrarySearchParams,
} from "@/lib/case-study-library";
import {
  filterSelectStyle as selectStyle,
  filterSubmitButtonStyle as submitButtonStyle,
} from "@/lib/list-filter-styles";
import { listTableCellStyle, listTableHeaderCellStyle } from "@/lib/list-table-styles";
import { buildHrefBySize } from "@/lib/pagination";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface CaseStudyLibraryListPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * No approved wireframe/screen spec exists for this module —
 * `packages/database/src/case-study-library/entities.ts`'s own field list is the only source;
 * renders exactly what `GET /case-study-library/records` returns and supports (`search` and
 * offset pagination — no status filter, since the record has no lifecycle of its own, D1),
 * matching every sibling module's own "smallest honest reading" precedent for an unsourced screen.
 * Each row nests its parent case study's `clientName`/`projectTitle`/`status` (D1) rather than
 * duplicating those on this module's own record.
 */
export default async function CaseStudyLibraryListPage({
  searchParams,
}: CaseStudyLibraryListPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const query = parseCaseStudyLibrarySearchParams(await searchParams);
  const { items: records, hasNextPage } = await getCaseStudyLibraryRecords(query);
  const hasFilters = query.search !== null;
  const isPastLastPage = records.length === 0 && query.offset > 0;

  return (
    <ContentContainer>
      <PageHeader
        title="Case Study Library"
        contextActions={
          <Link href="/case-study-library/new" style={primaryActionLinkStyle}>
            New library record
          </Link>
        }
      />

      <form
        method="get"
        style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1.5rem" }}
      >
        <input type="hidden" name="pageSize" value={query.pageSize} />
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
            key={query.search ?? ""}
            type="text"
            name="search"
            defaultValue={query.search ?? ""}
            placeholder="Public ID…"
            maxLength={255}
            style={selectStyle}
          />
        </label>
        <button type="submit" style={submitButtonStyle}>
          Apply filters
        </button>
        {hasFilters ? (
          <Link
            href="/case-study-library"
            style={{
              alignSelf: "flex-end",
              fontSize: "0.875rem",
              color: "var(--webdesk-dashboard-color-foreground-muted)",
            }}
          >
            Clear filters
          </Link>
        ) : null}
      </form>

      {records.length === 0 ? (
        <EmptyState
          title={isPastLastPage ? "No more records" : "No library records yet"}
          description={
            isPastLastPage
              ? "There are no records past this page — go back to see earlier results."
              : hasFilters
                ? "No library records match the current filters."
                : "Extend a published, unpublished, or archived case study to get started."
          }
        />
      ) : (
        <>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={listTableHeaderCellStyle}>Public ID</th>
                <th style={listTableHeaderCellStyle}>Case study</th>
                <th style={listTableHeaderCellStyle}>Status</th>
                <th style={listTableHeaderCellStyle}>Technologies</th>
                <th style={listTableHeaderCellStyle}>Updated</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td style={listTableCellStyle}>
                    <Link href={`/case-study-library/${record.id}`}>{record.publicId}</Link>
                  </td>
                  <td style={listTableCellStyle}>
                    {record.caseStudy
                      ? `${record.caseStudy.clientName} — ${record.caseStudy.projectTitle}`
                      : record.caseStudyId}
                  </td>
                  <td style={listTableCellStyle}>{record.caseStudy?.status ?? "—"}</td>
                  <td style={listTableCellStyle}>
                    {record.technologies.length > 0 ? record.technologies.join(", ") : "—"}
                  </td>
                  <td style={listTableCellStyle}>{formatTimestamp(record.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: "1rem",
            }}
          >
            <PageSizeSelect
              value={query.pageSize}
              hrefBySize={buildHrefBySize((pageSize) =>
                buildCaseStudyLibraryHref(query, { pageSize }),
              )}
            />
            <div style={{ display: "flex", gap: "0.75rem" }}>
              {query.offset > 0 ? (
                <Link
                  href={buildCaseStudyLibraryHref(query, {
                    offset: Math.max(0, query.offset - query.pageSize),
                  })}
                >
                  Previous
                </Link>
              ) : null}
              {hasNextPage ? (
                <Link
                  href={buildCaseStudyLibraryHref(query, { offset: query.offset + query.pageSize })}
                >
                  Next
                </Link>
              ) : null}
            </div>
          </div>
        </>
      )}
    </ContentContainer>
  );
}
