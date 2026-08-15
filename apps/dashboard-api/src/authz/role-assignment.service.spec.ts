import type {
  AuthEventRepository,
  RoleRepository,
  UserRepository,
  UserRoleRepository,
} from "@webdesk/database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionService } from "../auth/session/session.service.js";
import { SeparationOfDutiesService } from "../auth/common/separation-of-duties.service.js";
import type { AuditService } from "../audit/audit.service.js";
import { RoleAssignmentService } from "./role-assignment.service.js";

const ROLE = { id: "role-1", key: "owner", name: "Owner" };
const NOW = new Date("2026-08-07T00:00:00.000Z");

describe("RoleAssignmentService", () => {
  let roles: { listAll: ReturnType<typeof vi.fn>; findById: ReturnType<typeof vi.fn> };
  let userRoles: {
    findRoleIdsForUser: ReturnType<typeof vi.fn>;
    hasRole: ReturnType<typeof vi.fn>;
    assign: ReturnType<typeof vi.fn>;
    revoke: ReturnType<typeof vi.fn>;
  };
  let users: { findById: ReturnType<typeof vi.fn> };
  let events: { record: ReturnType<typeof vi.fn> };
  let sessionService: { revokeAllForUser: ReturnType<typeof vi.fn> };
  let auditService: { record: ReturnType<typeof vi.fn> };
  let service: RoleAssignmentService;

  beforeEach(() => {
    roles = { listAll: vi.fn(), findById: vi.fn() };
    userRoles = {
      findRoleIdsForUser: vi.fn(),
      hasRole: vi.fn(),
      assign: vi.fn(),
      revoke: vi.fn(),
    };
    users = { findById: vi.fn() };
    events = { record: vi.fn() };
    sessionService = { revokeAllForUser: vi.fn() };
    auditService = { record: vi.fn() };
    service = new RoleAssignmentService(
      roles as unknown as RoleRepository,
      userRoles as unknown as UserRoleRepository,
      users as unknown as UserRepository,
      events as unknown as AuthEventRepository,
      sessionService as unknown as SessionService,
      // Same `auditService` mock passed to both constructors — SeparationOfDutiesService now
      // records its own security_exception audit event on denial, so assertions below checking
      // `auditService.record` see that call regardless of which service actually made it.
      new SeparationOfDutiesService(
        { findActorsForResource: vi.fn(), record: vi.fn() } as never,
        auditService as unknown as AuditService,
      ),
      auditService as unknown as AuditService,
    );
  });

  describe("listRoles", () => {
    it("returns every seeded role", async () => {
      roles.listAll.mockResolvedValue([ROLE]);
      expect(await service.listRoles()).toEqual([ROLE]);
    });
  });

  describe("listRolesForUser", () => {
    it("throws when the target user does not exist", async () => {
      users.findById.mockResolvedValue(null);
      await expect(service.listRolesForUser("no-such-user")).rejects.toThrow(/User not found/);
      expect(userRoles.findRoleIdsForUser).not.toHaveBeenCalled();
    });

    it("resolves held role ids to role entities, dropping any that no longer resolve", async () => {
      users.findById.mockResolvedValue({ id: "user-1" });
      userRoles.findRoleIdsForUser.mockResolvedValue(["role-1", "role-stale"]);
      roles.findById.mockImplementation((id: string) =>
        Promise.resolve(id === "role-1" ? ROLE : null),
      );

      expect(await service.listRolesForUser("user-1")).toEqual([ROLE]);
    });
  });

  describe("assignRole", () => {
    it("throws when the actor targets their own account, before touching any repository", async () => {
      await expect(service.assignRole("actor-1", "role-1", "actor-1", NOW)).rejects.toThrow(
        /Separation of duties/,
      );
      expect(users.findById).not.toHaveBeenCalled();
      expect(userRoles.assign).not.toHaveBeenCalled();
    });

    it("records a separation_of_duties_denied event when the actor targets their own account", async () => {
      await expect(service.assignRole("actor-1", "role-1", "actor-1", NOW)).rejects.toThrow();
      expect(events.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "separation_of_duties_denied",
          userId: "actor-1",
          success: false,
        }),
      );
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "security_exception",
          actorUserId: "actor-1",
          action: "separation_of_duties_denied",
        }),
      );
    });

    it("throws when the target user does not exist", async () => {
      users.findById.mockResolvedValue(null);
      await expect(service.assignRole("no-such-user", "role-1", "actor-1", NOW)).rejects.toThrow(
        /User not found/,
      );
    });

    it("throws when the role does not exist", async () => {
      users.findById.mockResolvedValue({ id: "user-1" });
      roles.findById.mockResolvedValue(null);
      await expect(service.assignRole("user-1", "no-such-role", "actor-1", NOW)).rejects.toThrow(
        /Role not found/,
      );
    });

    it("throws a conflict when the user already holds the role, without assigning or revoking sessions", async () => {
      users.findById.mockResolvedValue({ id: "user-1" });
      roles.findById.mockResolvedValue(ROLE);
      userRoles.hasRole.mockResolvedValue(true);

      await expect(service.assignRole("user-1", "role-1", "actor-1", NOW)).rejects.toThrow(
        /already holds role/,
      );
      expect(userRoles.assign).not.toHaveBeenCalled();
      expect(sessionService.revokeAllForUser).not.toHaveBeenCalled();
    });

    it("assigns the role, records a role_assigned event, and revokes the user's sessions", async () => {
      users.findById.mockResolvedValue({ id: "user-1" });
      roles.findById.mockResolvedValue(ROLE);
      userRoles.hasRole.mockResolvedValue(false);

      await service.assignRole("user-1", "role-1", "actor-1", NOW);

      // Third arg is `projectId`, defaulting to null (global scope) — added for the Projects
      // module's project-scoped role assignment (docs/task-packages/module-projects-foundation.md D4).
      expect(userRoles.assign).toHaveBeenCalledWith("user-1", "role-1", null);
      expect(events.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "role_assigned",
          userId: "user-1",
          success: true,
          reason: expect.stringContaining("owner"),
        }),
      );
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "permission_change",
          actorUserId: "actor-1",
          entityId: "user-1",
          action: "role_assigned",
          retentionCategory: "approval-audit-7y",
        }),
      );
      expect(sessionService.revokeAllForUser).toHaveBeenCalledWith("user-1", "role-change", NOW);
    });
  });

  describe("revokeRole", () => {
    it("throws when the actor targets their own account, before touching any repository", async () => {
      await expect(service.revokeRole("actor-1", "role-1", "actor-1", NOW)).rejects.toThrow(
        /Separation of duties/,
      );
      expect(users.findById).not.toHaveBeenCalled();
      expect(userRoles.revoke).not.toHaveBeenCalled();
    });

    it("records a separation_of_duties_denied event when the actor targets their own account", async () => {
      await expect(service.revokeRole("actor-1", "role-1", "actor-1", NOW)).rejects.toThrow();
      expect(events.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "separation_of_duties_denied",
          userId: "actor-1",
          success: false,
        }),
      );
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "security_exception",
          actorUserId: "actor-1",
          action: "separation_of_duties_denied",
        }),
      );
    });

    it("throws when the target user does not exist", async () => {
      users.findById.mockResolvedValue(null);
      await expect(service.revokeRole("no-such-user", "role-1", "actor-1", NOW)).rejects.toThrow(
        /User not found/,
      );
    });

    it("throws when the role does not exist", async () => {
      users.findById.mockResolvedValue({ id: "user-1" });
      roles.findById.mockResolvedValue(null);
      await expect(service.revokeRole("user-1", "no-such-role", "actor-1", NOW)).rejects.toThrow(
        /Role not found/,
      );
    });

    it("is an idempotent no-op when the user did not hold the role — no event, no session revocation", async () => {
      users.findById.mockResolvedValue({ id: "user-1" });
      roles.findById.mockResolvedValue(ROLE);
      userRoles.revoke.mockResolvedValue(false);

      await service.revokeRole("user-1", "role-1", "actor-1", NOW);

      expect(events.record).not.toHaveBeenCalled();
      expect(sessionService.revokeAllForUser).not.toHaveBeenCalled();
    });

    it("records a role_revoked event and revokes sessions when a role was actually removed", async () => {
      users.findById.mockResolvedValue({ id: "user-1" });
      roles.findById.mockResolvedValue(ROLE);
      userRoles.revoke.mockResolvedValue(true);

      await service.revokeRole("user-1", "role-1", "actor-1", NOW);

      expect(events.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "role_revoked", userId: "user-1", success: true }),
      );
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "permission_change",
          actorUserId: "actor-1",
          entityId: "user-1",
          action: "role_revoked",
          retentionCategory: "approval-audit-7y",
        }),
      );
      expect(sessionService.revokeAllForUser).toHaveBeenCalledWith("user-1", "role-change", NOW);
    });
  });
});
