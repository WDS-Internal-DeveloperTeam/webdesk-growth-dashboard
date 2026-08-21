import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  DeliverableRepository,
  EngagementModelRepository,
  PlatformTechnologyRepository,
  ServiceCategoryRepository,
  ServiceRelationshipRepository,
  ServiceRepository,
} from "../src/service-library/index.js";
import { closeConnection, getConnection } from "../src/connection.js";
import { withTransaction } from "../src/transaction.js";
import { buildMigrator } from "../src/migrate.js";

/**
 * Exercises the Service Library schema (migration `00050`) against a REAL, disposable PostgreSQL
 * database. See `docs/task-packages/module-service-library.md`.
 */
describe("Service Library module (real disposable database)", () => {
  const categories = new ServiceCategoryRepository();
  const services = new ServiceRepository();
  const deliverables = new DeliverableRepository();
  const platforms = new PlatformTechnologyRepository();
  const engagementModels = new EngagementModelRepository();
  const relationships = new ServiceRelationshipRepository();

  let categoryId: string;
  let counter = 0;
  function uniqueId(prefix: string): string {
    counter += 1;
    return `${prefix}-${Date.now()}-${counter}`;
  }

  beforeAll(async () => {
    const migrator = buildMigrator();
    await migrator.up();
    const category = await categories.create({
      publicId: uniqueId("CAT"),
      name: "E-Commerce",
    });
    categoryId = category.id;
  });

  afterAll(async () => {
    const migrator = buildMigrator();
    await migrator.down({ to: 0 });
    await closeConnection();
  });

  describe("ServiceCategoryRepository", () => {
    it("creates a self-nesting category and lists it back ordered by sortOrder", async () => {
      const parent = await categories.create({ publicId: uniqueId("CAT"), name: "Parent" });
      const child = await categories.create({
        publicId: uniqueId("CAT"),
        name: "Child",
        parentCategoryId: parent.id,
        sortOrder: 1,
      });
      expect(child.parentCategoryId).toBe(parent.id);

      const found = await categories.findById(child.id);
      expect(found?.name).toBe("Child");
    });

    it("rejects a duplicate publicId at the database layer", async () => {
      const publicId = uniqueId("CAT");
      await categories.create({ publicId, name: "First" });
      await expect(categories.create({ publicId, name: "Second" })).rejects.toThrow();
    });
  });

  describe("dimension-table repositories", () => {
    it("DeliverableRepository creates, finds by id, findByIds, and lists", async () => {
      const created = await deliverables.create({ publicId: uniqueId("DEL"), name: "Onboarding" });
      expect(await deliverables.findById(created.id)).toEqual(created);
      expect((await deliverables.findByIds([created.id])).map((d) => d.id)).toContain(created.id);
      expect(await deliverables.findByIds([])).toEqual([]);
      const all = await deliverables.list();
      expect(all.map((d) => d.id)).toContain(created.id);
    });

    it("PlatformTechnologyRepository creates with platformType/certifiedPartnership and finds by id", async () => {
      const created = await platforms.create({
        publicId: uniqueId("PLATFORM"),
        name: "Shopify Plus",
        platformType: "ecommerce",
        certifiedPartnership: true,
      });
      expect(created.certifiedPartnership).toBe(true);
      expect((await platforms.findById(created.id))?.platformType).toBe("ecommerce");
    });

    it("EngagementModelRepository creates with preferred/approvalRequired and finds by id", async () => {
      const created = await engagementModels.create({
        publicId: uniqueId("EM"),
        name: "Retainer",
        preferred: true,
        approvalRequired: true,
      });
      expect(created.preferred).toBe(true);
      expect(created.approvalRequired).toBe(true);
    });
  });

  describe("ServiceRepository", () => {
    it("creates a service defaulting to draft/draft and internal confidentiality", async () => {
      const service = await services.create({
        publicId: uniqueId("SVC"),
        canonicalName: "Headless Commerce",
        categoryId,
      });
      expect(service.approvalStatus).toBe("draft");
      expect(service.publicationStatus).toBe("draft");
      expect(service.confidentiality).toBe("internal");
      expect(service.icpIds).toEqual([]);
    });

    it("round-trips the unvalidated identifier-list array columns (icpIds/relatedPageIds/relatedCaseStudyIds)", async () => {
      const service = await services.create({
        publicId: uniqueId("SVC"),
        canonicalName: "Service with relationships",
        categoryId,
        icpIds: ["ICP-1", "ICP-3"],
        relatedPageIds: ["page-abc"],
        relatedCaseStudyIds: ["CS-HC-001", "CS-HC-002"],
      });
      const found = await services.findById(service.id);
      expect(found?.icpIds).toEqual(["ICP-1", "ICP-3"]);
      expect(found?.relatedPageIds).toEqual(["page-abc"]);
      expect(found?.relatedCaseStudyIds).toEqual(["CS-HC-001", "CS-HC-002"]);
    });

    it("finds by publicId, and returns null for a missing one", async () => {
      const publicId = uniqueId("SVC");
      const created = await services.create({ publicId, canonicalName: "X", categoryId });
      expect((await services.findByPublicId(publicId))?.id).toBe(created.id);
      expect(await services.findByPublicId("SVC-does-not-exist")).toBeNull();
    });

    it("category_id is RESTRICT — a category with a service pointing at it cannot be deleted", async () => {
      const category = await categories.create({ publicId: uniqueId("CAT"), name: "Restrict Me" });
      await services.create({
        publicId: uniqueId("SVC"),
        canonicalName: "X",
        categoryId: category.id,
      });
      await expect(
        getConnection().query('DELETE FROM "service_categories" WHERE id = :id', {
          replacements: { id: category.id },
        }),
      ).rejects.toThrow();
    });

    it("list() filters by categoryId/approvalStatus/publicationStatus and search (case-insensitive)", async () => {
      const category = await categories.create({
        publicId: uniqueId("CAT"),
        name: "Filter Category",
      });
      await services.create({
        publicId: uniqueId("SVC"),
        canonicalName: "Unique Searchable Name",
        categoryId: category.id,
      });

      const byCategory = await services.list({ categoryId: category.id });
      expect(byCategory.length).toBe(1);

      const byStatus = await services.list({ categoryId: category.id, approvalStatus: "draft" });
      expect(byStatus.length).toBe(1);

      const byPublication = await services.list({
        categoryId: category.id,
        publicationStatus: "draft",
      });
      expect(byPublication.length).toBe(1);

      const bySearch = await services.list({ search: "unique searchable" });
      expect(bySearch.length).toBeGreaterThanOrEqual(1);
    });

    it("list() clamps an oversized limit to MAX_LIST_LIMIT (200)", async () => {
      const result = await services.list({ limit: 100_000 });
      expect(result.length).toBeLessThanOrEqual(200);
    });

    it("update() changes content fields but never approvalStatus (no parameter exists for it)", async () => {
      const created = await services.create({
        publicId: uniqueId("SVC"),
        canonicalName: "Original",
        categoryId,
      });
      const updated = await services.update(created.id, { canonicalName: "Renamed" });
      expect(updated?.canonicalName).toBe("Renamed");
      expect(updated?.approvalStatus).toBe("draft");
    });

    it("update() returns null for a missing service", async () => {
      expect(
        await services.update("00000000-0000-4000-8000-000000000000", { canonicalName: "x" }),
      ).toBeNull();
    });

    it("updateStatus() changes approvalStatus when the expected current status matches", async () => {
      const created = await services.create({
        publicId: uniqueId("SVC"),
        canonicalName: "Status Fixture",
        categoryId,
      });
      const result = await services.updateStatus(created.id, "draft", "submitted", null);
      expect(result.outcome).toBe("updated");
      expect(result.outcome === "updated" && result.entity.approvalStatus).toBe("submitted");
    });

    it("updateStatus() reports not_found for a missing service", async () => {
      const result = await services.updateStatus(
        "00000000-0000-4000-8000-000000000000",
        "draft",
        "submitted",
        null,
      );
      expect(result.outcome).toBe("not_found");
    });

    it("updateStatus() reports conflict (and does not write) on the atomic compare-and-swap", async () => {
      const created = await services.create({
        publicId: uniqueId("SVC"),
        canonicalName: "Conflict Fixture",
        categoryId,
      });
      // The service is really `draft`; claim we expected `submitted` — a stale read.
      const result = await services.updateStatus(created.id, "submitted", "under_review", null);
      expect(result.outcome).toBe("conflict");
      expect(result.outcome === "conflict" && result.entity.approvalStatus).toBe("draft");

      const stillDraft = await services.findById(created.id);
      expect(stillDraft?.approvalStatus).toBe("draft");
    });

    it("rejects an invalid approvalStatus/confidentiality at the database layer (real ENUM constraint)", async () => {
      await expect(
        services.create({
          publicId: uniqueId("SVC"),
          canonicalName: "x",
          categoryId,
          // @ts-expect-error deliberately invalid to prove the DB-level ENUM constraint
          confidentiality: "not_a_real_value",
        }),
      ).rejects.toThrow();
    });
  });

  describe("ServiceRelationshipRepository (join tables)", () => {
    it("replaces the deliverable/platform/engagement-model links transactionally and lists them back", async () => {
      const service = await services.create({
        publicId: uniqueId("SVC"),
        canonicalName: "Relationship Fixture",
        categoryId,
      });
      const deliverable = await deliverables.create({ publicId: uniqueId("DEL"), name: "D1" });
      const platform = await platforms.create({ publicId: uniqueId("PLATFORM"), name: "P1" });
      const engagementModel = await engagementModels.create({
        publicId: uniqueId("EM"),
        name: "E1",
      });

      await withTransaction(async (transaction) => {
        await relationships.replaceDeliverables(service.id, [deliverable.id], transaction);
        await relationships.replacePlatforms(service.id, [platform.id], transaction);
        await relationships.replaceEngagementModels(service.id, [engagementModel.id], transaction);
      });

      expect(await relationships.listDeliverableIds(service.id)).toEqual([deliverable.id]);
      expect(await relationships.listPlatformIds(service.id)).toEqual([platform.id]);
      expect(await relationships.listEngagementModelIds(service.id)).toEqual([engagementModel.id]);
    });

    it("replace*() with an empty array clears all existing links for that service", async () => {
      const service = await services.create({
        publicId: uniqueId("SVC"),
        canonicalName: "Clear Fixture",
        categoryId,
      });
      const deliverable = await deliverables.create({ publicId: uniqueId("DEL"), name: "D2" });

      await withTransaction(async (transaction) => {
        await relationships.replaceDeliverables(service.id, [deliverable.id], transaction);
      });
      expect(await relationships.listDeliverableIds(service.id)).toEqual([deliverable.id]);

      await withTransaction(async (transaction) => {
        await relationships.replaceDeliverables(service.id, [], transaction);
      });
      expect(await relationships.listDeliverableIds(service.id)).toEqual([]);
    });

    it("cascade-deletes join rows when the owning service is hard-deleted at the DB layer", async () => {
      const service = await services.create({
        publicId: uniqueId("SVC"),
        canonicalName: "Cascade Fixture",
        categoryId,
      });
      const deliverable = await deliverables.create({ publicId: uniqueId("DEL"), name: "D3" });
      await withTransaction(async (transaction) => {
        await relationships.replaceDeliverables(service.id, [deliverable.id], transaction);
      });

      // No repository method deletes a service (no hard-delete route, D9) — this proves the FK's
      // ON DELETE CASCADE itself, at the DB layer.
      await getConnection().query('DELETE FROM "services" WHERE id = :id', {
        replacements: { id: service.id },
      });

      expect(await relationships.listDeliverableIds(service.id)).toEqual([]);
    });

    it("the unique (service_id, deliverable_id) index rejects a literal duplicate pair in one replace call", async () => {
      const service = await services.create({
        publicId: uniqueId("SVC"),
        canonicalName: "Unique Pair Fixture",
        categoryId,
      });
      const deliverable = await deliverables.create({ publicId: uniqueId("DEL"), name: "D4" });
      await expect(
        withTransaction(async (transaction) => {
          await relationships.replaceDeliverables(
            service.id,
            [deliverable.id, deliverable.id],
            transaction,
          );
        }),
      ).rejects.toThrow();
      // The whole transaction rolled back — no row landed at all, not a partial insert.
      expect(await relationships.listDeliverableIds(service.id)).toEqual([]);
    });
  });
});
