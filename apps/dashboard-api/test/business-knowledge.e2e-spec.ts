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
import { BusinessKnowledgeModule } from "../src/business-knowledge/business-knowledge.module.js";

/**
 * Request-level coverage for the Business Knowledge Center module HTTP surface
 * (docs/task-packages/module-business-knowledge-center.md), against a REAL disposable PostgreSQL
 * database — same harness pattern as ../test/projects.e2e-spec.ts. `business_knowledge` has real
 * seeded grants (00013-seed-rbac-matrix.ts) that meaningfully differ per role — this proves the
 * content-authoring-vs-status-governance RBAC split (task package D4): `marketing_editor` can
 * create/edit but is denied the status-transition route, which only `super_admin`/
 * `owner_growth_approver` can reach.
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

describe("Business Knowledge Center module endpoints (e2e, real disposable database)", () => {
  let app: INestApplication;
  let users: UserRepository;
  let roles: RoleRepository;
  let userRoles: UserRoleRepository;
  let sessionService: SessionService;
  let authEnv: AuthEnv;

  let superAdminUserId: string;
  let readOnlyUserId: string;
  let marketingEditorUserId: string;

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
      imports: [BusinessKnowledgeModule],
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

    superAdminUserId = await createUserWithRole("bkc.super-admin", "super_admin");
    readOnlyUserId = await createUserWithRole("bkc.read-only", "read_only");
    marketingEditorUserId = await createUserWithRole("bkc.marketing-editor", "marketing_editor");
  }, 30_000);

  afterAll(async () => {
    await app.close();
    const migrator = buildMigrator();
    await migrator.down({ to: 0 });
    await closeConnection();
  }, 30_000);

  it("rejects GET /business-knowledge/records with 401 when there is no session cookie", async () => {
    await request(app.getHttpServer()).get("/business-knowledge/records").expect(401);
  });

  it("allows a real super_admin session to create, read, list, and edit a record", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);

    const createResponse = await request(app.getHttpServer())
      .post("/business-knowledge/records")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ recordType: "vto", title: "E2E VTO", content: "Vision, traction, organizer." })
      .expect(201);

    expect(createResponse.body.success).toBe(true);
    expect(createResponse.body.data.status).toBe("draft");
    const recordId = createResponse.body.data.id as string;

    const getResponse = await request(app.getHttpServer())
      .get(`/business-knowledge/records/${recordId}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(getResponse.body.data.title).toBe("E2E VTO");

    const listResponse = await request(app.getHttpServer())
      .get("/business-knowledge/records")
      .query({ recordType: "vto" })
      .set("Cookie", cookie)
      .expect(200);
    expect((listResponse.body.data as Array<{ id: string }>).some((r) => r.id === recordId)).toBe(
      true,
    );

    const updateResponse = await request(app.getHttpServer())
      .post(`/business-knowledge/records/${recordId}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ title: "E2E VTO (revised)" })
      .expect(200);
    expect(updateResponse.body.data.title).toBe("E2E VTO (revised)");
    expect(updateResponse.body.data.status).toBe("draft"); // update never touches status
  });

  it("denies record creation with 403 for a read_only session (only V grant, not C)", async () => {
    const cookie = await cookieForNewSession(readOnlyUserId);
    await request(app.getHttpServer())
      .post("/business-knowledge/records")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ recordType: "competitor", title: "Denied", content: "x" })
      .expect(403);
  });

  it("allows a read_only session to list records (V grant)", async () => {
    const cookie = await cookieForNewSession(readOnlyUserId);
    await request(app.getHttpServer())
      .get("/business-knowledge/records")
      .set("Cookie", cookie)
      .expect(200);
  });

  it("allows a marketing_editor session to create and edit, but denies the status-transition route (VCES, no A)", async () => {
    const cookie = await cookieForNewSession(marketingEditorUserId);

    const createResponse = await request(app.getHttpServer())
      .post("/business-knowledge/records")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ recordType: "approved_messaging", title: "Tagline draft", content: "Draft copy." })
      .expect(201);
    const recordId = createResponse.body.data.id as string;

    await request(app.getHttpServer())
      .post(`/business-knowledge/records/${recordId}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ content: "Revised draft copy." })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/business-knowledge/records/${recordId}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ status: "mandatory" })
      .expect(403);
  });

  it("allows super_admin to approve a draft to mandatory via the status route", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const createResponse = await request(app.getHttpServer())
      .post("/business-knowledge/records")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ recordType: "service_taxonomy", title: "Taxonomy", content: "x" })
      .expect(201);
    const recordId = createResponse.body.data.id as string;

    const statusResponse = await request(app.getHttpServer())
      .post(`/business-knowledge/records/${recordId}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ status: "mandatory" })
      .expect(200);
    expect(statusResponse.body.data.status).toBe("mandatory");
  });

  it("rejects an invalid status transition (deprecated -> mandatory, deprecated is terminal) with 400", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const createResponse = await request(app.getHttpServer())
      .post("/business-knowledge/records")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ recordType: "engagement_model", title: "Model", content: "x" })
      .expect(201);
    const recordId = createResponse.body.data.id as string;

    await request(app.getHttpServer())
      .post(`/business-knowledge/records/${recordId}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ status: "deprecated" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/business-knowledge/records/${recordId}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ status: "mandatory" })
      .expect(400);
  });

  it("returns 404 for a GET on a nonexistent record id", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .get(`/business-knowledge/records/${randomUUID()}`)
      .set("Cookie", cookie)
      .expect(404);
  });

  it("rejects a mutating request with no Origin header (OriginCheckGuard)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .post("/business-knowledge/records")
      .set("Cookie", cookie)
      .send({ recordType: "vto", title: "No origin", content: "x" })
      .expect(403);
  });

  it("returns 400 (not a raw 500) for a malformed record id", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .get("/business-knowledge/records/not-a-uuid")
      .set("Cookie", cookie)
      .expect(400);
  });

  it("redacts content/notes on a restricted record for a caller with no view_confidential grant (zero-seeded — no role currently holds it, including super_admin)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const createResponse = await request(app.getHttpServer())
      .post("/business-knowledge/records")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        recordType: "competitor",
        title: "Sensitive competitor intel",
        content: "The actually sensitive part.",
        notes: "Also sensitive.",
      })
      .expect(201);
    const recordId = createResponse.body.data.id as string;

    const restrictResponse = await request(app.getHttpServer())
      .post(`/business-knowledge/records/${recordId}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ status: "restricted" })
      .expect(200);
    expect(restrictResponse.body.data.content).toBeUndefined();
    expect(restrictResponse.body.data.notes).toBeUndefined();
    expect(restrictResponse.body.data.title).toBe("Sensitive competitor intel");

    const getResponse = await request(app.getHttpServer())
      .get(`/business-knowledge/records/${recordId}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(getResponse.body.data.content).toBeUndefined();
    expect(getResponse.body.data.notes).toBeUndefined();
    expect(getResponse.body.data.status).toBe("restricted");

    const listResponse = await request(app.getHttpServer())
      .get("/business-knowledge/records")
      .query({ status: "restricted" })
      .set("Cookie", cookie)
      .expect(200);
    const listed = (
      listResponse.body.data as Array<{ id: string; content?: string; notes?: string }>
    ).find((r) => r.id === recordId);
    expect(listed).toBeDefined();
    expect(listed?.content).toBeUndefined();
    expect(listed?.notes).toBeUndefined();
  });
});
