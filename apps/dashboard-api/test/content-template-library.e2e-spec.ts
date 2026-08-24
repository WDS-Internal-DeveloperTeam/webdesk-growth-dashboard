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
import { ContentTemplateLibraryModule } from "../src/content-template-library/content-template-library.module.js";

/**
 * Request-level coverage for the Content Template Library module HTTP surface, against a REAL
 * disposable PostgreSQL database — same harness pattern as `persona-library.e2e-spec.ts`.
 * `page_content` has real seeded grants (`00013-seed-rbac-matrix.ts:127-135`) that meaningfully
 * differ per role, and this module is the first real consumer of the `publish`/`unpublish` RBAC
 * actions:
 *   super_admin              VCERAPX  (create, edit, review, approve, publish, unpublish, export — not submit)
 *   owner_growth_approver    VCERAPX  (same as super_admin — not submit)
 *   marketing_editor         VCESR    (create, edit, submit, review — not approve, not publish)
 *   qa_security_reviewer     VR       (view, review only — not publish)
 *   read_only                V        (view only)
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

describe("Content Template Library module endpoints (e2e, real disposable database)", () => {
  let app: INestApplication;
  let users: UserRepository;
  let roles: RoleRepository;
  let userRoles: UserRoleRepository;
  let sessionService: SessionService;
  let authEnv: AuthEnv;

  let superAdminUserId: string;
  let readOnlyUserId: string;
  let marketingEditorUserId: string;
  let ownerGrowthApproverUserId: string;
  let qaSecurityReviewerUserId: string;

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

  async function createDraftTemplate(cookie: string, overrides: Record<string, unknown> = {}) {
    const response = await request(app.getHttpServer())
      .post("/content-template-library/templates")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        publicId: uniquePublicId("TEMPLATE"),
        pageType: "E2E Fixture Page Type",
        ...overrides,
      })
      .expect(201);
    return response.body.data as {
      id: string;
      approvalStatus: string;
      version: number;
      isPublished: boolean;
    };
  }

  /** Drives a fixture template from `draft` all the way to `approved`, using whichever real
   *  session actually holds each required action — mirrors persona-library.e2e-spec.ts's own
   *  inline transition sequences. */
  async function approveTemplate(id: string, editorCookie: string, approverCookie: string) {
    await request(app.getHttpServer())
      .post(`/content-template-library/templates/${id}/status`)
      .set("Cookie", editorCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/content-template-library/templates/${id}/status`)
      .set("Cookie", approverCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "under_review" })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/content-template-library/templates/${id}/status`)
      .set("Cookie", approverCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "approved" })
      .expect(200);
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
      imports: [ContentTemplateLibraryModule],
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

    superAdminUserId = await createUserWithRole("ctl.super-admin", "super_admin");
    readOnlyUserId = await createUserWithRole("ctl.read-only", "read_only");
    marketingEditorUserId = await createUserWithRole("ctl.marketing-editor", "marketing_editor");
    ownerGrowthApproverUserId = await createUserWithRole(
      "ctl.owner-growth-approver",
      "owner_growth_approver",
    );
    qaSecurityReviewerUserId = await createUserWithRole(
      "ctl.qa-security-reviewer",
      "qa_security_reviewer",
    );
  }, 30_000);

  afterAll(async () => {
    await app.close();
    const migrator = buildMigrator();
    await migrator.down({ to: 0 });
    await closeConnection();
  }, 30_000);

  it("rejects GET /content-template-library/templates with 401 when there is no session cookie", async () => {
    await request(app.getHttpServer()).get("/content-template-library/templates").expect(401);
  });

  it("allows a real super_admin session to create, read, list, and edit a content template", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftTemplate(cookie, { pageType: "Headless Commerce Landing" });
    expect(created.approvalStatus).toBe("draft");
    expect(created.version).toBe(1);
    expect(created.isPublished).toBe(false);

    const getResponse = await request(app.getHttpServer())
      .get(`/content-template-library/templates/${created.id}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(getResponse.body.data.pageType).toBe("Headless Commerce Landing");

    const listResponse = await request(app.getHttpServer())
      .get("/content-template-library/templates")
      .set("Cookie", cookie)
      .expect(200);
    expect((listResponse.body.data as Array<{ id: string }>).some((t) => t.id === created.id)).toBe(
      true,
    );

    const updateResponse = await request(app.getHttpServer())
      .post(`/content-template-library/templates/${created.id}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ pageType: "Headless Commerce Landing (revised)" })
      .expect(200);
    expect(updateResponse.body.data.pageType).toBe("Headless Commerce Landing (revised)");
    expect(updateResponse.body.data.approvalStatus).toBe("draft"); // update never touches status
    expect(updateResponse.body.data.version).toBe(2); // update increments version server-side
  });

  it("denies content template creation with 403 for a read_only session (only V grant, not C)", async () => {
    const cookie = await cookieForNewSession(readOnlyUserId);
    await request(app.getHttpServer())
      .post("/content-template-library/templates")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: uniquePublicId("TEMPLATE"), pageType: "Denied" })
      .expect(403);
  });

  it("allows a read_only session to list content templates (V grant)", async () => {
    const cookie = await cookieForNewSession(readOnlyUserId);
    await request(app.getHttpServer())
      .get("/content-template-library/templates")
      .set("Cookie", cookie)
      .expect(200);
  });

  it("rejects content template creation with 400 when publicId is already in use", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const publicId = uniquePublicId("TEMPLATE");
    await request(app.getHttpServer())
      .post("/content-template-library/templates")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId, pageType: "First" })
      .expect(201);
    await request(app.getHttpServer())
      .post("/content-template-library/templates")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId, pageType: "Second" })
      .expect(400);
  });

  it("creates a content template with required/optional sections and round-trips them on GET", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftTemplate(cookie, {
      pageType: "Relationship Fixture Page",
      requiredSections: ["Hero", "CTA"],
      optionalSections: ["FAQ"],
    });

    const getResponse = await request(app.getHttpServer())
      .get(`/content-template-library/templates/${created.id}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(getResponse.body.data.requiredSections).toEqual(["Hero", "CTA"]);
    expect(getResponse.body.data.optionalSections).toEqual(["FAQ"]);
  });

  it("rejects an empty update patch with 400 (no-op saves shouldn't burn a version)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftTemplate(cookie);
    await request(app.getHttpServer())
      .post(`/content-template-library/templates/${created.id}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({})
      .expect(400);
  });

  it("clears an array field with an explicit null, distinct from omitting it", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftTemplate(cookie, {
      requiredSections: ["Hero"],
      optionalSections: ["FAQ"],
    });

    const updateResponse = await request(app.getHttpServer())
      .post(`/content-template-library/templates/${created.id}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ requiredSections: null })
      .expect(200);

    expect(updateResponse.body.data.requiredSections).toBeNull();
    expect(updateResponse.body.data.optionalSections).toEqual(["FAQ"]);
  });

  it("marketing_editor (VCESR) can submit and review, but is denied approve (draft->submitted->under_review->approved)", async () => {
    const cookie = await cookieForNewSession(marketingEditorUserId);
    const created = await createDraftTemplate(cookie, { pageType: "Marketing Editor Fixture" });

    await request(app.getHttpServer())
      .post(`/content-template-library/templates/${created.id}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/content-template-library/templates/${created.id}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "under_review" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/content-template-library/templates/${created.id}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "approved" })
      .expect(403);
  });

  it("owner_growth_approver (VCERAPX, no S) is denied draft->submitted, but can review and approve once submitted", async () => {
    const adminCookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftTemplate(adminCookie, {
      pageType: "Owner Approver Fixture",
    });

    const approverCookie = await cookieForNewSession(ownerGrowthApproverUserId);
    await request(app.getHttpServer())
      .post(`/content-template-library/templates/${created.id}/status`)
      .set("Cookie", approverCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(403);

    // Neither super_admin nor owner_growth_approver holds "submit" (VCERAPX, no S) — only
    // marketing_editor does. A real marketing_editor submits it so the owner_growth_approver's
    // own review/approve path can be exercised.
    const editorCookie = await cookieForNewSession(marketingEditorUserId);
    await request(app.getHttpServer())
      .post(`/content-template-library/templates/${created.id}/status`)
      .set("Cookie", editorCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/content-template-library/templates/${created.id}/status`)
      .set("Cookie", approverCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "under_review" })
      .expect(200);

    const approveResponse = await request(app.getHttpServer())
      .post(`/content-template-library/templates/${created.id}/status`)
      .set("Cookie", approverCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "approved" })
      .expect(200);
    expect(approveResponse.body.data.approvalStatus).toBe("approved");
  });

  it("qa_security_reviewer (VR only) can view and review, but is denied create and approve", async () => {
    const adminCookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftTemplate(adminCookie, { pageType: "QA Reviewer Fixture" });
    const editorCookie = await cookieForNewSession(marketingEditorUserId);
    await request(app.getHttpServer())
      .post(`/content-template-library/templates/${created.id}/status`)
      .set("Cookie", editorCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(200);

    const qaCookie = await cookieForNewSession(qaSecurityReviewerUserId);
    await request(app.getHttpServer())
      .post("/content-template-library/templates")
      .set("Cookie", qaCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: uniquePublicId("TEMPLATE"), pageType: "Denied create" })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/content-template-library/templates/${created.id}/status`)
      .set("Cookie", qaCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "under_review" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/content-template-library/templates/${created.id}/status`)
      .set("Cookie", qaCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "approved" })
      .expect(403);
  });

  it("rejects an invalid approval-status transition (archived -> submitted, archived is terminal) with 400", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftTemplate(cookie, { pageType: "Terminal State Fixture" });

    await request(app.getHttpServer())
      .post(`/content-template-library/templates/${created.id}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "archived" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/content-template-library/templates/${created.id}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(400);
  });

  describe("publish/unpublish (D1/D2 — first real consumer of the publish/unpublish RBAC actions)", () => {
    it("rejects publishing a draft (not yet approved) template with 400, via a super_admin session that DOES hold publish", async () => {
      const cookie = await cookieForNewSession(superAdminUserId);
      const created = await createDraftTemplate(cookie, { pageType: "Not Yet Approved" });

      await request(app.getHttpServer())
        .post(`/content-template-library/templates/${created.id}/publish`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .expect(400);
    });

    it("publishes an approved template as super_admin, stamping publishedAt, then unpublishes it, leaving publishedAt unchanged", async () => {
      const adminCookie = await cookieForNewSession(superAdminUserId);
      const editorCookie = await cookieForNewSession(marketingEditorUserId);
      const created = await createDraftTemplate(adminCookie, { pageType: "Publish Fixture" });
      await approveTemplate(created.id, editorCookie, adminCookie);

      const publishResponse = await request(app.getHttpServer())
        .post(`/content-template-library/templates/${created.id}/publish`)
        .set("Cookie", adminCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .expect(200);
      expect(publishResponse.body.data.isPublished).toBe(true);
      const publishedAt = publishResponse.body.data.publishedAt as string;
      expect(publishedAt).toBeTruthy();

      const unpublishResponse = await request(app.getHttpServer())
        .post(`/content-template-library/templates/${created.id}/unpublish`)
        .set("Cookie", adminCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .expect(200);
      expect(unpublishResponse.body.data.isPublished).toBe(false);
      // publishedAt is never cleared by unpublish() (D2) — preserved as permanent history.
      expect(unpublishResponse.body.data.publishedAt).toBe(publishedAt);
    });

    it("denies publish with 403 for a marketing_editor session (VCESR — no P grant)", async () => {
      const adminCookie = await cookieForNewSession(superAdminUserId);
      const editorCookie = await cookieForNewSession(marketingEditorUserId);
      const created = await createDraftTemplate(adminCookie, {
        pageType: "Editor Publish Denied Fixture",
      });
      await approveTemplate(created.id, editorCookie, adminCookie);

      await request(app.getHttpServer())
        .post(`/content-template-library/templates/${created.id}/publish`)
        .set("Cookie", editorCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .expect(403);
    });

    it("denies unpublish with 403 for a read_only session (V only — no P grant)", async () => {
      const adminCookie = await cookieForNewSession(superAdminUserId);
      const editorCookie = await cookieForNewSession(marketingEditorUserId);
      const readOnlyCookie = await cookieForNewSession(readOnlyUserId);
      const created = await createDraftTemplate(adminCookie, {
        pageType: "Read Only Unpublish Denied Fixture",
      });
      await approveTemplate(created.id, editorCookie, adminCookie);
      await request(app.getHttpServer())
        .post(`/content-template-library/templates/${created.id}/publish`)
        .set("Cookie", adminCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .expect(200);

      await request(app.getHttpServer())
        .post(`/content-template-library/templates/${created.id}/unpublish`)
        .set("Cookie", readOnlyCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .expect(403);
    });

    it("owner_growth_approver (holds P) can publish an approved template it approved itself", async () => {
      const editorCookie = await cookieForNewSession(marketingEditorUserId);
      const approverCookie = await cookieForNewSession(ownerGrowthApproverUserId);
      const created = await createDraftTemplate(editorCookie, {
        pageType: "Owner Approver Publish Fixture",
      });
      await approveTemplate(created.id, editorCookie, approverCookie);

      const publishResponse = await request(app.getHttpServer())
        .post(`/content-template-library/templates/${created.id}/publish`)
        .set("Cookie", approverCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .expect(200);
      expect(publishResponse.body.data.isPublished).toBe(true);
    });

    it("unpublish succeeds even after the template later moves to archived (D3 — no automatic unpublish on a later status transition)", async () => {
      const adminCookie = await cookieForNewSession(superAdminUserId);
      const editorCookie = await cookieForNewSession(marketingEditorUserId);
      const created = await createDraftTemplate(adminCookie, {
        pageType: "Archive Then Unpublish",
      });
      await approveTemplate(created.id, editorCookie, adminCookie);
      await request(app.getHttpServer())
        .post(`/content-template-library/templates/${created.id}/publish`)
        .set("Cookie", adminCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .expect(200);

      // Move to archived — a published template stays published (D3), no side effect.
      const archiveResponse = await request(app.getHttpServer())
        .post(`/content-template-library/templates/${created.id}/status`)
        .set("Cookie", adminCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ approvalStatus: "archived" })
        .expect(200);
      expect(archiveResponse.body.data.isPublished).toBe(true);

      const unpublishResponse = await request(app.getHttpServer())
        .post(`/content-template-library/templates/${created.id}/unpublish`)
        .set("Cookie", adminCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .expect(200);
      expect(unpublishResponse.body.data.isPublished).toBe(false);
      expect(unpublishResponse.body.data.approvalStatus).toBe("archived");
    });

    it("returns 409 (not a silent success) when publishing an already-published template", async () => {
      const adminCookie = await cookieForNewSession(superAdminUserId);
      const editorCookie = await cookieForNewSession(marketingEditorUserId);
      const created = await createDraftTemplate(adminCookie, {
        pageType: "Double Publish Fixture",
      });
      await approveTemplate(created.id, editorCookie, adminCookie);
      await request(app.getHttpServer())
        .post(`/content-template-library/templates/${created.id}/publish`)
        .set("Cookie", adminCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .expect(200);

      await request(app.getHttpServer())
        .post(`/content-template-library/templates/${created.id}/publish`)
        .set("Cookie", adminCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .expect(409);
    });

    it("returns 409 (not a silent success) when unpublishing an already-unpublished template", async () => {
      const cookie = await cookieForNewSession(superAdminUserId);
      const created = await createDraftTemplate(cookie, { pageType: "Double Unpublish Fixture" });

      await request(app.getHttpServer())
        .post(`/content-template-library/templates/${created.id}/unpublish`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .expect(409);
    });

    it("returns 404 (not a raw 500) publishing a nonexistent content template", async () => {
      const cookie = await cookieForNewSession(superAdminUserId);
      await request(app.getHttpServer())
        .post(`/content-template-library/templates/${randomUUID()}/publish`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .expect(404);
    });
  });

  it("returns 404 for a GET on a nonexistent content template id", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .get(`/content-template-library/templates/${randomUUID()}`)
      .set("Cookie", cookie)
      .expect(404);
  });

  it("returns 400 (not a raw 500) for a malformed content template id", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .get("/content-template-library/templates/not-a-uuid")
      .set("Cookie", cookie)
      .expect(400);
  });

  it("rejects a mutating request with no Origin header (OriginCheckGuard)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .post("/content-template-library/templates")
      .set("Cookie", cookie)
      .send({ publicId: uniquePublicId("TEMPLATE"), pageType: "No origin" })
      .expect(403);
  });
});
