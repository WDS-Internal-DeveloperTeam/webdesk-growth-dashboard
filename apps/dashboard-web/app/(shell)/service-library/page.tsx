import Link from "next/link";
import type { Service } from "@webdesk/shared-types";
import { ContentContainer, EmptyState, PageHeader, StatusBadge } from "@webdesk/ui";
import { PageSizeSelect } from "@/components/page-size-select";
import { primaryActionLinkStyle } from "@/lib/action-link-style";
import { listTableCellStyle, listTableHeaderCellStyle } from "@/lib/list-table-styles";
import { buildHrefBySize } from "@/lib/pagination";
import { getServerSession } from "@/lib/server-session";
import {
  buildServiceLibraryHref,
  formatTimestamp,
  getServiceCategories,
  getServices,
  parseServiceLibrarySearchParams,
  serviceApprovalStatusBadge,
  servicePublicationStatusBadge,
} from "@/lib/service-library";
import {
  APPROVAL_STATUS_LABEL,
  APPROVAL_STATUS_VALUES,
  PUBLICATION_STATUS_LABEL,
  PUBLICATION_STATUS_VALUES,
} from "@/lib/service-library-query";

export const dynamic = "force-dynamic";

interface ServiceLibraryListPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Approved design brief: `docs/design/dashboard-ui/15-representative-screen-specifications.md`
 *  §4 — "List screen: standard table (name, category, publication status, approval status, last
 *  updated)". Renders exactly what `GET /service-library/services` returns and supports —
 *  `categoryId`/`approvalStatus`/`publicationStatus`/`search` filters and offset pagination, no
 *  sort (the backend's `list()` has none), matching the Projects/BKC list pages' own "smallest
 *  honest reading" precedent for anything the spec doesn't pin down at the field/query level. */
export default async function ServiceLibraryListPage({
  searchParams,
}: ServiceLibraryListPageProps) {
  // The (shell) layout already redirects unauthenticated callers to sign-in before this page
  // renders — this defensive fallback avoids firing the list fetch in parallel with a redirect
  // that would just discard the result, matching every other page in this app.
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const query = parseServiceLibrarySearchParams(await searchParams);
  const [{ items: services, hasNextPage }, categories] = await Promise.all([
    getServices(query),
    getServiceCategories(),
  ]);
  const categoryNameById = new Map(categories.map((category) => [category.id, category.name]));
  const hasFilters =
    query.categoryId !== null || query.approvalStatus !== null || query.publicationStatus !== null;
  const isPastLastPage = services.length === 0 && query.offset > 0;

  return (
    <ContentContainer>
      <PageHeader
        title="Service Library"
        contextActions={
          <Link href="/service-library/new" style={primaryActionLinkStyle}>
            New service
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
              on first mount (see business-knowledge-center/page.tsx's own identical note). */}
          <select
            key={query.categoryId ?? "all-categories"}
            name="categoryId"
            defaultValue={query.categoryId ?? ""}
            style={selectStyle}
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
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
            Publication status
          </span>
          <select
            key={query.publicationStatus ?? "all-publication-statuses"}
            name="publicationStatus"
            defaultValue={query.publicationStatus ?? ""}
            style={selectStyle}
          >
            <option value="">All publication statuses</option>
            {PUBLICATION_STATUS_VALUES.map((value) => (
              <option key={value} value={value}>
                {PUBLICATION_STATUS_LABEL[value]}
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
            href="/service-library"
            style={{ alignSelf: "flex-end", fontSize: "0.875rem", padding: "0.4rem 0" }}
          >
            Clear filters
          </Link>
        ) : null}
      </form>

      {services.length === 0 ? (
        <EmptyState
          title={
            isPastLastPage
              ? "No more services"
              : hasFilters || query.search
                ? "No services match your filters"
                : "No services yet"
          }
          description={
            isPastLastPage
              ? "You've gone past the last page of results."
              : hasFilters || query.search
                ? "Try a different category, status, or search term."
                : "Services created for this organization will appear here."
          }
          action={
            isPastLastPage ? (
              <Link
                href={buildServiceLibraryHref(query, {
                  offset: Math.max(0, query.offset - query.pageSize),
                })}
                style={{ fontSize: "0.875rem" }}
              >
                Previous
              </Link>
            ) : hasFilters || query.search ? (
              <Link href="/service-library" style={{ fontSize: "0.875rem" }}>
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
                  <th style={thStyle}>Publication</th>
                  <th style={thStyle}>Approval</th>
                  <th style={thStyle}>Updated</th>
                </tr>
              </thead>
              <tbody>
                {services.map((service) => (
                  <ServiceRow
                    key={service.id}
                    service={service}
                    categoryName={categoryNameById.get(service.categoryId) ?? "—"}
                  />
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
              Showing {query.offset + 1}–{query.offset + services.length}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
              <PageSizeSelect
                value={query.pageSize}
                hrefBySize={buildHrefBySize((pageSize) =>
                  buildServiceLibraryHref(query, { pageSize }),
                )}
              />
              <div style={{ display: "flex", gap: "0.75rem" }}>
                {query.offset > 0 ? (
                  <Link
                    href={buildServiceLibraryHref(query, {
                      offset: Math.max(0, query.offset - query.pageSize),
                    })}
                  >
                    Previous
                  </Link>
                ) : null}
                {hasNextPage ? (
                  <Link
                    href={buildServiceLibraryHref(query, { offset: query.offset + query.pageSize })}
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

function ServiceRow({
  service,
  categoryName,
}: {
  readonly service: Service;
  readonly categoryName: string;
}) {
  const approvalBadge = serviceApprovalStatusBadge(service.approvalStatus);
  const publicationBadge = servicePublicationStatusBadge(service.publicationStatus);
  return (
    <tr>
      <td style={tdStyle}>
        <Link href={`/service-library/${service.id}`}>{service.canonicalName}</Link>
      </td>
      <td style={{ ...tdStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}>
        {categoryName}
      </td>
      <td style={tdStyle}>
        <StatusBadge status={publicationBadge.token} label={publicationBadge.label} />
      </td>
      <td style={tdStyle}>
        <StatusBadge status={approvalBadge.token} label={approvalBadge.label} />
      </td>
      <td style={{ ...tdStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}>
        {formatTimestamp(service.updatedAt)}
      </td>
    </tr>
  );
}
