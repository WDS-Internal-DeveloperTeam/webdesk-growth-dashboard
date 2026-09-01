import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  CaseStudyApprovalRepository,
  CaseStudyAssetRepository,
  CaseStudyConsentRepository,
  CaseStudyRepository,
} from "../src/case-study-studio/index.js";
import { closeConnection } from "../src/connection.js";
import { withTransaction } from "../src/transaction.js";
import { buildMigrator } from "../src/migrate.js";

/**
 * Exercises the Case Study Studio schema (migration `00091`) against a REAL, disposable
 * PostgreSQL database. Mirrors ../test/module-proof-and-claims-library.integration.test.ts's own
 * structure, plus real coverage for the `withTransaction()` pairing between `CaseStudyRepository
.updateStatus()` and `CaseStudyApprovalRepository.create()` (D7/D8), and the two additional child
 * tables (`case_study_assets`, `case_study_consents`).
 */
describe("Case Study Studio module (real disposable database)", () => {
  const caseStudies = new CaseStudyRepository();
  const caseStudyAssets = new CaseStudyAssetRepository();
  const caseStudyConsents = new CaseStudyConsentRepository();
  const caseStudyApprovals = new CaseStudyApprovalRepository();

  let counter = 0;
  function uniqueId(prefix: string): string {
    counter += 1;
    return `${prefix}-${Date.now()}-${counter}`;
  }

  beforeAll(async () => {
    const migrator = buildMigrator();
    await migrator.up();
  });

  afterAll(async () => {
    const migrator = buildMigrator();
    await migrator.down({ to: 0 });
    await closeConnection();
  });

  describe("CaseStudyRepository", () => {
    it("creates a case study defaulting to intake status, internal_only visibility, version 1, and empty arrays", async () => {
      const cs = await caseStudies.create({
        publicId: uniqueId("CS"),
        clientName: "Acme Corp",
        projectTitle: "Website Relaunch",
      });
      expect(cs.status).toBe("intake");
      expect(cs.visibility).toBe("internal_only");
      expect(cs.version).toBe(1);
      expect(cs.relatedServiceIds).toEqual([]);
      expect(cs.relatedClaimIds).toEqual([]);
      expect(cs.clientApprovalRequired).toBe(false);
      expect(cs.publishedAt).toBeNull();
      expect(cs.unpublishReason).toBeNull();
    });

    it("round-trips relatedServiceIds/relatedClaimIds array columns", async () => {
      const cs = await caseStudies.create({
        publicId: uniqueId("CS"),
        clientName: "Acme",
        projectTitle: "X",
        relatedServiceIds: ["SVC-1", "SVC-2"],
        relatedClaimIds: ["CLAIM-1"],
      });
      const found = await caseStudies.findById(cs.id);
      expect(found?.relatedServiceIds).toEqual(["SVC-1", "SVC-2"]);
      expect(found?.relatedClaimIds).toEqual(["CLAIM-1"]);
    });

    it("rejects a duplicate publicId at the database layer", async () => {
      const publicId = uniqueId("CS");
      await caseStudies.create({ publicId, clientName: "A", projectTitle: "First" });
      await expect(
        caseStudies.create({ publicId, clientName: "A", projectTitle: "Second" }),
      ).rejects.toThrow();
    });

    it("finds by publicId, and returns null for a missing one", async () => {
      const publicId = uniqueId("CS");
      const created = await caseStudies.create({ publicId, clientName: "A", projectTitle: "X" });
      expect((await caseStudies.findByPublicId(publicId))?.id).toBe(created.id);
      expect(await caseStudies.findByPublicId("CS-does-not-exist")).toBeNull();
    });

    it("findById returns null for a missing case study", async () => {
      expect(await caseStudies.findById("00000000-0000-4000-8000-000000000000")).toBeNull();
    });

    it("list() filters by status and search (case-insensitive, across clientName and projectTitle)", async () => {
      const uniqueClient = uniqueId("Unique Searchable Client");
      await caseStudies.create({
        publicId: uniqueId("CS"),
        clientName: uniqueClient,
        projectTitle: "X",
      });

      const byStatus = await caseStudies.list({ status: "intake" });
      expect(byStatus.length).toBeGreaterThanOrEqual(1);

      const bySearch = await caseStudies.list({ search: uniqueClient.toLowerCase() });
      expect(bySearch.length).toBe(1);
    });

    it("list() clamps an oversized limit to MAX_LIST_LIMIT (200)", async () => {
      const result = await caseStudies.list({ limit: 100_000 });
      expect(result.length).toBeLessThanOrEqual(200);
    });

    it("update() changes content fields, increments version, and never touches status", async () => {
      const created = await caseStudies.create({
        publicId: uniqueId("CS"),
        clientName: "A",
        projectTitle: "Original",
      });
      expect(created.version).toBe(1);

      const updated = await caseStudies.update(created.id, { projectTitle: "Renamed" });
      expect(updated?.projectTitle).toBe("Renamed");
      expect(updated?.status).toBe("intake");
      expect(updated?.version).toBe(2);
    });

    it("update() returns null for a missing case study", async () => {
      expect(
        await caseStudies.update("00000000-0000-4000-8000-000000000000", { projectTitle: "x" }),
      ).toBeNull();
    });

    it("update() normalizes an explicit null on an array field to an empty array, and leaves an omitted array field untouched", async () => {
      const created = await caseStudies.create({
        publicId: uniqueId("CS"),
        clientName: "A",
        projectTitle: "Array Clearing Fixture",
        relatedServiceIds: ["SVC-1"],
        relatedClaimIds: ["CLAIM-1"],
      });

      const updated = await caseStudies.update(created.id, { relatedServiceIds: null });
      expect(updated?.relatedServiceIds).toEqual([]);
      expect(updated?.relatedClaimIds).toEqual(["CLAIM-1"]);
    });

    it("round-trips embargoDate as a plain date string", async () => {
      const created = await caseStudies.create({
        publicId: uniqueId("CS"),
        clientName: "A",
        projectTitle: "Date Fixture",
        embargoDate: "2027-01-15",
      });
      expect(created.embargoDate).toBe("2027-01-15");
    });

    it("updateStatus() changes status when the expected current status matches", async () => {
      const created = await caseStudies.create({
        publicId: uniqueId("CS"),
        clientName: "A",
        projectTitle: "Status Fixture",
      });
      const result = await caseStudies.updateStatus(created.id, "intake", "upload", null);
      expect(result.outcome).toBe("updated");
      expect(result.outcome === "updated" && result.entity.status).toBe("upload");
    });

    it("updateStatus() reports not_found for a missing case study", async () => {
      const result = await caseStudies.updateStatus(
        "00000000-0000-4000-8000-000000000000",
        "intake",
        "upload",
        null,
      );
      expect(result.outcome).toBe("not_found");
    });

    it("updateStatus() reports conflict (and does not write) on the atomic compare-and-swap", async () => {
      const created = await caseStudies.create({
        publicId: uniqueId("CS"),
        clientName: "A",
        projectTitle: "Conflict Fixture",
      });
      // The case study is really `intake`; we claim we expected `upload` — a stale read.
      const result = await caseStudies.updateStatus(
        created.id,
        "upload",
        "completeness_review",
        null,
      );
      expect(result.outcome).toBe("conflict");
      expect(result.outcome === "conflict" && result.entity.status).toBe("intake");

      const stillIntake = await caseStudies.findById(created.id);
      expect(stillIntake?.status).toBe("intake");
    });

    it("updateStatus() sets publishedAt/unpublishReason via the extra columns in the same atomic write", async () => {
      const created = await caseStudies.create({
        publicId: uniqueId("CS"),
        clientName: "A",
        projectTitle: "Publish Fixture",
      });
      // Force to `scheduled` directly for the test's own convenience (no workflow enforcement at
      // the repository layer — that's the service layer's job).
      await caseStudies.updateStatus(created.id, "intake", "scheduled", null);

      const publishedAt = new Date("2027-02-01T00:00:00.000Z");
      const published = await caseStudies.updateStatus(created.id, "scheduled", "published", null, {
        publishedAt,
      });
      expect(published.outcome === "updated" && published.entity.publishedAt).toBe(
        publishedAt.toISOString(),
      );

      const unpublished = await caseStudies.updateStatus(
        created.id,
        "published",
        "unpublished",
        null,
        { unpublishReason: "Client requested pause" },
      );
      expect(unpublished.outcome === "updated" && unpublished.entity.unpublishReason).toBe(
        "Client requested pause",
      );
      // publishedAt is never overwritten once set (D5) — updateStatus() only sets it when the
      // caller explicitly passes `extra.publishedAt`, which the unpublish call above did not.
      expect(unpublished.outcome === "updated" && unpublished.entity.publishedAt).toBe(
        publishedAt.toISOString(),
      );
    });

    it("updateStatus() accepts and threads a real Sequelize transaction handle", async () => {
      const created = await caseStudies.create({
        publicId: uniqueId("CS"),
        clientName: "A",
        projectTitle: "Transaction Fixture",
      });

      const result = await withTransaction(async (transaction) => {
        return caseStudies.updateStatus(created.id, "intake", "upload", null, {}, transaction);
      });
      expect(result.outcome).toBe("updated");

      const found = await caseStudies.findById(created.id);
      expect(found?.status).toBe("upload");
    });

    it("rejects an invalid status at the database layer (real ENUM constraint)", async () => {
      const created = await caseStudies.create({
        publicId: uniqueId("CS"),
        clientName: "A",
        projectTitle: "y",
      });
      await expect(
        // @ts-expect-error deliberately invalid to prove the DB-level ENUM constraint
        caseStudies.updateStatus(created.id, "intake", "not_a_real_status", null),
      ).rejects.toThrow();
    });

    it("rejects an invalid visibility value at the database layer (real ENUM constraint)", async () => {
      await expect(
        caseStudies.create({
          publicId: uniqueId("CS"),
          clientName: "A",
          projectTitle: "z",
          // @ts-expect-error deliberately invalid to prove the DB-level ENUM constraint
          visibility: "not_a_real_value",
        }),
      ).rejects.toThrow();
    });
  });

  describe("CaseStudyAssetRepository (D3 — real join into assets, no DB-level FK)", () => {
    it("creates a link under a real case study and lists it back", async () => {
      const cs = await caseStudies.create({
        publicId: uniqueId("CS"),
        clientName: "A",
        projectTitle: "Parent",
      });
      const link = await caseStudyAssets.create({
        caseStudyId: cs.id,
        assetId: "00000000-0000-4000-8000-000000000001",
        role: "hero_screenshot",
        caption: "Homepage hero",
      });
      expect(link.caseStudyId).toBe(cs.id);

      const listed = await caseStudyAssets.listByCaseStudy(cs.id);
      expect(listed.map((a) => a.id)).toContain(link.id);
    });

    it("rejects a duplicate (caseStudyId, assetId) link at the database layer", async () => {
      const cs = await caseStudies.create({
        publicId: uniqueId("CS"),
        clientName: "A",
        projectTitle: "Dup Fixture",
      });
      const assetId = "00000000-0000-4000-8000-000000000002";
      await caseStudyAssets.create({ caseStudyId: cs.id, assetId, role: "logo" });
      await expect(
        caseStudyAssets.create({ caseStudyId: cs.id, assetId, role: "document" }),
      ).rejects.toThrow();
    });

    it("update() is scoped to caseStudyId — a link from a different case study is not found (IDOR)", async () => {
      const csA = await caseStudies.create({
        publicId: uniqueId("CS"),
        clientName: "A",
        projectTitle: "A",
      });
      const csB = await caseStudies.create({
        publicId: uniqueId("CS"),
        clientName: "B",
        projectTitle: "B",
      });
      const link = await caseStudyAssets.create({
        caseStudyId: csA.id,
        assetId: "00000000-0000-4000-8000-000000000003",
        role: "video",
      });

      const wrongScope = await caseStudyAssets.update(link.id, csB.id, { caption: "wrong" });
      expect(wrongScope).toBeNull();

      const correctScope = await caseStudyAssets.update(link.id, csA.id, { caption: "right" });
      expect(correctScope?.caption).toBe("right");
    });

    it("remove() is scoped to caseStudyId — a link from a different case study is not removed (IDOR)", async () => {
      const csA = await caseStudies.create({
        publicId: uniqueId("CS"),
        clientName: "A2",
        projectTitle: "A2",
      });
      const csB = await caseStudies.create({
        publicId: uniqueId("CS"),
        clientName: "B2",
        projectTitle: "B2",
      });
      const link = await caseStudyAssets.create({
        caseStudyId: csA.id,
        assetId: "00000000-0000-4000-8000-000000000004",
        role: "other",
      });

      const wrongScopeRemoved = await caseStudyAssets.remove(link.id, csB.id);
      expect(wrongScopeRemoved).toBe(false);
      expect(await caseStudyAssets.findById(link.id)).not.toBeNull();

      const correctScopeRemoved = await caseStudyAssets.remove(link.id, csA.id);
      expect(correctScopeRemoved).toBe(true);
      expect(await caseStudyAssets.findById(link.id)).toBeNull();
    });

    it("cascades: deleting a parent case_studies row also deletes its case_study_assets rows", async () => {
      const cs = await caseStudies.create({
        publicId: uniqueId("CS"),
        clientName: "A",
        projectTitle: "Cascade Parent",
      });
      const link = await caseStudyAssets.create({
        caseStudyId: cs.id,
        assetId: "00000000-0000-4000-8000-000000000005",
        role: "logo",
      });
      expect(await caseStudyAssets.findById(link.id)).not.toBeNull();

      const { getConnection } = await import("../src/connection.js");
      await getConnection().query("DELETE FROM case_studies WHERE id = :id", {
        replacements: { id: cs.id },
      });

      expect(await caseStudies.findById(cs.id)).toBeNull();
      expect(await caseStudyAssets.findById(link.id)).toBeNull();
    });
  });

  describe("CaseStudyConsentRepository", () => {
    it("creates a consent record under a real case study and lists it back", async () => {
      const cs = await caseStudies.create({
        publicId: uniqueId("CS"),
        clientName: "A",
        projectTitle: "Parent",
      });
      const consent = await caseStudyConsents.create({
        caseStudyId: cs.id,
        consentType: "client_publication",
        consentEvidenceReference: "https://example.com/signed-consent.pdf",
        grantedBy: "Jane Client",
        grantedAt: new Date("2027-01-01T00:00:00.000Z"),
      });
      expect(consent.caseStudyId).toBe(cs.id);
      expect(consent.grantedAt).toBe("2027-01-01T00:00:00.000Z");

      const listed = await caseStudyConsents.listByCaseStudy(cs.id);
      expect(listed.map((c) => c.id)).toContain(consent.id);
    });

    it("update() is scoped to caseStudyId — a consent from a different case study is not found (IDOR)", async () => {
      const csA = await caseStudies.create({
        publicId: uniqueId("CS"),
        clientName: "A3",
        projectTitle: "A3",
      });
      const csB = await caseStudies.create({
        publicId: uniqueId("CS"),
        clientName: "B3",
        projectTitle: "B3",
      });
      const consent = await caseStudyConsents.create({
        caseStudyId: csA.id,
        consentType: "testimonial",
      });

      const wrongScope = await caseStudyConsents.update(consent.id, csB.id, { notes: "wrong" });
      expect(wrongScope).toBeNull();

      const correctScope = await caseStudyConsents.update(consent.id, csA.id, { notes: "right" });
      expect(correctScope?.notes).toBe("right");
    });

    it("remove() is scoped to caseStudyId — a consent from a different case study is not removed (IDOR)", async () => {
      const csA = await caseStudies.create({
        publicId: uniqueId("CS"),
        clientName: "A4",
        projectTitle: "A4",
      });
      const csB = await caseStudies.create({
        publicId: uniqueId("CS"),
        clientName: "B4",
        projectTitle: "B4",
      });
      const consent = await caseStudyConsents.create({
        caseStudyId: csA.id,
        consentType: "logo_usage",
      });

      const wrongScopeRemoved = await caseStudyConsents.remove(consent.id, csB.id);
      expect(wrongScopeRemoved).toBe(false);
      expect(await caseStudyConsents.findById(consent.id)).not.toBeNull();

      const correctScopeRemoved = await caseStudyConsents.remove(consent.id, csA.id);
      expect(correctScopeRemoved).toBe(true);
      expect(await caseStudyConsents.findById(consent.id)).toBeNull();
    });

    it("cascades: deleting a parent case_studies row also deletes its case_study_consents rows", async () => {
      const cs = await caseStudies.create({
        publicId: uniqueId("CS"),
        clientName: "A",
        projectTitle: "Cascade Parent Consent",
      });
      const consent = await caseStudyConsents.create({
        caseStudyId: cs.id,
        consentType: "other",
      });
      expect(await caseStudyConsents.findById(consent.id)).not.toBeNull();

      const { getConnection } = await import("../src/connection.js");
      await getConnection().query("DELETE FROM case_studies WHERE id = :id", {
        replacements: { id: cs.id },
      });

      expect(await caseStudyConsents.findById(consent.id)).toBeNull();
    });
  });

  describe("CaseStudyApprovalRepository (append-only decision-history log)", () => {
    it("creates an approval record under a real case study and lists it back, most recent first", async () => {
      const cs = await caseStudies.create({
        publicId: uniqueId("CS"),
        clientName: "A",
        projectTitle: "Approvals Parent",
      });

      const first = await caseStudyApprovals.create({
        caseStudyId: cs.id,
        approvalType: "internal",
        decision: "revision_requested",
        decidedByUserId: null,
        decidedAt: new Date("2027-01-01T00:00:00.000Z"),
      });
      const second = await caseStudyApprovals.create({
        caseStudyId: cs.id,
        approvalType: "internal",
        decision: "approved",
        decidedByUserId: null,
        decidedAt: new Date("2027-01-02T00:00:00.000Z"),
      });

      const listed = await caseStudyApprovals.listByCaseStudy(cs.id);
      expect(listed.map((a) => a.id)).toEqual([second.id, first.id]);
    });

    it("commits atomically alongside a case_studies status write inside withTransaction()", async () => {
      const cs = await caseStudies.create({
        publicId: uniqueId("CS"),
        clientName: "A",
        projectTitle: "Transaction Approval Fixture",
      });
      await caseStudies.updateStatus(cs.id, "intake", "internal_approval", null);

      await withTransaction(async (transaction) => {
        const statusResult = await caseStudies.updateStatus(
          cs.id,
          "internal_approval",
          "scheduled",
          null,
          {},
          transaction,
        );
        expect(statusResult.outcome).toBe("updated");
        await caseStudyApprovals.create(
          {
            caseStudyId: cs.id,
            approvalType: "internal",
            decision: "approved",
            decidedByUserId: null,
          },
          transaction,
        );
      });

      const found = await caseStudies.findById(cs.id);
      expect(found?.status).toBe("scheduled");
      const approvals = await caseStudyApprovals.listByCaseStudy(cs.id);
      expect(approvals.length).toBe(1);
    });

    it("cascades: deleting a parent case_studies row also deletes its case_study_approvals rows", async () => {
      const cs = await caseStudies.create({
        publicId: uniqueId("CS"),
        clientName: "A",
        projectTitle: "Cascade Parent Approval",
      });
      const approval = await caseStudyApprovals.create({
        caseStudyId: cs.id,
        approvalType: "internal",
        decision: "approved",
        decidedByUserId: null,
      });

      const { getConnection } = await import("../src/connection.js");
      await getConnection().query("DELETE FROM case_studies WHERE id = :id", {
        replacements: { id: cs.id },
      });

      const listed = await caseStudyApprovals.listByCaseStudy(cs.id);
      expect(listed.find((a) => a.id === approval.id)).toBeUndefined();
    });
  });
});
