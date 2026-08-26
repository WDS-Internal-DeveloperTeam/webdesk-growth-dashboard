import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  PageArtifactRepository,
  PageArtifactVersionRepository,
  PageLifecycleRepository,
} from "../src/page-workspace/index.js";
import { PageRepository } from "../src/page-inventory/index.js";
import { ProjectRepository } from "../src/projects/index.js";
import { UserRepository } from "../src/auth/index.js";
import { closeConnection } from "../src/connection.js";
import { buildMigrator } from "../src/migrate.js";

/**
 * Exercises the Page Workspace schema (migration `00068`) against a REAL, disposable PostgreSQL
 * database. Mirrors `module-page-inventory.integration.test.ts`'s own structure, plus dedicated
 * coverage for the two unique constraints the data-model doc names, the compare-and-swap methods
 * under genuinely concurrent writes, project-scoped IDOR prevention at the persistence layer, and
 * the additive `pages.lifecycle_stage` columns.
 *
 * Transition allowlists and RBAC live at the service layer, not here — this file exercises the
 * persistence layer only, matching every sibling module's own split.
 */
describe("Page Workspace module (real disposable database)", () => {
  const artifacts = new PageArtifactRepository();
  const versions = new PageArtifactVersionRepository();
  const lifecycle = new PageLifecycleRepository();
  const pages = new PageRepository();
  const projects = new ProjectRepository();
  const users = new UserRepository();

  let counter = 0;
  function uniqueId(prefix: string): string {
    counter += 1;
    return `${prefix}-${Date.now()}-${counter}`;
  }

  let actorId: string;

  async function createPageFixture(): Promise<{ projectId: string; pageId: string }> {
    const project = await projects.create({
      publicId: uniqueId("PROJ"),
      name: "Page Workspace Fixture Project",
    });
    const page = await pages.create({
      projectId: project.id,
      publicId: uniqueId("PAGE"),
      pageName: "Home",
    });
    return { projectId: project.id, pageId: page.id };
  }

  async function createArtifactFixture(artifactType = "content" as const) {
    const { projectId, pageId } = await createPageFixture();
    const artifact = await artifacts.create({
      pageId,
      projectId,
      artifactType,
      createdBy: actorId,
    });
    return { projectId, pageId, artifact };
  }

  beforeAll(async () => {
    const migrator = buildMigrator();
    await migrator.up();
    const actor = await users.create({
      email: `page-workspace-${randomUUID()}@webdesksolution.com`,
      displayName: "Page Workspace Actor",
    });
    actorId = actor.id;
  });

  afterAll(async () => {
    const migrator = buildMigrator();
    await migrator.down({ to: 0 });
    await closeConnection();
  });

  describe("PageArtifactRepository", () => {
    it("creates an artifact with no current version yet", async () => {
      const { projectId, pageId } = await createPageFixture();
      const artifact = await artifacts.create({
        pageId,
        projectId,
        artifactType: "overview",
        createdBy: actorId,
      });
      expect(artifact.artifactType).toBe("overview");
      expect(artifact.currentVersionId).toBeNull();
      expect(artifact.projectId).toBe(projectId);
    });

    it("enforces one artifact per (page, type) at the database layer", async () => {
      const { projectId, pageId } = await createPageFixture();
      await artifacts.create({ pageId, projectId, artifactType: "audit", createdBy: actorId });

      // The data model's own "artifact type + page" identity — a real unique index, not just
      // service-code discipline.
      await expect(
        artifacts.create({ pageId, projectId, artifactType: "audit", createdBy: actorId }),
      ).rejects.toThrow();
    });

    it("allows the same artifact type on two different pages", async () => {
      const first = await createPageFixture();
      const second = await createPageFixture();
      await artifacts.create({
        pageId: first.pageId,
        projectId: first.projectId,
        artifactType: "qa",
        createdBy: actorId,
      });
      const other = await artifacts.create({
        pageId: second.pageId,
        projectId: second.projectId,
        artifactType: "qa",
        createdBy: actorId,
      });
      expect(other.id).toBeDefined();
    });

    it("scopes reads by project, so another project's id cannot reach the row", async () => {
      const { projectId, artifact } = await createArtifactFixture();
      const foreign = await createPageFixture();

      expect(await artifacts.findById(artifact.id, projectId)).not.toBeNull();
      // Real IDOR prevention in the WHERE clause, not service-code discipline.
      expect(await artifacts.findById(artifact.id, foreign.projectId)).toBeNull();
    });

    it("cascades artifact deletion when the parent page is removed", async () => {
      const { projectId, pageId, artifact } = await createArtifactFixture("search");
      await versions.create({
        artifactId: artifact.id,
        pageId,
        projectId,
        versionNumber: 1,
      });

      const { getPageInventoryModels } = await import("../src/page-inventory/models.js");
      await getPageInventoryModels().Page.destroy({ where: { id: pageId } });

      expect(await artifacts.findById(artifact.id, projectId)).toBeNull();
    });
  });

  describe("PageArtifactVersionRepository", () => {
    it("defaults a new version to draft with no approval recorded", async () => {
      const { projectId, pageId, artifact } = await createArtifactFixture("ideal_structure");
      const created = await versions.create({
        artifactId: artifact.id,
        pageId,
        projectId,
        versionNumber: 1,
        content: "<p>v1</p>",
      });
      expect(created.status).toBe("draft");
      expect(created.approvedByUserId).toBeNull();
      expect(created.approvedAt).toBeNull();
    });

    it("enforces the data model's own artifact-type + page + version uniqueness", async () => {
      const { projectId, pageId, artifact } = await createArtifactFixture("live_snapshot");
      await versions.create({ artifactId: artifact.id, pageId, projectId, versionNumber: 1 });

      await expect(
        versions.create({ artifactId: artifact.id, pageId, projectId, versionNumber: 1 }),
      ).rejects.toThrow();
    });

    it("reports the highest existing version number, and 0 when there are none", async () => {
      const { projectId, pageId, artifact } = await createArtifactFixture("component_map");
      expect(await versions.findLatestVersionNumber(artifact.id, projectId)).toBe(0);

      await versions.create({ artifactId: artifact.id, pageId, projectId, versionNumber: 1 });
      await versions.create({ artifactId: artifact.id, pageId, projectId, versionNumber: 2 });
      expect(await versions.findLatestVersionNumber(artifact.id, projectId)).toBe(2);
    });

    it("stamps the approver and decision timestamp in the same statement as the approval", async () => {
      const { projectId, pageId, artifact } = await createArtifactFixture("security");
      const draft = await versions.create({
        artifactId: artifact.id,
        pageId,
        projectId,
        versionNumber: 1,
      });
      await versions.updateStatus(draft.id, projectId, "draft", "submitted", actorId);
      await versions.updateStatus(draft.id, projectId, "submitted", "under_review", actorId);

      const result = await versions.updateStatus(
        draft.id,
        projectId,
        "under_review",
        "approved",
        actorId,
      );

      expect(result.outcome).toBe("updated");
      if (result.outcome !== "updated") return;
      // 05_Workflow_State_Machines.md §12 — approver and timestamp bound to this exact version.
      expect(result.entity.approvedByUserId).toBe(actorId);
      expect(result.entity.approvedAt).not.toBeNull();
    });

    it("lets only one of two genuinely concurrent status transitions win", async () => {
      const { projectId, pageId, artifact } = await createArtifactFixture("code_review");
      const draft = await versions.create({
        artifactId: artifact.id,
        pageId,
        projectId,
        versionNumber: 1,
      });

      // Both readers saw `draft`; the compare-and-swap must let exactly one commit.
      const [first, second] = await Promise.all([
        versions.updateStatus(draft.id, projectId, "draft", "submitted", actorId),
        versions.updateStatus(draft.id, projectId, "draft", "archived", actorId),
      ]);

      const outcomes = [first.outcome, second.outcome].sort();
      expect(outcomes).toEqual(["conflict", "updated"]);
    });

    it("refuses an in-place edit whose compare-and-swap guard no longer matches", async () => {
      const { projectId, pageId, artifact } = await createArtifactFixture("ux_wireframe");
      const draft = await versions.create({
        artifactId: artifact.id,
        pageId,
        projectId,
        versionNumber: 1,
      });
      await versions.updateStatus(draft.id, projectId, "draft", "submitted", actorId);

      // The service reads `draft`, a transition lands, then the write fires — this is the guard
      // that makes the edit lose instead of silently mutating a no-longer-draft version.
      const stale = await versions.update(
        draft.id,
        projectId,
        { content: "<p>stale</p>" },
        "draft",
      );
      expect(stale).toBeNull();
    });

    it("scopes version reads by project, so another project's id cannot reach the row", async () => {
      const { projectId, pageId, artifact } = await createArtifactFixture("deployment");
      const created = await versions.create({
        artifactId: artifact.id,
        pageId,
        projectId,
        versionNumber: 1,
      });
      const foreign = await createPageFixture();

      expect(await versions.findById(created.id, projectId)).not.toBeNull();
      expect(await versions.findById(created.id, foreign.projectId)).toBeNull();
    });

    it("lists an artifact's versions newest first", async () => {
      const { projectId, pageId, artifact } = await createArtifactFixture("creative_direction");
      await versions.create({ artifactId: artifact.id, pageId, projectId, versionNumber: 1 });
      await versions.create({ artifactId: artifact.id, pageId, projectId, versionNumber: 2 });
      await versions.create({ artifactId: artifact.id, pageId, projectId, versionNumber: 3 });

      const listed = await versions.listForArtifact(artifact.id, projectId);
      expect(listed.map((v) => v.versionNumber)).toEqual([3, 2, 1]);
    });
  });

  describe("PageLifecycleRepository (pages.lifecycle_stage, migration 00068)", () => {
    it("defaults an existing page to the proposed lifecycle stage", async () => {
      const { projectId, pageId } = await createPageFixture();
      const page = await lifecycle.findById(pageId, projectId);
      expect(page?.lifecycleStage).toBe("proposed");
      expect(page?.lifecyclePreviousStage).toBeNull();
    });

    it("leaves Page Inventory's own workflowStage untouched — the two axes are independent", async () => {
      const { projectId, pageId } = await createPageFixture();
      await lifecycle.updateLifecycleStage(
        pageId,
        projectId,
        "proposed",
        "approved_for_planning",
        null,
        actorId,
      );

      const page = await lifecycle.findById(pageId, projectId);
      expect(page?.lifecycleStage).toBe("approved_for_planning");
      // The record-approval axis Page Inventory already ships is unaffected (task package D4).
      expect(page?.workflowStage).toBe("draft");
    });

    it("writes the stage and its resume marker in one statement", async () => {
      const { projectId, pageId } = await createPageFixture();
      const result = await lifecycle.updateLifecycleStage(
        pageId,
        projectId,
        "proposed",
        "paused",
        "proposed",
        actorId,
      );

      expect(result.outcome).toBe("updated");
      if (result.outcome !== "updated") return;
      expect(result.entity.lifecycleStage).toBe("paused");
      expect(result.entity.lifecyclePreviousStage).toBe("proposed");
    });

    it("lets only one of two genuinely concurrent lifecycle transitions win", async () => {
      const { projectId, pageId } = await createPageFixture();

      const [first, second] = await Promise.all([
        lifecycle.updateLifecycleStage(
          pageId,
          projectId,
          "proposed",
          "approved_for_planning",
          null,
          actorId,
        ),
        lifecycle.updateLifecycleStage(
          pageId,
          projectId,
          "proposed",
          "blocked",
          "proposed",
          actorId,
        ),
      ]);

      const outcomes = [first.outcome, second.outcome].sort();
      expect(outcomes).toEqual(["conflict", "updated"]);
    });

    it("scopes lifecycle reads and writes by project", async () => {
      const { projectId, pageId } = await createPageFixture();
      const foreign = await createPageFixture();

      expect(await lifecycle.findById(pageId, foreign.projectId)).toBeNull();
      const result = await lifecycle.updateLifecycleStage(
        pageId,
        foreign.projectId,
        "proposed",
        "archived",
        null,
        actorId,
      );
      expect(result.outcome).toBe("not_found");
    });
  });
});
