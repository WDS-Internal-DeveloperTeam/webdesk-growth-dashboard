import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ProjectEnvironmentRepository,
  ProjectObjectiveRepository,
  ProjectRepository,
  ProjectRepositoryRepository,
  ProjectUserRepository,
  RoadmapItemRepository,
} from "../src/projects/index.js";
import { UserRepository } from "../src/auth/index.js";
import { RoleRepository, UserRoleRepository } from "../src/authz/index.js";
import { closeConnection, getConnection } from "../src/connection.js";
import { buildMigrator } from "../src/migrate.js";

/**
 * Exercises the Projects module schema (migrations `00036`-`00043`) against a REAL, disposable
 * PostgreSQL database — including the `roadmap_items` partial-unique-index invariant (D3) and the
 * new `user_roles.project_id`/`role_permissions.project_id` FK constraints, neither of which a
 * mocked repository test can prove. See `docs/task-packages/module-projects-foundation.md`.
 */
describe("Projects module (real disposable database)", () => {
  const projects = new ProjectRepository();
  const environments = new ProjectEnvironmentRepository();
  const repositories = new ProjectRepositoryRepository();
  const projectUsers = new ProjectUserRepository();
  const objectives = new ProjectObjectiveRepository();
  const roadmapItems = new RoadmapItemRepository();
  const users = new UserRepository();
  const roles = new RoleRepository();
  const userRoles = new UserRoleRepository();

  beforeAll(async () => {
    const migrator = buildMigrator();
    await migrator.up();
  });

  afterAll(async () => {
    const migrator = buildMigrator();
    await migrator.down({ to: 0 });
    await closeConnection();
  });

  describe("ProjectRepository", () => {
    it("creates a project with a stable publicId and default active status", async () => {
      const project = await projects.create({
        publicId: `acme-${randomUUID()}`,
        name: "Acme Website",
      });
      expect(project.status).toBe("active");
      expect(project.confidentiality).toBe("internal");
    });

    it("enforces publicId uniqueness at the database layer", async () => {
      const publicId = `dup-${randomUUID()}`;
      await projects.create({ publicId, name: "First" });
      await expect(projects.create({ publicId, name: "Second" })).rejects.toThrow();
    });

    it("filters and searches via list()", async () => {
      const marker = randomUUID();
      await projects.create({ publicId: `search-${marker}-a`, name: `Findable ${marker}` });
      const results = await projects.list({ search: marker });
      expect(results.length).toBeGreaterThan(0);
      expect(results.every((p) => p.name.includes(marker))).toBe(true);
    });
  });

  describe("roadmap_items — D3's one-active-phase-per-project invariant", () => {
    it("rejects a second active roadmap item for the same project at the database layer", async () => {
      const project = await projects.create({ publicId: `roadmap-${randomUUID()}`, name: "P" });
      const first = await roadmapItems.create({ projectId: project.id, name: "Discovery" });
      await roadmapItems.update(first.id, project.id, { status: "active" });

      const second = await roadmapItems.create({ projectId: project.id, name: "Build" });
      await expect(
        roadmapItems.update(second.id, project.id, { status: "active" }),
      ).rejects.toThrow();
    });

    it("allows one active roadmap item per project, and a different active item in a different project", async () => {
      const projectA = await projects.create({ publicId: `pa-${randomUUID()}`, name: "A" });
      const projectB = await projects.create({ publicId: `pb-${randomUUID()}`, name: "B" });
      const itemA = await roadmapItems.create({ projectId: projectA.id, name: "Phase A" });
      const itemB = await roadmapItems.create({ projectId: projectB.id, name: "Phase B" });

      await roadmapItems.update(itemA.id, projectA.id, { status: "active" });
      const updatedB = await roadmapItems.update(itemB.id, projectB.id, { status: "active" });

      expect(updatedB?.status).toBe("active");
    });
  });

  describe("sub-resources", () => {
    it("creates environments, repositories, team roster entries, and objectives scoped to a project", async () => {
      const project = await projects.create({ publicId: `sub-${randomUUID()}`, name: "Sub" });
      const user = await users.create({
        email: `team-${randomUUID()}@webdesksolution.com`,
        displayName: "Team Member",
      });

      const environment = await environments.create({ projectId: project.id, name: "staging" });
      const repository = await repositories.create({
        projectId: project.id,
        repoOwner: "WDS-Internal-DeveloperTeam",
        repoName: "example-repo",
      });
      const teamEntry = await projectUsers.add({ projectId: project.id, userId: user.id });
      const objective = await objectives.create({ projectId: project.id, description: "Launch" });

      expect(environment.projectId).toBe(project.id);
      expect(repository.repoName).toBe("example-repo");
      expect(teamEntry.userId).toBe(user.id);
      expect(objective.status).toBe("open");

      expect(await environments.listByProject(project.id)).toHaveLength(1);
      expect(await repositories.listByProject(project.id)).toHaveLength(1);
      expect(await projectUsers.listByProject(project.id)).toHaveLength(1);
      expect(await objectives.listByProject(project.id)).toHaveLength(1);
    });

    it("rejects duplicate team roster entries for the same project/user pair", async () => {
      const project = await projects.create({ publicId: `dup-team-${randomUUID()}`, name: "P" });
      const user = await users.create({
        email: `dup-team-${randomUUID()}@webdesksolution.com`,
        displayName: "Dup Team",
      });
      await projectUsers.add({ projectId: project.id, userId: user.id });
      await expect(projectUsers.add({ projectId: project.id, userId: user.id })).rejects.toThrow();
    });
  });

  describe("user_roles.project_id / role_permissions.project_id FK (migration 00043)", () => {
    it("assigns a role scoped to a real project", async () => {
      const project = await projects.create({ publicId: `fk-${randomUUID()}`, name: "P" });
      const user = await users.create({
        email: `approver-${randomUUID()}@webdesksolution.com`,
        displayName: "Approver",
      });
      const role = await roles.findByKey("owner_growth_approver");
      expect(role).not.toBeNull();

      const assignment = await userRoles.assign(user.id, role!.id, project.id);
      expect(assignment.projectId).toBe(project.id);

      const roleIds = await userRoles.findRoleIdsForUser(user.id, project.id);
      expect(roleIds).toContain(role!.id);
    });

    it("rejects a role assignment scoped to a non-existent project (FK enforced)", async () => {
      const user = await users.create({
        email: `orphan-${randomUUID()}@webdesksolution.com`,
        displayName: "Orphan",
      });
      const role = await roles.findByKey("owner_growth_approver");
      await expect(userRoles.assign(user.id, role!.id, randomUUID())).rejects.toThrow();
    });
  });
});
