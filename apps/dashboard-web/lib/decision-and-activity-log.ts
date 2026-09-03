import { cookies } from "next/headers";
import type { ApiSuccessResponse, AuditEvent } from "@webdesk/shared-types";
import { getApiBaseUrl } from "./auth";
import { formatTimestamp } from "./format-timestamp";
import { isUuid } from "./uuid";
import {
  buildDecisionAndActivityLogHref,
  DECISION_AND_ACTIVITY_LOG_EVENT_TYPES,
  decisionAndActivityLogEventTypeLabel,
  parseDecisionAndActivityLogSearchParams,
  type DecisionAndActivityLogQuery,
} from "./decision-and-activity-log-query";

export {
  buildDecisionAndActivityLogHref,
  DECISION_AND_ACTIVITY_LOG_EVENT_TYPES,
  decisionAndActivityLogEventTypeLabel,
  formatTimestamp,
  parseDecisionAndActivityLogSearchParams,
};
export type { DecisionAndActivityLogQuery };

export interface DecisionAndActivityLogListResult {
  readonly items: readonly AuditEvent[];
  /** Same "request one row past the chosen page size" technique `getReviews()`/`getServices()`
   *  use — `GET /decision-and-activity-log/events` returns no total count to check against. */
  readonly hasNextPage: boolean;
}

/** A plain `<input type="date">` value (`YYYY-MM-DD`) converted to the UTC-midnight ISO-8601
 *  datetime the backend's own `from`/`to` schema fields require (`z.string().datetime()`). */
function toStartOfDayIso(date: string): string {
  return `${date}T00:00:00.000Z`;
}

/** Same as `toStartOfDayIso()`, but the END of the given day — an inclusive `to` filter should
 *  include events recorded any time on that date, not just at midnight. */
function toEndOfDayIso(date: string): string {
  return `${date}T23:59:59.999Z`;
}

/** Never degrades silently — this page's entire content IS the event list, so a fetch failure
 *  must surface as a real error state (propagates to the nearest `error.tsx`), matching every
 *  sibling module's own list-fetch precedent. */
export async function getDecisionAndActivityLogEvents(
  query: DecisionAndActivityLogQuery,
): Promise<DecisionAndActivityLogListResult> {
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const params = new URLSearchParams();
  if (query.eventType) params.set("eventType", query.eventType);
  if (query.entityType) params.set("entityType", query.entityType);
  if (query.entityId) params.set("entityId", query.entityId);
  if (query.actorUserId && isUuid(query.actorUserId)) {
    params.set("actorUserId", query.actorUserId);
  }
  if (query.projectId && isUuid(query.projectId)) {
    params.set("projectId", query.projectId);
  }
  if (query.from) params.set("from", toStartOfDayIso(query.from));
  if (query.to) params.set("to", toEndOfDayIso(query.to));
  params.set("limit", String(query.pageSize + 1));
  params.set("offset", String(query.offset));

  const response = await fetch(
    `${apiBaseUrl}/decision-and-activity-log/events?${params.toString()}`,
    {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to load decision and activity log events (status ${response.status})`);
  }
  const body = (await response.json()) as ApiSuccessResponse<readonly AuditEvent[]>;
  return {
    items: body.data.slice(0, query.pageSize),
    hasNextPage: body.data.length > query.pageSize,
  };
}
