import Link from "next/link";
import type { Integration } from "@webdesk/shared-types";
import { ContentContainer, EmptyState, PageHeader, StatusBadge } from "@webdesk/ui";
import { PageSizeSelect } from "@/components/page-size-select";
import { primaryActionLinkStyle } from "@/lib/action-link-style";
import {
  buildIntegrationsHref,
  formatTimestamp,
  getIntegrations,
  integrationActiveBadge,
  integrationStatusBadge,
  parseIntegrationsSearchParams,
  PROVIDER_LABEL,
  STATUS_LABEL,
} from "@/lib/integrations";
import { PROVIDER_VALUES, STATUS_VALUES } from "@/lib/integrations-query";
import {
  filterSelectStyle as selectStyle,
  filterSubmitButtonStyle as submitButtonStyle,
} from "@/lib/list-filter-styles";
import { listTableCellStyle, listTableHeaderCellStyle } from "@/lib/list-table-styles";
import { buildHrefBySize } from "@/lib/pagination";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface IntegrationsListPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * No approved wireframe/screen spec exists for this module (`03_Detailed_Module_Specifications.md
 * §41` is a one-line description) — renders exactly what `GET /integrations` returns and supports
 * (a `provider` filter, a `status` filter, an `isActive` filter, `search`, and offset pagination,
 * no sort), matching Brand Library's own list page's "smallest honest reading" precedent for an
 * unsourced screen.
 */
export default async function IntegrationsListPage({ searchParams }: IntegrationsListPageProps) {
  // The (shell) layout already redirects unauthenticated callers to sign-in before this page
  // renders — this defensive fallback avoids firing the list fetch in parallel with a redirect
  // that would just discard the result, matching every other page in this app.
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const query = parseIntegrationsSearchParams(await searchParams);
  const { items: integrations, hasNextPage } = await getIntegrations(query);
  const hasFilters = query.provider !== null || query.status !== null || query.isActive !== null;
  const isPastLastPage = integrations.length === 0 && query.offset > 0;

  return (
    <ContentContainer>
      <PageHeader
        title="Integrations"
        contextActions={
          <Link href="/integrations/new" style={primaryActionLinkStyle}>
            New integration
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
            Provider
          </span>
          {/* `key` forces a remount whenever the underlying filter value changes, including back
              to "" on Clear filters — a Next.js <Link> soft-navigation otherwise re-renders this
              same DOM node in place, and an uncontrolled <select>'s defaultValue only takes effect
              on first mount (see brand-library/page.tsx's own identical note). */}
          <select
            key={query.provider ?? "all-providers"}
            name="provider"
            defaultValue={query.provider ?? ""}
            style={selectStyle}
          >
            <option value="">All providers</option>
            {PROVIDER_VALUES.map((value) => (
              <option key={value} value={value}>
                {PROVIDER_LABEL[value]}
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
            Active
          </span>
          <select
            key={query.isActive === null ? "all-active" : String(query.isActive)}
            name="isActive"
            defaultValue={query.isActive === null ? "" : String(query.isActive)}
            style={selectStyle}
          >
            <option value="">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
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
            href="/integrations"
            style={{ alignSelf: "flex-end", fontSize: "0.875rem", padding: "0.4rem 0" }}
          >
            Clear filters
          </Link>
        ) : null}
      </form>

      {integrations.length === 0 ? (
        <EmptyState
          title={
            isPastLastPage
              ? "No more integrations"
              : hasFilters || query.search
                ? "No integrations match your filters"
                : "No integrations recorded yet"
          }
          description={
            isPastLastPage
              ? "You've gone past the last page of results."
              : hasFilters || query.search
                ? "Try a different provider, status, or search term."
                : "Integrations recorded for this organization will appear here."
          }
          action={
            isPastLastPage ? (
              <Link
                href={buildIntegrationsHref(query, {
                  offset: Math.max(0, query.offset - query.pageSize),
                })}
                style={{ fontSize: "0.875rem" }}
              >
                Previous
              </Link>
            ) : hasFilters || query.search ? (
              <Link href="/integrations" style={{ fontSize: "0.875rem" }}>
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
                  <th style={thStyle}>Display name</th>
                  <th style={thStyle}>Provider</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Active</th>
                  <th style={thStyle}>Updated</th>
                </tr>
              </thead>
              <tbody>
                {integrations.map((integration) => (
                  <IntegrationRow key={integration.id} integration={integration} />
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
              Showing {query.offset + 1}–{query.offset + integrations.length}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
              <PageSizeSelect
                value={query.pageSize}
                hrefBySize={buildHrefBySize((pageSize) =>
                  buildIntegrationsHref(query, { pageSize }),
                )}
              />
              <div style={{ display: "flex", gap: "0.75rem" }}>
                {query.offset > 0 ? (
                  <Link
                    href={buildIntegrationsHref(query, {
                      offset: Math.max(0, query.offset - query.pageSize),
                    })}
                  >
                    Previous
                  </Link>
                ) : null}
                {hasNextPage ? (
                  <Link
                    href={buildIntegrationsHref(query, {
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

function IntegrationRow({ integration }: { readonly integration: Integration }) {
  const statusBadge = integrationStatusBadge(integration.status);
  const activeBadge = integrationActiveBadge(integration.isActive);
  return (
    <tr>
      <td style={tdStyle}>
        <Link href={`/integrations/${integration.id}`}>{integration.displayName}</Link>
      </td>
      <td style={tdStyle}>{PROVIDER_LABEL[integration.provider]}</td>
      <td style={tdStyle}>
        <StatusBadge status={statusBadge.token} label={statusBadge.label} />
      </td>
      <td style={tdStyle}>
        <StatusBadge status={activeBadge.token} label={activeBadge.label} />
      </td>
      <td style={{ ...tdStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}>
        {formatTimestamp(integration.updatedAt)}
      </td>
    </tr>
  );
}
