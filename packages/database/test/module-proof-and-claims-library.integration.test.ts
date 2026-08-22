import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ClaimSourceRepository,
  ProofClaimRepository,
} from "../src/proof-and-claims-library/index.js";
import { closeConnection } from "../src/connection.js";
import { buildMigrator } from "../src/migrate.js";

/**
 * Exercises the Proof and Claims Library schema (migration `00054`) against a REAL, disposable
 * PostgreSQL database. Mirrors ../test/module-persona-library.integration.test.ts's own structure,
 * plus real coverage for the `claim_sources` child table and its cascade-delete-on-parent-removal
 * behavior, which Persona Library's single-table shape has no equivalent of.
 */
describe("Proof and Claims Library module (real disposable database)", () => {
  const claims = new ProofClaimRepository();
  const claimSources = new ClaimSourceRepository();

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

  describe("ProofClaimRepository", () => {
    it("creates a claim defaulting to draft approvalStatus, unverified verificationStatus, and empty arrays", async () => {
      const claim = await claims.create({
        publicId: uniqueId("PROOF"),
        claim: "99.9% uptime SLA",
      });
      expect(claim.approvalStatus).toBe("draft");
      expect(claim.verificationStatus).toBe("unverified");
      expect(claim.relatedServiceIds).toEqual([]);
      expect(claim.relatedCaseStudyIds).toEqual([]);
      expect(claim.relatedPageIds).toEqual([]);
    });

    it("round-trips relatedServiceIds/relatedCaseStudyIds/relatedPageIds array columns", async () => {
      const claim = await claims.create({
        publicId: uniqueId("PROOF"),
        claim: "Claim with relationships",
        relatedServiceIds: ["SVC-1", "SVC-2"],
        relatedCaseStudyIds: ["CASE-1"],
        relatedPageIds: ["PAGE-1", "PAGE-2"],
      });
      const found = await claims.findById(claim.id);
      expect(found?.relatedServiceIds).toEqual(["SVC-1", "SVC-2"]);
      expect(found?.relatedCaseStudyIds).toEqual(["CASE-1"]);
      expect(found?.relatedPageIds).toEqual(["PAGE-1", "PAGE-2"]);
    });

    it("rejects a duplicate publicId at the database layer", async () => {
      const publicId = uniqueId("PROOF");
      await claims.create({ publicId, claim: "First" });
      await expect(claims.create({ publicId, claim: "Second" })).rejects.toThrow();
    });

    it("finds by publicId, and returns null for a missing one", async () => {
      const publicId = uniqueId("PROOF");
      const created = await claims.create({ publicId, claim: "X" });
      expect((await claims.findByPublicId(publicId))?.id).toBe(created.id);
      expect(await claims.findByPublicId("PROOF-does-not-exist")).toBeNull();
    });

    it("findById returns null for a missing claim", async () => {
      expect(await claims.findById("00000000-0000-4000-8000-000000000000")).toBeNull();
    });

    it("list() filters by approvalStatus and search (case-insensitive)", async () => {
      const uniqueClaimText = uniqueId("Unique Searchable Claim");
      await claims.create({ publicId: uniqueId("PROOF"), claim: uniqueClaimText });

      const byStatus = await claims.list({ approvalStatus: "draft" });
      expect(byStatus.length).toBeGreaterThanOrEqual(1);

      const bySearch = await claims.list({ search: uniqueClaimText.toLowerCase() });
      expect(bySearch.length).toBe(1);
    });

    it("list() clamps an oversized limit to MAX_LIST_LIMIT (200)", async () => {
      const result = await claims.list({ limit: 100_000 });
      expect(result.length).toBeLessThanOrEqual(200);
    });

    it("update() changes content fields and never touches approvalStatus", async () => {
      const created = await claims.create({ publicId: uniqueId("PROOF"), claim: "Original" });

      const updated = await claims.update(created.id, { claim: "Renamed" });
      expect(updated?.claim).toBe("Renamed");
      expect(updated?.approvalStatus).toBe("draft");
    });

    it("update() returns null for a missing claim", async () => {
      expect(
        await claims.update("00000000-0000-4000-8000-000000000000", { claim: "x" }),
      ).toBeNull();
    });

    it("update() normalizes an explicit null on an array field to an empty array, and leaves an omitted array field untouched", async () => {
      const created = await claims.create({
        publicId: uniqueId("PROOF"),
        claim: "Array Clearing Fixture",
        relatedServiceIds: ["SVC-1"],
        relatedCaseStudyIds: ["CASE-1"],
      });

      const updated = await claims.update(created.id, { relatedServiceIds: null });
      expect(updated?.relatedServiceIds).toEqual([]);
      expect(updated?.relatedCaseStudyIds).toEqual(["CASE-1"]);
    });

    it("round-trips expiryReviewDate as a plain date string", async () => {
      const created = await claims.create({
        publicId: uniqueId("PROOF"),
        claim: "Date Fixture",
        expiryReviewDate: "2027-01-15",
      });
      expect(created.expiryReviewDate).toBe("2027-01-15");
    });

    it("updateStatus() changes approvalStatus when the expected current status matches", async () => {
      const created = await claims.create({ publicId: uniqueId("PROOF"), claim: "Status Fixture" });
      const result = await claims.updateStatus(created.id, "draft", "submitted", null);
      expect(result.outcome).toBe("updated");
      expect(result.outcome === "updated" && result.entity.approvalStatus).toBe("submitted");
    });

    it("updateStatus() reports not_found for a missing claim", async () => {
      const result = await claims.updateStatus(
        "00000000-0000-4000-8000-000000000000",
        "draft",
        "submitted",
        null,
      );
      expect(result.outcome).toBe("not_found");
    });

    it("updateStatus() reports conflict (and does not write) on the atomic compare-and-swap", async () => {
      const created = await claims.create({
        publicId: uniqueId("PROOF"),
        claim: "Conflict Fixture",
      });
      // The claim is really `draft`; claim we expected `submitted` — a stale read.
      const result = await claims.updateStatus(created.id, "submitted", "under_review", null);
      expect(result.outcome).toBe("conflict");
      expect(result.outcome === "conflict" && result.entity.approvalStatus).toBe("draft");

      const stillDraft = await claims.findById(created.id);
      expect(stillDraft?.approvalStatus).toBe("draft");
    });

    it("update() with concurrent-style repeated calls does not lose any write (real atomic UPDATEs)", async () => {
      const created = await claims.create({
        publicId: uniqueId("PROOF"),
        claim: "Concurrency Fixture",
      });

      await Promise.all([
        claims.update(created.id, { claimType: "A" }),
        claims.update(created.id, { beforeValue: "B" }),
        claims.update(created.id, { afterValue: "C" }),
      ]);

      const final = await claims.findById(created.id);
      expect(final?.claimType).toBe("A");
      expect(final?.beforeValue).toBe("B");
      expect(final?.afterValue).toBe("C");
    });

    it("rejects an invalid approvalStatus at the database layer (real ENUM constraint)", async () => {
      const created = await claims.create({ publicId: uniqueId("PROOF"), claim: "y" });
      await expect(
        // @ts-expect-error deliberately invalid to prove the DB-level ENUM constraint
        claims.updateStatus(created.id, "draft", "not_a_real_status", null),
      ).rejects.toThrow();
    });

    it("rejects an invalid verificationStatus at the database layer (real ENUM constraint)", async () => {
      await expect(
        claims.create({
          publicId: uniqueId("PROOF"),
          claim: "z",
          // @ts-expect-error deliberately invalid to prove the DB-level ENUM constraint
          verificationStatus: "not_a_real_status",
        }),
      ).rejects.toThrow();
    });
  });

  describe("ClaimSourceRepository", () => {
    it("creates a source under a real claim and lists it back", async () => {
      const claim = await claims.create({ publicId: uniqueId("PROOF"), claim: "Parent Claim" });
      const source = await claimSources.create({
        claimId: claim.id,
        source: "Third-party audit report, 2026",
        sourceUrl: "https://example.com/report.pdf",
      });
      expect(source.claimId).toBe(claim.id);

      const listed = await claimSources.listByClaim(claim.id);
      expect(listed.map((s) => s.id)).toContain(source.id);
    });

    it("findById returns null for a missing source", async () => {
      expect(await claimSources.findById("00000000-0000-4000-8000-000000000000")).toBeNull();
    });

    it("update() is scoped to claimId — a source from a different claim is not found (IDOR fix)", async () => {
      const claimA = await claims.create({ publicId: uniqueId("PROOF"), claim: "Claim A" });
      const claimB = await claims.create({ publicId: uniqueId("PROOF"), claim: "Claim B" });
      const source = await claimSources.create({ claimId: claimA.id, source: "Source for A" });

      const wrongScopeResult = await claimSources.update(source.id, claimB.id, {
        source: "Attempted cross-claim edit",
      });
      expect(wrongScopeResult).toBeNull();

      const correctScopeResult = await claimSources.update(source.id, claimA.id, {
        source: "Real edit",
      });
      expect(correctScopeResult?.source).toBe("Real edit");
    });

    it("remove() is scoped to claimId — a source from a different claim is not removed (IDOR fix)", async () => {
      const claimA = await claims.create({ publicId: uniqueId("PROOF"), claim: "Claim A2" });
      const claimB = await claims.create({ publicId: uniqueId("PROOF"), claim: "Claim B2" });
      const source = await claimSources.create({ claimId: claimA.id, source: "Source for A2" });

      const wrongScopeRemoved = await claimSources.remove(source.id, claimB.id);
      expect(wrongScopeRemoved).toBe(false);
      expect(await claimSources.findById(source.id)).not.toBeNull();

      const correctScopeRemoved = await claimSources.remove(source.id, claimA.id);
      expect(correctScopeRemoved).toBe(true);
      expect(await claimSources.findById(source.id)).toBeNull();
    });

    it("cascades: deleting a parent proof_claims row also deletes its claim_sources rows", async () => {
      const claim = await claims.create({ publicId: uniqueId("PROOF"), claim: "Cascade Parent" });
      const source = await claimSources.create({ claimId: claim.id, source: "Will be cascaded" });
      expect(await claimSources.findById(source.id)).not.toBeNull();

      // No repository-level hard-delete exists for proof_claims (matching every other module's
      // no-hard-delete-from-the-API convention) — the cascade is exercised directly via SQL,
      // proving the migration's own onDelete: "CASCADE" foreign key, not application code.
      const { getConnection } = await import("../src/connection.js");
      await getConnection().query("DELETE FROM proof_claims WHERE id = :id", {
        replacements: { id: claim.id },
      });

      expect(await claims.findById(claim.id)).toBeNull();
      expect(await claimSources.findById(source.id)).toBeNull();
    });
  });
});
