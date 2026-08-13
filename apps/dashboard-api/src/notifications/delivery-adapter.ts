import { Injectable } from "@nestjs/common";
import type { NotificationEntity } from "@webdesk/database";

/**
 * The delivery boundary itself (brief §16): "notification creation and
 * notification delivery are separate concerns... future SMTP
 * implementation must use the shared notification delivery adapter."
 * `NotificationService` never talks to an SMTP server directly — it only
 * ever calls `deliver()` on whichever adapter is DI-wired in.
 */
export type NotificationDeliveryOutcome =
  | { readonly kind: "sent_to_smtp" }
  | { readonly kind: "accepted" }
  | { readonly kind: "rejected_retryable"; readonly failureSummary: string }
  | { readonly kind: "rejected_permanent"; readonly failureSummary: string };

export interface NotificationDeliveryAdapter {
  deliver(notification: NotificationEntity): Promise<NotificationDeliveryOutcome>;
}

/**
 * The only production-wired adapter in this slice. Real SMTP delivery is
 * explicitly out of scope ("Do not connect SMTP yet unless expressly
 * authorized by a higher-precedence phase plan") — this adapter's entire
 * job is to be honest about that: it always reports a retryable rejection,
 * never `sent_to_smtp` or `accepted`. This is the literal mechanism behind
 * §15's "do not falsely mark a notification as delivered" — the one real
 * adapter in the system physically cannot claim delivery it never
 * attempted.
 */
@Injectable()
export class UnconfiguredNotificationDeliveryAdapter implements NotificationDeliveryAdapter {
  async deliver(): Promise<NotificationDeliveryOutcome> {
    return Promise.resolve({
      kind: "rejected_retryable",
      failureSummary:
        "No delivery adapter is configured — SMTP integration has not been authorized for this phase.",
    });
  }
}
