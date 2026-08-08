import { randomBytes } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import {
  AuthEventRepository,
  buildMigrator,
  closeConnection,
  RoleRepository,
  UserRepository,
  UserRoleRepository,
} from "@webdesk/database";
import * as client from "openid-client";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AllExceptionsFilter } from "../src/common/all-exceptions.filter.js";
import {
  CorrelationIdMiddleware,
  type RequestWithCorrelationId,
} from "../src/common/correlation-id.middleware.js";
import { AUTH_ENV, OIDC_CONFIGURATION } from "../src/auth/config/auth.constants.js";
import type { AuthEnv } from "../src/auth/config/auth-env.js";
import { SessionService } from "../src/auth/session/session.service.js";
import { AuthzModule } from "../src/authz/authz.module.js";
import cookieParser from "cookie-parser";
import type { NextFunction, Response } from "express";

/**
 * Full request-level coverage for the Phase 1D "Users/roles" HTTP surface —
 * against a REAL disposable PostgreSQL database (same discipline as
 * ../test/auth.e2e-spec.ts), exercising the REAL seeded role/module/
 * permission matrix from packages/database/src/migrations/00013 rather
 * than a mocked PermissionService. Sessions are issued directly via
 * `SessionService.issue()` (bypassing the login HTTP flow, which is
 * already covered end-to-end by auth.e2e-spec.ts) so this suite can focus
 * on `SessionGuard` + `PermissionGuard` + `OriginCheckGuard` composition
 * and the real deny-by-default grants.
 */

process.env.GOOGLE_OAUTH_CLIENT_ID ??= "test-client-id";
process.env.GOOGLE_OAUTH_CLIENT_SECRET ??= "test-client-secret";
process.env.GOOGLE_OAUTH_REDIRECT_URI ??= "https://api.example.com/auth/google/callback";
process.env.WEB_APP_ORIGIN ??= "https://dashboard.example.com";
process.env.TOTP_ENCRYPTION_KEY ??= randomBytes(32).toString("hex");
// Same disposable/local-only exception as auth.e2e-spec.ts — supertest talks
// plain HTTP, so a `Secure` cookie would never be resent by its cookie jar.
process.env.SESSION_COOKIE_SECURE ??= "false";
process.env.AUTH_LOCKOUT_MAX_ATTEMPTS ??= "3";
process.env.AUTH_LOCKOUT_WINDOW_SECONDS ??= "900";
process.env.AUTH_LOCKOUT_DURATION_SECONDS ??= "900";

const WEB_APP_ORIGIN = process.env.WEB_APP_ORIGIN;

