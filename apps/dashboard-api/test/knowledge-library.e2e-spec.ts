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
import { KnowledgeLibraryModule } from "../src/knowledge-library/knowledge-library.module.js";

/**
 * Request-level coverage for the Knowledge Library module HTTP surface
 * (docs/implementation/module-knowledge-library.md), against a REAL disposable PostgreSQL
 * database — same harness pattern as ../test/business-knowledge.e2e-spec.ts, the closest sibling
 * (same reused `business_knowledge` RBAC group, same content-authoring-vs-status-governance split,
 * same single static "approve" gate on the status route rather than Persona/Service Library's
 * dynamic 3-tier submit/review/approve check). `marketing_editor` can create/edit but is denied
 * the status-transition route, which only `super_admin`/`owner_growth_approver` can reach.
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

describe("Knowledge Library module endpoints (e2e, real disposable database)", () => {
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
      imports: [KnowledgeLibraryModule],
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

    superAdminUserId = await createUserWithRole("knowledgelib.super-admin", "super_admin");
    readOnlyUserId = await createUserWithRole("knowledgelib.read-only", "read_only");
    marketingEditorUserId = await createUserWithRole(
      "knowledgelib.marketing-editor",
      "marketing_editor",
    );
  }, 30_000);

  afterAll(async () => {
    await app.close();
    const migrator = buildMigrator();
    await migrator.down({ to: 0 });
    await closeConnection();
  }, 30_000);

  it("rejects GET /knowledge-library/records with 401 when there is no session cookie", async () => {
    await request(app.getHttpServer()).get("/knowledge-library/records").expect(401);
  });

  it("allows a real super_admin session to create, read, list, and edit a record", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);

    const createResponse = await request(app.getHttpServer())
      .post("/knowledge-library/records")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        title: "E2E Reference doc",
        sourceType: "internal_wiki",
        location: "https://wiki.internal.example/page",
        ownerUserId: superAdminUserId,
        sourceDate: "2026-01-15",
      })
      .expect(201);

    expect(createResponse.body.success).toBe(true);
    expect(createResponse.body.data.status).toBe("draft");
    expect(createResponse.body.data.confidentiality).toBe("public");
    expect(createResponse.body.data.version).toBe(1);
    expect(createResponse.body.data.approvedForAgentUse).toBe(false);
    const recordId = createResponse.body.data.id as string;

    const getResponse = await request(app.getHttpServer())
      .get(`/knowledge-library/records/${recordId}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(getResponse.body.data.title).toBe("E2E Reference doc");
    expect(getResponse.body.data.ownerUserId).toBe(superAdminUserId);

    const listResponse = await request(app.getHttpServer())
      .get("/knowledge-library/records")
      .query({ sourceType: "internal_wiki" })
      .set("Cookie", cookie)
      .expect(200);
    expect((listResponse.body.data as Array<{ id: string }>).some((r) => r.id === recordId)).toBe(
      true,
    );

    const updateResponse = await request(app.getHttpServer())
      .post(`/knowledge-library/records/${recordId}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ title: "E2E Reference doc (revised)" })
      .expect(200);
    expect(updateResponse.body.data.title).toBe("E2E Reference doc (revised)");
    expect(updateResponse.body.data.status).toBe("draft"); // update never touches status
    expect(updateResponse.body.data.version).toBe(2); // update increments version server-side
  });

  it("denies record creation with 403 for a read_only session (only V grant, not C)", async () => {
    const cookie = await cookieForNewSession(readOnlyUserId);
    await request(app.getHttpServer())
      .post("/knowledge-library/records")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ title: "Denied" })
      .expect(403);
  });

  it("allows a read_only session to list records (V grant)", async () => {
    const cookie = await cookieForNewSession(readOnlyUserId);
    await request(app.getHttpServer())
      .get("/knowledge-library/records")
      .set("Cookie", cookie)
      .expect(200);
  });

  it("allows a marketing_editor session to create and edit, but denies the status-transition route (VCES, no A)", async () => {
    const cookie = await cookieForNewSession(marketingEditorUserId);

    const createResponse = await request(app.getHttpServer())
      .post("/knowledge-library/records")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ title: "Editor draft" })
      .expect(201);
    const recordId = createResponse.body.data.id as string;

    await request(app.getHttpServer())
      .post(`/knowledge-library/records/${recordId}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ title: "Revised editor draft" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/knowledge-library/records/${recordId}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ status: "mandatory" })
      .expect(403);
  });

  it("allows super_admin to approve a draft to mandatory via the status route", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const createResponse = await request(app.getHttpServer())
      .post("/knowledge-library/records")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ title: "Approval fixture" })
      .expect(201);
    const recordId = createResponse.body.data.id as string;

    const statusResponse = await request(app.getHttpServer())
      .post(`/knowledge-library/records/${recordId}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ status: "mandatory" })
      .expect(200);
    expect(statusResponse.body.data.status).toBe("mandatory");
  });

  it("rejects an invalid status transition (deprecated -> mandatory, deprecated is terminal) with 400", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const createResponse = await request(app.getHttpServer())
      .post("/knowledge-library/records")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ title: "Terminal fixture" })
      .expect(201);
    const recordId = createResponse.body.data.id as string;

    await request(app.getHttpServer())
      .post(`/knowledge-library/records/${recordId}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ status: "deprecated" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/knowledge-library/records/${recordId}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ status: "mandatory" })
      .expect(400);
  });

  it("returns 404 for a GET on a nonexistent record id", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .get(`/knowledge-library/records/${randomUUID()}`)
      .set("Cookie", cookie)
      .expect(404);
  });

  it("returns 400 (not a raw 500) for a malformed record id", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .get("/knowledge-library/records/not-a-uuid")
      .set("Cookie", cookie)
      .expect(400);
  });

  it("rejects a mutating request with no Origin header (OriginCheckGuard)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .post("/knowledge-library/records")
      .set("Cookie", cookie)
      .send({ title: "No origin" })
      .expect(403);
  });

  it("rejects record creation with 400 when ownerUserId does not resolve to an active user", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .post("/knowledge-library/records")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ title: "Bad owner", ownerUserId: randomUUID() })
      .expect(400);
  });

  it("rejects an update with 400 when a changed ownerUserId does not resolve to an active user", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const createResponse = await request(app.getHttpServer())
      .post("/knowledge-library/records")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ title: "Owner update fixture" })
      .expect(201);
    const recordId = createResponse.body.data.id as string;

    await request(app.getHttpServer())
      .post(`/knowledge-library/records/${recordId}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ ownerUserId: randomUUID() })
      .expect(400);
  });

  it("D1 — a record can be created directly as restricted, and its location/sourceType/notes are redacted for a caller with no view_confidential grant (zero-seeded — no role currently holds it, including super_admin)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const createResponse = await request(app.getHttpServer())
      .post("/knowledge-library/records")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        title: "Sensitive internal reference",
        sourceType: "board_only_strategy_memo",
        location: "https://internal.example/sensitive-doc",
        notes: "Also sensitive.",
        confidentiality: "restricted",
      })
      .expect(201);
    const recordId = createResponse.body.data.id as string;
    expect(createResponse.body.data.confidentiality).toBe("restricted");
    expect(createResponse.body.data.sourceType).toBeUndefined();
    expect(createResponse.body.data.location).toBeUndefined();
    expect(createResponse.body.data.notes).toBeUndefined();
    expect(createResponse.body.data.title).toBe("Sensitive internal reference");

    const getResponse = await request(app.getHttpServer())
      .get(`/knowledge-library/records/${recordId}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(getResponse.body.data.sourceType).toBeUndefined();
    expect(getResponse.body.data.location).toBeUndefined();
    expect(getResponse.body.data.notes).toBeUndefined();
    expect(getResponse.body.data.confidentiality).toBe("restricted");

    const listResponse = await request(app.getHttpServer())
      .get("/knowledge-library/records")
      .query({ confidentiality: "restricted" })
      .set("Cookie", cookie)
      .expect(200);
    const listed = (
      listResponse.body.data as Array<{
        id: string;
        sourceType?: string;
        location?: string;
        notes?: string;
      }>
    ).find((r) => r.id === recordId);
    expect(listed).toBeDefined();
    expect(listed?.sourceType).toBeUndefined();
    expect(listed?.location).toBeUndefined();
    expect(listed?.notes).toBeUndefined();
  });

  it("rejects editing a deprecated (terminal) record with 400, even for a caller holding edit", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const createResponse = await request(app.getHttpServer())
      .post("/knowledge-library/records")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ title: "About to be deprecated" })
      .expect(201);
    const recordId = createResponse.body.data.id as string;

    await request(app.getHttpServer())
      .post(`/knowledge-library/records/${recordId}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ status: "deprecated" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/knowledge-library/records/${recordId}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ title: "Trying to edit a deprecated record" })
      .expect(400);
  });

  it("finds a record by a fuzzy substring match on title via the search filter", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const uniqueTitle = `Searchable Onboarding Reference ${Date.now()}`;
    const createResponse = await request(app.getHttpServer())
      .post("/knowledge-library/records")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ title: uniqueTitle })
      .expect(201);
    const recordId = createResponse.body.data.id as string;

    const searchResponse = await request(app.getHttpServer())
      .get("/knowledge-library/records")
      .query({ search: "onboarding reference" })
      .set("Cookie", cookie)
      .expect(200);
    const found = (searchResponse.body.data as Array<{ id: string }>).find(
      (r) => r.id === recordId,
    );
    expect(found).toBeDefined();
  });

  it("D1 — confidentiality is independent of status: a restricted record can also be draft (not doubling as lifecycle, unlike Business Knowledge Center)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const createResponse = await request(app.getHttpServer())
      .post("/knowledge-library/records")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ title: "Draft and restricted", confidentiality: "restricted" })
      .expect(201);
    expect(createResponse.body.data.status).toBe("draft");
    expect(createResponse.body.data.confidentiality).toBe("restricted");
  });
});
