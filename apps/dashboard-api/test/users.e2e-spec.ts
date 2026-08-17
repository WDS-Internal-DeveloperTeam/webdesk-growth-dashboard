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
import { UsersModule } from "../src/users/users.module.js";

/**
 * Request-level coverage for the read-only user-lookup endpoint (`GET /users`, `GET /users/:id`) —
 * same pattern as `projects.e2e-spec.ts`, against a REAL disposable PostgreSQL database. Proves
 * both the positive path (a super_admin session, which already holds `users_roles:view`, can
 * search and resolve users) and the negative path (a role with no `users_roles` grant at all —
 * `read_only`, per the seeded matrix — is denied).
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

describe("Users lookup endpoints (e2e, real disposable database)", () => {
  let app: INestApplication;
  let users: UserRepository;
  let roles: RoleRepository;
  let userRoles: UserRoleRepository;
  let sessionService: SessionService;
  let authEnv: AuthEnv;

  let superAdminUserId: string;
  let readOnlyUserId: string;
  let searchTargetUserId: string;

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
      imports: [UsersModule],
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
      email: "users.super-admin.e2e@webdesksolution.com",
      displayName: "Users Super Admin E2E",
      accountStatus: "active",
    });
    superAdminUserId = superAdminUser.id;
    const superAdminRole = await roles.findByKey("super_admin");
    if (!superAdminRole) {
      throw new Error("Expected super_admin role was not seeded — check migration 00013");
    }
    await userRoles.assign(superAdminUserId, superAdminRole.id);

    const readOnlyUser = await users.create({
      email: "users.read-only.e2e@webdesksolution.com",
      displayName: "Users Read Only E2E",
      accountStatus: "active",
    });
    readOnlyUserId = readOnlyUser.id;
    const readOnlyRole = await roles.findByKey("read_only");
    if (!readOnlyRole) {
      throw new Error("Expected read_only role was not seeded — check migration 00013");
    }
    await userRoles.assign(readOnlyUserId, readOnlyRole.id);

    const searchTarget = await users.create({
      email: "findme.e2e@webdesksolution.com",
      displayName: "Findme Search Target",
      accountStatus: "active",
    });
    searchTargetUserId = searchTarget.id;
  }, 30_000);

  afterAll(async () => {
    await app.close();
    const migrator = buildMigrator();
    await migrator.down({ to: 0 });
    await closeConnection();
  }, 30_000);

  it("rejects GET /users with 401 when there is no session cookie", async () => {
    await request(app.getHttpServer()).get("/users").expect(401);
  });

  it("allows a real super_admin session to search users by name (real seeded users_roles grant)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const response = await request(app.getHttpServer())
      .get("/users")
      .query({ search: "Findme" })
      .set("Cookie", cookie)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual([
      {
        id: searchTargetUserId,
        displayName: "Findme Search Target",
        email: "findme.e2e@webdesksolution.com",
      },
    ]);
  });

  it("resolves a single user by id via GET /users/:userId", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const response = await request(app.getHttpServer())
      .get(`/users/${searchTargetUserId}`)
      .set("Cookie", cookie)
      .expect(200);

    expect(response.body.data).toEqual({
      id: searchTargetUserId,
      displayName: "Findme Search Target",
      email: "findme.e2e@webdesksolution.com",
    });
  });

  it("returns 404 for a nonexistent user id", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .get("/users/00000000-0000-0000-0000-000000000000")
      .set("Cookie", cookie)
      .expect(404);
  });

  it("denies GET /users with 403 for a read_only session (no users_roles grant at all)", async () => {
    const cookie = await cookieForNewSession(readOnlyUserId);
    await request(app.getHttpServer()).get("/users").set("Cookie", cookie).expect(403);
  });
});
