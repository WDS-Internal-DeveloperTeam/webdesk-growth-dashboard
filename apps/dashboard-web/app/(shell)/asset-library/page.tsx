import Link from "next/link";
import type { Asset } from "@webdesk/shared-types";
import { ContentContainer, EmptyState, PageHeader, StatusBadge } from "@webdesk/ui";
import { PageSizeSelect } from "@/components/page-size-select";
import { primaryActionLinkStyle } from "@/lib/action-link-style";
import {
  APPROVAL_STATUS_LABEL,
  APPROVAL_STATUS_VALUES,
  assetApprovalStatusBadge,
  assetPublishBadge,
  buildAssetLibraryHref,
  formatTimestamp,
  getAssets,
  parseAssetLibrarySearchParams,
  SCAN_STATUS_LABEL,
  SCAN_STATUS_VALUES,
  VISIBILITY_LABEL,
  VISIBILITY_VALUES,
} from "@/lib/asset-library";
import {
  filterSelectStyle as selectStyle,
  filterSubmitButtonStyle as submitButtonStyle,
} from "@/lib/list-filter-styles";
import { listTableCellStyle, listTableHeaderCellStyle } from "@/lib/list-table-styles";
import { buildHrefBySize } from "@/lib/pagination";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface AssetLibraryListPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * No approved wireframe/screen spec exists for this module
 * (`03_Detailed_Module_Specifications.md §12` is a flat field list, no screen description) —
 * renders exactly what `GET /asset-library/assets` returns and supports (an `approvalStatus`
 * filter, a `visibility` filter, a `scanStatus` filter, an `isPublished` filter, `search`, and
 * offset pagination, no sort, no `mimeType` filter), matching the Brand/Content Template/Persona/
 * Service Library list pages' own "smallest honest reading" precedent for an unsourced screen.
 */
export default async function AssetLibraryListPage({ searchParams }: AssetLibraryListPageProps) {
  // The (shell) layout already redirects unauthenticated callers to sign-in before this page
  // renders — this defensive fallback avoids firing the list fetch in parallel with a redirect
  // that would just discard the result, matching every other page in this app.
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const query = parseAssetLibrarySearchParams(await searchParams);
  const { items: assets, hasNextPage } = await getAssets(query);
  const hasFilters =
    query.approvalStatus !== null ||
    query.visibility !== null ||
    query.scanStatus !== null ||
    query.isPublished !== null;
  const isPastLastPage = assets.length === 0 && query.offset > 0;

  return (
    <ContentContainer>
      <PageHeader
        title="Asset Library"
        contextActions={
          <Link href="/asset-library/new" style={primaryActionLinkStyle}>
            New asset
          </Link>
        }
      />

      <form
        method="get"
        style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1.5rem" }}
      >
        {/* Preserves the reader's page-size choice across a filter submit — see
            brand-library/page.tsx's own identical note. */}
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
              to "" on Clear filters — see brand-library/page.tsx's own identical note. */}
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
            Visibility
          </span>
          <select
            key={query.visibility ?? "all-visibilities"}
            name="visibility"
            defaultValue={query.visibility ?? ""}
            style={selectStyle}
          >
            <option value="">All visibilities</option>
            {VISIBILITY_VALUES.map((value) => (
              <option key={value} value={value}>
                {VISIBILITY_LABEL[value]}
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
            Scan status
          </span>
          <select
            key={query.scanStatus ?? "all-scan-statuses"}
            name="scanStatus"
            defaultValue={query.scanStatus ?? ""}
            style={selectStyle}
          >
            <option value="">All scan statuses</option>
            {SCAN_STATUS_VALUES.map((value) => (
              <option key={value} value={value}>
                {SCAN_STATUS_LABEL[value]}
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
            href="/asset-library"
            style={{ alignSelf: "flex-end", fontSize: "0.875rem", padding: "0.4rem 0" }}
          >
            Clear filters
          </Link>
        ) : null}
      </form>

      {assets.length === 0 ? (
        <EmptyState
          title={
            isPastLastPage
              ? "No more assets"
              : hasFilters || query.search
                ? "No assets match your filters"
                : "No assets yet"
          }
          description={
            isPastLastPage
              ? "You've gone past the last page of results."
              : hasFilters || query.search
                ? "Try a different status, visibility, or search term."
                : "Assets created for this organization will appear here."
          }
          action={
            isPastLastPage ? (
              <Link
                href={buildAssetLibraryHref(query, {
                  offset: Math.max(0, query.offset - query.pageSize),
                })}
                style={{ fontSize: "0.875rem" }}
              >
                Previous
              </Link>
            ) : hasFilters || query.search ? (
              <Link href="/asset-library" style={{ fontSize: "0.875rem" }}>
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
                  <th style={thStyle}>Approval</th>
                  <th style={thStyle}>Visibility</th>
                  <th style={thStyle}>Publish status</th>
                  <th style={thStyle}>Updated</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((asset) => (
                  <AssetLibraryRow key={asset.id} asset={asset} />
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
              Showing {query.offset + 1}–{query.offset + assets.length}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
              <PageSizeSelect
                value={query.pageSize}
                hrefBySize={buildHrefBySize((pageSize) =>
                  buildAssetLibraryHref(query, { pageSize }),
                )}
              />
              <div style={{ display: "flex", gap: "0.75rem" }}>
                {query.offset > 0 ? (
                  <Link
                    href={buildAssetLibraryHref(query, {
                      offset: Math.max(0, query.offset - query.pageSize),
                    })}
                  >
                    Previous
                  </Link>
                ) : null}
                {hasNextPage ? (
                  <Link
                    href={buildAssetLibraryHref(query, {
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

function AssetLibraryRow({ asset }: { readonly asset: Asset }) {
  const approvalBadge = assetApprovalStatusBadge(asset.approvalStatus);
  const publishBadge = assetPublishBadge(asset.isPublished);
  return (
    <tr>
      <td style={tdStyle}>
        <Link href={`/asset-library/${asset.id}`}>{asset.title}</Link>
      </td>
      <td style={tdStyle}>
        <StatusBadge status={approvalBadge.token} label={approvalBadge.label} />
      </td>
      <td style={tdStyle}>{VISIBILITY_LABEL[asset.visibility]}</td>
      <td style={tdStyle}>
        <StatusBadge status={publishBadge.token} label={publishBadge.label} />
      </td>
      <td style={{ ...tdStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}>
        {formatTimestamp(asset.updatedAt)}
      </td>
    </tr>
  );
}
