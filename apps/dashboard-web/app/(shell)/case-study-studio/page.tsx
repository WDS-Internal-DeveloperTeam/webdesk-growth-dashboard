import Link from "next/link";
import type { CaseStudy } from "@webdesk/shared-types";
import { ContentContainer, EmptyState, PageHeader, StatusBadge } from "@webdesk/ui";
import { PageSizeSelect } from "@/components/page-size-select";
import { primaryActionLinkStyle } from "@/lib/action-link-style";
import { STATUS_LABEL, STATUS_VALUES } from "@/lib/case-study-studio-query";
import {
  buildCaseStudyStudioHref,
  caseStudyStatusBadge,
  formatTimestamp,
  getCaseStudies,
  parseCaseStudyStudioSearchParams,
} from "@/lib/case-study-studio";
import {
  filterSelectStyle as selectStyle,
  filterSubmitButtonStyle as submitButtonStyle,
} from "@/lib/list-filter-styles";
import { listTableCellStyle, listTableHeaderCellStyle } from "@/lib/list-table-styles";
import { buildHrefBySize } from "@/lib/pagination";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface CaseStudyStudioListPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * No approved wireframe/screen spec exists for this module —
 * `docs/implementation/module-case-study-studio.md`'s own D5 field grouping is the only source;
 * renders exactly what `GET /case-study-studio/case-studies` returns and supports (a `status`
 * filter, `search`, and offset pagination, no sort), matching every sibling module's own "smallest
 * honest reading" precedent for an unsourced screen.
 */
export default async function CaseStudyStudioListPage({
  searchParams,
}: CaseStudyStudioListPageProps) {
  // The (shell) layout already redirects unauthenticated callers to sign-in before this page
  // renders — this defensive fallback avoids firing the list fetch in parallel with a redirect
  // that would just discard the result, matching every other page in this app.
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const query = parseCaseStudyStudioSearchParams(await searchParams);
  const { items: caseStudies, hasNextPage } = await getCaseStudies(query);
  const hasFilters = query.status !== null;
  const isPastLastPage = caseStudies.length === 0 && query.offset > 0;

  return (
    <ContentContainer>
      <PageHeader
        title="Case Study Studio"
        contextActions={
          <Link href="/case-study-studio/new" style={primaryActionLinkStyle}>
            New case study
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
            Status
          </span>
          {/* `key` forces a remount whenever the underlying filter value changes, including back
              to "" on Clear filters — a Next.js <Link> soft-navigation otherwise re-renders this
              same DOM node in place, and an uncontrolled <select>'s defaultValue only takes effect
              on first mount (see persona-library/page.tsx's own identical note). */}
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
            href="/case-study-studio"
            style={{ alignSelf: "flex-end", fontSize: "0.875rem", padding: "0.4rem 0" }}
          >
            Clear filters
          </Link>
        ) : null}
      </form>

      {caseStudies.length === 0 ? (
        <EmptyState
          title={
            isPastLastPage
              ? "No more case studies"
              : hasFilters || query.search
                ? "No case studies match your filters"
                : "No case studies yet"
          }
          description={
            isPastLastPage
              ? "You've gone past the last page of results."
              : hasFilters || query.search
                ? "Try a different status or search term."
                : "Case studies created for this organization will appear here."
          }
          action={
            isPastLastPage ? (
              <Link
                href={buildCaseStudyStudioHref(query, {
                  offset: Math.max(0, query.offset - query.pageSize),
                })}
                style={{ fontSize: "0.875rem" }}
              >
                Previous
              </Link>
            ) : hasFilters || query.search ? (
              <Link href="/case-study-studio" style={{ fontSize: "0.875rem" }}>
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
                  <th style={thStyle}>Public ID</th>
                  <th style={thStyle}>Client</th>
                  <th style={thStyle}>Project title</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Updated</th>
                </tr>
              </thead>
              <tbody>
                {caseStudies.map((caseStudy) => (
                  <CaseStudyRow key={caseStudy.id} caseStudy={caseStudy} />
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
              Showing {query.offset + 1}–{query.offset + caseStudies.length}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
              <PageSizeSelect
                value={query.pageSize}
                hrefBySize={buildHrefBySize((pageSize) =>
                  buildCaseStudyStudioHref(query, { pageSize }),
                )}
              />
              <div style={{ display: "flex", gap: "0.75rem" }}>
                {query.offset > 0 ? (
                  <Link
                    href={buildCaseStudyStudioHref(query, {
                      offset: Math.max(0, query.offset - query.pageSize),
                    })}
                  >
                    Previous
                  </Link>
                ) : null}
                {hasNextPage ? (
                  <Link
                    href={buildCaseStudyStudioHref(query, {
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

function CaseStudyRow({ caseStudy }: { readonly caseStudy: CaseStudy }) {
  const badge = caseStudyStatusBadge(caseStudy.status);
  return (
    <tr>
      <td style={tdStyle}>
        <Link href={`/case-study-studio/${caseStudy.id}`}>{caseStudy.publicId}</Link>
      </td>
      <td style={tdStyle}>{caseStudy.clientName}</td>
      <td style={tdStyle}>{caseStudy.projectTitle}</td>
      <td style={tdStyle}>
        <StatusBadge status={badge.token} label={badge.label} />
      </td>
      <td style={{ ...tdStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}>
        {formatTimestamp(caseStudy.updatedAt)}
      </td>
    </tr>
  );
}
