import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  AuthorizationActionRepository,
  ModuleRegistryRepository,
  ModuleRepository,
  RolePermissionRepository,
  RoleRepository,
  UserRoleRepository,
} from "../src/authz/index.js";
import { UserRepository } from "../src/auth/index.js";
import { closeConnection } from "../src/connection.js";
import { buildMigrator } from "../src/migrate.js";

/**
 * Exercises the RBAC schema and repositories against a REAL, disposable
 * PostgreSQL database — proving the seeded matrix
 * (src/migrations/00013-seed-rbac-matrix.ts) is queryable and correct,
 * not just that it inserts without error.
 */
describe("Phase 1D RBAC (real disposable database)", () => {
  const roles = new RoleRepository();
  const modules = new ModuleRepository();
  const rolePermissions = new RolePermissionRepository();
  const userRoles = new UserRoleRepository();
  const users = new UserRepository();
  const moduleRegistry = new ModuleRegistryRepository();
  const authorizationActions = new AuthorizationActionRepository();

  beforeAll(async () => {
    const migrator = buildMigrator();
    await migrator.up();
  });

  afterAll(async () => {
    const migrator = buildMigrator();
    await migrator.down({ to: 0 });
    await closeConnection();
  });

  describe("seeded reference data", () => {
    it("lists exactly the 7 roles from 06_Roles_and_Permissions.md §1", async () => {
      const all = await roles.listAll();
      const keys = all.map((role) => role.key).sort();
      expect(keys).toEqual(
        [
          "super_admin",
          "owner_growth_approver",
          "marketing_editor",
          "designer_creative_reviewer",
          "developer",
          "qa_security_reviewer",
          "read_only",
        ].sort(),
      );
    });

    it("lists exactly the 21 modules from 06_Roles_and_Permissions.md §3", async () => {
      const all = await modules.listAll();
      expect(all).toHaveLength(21);
    });

    it("findByKey resolves a known role and module", async () => {
      expect((await roles.findByKey("super_admin"))?.name).toBe("Super Admin");
      expect((await modules.findByKey("business_knowledge"))?.name).toBe("Business Knowledge");
      expect(await roles.findByKey("no-such-role")).toBeNull();
    });
  });

  describe("RolePermissionRepository.hasGrant — matches the real matrix", () => {
    it("Super Admin has view+export on Business Knowledge", async () => {
      const superAdmin = await roles.findByKey("super_admin");
      const businessKnowledge = await modules.findByKey("business_knowledge");
      expect(await rolePermissions.hasGrant([superAdmin!.id], businessKnowledge!.id, "view")).toBe(
        true,
      );
      expect(
        await rolePermissions.hasGrant([superAdmin!.id], businessKnowledge!.id, "export"),
      ).toBe(true);
    });

    it("Read-Only has no grant at all on Users/roles (matrix says 'No')", async () => {
      const readOnly = await roles.findByKey("read_only");
      const usersRoles = await modules.findByKey("users_roles");
      expect(await rolePermissions.hasGrant([readOnly!.id], usersRoles!.id, "view")).toBe(false);
    });

    it("Marketing Editor can create+edit Page content but not approve it", async () => {
      const marketing = await roles.findByKey("marketing_editor");
      const pageContent = await modules.findByKey("page_content");
      expect(await rolePermissions.hasGrant([marketing!.id], pageContent!.id, "create")).toBe(true);
      expect(await rolePermissions.hasGrant([marketing!.id], pageContent!.id, "edit")).toBe(true);
      expect(await rolePermissions.hasGrant([marketing!.id], pageContent!.id, "approve")).toBe(
        false,
      );
    });

    it("P (Publish/Unpublish) expanded into two independently-checkable actions", async () => {
      const superAdmin = await roles.findByKey("super_admin");
      const pageContent = await modules.findByKey("page_content");
      expect(await rolePermissions.hasGrant([superAdmin!.id], pageContent!.id, "publish")).toBe(
        true,
      );
      expect(await rolePermissions.hasGrant([superAdmin!.id], pageContent!.id, "unpublish")).toBe(
        true,
      );
    });

    it("no confidential-field grant is pre-seeded for any role (Configurable/Limited by need, not automatic)", async () => {
      const superAdmin = await roles.findByKey("super_admin");
      const businessKnowledge = await modules.findByKey("business_knowledge");
      expect(
        await rolePermissions.hasGrant(
          [superAdmin!.id],
          businessKnowledge!.id,
          "view_confidential",
        ),
      ).toBe(false);
    });

    it("returns false immediately for an empty role-id list, without querying", async () => {
      const businessKnowledge = await modules.findByKey("business_knowledge");
      expect(await rolePermissions.hasGrant([], businessKnowledge!.id, "view")).toBe(false);
    });
  });

  describe("UserRoleRepository", () => {
    it("assigns and revokes a role for a user, real round-trip", async () => {
      const user = await users.create({
        email: "rbac-test@webdesksolution.com",
        displayName: "RBAC Test",
      });
      const developer = await roles.findByKey("developer");

      expect(await userRoles.hasRole(user.id, developer!.id)).toBe(false);

      await userRoles.assign(user.id, developer!.id);
      expect(await userRoles.hasRole(user.id, developer!.id)).toBe(true);
      expect(await userRoles.findRoleIdsForUser(user.id)).toEqual([developer!.id]);

      const revoked = await userRoles.revoke(user.id, developer!.id);
      expect(revoked).toBe(true);
      expect(await userRoles.hasRole(user.id, developer!.id)).toBe(false);

      // Idempotent: revoking again is not an error, just a no-op.
      expect(await userRoles.revoke(user.id, developer!.id)).toBe(false);
    });

    it("supports a user holding more than one role", async () => {
      const user = await users.create({
        email: "multi-role@webdesksolution.com",
        displayName: "Multi Role",
      });
      const developer = await roles.findByKey("developer");
      const qaSecurity = await roles.findByKey("qa_security_reviewer");

      await userRoles.assign(user.id, developer!.id);
      await userRoles.assign(user.id, qaSecurity!.id);

      const roleIds = await userRoles.findRoleIdsForUser(user.id);
      expect(roleIds.sort()).toEqual([developer!.id, qaSecurity!.id].sort());
    });

    it("enforces one assignment per (user, role) pair", async () => {
      const user = await users.create({
        email: "dup-role@webdesksolution.com",
        displayName: "Dup Role",
      });
      const developer = await roles.findByKey("developer");
      await userRoles.assign(user.id, developer!.id);
      await expect(userRoles.assign(user.id, developer!.id)).rejects.toThrow();
    });
  });

  describe("module registry (Phase 1D expanded — the 43 real modules)", () => {
    it("seeds exactly 43 modules, each resolving to one of the 21 real permission groups", async () => {
      const entries = await moduleRegistry.listAll();
      expect(entries).toHaveLength(43);

      const permissionGroupIds = new Set((await modules.listAll()).map((m) => m.id));
      for (const entry of entries) {
        expect(permissionGroupIds.has(entry.permissionGroupId)).toBe(true);
      }
    });

    it("finds a known entry by key with the expected permission-group mapping", async () => {
      const entry = await moduleRegistry.findByKey("users_roles_permissions");
      const usersRolesGroup = await modules.findByKey("users_roles");
      expect(entry).not.toBeNull();
      expect(entry!.permissionGroupId).toBe(usersRolesGroup!.id);
    });
  });

  describe("project-scoped authorization (Phase 1D expanded — migration 00016)", () => {
    it("a project-scoped role ASSIGNMENT is only visible within that project, but the role's own (global, seeded) permissions still apply once held", async () => {
      const user = await users.create({
        email: `project-scope-${randomUUID()}@webdesksolution.com`,
        displayName: "Project Scope Test",
      });
      const readOnly = await roles.findByKey("read_only");
      const businessKnowledge = await modules.findByKey("business_knowledge");
      const projectA = randomUUID();
      const projectB = randomUUID();

      await userRoles.assign(user.id, readOnly!.id, projectA);

      // The assignment itself is scoped: invisible with no project context, invisible in a
      // different project, visible only when checked against the exact project it was assigned to.
      const roleIdsGlobalOnly = await userRoles.findRoleIdsForUser(user.id);
      expect(roleIdsGlobalOnly).toEqual([]);

      const roleIdsForProjectA = await userRoles.findRoleIdsForUser(user.id, projectA);
      expect(roleIdsForProjectA).toContain(readOnly!.id);

      const roleIdsForProjectB = await userRoles.findRoleIdsForUser(user.id, projectB);
      expect(roleIdsForProjectB).toEqual([]);

      // Once a role is resolved as held (roleIdsForProjectA above), checking its grants uses the
      // role's own permission rows — all seeded globally (project_id IS NULL) in migration 00013,
      // since no project-specific grant has been created for any role. read_only's real "view"
      // grant on business_knowledge is therefore still found: project-scoping the *assignment*
      // controls WHERE a user is considered to hold a role, not a separate copy of what that role
      // can do. A genuinely project-specific *grant* (a role_permissions row with a real project_id)
      // would layer on top of this — no write API creates one yet (no admin UI for grant editing
      // exists in this phase), so that half of the axis is schema-ready but unexercised here.
      const grantedViaProjectScopedAssignment = await rolePermissions.hasGrant(
        roleIdsForProjectA,
        businessKnowledge!.id,
        "view",
      );
      expect(grantedViaProjectScopedAssignment).toBe(true);
    });

    it("hasRole/revoke correctly distinguish global vs. project-scoped assignment of the same role", async () => {
      const user = await users.create({
        email: `project-scope-hasrole-${randomUUID()}@webdesksolution.com`,
        displayName: "Project Scope HasRole Test",
      });
      const developer = await roles.findByKey("developer");
      const projectA = randomUUID();

      await userRoles.assign(user.id, developer!.id, projectA);

      expect(await userRoles.hasRole(user.id, developer!.id, null)).toBe(false);
      expect(await userRoles.hasRole(user.id, developer!.id, projectA)).toBe(true);

      // Revoking the global assignment (which doesn't exist) is a no-op; the project-scoped one remains.
      expect(await userRoles.revoke(user.id, developer!.id, null)).toBe(false);
      expect(await userRoles.hasRole(user.id, developer!.id, projectA)).toBe(true);

      expect(await userRoles.revoke(user.id, developer!.id, projectA)).toBe(true);
      expect(await userRoles.hasRole(user.id, developer!.id, projectA)).toBe(false);
    });

    it("allows the same user to hold the same role globally AND independently in a specific project", async () => {
      const user = await users.create({
        email: `project-scope-both-${randomUUID()}@webdesksolution.com`,
        displayName: "Project Scope Both Test",
      });
      const developer = await roles.findByKey("developer");
      const projectA = randomUUID();

      await userRoles.assign(user.id, developer!.id, null);
      await userRoles.assign(user.id, developer!.id, projectA);

      expect(await userRoles.hasRole(user.id, developer!.id, null)).toBe(true);
      expect(await userRoles.hasRole(user.id, developer!.id, projectA)).toBe(true);

      // Clean up both rows: leaving a duplicate (user_id, role_id) pair (differing only by
      // project_id) breaks this file's own afterAll migration rollback, which recreates
      // migration 00016's predecessor single-column unique(user_id, role_id) index.
      await userRoles.revoke(user.id, developer!.id, null);
      await userRoles.revoke(user.id, developer!.id, projectA);
    });
  });

  describe("authorization_actions (Phase 1D expanded — future separation-of-duties foundation)", () => {
    it("records an action and finds the actor for that specific resource/action-type", async () => {
      const user = await users.create({
        email: `authz-action-${randomUUID()}@webdesksolution.com`,
        displayName: "Authz Action Test",
      });

      await authorizationActions.record({
        actorId: user.id,
        actionType: "implemented",
        resourceType: "code_change",
        resourceId: "pr-123",
      });

      const actors = await authorizationActions.findActorsForResource(
        "code_change",
        "pr-123",
        "implemented",
      );
      expect(actors).toEqual([user.id]);

      // A different action type on the same resource finds no one — the query is action-type-specific.
      const reviewers = await authorizationActions.findActorsForResource(
        "code_change",
        "pr-123",
        "reviewed",
      );
      expect(reviewers).toEqual([]);
    });
  });
});
