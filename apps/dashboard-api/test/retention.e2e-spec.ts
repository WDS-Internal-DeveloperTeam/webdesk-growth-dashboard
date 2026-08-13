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
import { RetentionModule } from "../src/retention/retention.module.js";

/**
 * Request-level coverage for the Phase 1E retention-architecture HTTP
 * surface — against a REAL disposable PostgreSQL database, same pattern as
 * ../test/jobs.e2e-spec.ts. Proves deny-by-default for real:
 * `retention_view`/`retention_configure`/`retention_hold` have ZERO
 * `role_permissions` rows seeded (docs/task-packages/phase-1e-retention-architecture.md
 * §3), so even a `super_admin` session is correctly denied here. There is
 * no cleanup/execute endpoint to test — `RetentionCleanupService` is
 * proven separately, at the service layer, in
 * ./retention-cleanup.e2e-spec.ts.
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

describe("Phase 1E retention endpoints (e2e, real disposable database)", () => {
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
      imports: [RetentionModule],
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
      email: "retention.super-admin.e2e@webdesksolution.com",
      displayName: "Retention Super Admin E2E",
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

  it("rejects GET /retention/policies with 401 when there is no session cookie", async () => {
    await request(app.getHttpServer()).get("/retention/policies").expect(401);
  });

  it("denies a real super_admin session with 403 — retention_view has zero seeded grants", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer()).get("/retention/policies").set("Cookie", cookie).expect(403);
  });

  it("denies hold creation with 403 — retention_hold has zero seeded grants", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .post("/retention/holds")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        scope: "category",
        categoryKey: "job-failed-120d",
        reasonCategory: "legal",
        reason: "test",
      })
      .expect(403);
  });

  it("denies eligibility checks with 403 — retention_view has zero seeded grants", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .post("/retention/eligibility")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        categoryKey: "job-failed-120d",
        resourceType: "jobs",
        resourceId: "00000000-0000-0000-0000-000000000000",
        anchorDate: new Date().toISOString(),
      })
      .expect(403);
  });
});
