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
import { AssetLibraryModule } from "../src/asset-library/asset-library.module.js";

/**
 * Request-level coverage for the Asset Library module HTTP surface, against a REAL disposable
 * PostgreSQL database — same harness pattern as `brand-library.e2e-spec.ts`, since both modules
 * share the `creative_design` RBAC group and its real seeded grants
 * (`00013-seed-rbac-matrix.ts:136-144`):
 *   super_admin                  VCERAPX  (all actions except submit)
 *   owner_growth_approver        VERAPX   (view/edit/review/approve/publish/export — not create, not submit)
 *   marketing_editor             VR       (view, review only)
 *   designer_creative_reviewer   VCERAS   (view/create/edit/review/approve/submit — not publish, not export)
 *   developer                    V
 *   qa_security_reviewer         VR
 *   read_only                    V
 *
 * Note the real separation this module inherits: `designer_creative_reviewer` can submit and
 * approve but can NEVER publish; `owner_growth_approver` can publish but can never create or
 * submit. Both directions are exercised below.
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

describe("Asset Library module endpoints (e2e, real disposable database)", () => {
  let app: INestApplication;
  let users: UserRepository;
  let roles: RoleRepository;
  let userRoles: UserRoleRepository;
  let sessionService: SessionService;
  let authEnv: AuthEnv;

  let superAdminCookie: string;
  let readOnlyCookie: string;
  let designerCookie: string;
  let ownerApproverCookie: string;

  const ORIGIN = () => process.env.WEB_APP_ORIGIN!;

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

  async function createDraftAsset(cookie: string, overrides: Record<string, unknown> = {}) {
    const response = await request(app.getHttpServer())
      .post("/asset-library/assets")
      .set("Cookie", cookie)
      .set("Origin", ORIGIN())
      .send({
        publicId: uniquePublicId("ASSET"),
        title: "E2E Fixture Asset",
        ...overrides,
      })
      .expect(201);
    return response.body.data as {
      id: string;
      approvalStatus: string;
      visibility: string;
      scanStatus: string;
      version: number;
      isPublished: boolean;
      fileReference?: string | null;
      consentReference?: string | null;
    };
  }

  /** Drives a fixture asset from `draft` to `approved` using `designer_creative_reviewer`, the one
   *  role that holds submit AND review AND approve for `creative_design` (VCERAS). */
  async function approveAsset(id: string) {
    for (const approvalStatus of ["submitted", "under_review", "approved"]) {
      await request(app.getHttpServer())
        .post(`/asset-library/assets/${id}/status`)
        .set("Cookie", designerCookie)
        .set("Origin", ORIGIN())
        .send({ approvalStatus })
        .expect(200);
    }
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
      imports: [AssetLibraryModule],
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

    superAdminCookie = await cookieForNewSession(
      await createUserWithRole("al.super-admin", "super_admin"),
    );
    readOnlyCookie = await cookieForNewSession(
      await createUserWithRole("al.read-only", "read_only"),
    );
    designerCookie = await cookieForNewSession(
      await createUserWithRole("al.designer", "designer_creative_reviewer"),
    );
    ownerApproverCookie = await cookieForNewSession(
      await createUserWithRole("al.owner-approver", "owner_growth_approver"),
    );
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    const migrator = buildMigrator();
    await migrator.down({ to: 0 });
    await closeConnection();
  }, 120_000);

  describe("authentication and authorization", () => {
    it("rejects an unauthenticated request with 401, not 404 (the route really exists)", async () => {
      await request(app.getHttpServer()).get("/asset-library/assets").expect(401);
    });

    it("lets a read_only session list assets", async () => {
      await request(app.getHttpServer())
        .get("/asset-library/assets")
        .set("Cookie", readOnlyCookie)
        .expect(200);
    });

    it("refuses a read_only session the create action", async () => {
      await request(app.getHttpServer())
        .post("/asset-library/assets")
        .set("Cookie", readOnlyCookie)
        .set("Origin", ORIGIN())
        .send({ publicId: uniquePublicId("ASSET"), title: "Nope" })
        .expect(403);
    });

    it("refuses a mutating request with no Origin header (OriginCheckGuard)", async () => {
      await request(app.getHttpServer())
        .post("/asset-library/assets")
        .set("Cookie", superAdminCookie)
        .send({ publicId: uniquePublicId("ASSET"), title: "Nope" })
        .expect(403);
    });

    it("400s a malformed asset id rather than 500ing", async () => {
      await request(app.getHttpServer())
        .get("/asset-library/assets/not-a-uuid")
        .set("Cookie", superAdminCookie)
        .expect(400);
    });
  });

  describe("create", () => {
    it("creates an asset defaulting to draft, unpublished, scan not_configured, internal", async () => {
      const created = await createDraftAsset(superAdminCookie);
      expect(created.approvalStatus).toBe("draft");
      expect(created.isPublished).toBe(false);
      expect(created.scanStatus).toBe("not_configured");
      expect(created.visibility).toBe("internal");
      expect(created.version).toBe(1);
    });

    it("never lets a caller assert its own scanStatus — least of all 'clean' (D4)", async () => {
      const created = await createDraftAsset(superAdminCookie, { scanStatus: "clean" });
      // Zod strips the unknown key, and the repository independently hardcodes not_configured.
      expect(created.scanStatus).toBe("not_configured");
    });

    it("never lets a caller assert its own approvalStatus or isPublished", async () => {
      const created = await createDraftAsset(superAdminCookie, {
        approvalStatus: "approved",
        isPublished: true,
      });
      expect(created.approvalStatus).toBe("draft");
      expect(created.isPublished).toBe(false);
    });

    it("rejects a javascript: fileReference over real HTTP", async () => {
      await request(app.getHttpServer())
        .post("/asset-library/assets")
        .set("Cookie", superAdminCookie)
        .set("Origin", ORIGIN())
        .send({
          publicId: uniquePublicId("ASSET"),
          title: "XSS attempt",
          fileReference: "javascript:alert(1)",
        })
        .expect(400);
    });

    it("rejects a duplicate publicId with a clean 400", async () => {
      const publicId = uniquePublicId("ASSET");
      await request(app.getHttpServer())
        .post("/asset-library/assets")
        .set("Cookie", superAdminCookie)
        .set("Origin", ORIGIN())
        .send({ publicId, title: "First" })
        .expect(201);
      await request(app.getHttpServer())
        .post("/asset-library/assets")
        .set("Cookie", superAdminCookie)
        .set("Origin", ORIGIN())
        .send({ publicId, title: "Second" })
        .expect(400);
    });

    it("strips disallowed HTML from rich-text fields before storing", async () => {
      const created = await createDraftAsset(superAdminCookie, {
        description: "<script>alert(1)</script><p>Hero image</p>",
      });
      const response = await request(app.getHttpServer())
        .get(`/asset-library/assets/${created.id}`)
        .set("Cookie", superAdminCookie)
        .expect(200);
      expect(response.body.data.description).toBe("<p>Hero image</p>");
    });
  });

  describe("confidential-field redaction (D2)", () => {
    it("redacts fileReference and consentReference on a restricted asset", async () => {
      const created = await createDraftAsset(superAdminCookie, {
        visibility: "restricted",
        fileReference: "https://cdn.example.com/private/secret.png",
        consentReference: "Signed release from Jane Doe",
        licence: "CC BY 4.0",
      });

      // Even a super_admin is redacted here: `view_confidential` is deliberately zero-seeded for
      // EVERY role (00013-seed-rbac-matrix.ts's own header comment), so this fails closed today.
      const response = await request(app.getHttpServer())
        .get(`/asset-library/assets/${created.id}`)
        .set("Cookie", superAdminCookie)
        .expect(200);

      expect(response.body.data).not.toHaveProperty("fileReference");
      expect(response.body.data).not.toHaveProperty("consentReference");
      // Ordinary cataloguing metadata stays visible — the redaction is deliberately narrow.
      expect(response.body.data.licence).toBe("CC BY 4.0");
      expect(response.body.data.title).toBe("E2E Fixture Asset");
      expect(response.body.data.visibility).toBe("restricted");
    });

    it.each(["public", "internal"] as const)(
      "does NOT redact a %s asset's fileReference",
      async (visibility) => {
        const created = await createDraftAsset(superAdminCookie, {
          visibility,
          fileReference: "https://cdn.example.com/public/hero.png",
        });
        const response = await request(app.getHttpServer())
          .get(`/asset-library/assets/${created.id}`)
          .set("Cookie", superAdminCookie)
          .expect(200);
        expect(response.body.data.fileReference).toBe("https://cdn.example.com/public/hero.png");
      },
    );

    it("redacts restricted assets inside a mixed-visibility list, leaving others intact", async () => {
      const marker = uniquePublicId("MIXED");
      await createDraftAsset(superAdminCookie, {
        title: `${marker} restricted`,
        visibility: "restricted",
        fileReference: "https://cdn.example.com/private/a.png",
      });
      await createDraftAsset(superAdminCookie, {
        title: `${marker} internal`,
        visibility: "internal",
        fileReference: "https://cdn.example.com/public/b.png",
      });

      const response = await request(app.getHttpServer())
        .get(`/asset-library/assets?search=${encodeURIComponent(marker)}`)
        .set("Cookie", superAdminCookie)
        .expect(200);

      const rows = response.body.data as Record<string, unknown>[];
      expect(rows).toHaveLength(2);
      const restricted = rows.find((r) => r.visibility === "restricted")!;
      const internal = rows.find((r) => r.visibility === "internal")!;
      expect(restricted).not.toHaveProperty("fileReference");
      expect(internal.fileReference).toBe("https://cdn.example.com/public/b.png");
    });

    it("redacts the create response itself, not just later reads", async () => {
      const created = await createDraftAsset(superAdminCookie, {
        visibility: "restricted",
        fileReference: "https://cdn.example.com/private/echo.png",
      });
      // Echoing it back on create would defeat the redaction a subsequent GET applies.
      expect(created).not.toHaveProperty("fileReference");
    });
  });

  describe("approval workflow", () => {
    it("enforces the real seeded separation of duties across the status transitions", async () => {
      const created = await createDraftAsset(superAdminCookie);

      // super_admin holds VCERAPX — no `S` (submit). It genuinely cannot submit.
      await request(app.getHttpServer())
        .post(`/asset-library/assets/${created.id}/status`)
        .set("Cookie", superAdminCookie)
        .set("Origin", ORIGIN())
        .send({ approvalStatus: "submitted" })
        .expect(403);

      // designer_creative_reviewer holds VCERAS — it can.
      await request(app.getHttpServer())
        .post(`/asset-library/assets/${created.id}/status`)
        .set("Cookie", designerCookie)
        .set("Origin", ORIGIN())
        .send({ approvalStatus: "submitted" })
        .expect(200);
    });

    it("rejects an illegal transition with 400", async () => {
      const created = await createDraftAsset(superAdminCookie);
      await request(app.getHttpServer())
        .post(`/asset-library/assets/${created.id}/status`)
        .set("Cookie", designerCookie)
        .set("Origin", ORIGIN())
        .send({ approvalStatus: "approved" }) // draft -> approved is not a legal edge
        .expect(400);
    });

    it("refuses to edit an archived asset", async () => {
      const created = await createDraftAsset(superAdminCookie);
      await request(app.getHttpServer())
        .post(`/asset-library/assets/${created.id}/status`)
        .set("Cookie", designerCookie)
        .set("Origin", ORIGIN())
        .send({ approvalStatus: "archived" })
        .expect(200);

      await request(app.getHttpServer())
        .post(`/asset-library/assets/${created.id}/update`)
        .set("Cookie", superAdminCookie)
        .set("Origin", ORIGIN())
        .send({ title: "Should not land" })
        .expect(400);
    });

    it("increments version on a content edit but not on a status transition", async () => {
      const created = await createDraftAsset(superAdminCookie);

      const edited = await request(app.getHttpServer())
        .post(`/asset-library/assets/${created.id}/update`)
        .set("Cookie", superAdminCookie)
        .set("Origin", ORIGIN())
        .send({ title: "Edited" })
        .expect(200);
      expect(edited.body.data.version).toBe(2);

      const transitioned = await request(app.getHttpServer())
        .post(`/asset-library/assets/${created.id}/status`)
        .set("Cookie", designerCookie)
        .set("Origin", ORIGIN())
        .send({ approvalStatus: "submitted" })
        .expect(200);
      expect(transitioned.body.data.version).toBe(2);
    });

    it("rejects an empty update patch with 400", async () => {
      const created = await createDraftAsset(superAdminCookie);
      await request(app.getHttpServer())
        .post(`/asset-library/assets/${created.id}/update`)
        .set("Cookie", superAdminCookie)
        .set("Origin", ORIGIN())
        .send({})
        .expect(400);
    });
  });

  describe("publish / unpublish (D6)", () => {
    it("refuses to publish an asset that is not approved", async () => {
      const created = await createDraftAsset(superAdminCookie);
      await request(app.getHttpServer())
        .post(`/asset-library/assets/${created.id}/publish`)
        .set("Cookie", superAdminCookie)
        .set("Origin", ORIGIN())
        .expect(400);
    });

    it("publishes an approved asset and stamps publishedAt", async () => {
      const created = await createDraftAsset(superAdminCookie);
      await approveAsset(created.id);

      const published = await request(app.getHttpServer())
        .post(`/asset-library/assets/${created.id}/publish`)
        .set("Cookie", superAdminCookie)
        .set("Origin", ORIGIN())
        .expect(200);

      expect(published.body.data.isPublished).toBe(true);
      expect(published.body.data.publishedAt).not.toBeNull();
    });

    it("refuses publish to a role that holds approve but not publish", async () => {
      const created = await createDraftAsset(superAdminCookie);
      await approveAsset(created.id);

      // designer_creative_reviewer is VCERAS — it approved this very asset, but has no `P`.
      await request(app.getHttpServer())
        .post(`/asset-library/assets/${created.id}/publish`)
        .set("Cookie", designerCookie)
        .set("Origin", ORIGIN())
        .expect(403);
    });

    it("allows publish by owner_growth_approver, which holds P but cannot create", async () => {
      const created = await createDraftAsset(superAdminCookie);
      await approveAsset(created.id);

      await request(app.getHttpServer())
        .post(`/asset-library/assets/${created.id}/publish`)
        .set("Cookie", ownerApproverCookie)
        .set("Origin", ORIGIN())
        .expect(200);

      // The same role genuinely cannot create — VERAPX has no `C`.
      await request(app.getHttpServer())
        .post("/asset-library/assets")
        .set("Cookie", ownerApproverCookie)
        .set("Origin", ORIGIN())
        .send({ publicId: uniquePublicId("ASSET"), title: "Nope" })
        .expect(403);
    });

    it("409s a repeat publish, and preserves publishedAt across an unpublish/republish cycle", async () => {
      const created = await createDraftAsset(superAdminCookie);
      await approveAsset(created.id);

      const first = await request(app.getHttpServer())
        .post(`/asset-library/assets/${created.id}/publish`)
        .set("Cookie", superAdminCookie)
        .set("Origin", ORIGIN())
        .expect(200);
      const firstStamp = first.body.data.publishedAt;

      await request(app.getHttpServer())
        .post(`/asset-library/assets/${created.id}/publish`)
        .set("Cookie", superAdminCookie)
        .set("Origin", ORIGIN())
        .expect(409);

      await request(app.getHttpServer())
        .post(`/asset-library/assets/${created.id}/unpublish`)
        .set("Cookie", superAdminCookie)
        .set("Origin", ORIGIN())
        .expect(200);

      const republished = await request(app.getHttpServer())
        .post(`/asset-library/assets/${created.id}/publish`)
        .set("Cookie", superAdminCookie)
        .set("Origin", ORIGIN())
        .expect(200);
      expect(republished.body.data.publishedAt).toBe(firstStamp);
    });
  });

  describe("related records (polymorphic sub-resource, D3)", () => {
    const TARGET_RECORD_ID = "33333333-3333-4333-8333-333333333333";

    it("links an asset to a record in another module and lists it back", async () => {
      const asset = await createDraftAsset(superAdminCookie);

      const created = await request(app.getHttpServer())
        .post(`/asset-library/assets/${asset.id}/related-records`)
        .set("Cookie", superAdminCookie)
        .set("Origin", ORIGIN())
        .send({ moduleKey: "page_inventory", recordId: TARGET_RECORD_ID, note: "Hero band" })
        .expect(201);
      expect(created.body.data.moduleKey).toBe("page_inventory");

      const listed = await request(app.getHttpServer())
        .get(`/asset-library/assets/${asset.id}/related-records`)
        .set("Cookie", superAdminCookie)
        .expect(200);
      expect(listed.body.data).toHaveLength(1);
    });

    it("rejects a moduleKey that does not resolve to a real registered module", async () => {
      const asset = await createDraftAsset(superAdminCookie);
      await request(app.getHttpServer())
        .post(`/asset-library/assets/${asset.id}/related-records`)
        .set("Cookie", superAdminCookie)
        .set("Origin", ORIGIN())
        .send({ moduleKey: "not_a_real_module", recordId: TARGET_RECORD_ID })
        .expect(400);
    });

    it("404s a link attempt against a well-formed but nonexistent asset", async () => {
      await request(app.getHttpServer())
        .post("/asset-library/assets/99999999-9999-4999-8999-999999999999/related-records")
        .set("Cookie", superAdminCookie)
        .set("Origin", ORIGIN())
        .send({ moduleKey: "page_inventory", recordId: TARGET_RECORD_ID })
        .expect(404);
    });

    it("rejects linking the same target twice with a clean 400", async () => {
      const asset = await createDraftAsset(superAdminCookie);
      const body = { moduleKey: "page_inventory", recordId: TARGET_RECORD_ID };
      await request(app.getHttpServer())
        .post(`/asset-library/assets/${asset.id}/related-records`)
        .set("Cookie", superAdminCookie)
        .set("Origin", ORIGIN())
        .send(body)
        .expect(201);
      await request(app.getHttpServer())
        .post(`/asset-library/assets/${asset.id}/related-records`)
        .set("Cookie", superAdminCookie)
        .set("Origin", ORIGIN())
        .send(body)
        .expect(400);
    });

    /** The IDOR case: a caller authorized on asset B must not reach asset A's link row by id. */
    it("404s an attempt to mutate another asset's link row by id", async () => {
      const assetA = await createDraftAsset(superAdminCookie);
      const assetB = await createDraftAsset(superAdminCookie);

      const link = await request(app.getHttpServer())
        .post(`/asset-library/assets/${assetA.id}/related-records`)
        .set("Cookie", superAdminCookie)
        .set("Origin", ORIGIN())
        .send({ moduleKey: "page_inventory", recordId: TARGET_RECORD_ID, note: "original" })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/asset-library/assets/${assetB.id}/related-records/${link.body.data.id}/update`)
        .set("Cookie", superAdminCookie)
        .set("Origin", ORIGIN())
        .send({ note: "hijacked" })
        .expect(404);

      await request(app.getHttpServer())
        .post(`/asset-library/assets/${assetB.id}/related-records/${link.body.data.id}/delete`)
        .set("Cookie", superAdminCookie)
        .set("Origin", ORIGIN())
        .expect(404);

      // Asset A's own row is untouched by either attempt.
      const listed = await request(app.getHttpServer())
        .get(`/asset-library/assets/${assetA.id}/related-records`)
        .set("Cookie", superAdminCookie)
        .expect(200);
      expect(listed.body.data[0].note).toBe("original");
    });

    it("deletes a link, and a repeat delete then 404s", async () => {
      const asset = await createDraftAsset(superAdminCookie);
      const link = await request(app.getHttpServer())
        .post(`/asset-library/assets/${asset.id}/related-records`)
        .set("Cookie", superAdminCookie)
        .set("Origin", ORIGIN())
        .send({ moduleKey: "page_inventory", recordId: TARGET_RECORD_ID })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/asset-library/assets/${asset.id}/related-records/${link.body.data.id}/delete`)
        .set("Cookie", superAdminCookie)
        .set("Origin", ORIGIN())
        .expect(200);

      await request(app.getHttpServer())
        .post(`/asset-library/assets/${asset.id}/related-records/${link.body.data.id}/delete`)
        .set("Cookie", superAdminCookie)
        .set("Origin", ORIGIN())
        .expect(404);
    });

    it("refuses a read_only session the ability to link records", async () => {
      const asset = await createDraftAsset(superAdminCookie);
      await request(app.getHttpServer())
        .post(`/asset-library/assets/${asset.id}/related-records`)
        .set("Cookie", readOnlyCookie)
        .set("Origin", ORIGIN())
        .send({ moduleKey: "page_inventory", recordId: TARGET_RECORD_ID })
        .expect(403);
    });
  });
});
