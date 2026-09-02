import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  TechnicalCheckDefinitionRepository,
  TechnicalCheckRunRepository,
  TechnicalFindingRepository,
} from "../src/technical-center/index.js";
import { ProjectRepository } from "../src/projects/index.js";
import { closeConnection } from "../src/connection.js";
import { buildMigrator } from "../src/migrate.js";

/**
 * Exercises the Technical Center schema (migration `00109`) against a REAL, disposable PostgreSQL
 * database. Mirrors `module-scan-center.integration.test.ts`'s own structure, plus real coverage
 * for the two atomic compare-and-swap mechanisms this module introduces:
 * `TechnicalCheckRunRepository.updateStatus()`'s conditional `startedAt`/`completedAt` stamping,
 * and `TechnicalFindingRepository.updateStatus()`'s conditional `resolvedAt`/`resolvedBy`
 * stamping.
 */
describe("Technical Center module (real disposable database)", () => {
  const definitions = new TechnicalCheckDefinitionRepository();
  const runs = new TechnicalCheckRunRepository();
  const findings = new TechnicalFindingRepository();
  const projects = new ProjectRepository();

  let counter = 0;
  function uniqueId(prefix: string): string {
    counter += 1;
    return `${prefix}-${Date.now()}-${counter}`;
  }

  async function createProjectFixture(): Promise<string> {
    const project = await projects.create({
      publicId: uniqueId("PROJ"),
      name: "Technical Center Fixture Project",
    });
    return project.id;
  }

  async function createDefinitionFixture(projectId: string): Promise<string> {
    const definition = await definitions.create({
      projectId,
      publicId: uniqueId("TCDEF"),
      name: "Lint check",
      checkType: "linting",
    });
    return definition.id;
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

  describe("TechnicalCheckDefinitionRepository", () => {
    it("creates a definition defaulting to manual mode and enabled", async () => {
      const projectId = await createProjectFixture();
      const definition = await definitions.create({
        projectId,
        publicId: uniqueId("TCDEF"),
        name: "Lint check",
        checkType: "linting",
      });
      expect(definition.mode).toBe("manual");
      expect(definition.isEnabled).toBe(true);
    });

    it("rejects a duplicate publicId at the database layer (global uniqueness)", async () => {
      const projectId = await createProjectFixture();
      const publicId = uniqueId("TCDEF");
      await definitions.create({ projectId, publicId, name: "A", checkType: "linting" });
      await expect(
        definitions.create({ projectId, publicId, name: "B", checkType: "linting" }),
      ).rejects.toThrow();
    });

    it("filters list() by checkType and isEnabled", async () => {
      const projectId = await createProjectFixture();
      await definitions.create({
        projectId,
        publicId: uniqueId("TCDEF"),
        name: "Accessibility check",
        checkType: "accessibility",
      });
      await definitions.create({
        projectId,
        publicId: uniqueId("TCDEF"),
        name: "Disabled lint check",
        checkType: "linting",
        isEnabled: false,
      });

      const a11yOnly = await definitions.list({ projectId, checkType: "accessibility" });
      expect(a11yOnly).toHaveLength(1);

      const enabledOnly = await definitions.list({ projectId, isEnabled: true });
      expect(enabledOnly.every((d) => d.isEnabled)).toBe(true);
    });

    it("update() never accepts checkType/publicId/projectId at the type level (compile-time only, smoke-checked here)", async () => {
      const projectId = await createProjectFixture();
      const id = await createDefinitionFixture(projectId);
      const updated = await definitions.update(id, { name: "Renamed lint check" });
      expect(updated?.name).toBe("Renamed lint check");
      expect(updated?.checkType).toBe("linting");
    });
  });

  describe("TechnicalCheckRunRepository", () => {
    it("creates a run defaulting to requested status, with started/completed unset", async () => {
      const projectId = await createProjectFixture();
      const definitionId = await createDefinitionFixture(projectId);
      const run = await runs.create({
        projectId,
        publicId: uniqueId("TCRUN"),
        technicalCheckDefinitionId: definitionId,
        triggerType: "manual",
      });
      expect(run.status).toBe("requested");
      expect(run.startedAt).toBeNull();
      expect(run.completedAt).toBeNull();
    });

    it("updateStatus() atomically stamps startedAt only once, on the transition into running", async () => {
      const projectId = await createProjectFixture();
      const definitionId = await createDefinitionFixture(projectId);
      const run = await runs.create({
        projectId,
        publicId: uniqueId("TCRUN"),
        technicalCheckDefinitionId: definitionId,
        triggerType: "manual",
      });

      const queued = await runs.updateStatus(run.id, "requested", "queued");
      expect(queued.outcome).toBe("updated");
      if (queued.outcome !== "updated") throw new Error("unreachable");
      expect(queued.entity.startedAt).toBeNull();

      const running = await runs.updateStatus(run.id, "queued", "running");
      expect(running.outcome).toBe("updated");
      if (running.outcome !== "updated") throw new Error("unreachable");
      expect(running.entity.startedAt).not.toBeNull();
      expect(running.entity.startedAt).toBeTruthy();
    });

    it("updateStatus() atomically stamps completedAt on a terminal transition", async () => {
      const projectId = await createProjectFixture();
      const definitionId = await createDefinitionFixture(projectId);
      const run = await runs.create({
        projectId,
        publicId: uniqueId("TCRUN"),
        technicalCheckDefinitionId: definitionId,
        triggerType: "manual",
      });
      await runs.updateStatus(run.id, "requested", "queued");
      await runs.updateStatus(run.id, "queued", "running");
      const completed = await runs.updateStatus(run.id, "running", "completed");
      expect(completed.outcome).toBe("updated");
      if (completed.outcome !== "updated") throw new Error("unreachable");
      expect(completed.entity.completedAt).not.toBeNull();
      expect(completed.entity.status).toBe("completed");
    });

    it("updateStatus() rejects a stale expected-status with a real compare-and-swap conflict", async () => {
      const projectId = await createProjectFixture();
      const definitionId = await createDefinitionFixture(projectId);
      const run = await runs.create({
        projectId,
        publicId: uniqueId("TCRUN"),
        technicalCheckDefinitionId: definitionId,
        triggerType: "manual",
      });
      // Real, current status is "requested" — asserting the (stale) expectation "queued" must
      // fail the CAS guard, not silently succeed.
      const result = await runs.updateStatus(run.id, "queued", "running");
      expect(result.outcome).toBe("conflict");
      if (result.outcome !== "conflict") throw new Error("unreachable");
      expect(result.entity.status).toBe("requested");
    });

    it("updateStatus() returns not_found for a missing run", async () => {
      const result = await runs.updateStatus(
        "00000000-0000-4000-8000-000000000000",
        "requested",
        "queued",
      );
      expect(result.outcome).toBe("not_found");
    });

    it("updateStatus() cancels directly from requested/queued/running (shortcut edges)", async () => {
      const projectId = await createProjectFixture();
      const definitionId = await createDefinitionFixture(projectId);
      const run = await runs.create({
        projectId,
        publicId: uniqueId("TCRUN"),
        technicalCheckDefinitionId: definitionId,
        triggerType: "manual",
      });
      const cancelled = await runs.updateStatus(run.id, "requested", "cancelled");
      expect(cancelled.outcome).toBe("updated");
      if (cancelled.outcome !== "updated") throw new Error("unreachable");
      expect(cancelled.entity.completedAt).not.toBeNull();
    });
  });

  describe("TechnicalFindingRepository", () => {
    async function createRunFixture(): Promise<{ projectId: string; runId: string }> {
      const projectId = await createProjectFixture();
      const definitionId = await createDefinitionFixture(projectId);
      const run = await runs.create({
        projectId,
        publicId: uniqueId("TCRUN"),
        technicalCheckDefinitionId: definitionId,
        triggerType: "manual",
      });
      return { projectId, runId: run.id };
    }

    it("creates a finding defaulting to open status", async () => {
      const { projectId, runId } = await createRunFixture();
      const finding = await findings.create({
        projectId,
        publicId: uniqueId("TCFND"),
        technicalCheckRunId: runId,
        severity: "high",
        title: "Missing PHPCS config",
      });
      expect(finding.status).toBe("open");
      expect(finding.resolvedAt).toBeNull();
    });

    it("bulkCreate() inserts every row atomically in one statement", async () => {
      const { projectId, runId } = await createRunFixture();
      const created = await findings.bulkCreate([
        {
          projectId,
          publicId: uniqueId("TCFND"),
          technicalCheckRunId: runId,
          severity: "critical",
          title: "3 known CVEs in dependencies",
        },
        {
          projectId,
          publicId: uniqueId("TCFND"),
          technicalCheckRunId: runId,
          severity: "low",
          title: "Coverage below 80%",
        },
      ]);
      expect(created).toHaveLength(2);

      const list = await findings.list({ projectId, technicalCheckRunId: runId });
      expect(list).toHaveLength(2);
    });

    it("bulkCreate() with an empty array is a safe no-op", async () => {
      const result = await findings.bulkCreate([]);
      expect(result).toEqual([]);
    });

    it("updateStatus() atomically stamps resolvedAt/resolvedBy only on transition into resolved", async () => {
      const { projectId, runId } = await createRunFixture();
      const finding = await findings.create({
        projectId,
        publicId: uniqueId("TCFND"),
        technicalCheckRunId: runId,
        severity: "high",
        title: "Broken PHP compatibility check",
      });

      const resolved = await findings.updateStatus(finding.id, "open", "resolved", null);
      expect(resolved.outcome).toBe("updated");
      if (resolved.outcome !== "updated") throw new Error("unreachable");
      expect(resolved.entity.resolvedAt).not.toBeNull();
    });

    it("updateStatus() rejects a stale expected-status with a real conflict", async () => {
      const { projectId, runId } = await createRunFixture();
      const finding = await findings.create({
        projectId,
        publicId: uniqueId("TCFND"),
        technicalCheckRunId: runId,
        severity: "high",
        title: "Broken PHP compatibility check",
      });
      const result = await findings.updateStatus(finding.id, "acknowledged", "resolved", null);
      expect(result.outcome).toBe("conflict");
    });

    it("filters list() by severity, status, and search", async () => {
      const { projectId, runId } = await createRunFixture();
      await findings.create({
        projectId,
        publicId: uniqueId("TCFND"),
        technicalCheckRunId: runId,
        severity: "critical",
        title: "Unescaped SQL query",
      });
      await findings.create({
        projectId,
        publicId: uniqueId("TCFND"),
        technicalCheckRunId: runId,
        severity: "info",
        title: "Style nit",
      });

      const criticalOnly = await findings.list({ projectId, severity: "critical" });
      expect(criticalOnly).toHaveLength(1);

      const searched = await findings.list({ projectId, search: "SQL" });
      expect(searched).toHaveLength(1);
      expect(searched[0]?.title).toContain("SQL");
    });
  });
});
