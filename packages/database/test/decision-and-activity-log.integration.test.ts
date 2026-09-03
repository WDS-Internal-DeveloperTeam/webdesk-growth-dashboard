import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AuditEventRepository } from "../src/audit/index.js";
import { UserRepository } from "../src/auth/index.js";
import { closeConnection } from "../src/connection.js";
import { buildMigrator } from "../src/migrate.js";

/**
 * `AuditEventRepository.list()` — the Decision and Activity Log module's own query surface
 * (`docs/implementation/module-decision-and-activity-log.md`) — against a REAL, disposable
 * PostgreSQL database, including migration `00113`'s new `(event_type, created_at)` composite
 * index (existence checked directly, not just that queries still work without it).
 */
describe("AuditEventRepository.list() — Decision and Activity Log query surface (real disposable database)", () => {
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
      email: `dal-test-${randomUUID()}@webdesksolution.com`,
      displayName: "Decision and Activity Log Test",
    });
    return auditEvents.record({
      eventType: "approval",
      eventCategory: "approval",
      actorUserId: user.id,
      actorType: "human",
      entityType: "project",
      entityId: randomUUID(),
      action: "status_changed",
      sourceApplication: "dashboard-api",
      environment: "test",
      confidentialityClassification: "internal",
      retentionCategory: "approval-audit-7y",
      ...overrides,
    });
  }

  it("filters to only the requested eventTypes", async () => {
    const approval = await createEvent({ eventType: "approval", eventCategory: "approval" });
    const login = await createEvent({
      eventType: "login",
      eventCategory: "authentication",
      action: "login",
    });

    const found = await auditEvents.list({ eventTypes: ["approval"] });
    const ids = found.map((row) => row.id);
    expect(ids).toContain(approval.id);
    expect(ids).not.toContain(login.id);
  });

  it("filters by projectId when given", async () => {
    const projectId = randomUUID();
    const scoped = await createEvent({ eventType: "project_status_changed", projectId });
    const unscoped = await createEvent({ eventType: "project_status_changed" });

    const found = await auditEvents.list({
      eventTypes: ["project_status_changed"],
      projectId,
    });
    const ids = found.map((row) => row.id);
    expect(ids).toContain(scoped.id);
    expect(ids).not.toContain(unscoped.id);
  });

  it("filters by actorUserId when given", async () => {
    const event = await createEvent({ eventType: "rollback", eventCategory: "content_lifecycle" });
    const other = await createEvent({ eventType: "rollback", eventCategory: "content_lifecycle" });

    const found = await auditEvents.list({
      eventTypes: ["rollback"],
      actorUserId: event.actorUserId!,
    });
    const ids = found.map((row) => row.id);
    expect(ids).toContain(event.id);
    expect(ids).not.toContain(other.id);
  });

  it("filters by entityType and entityId when given", async () => {
    const entityId = randomUUID();
    const event = await createEvent({
      eventType: "backup",
      eventCategory: "operational",
      entityType: "system",
      entityId,
    });

    const found = await auditEvents.list({
      eventTypes: ["backup"],
      entityType: "system",
      entityId,
    });
    expect(found.map((row) => row.id)).toContain(event.id);
  });

  it("filters by a createdAfter/createdBefore date range", async () => {
    const event = await createEvent({ eventType: "scan_run", eventCategory: "operational" });
    const now = new Date();
    const past = new Date(now.getTime() - 60_000).toISOString();
    const future = new Date(now.getTime() + 60_000).toISOString();
    const wayInThePast = new Date(now.getTime() - 3_600_000).toISOString();
    const wayInThePastEnd = new Date(now.getTime() - 3_500_000).toISOString();

    const inRange = await auditEvents.list({
      eventTypes: ["scan_run"],
      createdAfter: past,
      createdBefore: future,
    });
    expect(inRange.map((row) => row.id)).toContain(event.id);

    const outOfRange = await auditEvents.list({
      eventTypes: ["scan_run"],
      createdAfter: wayInThePast,
      createdBefore: wayInThePastEnd,
    });
    expect(outOfRange.map((row) => row.id)).not.toContain(event.id);
  });

  it("orders newest-first and respects limit/offset pagination", async () => {
    const first = await createEvent({ eventType: "git_sync", eventCategory: "operational" });
    await new Promise((resolve) => setTimeout(resolve, 10));
    const second = await createEvent({ eventType: "git_sync", eventCategory: "operational" });

    const page1 = await auditEvents.list({ eventTypes: ["git_sync"], limit: 1, offset: 0 });
    expect(page1).toHaveLength(1);
    expect(page1[0]?.id).toBe(second.id);

    const page2 = await auditEvents.list({ eventTypes: ["git_sync"], limit: 1, offset: 1 });
    expect(page2[0]?.id).toBe(first.id);
  });

  it("clamps a limit above MAX_LIST_LIMIT (100) instead of rejecting it", async () => {
    await createEvent({ eventType: "security_exception", eventCategory: "security" });

    const found = await auditEvents.list({
      eventTypes: ["security_exception"],
      limit: 10_000,
    });
    expect(found.length).toBeLessThanOrEqual(100);
  });
});
