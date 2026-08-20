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
import type { BlobStorageAdapter } from "@webdesk/integrations";
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
import { BLOB_STORAGE_ADAPTER } from "../src/business-knowledge/business-knowledge.constants.js";
import { BusinessKnowledgeModule } from "../src/business-knowledge/business-knowledge.module.js";

/**
 * An in-memory `BlobStorageAdapter` fake, substituted for the real `VercelBlobAdapter` in this
 * suite — no real Vercel Blob store/token is provisioned in this environment (or any CI
 * environment this project runs in), matching the "mock behind the adapter" testing convention
 * (`knowledge/08-vercel-blob-and-file-handling.md`'s object-storage adapter rule). `handleClientUploadRequest()`
 * is a minimal stub — exercising Vercel's own client-token protocol end-to-end isn't meaningful
 * without a real store; the RBAC/prefix-validation logic inside `onBeforeGenerateToken` is
 * covered directly by `business-knowledge-attachments.service.spec.ts`'s unit tests instead. This
 * fake's real job is `getObject()`/`deleteObject()` — the actual confirm→list→content→delete
 * lifecycle this file exercises depends on those two being real (in-memory) storage.
 */
class FakeBlobStorageAdapter implements BlobStorageAdapter {
  private readonly objects = new Map<string, { body: Buffer; contentType: string }>();

  seed(pathname: string, body: Buffer, contentType: string): void {
    this.objects.set(pathname, { body, contentType });
  }

  async handleClientUploadRequest(): Promise<Record<string, unknown>> {
    return { type: "blob.generate-client-token", clientToken: "fake-token" };
  }

  async getObject(pathname: string): Promise<{ body: Buffer; contentType: string } | null> {
    return this.objects.get(pathname) ?? null;
  }

