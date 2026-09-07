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
import { IntegrationsModule } from "../src/integrations/integrations.module.js";

/**
 * Request-level coverage for the Integrations module HTTP surface, against a REAL disposable
 * PostgreSQL database — same harness pattern as `brand-library.e2e-spec.ts`. The real seeded
 * `system_settings` RBAC group (`00013-seed-rbac-matrix.ts:266-269`) is unusually narrow — only
 * `super_admin` (VCERM) and `owner_growth_approver` (VM) hold anything at all; every other seeded
 * role holds nothing on this group, so a session for any of them must be denied every route,
 * including a bare `view`.
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

describe("Integrations module endpoints (e2e, real disposable database)", () => {
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

  async function createIntegration(cookie: string, overrides: Record<string, unknown> = {}) {
    const response = await request(app.getHttpServer())
      .post("/integrations")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        publicId: uniquePublicId("INT"),
        provider: "github",
        displayName: "E2E Fixture Integration",
        ...overrides,
      })
      .expect(201);
    return response.body.data as {
      id: string;
      status: string;
      isActive: boolean;
    };
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
      imports: [IntegrationsModule],
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

    superAdminUserId = await createUserWithRole("int.super-admin", "super_admin");
    ownerGrowthApproverUserId = await createUserWithRole(
      "int.owner-growth-approver",
      "owner_growth_approver",
    );
    readOnlyUserId = await createUserWithRole("int.read-only", "read_only");
  }, 30_000);

  afterAll(async () => {
    await app.close();
    const migrator = buildMigrator();
    await migrator.down({ to: 0 });
    await closeConnection();
  }, 30_000);

  it("rejects GET /integrations with 401 when there is no session cookie", async () => {
    await request(app.getHttpServer()).get("/integrations").expect(401);
  });

  describe("super_admin (VCERM) — full lifecycle", () => {
    it("creates, reads, lists, and edits an integration", async () => {
      const cookie = await cookieForNewSession(superAdminUserId);
      const created = await createIntegration(cookie, { displayName: "GitHub" });
      expect(created.status).toBe("not_configured");
      expect(created.isActive).toBe(true);

      const getResponse = await request(app.getHttpServer())
        .get(`/integrations/${created.id}`)
        .set("Cookie", cookie)
        .expect(200);
      expect(getResponse.body.data.displayName).toBe("GitHub");

      const listResponse = await request(app.getHttpServer())
        .get("/integrations")
        .set("Cookie", cookie)
        .expect(200);
      expect(
        (listResponse.body.data as Array<{ id: string }>).some((i) => i.id === created.id),
      ).toBe(true);

      const updateResponse = await request(app.getHttpServer())
        .post(`/integrations/${created.id}/update`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ displayName: "GitHub (renamed)" })
        .expect(200);
      expect(updateResponse.body.data.displayName).toBe("GitHub (renamed)");
      expect(updateResponse.body.data.status).toBe("not_configured"); // update never touches status
    });

    it("records a verification result, moving status to connected on success", async () => {
      const cookie = await cookieForNewSession(superAdminUserId);
      const created = await createIntegration(cookie);

      const verifyResponse = await request(app.getHttpServer())
        .post(`/integrations/${created.id}/verify`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ result: "success", notes: "Manually confirmed via GitHub App settings" })
        .expect(200);
      expect(verifyResponse.body.data.status).toBe("connected");
      expect(verifyResponse.body.data.lastVerificationResult).toBe("success");
      expect(verifyResponse.body.data.lastVerifiedAt).toBeTruthy();
    });

    it("records a verification failure, moving status to error", async () => {
      const cookie = await cookieForNewSession(superAdminUserId);
      const created = await createIntegration(cookie);

      const verifyResponse = await request(app.getHttpServer())
        .post(`/integrations/${created.id}/verify`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ result: "failure" })
        .expect(200);
      expect(verifyResponse.body.data.status).toBe("error");
    });

    it("toggles isActive (the retirement mechanism)", async () => {
      const cookie = await cookieForNewSession(superAdminUserId);
      const created = await createIntegration(cookie);

      const deactivated = await request(app.getHttpServer())
        .post(`/integrations/${created.id}/toggle-active`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ isActive: false })
        .expect(200);
      expect(deactivated.body.data.isActive).toBe(false);
    });

    it("rejects a fileReference-style unsafe URL and an empty update patch", async () => {
      const cookie = await cookieForNewSession(superAdminUserId);
      const created = await createIntegration(cookie);
      await request(app.getHttpServer())
        .post(`/integrations/${created.id}/update`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({})
        .expect(400);
    });

    it("rejects a duplicate publicId with 400", async () => {
      const cookie = await cookieForNewSession(superAdminUserId);
      const publicId = uniquePublicId("INT");
      await request(app.getHttpServer())
        .post("/integrations")
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ publicId, provider: "github", displayName: "First" })
        .expect(201);
      await request(app.getHttpServer())
        .post("/integrations")
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ publicId, provider: "github", displayName: "Second" })
        .expect(400);
    });

    it("returns 404 (not a raw 500) for a nonexistent integration id, and 400 for a malformed one", async () => {
      const cookie = await cookieForNewSession(superAdminUserId);
      await request(app.getHttpServer())
        .get(`/integrations/${randomUUID()}`)
        .set("Cookie", cookie)
        .expect(404);
      await request(app.getHttpServer())
        .get("/integrations/not-a-uuid")
        .set("Cookie", cookie)
        .expect(400);
    });

    it("rejects a mutating request with no Origin header (OriginCheckGuard)", async () => {
      const cookie = await cookieForNewSession(superAdminUserId);
      await request(app.getHttpServer())
        .post("/integrations")
        .set("Cookie", cookie)
        .send({ publicId: uniquePublicId("INT"), provider: "github", displayName: "No origin" })
        .expect(403);
    });
  });

  describe("owner_growth_approver (VM only) — view + configure, denied everything else", () => {
    it("can view/list but is denied create", async () => {
      const cookie = await cookieForNewSession(ownerGrowthApproverUserId);
      await request(app.getHttpServer()).get("/integrations").set("Cookie", cookie).expect(200);
      await request(app.getHttpServer())
        .post("/integrations")
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ publicId: uniquePublicId("INT"), provider: "github", displayName: "Denied" })
        .expect(403);
    });

    it("is denied edit and verify (no E, no R)", async () => {
      const adminCookie = await cookieForNewSession(superAdminUserId);
      const created = await createIntegration(adminCookie);
      const approverCookie = await cookieForNewSession(ownerGrowthApproverUserId);

      await request(app.getHttpServer())
        .post(`/integrations/${created.id}/update`)
        .set("Cookie", approverCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ displayName: "Denied" })
        .expect(403);

      await request(app.getHttpServer())
        .post(`/integrations/${created.id}/verify`)
        .set("Cookie", approverCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ result: "success" })
        .expect(403);
    });

    it("CAN toggle isActive — the one action beyond viewing (M grant)", async () => {
      const adminCookie = await cookieForNewSession(superAdminUserId);
      const created = await createIntegration(adminCookie);
      const approverCookie = await cookieForNewSession(ownerGrowthApproverUserId);

      const response = await request(app.getHttpServer())
        .post(`/integrations/${created.id}/toggle-active`)
        .set("Cookie", approverCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ isActive: false })
        .expect(200);
      expect(response.body.data.isActive).toBe(false);
    });
  });

  describe("read_only (no system_settings grant at all)", () => {
    it("is denied even a bare view — system_settings grants nothing to this role", async () => {
      const cookie = await cookieForNewSession(readOnlyUserId);
      await request(app.getHttpServer()).get("/integrations").set("Cookie", cookie).expect(403);
    });
  });

  describe("integration_environments sub-resource", () => {
    it("creates, lists, updates, and deletes an environment scoped to its parent integration", async () => {
      const cookie = await cookieForNewSession(superAdminUserId);
      const integration = await createIntegration(cookie);

      const createResponse = await request(app.getHttpServer())
        .post(`/integrations/${integration.id}/environments`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ environmentName: "staging" })
        .expect(201);
      const environmentId = createResponse.body.data.id as string;

      const listResponse = await request(app.getHttpServer())
        .get(`/integrations/${integration.id}/environments`)
        .set("Cookie", cookie)
        .expect(200);
      expect(listResponse.body.data).toHaveLength(1);

      const updateResponse = await request(app.getHttpServer())
        .post(`/integrations/${integration.id}/environments/${environmentId}/update`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ environmentName: "production" })
        .expect(200);
      expect(updateResponse.body.data.environmentName).toBe("production");

      await request(app.getHttpServer())
        .delete(`/integrations/${integration.id}/environments/${environmentId}`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .expect(204);

      await request(app.getHttpServer())
        .get(`/integrations/${integration.id}/environments/${environmentId}`)
        .set("Cookie", cookie)
        .expect(404);
    });

    it("honors a limit query param on the list route (code-review finding, fixed)", async () => {
      const cookie = await cookieForNewSession(superAdminUserId);
      const integration = await createIntegration(cookie);

      for (const environmentName of ["staging", "production", "qa"]) {
        await request(app.getHttpServer())
          .post(`/integrations/${integration.id}/environments`)
          .set("Cookie", cookie)
          .set("Origin", process.env.WEB_APP_ORIGIN!)
          .send({ environmentName })
          .expect(201);
      }

      const limitedResponse = await request(app.getHttpServer())
        .get(`/integrations/${integration.id}/environments?limit=2`)
        .set("Cookie", cookie)
        .expect(200);
      expect(limitedResponse.body.data).toHaveLength(2);
    });

    it("returns 404 (not the record) for a cross-integration environment access attempt — real IDOR scoping", async () => {
      const cookie = await cookieForNewSession(superAdminUserId);
      const integrationA = await createIntegration(cookie, { displayName: "Integration A" });
      const integrationB = await createIntegration(cookie, { displayName: "Integration B" });

      const createResponse = await request(app.getHttpServer())
        .post(`/integrations/${integrationA.id}/environments`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ environmentName: "staging" })
        .expect(201);
      const environmentOfAId = createResponse.body.data.id as string;

      // The environment belongs to integration A — requesting it under integration B's own path
      // must 404, never leak or mutate a row belonging to another integration.
      await request(app.getHttpServer())
        .get(`/integrations/${integrationB.id}/environments/${environmentOfAId}`)
        .set("Cookie", cookie)
        .expect(404);

      await request(app.getHttpServer())
        .post(`/integrations/${integrationB.id}/environments/${environmentOfAId}/update`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ environmentName: "hacked" })
        .expect(404);

      await request(app.getHttpServer())
        .delete(`/integrations/${integrationB.id}/environments/${environmentOfAId}`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .expect(404);

      // Confirm it's still there and untouched, scoped correctly under its real parent.
      const stillThere = await request(app.getHttpServer())
        .get(`/integrations/${integrationA.id}/environments/${environmentOfAId}`)
        .set("Cookie", cookie)
        .expect(200);
      expect(stillThere.body.data.environmentName).toBe("staging");
    });

    it("returns 404 when creating an environment under a nonexistent integration", async () => {
      const cookie = await cookieForNewSession(superAdminUserId);
      await request(app.getHttpServer())
        .post(`/integrations/${randomUUID()}/environments`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ environmentName: "staging" })
        .expect(404);
    });
  });

  describe("webhook_events — append-only, bare and scoped routes", () => {
    it("manually records an unmatched event (no integrationId) via the bare route", async () => {
      const cookie = await cookieForNewSession(superAdminUserId);
      const response = await request(app.getHttpServer())
        .post("/webhook-events")
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ eventType: "push" })
        .expect(201);
      expect(response.body.data.integrationId).toBeNull();
      expect(response.body.data.processingStatus).toBe("received");
    });

    it("records and lists an event scoped to its parent integration via the nested route", async () => {
      const cookie = await cookieForNewSession(superAdminUserId);
      const integration = await createIntegration(cookie);

      await request(app.getHttpServer())
        .post("/webhook-events")
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ integrationId: integration.id, eventType: "push" })
        .expect(201);

      const scopedList = await request(app.getHttpServer())
        .get(`/integrations/${integration.id}/webhook-events`)
        .set("Cookie", cookie)
        .expect(200);
      expect(scopedList.body.data).toHaveLength(1);
    });

    it("rejects a bare-route event referencing a nonexistent integration with 400", async () => {
      const cookie = await cookieForNewSession(superAdminUserId);
      await request(app.getHttpServer())
        .post("/webhook-events")
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ integrationId: randomUUID(), eventType: "push" })
        .expect(400);
    });

    it("has no update or delete route at all — immutable once created", async () => {
      const cookie = await cookieForNewSession(superAdminUserId);
      const createResponse = await request(app.getHttpServer())
        .post("/webhook-events")
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ eventType: "push" })
        .expect(201);
      const eventId = createResponse.body.data.id as string;

      await request(app.getHttpServer())
        .post(`/webhook-events/${eventId}/update`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({})
        .expect(404); // no such route exists

      await request(app.getHttpServer())
        .delete(`/webhook-events/${eventId}`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .expect(404); // no such route exists
    });
  });

  describe("secret_metadata sub-resource — never the value", () => {
    it("creates, lists, updates, and deletes secret metadata scoped to its parent integration", async () => {
      const cookie = await cookieForNewSession(superAdminUserId);
      const integration = await createIntegration(cookie);

      const createResponse = await request(app.getHttpServer())
        .post(`/integrations/${integration.id}/secret-metadata`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({
          secretName: "GITHUB_APP_PRIVATE_KEY",
          storageLocation: "Vercel env var — dashboard-api",
        })
        .expect(201);
      expect(createResponse.body.data.secretName).toBe("GITHUB_APP_PRIVATE_KEY");
      const secretId = createResponse.body.data.id as string;

      const listResponse = await request(app.getHttpServer())
        .get(`/integrations/${integration.id}/secret-metadata`)
        .set("Cookie", cookie)
        .expect(200);
      expect(listResponse.body.data).toHaveLength(1);

      const updateResponse = await request(app.getHttpServer())
        .post(`/integrations/${integration.id}/secret-metadata/${secretId}/update`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ notes: "Rotated quarterly" })
        .expect(200);
      expect(updateResponse.body.data.notes).toBe("Rotated quarterly");

      await request(app.getHttpServer())
        .delete(`/integrations/${integration.id}/secret-metadata/${secretId}`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .expect(204);
    });

    it("honors a limit query param on the list route (code-review finding, fixed)", async () => {
      const cookie = await cookieForNewSession(superAdminUserId);
      const integration = await createIntegration(cookie);

      for (const secretName of ["SECRET_ONE", "SECRET_TWO", "SECRET_THREE"]) {
        await request(app.getHttpServer())
          .post(`/integrations/${integration.id}/secret-metadata`)
          .set("Cookie", cookie)
          .set("Origin", process.env.WEB_APP_ORIGIN!)
          .send({ secretName, storageLocation: "Vercel env var — dashboard-api" })
          .expect(201);
      }

      const limitedResponse = await request(app.getHttpServer())
        .get(`/integrations/${integration.id}/secret-metadata?limit=2`)
        .set("Cookie", cookie)
        .expect(200);
      expect(limitedResponse.body.data).toHaveLength(2);
    });

    it("returns 404 (not the record) for a cross-integration secret-metadata access attempt — real IDOR scoping", async () => {
      const cookie = await cookieForNewSession(superAdminUserId);
      const integrationA = await createIntegration(cookie, { displayName: "Secret A" });
      const integrationB = await createIntegration(cookie, { displayName: "Secret B" });

      const createResponse = await request(app.getHttpServer())
        .post(`/integrations/${integrationA.id}/secret-metadata`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ secretName: "X", storageLocation: "Y" })
        .expect(201);
      const secretOfAId = createResponse.body.data.id as string;

      await request(app.getHttpServer())
        .get(`/integrations/${integrationB.id}/secret-metadata/${secretOfAId}`)
        .set("Cookie", cookie)
        .expect(404);

      await request(app.getHttpServer())
        .delete(`/integrations/${integrationB.id}/secret-metadata/${secretOfAId}`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .expect(404);
    });

    it("never accepts or exposes the secret value itself — only name/storageLocation/notes/rotation dates", async () => {
      const cookie = await cookieForNewSession(superAdminUserId);
      const integration = await createIntegration(cookie);

      const createResponse = await request(app.getHttpServer())
        .post(`/integrations/${integration.id}/secret-metadata`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({
          secretName: "X",
          storageLocation: "Y",
          lastRotatedAt: "2026-01-01T00:00:00.000Z",
        })
        .expect(201);
      expect(createResponse.body.data).not.toHaveProperty("value");
      expect(createResponse.body.data).not.toHaveProperty("secretValue");
      expect(createResponse.body.data.lastRotatedAt).toBeTruthy();
    });
  });
});
