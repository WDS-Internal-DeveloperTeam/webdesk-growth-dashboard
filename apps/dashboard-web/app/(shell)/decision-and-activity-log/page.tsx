import Link from "next/link";
import type { AuditEvent } from "@webdesk/shared-types";
import { ContentContainer, EmptyState, PageHeader } from "@webdesk/ui";
import { PageSizeSelect } from "@/components/page-size-select";
import {
  filterSelectStyle as selectStyle,
  filterSubmitButtonStyle as submitButtonStyle,
} from "@/lib/list-filter-styles";
import { listTableCellStyle, listTableHeaderCellStyle } from "@/lib/list-table-styles";
import { buildHrefBySize } from "@/lib/pagination";
import {
  buildDecisionAndActivityLogHref,
  DECISION_AND_ACTIVITY_LOG_EVENT_TYPES,
  decisionAndActivityLogEventTypeLabel,
  formatTimestamp,
  getDecisionAndActivityLogEvents,
  parseDecisionAndActivityLogSearchParams,
} from "@/lib/decision-and-activity-log";
import { getServerSession } from "@/lib/server-session";
import { getUsersByIds } from "@/lib/users";

export const dynamic = "force-dynamic";

interface DecisionAndActivityLogListPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const filterLabelStyle = {
  fontSize: "0.75rem",
  color: "var(--webdesk-dashboard-color-foreground-muted)",
} as const;

/**
 * No approved wireframe/screen spec exists for this module — a read-only, human-friendly view
 * over `GET /decision-and-activity-log/events`, renders exactly the filters and fields that route
 * returns and supports (event type, project, actor, entity type/id, a from/to date range, and
 * offset pagination), matching every sibling module's own "smallest honest reading" precedent for
 * an unsourced screen. No detail page and no create/edit form exist for this module — it is a
 * pure read-only query surface over the existing, immutable `audit_events` table (no write path
 * exists anywhere in this module — `AuditService.record()` remains the sole writer, called from
 * other modules' own services).
 *
 * Each row's `before`/`after` state (when present) is shown via a `<details>`/`<summary>`
 * disclosure — zero client JS, matching Website Strategy Center's own version-history disclosure
 * precedent — rather than a dedicated detail page, since an audit event has no lifecycle of its
 * own to navigate to.
 */
