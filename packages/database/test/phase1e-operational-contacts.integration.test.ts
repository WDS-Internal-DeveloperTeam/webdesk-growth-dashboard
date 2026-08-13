import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  IncidentSeverityPolicyRepository,
  OperationalContactRepository,
} from "../src/operational-contacts/index.js";
import { UserRepository } from "../src/auth/index.js";
import { closeConnection, getConnection } from "../src/connection.js";
import { buildMigrator } from "../src/migrate.js";

/**
 * Exercises the Phase 1E operational-contacts schema (migrations
 * `00019`/`00020`/`00021`) against a REAL, disposable PostgreSQL database —
 * including the seeded 4-severity policy data and the
 * `operational_contacts_identity_required` CHECK constraint, neither of
 * which a mocked repository test can prove.
 */
describe("Phase 1E operational contacts (real disposable database)", () => {
  const contacts = new OperationalContactRepository();
  const severityPolicies = new IncidentSeverityPolicyRepository();
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

  describe("OperationalContactRepository", () => {
    it("creates a contact backed by a real user", async () => {
      const user = await users.create({
        email: `contact-${randomUUID()}@webdesksolution.com`,
        displayName: "Contact Test",
      });
      const contact = await contacts.create({
        contactUserId: user.id,
        area: "devops",
        role: "primary",
        escalationPriority: 1,
      });
      expect(contact.contactUserId).toBe(user.id);
      expect(contact.activeStatus).toBe(true);
      expect(contact.verificationStatus).toBe("unverified");
    });

    it("creates a contact backed by raw contact details, no user", async () => {
      const contact = await contacts.create({
        contactName: "External Vendor",
        contactEmail: "vendor@example.com",
        area: "backups",
        role: "backup",
        escalationPriority: 2,
      });
      expect(contact.contactUserId).toBeNull();
      expect(contact.contactName).toBe("External Vendor");
    });

    it("rejects a contact with neither a user nor a name at the database layer", async () => {
      const sequelize = getConnection();
      await expect(
        sequelize.query(
          `INSERT INTO operational_contacts
             (id, area, role, escalation_priority, effective_start_date, created_at, updated_at)
           VALUES (:id, 'devops', 'primary', 1, now(), now(), now());`,
          { replacements: { id: randomUUID() } },
        ),
      ).rejects.toThrow(/operational_contacts_identity_required/);
    });

    it("updates a contact", async () => {
      const contact = await contacts.create({
        contactName: "Update Test",
        area: "security",
        role: "primary",
        escalationPriority: 1,
      });
      const updated = await contacts.update(contact.id, {
        escalationPriority: 5,
        activeStatus: false,
      });
      expect(updated?.escalationPriority).toBe(5);
      expect(updated?.activeStatus).toBe(false);
    });

    it("findActiveForArea excludes inactive contacts", async () => {
      const area = `area-${randomUUID()}`;
      const active = await contacts.create({
        contactName: "Active",
        area,
        role: "primary",
        escalationPriority: 1,
      });
      const inactive = await contacts.create({
        contactName: "Inactive",
        area,
        role: "backup",
        escalationPriority: 2,
      });
      await contacts.update(inactive.id, { activeStatus: false });

      const found = await contacts.findActiveForArea(area);
      expect(found.map((c) => c.id)).toEqual([active.id]);
    });
  });

  describe("IncidentSeverityPolicyRepository", () => {
    it("seeds all 4 approved severities", async () => {
      const all = await severityPolicies.listAll();
      expect(all).toHaveLength(4);
    });

    it("finds the real approved critical response target", async () => {
      const policy = await severityPolicies.findBySeverity("critical");
      expect(policy?.responseTargetValue).toBe(15);
      expect(policy?.responseTargetUnit).toBe("minutes");
      expect(policy?.isFixedDuration).toBe(true);
    });

    it("finds the real approved low target as a non-fixed-duration policy", async () => {
      const policy = await severityPolicies.findBySeverity("low");
      expect(policy?.isFixedDuration).toBe(false);
      expect(policy?.responseTargetValue).toBeNull();
      expect(policy?.responseTargetDescription).toMatch(/scheduled maintenance/i);
    });
  });
});
