import Link from "next/link";
import type { Review, UserSummary } from "@webdesk/shared-types";
import { ContentContainer, EmptyState, PageHeader, StatusBadge } from "@webdesk/ui";
import { PageSizeSelect } from "@/components/page-size-select";
import { primaryActionLinkStyle } from "@/lib/action-link-style";
import {
  filterSelectStyle as selectStyle,
  filterSubmitButtonStyle as submitButtonStyle,
} from "@/lib/list-filter-styles";
import { listTableCellStyle, listTableHeaderCellStyle } from "@/lib/list-table-styles";
import { buildHrefBySize } from "@/lib/pagination";
import {
  buildReviewsHref,
  formatTimestamp,
  getReviews,
  moduleDisplayName,
  parseReviewsSearchParams,
  REVIEW_STATUS_LABEL,
  REVIEW_STATUS_VALUES,
  reviewStatusBadge,
  sortModulesForPicker,
} from "@/lib/review-and-approval-center";
import { getServerSession } from "@/lib/server-session";
import { getUsersByIds } from "@/lib/users";

export const dynamic = "force-dynamic";

interface ReviewAndApprovalCenterListPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * No approved wireframe/screen spec exists for this module — renders exactly what `GET /reviews`
 * returns and supports (a `status` filter, a `targetModuleKey` filter, `search`, `assignedToMe`,
 * and offset pagination), matching every sibling module's own "smallest honest reading" precedent
 * for an unsourced screen.
 *
 * Defaults to `assignedToMe=true` (the inbox view) with no query params — an explicit, honest
 * default in `parseReviewsSearchParams()` itself, with a real link to switch to the unfiltered
 * "All reviews" view.
 *
 * The `targetModuleKey` filter's own options come from the session's own already-fetched
 * `session.navigation` (`GET /me/navigation`, real backend data, not a hand-typed enum) — see
 * `lib/review-and-approval-center.ts`'s removed-`getModuleRegistry()` doc comment for why this
 * replaced a direct, more narrowly-gated `GET /authz/module-registry` fetch (code-review finding).
 * The "New review" action link is always shown regardless — the same
 * "let the backend enforce, the UI just calls it" convention `/projects`'s own "New project" link
 * already establishes, rather than a client-side guess about the caller's own capabilities.
 */
export default async function ReviewAndApprovalCenterListPage({
  searchParams,
}: ReviewAndApprovalCenterListPageProps) {
  // The (shell) layout already redirects unauthenticated callers to sign-in before this page
  // renders — this defensive fallback avoids firing the list fetch in parallel with a redirect
  // that would just discard the result, matching every other page in this app.
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const query = parseReviewsSearchParams(await searchParams);
  const { items: reviews, hasNextPage } = await getReviews(query);
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
    query.status !== null || query.targetModuleKey !== null || query.search !== null;
  const isPastLastPage = reviews.length === 0 && query.offset > 0;

  return (
    <ContentContainer>
      <PageHeader
        title="Review and Approval Center"
        contextActions={
          <Link href="/review-and-approval-center/new" style={primaryActionLinkStyle}>
            New review
          </Link>
        }
      />

      <p style={{ fontSize: "0.875rem", marginBottom: "1rem" }}>
        {query.assignedToMe ? (
          <>
            Showing reviews assigned to you.{" "}
            <Link href={buildReviewsHref(query, { assignedToMe: false })}>View all reviews</Link>
          </>
        ) : (
          <>
            Showing all reviews.{" "}
            <Link href={buildReviewsHref(query, { assignedToMe: true })}>
              View reviews assigned to me
            </Link>
          </>
        )}
      </p>

      <form
        method="get"
        style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1.5rem" }}
      >
        {/* Preserves the reader's page-size choice and the assignedToMe toggle across a filter
            submit — without these, a native GET form submission builds its target URL purely from
            this form's own named fields, silently resetting both back to their defaults. */}
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
          {/* `key` forces a remount whenever the underlying filter value changes, including back
              to "" on Clear filters — a Next.js <Link> soft-navigation otherwise re-renders this
              same DOM node in place, and an uncontrolled <select>'s defaultValue only takes effect
              on first mount. */}
          <select
            key={query.status ?? "all-statuses"}
            name="status"
            defaultValue={query.status ?? ""}
            style={selectStyle}
          >
            <option value="">All statuses</option>
            {REVIEW_STATUS_VALUES.map((value) => (
              <option key={value} value={value}>
                {REVIEW_STATUS_LABEL[value]}
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
            href={buildReviewsHref(query, { status: null, targetModuleKey: null, search: null })}
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
              ? "No more reviews"
              : hasFilters
                ? "No reviews match your filters"
                : query.assignedToMe
                  ? "No reviews assigned to you"
                  : "No reviews yet"
          }
          description={
            isPastLastPage
              ? "You've gone past the last page of results."
              : hasFilters
                ? "Try a different status, module, or search term."
                : query.assignedToMe
                  ? "Reviews assigned to you will appear here."
                  : "Reviews submitted for this organization will appear here."
          }
          action={
            isPastLastPage ? (
              <Link
                href={buildReviewsHref(query, {
                  offset: Math.max(0, query.offset - query.pageSize),
                })}
                style={{ fontSize: "0.875rem" }}
              >
                Previous
              </Link>
            ) : hasFilters ? (
              <Link
                href={buildReviewsHref(query, {
                  status: null,
                  targetModuleKey: null,
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
                  <th style={listTableHeaderCellStyle}>Status</th>
                  <th style={listTableHeaderCellStyle}>Submitted by</th>
                  <th style={listTableHeaderCellStyle}>Assigned to</th>
                  <th style={listTableHeaderCellStyle}>Updated</th>
                </tr>
              </thead>
              <tbody>
                {reviews.map((review) => (
                  <ReviewRow key={review.id} review={review} users={users} />
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
                hrefBySize={buildHrefBySize((pageSize) => buildReviewsHref(query, { pageSize }))}
              />
              <div style={{ display: "flex", gap: "0.75rem" }}>
                {query.offset > 0 ? (
                  <Link
                    href={buildReviewsHref(query, {
                      offset: Math.max(0, query.offset - query.pageSize),
                    })}
                  >
                    Previous
                  </Link>
                ) : null}
                {hasNextPage ? (
                  <Link href={buildReviewsHref(query, { offset: query.offset + query.pageSize })}>
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

function ReviewRow({
  review,
  users,
}: {
  readonly review: Review;
  readonly users: ReadonlyMap<string, UserSummary>;
}) {
  const badge = reviewStatusBadge(review.status);
  const submittedBy = users.get(review.submittedByUserId);
  const assignedTo = review.assignedToUserId ? users.get(review.assignedToUserId) : null;

  return (
    <tr>
      <td style={listTableCellStyle}>
        <Link href={`/review-and-approval-center/${review.id}`}>{review.targetModuleKey}</Link>
        <div
          style={{
            fontSize: "0.75rem",
            color: "var(--webdesk-dashboard-color-foreground-muted)",
          }}
        >
          {review.targetLabel ?? `${review.targetId.slice(0, 8)}…`}
        </div>
      </td>
      <td style={listTableCellStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
          <StatusBadge status={badge.token} label={badge.label} />
          {review.isPaused ? <StatusBadge status="notConfigured" label="Paused" /> : null}
        </div>
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
