import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
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
});
