import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  DeploymentRepository,
  ReleaseApprovalRepository,
  ReleaseArtifactRepository,
  ReleaseRepository,
  RollbackRecordRepository,
  SmokeTestRepository,
} from "../src/release-center/index.js";
import { ProjectRepository } from "../src/projects/index.js";
import { UserRepository } from "../src/auth/user.repository.js";
import { withTransaction } from "../src/transaction.js";
import { closeConnection } from "../src/connection.js";
import { buildMigrator } from "../src/migrate.js";

/**
 * Exercises the Release Center schema (migration `00111`) against a REAL, disposable PostgreSQL
 * database. Mirrors `module-technical-center.integration.test.ts`'s/
 * `module-case-study-studio.integration.test.ts`'s own structure, plus real coverage for
 * `ReleaseRepository.updateStatus()`'s conditional timestamp stamping (including the
 * `productionApproverUserId` `fn("COALESCE", col(...), actorUserId)` mechanism, guarded on the
 * FROM status), the `release_approvals`/`rollback_records` atomic transaction pairing via
 * `withTransaction()`, and the `rollback_records_release_id_unique` constraint.
 *
 * Every "actor"/decided-by/deployed-by/rolled-back-by column is a real, FK-constrained `uuid`
 * column referencing `users` — a bare placeholder string (e.g. `"actor-1"`) fails at the database
 * layer with `invalid input syntax for type uuid`, so every test that needs to WRITE one of these
 * columns creates a real user fixture via `UserRepository` first, mirroring every other
 * FK-constrained fixture in this test suite (`createProjectFixture()` below, and every sibling
 * module's own `createProjectFixture()`/`createUserFixture()` helpers).
 */
