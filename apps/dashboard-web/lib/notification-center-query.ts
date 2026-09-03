import type { NotificationDeliveryState, NotificationSeverity } from "@webdesk/shared-types";
import type { StatusToken } from "@webdesk/ui";
import { DEFAULT_PAGE_SIZE, parsePageSize, type PageSize } from "./pagination";
import { firstValue } from "./search-params";

/**
 * `NotificationCenterQuery`/`parse.../build...`/badge helpers live in their own file with zero
 * non-type imports, matching `lib/decision-and-activity-log-query.ts`'s own precedent, so a future
 * client component can import these directly without pulling in `lib/notification-center.ts`'s
 * `next/headers` import.
 */
export const NOTIFICATION_DELIVERY_STATES: readonly NotificationDeliveryState[] = [
  "queued",
  "sent_to_smtp",
  "accepted",
  "failed",
  "retrying",
  "permanently_failed",
];

export const NOTIFICATION_DELIVERY_STATE_LABEL: Readonly<
  Record<NotificationDeliveryState, string>
> = {
  queued: "Queued",
  sent_to_smtp: "Sent to SMTP",
  accepted: "Accepted",
  failed: "Failed",
  retrying: "Retrying",
  permanently_failed: "Permanently failed",
};

export function notificationDeliveryStateLabel(deliveryState: NotificationDeliveryState): string {
  return NOTIFICATION_DELIVERY_STATE_LABEL[deliveryState] ?? deliveryState;
}

function isKnownDeliveryState(value: string): value is NotificationDeliveryState {
  return (NOTIFICATION_DELIVERY_STATES as readonly string[]).includes(value);
}

/** Mirrors `SCAN_RUN_STATUS_BADGE`'s own `StatusToken`-keyed shape — `accepted` is the only real
 *  success state; `queued`/`sent_to_smtp` are in-flight (not yet resolved), and `failed`/
 *  `permanently_failed` are the two real failure states. */
const NOTIFICATION_DELIVERY_STATE_BADGE: Readonly<
  Record<NotificationDeliveryState, { token: StatusToken; label: string }>
> = {
  queued: { token: "notConfigured", label: "Queued" },
  sent_to_smtp: { token: "degraded", label: "Sent to SMTP" },
  accepted: { token: "healthy", label: "Accepted" },
  failed: { token: "unavailable", label: "Failed" },
  retrying: { token: "degraded", label: "Retrying" },
  permanently_failed: { token: "unavailable", label: "Permanently failed" },
};

export function notificationDeliveryStateBadge(deliveryState: NotificationDeliveryState): {
  readonly token: StatusToken;
  readonly label: string;
} {
  return NOTIFICATION_DELIVERY_STATE_BADGE[deliveryState];
}

const NOTIFICATION_SEVERITY_BADGE: Readonly<
  Record<NotificationSeverity, { token: StatusToken; label: string }>
> = {
  critical: { token: "unavailable", label: "Critical" },
  high: { token: "degraded", label: "High" },
  medium: { token: "notConfigured", label: "Medium" },
  low: { token: "unknown", label: "Low" },
};

export function notificationSeverityBadge(severity: NotificationSeverity): {
  readonly token: StatusToken;
  readonly label: string;
} {
  return NOTIFICATION_SEVERITY_BADGE[severity];
}

export interface NotificationCenterQuery {
  readonly deliveryState: NotificationDeliveryState | null;
  readonly projectId: string | null;
  readonly notificationType: string | null;
  readonly offset: number;
  readonly pageSize: PageSize;
}

const FILTER_VALUE_MAX_LENGTH = 128;

/**
 * `projectId` is validated as UUID-shaped before being accepted — an invalid value degrades to
 * `null` (no filter applied) rather than round-tripping a garbled value to the backend, which
 * would otherwise reject the whole request with a 400 and blank the entire page, matching
 * `parseDecisionAndActivityLogSearchParams()`'s own precedent.
 */
export function parseNotificationCenterSearchParams(
  raw: Record<string, string | string[] | undefined>,
): NotificationCenterQuery {
  const deliveryStateRaw = firstValue(raw.deliveryState);
  const projectId = firstValue(raw.projectId);
  const notificationType = firstValue(raw.notificationType);
  const offsetRaw = firstValue(raw.offset);
  const offset = offsetRaw ? Number.parseInt(offsetRaw, 10) : 0;

  return {
    deliveryState:
      deliveryStateRaw && isKnownDeliveryState(deliveryStateRaw) ? deliveryStateRaw : null,
    projectId: projectId ? projectId.slice(0, FILTER_VALUE_MAX_LENGTH) : null,
    notificationType: notificationType ? notificationType.slice(0, 64) : null,
    offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
    pageSize: parsePageSize(firstValue(raw.pageSize)),
  };
}

/**
 * Builds a `/notification-center?...` href — `overrides` wins over `current`, and changing
 * anything other than `offset` itself resets `offset` to 0, matching every sibling list page's own
 * `buildXHref` convention.
 */
export function buildNotificationCenterHref(
  current: NotificationCenterQuery,
  overrides: Partial<NotificationCenterQuery>,
): string {
  const next: NotificationCenterQuery = {
    ...current,
    ...overrides,
    offset: overrides.offset !== undefined ? overrides.offset : 0,
  };
  const params = new URLSearchParams();
  if (next.deliveryState) params.set("deliveryState", next.deliveryState);
  if (next.projectId) params.set("projectId", next.projectId);
  if (next.notificationType) params.set("notificationType", next.notificationType);
  if (next.pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(next.pageSize));
  if (next.offset > 0) params.set("offset", String(next.offset));
  const queryString = params.toString();
  return queryString ? `/notification-center?${queryString}` : "/notification-center";
}
