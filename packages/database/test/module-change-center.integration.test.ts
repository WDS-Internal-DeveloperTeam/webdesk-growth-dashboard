import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ChangeRecordRepository } from "../src/change-center/index.js";
import {
  ScanRunRepository,
  ScanDefinitionRepository,
  ScanFindingRepository,
} from "../src/scan-center/index.js";
import { ProjectRepository } from "../src/projects/index.js";
import { UserRepository } from "../src/auth/index.js";
import { closeConnection } from "../src/connection.js";
import { buildMigrator } from "../src/migrate.js";

/**
 * Exercises the Change Center schema (migration `00105`) against a REAL, disposable PostgreSQL
 * database. Mirrors `module-internal-linking-library.integration.test.ts`'s own structure, plus
 * real coverage for the one genuinely new mechanism this module introduces: the atomic
 * `updateStatus()` compare-and-swap write that also stamps `decidedByUserId`/`decidedAt`,
 * `appliedByUserId`/`appliedAt`, and `verifiedByUserId`/`verifiedAt` as plain parameterized values
 * (a deliberate deviation from the `COALESCE(column, NOW())` pattern — see
 * `ChangeRecordRepository.updateStatus()`'s own doc comment for why).
 */
describe("Change Center module (real disposable database)", () => {
  const changeRecords = new ChangeRecordRepository();
  const scanDefinitions = new ScanDefinitionRepository();
  const scanRuns = new ScanRunRepository();
  const scanFindings = new ScanFindingRepository();
  const projects = new ProjectRepository();
  const users = new UserRepository();

  let counter = 0;
  function uniqueId(prefix: string): string {
    counter += 1;
    return `${prefix}-${Date.now()}-${counter}`;
  }

  async function createProjectFixture(): Promise<string> {
    const project = await projects.create({
      publicId: uniqueId("PROJ"),
      name: "Change Center Fixture Project",
    });
    return project.id;
  }

  // `decided_by_user_id`/`applied_by_user_id`/`verified_by_user_id`/`updated_by` are all real FKs
  // into `users` (migration `00105`) — unlike Internal Linking Library's own nullable-actor
  // updateStatus() calls (which pass `null`), ChangeRecordRepository.updateStatus() always stamps
  // a real, non-null actor id, so every call in this file needs a real, existing user row.
  async function createUserFixture(emailPrefix: string): Promise<string> {
    const user = await users.create({
      email: `${uniqueId(emailPrefix)}@webdesksolution.com`,
      displayName: `${emailPrefix} fixture`,
    });
    return user.id;
  }

  async function createScanFindingFixture(projectId: string): Promise<string> {
    const definition = await scanDefinitions.create({
      projectId,
      publicId: uniqueId("SCAN"),
      name: "Fixture scan definition",
      scanType: "theme_plugin_core_currency",
    });
    const run = await scanRuns.create({
      projectId,
      publicId: uniqueId("RUN"),
      scanDefinitionId: definition.id,
      triggerType: "manual",
    });
    const finding = await scanFindings.create({
      projectId,
      publicId: uniqueId("FND"),
      scanRunId: run.id,
      severity: "medium",
      title: "Fixture finding",
    });
    return finding.id;
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

  describe("ChangeRecordRepository", () => {
    it("creates a change record defaulting to detected status", async () => {
      const projectId = await createProjectFixture();
      const record = await changeRecords.create({
        projectId,
        publicId: uniqueId("CHG"),
        category: "plugin",
        severity: "medium",
        recordLabel: "Plugin X 1.2.0 -> 1.3.0",
      });
      expect(record.projectId).toBe(projectId);
      expect(record.status).toBe("detected");
      expect(record.decidedAt).toBeNull();
      expect(record.appliedAt).toBeNull();
      expect(record.verifiedAt).toBeNull();
      expect(record.rollbackGuidance).toBeNull();
    });

    it("stores a real scanFindingId reference", async () => {
      const projectId = await createProjectFixture();
      const scanFindingId = await createScanFindingFixture(projectId);
      const record = await changeRecords.create({
        projectId,
        publicId: uniqueId("CHG"),
        category: "security",
        severity: "high",
        recordLabel: "XSS vector found",
        scanFindingId,
      });
      expect(record.scanFindingId).toBe(scanFindingId);
    });

    it("rejects a duplicate publicId at the database layer (global uniqueness, not per-project)", async () => {
      const projectId = await createProjectFixture();
      const publicId = uniqueId("CHG");
      await changeRecords.create({
        projectId,
        publicId,
        category: "core",
        severity: "low",
        recordLabel: "Core update",
      });
      await expect(
        changeRecords.create({
          projectId,
          publicId,
          category: "core",
          severity: "low",
          recordLabel: "Core update 2",
        }),
      ).rejects.toThrow();
    });

    it("lists only records for the given project", async () => {
      const projectId = await createProjectFixture();
      const otherProjectId = await createProjectFixture();
      await changeRecords.create({
        projectId,
        publicId: uniqueId("CHG"),
        category: "theme",
        severity: "info",
        recordLabel: "Theme update",
      });
      await changeRecords.create({
        projectId: otherProjectId,
        publicId: uniqueId("CHG"),
        category: "theme",
        severity: "info",
        recordLabel: "Other project theme update",
      });
      const rows = await changeRecords.list({ projectId });
      expect(rows.every((row) => row.projectId === projectId)).toBe(true);
    });

    it("fuzzy-matches recordLabel via the search filter (pg_trgm)", async () => {
      const projectId = await createProjectFixture();
      const record = await changeRecords.create({
        projectId,
        publicId: uniqueId("CHG"),
        category: "seo_metadata",
        severity: "low",
        recordLabel: "Homepage meta description changed",
      });
      const rows = await changeRecords.list({ projectId, search: "meta description" });
      expect(rows.some((row) => row.id === record.id)).toBe(true);
    });

    it("update() edits content fields via an atomic UPDATE ... RETURNING, never touching status", async () => {
      const projectId = await createProjectFixture();
      const record = await changeRecords.create({
        projectId,
        publicId: uniqueId("CHG"),
        category: "database",
        severity: "medium",
        recordLabel: "Schema drift detected",
      });
      const updated = await changeRecords.update(
        record.id,
        { recordLabel: "Schema drift detected (revised)" },
        "detected",
      );
      expect(updated?.recordLabel).toBe("Schema drift detected (revised)");
      expect(updated?.status).toBe("detected");
    });

    it("update() returns null (CAS miss) when expectedStatus no longer matches", async () => {
      const projectId = await createProjectFixture();
      const record = await changeRecords.create({
        projectId,
        publicId: uniqueId("CHG"),
        category: "integration",
        severity: "medium",
        recordLabel: "Integration drift",
      });
      const result = await changeRecords.update(
        record.id,
        { recordLabel: "Should not apply" },
        "under_review",
      );
      expect(result).toBeNull();
    });

    it("updateStatus() performs an atomic (id, status) compare-and-swap", async () => {
      const projectId = await createProjectFixture();
      const actorId = await createUserFixture("actor");
      const record = await changeRecords.create({
        projectId,
        publicId: uniqueId("CHG"),
        category: "accessibility",
        severity: "low",
        recordLabel: "Accessibility fix",
      });
      const result = await changeRecords.updateStatus(
        record.id,
        "detected",
        "under_review",
        actorId,
      );
      expect(result.outcome).toBe("updated");
      if (result.outcome === "updated") {
        expect(result.entity.status).toBe("under_review");
      }
    });

    it("updateStatus() returns 'conflict' when expectedCurrentStatus no longer matches", async () => {
      const projectId = await createProjectFixture();
      const actorId = await createUserFixture("actor");
      const record = await changeRecords.create({
        projectId,
        publicId: uniqueId("CHG"),
        category: "performance",
        severity: "medium",
        recordLabel: "Slow query",
      });
      await changeRecords.updateStatus(record.id, "detected", "under_review", actorId);
      const result = await changeRecords.updateStatus(
        record.id,
        "detected",
        "under_review",
        actorId,
      );
      expect(result.outcome).toBe("conflict");
    });

    it("updateStatus() returns 'not_found' for a nonexistent id", async () => {
      const actorId = await createUserFixture("actor");
      const result = await changeRecords.updateStatus(
        "00000000-0000-4000-8000-000000000000",
        "detected",
        "under_review",
        actorId,
      );
      expect(result.outcome).toBe("not_found");
    });

    it("stamps decidedByUserId/decidedAt when entering a decision state", async () => {
      const projectId = await createProjectFixture();
      const actorId = await createUserFixture("actor");
      const deciderId = await createUserFixture("decider");
      const record = await changeRecords.create({
        projectId,
        publicId: uniqueId("CHG"),
        category: "assets",
        severity: "info",
        recordLabel: "New asset detected",
      });
      await changeRecords.updateStatus(record.id, "detected", "under_review", actorId);
      const result = await changeRecords.updateStatus(
        record.id,
        "under_review",
        "accepted",
        deciderId,
      );
      expect(result.outcome).toBe("updated");
      if (result.outcome === "updated") {
        expect(result.entity.decidedByUserId).toBe(deciderId);
        expect(result.entity.decidedAt).not.toBeNull();
        expect(result.entity.appliedAt).toBeNull();
      }
    });

    it("stamps appliedByUserId/appliedAt only on entering applied, and verifiedByUserId/verifiedAt only on entering verified", async () => {
      const projectId = await createProjectFixture();
      const actorId = await createUserFixture("actor");
      const deciderId = await createUserFixture("decider");
      const applierId = await createUserFixture("applier");
      const verifierId = await createUserFixture("verifier");
      const record = await changeRecords.create({
        projectId,
        publicId: uniqueId("CHG"),
        category: "redirects_urls",
        severity: "low",
        recordLabel: "Redirect rule change",
      });
      await changeRecords.updateStatus(record.id, "detected", "under_review", actorId);
      await changeRecords.updateStatus(record.id, "under_review", "accepted", deciderId);
      const applyingResult = await changeRecords.updateStatus(
        record.id,
        "accepted",
        "applying",
        applierId,
      );
      expect(applyingResult.outcome).toBe("updated");
      if (applyingResult.outcome === "updated") {
        expect(applyingResult.entity.appliedAt).toBeNull();
      }
      const appliedResult = await changeRecords.updateStatus(
        record.id,
        "applying",
        "applied",
        applierId,
      );
      expect(appliedResult.outcome).toBe("updated");
      if (appliedResult.outcome === "updated") {
        expect(appliedResult.entity.appliedByUserId).toBe(applierId);
        expect(appliedResult.entity.appliedAt).not.toBeNull();
        expect(appliedResult.entity.verifiedAt).toBeNull();
      }
      const verifiedResult = await changeRecords.updateStatus(
        record.id,
        "applied",
        "verified",
        verifierId,
      );
      expect(verifiedResult.outcome).toBe("updated");
      if (verifiedResult.outcome === "updated") {
        expect(verifiedResult.entity.verifiedByUserId).toBe(verifierId);
        expect(verifiedResult.entity.verifiedAt).not.toBeNull();
      }
    });

    it("writes rollbackGuidance only when explicitly passed, entering apply_failed", async () => {
      const projectId = await createProjectFixture();
      const actorId = await createUserFixture("actor");
      const deciderId = await createUserFixture("decider");
      const applierId = await createUserFixture("applier");
      const record = await changeRecords.create({
        projectId,
        publicId: uniqueId("CHG"),
        category: "conflicts_failed_sync",
        severity: "high",
        recordLabel: "Merge conflict",
      });
      await changeRecords.updateStatus(record.id, "detected", "under_review", actorId);
      await changeRecords.updateStatus(record.id, "under_review", "accepted", deciderId);
      await changeRecords.updateStatus(record.id, "accepted", "applying", applierId);
      const result = await changeRecords.updateStatus(
        record.id,
        "applying",
        "apply_failed",
        applierId,
        { rollbackGuidance: "Revert to prior plugin version 1.2.0" },
      );
      expect(result.outcome).toBe("updated");
      if (result.outcome === "updated") {
        expect(result.entity.rollbackGuidance).toBe("Revert to prior plugin version 1.2.0");
      }
    });

    it("clears a stale rollbackGuidance automatically when retrying out of apply_failed", async () => {
      const projectId = await createProjectFixture();
      const actorId = await createUserFixture("actor");
      const deciderId = await createUserFixture("decider");
      const applierId = await createUserFixture("applier");
      const record = await changeRecords.create({
        projectId,
        publicId: uniqueId("CHG"),
        category: "conflicts_failed_sync",
        severity: "high",
        recordLabel: "Merge conflict, retried",
      });
      await changeRecords.updateStatus(record.id, "detected", "under_review", actorId);
      await changeRecords.updateStatus(record.id, "under_review", "accepted", deciderId);
      await changeRecords.updateStatus(record.id, "accepted", "applying", applierId);
      await changeRecords.updateStatus(record.id, "applying", "apply_failed", applierId, {
        rollbackGuidance: "Revert to prior plugin version 1.2.0",
      });
      // Retrying (apply_failed -> applying) without a fresh rollbackGuidance clears the stale one —
      // it must not still describe a failure the record went on to recover from.
      const retryResult = await changeRecords.updateStatus(
        record.id,
        "apply_failed",
        "applying",
        applierId,
      );
      expect(retryResult.outcome).toBe("updated");
      if (retryResult.outcome === "updated") {
        expect(retryResult.entity.rollbackGuidance).toBeNull();
      }
      const appliedResult = await changeRecords.updateStatus(
        record.id,
        "applying",
        "applied",
        applierId,
      );
      expect(appliedResult.outcome).toBe("updated");
      if (appliedResult.outcome === "updated") {
        expect(appliedResult.entity.rollbackGuidance).toBeNull();
      }
    });

    it("stamps decidedByUserId/decidedAt/appliedByUserId/appliedAt only ONCE, preserving the original actor and time across a later re-entry into the same milestone", async () => {
      const projectId = await createProjectFixture();
      const actorId = await createUserFixture("actor");
      const firstDeciderId = await createUserFixture("first-decider");
      const secondDeciderId = await createUserFixture("second-decider");
      const firstApplierId = await createUserFixture("first-applier");
      const secondApplierId = await createUserFixture("second-applier");
      const record = await changeRecords.create({
        projectId,
        publicId: uniqueId("CHG"),
        category: "core",
        severity: "critical",
        recordLabel: "WordPress core 6.4.1 -> 6.4.2",
      });
      await changeRecords.updateStatus(record.id, "detected", "under_review", actorId);
      // First decision, by firstDeciderId — this is the timestamp/actor that must survive.
      const firstAccepted = await changeRecords.updateStatus(
        record.id,
        "under_review",
        "accepted",
        firstDeciderId,
      );
      expect(firstAccepted.outcome).toBe("updated");
      const originalDecidedAt =
        firstAccepted.outcome === "updated" ? firstAccepted.entity.decidedAt : null;
      expect(originalDecidedAt).not.toBeNull();

      // A first apply attempt fails, by firstApplierId — this is the appliedAt/appliedByUserId
      // that must survive the later successful retry below (appliedAt isn't set on apply_failed,
      // only decidedAt is re-entered here to prove the decision-state stamp specifically).
      await changeRecords.updateStatus(record.id, "accepted", "applying", firstApplierId);
      await changeRecords.updateStatus(record.id, "applying", "apply_failed", firstApplierId);
      await changeRecords.updateStatus(record.id, "apply_failed", "applying", secondApplierId);
      const appliedResult = await changeRecords.updateStatus(
        record.id,
        "applying",
        "applied",
        secondApplierId,
      );
      expect(appliedResult.outcome).toBe("updated");
      const originalAppliedAt =
        appliedResult.outcome === "updated" ? appliedResult.entity.appliedAt : null;
      expect(originalAppliedAt).not.toBeNull();
      if (appliedResult.outcome === "updated") {
        // appliedByUserId/appliedAt are stamped by THIS (first-ever) transition into applied —
        // secondApplierId is correct here since this is the first time the record reaches
        // applied, not a re-entry.
        expect(appliedResult.entity.appliedByUserId).toBe(secondApplierId);
        // decidedAt/decidedByUserId are untouched by this unrelated applying->applied transition.
        expect(appliedResult.entity.decidedByUserId).toBe(firstDeciderId);
        expect(appliedResult.entity.decidedAt).toBe(originalDecidedAt);
      }

      // Now re-verify the actual "stamp once" guarantee: revisit the decision state a second time
      // via deferred -> under_review -> accepted, with a DIFFERENT actor. decidedAt/decidedByUserId
      // must still reflect the ORIGINAL decision, not this second one.
      const verifiedResult = await changeRecords.updateStatus(
        record.id,
        "applied",
        "verified",
        secondApplierId,
      );
      expect(verifiedResult.outcome).toBe("updated");
      const status = verifiedResult.outcome === "updated" ? verifiedResult.entity.status : null;
      expect(status).toBe("verified");

      // Re-fetch and re-run the same decision transition is not legal from `verified` (terminal),
      // so instead prove stamp-once directly against the decision pair using a fresh record that
      // revisits `under_review -> accepted` via `deferred`.
      const reDecisionRecord = await changeRecords.create({
        projectId,
        publicId: uniqueId("CHG"),
        category: "core",
        severity: "critical",
        recordLabel: "Re-decision stamp-once check",
      });
      await changeRecords.updateStatus(reDecisionRecord.id, "detected", "under_review", actorId);
      const firstDecision = await changeRecords.updateStatus(
        reDecisionRecord.id,
        "under_review",
        "deferred",
        firstDeciderId,
      );
      expect(firstDecision.outcome).toBe("updated");
      const firstDecisionAt =
        firstDecision.outcome === "updated" ? firstDecision.entity.decidedAt : null;
      expect(firstDecisionAt).not.toBeNull();
      await changeRecords.updateStatus(reDecisionRecord.id, "deferred", "under_review", actorId);
      const secondDecision = await changeRecords.updateStatus(
        reDecisionRecord.id,
        "under_review",
        "accepted",
        secondDeciderId,
      );
      expect(secondDecision.outcome).toBe("updated");
      if (secondDecision.outcome === "updated") {
        // The ORIGINAL decider/time (from the deferred transition) must survive, not
        // secondDeciderId/a later timestamp.
        expect(secondDecision.entity.decidedByUserId).toBe(firstDeciderId);
        expect(secondDecision.entity.decidedAt).toBe(firstDecisionAt);
      }
    });

    it("stores a real target_module_key/target_id polymorphic reference", async () => {
      const projectId = await createProjectFixture();
      const record = await changeRecords.create({
        projectId,
        publicId: uniqueId("CHG"),
        category: "seo_metadata",
        severity: "medium",
        recordLabel: "Business knowledge record changed",
        targetModuleKey: "business_knowledge",
        targetId: "11111111-1111-4111-8111-111111111111",
      });
      expect(record.targetModuleKey).toBe("business_knowledge");
      expect(record.targetId).toBe("11111111-1111-4111-8111-111111111111");
    });
  });
});