export default async function DecisionAndActivityLogListPage({
  searchParams,
}: DecisionAndActivityLogListPageProps) {
  // The (shell) layout already redirects unauthenticated callers to sign-in before this page
  // renders — this defensive fallback avoids firing the list fetch in parallel with a redirect
  // that would just discard the result, matching every other page in this app.
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const query = parseDecisionAndActivityLogSearchParams(await searchParams);
  const { items: events, hasNextPage } = await getDecisionAndActivityLogEvents(query);

  const actorUserIds = [
    ...new Set(events.map((event) => event.actorUserId).filter((id): id is string => id !== null)),
  ];
  const actors = await getUsersByIds(actorUserIds);

  const hasFilters =
    query.eventType !== null ||
    query.entityType !== null ||
    query.entityId !== null ||
    query.actorUserId !== null ||
    query.projectId !== null ||
    query.from !== null ||
    query.to !== null;
  const isPastLastPage = events.length === 0 && query.offset > 0;

  return (
    <ContentContainer>
      <PageHeader title="Decision and Activity Log" />

      <p style={{ fontSize: "0.875rem", marginBottom: "1rem" }}>
        A read-only view of business decisions, approvals, rollback, backup/restore, scan, import/
        export, Git sync, and security-exception events recorded across this organization.
      </p>

      <form
        method="get"
        style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1.5rem" }}
      >
        {/* Preserves the reader's page-size choice across a filter submit — without this, a
            native GET form submission builds its target URL purely from this form's own named
            fields, silently resetting it back to the default. */}
        <input type="hidden" name="pageSize" value={query.pageSize} />
        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <span style={filterLabelStyle}>Event type</span>
          {/* `key` forces a remount whenever the underlying filter value changes, including back
              to "" on Clear filters — a Next.js <Link> soft-navigation otherwise re-renders this
              same DOM node in place, and an uncontrolled <select>'s defaultValue only takes effect
              on first mount. */}
          <select
            key={query.eventType ?? "all-event-types"}
            name="eventType"
            defaultValue={query.eventType ?? ""}
            style={selectStyle}
          >
            <option value="">All event types</option>
            {DECISION_AND_ACTIVITY_LOG_EVENT_TYPES.map((value) => (
              <option key={value} value={value}>
                {decisionAndActivityLogEventTypeLabel(value)}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <span style={filterLabelStyle}>Entity type</span>
          <input
            key={query.entityType ?? "no-entity-type"}
            type="text"
            name="entityType"
            defaultValue={query.entityType ?? ""}
            maxLength={64}
            style={selectStyle}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <span style={filterLabelStyle}>Entity id</span>
          <input
            key={query.entityId ?? "no-entity-id"}
            type="text"
            name="entityId"
            defaultValue={query.entityId ?? ""}
            maxLength={128}
            style={selectStyle}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <span style={filterLabelStyle}>Actor user id</span>
          <input
            key={query.actorUserId ?? "no-actor"}
            type="text"
            name="actorUserId"
            defaultValue={query.actorUserId ?? ""}
            maxLength={128}
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
        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <span style={filterLabelStyle}>From</span>
          <input
            key={query.from ?? "no-from"}
            type="date"
            name="from"
            defaultValue={query.from ?? ""}
            style={selectStyle}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <span style={filterLabelStyle}>To</span>
          <input
            key={query.to ?? "no-to"}
            type="date"
            name="to"
            defaultValue={query.to ?? ""}
            style={selectStyle}
          />
        </label>
        <button type="submit" style={submitButtonStyle}>
          Apply
        </button>
        {hasFilters ? (
          <Link
            href={buildDecisionAndActivityLogHref(query, {
              eventType: null,
              entityType: null,
              entityId: null,
              actorUserId: null,
              projectId: null,
              from: null,
              to: null,
            })}
            style={{ alignSelf: "flex-end", fontSize: "0.875rem", padding: "0.4rem 0" }}
          >
            Clear filters
          </Link>
        ) : null}
      </form>

      {events.length === 0 ? (
        <EmptyState
          title={
            isPastLastPage
              ? "No more events"
              : hasFilters
                ? "No events match your filters"
                : "No events recorded yet"
          }
          description={
            isPastLastPage
              ? "You've gone past the last page of results."
              : hasFilters
                ? "Try a different event type, entity, actor, project, or date range."
                : "Decision and activity events recorded for this organization will appear here."
          }
          action={
            isPastLastPage ? (
              <Link
                href={buildDecisionAndActivityLogHref(query, {
                  offset: Math.max(0, query.offset - query.pageSize),
                })}
                style={{ fontSize: "0.875rem" }}
              >
                Previous
              </Link>
            ) : hasFilters ? (
              <Link
                href={buildDecisionAndActivityLogHref(query, {
                  eventType: null,
                  entityType: null,
                  entityId: null,
                  actorUserId: null,
                  projectId: null,
                  from: null,
                  to: null,
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
                  <th style={listTableHeaderCellStyle}>Event</th>
                  <th style={listTableHeaderCellStyle}>Entity</th>
                  <th style={listTableHeaderCellStyle}>Actor</th>
                  <th style={listTableHeaderCellStyle}>Action</th>
                  <th style={listTableHeaderCellStyle}>Reason</th>
                  <th style={listTableHeaderCellStyle}>Recorded</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <EventRow
                    key={event.id}
                    event={event}
                    actorDisplayName={actorDisplayName(event, actors)}
                  />
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
              Showing {query.offset + 1}–{query.offset + events.length}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
              <PageSizeSelect
                value={query.pageSize}
                hrefBySize={buildHrefBySize((pageSize) =>
                  buildDecisionAndActivityLogHref(query, { pageSize }),
                )}
              />
              <div style={{ display: "flex", gap: "0.75rem" }}>
                {query.offset > 0 ? (
                  <Link
                    href={buildDecisionAndActivityLogHref(query, {
                      offset: Math.max(0, query.offset - query.pageSize),
                    })}
                  >
                    Previous
                  </Link>
                ) : null}
                {hasNextPage ? (
                  <Link
                    href={buildDecisionAndActivityLogHref(query, {
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

function actorDisplayName(
  event: AuditEvent,
  actors: ReadonlyMap<string, { readonly displayName: string }>,
): string {
  if (!event.actorUserId) {
    return event.actorType === "system" ? "System" : "Service account";
  }
  return actors.get(event.actorUserId)?.displayName ?? event.actorUserId;
}

function EventRow({
  event,
  actorDisplayName,
}: {
  readonly event: AuditEvent;
  readonly actorDisplayName: string;
}) {
  const hasState = event.beforeState !== null || event.afterState !== null;

  return (
    <tr>
      <td style={listTableCellStyle}>{decisionAndActivityLogEventTypeLabel(event.eventType)}</td>
      <td style={listTableCellStyle}>
        <div>{event.entityType}</div>
        <div
          style={{
            fontSize: "0.75rem",
            color: "var(--webdesk-dashboard-color-foreground-muted)",
          }}
        >
          {event.entityId.length > 12 ? `${event.entityId.slice(0, 12)}…` : event.entityId}
        </div>
      </td>
      <td
        style={{ ...listTableCellStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}
      >
        {actorDisplayName}
      </td>
      <td
        style={{ ...listTableCellStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}
      >
        {event.action}
      </td>
      <td
        style={{ ...listTableCellStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}
      >
        {event.reason ?? "—"}
        {hasState ? (
          <details style={{ marginTop: "0.25rem" }}>
            <summary style={{ cursor: "pointer", fontSize: "0.75rem" }}>Before/after</summary>
            <pre
              style={{
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontSize: "0.75rem",
                marginTop: "0.25rem",
              }}
            >
              {JSON.stringify({ before: event.beforeState, after: event.afterState }, null, 2)}
            </pre>
          </details>
        ) : null}
      </td>
      <td
        style={{ ...listTableCellStyle, color: "var(--webdesk-dashboard-color-foreground-muted)" }}
      >
        {formatTimestamp(event.createdAt)}
      </td>
    </tr>
  );
}
