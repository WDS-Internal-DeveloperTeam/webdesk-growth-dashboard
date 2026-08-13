import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AuditEventRepository } from "../src/audit/index.js";
import { UserRepository } from "../src/auth/index.js";
import { closeConnection, getConnection } from "../src/connection.js";
import { buildMigrator } from "../src/migrate.js";
import {
  SystemComponentRepository,
  SystemEventRepository,
  SystemHealthCheckRepository,
} from "../src/system-operations/index.js";

const SEEDED_COMPONENT_KEYS = [
  "api",
  "database",
  "background_execution",
  "notification_delivery",
  "integrations",
  "storage",
  "github",
  "wordpress",
  "email",
  "queue_workflow_systems",
];

/**
 * Exercises the system-events-health schema (migrations 00020-00023)
 * against a REAL, disposable PostgreSQL database — the seeded component
 * catalog, the append-only health-check history, and the FK constraints
 * (system_health_checks.component_key RESTRICT, checked_by_user_id SET
 * NULL, system_events.related_audit_event_id SET NULL) that no amount of
 * mocking can prove.
 */
describe("Phase 1E system events & health (real disposable database)", () => {
  const events = new SystemEventRepository();
  const components = new SystemComponentRepository();
  const checks = new SystemHealthCheckRepository();
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

  describe("SystemComponentRepository", () => {
    it("has exactly the 10 approved, seeded components", async () => {
      const all = await components.listAll();
      expect(all.map((component) => component.key).sort()).toEqual(
        [...SEEDED_COMPONENT_KEYS].sort(),
      );
    });

    it("finds a single component by key", async () => {
      const found = await components.findByKey("database");
      expect(found?.displayName).toBe("Database");
    });

    it("returns null for an unknown key", async () => {
      const found = await components.findByKey("not-a-real-component");
      expect(found).toBeNull();
    });
  });

  describe("SystemHealthCheckRepository", () => {
    it("records a check and finds it as the most recent for that component", async () => {
      const check = await checks.record({ componentKey: "database", status: "healthy" });
      const mostRecent = await checks.findMostRecentForComponent("database");
      expect(mostRecent?.id).toBe(check.id);
      expect(mostRecent?.status).toBe("healthy");
    });

    it("resolves an empty history — and no most-recent check — for a component nothing has probed yet", async () => {
      const mostRecent = await checks.findMostRecentForComponent("wordpress");
      const history = await checks.findHistoryForComponent("wordpress");
      expect(mostRecent).toBeNull();
      expect(history).toEqual([]);
    });

    it("orders history most-recent-first", async () => {
      await checks.record({ componentKey: "github", status: "healthy" });
      await checks.record({ componentKey: "github", status: "degraded" });
      const history = await checks.findHistoryForComponent("github");
      expect(history[0]?.status).toBe("degraded");
    });

    it("rejects a check against an unknown component key (FK RESTRICT)", async () => {
      await expect(
        checks.record({ componentKey: "not-a-real-component", status: "healthy" }),
      ).rejects.toThrow();
    });

    it("nulls checked_by_user_id when the referenced user is later deleted (FK SET NULL)", async () => {
      const user = await users.create({
        email: `health-check-actor-${randomUUID()}@webdesksolution.com`,
        displayName: "Health Check Actor",
      });
      const check = await checks.record({
        componentKey: "storage",
        status: "healthy",
        checkedByUserId: user.id,
      });
      expect(check.checkedByUserId).toBe(user.id);

      const sequelize = getConnection();
      await sequelize.query(`DELETE FROM users WHERE id = :id;`, {
        replacements: { id: user.id },
      });

      const mostRecent = await checks.findMostRecentForComponent("storage");
      expect(mostRecent?.checkedByUserId).toBeNull();
    });
  });

  describe("SystemEventRepository", () => {
    it("records an activity event and finds it by id", async () => {
      const event = await events.record({
        eventType: "job_status_changed",
        category: "jobs",
        message: "Job transitioned to running",
      });
      const found = await events.findById(event.id);
      expect(found?.message).toBe("Job transitioned to running");
      expect(found?.relatedAuditEventId).toBeNull();
    });

    it("lists events filtered by eventType", async () => {
      await events.record({
        eventType: "integration_unavailable",
        message: "GitHub App unreachable",
      });
      const found = await events.list({ eventType: "integration_unavailable" });
      expect(found.every((row) => row.eventType === "integration_unavailable")).toBe(true);
      expect(found.length).toBeGreaterThan(0);
    });

    it("links to a real audit_events row via related_audit_event_id (real FK)", async () => {
      const user = await users.create({
        email: `system-event-actor-${randomUUID()}@webdesksolution.com`,
        displayName: "System Event Actor",
      });
      const auditEvent = await auditEvents.record({
        eventType: "security_exception",
        eventCategory: "security",
        actorUserId: user.id,
        actorType: "human",
        entityType: "system_component",
        entityId: "api",
        action: "record_check",
        sourceApplication: "dashboard-api",
        environment: "test",
        confidentialityClassification: "internal",
        retentionCategory: "security-log-1y",
      });

      const event = await events.record({
        eventType: "system_health_check_recorded",
        message: "Manual health check recorded",
        relatedAuditEventId: auditEvent.id,
      });
      expect(event.relatedAuditEventId).toBe(auditEvent.id);
    });

    it("rejects an event linked to a nonexistent audit_events row (FK integrity)", async () => {
      await expect(
        events.record({
          eventType: "system_health_check_recorded",
          message: "Should be rejected",
          relatedAuditEventId: randomUUID(),
        }),
      ).rejects.toThrow();
    });
  });
});
