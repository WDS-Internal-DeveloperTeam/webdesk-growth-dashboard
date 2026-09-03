import Link from "next/link";
import { ContentContainer, EmptyState, PageHeader, StatusBadge } from "@webdesk/ui";
import { PageSizeSelect } from "@/components/page-size-select";
import {
  filterSelectStyle as selectStyle,
  filterSubmitButtonStyle as submitButtonStyle,
} from "@/lib/list-filter-styles";
import { listTableCellStyle, listTableHeaderCellStyle } from "@/lib/list-table-styles";
import {
  buildNotificationCenterHref,
  formatTimestamp,
  getNotifications,
  NOTIFICATION_DELIVERY_STATES,
  notificationDeliveryStateBadge,
  notificationDeliveryStateLabel,
  notificationSeverityBadge,
  parseNotificationCenterSearchParams,
} from "@/lib/notification-center";
import { buildHrefBySize } from "@/lib/pagination";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface NotificationCenterListPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const filterLabelStyle = {
  fontSize: "0.75rem",
  color: "var(--webdesk-dashboard-color-foreground-muted)",
} as const;

/**
 * View-only, per the explicit scope decision — no create form and no way to force a notification
 * into existence from this UI; notifications are created internally by other backend modules
 * (`POST /notifications`, `notifications_configure`-gated, is not called from anywhere in
 * `dashboard-web`). The one mutation this page's detail route allows is a retry
 * (`NotificationRetryAction`, `POST /notifications/:id/attempt-delivery`) — real SMTP delivery is
 * out of scope for this phase, so a retry currently always settles into `retrying`/
 * `permanently_failed` again; the UI shows that honestly rather than implying a real send.
 *
 * No approved wireframe/screen spec exists for this module — renders exactly what
 * `GET /notifications` returns and supports (delivery state, project, notification type, and
 * offset pagination), matching every sibling module's own "smallest honest reading" precedent for
 * an unsourced screen. Mirrors `app/(shell)/decision-and-activity-log/page.tsx`'s own structure —
 * the closest sibling (organization-wide, filter-heavy, read-only).
 */
export default async function NotificationCenterListPage({
  searchParams,
}: NotificationCenterListPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const query = parseNotificationCenterSearchParams(await searchParams);
  const { items: notifications, hasNextPage } = await getNotifications(query);

  const hasFilters =
    query.deliveryState !== null || query.projectId !== null || query.notificationType !== null;
  const isPastLastPage = notifications.length === 0 && query.offset > 0;

  return (
    <ContentContainer>
      <PageHeader title="Notification Center" />

      <p style={{ fontSize: "0.875rem", marginBottom: "1rem" }}>
        A read-only view of notifications recorded across this organization, and their real delivery
        state. Real SMTP delivery is not yet configured for this environment, so every notification
        currently settles into Retrying or Permanently failed.
      </p>

      <form
        method="get"
        style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1.5rem" }}
      >
        <input type="hidden" name="pageSize" value={query.pageSize} />
        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <span style={filterLabelStyle}>Delivery state</span>
          <select
            key={query.deliveryState ?? "all-delivery-states"}
            name="deliveryState"
            defaultValue={query.deliveryState ?? ""}
            style={selectStyle}
          >
            <option value="">All delivery states</option>
            {NOTIFICATION_DELIVERY_STATES.map((value) => (
              <option key={value} value={value}>
                {notificationDeliveryStateLabel(value)}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <span style={filterLabelStyle}>Notification type</span>
          <input
            key={query.notificationType ?? "no-notification-type"}
            type="text"
            name="notificationType"
            defaultValue={query.notificationType ?? ""}
            maxLength={64}
            style={selectStyle}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <span style={filterLabelStyle}>Project id</span>
          <input
            key={query.projectId ?? "no-project"}
            type="text"
            name="projectId"
            defaultValue={query.projectId ?? ""}
            maxLength={128}
            style={selectStyle}
          />
        </label>
        <button type="submit" style={submitButtonStyle}>
          Apply
        </button>
        {hasFilters ? (
          <Link
            href={buildNotificationCenterHref(query, {
              deliveryState: null,
              projectId: null,
              notificationType: null,
            })}
            style={{ alignSelf: "flex-end", fontSize: "0.875rem", padding: "0.4rem 0" }}
          >
            Clear filters
          </Link>
        ) : null}
      </form>

      {notifications.length === 0 ? (
        <EmptyState
          title={
            isPastLastPage
              ? "No more notifications"
              : hasFilters
                ? "No notifications match your filters"
                : "No notifications recorded yet"
          }
          description={
            isPastLastPage
              ? "You've gone past the last page of results."
              : hasFilters
                ? "Try a different delivery state, notification type, or project."
                : "Notifications recorded for this organization will appear here."
          }
          action={
            isPastLastPage ? (
              <Link
                href={buildNotificationCenterHref(query, {
                  offset: Math.max(0, query.offset - query.pageSize),
                })}
                style={{ fontSize: "0.875rem" }}
              >
                Previous
              </Link>
            ) : hasFilters ? (
              <Link
                href={buildNotificationCenterHref(query, {
                  deliveryState: null,
                  projectId: null,
                  notificationType: null,
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
                  <th style={listTableHeaderCellStyle}>Subject</th>
                  <th style={listTableHeaderCellStyle}>Type</th>
                  <th style={listTableHeaderCellStyle}>Severity</th>
                  <th style={listTableHeaderCellStyle}>Delivery state</th>
                  <th style={listTableHeaderCellStyle}>Attempts</th>
                  <th style={listTableHeaderCellStyle}>Created</th>
                </tr>
              </thead>
              <tbody>
                {notifications.map((notification) => {
                  const severityBadge = notificationSeverityBadge(notification.severity);
                  const deliveryBadge = notificationDeliveryStateBadge(notification.deliveryState);
                  return (
                    <tr key={notification.id}>
                      <td style={listTableCellStyle}>
                        <Link href={`/notification-center/${notification.id}`}>
                          {notification.subject}
                        </Link>
                      </td>
                      <td
                        style={{
                          ...listTableCellStyle,
                          color: "var(--webdesk-dashboard-color-foreground-muted)",
                        }}
                      >
                        {notification.notificationType}
                      </td>
                      <td style={listTableCellStyle}>
                        <StatusBadge status={severityBadge.token} label={severityBadge.label} />
                      </td>
                      <td style={listTableCellStyle}>
                        <StatusBadge status={deliveryBadge.token} label={deliveryBadge.label} />
                      </td>
                      <td
                        style={{
                          ...listTableCellStyle,
                          color: "var(--webdesk-dashboard-color-foreground-muted)",
                        }}
                      >
                        {notification.attemptCount}
                      </td>
                      <td
                        style={{
                          ...listTableCellStyle,
                          color: "var(--webdesk-dashboard-color-foreground-muted)",
                        }}
                      >
                        {formatTimestamp(notification.createdAt)}
                      </td>
                    </tr>
                  );
                })}
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
              Showing {query.offset + 1}–{query.offset + notifications.length}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
              <PageSizeSelect
                value={query.pageSize}
                hrefBySize={buildHrefBySize((pageSize) =>
                  buildNotificationCenterHref(query, { pageSize }),
                )}
              />
              <div style={{ display: "flex", gap: "0.75rem" }}>
                {query.offset > 0 ? (
                  <Link
                    href={buildNotificationCenterHref(query, {
                      offset: Math.max(0, query.offset - query.pageSize),
                    })}
                  >
                    Previous
                  </Link>
                ) : null}
                {hasNextPage ? (
                  <Link
                    href={buildNotificationCenterHref(query, {
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
