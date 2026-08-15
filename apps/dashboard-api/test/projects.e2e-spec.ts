import { randomBytes, randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import {
  buildMigrator,
  closeConnection,
  RoleRepository,
  UserRepository,
  UserRoleRepository,
} from "@webdesk/database";
import * as client from "openid-client";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import cookieParser from "cookie-parser";
import type { NextFunction, Response } from "express";
import { AllExceptionsFilter } from "../src/common/all-exceptions.filter.js";
import {
  CorrelationIdMiddleware,
  type RequestWithCorrelationId,
} from "../src/common/correlation-id.middleware.js";
import { AUTH_ENV, OIDC_CONFIGURATION } from "../src/auth/config/auth.constants.js";
import type { AuthEnv } from "../src/auth/config/auth-env.js";
import { SessionService } from "../src/auth/session/session.service.js";
import { ProjectsModule } from "../src/projects/projects.module.js";

/**
 * Request-level coverage for the Projects module HTTP surface
 * (docs/task-packages/module-projects-foundation.md), against a REAL disposable PostgreSQL
 * database — same pattern as ../test/operational-contacts.e2e-spec.ts. Unlike that module,
 * `project_configuration` has real seeded grants (00013-seed-rbac-matrix.ts), so this proves both
 * the positive path (super_admin can create/view/update/transition a project) and the negative
 * path (a view-only role is correctly denied mutation).
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

describe("Projects module endpoints (e2e, real disposable database)", () => {
  let app: INestApplication;
  let users: UserRepository;
  let roles: RoleRepository;
  let userRoles: UserRoleRepository;
  let sessionService: SessionService;
  let authEnv: AuthEnv;

  let superAdminUserId: string;
  let readOnlyUserId: string;

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
      imports: [ProjectsModule],
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

    const superAdminUser = await users.create({
      email: "projects.super-admin.e2e@webdesksolution.com",
      displayName: "Projects Super Admin E2E",
      accountStatus: "active",
    });
    superAdminUserId = superAdminUser.id;
    const superAdminRole = await roles.findByKey("super_admin");
    if (!superAdminRole) {
      throw new Error("Expected super_admin role was not seeded — check migration 00013");
    }
    await userRoles.assign(superAdminUserId, superAdminRole.id);

    const readOnlyUser = await users.create({
      email: "projects.read-only.e2e@webdesksolution.com",
      displayName: "Projects Read Only E2E",
      accountStatus: "active",
    });
    readOnlyUserId = readOnlyUser.id;
    const readOnlyRole = await roles.findByKey("read_only");
    if (!readOnlyRole) {
      throw new Error("Expected read_only role was not seeded — check migration 00013");
    }
    await userRoles.assign(readOnlyUserId, readOnlyRole.id);
  }, 30_000);

  afterAll(async () => {
    await app.close();
    const migrator = buildMigrator();
    await migrator.down({ to: 0 });
    await closeConnection();
  }, 30_000);

  it("rejects GET /projects with 401 when there is no session cookie", async () => {
    await request(app.getHttpServer()).get("/projects").expect(401);
  });

  it("allows a real super_admin session to create and read a project (real seeded grants)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const publicId = `e2e-${randomUUID()}`;

    const createResponse = await request(app.getHttpServer())
      .post("/projects")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId, name: "E2E Test Project" })
      .expect(201);

    expect(createResponse.body.success).toBe(true);
    expect(createResponse.body.data.status).toBe("active");
    const projectId = createResponse.body.data.id as string;

    const getResponse = await request(app.getHttpServer())
      .get(`/projects/${projectId}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(getResponse.body.data.publicId).toBe(publicId);
  });

  it("denies project creation with 403 for a read_only session (only V grant, not C)", async () => {
    const cookie = await cookieForNewSession(readOnlyUserId);
    await request(app.getHttpServer())
      .post("/projects")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: `denied-${randomUUID()}`, name: "Should Be Denied" })
      .expect(403);
  });

  it("allows a read_only session to list projects (V grant)", async () => {
    const cookie = await cookieForNewSession(readOnlyUserId);
    await request(app.getHttpServer()).get("/projects").set("Cookie", cookie).expect(200);
  });

  it("rejects an invalid status transition (archived -> active) with 400, via a real request", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const createResponse = await request(app.getHttpServer())
      .post("/projects")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: `transition-${randomUUID()}`, name: "Transition Test" })
      .expect(201);
    const projectId = createResponse.body.data.id as string;

    await request(app.getHttpServer())
      .post(`/projects/${projectId}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ status: "archived" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/projects/${projectId}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ status: "active" })
      .expect(400);
  });

  it("creates a roadmap item, sets it active, then rejects removing it (destructive-deletion guard)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const createResponse = await request(app.getHttpServer())
      .post("/projects")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: `roadmap-${randomUUID()}`, name: "Roadmap Test" })
      .expect(201);
    const projectId = createResponse.body.data.id as string;

    const roadmapResponse = await request(app.getHttpServer())
      .post(`/projects/${projectId}/roadmap-items`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ name: "Discovery" })
      .expect(201);
    const roadmapItemId = roadmapResponse.body.data.id as string;

    await request(app.getHttpServer())
      .post(`/projects/${projectId}/active-phase`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ roadmapItemId })
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/projects/${projectId}/roadmap-items/${roadmapItemId}`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .expect(400);
  });
});
