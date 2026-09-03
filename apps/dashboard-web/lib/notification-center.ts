import { cookies } from "next/headers";
import type { ApiSuccessResponse, Notification } from "@webdesk/shared-types";
import { getApiBaseUrl } from "./auth";
import { formatTimestamp } from "./format-timestamp";
import {
  buildNotificationCenterHref,
  NOTIFICATION_DELIVERY_STATES,
  notificationDeliveryStateBadge,
  notificationDeliveryStateLabel,
  notificationSeverityBadge,
  parseNotificationCenterSearchParams,
  type NotificationCenterQuery,
} from "./notification-center-query";
import { isUuid } from "./uuid";

export {
  buildNotificationCenterHref,
  formatTimestamp,
  NOTIFICATION_DELIVERY_STATES,
  notificationDeliveryStateBadge,
  notificationDeliveryStateLabel,
  notificationSeverityBadge,
  parseNotificationCenterSearchParams,
};
export type { NotificationCenterQuery };

export interface NotificationCenterListResult {
  readonly items: readonly Notification[];
  /** Same "request one row past the chosen page size" technique `getDecisionAndActivityLogEvents()`
   *  uses — `GET /notifications` returns no total count to check against. */
  readonly hasNextPage: boolean;
}

/** Never degrades silently — this page's entire content IS the notification list, so a fetch
 *  failure must surface as a real error state (propagates to the nearest `error.tsx`), matching
 *  every sibling module's own list-fetch precedent. */
export async function getNotifications(
  query: NotificationCenterQuery,
): Promise<NotificationCenterListResult> {
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const params = new URLSearchParams();
  if (query.deliveryState) params.set("deliveryState", query.deliveryState);
  if (query.projectId && isUuid(query.projectId)) params.set("projectId", query.projectId);
  if (query.notificationType) params.set("notificationType", query.notificationType);
  params.set("limit", String(query.pageSize + 1));
  params.set("offset", String(query.offset));

  const response = await fetch(`${apiBaseUrl}/notifications?${params.toString()}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Failed to load notifications (status ${response.status})`);
  }
  const body = (await response.json()) as ApiSuccessResponse<readonly Notification[]>;
  return {
    items: body.data.slice(0, query.pageSize),
    hasNextPage: body.data.length > query.pageSize,
  };
}

/** Returns `null` on a malformed id or a 404, matching every sibling module's `getX(id)` degrade
 *  contract — the detail page turns that into `notFound()` rather than crashing. */
export async function getNotification(notificationId: string): Promise<Notification | null> {
  if (!isUuid(notificationId)) {
    return null;
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const response = await fetch(`${apiBaseUrl}/notifications/${notificationId}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load notification (status ${response.status})`);
  }
  const body = (await response.json()) as ApiSuccessResponse<Notification>;
  return body.data;
}
