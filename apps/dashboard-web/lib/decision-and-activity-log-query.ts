import type { AuditEventType } from "@webdesk/shared-types";
import { DEFAULT_PAGE_SIZE, parsePageSize, type PageSize } from "./pagination";
import { firstValue } from "./search-params";

/**
 * `DecisionAndActivityLogQuery`/`parse.../build...`/labels live in their own file with zero
 * non-type imports, matching `lib/review-and-approval-center-query.ts`'s own precedent, even
 * though this module has no client component today — kept consistent so a future one (a
 * client-side filter widget, say) can import these directly without pulling in
 * `lib/decision-and-activity-log.ts`'s `next/headers` import.
 *
 * Mirrors `apps/dashboard-api/src/decision-and-activity-log/decision-and-activity-log.constants.ts`'s
 * `DECISION_AND_ACTIVITY_LOG_EVENT_TYPES` — kept in sync by hand, same approach every sibling
 * module's own `-query.ts` file uses for its own enum/allowlist.
 */
export const DECISION_AND_ACTIVITY_LOG_EVENT_TYPES: readonly AuditEventType[] = [
  "approval",
  "rejection",
  "revision_requested",
  "publish",
  "unpublish",
  "release",
  "rollback",
  "backup",
  "restore",
  "security_exception",
  "scan_run",
  "import_run",
  "export_run",
  "git_sync",
  "data_change",
  "project_status_changed",
];

export const DECISION_AND_ACTIVITY_LOG_EVENT_TYPE_LABEL: Readonly<Record<AuditEventType, string>> =
  {
    login: "Login",
    login_rejected: "Login rejected",
    logout: "Logout",
    session_revoked: "Session revoked",
    permission_change: "Permission change",
    confidential_field_access_change: "Confidential field access change",
    user_activation: "User activation",
    user_deactivation: "User deactivation",
    data_change: "Content decision",
    approval: "Approval",
    rejection: "Rejection",
    revision_requested: "Revision requested",
    publish: "Publish",
    unpublish: "Unpublish",
    release: "Release",
    rollback: "Rollback",
    backup: "Backup",
    restore: "Restore",
    retention_run: "Retention run",
    security_exception: "Security exception",
    scan_run: "Scan run",
    import_run: "Import run",
    export_run: "Export run",
    git_sync: "Git sync",
    webhook_processed: "Webhook processed",
    job_created: "Job created",
    job_completed: "Job completed",
    job_failed: "Job failed",
    job_retry_requested: "Job retry requested",
    job_cancellation_requested: "Job cancellation requested",
    retention_hold_created: "Retention hold created",
    retention_hold_released: "Retention hold released",
    notification_created: "Notification created",
    notification_delivery_outcome: "Notification delivery outcome",
    operational_contact_created: "Operational contact created",
    operational_contact_updated: "Operational contact updated",
    system_health_check_recorded: "System health check recorded",
    emergency_admin_login: "Emergency admin login",
    account_recovery_request: "Account recovery request",
    account_recovery_decision: "Account recovery decision",
    project_status_changed: "Project status changed",
  };

export function decisionAndActivityLogEventTypeLabel(eventType: AuditEventType): string {
  return DECISION_AND_ACTIVITY_LOG_EVENT_TYPE_LABEL[eventType] ?? eventType;
}

function isKnownEventType(value: string): value is AuditEventType {
  return (DECISION_AND_ACTIVITY_LOG_EVENT_TYPES as readonly string[]).includes(value);
}

export interface DecisionAndActivityLogQuery {
  readonly eventType: AuditEventType | null;
  readonly entityType: string | null;
  readonly entityId: string | null;
  readonly actorUserId: string | null;
  readonly projectId: string | null;
  readonly from: string | null;
  readonly to: string | null;
  readonly offset: number;
  readonly pageSize: PageSize;
}

const UUID_QUERY_VALUE_MAX_LENGTH = 128;

/**
 * The backend's own query schema (`listDecisionAndActivityLogEventsQuerySchema`) supports a
 * repeated `eventType` (an array), `projectId`/`actorUserId` as real UUIDs, and `from`/`to` as
 * full ISO-8601 datetimes. This UI deliberately narrows to a single `eventType` selection (the
 * same "smallest honest reading" every sibling list page's own filter form takes — no sibling
 * list page in this app offers a real multi-select filter widget yet) and a plain `<input
 * type="date">` for `from`/`to`, converted to a full UTC-midnight ISO datetime at request time
 * (`buildFromDateTime`/`buildToDateTime` in `lib/decision-and-activity-log.ts`) rather than at
 * parse time here, so the raw date string round-trips cleanly through the URL/form `defaultValue`
 * without a timezone-conversion lossy step in between.
 *
 * `projectId`/`actorUserId` are validated as UUID-shaped before being accepted — an invalid value
 * degrades to `null` (no filter applied) rather than round-tripping a garbled value to the
 * backend, which would otherwise reject the whole request with a 400 and blank the entire page.
 */
export function parseDecisionAndActivityLogSearchParams(
  raw: Record<string, string | string[] | undefined>,
): DecisionAndActivityLogQuery {
  const eventTypeRaw = firstValue(raw.eventType);
  const entityType = firstValue(raw.entityType);
  const entityId = firstValue(raw.entityId);
  const actorUserId = firstValue(raw.actorUserId);
  const projectId = firstValue(raw.projectId);
  const from = firstValue(raw.from);
  const to = firstValue(raw.to);
  const offsetRaw = firstValue(raw.offset);
  const offset = offsetRaw ? Number.parseInt(offsetRaw, 10) : 0;

  return {
    eventType: eventTypeRaw && isKnownEventType(eventTypeRaw) ? eventTypeRaw : null,
    entityType: entityType ? entityType.slice(0, 64) : null,
    entityId: entityId ? entityId.slice(0, 128) : null,
    actorUserId: actorUserId ? actorUserId.slice(0, UUID_QUERY_VALUE_MAX_LENGTH) : null,
    projectId: projectId ? projectId.slice(0, UUID_QUERY_VALUE_MAX_LENGTH) : null,
    from: from ? from.slice(0, 10) : null,
    to: to ? to.slice(0, 10) : null,
    offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
    pageSize: parsePageSize(firstValue(raw.pageSize)),
  };
}

/**
 * Builds a `/decision-and-activity-log?...` href — `overrides` wins over `current`, and changing
 * anything other than `offset` itself resets `offset` to 0, matching every sibling list page's
 * own `buildXHref` convention.
 */
export function buildDecisionAndActivityLogHref(
  current: DecisionAndActivityLogQuery,
  overrides: Partial<DecisionAndActivityLogQuery>,
): string {
  const next: DecisionAndActivityLogQuery = {
    ...current,
    ...overrides,
    offset: overrides.offset !== undefined ? overrides.offset : 0,
  };
  const params = new URLSearchParams();
  if (next.eventType) params.set("eventType", next.eventType);
  if (next.entityType) params.set("entityType", next.entityType);
  if (next.entityId) params.set("entityId", next.entityId);
  if (next.actorUserId) params.set("actorUserId", next.actorUserId);
  if (next.projectId) params.set("projectId", next.projectId);
  if (next.from) params.set("from", next.from);
  if (next.to) params.set("to", next.to);
  if (next.pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(next.pageSize));
  if (next.offset > 0) params.set("offset", String(next.offset));
  const queryString = params.toString();
  return queryString ? `/decision-and-activity-log?${queryString}` : "/decision-and-activity-log";
}
