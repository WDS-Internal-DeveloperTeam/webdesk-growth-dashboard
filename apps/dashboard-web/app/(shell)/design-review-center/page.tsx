import Link from "next/link";
import type { DesignReview, UserSummary } from "@webdesk/shared-types";
import { ContentContainer, EmptyState, PageHeader, StatusBadge } from "@webdesk/ui";
import { PageSizeSelect } from "@/components/page-size-select";
import { primaryActionLinkStyle } from "@/lib/action-link-style";
import {
  buildDesignReviewsHref,
  DESIGN_REVIEW_STATUS_LABEL,
  DESIGN_REVIEW_STATUS_VALUES,
  DESIGN_REVIEW_TYPE_LABEL,
  DESIGN_REVIEW_TYPE_VALUES,
  designReviewStatusBadge,
  formatTimestamp,
  getDesignReviews,
  moduleDisplayName,
  parseDesignReviewsSearchParams,
  sortModulesForPicker,
} from "@/lib/design-review-center";
import {
  filterSelectStyle as selectStyle,
  filterSubmitButtonStyle as submitButtonStyle,
} from "@/lib/list-filter-styles";
import { listTableCellStyle, listTableHeaderCellStyle } from "@/lib/list-table-styles";
import { buildHrefBySize } from "@/lib/pagination";
import { getServerSession } from "@/lib/server-session";
import { getUsersByIds } from "@/lib/users";

export const dynamic = "force-dynamic";

interface DesignReviewCenterListPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * No approved wireframe/screen spec exists for this module — renders exactly what
 * `GET /design-reviews` returns and supports (a `status` filter, a `targetModuleKey` filter, a
 * `reviewType` filter, `search`, `assignedToMe`, and offset pagination), mirroring
 * `ReviewAndApprovalCenterListPage`'s own structure file-for-file plus a `reviewType` filter,
 * matching every sibling module's own "smallest honest reading" precedent for an unsourced screen.
 *
 * Defaults to `assignedToMe=true` (the inbox view) with no query params — an explicit, honest
 * default in `parseDesignReviewsSearchParams()` itself, with a real link to switch to the
 * unfiltered "All design reviews" view.
 *
 * The `targetModuleKey` filter's own options come from the session's own already-fetched
 * `session.navigation` (`GET /me/navigation`), the same real backend data source Review and
 * Approval Center's own list page already established. The "New design review" action link is
 * always shown regardless of the caller's own `create` grant — the same "let the backend enforce,
 * the UI just calls it" convention every sibling module's list page already follows.
 */
