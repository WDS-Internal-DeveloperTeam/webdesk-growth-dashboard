import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NotificationRepository } from "../src/notifications/index.js";
import { UserRepository } from "../src/auth/index.js";
import { closeConnection, getConnection } from "../src/connection.js";
import { buildMigrator } from "../src/migrate.js";

/**
 * Exercises the Phase 1E notification-foundation schema (migration
 * `00019-create-notifications`) against a REAL, disposable PostgreSQL
 * database — including the `severity`/`delivery_state` ENUM constraints
 * and the real `recipient_user_id` FK, neither of which a mocked
 * repository test can prove.
 */
describe("Phase 1E notification foundation (real disposable database)", () => {
  const notifications = new NotificationRepository();
  const users = new UserRepository();

  beforeAll(async () => {
    const migrator = buildMigrator();
    await migrator.up();
  });

  afterAll(async () => {
    const migrator = buildMigrator();
    await migrator.down({ to: 0 });
    await closeConnection();
  });

  describe("NotificationRepository", () => {
    it("creates a queued notification with sensible defaults", async () => {
      const notification = await notifications.create({
        notificationType: "framework_probe",
        severity: "medium",
        subject: "Test notification",
      });
      expect(notification.deliveryState).toBe("queued");
      expect(notification.attemptCount).toBe(0);
      expect(notification.retryEligible).toBe(true);
    });

    it("round-trips a real recipient_user_id", async () => {
      const user = await users.create({
        email: `notif-recipient-${randomUUID()}@webdesksolution.com`,
        displayName: "Notification Recipient",
      });
      const notification = await notifications.create({
        notificationType: "framework_probe",
        severity: "low",
        subject: "Test notification",
        recipientUserId: user.id,
      });
      expect(notification.recipientUserId).toBe(user.id);
    });

    it("round-trips a polymorphic related_entity_type/related_entity_id", async () => {
      const relatedEntityId = randomUUID();
      const notification = await notifications.create({
        notificationType: "framework_probe",
        severity: "low",
        subject: "Test notification",
        relatedEntityType: "audit_event",
        relatedEntityId,
      });
      expect(notification.relatedEntityType).toBe("audit_event");
      expect(notification.relatedEntityId).toBe(relatedEntityId);
    });

    it("rejects an unrecognized severity at the database layer", async () => {
      await expect(
        notifications.create({
          notificationType: "framework_probe",
          // @ts-expect-error -- deliberately invalid for this test
          severity: "not-a-real-severity",
          subject: "Test notification",
        }),
      ).rejects.toThrow();
    });

    it("updates delivery state via a partial patch", async () => {
      const notification = await notifications.create({
        notificationType: "framework_probe",
        severity: "high",
        subject: "Test notification",
      });
      const updated = await notifications.update(notification.id, {
        deliveryState: "retrying",
        attemptCount: 1,
        retryEligible: true,
        failureSummary: "timeout",
      });
      expect(updated?.deliveryState).toBe("retrying");
      expect(updated?.attemptCount).toBe(1);
    });

    it("lists notifications filtered by delivery_state", async () => {
      const notificationType = `filter-test-${randomUUID()}`;
      const a = await notifications.create({
        notificationType,
        severity: "medium",
        subject: "A",
      });
      await notifications.update(a.id, { deliveryState: "accepted", retryEligible: false });
      const b = await notifications.create({
        notificationType,
        severity: "medium",
        subject: "B",
      });

      const accepted = await notifications.list({ notificationType, deliveryState: "accepted" });
      expect(accepted.map((n) => n.id)).toEqual([a.id]);
      const queued = await notifications.list({ notificationType, deliveryState: "queued" });
      expect(queued.map((n) => n.id)).toEqual([b.id]);
    });

    it("lets only one of two concurrent conditional updates win the same state transition", async () => {
      const notification = await notifications.create({
        notificationType: "framework_probe",
        severity: "medium",
        subject: "Concurrency test",
      });

      const [toAccepted, toFailed] = await Promise.all([
        notifications.update(
          notification.id,
          { deliveryState: "accepted", retryEligible: false },
          "queued",
        ),
        notifications.update(
          notification.id,
          { deliveryState: "failed", retryEligible: false, failureSummary: "lost the race" },
          "queued",
        ),
      ]);

      const winners = [toAccepted, toFailed].filter((result) => result !== null);
      expect(winners).toHaveLength(1);
      expect(["accepted", "failed"]).toContain(winners[0]?.deliveryState);

      const final = await notifications.findById(notification.id);
      expect(["accepted", "failed"]).toContain(final?.deliveryState);
    });
  });
});
