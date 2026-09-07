import type { WebhookEvent } from "@webdesk/shared-types";
import { StatusBadge } from "@webdesk/ui";
import { formatTimestamp } from "@/lib/format-timestamp";
import { webhookProcessingStatusBadge } from "@/lib/integrations-query";
import styles from "./integration-subresource-section.module.css";

export interface IntegrationWebhookEventsSectionProps {
  readonly webhookEvents: readonly WebhookEvent[];
}

/**
 * **Read-only** — no create/update/delete UI, per this module's own `dashboard-web` UI scope
 * (`docs/implementation/module-integrations.md`'s `## dashboard-web UI` `### Scope`). The backend's
 * own organization-wide bare `POST /webhook-events` route (for an event arriving before it can be
 * matched to a known integration) is deliberately NOT exposed as a form here — it's a
 * receiver-shaped endpoint with no real receiver wired up yet, and fabricating a manual "log a fake
 * webhook" form adds a control surface the design doesn't call for; this is a deliberate, flagged
 * scope reduction, not an oversight. `webhook_events` has no update/delete route at all in the
 * backend either — genuinely immutable once created.
 *
 * Not a `"use client"` component — plain server-rendered rows, no interactivity needed.
 */
export function IntegrationWebhookEventsSection({
  webhookEvents,
}: IntegrationWebhookEventsSectionProps) {
  if (webhookEvents.length === 0) {
    return <p className={styles.muted}>No webhook events recorded yet.</p>;
  }

  return (
    <ul className={styles.list}>
      {webhookEvents.map((event) => {
        const badge = webhookProcessingStatusBadge(event.processingStatus);
        return (
          <li key={event.id} className={styles.row}>
            <span className={styles.rowMain}>
              <span className={styles.primaryText}>{event.eventType}</span>
              <span className={styles.secondaryText}>
                Received {formatTimestamp(event.receivedAt)}
              </span>
              {event.payloadSummary ? (
                <span className={styles.secondaryText}>{event.payloadSummary}</span>
              ) : null}
              {event.errorMessage ? (
                <span className={styles.secondaryText}>Error: {event.errorMessage}</span>
              ) : null}
            </span>
            <span className={styles.rowActions}>
              <StatusBadge status={badge.token} label={badge.label} />
            </span>
          </li>
        );
      })}
    </ul>
  );
}
