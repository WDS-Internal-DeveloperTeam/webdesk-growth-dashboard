import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeConnection, getConnection } from "../src/connection.js";
import { buildMigrator } from "../src/migrate.js";

/**
 * Regression test for a real bug an independent code review found in
 * migration `00019-expand-audit-events.ts`: its four backfill `UPDATE`
 * statements used to unconditionally hit migration `00018`'s
 * `audit_events_immutable` trigger, which blocks every `UPDATE` with no
 * escape hatch — so this migration could never succeed once `audit_events`
 * already had rows, which is exactly production's real state (the
 * audit-foundation slice has been writing to it since it merged). Every
 * other test in this suite runs migrations `up()` from an empty database,
 * so `00018` and `00019` always execute back-to-back with zero pre-existing
 * rows and the bug never manifested in CI. This test reproduces the real
 * production scenario directly: migrate only to `00018`, insert a row the
 * way a pre-existing production row would look, then run `00019` and
 * confirm it both succeeds and correctly backfills that row — and that
 * immutability is still enforced afterward.
 */
describe("Phase 1E audit_events migration 00019 (real disposable database, pre-existing-row scenario)", () => {
  beforeAll(async () => {
    const migrator = buildMigrator();
    await migrator.up({ to: "00018-create-audit-events" });
  });

  afterAll(async () => {
    const migrator = buildMigrator();
    await migrator.down({ to: 0 });
    await closeConnection();
  });

  it("backfills a pre-existing row without hitting the immutability trigger, then still enforces immutability afterward", async () => {
    const sequelize = getConnection();
    const preExistingId = randomUUID();

    // Simulates a real row written before migration 00019 ever ran, using
    // only the migration-00018 column set (no event_category/
    // source_application/environment/confidentiality_classification yet).
    await sequelize.query(
      `INSERT INTO audit_events
         (id, event_type, actor_type, entity_type, entity_id, action, retention_category, created_at)
       VALUES
         (:id, 'permission_change', 'human', 'user', :entityId, 'role_assigned', 'approval-audit-7y', now());`,
      { replacements: { id: preExistingId, entityId: randomUUID() } },
    );

    const migrator = buildMigrator();
    // The actual bug under test: this used to throw
    // "audit_events rows are immutable (ADR-0017)" here.
    await expect(migrator.up({ to: "00019-expand-audit-events" })).resolves.not.toThrow();

    const [[backfilled]] = (await sequelize.query(
      `SELECT event_category, source_application, environment, confidentiality_classification
         FROM audit_events WHERE id = :id;`,
      { replacements: { id: preExistingId } },
    )) as [Array<Record<string, string>>, unknown];
    expect(backfilled).toMatchObject({
      event_category: "access_control",
      source_application: "dashboard-api",
      environment: "production",
      confidentiality_classification: "internal",
    });

    // The trigger must be re-enabled, not left disabled by the backfill's own workaround.
    await expect(
      sequelize.query(`UPDATE audit_events SET action = 'tampered' WHERE id = :id;`, {
        replacements: { id: preExistingId },
      }),
    ).rejects.toThrow(/immutable/);
  });
});
