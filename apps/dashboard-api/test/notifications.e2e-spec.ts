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
import { NotificationsModule } from "../src/notifications/notifications.module.js";

/**
 * Request-level coverage for the Phase 1E notification-foundation HTTP
 * surface — against a REAL disposable PostgreSQL database, same pattern as
 * ../test/jobs.e2e-spec.ts. Proves deny-by-default for real:
 * `notifications_view`/`notifications_configure` have ZERO
 * `role_permissions` rows seeded (docs/task-packages/phase-1e-notification-foundation.md
 * §6), so even a `super_admin` session is correctly denied here.
 * State-machine behavior is already covered by unit tests against a fake
 * delivery adapter and by packages/database's real-database integration
 * suite; this file confirms the NestJS module graph resolves with
 * `NotificationsModule` newly imported, and that RBAC actually gates the
 * routes.
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

describe("Phase 1E notifications endpoints (e2e, real disposable database)", () => {
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
      imports: [NotificationsModule],
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
      email: "notifications.super-admin.e2e@webdesksolution.com",
      displayName: "Notifications Super Admin E2E",
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

  it("rejects GET /notifications with 401 when there is no session cookie", async () => {
    await request(app.getHttpServer()).get("/notifications").expect(401);
  });

  it("denies a real super_admin session with 403 — notifications_view has zero seeded grants", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer()).get("/notifications").set("Cookie", cookie).expect(403);
  });

  it("denies notification creation with 403 — notifications_configure has zero seeded grants", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .post("/notifications")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ notificationType: "framework_probe", severity: "medium", subject: "Test" })
      .expect(403);
  });

  it("denies attempt-delivery with 403 — notifications_configure has zero seeded grants", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .post("/notifications/00000000-0000-0000-0000-000000000000/attempt-delivery")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .expect(403);
  });
});