export default async function DesignReviewCenterListPage({
  searchParams,
}: DesignReviewCenterListPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const query = parseDesignReviewsSearchParams(await searchParams);
  const { items: reviews, hasNextPage } = await getDesignReviews(query);
  const modules = sortModulesForPicker(session.navigation);

  const userIds = new Set<string>();
  reviews.forEach((review) => {
    userIds.add(review.submittedByUserId);
    if (review.assignedToUserId) {
      userIds.add(review.assignedToUserId);
    }
  });
  const users = await getUsersByIds([...userIds]);

  const hasFilters =
    query.status !== null ||
    query.targetModuleKey !== null ||
    query.reviewType !== null ||
    query.search !== null;
  const isPastLastPage = reviews.length === 0 && query.offset > 0;

  return (
    <ContentContainer>
      <PageHeader
        title="Design Review Center"
        contextActions={
          <Link href="/design-review-center/new" style={primaryActionLinkStyle}>
            New design review
          </Link>
        }
      />

      <p style={{ fontSize: "0.875rem", marginBottom: "1rem" }}>
        {query.assignedToMe ? (
          <>
            Showing design reviews assigned to you.{" "}
            <Link href={buildDesignReviewsHref(query, { assignedToMe: false })}>
              View all design reviews
            </Link>
          </>
        ) : (
          <>
            Showing all design reviews.{" "}
            <Link href={buildDesignReviewsHref(query, { assignedToMe: true })}>
              View design reviews assigned to me
            </Link>
          </>
        )}
      </p>

      <form
        method="get"
        style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1.5rem" }}
      >
        {/* Preserves the reader's page-size choice and the assignedToMe toggle across a filter
            submit — mirrors ReviewAndApprovalCenterListPage's own precedent. */}
        <input type="hidden" name="pageSize" value={query.pageSize} />
        <input type="hidden" name="assignedToMe" value={query.assignedToMe ? "true" : "false"} />
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
            {DESIGN_REVIEW_STATUS_VALUES.map((value) => (
              <option key={value} value={value}>
                {DESIGN_REVIEW_STATUS_LABEL[value]}
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
            Review type
          </span>
          <select
            key={query.reviewType ?? "all-types"}
            name="reviewType"
            defaultValue={query.reviewType ?? ""}
            style={selectStyle}
          >
            <option value="">All review types</option>
            {DESIGN_REVIEW_TYPE_VALUES.map((value) => (
              <option key={value} value={value}>
                {DESIGN_REVIEW_TYPE_LABEL[value]}
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
            Target module
          </span>
          <select
            key={query.targetModuleKey ?? "all-modules"}
            name="targetModuleKey"
            defaultValue={query.targetModuleKey ?? ""}
            style={selectStyle}
          >
            <option value="">All modules</option>
            {modules.map((module) => (
              <option key={module.key} value={module.key}>
                {moduleDisplayName(module)}
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
            maxLength={500}
            style={selectStyle}
          />
        </label>
        <button type="submit" style={submitButtonStyle}>
          Apply
        </button>
        {hasFilters ? (
          <Link
            href={buildDesignReviewsHref(query, {
              status: null,
              targetModuleKey: null,
              reviewType: null,
              search: null,
            })}
            style={{ alignSelf: "flex-end", fontSize: "0.875rem", padding: "0.4rem 0" }}
          >
            Clear filters
          </Link>
        ) : null}
      </form>

      {reviews.length === 0 ? (
        <EmptyState
          title={
            isPastLastPage
              ? "No more design reviews"
              : hasFilters
                ? "No design reviews match your filters"
                : query.assignedToMe
                  ? "No design reviews assigned to you"
                  : "No design reviews yet"
          }
          description={
            isPastLastPage
              ? "You've gone past the last page of results."
              : hasFilters
                ? "Try a different status, review type, module, or search term."
                : query.assignedToMe
                  ? "Design reviews assigned to you will appear here."
                  : "Design reviews submitted for this organization will appear here."
          }
          action={
            isPastLastPage ? (
              <Link
                href={buildDesignReviewsHref(query, {
                  offset: Math.max(0, query.offset - query.pageSize),
                })}
                style={{ fontSize: "0.875rem" }}
              >
                Previous
              </Link>
            ) : hasFilters ? (
              <Link
                href={buildDesignReviewsHref(query, {
                  status: null,
                  targetModuleKey: null,
                  reviewType: null,
                  search: null,
                })}
                style={{ fontSize: "0.875rem" }}
              >
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
                  <th style={listTableHeaderCellStyle}>Target</th>
                  <th style={listTableHeaderCellStyle}>Review type</th>
                  <th style={listTableHeaderCellStyle}>Status</th>
                  <th style={listTableHeaderCellStyle}>Submitted by</th>
                  <th style={listTableHeaderCellStyle}>Assigned to</th>
                  <th style={listTableHeaderCellStyle}>Updated</th>
                </tr>
              </thead>
              <tbody>
                {reviews.map((review) => (
                  <DesignReviewRow key={review.id} review={review} users={users} />
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
              Showing {query.offset + 1}–{query.offset + reviews.length}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
              <PageSizeSelect
                value={query.pageSize}
                hrefBySize={buildHrefBySize((pageSize) =>
                  buildDesignReviewsHref(query, { pageSize }),
                )}
              />
              <div style={{ display: "flex", gap: "0.75rem" }}>
                {query.offset > 0 ? (
                  <Link
                    href={buildDesignReviewsHref(query, {
                      offset: Math.max(0, query.offset - query.pageSize),
                    })}
                  >
                    Previous
                  </Link>
                ) : null}
                {hasNextPage ? (
                  <Link
                    href={buildDesignReviewsHref(query, { offset: query.offset + query.pageSize })}
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

function DesignReviewRow({
  review,
  users,
}: {
  readonly review: DesignReview;
  readonly users: ReadonlyMap<string, UserSummary>;
}) {
  const badge = designReviewStatusBadge(review.status);
  const submittedBy = users.get(review.submittedByUserId);
  const assignedTo = review.assignedToUserId ? users.get(review.assignedToUserId) : null;

  return (
    <tr>
      <td style={listTableCellStyle}>
        <Link href={`/design-review-center/${review.id}`}>{review.targetModuleKey}</Link>
        <div
          style={{
            fontSize: "0.75rem",
            color: "var(--webdesk-dashboard-color-foreground-muted)",
          }}
        >
          {review.targetLabel ?? `${review.targetId.slice(0, 8)}…`}
        </div>
      </td>
      <td
        style={{ ...listTableCellStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}
      >
        {DESIGN_REVIEW_TYPE_LABEL[review.reviewType]}
      </td>
      <td style={listTableCellStyle}>
        <StatusBadge status={badge.token} label={badge.label} />
      </td>
      <td
        style={{ ...listTableCellStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}
      >
        {submittedBy?.displayName ?? review.submittedByUserId}
      </td>
      <td
        style={{ ...listTableCellStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}
      >
        {review.assignedToUserId
          ? (assignedTo?.displayName ?? review.assignedToUserId)
          : "Unassigned"}
      </td>
      <td
        style={{ ...listTableCellStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}
      >
        {formatTimestamp(review.updatedAt)}
      </td>
    </tr>
  );
}
