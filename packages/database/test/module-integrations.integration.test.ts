import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  IntegrationEnvironmentRepository,
  IntegrationRepository,
  SecretMetadataRepository,
  WebhookEventRepository,
} from "../src/integrations/index.js";
import { UserRepository } from "../src/auth/user.repository.js";
import { closeConnection } from "../src/connection.js";
import { buildMigrator } from "../src/migrate.js";

/**
 * Exercises the Integrations schema (migration `00120`) against a REAL, disposable PostgreSQL
 * database. Mirrors ../test/module-brand-library.integration.test.ts's/
 * ../test/module-scan-center.integration.test.ts's own structure — real create/read/update/delete
 * round trips, the unique-constraint race on `integrations.public_id`, the FK-existence
 * (`existsById`) check the app-layer sub-resource services rely on, and the compound
 * `(id, integrationId)` IDOR-prevention scoping on every sub-resource repository method.
 */
describe("Integrations module (real disposable database)", () => {
  const integrations = new IntegrationRepository();
  const environments = new IntegrationEnvironmentRepository();
  const events = new WebhookEventRepository();
  const secrets = new SecretMetadataRepository();
  const users = new UserRepository();

  let counter = 0;
  function uniqueId(prefix: string): string {
    counter += 1;
    return `${prefix}-${Date.now()}-${counter}`;
  }

  // A real `users` row — recordVerification() writes lastVerifiedByUserId through a real FK
  // constraint (integrations_last_verified_by_user_id_fkey), so a fabricated UUID would 500.
  let realActorId: string;

  beforeAll(async () => {
    const migrator = buildMigrator();
    await migrator.up();
    const actor = await users.create({
      email: `integrations-fixture-${Date.now()}@webdesksolution.com`,
      displayName: "Integrations Fixture Actor",
    });
    realActorId = actor.id;
  });

  afterAll(async () => {
    const migrator = buildMigrator();
    await migrator.down({ to: 0 });
    await closeConnection();
  });

  describe("IntegrationRepository", () => {
    it("creates an integration defaulting to not_configured status, active", async () => {
      const created = await integrations.create({
        publicId: uniqueId("INT"),
        provider: "github",
        displayName: "GitHub",
      });
      expect(created.status).toBe("not_configured");
      expect(created.isActive).toBe(true);
      expect(created.lastVerifiedAt).toBeNull();
      expect(created.lastVerificationResult).toBeNull();
    });

    it("round-trips every scalar content field", async () => {
      const created = await integrations.create({
        publicId: uniqueId("INT"),
        provider: "wordpress",
        displayName: "WordPress Staging",
        configReference: "Vercel env: dashboard-api / WORDPRESS_APP",
        notes: "Staging only, per client",
      });
      const found = await integrations.findById(created.id);
      expect(found?.configReference).toBe("Vercel env: dashboard-api / WORDPRESS_APP");
      expect(found?.notes).toBe("Staging only, per client");
    });

    it("rejects an invalid provider at the database layer (real ENUM constraint)", async () => {
      await expect(
        integrations.create({
          publicId: uniqueId("INT"),
          // @ts-expect-error deliberately invalid to prove the DB-level ENUM constraint
          provider: "not_a_real_provider",
          displayName: "X",
        }),
      ).rejects.toThrow();
    });

    it("rejects a duplicate publicId at the database layer", async () => {
      const publicId = uniqueId("INT");
      await integrations.create({ publicId, provider: "github", displayName: "First" });
      await expect(
        integrations.create({ publicId, provider: "github", displayName: "Second" }),
      ).rejects.toThrow();
    });

    it("finds by publicId, and returns null for a missing one", async () => {
      const publicId = uniqueId("INT");
      const created = await integrations.create({
        publicId,
        provider: "sentry",
        displayName: "X",
      });
      expect((await integrations.findByPublicId(publicId))?.id).toBe(created.id);
      expect(await integrations.findByPublicId("INT-does-not-exist")).toBeNull();
    });

    it("findById returns null for a missing integration", async () => {
      expect(await integrations.findById("00000000-0000-4000-8000-000000000000")).toBeNull();
    });

    it("existsById reflects reality — the exact narrow check the sub-resource services rely on", async () => {
      const created = await integrations.create({
        publicId: uniqueId("INT"),
        provider: "smtp",
        displayName: "X",
      });
      expect(await integrations.existsById(created.id)).toBe(true);
      expect(await integrations.existsById("00000000-0000-4000-8000-000000000000")).toBe(false);
    });

    it("list() filters by provider, status, isActive, and search (case-insensitive)", async () => {
      const uniqueName = uniqueId("Unique Searchable Name");
      await integrations.create({
        publicId: uniqueId("INT"),
        provider: "upstash",
        displayName: uniqueName,
      });

      const byProvider = await integrations.list({ provider: "upstash" });
      expect(byProvider.length).toBeGreaterThanOrEqual(1);

      const byStatus = await integrations.list({ status: "not_configured" });
      expect(byStatus.length).toBeGreaterThanOrEqual(1);

      const byActive = await integrations.list({ isActive: true });
      expect(byActive.length).toBeGreaterThanOrEqual(1);

      const bySearch = await integrations.list({ search: uniqueName.toLowerCase() });
      expect(bySearch.length).toBe(1);
    });

    it("list() search treats a literal % as literal text, not a SQL wildcard (escapeLikePattern)", async () => {
      const uniqueSuffix = uniqueId("PCT");
      const wildcardMatch = await integrations.create({
        publicId: uniqueId("INT"),
        provider: "other",
        displayName: `50% Off Integration ${uniqueSuffix}`,
      });
      const plainMatch = await integrations.create({
        publicId: uniqueId("INT"),
        provider: "other",
        displayName: `50X Off Integration ${uniqueSuffix}`,
      });

      const result = await integrations.list({ search: `50% Off Integration ${uniqueSuffix}` });
      const ids = result.map((r) => r.id);
      expect(ids).toContain(wildcardMatch.id);
      expect(ids).not.toContain(plainMatch.id);
    });

    it("list() clamps an oversized limit to MAX_LIST_LIMIT (200)", async () => {
      const result = await integrations.list({ limit: 100_000 });
      expect(result.length).toBeLessThanOrEqual(200);
    });

    it("update() changes content fields and never touches status/lastVerified*/isActive/publicId/provider", async () => {
      const created = await integrations.create({
        publicId: uniqueId("INT"),
        provider: "postgresql",
        displayName: "Original",
      });
      const updated = await integrations.update(created.id, { displayName: "Renamed" });
      expect(updated?.displayName).toBe("Renamed");
      expect(updated?.provider).toBe("postgresql");
      expect(updated?.status).toBe("not_configured");
      expect(updated?.isActive).toBe(true);
    });

    it("update() returns null for a missing integration", async () => {
      expect(
        await integrations.update("00000000-0000-4000-8000-000000000000", {
          displayName: "x",
        }),
      ).toBeNull();
    });

    it("update() stores an explicit null on a nullable text field directly, distinct from leaving it untouched", async () => {
      const created = await integrations.create({
        publicId: uniqueId("INT"),
        provider: "github",
        displayName: "Clearing Fixture",
        configReference: "Some ref",
        notes: "Some notes",
      });
      const updated = await integrations.update(created.id, { configReference: null });
      expect(updated?.configReference).toBeNull();
      expect(updated?.notes).toBe("Some notes");
    });

    it("recordVerification() stamps lastVerifiedAt/lastVerifiedByUserId/result/notes and sets status", async () => {
      const created = await integrations.create({
        publicId: uniqueId("INT"),
        provider: "sentry",
        displayName: "Verify Fixture",
      });
      const updated = await integrations.recordVerification(created.id, {
        status: "connected",
        result: "success",
        notes: "Manually verified via dashboard",
        verifiedByUserId: realActorId,
      });
      expect(updated?.status).toBe("connected");
      expect(updated?.lastVerificationResult).toBe("success");
      expect(updated?.lastVerificationNotes).toBe("Manually verified via dashboard");
      expect(updated?.lastVerifiedAt).not.toBeNull();
    });

    it("recordVerification() returns null for a missing integration", async () => {
      const result = await integrations.recordVerification("00000000-0000-4000-8000-000000000000", {
        status: "connected",
        result: "success",
        notes: null,
        verifiedByUserId: "11111111-1111-4111-8111-111111111111",
      });
      expect(result).toBeNull();
    });

    it("setActive() toggles isActive independently of status/content", async () => {
      const created = await integrations.create({
        publicId: uniqueId("INT"),
        provider: "github",
        displayName: "Active Fixture",
      });
      const deactivated = await integrations.setActive(created.id, false);
      expect(deactivated?.isActive).toBe(false);
      const reactivated = await integrations.setActive(created.id, true);
      expect(reactivated?.isActive).toBe(true);
    });

    it("setActive() returns null for a missing integration", async () => {
      expect(
        await integrations.setActive("00000000-0000-4000-8000-000000000000", false),
      ).toBeNull();
    });
  });

  describe("IntegrationEnvironmentRepository — real FK + IDOR-safe compound scoping", () => {
    it("creates and lists environments scoped to their parent integration", async () => {
      const parent = await integrations.create({
        publicId: uniqueId("INT"),
        provider: "github",
        displayName: "Env Parent",
      });
      await environments.create({ integrationId: parent.id, environmentName: "staging" });
      await environments.create({ integrationId: parent.id, environmentName: "production" });

      const list = await environments.listByIntegration(parent.id);
      expect(list).toHaveLength(2);
      expect(list.map((e) => e.environmentName)).toEqual(["production", "staging"]);
    });

    it("rejects a nonexistent integrationId at the database layer (real FK constraint)", async () => {
      await expect(
        environments.create({
          integrationId: "00000000-0000-4000-8000-000000000000",
          environmentName: "staging",
        }),
      ).rejects.toThrow();
    });

    it("findById/update/remove are IDOR-safe — scoped to (id, integrationId), not id alone", async () => {
      const integrationA = await integrations.create({
        publicId: uniqueId("INT"),
        provider: "github",
        displayName: "A",
      });
      const integrationB = await integrations.create({
        publicId: uniqueId("INT"),
        provider: "github",
        displayName: "B",
      });
      const envOfA = await environments.create({
        integrationId: integrationA.id,
        environmentName: "prod",
      });

      // A cross-integration lookup (env belongs to A, requested under B) must fail cleanly.
      expect(await environments.findById(envOfA.id, integrationB.id)).toBeNull();
      expect(await environments.findById(envOfA.id, integrationA.id)).not.toBeNull();

      expect(
        await environments.update(envOfA.id, integrationB.id, { environmentName: "hacked" }),
      ).toBeNull();
      const stillOriginal = await environments.findById(envOfA.id, integrationA.id);
      expect(stillOriginal?.environmentName).toBe("prod");

      expect(await environments.remove(envOfA.id, integrationB.id)).toBe(false);
      expect(await environments.remove(envOfA.id, integrationA.id)).toBe(true);
      expect(await environments.findById(envOfA.id, integrationA.id)).toBeNull();
    });

    it("cascade-deletes environments when the parent integration is removed", async () => {
      // Real cascade proof — deleting the parent integration row directly must remove its
      // environments too (onDelete: "CASCADE"), not just leave orphaned rows.
      const parent = await integrations.create({
        publicId: uniqueId("INT"),
        provider: "github",
        displayName: "Cascade Parent",
      });
      const env = await environments.create({
        integrationId: parent.id,
        environmentName: "staging",
      });

      const { getConnection } = await import("../src/connection.js");
      await getConnection().query('DELETE FROM "integrations" WHERE id = :id', {
        replacements: { id: parent.id },
      });

      expect(await environments.findById(env.id, parent.id)).toBeNull();
    });
  });

  describe("WebhookEventRepository — append-only, no update/delete", () => {
    it("creates an event with no integrationId (an unmatched delivery)", async () => {
      const created = await events.create({ eventType: "push" });
      expect(created.integrationId).toBeNull();
      expect(created.processingStatus).toBe("received");
    });

    it("SET NULLs integrationId when its parent integration is removed (not a cascade delete)", async () => {
      const parent = await integrations.create({
        publicId: uniqueId("INT"),
        provider: "github",
        displayName: "Webhook Parent",
      });
      const created = await events.create({ integrationId: parent.id, eventType: "push" });

      const { getConnection } = await import("../src/connection.js");
      await getConnection().query('DELETE FROM "integrations" WHERE id = :id', {
        replacements: { id: parent.id },
      });

      const found = await events.findById(created.id);
      expect(found).not.toBeNull();
      expect(found?.integrationId).toBeNull();
    });

    it("list() filters by integrationId and processingStatus", async () => {
      const parent = await integrations.create({
        publicId: uniqueId("INT"),
        provider: "github",
        displayName: "List Parent",
      });
      await events.create({
        integrationId: parent.id,
        eventType: "push",
        processingStatus: "processed",
      });
      await events.create({
        integrationId: parent.id,
        eventType: "ping",
        processingStatus: "failed",
      });

      const byIntegration = await events.list({ integrationId: parent.id });
      expect(byIntegration).toHaveLength(2);

      const byStatus = await events.list({
        integrationId: parent.id,
        processingStatus: "processed",
      });
      expect(byStatus).toHaveLength(1);
      expect(byStatus[0]?.eventType).toBe("push");
    });

    it("list() clamps an oversized limit to MAX_LIST_LIMIT (200)", async () => {
      const result = await events.list({ limit: 100_000 });
      expect(result.length).toBeLessThanOrEqual(200);
    });
  });

  describe("SecretMetadataRepository — real FK (CASCADE) + IDOR-safe compound scoping", () => {
    it("creates and lists secret metadata scoped to their parent integration", async () => {
      const parent = await integrations.create({
        publicId: uniqueId("INT"),
        provider: "github",
        displayName: "Secret Parent",
      });
      await secrets.create({
        integrationId: parent.id,
        secretName: "GITHUB_APP_PRIVATE_KEY",
        storageLocation: "Vercel env var",
      });

      const list = await secrets.listByIntegration(parent.id);
      expect(list).toHaveLength(1);
      expect(list[0]?.secretName).toBe("GITHUB_APP_PRIVATE_KEY");
    });

    it("rejects a nonexistent integrationId at the database layer (real FK constraint)", async () => {
      await expect(
        secrets.create({
          integrationId: "00000000-0000-4000-8000-000000000000",
          secretName: "X",
          storageLocation: "Y",
        }),
      ).rejects.toThrow();
    });

    it("findById/update/remove are IDOR-safe — scoped to (id, integrationId), not id alone", async () => {
      const integrationA = await integrations.create({
        publicId: uniqueId("INT"),
        provider: "github",
        displayName: "SecretA",
      });
      const integrationB = await integrations.create({
        publicId: uniqueId("INT"),
        provider: "github",
        displayName: "SecretB",
      });
      const secretOfA = await secrets.create({
        integrationId: integrationA.id,
        secretName: "X",
        storageLocation: "Y",
      });

      expect(await secrets.findById(secretOfA.id, integrationB.id)).toBeNull();
      expect(await secrets.findById(secretOfA.id, integrationA.id)).not.toBeNull();

      expect(
        await secrets.update(secretOfA.id, integrationB.id, { secretName: "hacked" }),
      ).toBeNull();

      expect(await secrets.remove(secretOfA.id, integrationB.id)).toBe(false);
      expect(await secrets.remove(secretOfA.id, integrationA.id)).toBe(true);
    });

    it("cascade-deletes secret metadata when the parent integration is removed", async () => {
      const parent = await integrations.create({
        publicId: uniqueId("INT"),
        provider: "github",
        displayName: "Secret Cascade Parent",
      });
      const secret = await secrets.create({
        integrationId: parent.id,
        secretName: "X",
        storageLocation: "Y",
      });

      const { getConnection } = await import("../src/connection.js");
      await getConnection().query('DELETE FROM "integrations" WHERE id = :id', {
        replacements: { id: parent.id },
      });

      expect(await secrets.findById(secret.id, parent.id)).toBeNull();
    });
  });
});
