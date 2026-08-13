import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { RetentionHoldRepository, RetentionPolicyRepository } from "../src/retention/index.js";
import { UserRepository } from "../src/auth/index.js";
import { closeConnection, getConnection } from "../src/connection.js";
import { buildMigrator } from "../src/migrate.js";

/**
 * Exercises the Phase 1E retention-architecture schema (migrations
 * `00019`/`00020`/`00021`) against a REAL, disposable PostgreSQL database —
 * including the seeded 25-category policy data and the `retention_holds`
 * scope-shape CHECK constraint, neither of which a mocked repository test
 * can prove.
 */
describe("Phase 1E retention architecture (real disposable database)", () => {
  const policies = new RetentionPolicyRepository();
  const holds = new RetentionHoldRepository();
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

  describe("RetentionPolicyRepository", () => {
    it("seeds all 25 approved categories", async () => {
      const all = await policies.listAll();
      expect(all).toHaveLength(25);
    });

    it("finds the real approved 7-year audit retention value by category key", async () => {
      const policy = await policies.findByCategoryKey("audit-7y");
      expect(policy?.retentionValue).toBe(7);
      expect(policy?.retentionUnit).toBe("years");
    });

    it("finds the real approved 120-day failed-job retention value", async () => {
      const policy = await policies.findByCategoryKey("job-failed-120d");
      expect(policy?.retentionValue).toBe(120);
      expect(policy?.retentionUnit).toBe("days");
    });

    it("finds the real approved 30-day notification and soft-delete retention values", async () => {
      const notif = await policies.findByCategoryKey("notification-30d");
      const softDelete = await policies.findByCategoryKey("soft-delete-30d");
      expect(notif?.retentionValue).toBe(30);
      expect(softDelete?.retentionValue).toBe(30);
    });

    it("returns null for an unrecognized category", async () => {
      expect(await policies.findByCategoryKey("not-a-real-category")).toBeNull();
    });
  });

  describe("RetentionHoldRepository", () => {
    async function createUser() {
      return users.create({
        email: `retention-test-${randomUUID()}@webdesksolution.com`,
        displayName: "Retention Test",
      });
    }

    it("creates an entity-scoped hold and finds it as active for that resource", async () => {
      const user = await createUser();
      const resourceId = randomUUID();
      await holds.create({
        scope: "entity",
        resourceType: "jobs",
        resourceId,
        reasonCategory: "legal",
        reason: "litigation hold",
        createdByUserId: user.id,
      });

      const active = await holds.findActiveForResource("jobs", resourceId);
      expect(active).toHaveLength(1);
    });

    it("creates a category-scoped hold and finds it as active for that category", async () => {
      const user = await createUser();
      await holds.create({
        scope: "category",
        categoryKey: "job-failed-120d",
        reasonCategory: "investigation",
        reason: "ongoing investigation",
        createdByUserId: user.id,
      });

      const active = await holds.findActiveForCategory("job-failed-120d");
      expect(active.length).toBeGreaterThanOrEqual(1);
    });

    it("releasing a hold requires and stores a release reason, and it no longer counts as active", async () => {
      const user = await createUser();
      const resourceId = randomUUID();
      const hold = await holds.create({
        scope: "entity",
        resourceType: "jobs",
        resourceId,
        reasonCategory: "legal",
        reason: "litigation hold",
        createdByUserId: user.id,
      });

      const released = await holds.release(hold.id, {
        releaseReason: "litigation concluded",
        releasedByUserId: user.id,
      });
      expect(released?.status).toBe("released");
      expect(released?.releaseReason).toBe("litigation concluded");

      const active = await holds.findActiveForResource("jobs", resourceId);
      expect(active).toHaveLength(0);
    });

    it("rejects an entity-scoped hold missing resourceType/resourceId at the database layer", async () => {
      const user = await createUser();
      const sequelize = getConnection();
      await expect(
        sequelize.query(
          `INSERT INTO retention_holds
             (id, scope, reason_category, reason, created_by_user_id, status, start_date, created_at, updated_at)
           VALUES (:id, 'entity', 'legal', 'x', :userId, 'active', now(), now(), now());`,
          { replacements: { id: randomUUID(), userId: user.id } },
        ),
      ).rejects.toThrow(/retention_holds_scope_shape/);
    });
  });
});
