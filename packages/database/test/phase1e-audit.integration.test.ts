import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AuditEventRepository } from "../src/audit/index.js";
import { UserRepository } from "../src/auth/index.js";
import { closeConnection, getConnection } from "../src/connection.js";
import { buildMigrator } from "../src/migrate.js";

/**
 * Exercises the ADR-0017 `audit_events` schema (migration 00018) against a
 * REAL, disposable PostgreSQL database — including the database-layer
 * immutability trigger itself, which no amount of mocking can prove.
 */
describe("Phase 1E audit foundation (real disposable database)", () => {
  const auditEvents = new AuditEventRepository();
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

  async function createEvent() {
    const user = await users.create({
      email: `audit-test-${randomUUID()}@webdesksolution.com`,
      displayName: "Audit Test",
    });
    return auditEvents.record({
      eventType: "permission_change",
      actorUserId: user.id,
      actorType: "human",
      entityType: "user",
      entityId: user.id,
      action: "role_assigned",
      retentionCategory: "approval-audit-7y",
    });
  }

  describe("AuditEventRepository", () => {
    it("records an event and finds it by entity", async () => {
      const event = await createEvent();

      const found = await auditEvents.findByEntity("user", event.entityId);
      expect(found.map((row) => row.id)).toContain(event.id);
      expect(found[0]?.retentionCategory).toBe("approval-audit-7y");
      expect(found[0]?.legalHold).toBe(false);
    });

    it("finds recent events by actor", async () => {
      const event = await createEvent();
      const found = await auditEvents.findRecentByActor(event.actorUserId!);
      expect(found.map((row) => row.id)).toContain(event.id);
    });
  });

  describe("database-level immutability (migration 00018's trigger)", () => {
    it("rejects a raw UPDATE unconditionally, even outside the repository", async () => {
      const event = await createEvent();
      const sequelize = getConnection();

      await expect(
        sequelize.query(`UPDATE audit_events SET reason = 'tampered' WHERE id = :id;`, {
          replacements: { id: event.id },
        }),
      ).rejects.toThrow(/immutable/);
    });

    it("rejects a raw DELETE with no retention authorization set", async () => {
      const event = await createEvent();
      const sequelize = getConnection();

      await expect(
        sequelize.query(`DELETE FROM audit_events WHERE id = :id;`, {
          replacements: { id: event.id },
        }),
      ).rejects.toThrow(/retention-deletion job/);
    });

    it("allows a DELETE only once audit.retention_delete_authorized is set for the transaction, and only when legal_hold is false", async () => {
      const event = await createEvent();
      const sequelize = getConnection();

      await sequelize.transaction(async (transaction) => {
        await sequelize.query(`SELECT set_config('audit.retention_delete_authorized', 'on', true);`, {
          transaction,
        });
        await sequelize.query(`DELETE FROM audit_events WHERE id = :id;`, {
          replacements: { id: event.id },
          transaction,
        });
      });

      const found = await auditEvents.findByEntity("user", event.entityId);
      expect(found.map((row) => row.id)).not.toContain(event.id);
    });

    it("still refuses to delete a legal-hold row even with retention authorization set", async () => {
      const user = await users.create({
        email: `audit-legal-hold-${randomUUID()}@webdesksolution.com`,
        displayName: "Audit Legal Hold Test",
      });
      const event = await auditEvents.record({
        eventType: "security_exception",
        actorUserId: user.id,
        actorType: "human",
        entityType: "user",
        entityId: user.id,
        action: "investigation",
        retentionCategory: "security-log-1y",
        legalHold: true,
        legalHoldReason: "active investigation",
      });
      const sequelize = getConnection();

      await expect(
        sequelize.transaction(async (transaction) => {
          await sequelize.query(
            `SELECT set_config('audit.retention_delete_authorized', 'on', true);`,
            { transaction },
          );
          await sequelize.query(`DELETE FROM audit_events WHERE id = :id;`, {
            replacements: { id: event.id },
            transaction,
          });
        }),
      ).rejects.toThrow(/legal hold/);
    });

    it("rejects an out-of-format git_commit_sha via the CHECK constraint", async () => {
      const user = await users.create({
        email: `audit-sha-${randomUUID()}@webdesksolution.com`,
        displayName: "Audit SHA Test",
      });
      await expect(
        auditEvents.record({
          eventType: "release",
          actorUserId: user.id,
          actorType: "human",
          entityType: "user",
          entityId: user.id,
          action: "deploy",
          gitCommitSha: "not-a-real-sha",
          retentionCategory: "audit-7y",
        }),
      ).rejects.toThrow();
    });
  });
});
