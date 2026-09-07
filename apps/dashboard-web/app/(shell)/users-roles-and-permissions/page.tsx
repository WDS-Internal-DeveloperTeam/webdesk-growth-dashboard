import Link from "next/link";
import type { AdminUser } from "@webdesk/shared-types";
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
  ACCOUNT_STATUS_VALUES,
  adminUserStatusBadge,
  buildUsersRolesPermissionsHref,
  formatTimestamp,
  getAdminUsers,
  parseUsersRolesPermissionsSearchParams,
} from "@/lib/users-roles-permissions";

export const dynamic = "force-dynamic";

interface UsersRolesPermissionsListPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const ACCOUNT_STATUS_LABEL: Readonly<Record<"active" | "disabled", string>> = {
  active: "Active",
  disabled: "Disabled",
};

/**
 * No approved wireframe/screen spec exists for this module — this list page renders exactly what
 * `GET /users-roles-and-permissions/users` returns and supports (a `status` filter, `search`, and
 * offset pagination against a real backend `total`), matching every prior module's own "smallest
 * honest reading" precedent for an unsourced screen. Scope confirmed directly with the project
 * owner before building: a real user directory (every account status, not just active) plus
 * activate/deactivate — no new-user creation (Google SSO/emergency-admin provisioning stay the
 * only ways an account is created) and no role-assignment editing here (that already lives on
 * `RoleAssignmentController`'s own, separate, not-yet-built-into-this-UI surface).
 */
export default async function UsersRolesPermissionsListPage({
  searchParams,
}: UsersRolesPermissionsListPageProps) {
  // The (shell) layout already redirects unauthenticated callers to sign-in before this page
  // renders — this defensive fallback avoids firing the list fetch in parallel with a redirect
  // that would just discard the result, matching every other page in this app.
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const query = parseUsersRolesPermissionsSearchParams(await searchParams);
  const { items: users, total } = await getAdminUsers(query);
  const hasFilters = query.status !== null;
  const hasNextPage = query.offset + users.length < total;
  const isPastLastPage = users.length === 0 && query.offset > 0;

  return (
    <ContentContainer>
      <PageHeader
        title="Users, Roles and Permissions"
        contextActions={
          <Link href="/users-roles-and-permissions/matrix" style={primaryActionLinkStyle}>
            View permission matrix
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
              same DOM node in place, and an uncontrolled <select>'s defaultValue only takes
              effect on first mount (see persona-library/page.tsx's own identical note). */}
          <select
            key={query.status ?? "all-statuses"}
            name="status"
            defaultValue={query.status ?? ""}
            style={selectStyle}
          >
            <option value="">All statuses</option>
            {ACCOUNT_STATUS_VALUES.map((value) => (
              <option key={value} value={value}>
                {ACCOUNT_STATUS_LABEL[value]}
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
            placeholder="Name or email"
            style={selectStyle}
          />
        </label>
        <button type="submit" style={submitButtonStyle}>
          Apply
        </button>
        {hasFilters || query.search ? (
          <Link
            href="/users-roles-and-permissions"
            style={{ alignSelf: "flex-end", fontSize: "0.875rem", padding: "0.4rem 0" }}
          >
            Clear filters
          </Link>
        ) : null}
      </form>

      {users.length === 0 ? (
        <EmptyState
          title={
            isPastLastPage
              ? "No more users"
              : hasFilters || query.search
                ? "No users match your filters"
                : "No users yet"
          }
          description={
            isPastLastPage
              ? "You've gone past the last page of results."
              : hasFilters || query.search
                ? "Try a different status or search term."
                : "Users are provisioned via Google Workspace SSO or emergency-admin setup."
          }
          action={
            isPastLastPage ? (
              <Link
                href={buildUsersRolesPermissionsHref(query, {
                  offset: Math.max(0, query.offset - query.pageSize),
                })}
                style={{ fontSize: "0.875rem" }}
              >
                Previous
              </Link>
            ) : hasFilters || query.search ? (
              <Link href="/users-roles-and-permissions" style={{ fontSize: "0.875rem" }}>
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
                  <th style={listTableHeaderCellStyle}>Name</th>
                  <th style={listTableHeaderCellStyle}>Email</th>
                  <th style={listTableHeaderCellStyle}>Status</th>
                  <th style={listTableHeaderCellStyle}>Last login</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <UserRow key={user.id} user={user} />
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
              Showing {query.offset + 1}–{query.offset + users.length} of {total}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
              <PageSizeSelect
                value={query.pageSize}
                hrefBySize={buildHrefBySize((pageSize) =>
                  buildUsersRolesPermissionsHref(query, { pageSize }),
                )}
              />
              <div style={{ display: "flex", gap: "0.75rem" }}>
                {query.offset > 0 ? (
                  <Link
                    href={buildUsersRolesPermissionsHref(query, {
                      offset: Math.max(0, query.offset - query.pageSize),
                    })}
                  >
                    Previous
                  </Link>
                ) : null}
                {hasNextPage ? (
                  <Link
                    href={buildUsersRolesPermissionsHref(query, {
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

function UserRow({ user }: { readonly user: AdminUser }) {
  const badge = adminUserStatusBadge(user.accountStatus);
  return (
    <tr>
      <td style={listTableCellStyle}>
        <Link href={`/users-roles-and-permissions/${user.id}`}>{user.displayName}</Link>
      </td>
      <td style={listTableCellStyle}>{user.email}</td>
      <td style={listTableCellStyle}>
        <StatusBadge status={badge.token} label={badge.label} />
      </td>
      <td style={listTableCellStyle}>
        {user.lastLoginAt ? formatTimestamp(user.lastLoginAt) : "Never"}
      </td>
    </tr>
  );
}
