import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentContainer, Fact, PageHeader, StatusBadge } from "@webdesk/ui";
import { NotificationRetryAction } from "@/components/notification-retry-action";
import { dlStyle, h2Style, mutedStyle, sectionStyle } from "@/lib/detail-section-styles";
import {
  formatTimestamp,
  getNotification,
  notificationDeliveryStateBadge,
  notificationSeverityBadge,
} from "@/lib/notification-center";
import { getServerSession } from "@/lib/server-session";

export const dynamic = "force-dynamic";

interface NotificationDetailPageProps {
  readonly params: Promise<{ notificationId: string }>;
}

/**
 * No approved wireframe/screen-level spec exists for this module — sections mirror the backend's
 * own field grouping (Identity, Recipient, Delivery, Related record), the same "sections, not
 * client-side tabs" simplification every prior detail page in this app already establishes.
 *
 * `NotificationRetryAction` is the one mutation this page allows (`POST
 * /notifications/:id/attempt-delivery`) — it renders nothing once `deliveryState` is no longer
 * `queued`/`retrying` or `retryEligible` is false, matching every other status-actions component's
 * own self-hiding convention.
 */
export default async function NotificationDetailPage({ params }: NotificationDetailPageProps) {
  const session = await getServerSession();
  if (!session) {
    return null;
  }

  const { notificationId } = await params;
  const notification = await getNotification(notificationId);
  if (!notification) {
    notFound();
  }

  const severityBadge = notificationSeverityBadge(notification.severity);
  const deliveryBadge = notificationDeliveryStateBadge(notification.deliveryState);

  return (
    <ContentContainer>
      <PageHeader
        title={notification.subject}
        breadcrumbs={[
          { label: "Notification Center", href: "/notification-center" },
          { label: notification.subject },
        ]}
        linkComponent={Link}
        statusBadge={<StatusBadge status={deliveryBadge.token} label={deliveryBadge.label} />}
        contextActions={
          <NotificationRetryAction
            notificationId={notification.id}
            deliveryState={notification.deliveryState}
            retryEligible={notification.retryEligible}
          />
        }
      />

      <section style={sectionStyle}>
        <h2 style={h2Style}>Identity</h2>
        <dl style={dlStyle}>
          <Fact label="Notification type">{notification.notificationType}</Fact>
          <Fact label="Severity">
            <StatusBadge status={severityBadge.token} label={severityBadge.label} />
          </Fact>
          <Fact label="Operational area">{notification.operationalArea ?? "—"}</Fact>
          <Fact label="Project id">{notification.projectId ?? "—"}</Fact>
        </dl>
        {notification.bodyReference ? (
          <div style={{ marginTop: "0.75rem" }}>
            <span style={mutedStyle}>Body reference</span>
            <p style={{ whiteSpace: "pre-wrap", marginTop: "0.25rem" }}>
              {notification.bodyReference}
            </p>
          </div>
        ) : null}
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Recipient</h2>
        <dl style={dlStyle}>
          <Fact label="Recipient user id">{notification.recipientUserId ?? "—"}</Fact>
          <Fact label="Recipient contact id">{notification.recipientContactId ?? "—"}</Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Delivery</h2>
        <dl style={dlStyle}>
          <Fact label="Attempt count">{notification.attemptCount}</Fact>
          <Fact label="Retry eligible">{notification.retryEligible ? "Yes" : "No"}</Fact>
          <Fact label="Last attempt">
            {notification.lastAttemptAt
              ? formatTimestamp(notification.lastAttemptAt)
              : "Not attempted"}
          </Fact>
          <Fact label="Correlation id">{notification.correlationId ?? "—"}</Fact>
        </dl>
        {notification.failureSummary ? (
          <div style={{ marginTop: "0.75rem" }}>
            <span style={mutedStyle}>Failure summary</span>
            <p style={{ whiteSpace: "pre-wrap", marginTop: "0.25rem" }}>
              {notification.failureSummary}
            </p>
          </div>
        ) : null}
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Related record</h2>
        <dl style={dlStyle}>
          <Fact label="Related entity type">{notification.relatedEntityType ?? "—"}</Fact>
          <Fact label="Related entity id">{notification.relatedEntityId ?? "—"}</Fact>
          <Fact label="Retention category">{notification.retentionCategory ?? "—"}</Fact>
        </dl>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Status</h2>
        <dl style={dlStyle}>
          <Fact label="Created">{formatTimestamp(notification.createdAt)}</Fact>
          <Fact label="Updated">{formatTimestamp(notification.updatedAt)}</Fact>
        </dl>
      </section>
    </ContentContainer>
  );
}
