import { randomBytes } from "node:crypto";
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
import { afterAll, beforeAll, describe, it } from "vitest";
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
import { JobsModule } from "../src/jobs/jobs.module.js";

/**
 * Request-level coverage for the Phase 1E job-architecture HTTP surface —
 * against a REAL disposable PostgreSQL database, same pattern as
 * ../test/authz.e2e-spec.ts. The point of this suite is proving
 * deny-by-default for real: `jobs_view`/`jobs_create`/`jobs_retry`/
 * `jobs_cancel` are new actions with ZERO `role_permissions` rows seeded
 * for them (docs/task-packages/phase-1e-job-architecture.md §3), so even a
 * `super_admin` session — which holds every OTHER seeded grant — is
 * correctly denied here. State-machine behavior (create/start/complete/
 * fail/retry/cancel) is already covered by unit tests against mocked
 * repositories and by packages/database's real-database integration
 * suite; this file's job is confirming the NestJS module graph resolves
 * with `JobsModule` newly imported, and that RBAC actually gates the
 * routes rather than merely being declared on them.
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

describe("Phase 1E jobs endpoints (e2e, real disposable database)", () => {
  let app: INestApplication;
  let users: UserRepository;
  let roles: RoleRepository;
  let userRoles: UserRoleRepository;
  let sessionService: SessionService;
  let authEnv: AuthEnv;

  let superAdminUserId: string;

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
      imports: [JobsModule],
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
      email: "jobs.super-admin.e2e@webdesksolution.com",
      displayName: "Jobs Super Admin E2E",
      accountStatus: "active",
    });
    superAdminUserId = superAdminUser.id;

    const superAdminRole = await roles.findByKey("super_admin");
    if (!superAdminRole) {
      throw new Error("Expected super_admin role was not seeded — check migration 00013");
    }
    await userRoles.assign(superAdminUserId, superAdminRole.id);
  }, 30_000);

  afterAll(async () => {
    await app.close();
    const migrator = buildMigrator();
    await migrator.down({ to: 0 });
    await closeConnection();
  }, 30_000);

  it("rejects GET /jobs with 401 when there is no session cookie", async () => {
    await request(app.getHttpServer()).get("/jobs").expect(401);
  });

  it("denies a real super_admin session with 403 — jobs_view has zero seeded grants", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer()).get("/jobs").set("Cookie", cookie).expect(403);
  });

  it("denies job creation with 403 — jobs_create has zero seeded grants", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .post("/jobs")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ jobType: "framework_probe" })
      .expect(403);
  });

  it("denies manual retry with 403 — jobs_retry has zero seeded grants", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .post("/jobs/00000000-0000-0000-0000-000000000000/retry")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .expect(403);
  });

  it("denies cancellation with 403 — jobs_cancel has zero seeded grants", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .post("/jobs/00000000-0000-0000-0000-000000000000/cancel")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .expect(403);
  });
});