describe("Phase 1D authz endpoints (e2e, real disposable database)", () => {
  let app: INestApplication;
  let users: UserRepository;
  let roles: RoleRepository;
  let userRoles: UserRoleRepository;
  let authEvents: AuthEventRepository;
  let sessionService: SessionService;
  let authEnv: AuthEnv;

  let superAdminUserId: string;
  let ownerUserId: string;
  let noAccessUserId: string;
  let targetUserId: string;
  let readOnlyRoleId: string;
  let ownerRoleId: string;

  async function cookieForNewSession(userId: string): Promise<string> {
    const { rawToken } = await sessionService.issue({
      userId,
      authMethod: "google_sso",
      requiresMfa: false,
    });
    return `${authEnv.SESSION_COOKIE_NAME}=${rawToken}`;
  }

  beforeAll(async () => {
    const migrator = buildMigrator();
    await migrator.up();

    const offlineOidcConfig = new client.Configuration(
      {
        issuer: "https://accounts.google.com",
        authorization_endpoint: "https://accounts.google.com/o/oauth2/v2/auth",
        token_endpoint: "https://oauth2.googleapis.com/token",
      },
      "test-client-id",
      "test-client-secret",
    );

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AuthzModule],
    })
      .overrideProvider(OIDC_CONFIGURATION)
      .useValue(offlineOidcConfig)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter());
    app.use(cookieParser());
    const correlationIdMiddleware = new CorrelationIdMiddleware();
    app.use((req: RequestWithCorrelationId, res: Response, next: NextFunction) =>
      correlationIdMiddleware.use(req, res, next),
    );
    await app.init();

    sessionService = moduleRef.get(SessionService);
    authEnv = moduleRef.get(AUTH_ENV);

    users = new UserRepository();
    roles = new RoleRepository();
    userRoles = new UserRoleRepository();
    authEvents = new AuthEventRepository();

    const superAdminUser = await users.create({
      email: "authz.super-admin.e2e@webdesksolution.com",
      displayName: "Authz Super Admin E2E",
      accountStatus: "active",
    });
    const ownerUser = await users.create({
      email: "authz.owner.e2e@webdesksolution.com",
      displayName: "Authz Owner E2E",
      accountStatus: "active",
    });
    const noAccessUser = await users.create({
      email: "authz.no-access.e2e@webdesksolution.com",
      displayName: "Authz No Access E2E",
      accountStatus: "active",
    });
    const targetUser = await users.create({
      email: "authz.target.e2e@webdesksolution.com",
      displayName: "Authz Target E2E",
      accountStatus: "active",
    });
    superAdminUserId = superAdminUser.id;
    ownerUserId = ownerUser.id;
    noAccessUserId = noAccessUser.id;
    targetUserId = targetUser.id;

    const superAdminRole = await roles.findByKey("super_admin");
    const ownerRole = await roles.findByKey("owner_growth_approver");
    const readOnlyRole = await roles.findByKey("read_only");
    if (!superAdminRole || !ownerRole || !readOnlyRole) {
      throw new Error("Expected roles were not seeded — check migration 00013");
    }
    ownerRoleId = ownerRole.id;
    readOnlyRoleId = readOnlyRole.id;

    await userRoles.assign(superAdminUserId, superAdminRole.id);
    await userRoles.assign(ownerUserId, ownerRole.id);
    // read_only holds no `users_roles` grant at all in the seeded matrix —
    // proves real deny-by-default against actual seed data, not a mock.
    await userRoles.assign(noAccessUserId, readOnlyRole.id);
  }, 30_000);

  afterAll(async () => {
    await app.close();
    const migrator = buildMigrator();
    await migrator.down({ to: 0 });
    await closeConnection();
  });

  describe("GET /authz/roles", () => {
    it("rejects with 401 when there is no session cookie", async () => {
      const response = await request(app.getHttpServer()).get("/authz/roles");
      expect(response.status).toBe(401);
    });

    it("allows super_admin (holds users_roles:view) and returns all 7 seeded roles", async () => {
      const cookie = await cookieForNewSession(superAdminUserId);
      const response = await request(app.getHttpServer()).get("/authz/roles").set("Cookie", cookie);
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(7);
      expect(response.body.data.map((r: { key: string }) => r.key)).toContain("super_admin");
    });

    it("allows owner_growth_approver (holds users_roles:view via the M-less V grant)", async () => {
      const cookie = await cookieForNewSession(ownerUserId);
      const response = await request(app.getHttpServer()).get("/authz/roles").set("Cookie", cookie);
      expect(response.status).toBe(200);
    });

    it("denies with 403 for a role with no users_roles grant at all (read_only)", async () => {
      const cookie = await cookieForNewSession(noAccessUserId);
      const response = await request(app.getHttpServer()).get("/authz/roles").set("Cookie", cookie);
      expect(response.status).toBe(403);
    });
  });

  describe("GET /authz/users/:userId/roles", () => {
    it("allows super_admin to list another user's roles", async () => {
      const cookie = await cookieForNewSession(superAdminUserId);
      const response = await request(app.getHttpServer())
        .get(`/authz/users/${targetUserId}/roles`)
        .set("Cookie", cookie);
      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
    });

    it("denies a no-access user", async () => {
      const cookie = await cookieForNewSession(noAccessUserId);
      const response = await request(app.getHttpServer())
        .get(`/authz/users/${targetUserId}/roles`)
        .set("Cookie", cookie);
      expect(response.status).toBe(403);
    });
  });

  describe("POST /authz/users/:userId/roles", () => {
    it("rejects with 403 when the Origin header is missing, before even checking permission", async () => {
      const cookie = await cookieForNewSession(superAdminUserId);
      const response = await request(app.getHttpServer())
        .post(`/authz/users/${targetUserId}/roles`)
        .set("Cookie", cookie)
        .send({ roleId: readOnlyRoleId });
      expect(response.status).toBe(403);
    });

    it("denies owner_growth_approver (holds users_roles:view+configure, not :edit)", async () => {
      const cookie = await cookieForNewSession(ownerUserId);
      const response = await request(app.getHttpServer())
        .post(`/authz/users/${targetUserId}/roles`)
        .set("Origin", WEB_APP_ORIGIN as string)
        .set("Cookie", cookie)
        .send({ roleId: readOnlyRoleId });
      expect(response.status).toBe(403);
    });

    it("rejects a non-UUID roleId at the validation layer", async () => {
      const cookie = await cookieForNewSession(superAdminUserId);
      const response = await request(app.getHttpServer())
        .post(`/authz/users/${targetUserId}/roles`)
        .set("Origin", WEB_APP_ORIGIN as string)
        .set("Cookie", cookie)
        .send({ roleId: "not-a-uuid" });
      expect(response.status).toBe(400);
    });

    it("assigns the role as super_admin and revokes the target user's existing session", async () => {
      const targetSessionCookie = await cookieForNewSession(targetUserId);
      const preAssignmentCheck = await request(app.getHttpServer())
        .get("/authz/roles")
        .set("Cookie", targetSessionCookie);
      // targetUser holds no role yet, so even reading /authz/roles is denied — this call only
      // proves the session itself is valid before assignment (SessionGuard passes, PermissionGuard denies).
      expect(preAssignmentCheck.status).toBe(403);

      const adminCookie = await cookieForNewSession(superAdminUserId);
      const assignResponse = await request(app.getHttpServer())
        .post(`/authz/users/${targetUserId}/roles`)
        .set("Origin", WEB_APP_ORIGIN as string)
        .set("Cookie", adminCookie)
        .send({ roleId: readOnlyRoleId });
      expect(assignResponse.status).toBe(200);
      expect(assignResponse.body.data).toEqual({ assigned: true });

      const afterAssignment = await request(app.getHttpServer())
        .get("/authz/roles")
        .set("Cookie", targetSessionCookie);
      // The pre-assignment session was revoked by the role change (knowledge/12
      // "Operational considerations") — the OLD cookie is now unauthenticated, not merely re-denied.
      expect(afterAssignment.status).toBe(401);
    });

    it("returns a conflict when the user already holds the role", async () => {
      const adminCookie = await cookieForNewSession(superAdminUserId);
      const response = await request(app.getHttpServer())
        .post(`/authz/users/${targetUserId}/roles`)
        .set("Origin", WEB_APP_ORIGIN as string)
        .set("Cookie", adminCookie)
        .send({ roleId: readOnlyRoleId });
      expect(response.status).toBe(409);
    });
  });

  describe("DELETE /authz/users/:userId/roles/:roleId", () => {
    it("revokes the role as super_admin and revokes the target user's existing session", async () => {
      const targetSessionCookie = await cookieForNewSession(targetUserId);

      const adminCookie = await cookieForNewSession(superAdminUserId);
      const revokeResponse = await request(app.getHttpServer())
        .delete(`/authz/users/${targetUserId}/roles/${readOnlyRoleId}`)
        .set("Origin", WEB_APP_ORIGIN as string)
        .set("Cookie", adminCookie);
      expect(revokeResponse.status).toBe(200);
      expect(revokeResponse.body.data).toEqual({ revoked: true });

      const afterRevocation = await request(app.getHttpServer())
        .get("/authz/roles")
        .set("Cookie", targetSessionCookie);
      expect(afterRevocation.status).toBe(401);

      const listAfter = await request(app.getHttpServer())
        .get(`/authz/users/${targetUserId}/roles`)
        .set("Cookie", adminCookie);
      expect(listAfter.body.data).toEqual([]);
    });

    it("denies owner_growth_approver (no :edit grant on users_roles)", async () => {
      const ownerCookie = await cookieForNewSession(ownerUserId);
      const response = await request(app.getHttpServer())
        .delete(`/authz/users/${targetUserId}/roles/${ownerRoleId}`)
        .set("Origin", WEB_APP_ORIGIN as string)
        .set("Cookie", ownerCookie);
      expect(response.status).toBe(403);
    });
  });

  describe("privilege escalation: self-role-assignment is blocked (Phase 1D expanded §21/§33)", () => {
    it("denies a super_admin assigning a role to themselves, even though they hold users_roles:edit", async () => {
      const adminCookie = await cookieForNewSession(superAdminUserId);
      const response = await request(app.getHttpServer())
        .post(`/authz/users/${superAdminUserId}/roles`)
        .set("Origin", WEB_APP_ORIGIN as string)
        .set("Cookie", adminCookie)
        .send({ roleId: ownerRoleId });
      expect(response.status).toBe(403);
      expect(response.body.error.message).toContain("Separation of duties");

      const events = await authEvents.findRecentByUserId(superAdminUserId, 5);
      expect(events[0]).toMatchObject({ eventType: "separation_of_duties_denied", success: false });
    });

    it("denies a super_admin revoking their own role", async () => {
      const adminCookie = await cookieForNewSession(superAdminUserId);
      const response = await request(app.getHttpServer())
        .delete(`/authz/users/${superAdminUserId}/roles/${ownerRoleId}`)
        .set("Origin", WEB_APP_ORIGIN as string)
        .set("Cookie", adminCookie);
      expect(response.status).toBe(403);
      expect(response.body.error.message).toContain("Separation of duties");

      const events = await authEvents.findRecentByUserId(superAdminUserId, 5);
      expect(events[0]).toMatchObject({ eventType: "separation_of_duties_denied", success: false });
    });
  });

  describe("GET /me/capabilities (Phase 1D expanded §15/§20)", () => {
    it("rejects with 401 when there is no session cookie", async () => {
      const response = await request(app.getHttpServer()).get("/me/capabilities");
      expect(response.status).toBe(401);
    });

    it("returns the caller's own effective capabilities without requiring users_roles:view", async () => {
      // noAccessUser holds read_only, which has no grant at all on users_roles — proves this
      // route is intentionally reachable without any PermissionGuard check (own doc comment).
      const cookie = await cookieForNewSession(noAccessUserId);
      const response = await request(app.getHttpServer())
        .get("/me/capabilities")
        .set("Cookie", cookie);
      expect(response.status).toBe(200);
      expect(response.body.data.business_knowledge).toContain("view");
      expect(response.body.data.users_roles).toBeUndefined();
    });

    it("never exposes another user's capabilities — only the caller's own", async () => {
      const adminCookie = await cookieForNewSession(superAdminUserId);
      const response = await request(app.getHttpServer())
        .get("/me/capabilities")
        .set("Cookie", adminCookie);
      expect(response.status).toBe(200);
      expect(response.body.data.users_roles).toContain("edit");
    });
  });

  describe("GET /authz/modules and /authz/module-registry (Phase 1D expanded catalog)", () => {
    it("rejects with 401 when there is no session cookie", async () => {
      const modulesResponse = await request(app.getHttpServer()).get("/authz/modules");
      expect(modulesResponse.status).toBe(401);
      const registryResponse = await request(app.getHttpServer()).get("/authz/module-registry");
      expect(registryResponse.status).toBe(401);
    });

    it("denies a no-access user (read_only holds no users_roles grant)", async () => {
      const cookie = await cookieForNewSession(noAccessUserId);
      const modulesResponse = await request(app.getHttpServer())
        .get("/authz/modules")
        .set("Cookie", cookie);
      expect(modulesResponse.status).toBe(403);
      const registryResponse = await request(app.getHttpServer())
        .get("/authz/module-registry")
        .set("Cookie", cookie);
      expect(registryResponse.status).toBe(403);
    });

    it("returns the 21 seeded permission groups for super_admin", async () => {
      const cookie = await cookieForNewSession(superAdminUserId);
      const response = await request(app.getHttpServer())
        .get("/authz/modules")
        .set("Cookie", cookie);
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(21);
    });

    it("returns the 43 real modules mapped to their permission group key for super_admin", async () => {
      const cookie = await cookieForNewSession(superAdminUserId);
      const response = await request(app.getHttpServer())
        .get("/authz/module-registry")
        .set("Cookie", cookie);
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(43);
      expect(
        response.body.data.every(
          (entry: { permissionGroupKey: string }) =>
            Boolean(entry.permissionGroupKey) && entry.permissionGroupKey !== "unknown",
        ),
      ).toBe(true);
    });
  });
});
