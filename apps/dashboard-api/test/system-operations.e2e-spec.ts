import { randomBytes, randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import {
  buildMigrator,
  closeConnection,
  getConnection,
  ModuleRepository,
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
import { SystemOperationsModule } from "../src/system-operations/system-operations.module.js";
import cookieParser from "cookie-parser";
import type { NextFunction, Response } from "express";

/**
 * Full request-level coverage for the Phase 1E system-events-health HTTP
 * surface (docs/task-packages/phase-1e-system-events-health.md §28-29) —
 * against a REAL disposable PostgreSQL database, the REAL seeded
 * `system_settings` module row, and a REAL super_admin session. Proves
 * the deny-by-default design directly: `system_health_view` and
 * `system_settings_configure` are zero-seeded actions on an already-
 * approved module, so even super_admin — who holds every *existing*
 * `system_settings` grant from the 00013 seed matrix — is denied until a
 * separate, later authorization seeds real grants for these two new
 * actions.
 */

process.env.GOOGLE_OAUTH_CLIENT_ID ??= "test-client-id";
process.env.GOOGLE_OAUTH_CLIENT_SECRET ??= "test-client-secret";
process.env.GOOGLE_OAUTH_REDIRECT_URI ??= "https://api.example.com/auth/google/callback";
process.env.WEB_APP_ORIGIN ??= "https://dashboard.example.com";
process.env.TOTP_ENCRYPTION_KEY ??= randomBytes(32).toString("hex");
process.env.SESSION_COOKIE_SECURE ??= "false";
process.env.AUTH_LOCKOUT_MAX_ATTEMPTS ??= "3";
process.env.AUTH_LOCKOUT_WINDOW_SECONDS ??= "900";
process.env.AUTH_LOCKOUT_DURATION_SECONDS ??= "900";

const WEB_APP_ORIGIN = process.env.WEB_APP_ORIGIN;

describe("Phase 1E system events & health endpoints (e2e, real disposable database)", () => {
  let app: INestApplication;
  let users: UserRepository;
  let roles: RoleRepository;
  let userRoles: UserRoleRepository;
  let modules: ModuleRepository;
  let sessionService: SessionService;
  let authEnv: AuthEnv;

  let superAdminUserId: string;
  let grantedUserId: string;

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
      imports: [SystemOperationsModule],
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
    modules = new ModuleRepository();

    const superAdminUser = await users.create({
      email: "sysops.super-admin.e2e@webdesksolution.com",
      displayName: "SysOps Super Admin E2E",
      accountStatus: "active",
    });
    const grantedUser = await users.create({
      email: "sysops.granted.e2e@webdesksolution.com",
      displayName: "SysOps Granted E2E",
      accountStatus: "active",
    });
    superAdminUserId = superAdminUser.id;
    grantedUserId = grantedUser.id;

    const superAdminRole = await roles.findByKey("super_admin");
    const readOnlyRole = await roles.findByKey("read_only");
    const systemSettingsModule = await modules.findByKey("system_settings");
    if (!superAdminRole || !readOnlyRole || !systemSettingsModule) {
      throw new Error("Expected role/module seed data not found — check migrations 00013/00015");
    }

    await userRoles.assign(superAdminUserId, superAdminRole.id);
    // grantedUser reuses read_only (which otherwise holds no system_settings grant at all) plus
    // two directly-inserted zero-seeded-in-production grants — proves the endpoint's own RBAC
    // wiring works once grants exist, while every other test proves nothing is seeded by default.
    await userRoles.assign(grantedUserId, readOnlyRole.id);
    const sequelize = getConnection();
    for (const action of ["system_health_view", "system_settings_configure"]) {
      await sequelize.query(
        `INSERT INTO role_permissions (id, role_id, module_id, action, created_at, updated_at)
         VALUES (:id, :roleId, :moduleId, :action, now(), now());`,
        {
          replacements: {
            id: randomUUID(),
            roleId: readOnlyRole.id,
            moduleId: systemSettingsModule.id,
            action,
          },
        },
      );
    }
  }, 30_000);

  afterAll(async () => {
    await app.close();
    const migrator = buildMigrator();
    await migrator.down({ to: 0 });
    await closeConnection();
  });

  describe("GET /system-events", () => {
    it("rejects with 401 when there is no session cookie", async () => {
      const response = await request(app.getHttpServer()).get("/system-events");
      expect(response.status).toBe(401);
    });

    it("denies super_admin — system_health_view is a zero-seeded action", async () => {
      const cookie = await cookieForNewSession(superAdminUserId);
      const response = await request(app.getHttpServer())
        .get("/system-events")
        .set("Cookie", cookie);
      expect(response.status).toBe(403);
    });

    it("allows a user whose role directly holds system_health_view", async () => {
      const cookie = await cookieForNewSession(grantedUserId);
      const response = await request(app.getHttpServer())
        .get("/system-events")
        .set("Cookie", cookie);
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe("GET /system-health/components", () => {
    it("denies super_admin", async () => {
      const cookie = await cookieForNewSession(superAdminUserId);
      const response = await request(app.getHttpServer())
        .get("/system-health/components")
        .set("Cookie", cookie);
      expect(response.status).toBe(403);
    });

    it("returns the 10 seeded components for a granted user", async () => {
      const cookie = await cookieForNewSession(grantedUserId);
      const response = await request(app.getHttpServer())
        .get("/system-health/components")
        .set("Cookie", cookie);
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(10);
    });
  });

  describe("GET /system-health/status", () => {
    it("reports 'unknown' for every component before any check has ever been recorded", async () => {
      const cookie = await cookieForNewSession(grantedUserId);
      const response = await request(app.getHttpServer())
        .get("/system-health/status")
        .set("Cookie", cookie);
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(10);
      expect(response.body.data.every((row: { status: string }) => row.status === "unknown")).toBe(
        true,
      );
    });
  });

  describe("POST /system-health/checks", () => {
    it("denies super_admin — system_settings_configure is a zero-seeded action", async () => {
      const cookie = await cookieForNewSession(superAdminUserId);
      const response = await request(app.getHttpServer())
        .post("/system-health/checks")
        .set("Origin", WEB_APP_ORIGIN as string)
        .set("Cookie", cookie)
        .send({ componentKey: "database", status: "healthy" });
      expect(response.status).toBe(403);
    });

    it("rejects with 403 when the Origin header is missing, before even checking permission", async () => {
      const cookie = await cookieForNewSession(grantedUserId);
      const response = await request(app.getHttpServer())
        .post("/system-health/checks")
        .set("Cookie", cookie)
        .send({ componentKey: "database", status: "healthy" });
      expect(response.status).toBe(403);
    });

    it("rejects an invalid status enum value at the validation layer", async () => {
      const cookie = await cookieForNewSession(grantedUserId);
      const response = await request(app.getHttpServer())
        .post("/system-health/checks")
        .set("Origin", WEB_APP_ORIGIN as string)
        .set("Cookie", cookie)
        .send({ componentKey: "database", status: "not-a-real-status" });
      expect(response.status).toBe(400);
    });

    it("rejects an unknown componentKey with 404", async () => {
      const cookie = await cookieForNewSession(grantedUserId);
      const response = await request(app.getHttpServer())
        .post("/system-health/checks")
        .set("Origin", WEB_APP_ORIGIN as string)
        .set("Cookie", cookie)
        .send({ componentKey: "not-a-real-component", status: "healthy" });
      expect(response.status).toBe(404);
    });

    it("records a real check and makes it visible via GET /system-health/status/:componentKey", async () => {
      const cookie = await cookieForNewSession(grantedUserId);
      const postResponse = await request(app.getHttpServer())
        .post("/system-health/checks")
        .set("Origin", WEB_APP_ORIGIN as string)
        .set("Cookie", cookie)
        .send({ componentKey: "database", status: "healthy", detail: "manual smoke check" });
      expect(postResponse.status).toBe(201);
      expect(postResponse.body.data).toMatchObject({ componentKey: "database", status: "healthy" });

      const statusResponse = await request(app.getHttpServer())
        .get("/system-health/status/database")
        .set("Cookie", cookie);
      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body.data).toMatchObject({
        componentKey: "database",
        status: "healthy",
      });
    });
  });

  describe("GET /system-health/status/:componentKey", () => {
    it("rejects an unknown componentKey with 404 — matching POST /system-health/checks's own validation, not a fabricated 'unknown' status", async () => {
      const cookie = await cookieForNewSession(grantedUserId);
      const response = await request(app.getHttpServer())
        .get("/system-health/status/not-a-real-component")
        .set("Cookie", cookie);
      expect(response.status).toBe(404);
    });
  });
});
