import Link from "next/link";
import type { ProofClaim } from "@webdesk/shared-types";
import { ContentContainer, EmptyState, PageHeader, StatusBadge } from "@webdesk/ui";
import { PageSizeSelect } from "@/components/page-size-select";
import { primaryActionLinkStyle } from "@/lib/action-link-style";
import {
  filterSelectStyle as selectStyle,
  filterSubmitButtonStyle as submitButtonStyle,
} from "@/lib/list-filter-styles";
import { listTableCellStyle, listTableHeaderCellStyle } from "@/lib/list-table-styles";
import { buildHrefBySize } from "@/lib/pagination";
import { getServerSession } from "@/lib/server-session";
import {
  buildProofAndClaimsLibraryHref,
  formatTimestamp,
  getProofClaims,
  parseProofAndClaimsLibrarySearchParams,
  proofClaimApprovalStatusBadge,
} from "@/lib/proof-and-claims-library";
import {
  APPROVAL_STATUS_LABEL,
  APPROVAL_STATUS_VALUES,
} from "@/lib/proof-and-claims-library-query";

export const dynamic = "force-dynamic";

interface ProofAndClaimsLibraryListPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * No approved wireframe/screen spec exists for this module
 * (`04_Data_Model_and_Ownership.md:119-120` names the two tables, not a screen) — renders exactly
 * what `GET /proof-and-claims-library/claims` returns and supports (an `approvalStatus` filter,
 * `search`, and offset pagination, no sort), matching the Projects/Business Knowledge Center/
 * Service Library/Persona Library list pages' own "smallest honest reading" precedent for an
 * unsourced screen.
 */
export default async function ProofAndClaimsLibraryListPage({
  searchParams,
}: ProofAndClaimsLibraryListPageProps) {
  // The (shell) layout already redirects unauthenticated callers to sign-in before this page
  // renders — this defensive fallback avoids firing the list fetch in parallel with a redirect
  // that would just discard the result, matching every other page in this app.
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const query = parseProofAndClaimsLibrarySearchParams(await searchParams);
  const { items: claims, hasNextPage } = await getProofClaims(query);
  const hasFilters = query.approvalStatus !== null;
  const isPastLastPage = claims.length === 0 && query.offset > 0;

  return (
    <ContentContainer>
      <PageHeader
        title="Proof and Claims Library"
        contextActions={
          <Link href="/proof-and-claims-library/new" style={primaryActionLinkStyle}>
            New claim
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
              on first mount (see persona-library/page.tsx's own identical note). */}
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
            href="/proof-and-claims-library"
            style={{ alignSelf: "flex-end", fontSize: "0.875rem", padding: "0.4rem 0" }}
          >
            Clear filters
          </Link>
        ) : null}
      </form>

      {claims.length === 0 ? (
        <EmptyState
          title={
            isPastLastPage
              ? "No more proof claims"
              : hasFilters || query.search
                ? "No proof claims match your filters"
                : "No proof claims yet"
          }
          description={
            isPastLastPage
              ? "You've gone past the last page of results."
              : hasFilters || query.search
                ? "Try a different status or search term."
                : "Claims created for this organization will appear here."
          }
          action={
            isPastLastPage ? (
              <Link
                href={buildProofAndClaimsLibraryHref(query, {
                  offset: Math.max(0, query.offset - query.pageSize),
                })}
                style={{ fontSize: "0.875rem" }}
              >
                Previous
              </Link>
            ) : hasFilters || query.search ? (
              <Link href="/proof-and-claims-library" style={{ fontSize: "0.875rem" }}>
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
                  <th style={thStyle}>Claim</th>
                  <th style={thStyle}>Verification</th>
                  <th style={thStyle}>Approval</th>
                  <th style={thStyle}>Updated</th>
                </tr>
              </thead>
              <tbody>
                {claims.map((claim) => (
                  <ClaimRow key={claim.id} claim={claim} />
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
              Showing {query.offset + 1}–{query.offset + claims.length}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
              <PageSizeSelect
                value={query.pageSize}
                hrefBySize={buildHrefBySize((pageSize) =>
                  buildProofAndClaimsLibraryHref(query, { pageSize }),
                )}
              />
              <div style={{ display: "flex", gap: "0.75rem" }}>
                {query.offset > 0 ? (
                  <Link
                    href={buildProofAndClaimsLibraryHref(query, {
                      offset: Math.max(0, query.offset - query.pageSize),
                    })}
                  >
                    Previous
                  </Link>
                ) : null}
                {hasNextPage ? (
                  <Link
                    href={buildProofAndClaimsLibraryHref(query, {
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

const VERIFICATION_STATUS_LABEL: Readonly<Record<ProofClaim["verificationStatus"], string>> = {
  unverified: "Unverified",
  pending: "Pending",
  verified: "Verified",
};

/**
 * Links on `publicId`, not `claim.claim` — unlike every sibling module, this module has no
 * dedicated short plain-text name/title field; `claim` itself is now real rich-text HTML (see
 * `ProofAndClaimsLibraryForm`'s own doc comment), and rendering that raw in a table cell would
 * either show literal markup or need its own stripped-text summary — a real feature this table
 * doesn't build. `publicId` is the honest, always-plain-text identifier every row already has.
 */
function ClaimRow({ claim }: { readonly claim: ProofClaim }) {
  const approvalBadge = proofClaimApprovalStatusBadge(claim.approvalStatus);
  return (
    <tr>
      <td style={tdStyle}>
        <Link href={`/proof-and-claims-library/${claim.id}`}>{claim.publicId}</Link>
      </td>
      <td style={{ ...tdStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}>
        {VERIFICATION_STATUS_LABEL[claim.verificationStatus]}
      </td>
      <td style={tdStyle}>
        <StatusBadge status={approvalBadge.token} label={approvalBadge.label} />
      </td>
      <td style={{ ...tdStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}>
        {formatTimestamp(claim.updatedAt)}
      </td>
    </tr>
  );
}
