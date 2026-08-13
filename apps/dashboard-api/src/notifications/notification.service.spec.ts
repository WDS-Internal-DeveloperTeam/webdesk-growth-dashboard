import type { NotificationEntity, NotificationRepository } from "@webdesk/database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  NotificationDeliveryAdapter,
  NotificationDeliveryOutcome,
} from "./delivery-adapter.js";
import { UnconfiguredNotificationDeliveryAdapter } from "./delivery-adapter.js";
import { NotificationService } from "./notification.service.js";

const NOW = new Date("2026-08-13T00:00:00.000Z");

function baseNotification(overrides: Partial<NotificationEntity> = {}): NotificationEntity {
  return {
    id: "notif-1",
    notificationType: "framework_probe",
    severity: "medium",
    operationalArea: null,
    projectId: null,
    recipientUserId: null,
    recipientContactId: null,
    subject: "Test notification",
    bodyReference: null,
    deliveryState: "queued",
    attemptCount: 0,
    lastAttemptAt: null,
    failureSummary: null,
    retryEligible: true,
    correlationId: null,
    relatedEntityType: null,
    relatedEntityId: null,
    retentionCategory: null,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

/** A test-only fake — production wiring only ever uses `UnconfiguredNotificationDeliveryAdapter`. Lets these tests prove the state machine handles every real outcome. */
class FakeDeliveryAdapter implements NotificationDeliveryAdapter {
  constructor(private readonly outcome: NotificationDeliveryOutcome) {}
  async deliver(): Promise<NotificationDeliveryOutcome> {
    return Promise.resolve(this.outcome);
  }
}

describe("NotificationService", () => {
  let notifications: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    notifications = { create: vi.fn(), findById: vi.fn(), update: vi.fn(), list: vi.fn() };
  });

  function buildService(adapter: NotificationDeliveryAdapter): NotificationService {
    return new NotificationService(notifications as unknown as NotificationRepository, adapter);
  }

  describe("create", () => {
    it("creates a queued notification", async () => {
      notifications.create.mockResolvedValue(baseNotification());
      const service = buildService(new UnconfiguredNotificationDeliveryAdapter());
      const result = await service.create({
        notificationType: "framework_probe",
        severity: "medium",
        subject: "Test notification",
      });
      expect(result.deliveryState).toBe("queued");
    });
  });

  describe("attemptDelivery with the real production adapter", () => {
    it("never falsely marks a notification as delivered — UnconfiguredNotificationDeliveryAdapter always ends in retrying/permanently_failed", async () => {
      notifications.findById.mockResolvedValue(baseNotification({ deliveryState: "queued" }));
      notifications.update.mockResolvedValue(baseNotification({ deliveryState: "retrying" }));

      const service = buildService(new UnconfiguredNotificationDeliveryAdapter());
      const result = await service.attemptDelivery("notif-1");

      expect(result.deliveryState).not.toBe("accepted");
      expect(result.deliveryState).not.toBe("sent_to_smtp");
      expect(notifications.update).toHaveBeenCalledWith(
        "notif-1",
        expect.objectContaining({ deliveryState: "retrying", retryEligible: true }),
        "queued",
      );
    });

    it("rejects attempting delivery on a notification that isn't queued or retrying", async () => {
      notifications.findById.mockResolvedValue(baseNotification({ deliveryState: "accepted" }));
      await expect(
        buildService(new UnconfiguredNotificationDeliveryAdapter()).attemptDelivery("notif-1"),
      ).rejects.toThrow(/cannot attempt delivery/);
    });
  });

  describe("attemptDelivery outcome handling (fake adapter)", () => {
    it("moves to accepted on a real acceptance", async () => {
      notifications.findById.mockResolvedValue(baseNotification());
      notifications.update.mockResolvedValue(baseNotification({ deliveryState: "accepted" }));

      const service = buildService(new FakeDeliveryAdapter({ kind: "accepted" }));
      const result = await service.attemptDelivery("notif-1");

      expect(notifications.update).toHaveBeenCalledWith(
        "notif-1",
        expect.objectContaining({ deliveryState: "accepted", retryEligible: false }),
        "queued",
      );
      expect(result.deliveryState).toBe("accepted");
    });

    it("moves to sent_to_smtp on a two-phase handoff outcome, with retryEligible explicitly false", async () => {
      notifications.findById.mockResolvedValue(baseNotification());
      notifications.update.mockResolvedValue(baseNotification({ deliveryState: "sent_to_smtp" }));

      const service = buildService(new FakeDeliveryAdapter({ kind: "sent_to_smtp" }));
      await service.attemptDelivery("notif-1");

      expect(notifications.update).toHaveBeenCalledWith(
        "notif-1",
        expect.objectContaining({ deliveryState: "sent_to_smtp", retryEligible: false }),
        "queued",
      );
    });

    it("retries on a retryable rejection with attempts remaining", async () => {
      notifications.findById.mockResolvedValue(baseNotification({ attemptCount: 1 }));
      notifications.update.mockResolvedValue(baseNotification({ deliveryState: "retrying" }));

      const service = buildService(
        new FakeDeliveryAdapter({ kind: "rejected_retryable", failureSummary: "timeout" }),
      );
      await service.attemptDelivery("notif-1");

      expect(notifications.update).toHaveBeenCalledWith(
        "notif-1",
        expect.objectContaining({ deliveryState: "retrying", retryEligible: true }),
        "queued",
      );
    });

    it("permanently fails once retryable attempts are exhausted", async () => {
      notifications.findById.mockResolvedValue(baseNotification({ attemptCount: 4 }));
      notifications.update.mockResolvedValue(
        baseNotification({ deliveryState: "permanently_failed" }),
      );

      const service = buildService(
        new FakeDeliveryAdapter({ kind: "rejected_retryable", failureSummary: "timeout" }),
      );
      await service.attemptDelivery("notif-1");

      expect(notifications.update).toHaveBeenCalledWith(
        "notif-1",
        expect.objectContaining({ deliveryState: "permanently_failed", retryEligible: false }),
        "queued",
      );
    });

    it("permanently fails immediately on a permanent rejection, regardless of attempts remaining", async () => {
      notifications.findById.mockResolvedValue(baseNotification({ attemptCount: 0 }));
      notifications.update.mockResolvedValue(
        baseNotification({ deliveryState: "permanently_failed" }),
      );

      const service = buildService(
        new FakeDeliveryAdapter({ kind: "rejected_permanent", failureSummary: "invalid address" }),
      );
      await service.attemptDelivery("notif-1");

      expect(notifications.update).toHaveBeenCalledWith(
        "notif-1",
        expect.objectContaining({ deliveryState: "permanently_failed" }),
        "queued",
      );
    });

    it("rejects with a conflict, not an unhandled error, when a concurrent transition already changed the state", async () => {
      notifications.findById.mockResolvedValue(baseNotification({ deliveryState: "queued" }));
      notifications.update.mockResolvedValue(null);

      const service = buildService(new UnconfiguredNotificationDeliveryAdapter());
      await expect(service.attemptDelivery("notif-1")).rejects.toThrow(/concurrent transition/);
    });
  });

  describe("confirmAccepted / confirmRejected", () => {
    it("confirms acceptance only from sent_to_smtp", async () => {
      notifications.findById.mockResolvedValue(baseNotification({ deliveryState: "sent_to_smtp" }));
      notifications.update.mockResolvedValue(baseNotification({ deliveryState: "accepted" }));

      const service = buildService(new UnconfiguredNotificationDeliveryAdapter());
      await service.confirmAccepted("notif-1");

      expect(notifications.update).toHaveBeenCalledWith(
        "notif-1",
        expect.objectContaining({ deliveryState: "accepted" }),
        "sent_to_smtp",
      );
    });

    it("rejects confirming acceptance from a state other than sent_to_smtp", async () => {
      notifications.findById.mockResolvedValue(baseNotification({ deliveryState: "queued" }));
      await expect(
        buildService(new UnconfiguredNotificationDeliveryAdapter()).confirmAccepted("notif-1"),
      ).rejects.toThrow(/cannot be confirmed accepted/);
    });

    it("confirms a permanent rejection from sent_to_smtp", async () => {
      notifications.findById.mockResolvedValue(baseNotification({ deliveryState: "sent_to_smtp" }));
      notifications.update.mockResolvedValue(
        baseNotification({ deliveryState: "permanently_failed" }),
      );

      const service = buildService(new UnconfiguredNotificationDeliveryAdapter());
      await service.confirmRejected("notif-1", { permanent: true, failureSummary: "bounced" });

      expect(notifications.update).toHaveBeenCalledWith(
        "notif-1",
        expect.objectContaining({ deliveryState: "permanently_failed" }),
        "sent_to_smtp",
      );
    });

    it("does not increment attemptCount when confirming a retryable rejection — the attempt was already counted when it was sent to SMTP", async () => {
      notifications.findById.mockResolvedValue(
        baseNotification({ deliveryState: "sent_to_smtp", attemptCount: 1 }),
      );
      notifications.update.mockResolvedValue(baseNotification({ deliveryState: "retrying" }));

      const service = buildService(new UnconfiguredNotificationDeliveryAdapter());
      await service.confirmRejected("notif-1", { permanent: false, failureSummary: "deferred" });

      expect(notifications.update).toHaveBeenCalledWith(
        "notif-1",
        expect.objectContaining({ deliveryState: "retrying", attemptCount: 1 }),
        "sent_to_smtp",
      );
    });
  });

  describe("markFailed", () => {
    it("marks an in-flight notification as failed administratively", async () => {
      notifications.findById.mockResolvedValue(baseNotification({ deliveryState: "queued" }));
      notifications.update.mockResolvedValue(baseNotification({ deliveryState: "failed" }));

      const service = buildService(new UnconfiguredNotificationDeliveryAdapter());
      const result = await service.markFailed("notif-1", "operator cancelled");

      expect(notifications.update).toHaveBeenCalledWith(
        "notif-1",
        expect.objectContaining({
          deliveryState: "failed",
          retryEligible: false,
          failureSummary: "operator cancelled",
        }),
        "queued",
      );
      expect(result.deliveryState).toBe("failed");
    });

    it("rejects marking a terminal notification as failed", async () => {
      notifications.findById.mockResolvedValue(baseNotification({ deliveryState: "accepted" }));
      await expect(
        buildService(new UnconfiguredNotificationDeliveryAdapter()).markFailed("notif-1", "x"),
      ).rejects.toThrow(/cannot be marked failed/);
    });

    it("can force-fail a notification stuck in sent_to_smtp, the one administrative recovery path for that state", async () => {
      notifications.findById.mockResolvedValue(baseNotification({ deliveryState: "sent_to_smtp" }));
      notifications.update.mockResolvedValue(baseNotification({ deliveryState: "failed" }));

      const service = buildService(new UnconfiguredNotificationDeliveryAdapter());
      const result = await service.markFailed("notif-1", "confirmation never arrived");

      expect(notifications.update).toHaveBeenCalledWith(
        "notif-1",
        expect.objectContaining({ deliveryState: "failed" }),
        "sent_to_smtp",
      );
      expect(result.deliveryState).toBe("failed");
    });
  });
});