  async deleteObject(pathname: string): Promise<void> {
    this.objects.delete(pathname);
  }
}

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
  let fakeBlobAdapter: FakeBlobStorageAdapter;

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

    fakeBlobAdapter = new FakeBlobStorageAdapter();
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [BusinessKnowledgeModule],
    })
      .overrideProvider(OIDC_CONFIGURATION)
      .useValue(offlineOidcConfig)
      .overrideProvider(BLOB_STORAGE_ADAPTER)
      .useValue(fakeBlobAdapter)
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

  describe("attachments", () => {
    async function createRecord(cookie: string): Promise<string> {
      const response = await request(app.getHttpServer())
        .post("/business-knowledge/records")
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ recordType: "vto", title: "Attachment host record" })
        .expect(201);
      return response.body.data.id as string;
    }

    it("confirms an upload: real checksum/size computed server-side, a Markdown preview generated, and the row persisted", async () => {
      const cookie = await cookieForNewSession(superAdminUserId);
      const recordId = await createRecord(cookie);
      const pathname = `business-knowledge/${recordId}/notes-abc123.md`;
      fakeBlobAdapter.seed(pathname, Buffer.from("# Heading\n\nSome notes."), "text/markdown");

      const response = await request(app.getHttpServer())
        .post(`/business-knowledge/records/${recordId}/attachments/confirm`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ pathname, filename: "notes.md" })
        .expect(201);

      expect(response.body.data.filename).toBe("notes.md");
      expect(response.body.data.mimeType).toBe("text/markdown");
      expect(response.body.data.scanStatus).toBe("scan_not_configured");
      expect(response.body.data.checksumSha256).toMatch(/^[0-9a-f]{64}$/);

      const listResponse = await request(app.getHttpServer())
        .get(`/business-knowledge/records/${recordId}/attachments`)
        .set("Cookie", cookie)
        .expect(200);
      expect(listResponse.body.data).toHaveLength(1);
      expect(listResponse.body.data[0].id).toBe(response.body.data.id);
    });

    it("rejects confirm with 400 when the real downloaded content type isn't in the allowlist, and never persists a row", async () => {
      const cookie = await cookieForNewSession(superAdminUserId);
      const recordId = await createRecord(cookie);
      const pathname = `business-knowledge/${recordId}/malware.exe`;
      fakeBlobAdapter.seed(pathname, Buffer.from("MZ"), "application/x-msdownload");

      await request(app.getHttpServer())
        .post(`/business-knowledge/records/${recordId}/attachments/confirm`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ pathname, filename: "malware.exe" })
        .expect(400);

      const listResponse = await request(app.getHttpServer())
        .get(`/business-knowledge/records/${recordId}/attachments`)
        .set("Cookie", cookie)
        .expect(200);
      expect(listResponse.body.data).toHaveLength(0);
    });

    it("rejects confirm with 400 for a pathname that doesn't belong to the record in the URL", async () => {
      const cookie = await cookieForNewSession(superAdminUserId);
      const recordId = await createRecord(cookie);
      await request(app.getHttpServer())
        .post(`/business-knowledge/records/${recordId}/attachments/confirm`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ pathname: `business-knowledge/${randomUUID()}/x.md`, filename: "x.md" })
        .expect(400);
    });

    it("denies confirm/delete with 403 for a read_only session (V grant only, not E)", async () => {
      const adminCookie = await cookieForNewSession(superAdminUserId);
      const recordId = await createRecord(adminCookie);
      const readOnlyCookie = await cookieForNewSession(readOnlyUserId);

      await request(app.getHttpServer())
        .post(`/business-knowledge/records/${recordId}/attachments/confirm`)
        .set("Cookie", readOnlyCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ pathname: `business-knowledge/${recordId}/x.md`, filename: "x.md" })
        .expect(403);
    });

    it("streams real attachment content through the proxy route with the correct content type", async () => {
      const cookie = await cookieForNewSession(superAdminUserId);
      const recordId = await createRecord(cookie);
      const pathname = `business-knowledge/${recordId}/report.pdf`;
      fakeBlobAdapter.seed(pathname, Buffer.from("%PDF-1.4 fake pdf bytes"), "application/pdf");
      const confirmResponse = await request(app.getHttpServer())
        .post(`/business-knowledge/records/${recordId}/attachments/confirm`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ pathname, filename: "report.pdf" })
        .expect(201);
      const attachmentId = confirmResponse.body.data.id as string;

      const contentResponse = await request(app.getHttpServer())
        .get(`/business-knowledge/records/${recordId}/attachments/${attachmentId}/content`)
        .set("Cookie", cookie)
        .buffer(true)
        .parse((res, callback) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => callback(null, Buffer.concat(chunks)));
        })
        .expect(200);
      expect(contentResponse.headers["content-type"]).toBe("application/pdf");
      expect(contentResponse.headers["cache-control"]).toBe("private, no-cache");
      expect((contentResponse.body as Buffer).toString()).toBe("%PDF-1.4 fake pdf bytes");
    });

    it("deletes an attachment: the row is gone from the list, and the content route 404s afterward", async () => {
      const cookie = await cookieForNewSession(superAdminUserId);
      const recordId = await createRecord(cookie);
      const pathname = `business-knowledge/${recordId}/x.md`;
      fakeBlobAdapter.seed(pathname, Buffer.from("x"), "text/markdown");
      const confirmResponse = await request(app.getHttpServer())
        .post(`/business-knowledge/records/${recordId}/attachments/confirm`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ pathname, filename: "x.md" })
        .expect(201);
      const attachmentId = confirmResponse.body.data.id as string;

      await request(app.getHttpServer())
        .delete(`/business-knowledge/records/${recordId}/attachments/${attachmentId}`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .expect(200);

      const listResponse = await request(app.getHttpServer())
        .get(`/business-knowledge/records/${recordId}/attachments`)
        .set("Cookie", cookie)
        .expect(200);
      expect(listResponse.body.data).toHaveLength(0);

      await request(app.getHttpServer())
        .get(`/business-knowledge/records/${recordId}/attachments/${attachmentId}/content`)
        .set("Cookie", cookie)
        .expect(404);
    });

    it("IDOR guard: an attachment can't be fetched or deleted through a different record's route", async () => {
      const cookie = await cookieForNewSession(superAdminUserId);
      const recordAId = await createRecord(cookie);
      const recordBId = await createRecord(cookie);
      const pathname = `business-knowledge/${recordAId}/x.md`;
      fakeBlobAdapter.seed(pathname, Buffer.from("x"), "text/markdown");
      const confirmResponse = await request(app.getHttpServer())
        .post(`/business-knowledge/records/${recordAId}/attachments/confirm`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ pathname, filename: "x.md" })
        .expect(201);
      const attachmentId = confirmResponse.body.data.id as string;

      await request(app.getHttpServer())
        .get(`/business-knowledge/records/${recordBId}/attachments/${attachmentId}/content`)
        .set("Cookie", cookie)
        .expect(404);

      await request(app.getHttpServer())
        .delete(`/business-knowledge/records/${recordBId}/attachments/${attachmentId}`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .expect(404);

      // Never actually deleted via the wrong record's route.
      const listResponse = await request(app.getHttpServer())
        .get(`/business-knowledge/records/${recordAId}/attachments`)
        .set("Cookie", cookie)
        .expect(200);
      expect(listResponse.body.data).toHaveLength(1);
    });

    it("redacts attachments (returns an empty list) for a restricted record — zero-seeded view_confidential, same as content/notes", async () => {
      const cookie = await cookieForNewSession(superAdminUserId);
      const recordId = await createRecord(cookie);
      const pathname = `business-knowledge/${recordId}/x.md`;
      fakeBlobAdapter.seed(pathname, Buffer.from("x"), "text/markdown");
      const confirmResponse = await request(app.getHttpServer())
        .post(`/business-knowledge/records/${recordId}/attachments/confirm`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ pathname, filename: "x.md" })
        .expect(201);
      const attachmentId = confirmResponse.body.data.id as string;

      await request(app.getHttpServer())
        .post(`/business-knowledge/records/${recordId}/status`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ status: "restricted" })
        .expect(200);

      const listResponse = await request(app.getHttpServer())
        .get(`/business-knowledge/records/${recordId}/attachments`)
        .set("Cookie", cookie)
        .expect(200);
      expect(listResponse.body.data).toHaveLength(0);

      await request(app.getHttpServer())
        .get(`/business-knowledge/records/${recordId}/attachments/${attachmentId}/content`)
        .set("Cookie", cookie)
        .expect(404);
    });
  });
});
