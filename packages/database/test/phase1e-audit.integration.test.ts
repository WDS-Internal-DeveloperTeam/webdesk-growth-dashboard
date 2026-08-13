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

  async function createEvent(overrides: Partial<Parameters<typeof auditEvents.record>[0]> = {}) {
    const user = await users.create({
      email: `audit-test-${randomUUID()}@webdesksolution.com`,
      displayName: "Audit Test",
    });
    return auditEvents.record({
      eventType: "permission_change",
      eventCategory: "access_control",
      actorUserId: user.id,
      actorType: "human",
      entityType: "user",
      entityId: user.id,
      action: "role_assigned",
      sourceApplication: "dashboard-api",
      environment: "test",
      confidentialityClassification: "internal",
      retentionCategory: "approval-audit-7y",
      ...overrides,
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

    it("rejects an unrecognized retention_category, even calling this repository directly — not only via AuditService", async () => {
      await expect(createEvent({ retentionCategory: "not-a-real-category" })).rejects.toThrow(
        /Unrecognized audit retention_category/,
      );
    });
  });

  describe("migration 00019 — expanded schema", () => {
    it("persists event_category, source_application, environment, and confidentiality_classification", async () => {
      const event = await createEvent({
        eventCategory: "access_control",
        sourceApplication: "dashboard-api",
        environment: "test",
        confidentialityClassification: "internal",
      });

      expect(event.eventCategory).toBe("access_control");
      expect(event.sourceApplication).toBe("dashboard-api");
      expect(event.environment).toBe("test");
      expect(event.confidentialityClassification).toBe("internal");
    });

    it("round-trips session_id, project_id, and correlation_id as null when not provided", async () => {
      const event = await createEvent();

      expect(event.sessionId).toBeNull();
      expect(event.projectId).toBeNull();
      expect(event.correlationId).toBeNull();
    });

    it("round-trips a real project_id and correlation_id when provided", async () => {
      const projectId = randomUUID();
      const correlationId = randomUUID();
      const event = await createEvent({ projectId, correlationId });

      expect(event.projectId).toBe(projectId);
      expect(event.correlationId).toBe(correlationId);
    });

    it("rejects a NULL event_category, source_application, environment, or confidentiality_classification at the database layer", async () => {
      const user = await users.create({
        email: `audit-notnull-${randomUUID()}@webdesksolution.com`,
        displayName: "Audit Not-Null Test",
      });
      const sequelize = getConnection();

      await expect(
        sequelize.query(
          `INSERT INTO audit_events
             (id, event_type, actor_user_id, actor_type, entity_type, entity_id, action,
              source_application, environment, confidentiality_classification, retention_category,
              created_at)
           VALUES
             (:id, 'permission_change', :actorUserId, 'human', 'user', :entityId, 'role_assigned',
              'dashboard-api', 'test', 'internal', 'approval-audit-7y', now());`,
          { replacements: { id: randomUUID(), actorUserId: user.id, entityId: user.id } },
        ),
      ).rejects.toThrow(/event_category/);
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
        await sequelize.query(
          `SELECT set_config('audit.retention_delete_authorized', 'on', true);`,
          {
            transaction,
          },
        );
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
        eventCategory: "security",
        actorUserId: user.id,
        actorType: "human",
        entityType: "user",
        entityId: user.id,
        action: "investigation",
        sourceApplication: "dashboard-api",
        environment: "test",
        confidentialityClassification: "internal",
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
          eventCategory: "content_lifecycle",
          actorUserId: user.id,
          actorType: "human",
          entityType: "user",
          entityId: user.id,
          action: "deploy",
          gitCommitSha: "not-a-real-sha",
          sourceApplication: "dashboard-api",
          environment: "test",
          confidentialityClassification: "internal",
          retentionCategory: "audit-7y",
        }),
      ).rejects.toThrow();
    });
  });
});
