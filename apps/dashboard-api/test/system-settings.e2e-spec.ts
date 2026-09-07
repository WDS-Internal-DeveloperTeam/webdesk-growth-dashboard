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
import { SystemSettingsModule } from "../src/system-settings/system-settings.module.js";

/**
 * Request-level coverage for the System Settings module HTTP surface, against a REAL disposable
 * PostgreSQL database — same harness pattern as `brand-library.e2e-spec.ts`. `system_settings`
 * (`00013-seed-rbac-matrix.ts:266-269`) has only two roles with any real access at all:
 *   super_admin                  VCERM  (view/create/edit/review/configure)
 *   owner_growth_approver        VM     (view/configure — no create, no edit)
 * Every other seeded role has NO access to this module.
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

describe("System Settings module endpoints (e2e, real disposable database)", () => {
  let app: INestApplication;
  let users: UserRepository;
  let roles: RoleRepository;
  let userRoles: UserRoleRepository;
  let sessionService: SessionService;
  let authEnv: AuthEnv;

  let superAdminUserId: string;
  let ownerGrowthApproverUserId: string;
  let readOnlyUserId: string;

  let counter = 0;
  function uniquePublicId(prefix: string): string {
    counter += 1;
    return `${prefix}-${Date.now()}-${counter}`;
  }
  function uniqueKey(prefix: string): string {
    counter += 1;
    return `${prefix}-${Date.now()}-${counter}`;
  }

  async function cookieForNewSession(userId: string): Promise<string> {
    const { rawToken } = await sessionService.issue({
      userId,
      authMethod: "google_sso",
      requiresMfa: false,
    });
    return `${authEnv.SESSION_COOKIE_NAME}=${rawToken}`;
  }

  async function createUserWithRole(emailPrefix: string, roleKey: string): Promise<string> {
    const user = await users.create({
      email: `${emailPrefix}.e2e@webdesksolution.com`,
      displayName: `${emailPrefix} E2E`,
      accountStatus: "active",
    });
    const role = await roles.findByKey(roleKey);
    if (!role) {
      throw new Error(`Expected ${roleKey} role was not seeded — check migration 00013`);
    }
    await userRoles.assign(user.id, role.id);
    return user.id;
  }

  async function createSetting(cookie: string, overrides: Record<string, unknown> = {}) {
    const response = await request(app.getHttpServer())
      .post("/system-settings/settings")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        publicId: uniquePublicId("SETTING"),
        settingType: "git_rule",
        key: uniqueKey("branch-pattern"),
        value: { pattern: "^(feature|fix)/[a-z0-9-]+$" },
        ...overrides,
      })
      .expect(201);
    return response.body.data as { id: string; isActive: boolean; settingType: string };
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
      imports: [SystemSettingsModule],
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

    superAdminUserId = await createUserWithRole("ss.super-admin", "super_admin");
    ownerGrowthApproverUserId = await createUserWithRole(
      "ss.owner-growth-approver",
      "owner_growth_approver",
    );
    readOnlyUserId = await createUserWithRole("ss.read-only", "read_only");
  }, 30_000);

  afterAll(async () => {
    await app.close();
    const migrator = buildMigrator();
    await migrator.down({ to: 0 });
    await closeConnection();
  }, 30_000);

  it("rejects GET /system-settings/settings with 401 when there is no session cookie", async () => {
    await request(app.getHttpServer()).get("/system-settings/settings").expect(401);
  });

  it("allows a real super_admin session to create, read, list, and edit a system setting", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createSetting(cookie, {
      key: uniqueKey("primary-fixture"),
      value: { pattern: "^feature/.*$" },
    });
    expect(created.isActive).toBe(true);

    const getResponse = await request(app.getHttpServer())
      .get(`/system-settings/settings/${created.id}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(getResponse.body.data.value).toEqual({ pattern: "^feature/.*$" });

    const listResponse = await request(app.getHttpServer())
      .get("/system-settings/settings")
      .set("Cookie", cookie)
      .expect(200);
    expect((listResponse.body.data as Array<{ id: string }>).some((s) => s.id === created.id)).toBe(
      true,
    );

    const updateResponse = await request(app.getHttpServer())
      .post(`/system-settings/settings/${created.id}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ value: { pattern: "^(feature|hotfix)/.*$" } })
      .expect(200);
    expect(updateResponse.body.data.value).toEqual({ pattern: "^(feature|hotfix)/.*$" });
  });

  it("denies system setting creation with 403 for a read_only session (no grant at all on this module)", async () => {
    const cookie = await cookieForNewSession(readOnlyUserId);
    await request(app.getHttpServer())
      .post("/system-settings/settings")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        publicId: uniquePublicId("SETTING"),
        settingType: "git_rule",
        key: uniqueKey("denied"),
        value: {},
      })
      .expect(403);
  });

  it("denies listing with 403 for a read_only session (this module grants no roles beyond super_admin/owner_growth_approver)", async () => {
    const cookie = await cookieForNewSession(readOnlyUserId);
    await request(app.getHttpServer())
      .get("/system-settings/settings")
      .set("Cookie", cookie)
      .expect(403);
  });

  it("denies system setting creation with 403 for owner_growth_approver (VM only, no C)", async () => {
    const cookie = await cookieForNewSession(ownerGrowthApproverUserId);
    await request(app.getHttpServer())
      .post("/system-settings/settings")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        publicId: uniquePublicId("SETTING"),
        settingType: "git_rule",
        key: uniqueKey("denied"),
        value: {},
      })
      .expect(403);
  });

  it("denies editing with 403 for owner_growth_approver (VM only, no E)", async () => {
    const adminCookie = await cookieForNewSession(superAdminUserId);
    const approverCookie = await cookieForNewSession(ownerGrowthApproverUserId);
    const created = await createSetting(adminCookie);

    await request(app.getHttpServer())
      .post(`/system-settings/settings/${created.id}/update`)
      .set("Cookie", approverCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ key: uniqueKey("attempted-rename") })
      .expect(403);
  });

  it("owner_growth_approver (holds M) can toggle isActive even though it cannot create or edit", async () => {
    const adminCookie = await cookieForNewSession(superAdminUserId);
    const approverCookie = await cookieForNewSession(ownerGrowthApproverUserId);
    const created = await createSetting(adminCookie);

    const response = await request(app.getHttpServer())
      .post(`/system-settings/settings/${created.id}/active-state`)
      .set("Cookie", approverCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ isActive: false })
      .expect(200);
    expect(response.body.data.isActive).toBe(false);
  });

  it("rejects system setting creation with 400 when publicId is already in use", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const publicId = uniquePublicId("SETTING");
    await request(app.getHttpServer())
      .post("/system-settings/settings")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        publicId,
        settingType: "git_rule",
        key: uniqueKey("first"),
        value: {},
      })
      .expect(201);
    await request(app.getHttpServer())
      .post("/system-settings/settings")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        publicId,
        settingType: "git_rule",
        key: uniqueKey("second"),
        value: {},
      })
      .expect(400);
  });

  it("rejects system setting creation with 400 when (settingType, key) is already in use", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const key = uniqueKey("duplicate-key");
    await request(app.getHttpServer())
      .post("/system-settings/settings")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: uniquePublicId("SETTING"), settingType: "git_rule", key, value: {} })
      .expect(201);
    await request(app.getHttpServer())
      .post("/system-settings/settings")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: uniquePublicId("SETTING"), settingType: "git_rule", key, value: {} })
      .expect(400);
  });

  it("allows the identical key across two different settingTypes (D3 — scoped, not global, uniqueness)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const key = uniqueKey("scoped-key");
    await request(app.getHttpServer())
      .post("/system-settings/settings")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: uniquePublicId("SETTING"), settingType: "git_rule", key, value: {} })
      .expect(201);
    await request(app.getHttpServer())
      .post("/system-settings/settings")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        publicId: uniquePublicId("SETTING"),
        settingType: "documentation_rule",
        key,
        value: {},
      })
      .expect(201);
  });

  it("rejects a value exceeding the 50,000-byte bounded-JSON cap with 400", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const largeValue = { blob: "x".repeat(60_000) };
    await request(app.getHttpServer())
      .post("/system-settings/settings")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        publicId: uniquePublicId("SETTING"),
        settingType: "file_limit",
        key: uniqueKey("oversized-value"),
        value: largeValue,
      })
      .expect(400);
  });

  it("rejects an empty update patch with 400 (no-op saves should be a clean rejection)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createSetting(cookie);
    await request(app.getHttpServer())
      .post(`/system-settings/settings/${created.id}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({})
      .expect(400);
  });

  it("clears the description field with an explicit null, distinct from omitting it", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createSetting(cookie, { description: "Some description" });

    const updateResponse = await request(app.getHttpServer())
      .post(`/system-settings/settings/${created.id}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ description: null })
      .expect(200);

    expect(updateResponse.body.data.description).toBeNull();
  });

  it("update route never accepts isActive (only the dedicated active-state route may change it)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createSetting(cookie);

    const updateResponse = await request(app.getHttpServer())
      .post(`/system-settings/settings/${created.id}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ key: uniqueKey("renamed"), isActive: false })
      .expect(200);
    // isActive is silently stripped by Zod (unknown key), never applied.
    expect(updateResponse.body.data.isActive).toBe(true);
  });

  describe("active-state (D4 — gated on 'configure', not 'edit')", () => {
    it("toggles isActive true -> false -> true as super_admin (holds both V C E R M)", async () => {
      const cookie = await cookieForNewSession(superAdminUserId);
      const created = await createSetting(cookie);

      const deactivated = await request(app.getHttpServer())
        .post(`/system-settings/settings/${created.id}/active-state`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ isActive: false })
        .expect(200);
      expect(deactivated.body.data.isActive).toBe(false);

      const reactivated = await request(app.getHttpServer())
        .post(`/system-settings/settings/${created.id}/active-state`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ isActive: true })
        .expect(200);
      expect(reactivated.body.data.isActive).toBe(true);
    });

    it("the expectedIsActive CAS guard rejects a stale toggle with 409, not a silent overwrite", async () => {
      const cookie = await cookieForNewSession(superAdminUserId);
      const created = await createSetting(cookie);

      // The row is really active (true); claim we expected it to already be inactive — a stale
      // read.
      await request(app.getHttpServer())
        .post(`/system-settings/settings/${created.id}/active-state`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ isActive: false, expectedIsActive: false })
        .expect(409);
    });

    it("returns 404 (not a raw 500) toggling active-state on a nonexistent system setting", async () => {
      const cookie = await cookieForNewSession(superAdminUserId);
      await request(app.getHttpServer())
        .post(`/system-settings/settings/${randomUUID()}/active-state`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ isActive: false })
        .expect(404);
    });

    it("denies active-state toggling with 403 for a read_only session (no grant at all)", async () => {
      const adminCookie = await cookieForNewSession(superAdminUserId);
      const readOnlyCookie = await cookieForNewSession(readOnlyUserId);
      const created = await createSetting(adminCookie);

      await request(app.getHttpServer())
        .post(`/system-settings/settings/${created.id}/active-state`)
        .set("Cookie", readOnlyCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ isActive: false })
        .expect(403);
    });
  });

  it("returns 404 for a GET on a nonexistent system setting id", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .get(`/system-settings/settings/${randomUUID()}`)
      .set("Cookie", cookie)
      .expect(404);
  });

  it("returns 400 (not a raw 500) for a malformed system setting id", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .get("/system-settings/settings/not-a-uuid")
      .set("Cookie", cookie)
      .expect(400);
  });

  it("rejects a mutating request with no Origin header (OriginCheckGuard)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .post("/system-settings/settings")
      .set("Cookie", cookie)
      .send({
        publicId: uniquePublicId("SETTING"),
        settingType: "git_rule",
        key: uniqueKey("no-origin"),
        value: {},
      })
      .expect(403);
  });
});