describe("Release Center module (real disposable database)", () => {
  const releases = new ReleaseRepository();
  const artifacts = new ReleaseArtifactRepository();
  const approvals = new ReleaseApprovalRepository();
  const deployments = new DeploymentRepository();
  const smokeTests = new SmokeTestRepository();
  const rollbackRecords = new RollbackRecordRepository();
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
      name: "Release Center Fixture Project",
    });
    return project.id;
  }

  async function createUserFixture(prefix: string): Promise<string> {
    const user = await users.create({
      email: `${uniqueId(prefix)}@webdesksolution.com`,
      displayName: `${prefix} fixture`,
    });
    return user.id;
  }

  async function createReleaseFixture(
    projectId: string,
    overrides: Partial<{ releaseType: "staging" | "production" | "hotfix" | "rollback" }> = {},
  ): Promise<string> {
    const release = await releases.create({
      projectId,
      publicId: uniqueId("REL"),
      releaseType: overrides.releaseType ?? "staging",
      title: "Fixture release",
    });
    return release.id;
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

  describe("ReleaseRepository", () => {
    it("creates a release defaulting to proposed status with every timestamp unset", async () => {
      const projectId = await createProjectFixture();
      const release = await releases.create({
        projectId,
        publicId: uniqueId("REL"),
        releaseType: "staging",
        title: "September release",
      });
      expect(release.status).toBe("proposed");
      expect(release.stagingDeployedAt).toBeNull();
      expect(release.productionApproverUserId).toBeNull();
      expect(release.rolledBackAt).toBeNull();
    });

    it("rejects a duplicate publicId at the database layer (global uniqueness)", async () => {
      const projectId = await createProjectFixture();
      const publicId = uniqueId("REL");
      await releases.create({ projectId, publicId, releaseType: "staging", title: "A" });
      await expect(
        releases.create({ projectId, publicId, releaseType: "staging", title: "B" }),
      ).rejects.toThrow();
    });

    it("filters list() by releaseType, status, and search", async () => {
      const projectId = await createProjectFixture();
      await releases.create({
        projectId,
        publicId: uniqueId("REL"),
        releaseType: "production",
        title: "Homepage revamp",
      });
      await releases.create({
        projectId,
        publicId: uniqueId("REL"),
        releaseType: "staging",
        title: "Checkout fix",
      });

      const productionOnly = await releases.list({ projectId, releaseType: "production" });
      expect(productionOnly).toHaveLength(1);

      const searched = await releases.list({ projectId, search: "Homepage" });
      expect(searched).toHaveLength(1);
      expect(searched[0]?.title).toContain("Homepage");
    });

    it("update() never accepts publicId/releaseType/status at the type level (compile-time only, smoke-checked here)", async () => {
      const projectId = await createProjectFixture();
      const id = await createReleaseFixture(projectId);
      const updated = await releases.update(id, { title: "Renamed release" });
      expect(updated?.title).toBe("Renamed release");
      expect(updated?.releaseType).toBe("staging");
    });

    it("updateStatus() atomically stamps stagingDeployedAt only once, on the transition into staging_deployed", async () => {
      const projectId = await createProjectFixture();
      const id = await createReleaseFixture(projectId);
      const actorUserId = await createUserFixture("actor");
      await releases.updateStatus(id, "proposed", "checks_running", actorUserId);
      await releases.updateStatus(id, "checks_running", "ready_for_staging", actorUserId);
      const deployed = await releases.updateStatus(
        id,
        "ready_for_staging",
        "staging_deployed",
        actorUserId,
      );
      expect(deployed.outcome).toBe("updated");
      if (deployed.outcome !== "updated") throw new Error("unreachable");
      expect(deployed.entity.stagingDeployedAt).not.toBeNull();
    });

    it("updateStatus() stamps productionApproverUserId only when departing FROM production_approval", async () => {
      const projectId = await createProjectFixture();
      const id = await createReleaseFixture(projectId);
      const actorUserId = await createUserFixture("actor");
      const approverUserId = await createUserFixture("approver");
      // Walk to production_approval via the happy path.
      await releases.updateStatus(id, "proposed", "checks_running", actorUserId);
      await releases.updateStatus(id, "checks_running", "ready_for_staging", actorUserId);
      await releases.updateStatus(id, "ready_for_staging", "staging_deployed", actorUserId);
      await releases.updateStatus(id, "staging_deployed", "staging_verification", actorUserId);
      await releases.updateStatus(id, "staging_verification", "staging_approved", actorUserId);
      await releases.updateStatus(id, "staging_approved", "production_approval", actorUserId);

      const deployed = await releases.updateStatus(
        id,
        "production_approval",
        "production_deployed",
        approverUserId,
      );
      expect(deployed.outcome).toBe("updated");
      if (deployed.outcome !== "updated") throw new Error("unreachable");
      expect(deployed.entity.productionApproverUserId).toBe(approverUserId);
      expect(deployed.entity.productionDeployedAt).not.toBeNull();
    });

    it("does NOT stamp productionApproverUserId on the verification_failed -> production_deployed redeploy path", async () => {
      const projectId = await createProjectFixture();
      const id = await createReleaseFixture(projectId);
      const actorUserId = await createUserFixture("actor");
      const redeployerUserId = await createUserFixture("redeployer");
      await releases.updateStatus(id, "proposed", "checks_running", actorUserId);
      await releases.updateStatus(id, "checks_running", "ready_for_staging", actorUserId);
      await releases.updateStatus(id, "ready_for_staging", "staging_deployed", actorUserId);
      await releases.updateStatus(id, "staging_deployed", "staging_verification", actorUserId);
      const failed = await releases.updateStatus(
        id,
        "staging_verification",
        "verification_failed",
        actorUserId,
      );
      expect(failed.outcome).toBe("updated");

      const deployed = await releases.updateStatus(
        id,
        "verification_failed",
        "production_deployed",
        redeployerUserId,
      );
      expect(deployed.outcome).toBe("updated");
      if (deployed.outcome !== "updated") throw new Error("unreachable");
      expect(deployed.entity.productionApproverUserId).toBeNull();
      expect(deployed.entity.productionDeployedAt).not.toBeNull();
    });

    it("updateStatus() stamps completedAt AND productionVerifiedAt together on the transition into completed", async () => {
      const projectId = await createProjectFixture();
      const id = await createReleaseFixture(projectId);
      const actorUserId = await createUserFixture("actor");
      await releases.updateStatus(id, "proposed", "checks_running", actorUserId);
      await releases.updateStatus(id, "checks_running", "ready_for_staging", actorUserId);
      await releases.updateStatus(id, "ready_for_staging", "staging_deployed", actorUserId);
      await releases.updateStatus(id, "staging_deployed", "staging_verification", actorUserId);
      await releases.updateStatus(id, "staging_verification", "staging_approved", actorUserId);
      await releases.updateStatus(id, "staging_approved", "production_approval", actorUserId);
      await releases.updateStatus(id, "production_approval", "production_deployed", actorUserId);
      await releases.updateStatus(
        id,
        "production_deployed",
        "production_verification",
        actorUserId,
      );

      const completed = await releases.updateStatus(
        id,
        "production_verification",
        "completed",
        actorUserId,
      );
      expect(completed.outcome).toBe("updated");
      if (completed.outcome !== "updated") throw new Error("unreachable");
      expect(completed.entity.completedAt).not.toBeNull();
      expect(completed.entity.productionVerifiedAt).not.toBeNull();
    });

    it("updateStatus() rejects a stale expected-status with a real compare-and-swap conflict", async () => {
      const projectId = await createProjectFixture();
      const id = await createReleaseFixture(projectId);
      const actorUserId = await createUserFixture("actor");
      // Real, current status is "proposed" — asserting the (stale) expectation "checks_running"
      // must fail the CAS guard, not silently succeed.
      const result = await releases.updateStatus(
        id,
        "checks_running",
        "ready_for_staging",
        actorUserId,
      );
      expect(result.outcome).toBe("conflict");
      if (result.outcome !== "conflict") throw new Error("unreachable");
      expect(result.entity.status).toBe("proposed");
    });

    it("updateStatus() returns not_found for a missing release", async () => {
      const actorUserId = await createUserFixture("actor");
      const result = await releases.updateStatus(
        "00000000-0000-4000-8000-000000000000",
        "proposed",
        "checks_running",
        actorUserId,
      );
      expect(result.outcome).toBe("not_found");
    });
  });

  describe("ReleaseArtifactRepository", () => {
    it("creates and lists artifacts scoped to their release", async () => {
      const projectId = await createProjectFixture();
      const releaseId = await createReleaseFixture(projectId);
      await artifacts.create({
        releaseId,
        projectId,
        repoOwner: "webdesk",
        repoName: "growth-dashboard",
        commitSha: "abc123",
      });
      const list = await artifacts.list({ releaseId });
      expect(list).toHaveLength(1);
      expect(list[0]?.repoOwner).toBe("webdesk");
    });

    it("remove() is releaseId-scoped (IDOR prevention)", async () => {
      const projectId = await createProjectFixture();
      const releaseId = await createReleaseFixture(projectId);
      const otherReleaseId = await createReleaseFixture(projectId);
      const created = await artifacts.create({
        releaseId,
        projectId,
        repoOwner: "webdesk",
        repoName: "growth-dashboard",
        commitSha: "abc123",
      });
      const removedFromWrongRelease = await artifacts.remove(created.id, otherReleaseId);
      expect(removedFromWrongRelease).toBe(false);
      const removed = await artifacts.remove(created.id, releaseId);
      expect(removed).toBe(true);
    });
  });

  describe("ReleaseApprovalRepository", () => {
    it("creates and lists approvals scoped to their release, most-recent-first", async () => {
      const projectId = await createProjectFixture();
      const releaseId = await createReleaseFixture(projectId);
      const actorUserId = await createUserFixture("actor");
      await approvals.create({
        releaseId,
        projectId,
        approvalStage: "staging",
        decision: "approved",
        decidedByUserId: actorUserId,
      });
      const list = await approvals.listByRelease(releaseId);
      expect(list).toHaveLength(1);
      expect(list[0]?.approvalStage).toBe("staging");
    });

    it("commits atomically alongside the release's own CAS status write via withTransaction()", async () => {
      const projectId = await createProjectFixture();
      const releaseId = await createReleaseFixture(projectId);
      const actorUserId = await createUserFixture("actor");
      await releases.updateStatus(releaseId, "proposed", "checks_running", actorUserId);
      await releases.updateStatus(releaseId, "checks_running", "ready_for_staging", actorUserId);
      await releases.updateStatus(releaseId, "ready_for_staging", "staging_deployed", actorUserId);
      await releases.updateStatus(
        releaseId,
        "staging_deployed",
        "staging_verification",
        actorUserId,
      );

      await withTransaction(async (transaction) => {
        const result = await releases.updateStatus(
          releaseId,
          "staging_verification",
          "staging_approved",
          actorUserId,
          transaction,
        );
        if (result.outcome !== "updated") throw new Error("unreachable");
        await approvals.create(
          {
            releaseId,
            projectId,
            approvalStage: "staging",
            decision: "approved",
            decidedByUserId: actorUserId,
          },
          transaction,
        );
      });

      const release = await releases.findById(releaseId);
      expect(release?.status).toBe("staging_approved");
      const list = await approvals.listByRelease(releaseId);
      expect(list).toHaveLength(1);
    });
  });

  describe("DeploymentRepository", () => {
    it("creates and lists deployments scoped to their release (append-only history)", async () => {
      const projectId = await createProjectFixture();
      const releaseId = await createReleaseFixture(projectId);
      const actorUserId = await createUserFixture("actor");
      await deployments.create({
        releaseId,
        projectId,
        environment: "staging",
        outcome: "succeeded",
        deployedByUserId: actorUserId,
      });
      await deployments.create({
        releaseId,
        projectId,
        environment: "staging",
        outcome: "failed",
        deployedByUserId: actorUserId,
      });
      const list = await deployments.list({ releaseId });
      expect(list).toHaveLength(2);
    });
  });

  describe("SmokeTestRepository", () => {
    it("creates and lists smoke tests scoped to their release", async () => {
      const projectId = await createProjectFixture();
      const releaseId = await createReleaseFixture(projectId);
      await smokeTests.create({
        releaseId,
        projectId,
        environment: "staging",
        name: "Homepage loads",
        result: "passed",
      });
      const list = await smokeTests.list({ releaseId });
      expect(list).toHaveLength(1);
      expect(list[0]?.result).toBe("passed");
    });
  });

  describe("RollbackRecordRepository", () => {
    it("creates a rollback record and finds it by releaseId", async () => {
      const projectId = await createProjectFixture();
      const releaseId = await createReleaseFixture(projectId);
      const actorUserId = await createUserFixture("actor");
      await rollbackRecords.create({
        releaseId,
        projectId,
        rolledBackSha: "abc123",
        reason: "bad build",
        rolledBackByUserId: actorUserId,
      });
      const found = await rollbackRecords.findByReleaseId(releaseId);
      expect(found?.reason).toBe("bad build");
    });

    it("findByReleaseId() returns null when no rollback record exists", async () => {
      const projectId = await createProjectFixture();
      const releaseId = await createReleaseFixture(projectId);
      const found = await rollbackRecords.findByReleaseId(releaseId);
      expect(found).toBeNull();
    });

    it("enforces at most one rollback record per release (rollback_records_release_id_unique)", async () => {
      const projectId = await createProjectFixture();
      const releaseId = await createReleaseFixture(projectId);
      const actorUserId = await createUserFixture("actor");
      await rollbackRecords.create({
        releaseId,
        projectId,
        rolledBackSha: "abc123",
        reason: "first rollback",
        rolledBackByUserId: actorUserId,
      });
      await expect(
        rollbackRecords.create({
          releaseId,
          projectId,
          rolledBackSha: "def456",
          reason: "second rollback",
          rolledBackByUserId: actorUserId,
        }),
      ).rejects.toThrow();
    });

    it("commits atomically alongside the release's own CAS status write via withTransaction()", async () => {
      const projectId = await createProjectFixture();
      const releaseId = await createReleaseFixture(projectId);
      const actorUserId = await createUserFixture("actor");
      await releases.updateStatus(releaseId, "proposed", "checks_running", actorUserId);
      await releases.updateStatus(releaseId, "checks_running", "ready_for_staging", actorUserId);
      await releases.updateStatus(releaseId, "ready_for_staging", "staging_deployed", actorUserId);

      await withTransaction(async (transaction) => {
        const result = await releases.updateStatus(
          releaseId,
          "staging_deployed",
          "rolled_back",
          actorUserId,
          transaction,
        );
        if (result.outcome !== "updated") throw new Error("unreachable");
        await rollbackRecords.create(
          {
            releaseId,
            projectId,
            rolledBackSha: "abc123",
            reason: "regression found",
            rolledBackByUserId: actorUserId,
          },
          transaction,
        );
      });

      const release = await releases.findById(releaseId);
      expect(release?.status).toBe("rolled_back");
      expect(release?.rolledBackAt).not.toBeNull();
      const record = await rollbackRecords.findByReleaseId(releaseId);
      expect(record?.reason).toBe("regression found");
    });
  });
});
