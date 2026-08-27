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
import { BrandLibraryModule } from "../src/brand-library/brand-library.module.js";

/**
 * Request-level coverage for the Brand Library module HTTP surface, against a REAL disposable
 * PostgreSQL database — same harness pattern as `content-template-library.e2e-spec.ts`.
 * `creative_design` has real seeded grants (`00013-seed-rbac-matrix.ts:136-144`) that meaningfully
 * differ per role — unlike `page_content`, the submit-and-approve-capable role here is
 * `designer_creative_reviewer`, not the same role that holds publish:
 *   super_admin                  VCERAPX  (all actions except submit)
 *   owner_growth_approver        VERAPX   (view/edit/review/approve/publish/export — not create, not submit)
 *   marketing_editor             VR       (view, review only)
 *   designer_creative_reviewer   VCERAS   (view/create/edit/review/approve/submit — not publish, not export)
 *   developer                    V
 *   qa_security_reviewer         VR
 *   read_only                    V
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

describe("Brand Library module endpoints (e2e, real disposable database)", () => {
  let app: INestApplication;
  let users: UserRepository;
  let roles: RoleRepository;
  let userRoles: UserRoleRepository;
  let sessionService: SessionService;
  let authEnv: AuthEnv;

  let superAdminUserId: string;
  let readOnlyUserId: string;
  let designerCreativeReviewerUserId: string;
  let ownerGrowthApproverUserId: string;
  let marketingEditorUserId: string;

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

  async function createDraftRecord(cookie: string, overrides: Record<string, unknown> = {}) {
    const response = await request(app.getHttpServer())
      .post("/brand-library/records")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        publicId: uniquePublicId("BRAND"),
        recordType: "logo",
        title: "E2E Fixture Record",
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

  /** Drives a fixture record from `draft` all the way to `approved`, using whichever real session
   *  actually holds each required action — mirrors content-template-library.e2e-spec.ts's own
   *  inline transition sequences. `designer_creative_reviewer` alone holds submit AND review AND
   *  approve for this module (VCERAS), unlike page_content's own split roles. */
  async function approveRecord(id: string, reviewerCookie: string) {
    await request(app.getHttpServer())
      .post(`/brand-library/records/${id}/status`)
      .set("Cookie", reviewerCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/brand-library/records/${id}/status`)
      .set("Cookie", reviewerCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "under_review" })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/brand-library/records/${id}/status`)
      .set("Cookie", reviewerCookie)
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
      imports: [BrandLibraryModule],
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

    superAdminUserId = await createUserWithRole("bl.super-admin", "super_admin");
    readOnlyUserId = await createUserWithRole("bl.read-only", "read_only");
    designerCreativeReviewerUserId = await createUserWithRole(
      "bl.designer-creative-reviewer",
      "designer_creative_reviewer",
    );
    ownerGrowthApproverUserId = await createUserWithRole(
      "bl.owner-growth-approver",
      "owner_growth_approver",
    );
    marketingEditorUserId = await createUserWithRole("bl.marketing-editor", "marketing_editor");
  }, 30_000);

  afterAll(async () => {
    await app.close();
    const migrator = buildMigrator();
    await migrator.down({ to: 0 });
    await closeConnection();
  }, 30_000);

  it("rejects GET /brand-library/records with 401 when there is no session cookie", async () => {
    await request(app.getHttpServer()).get("/brand-library/records").expect(401);
  });

  it("allows a real super_admin session to create, read, list, and edit a brand library record", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftRecord(cookie, { title: "Primary Logo" });
    expect(created.approvalStatus).toBe("draft");
    expect(created.version).toBe(1);
    expect(created.isPublished).toBe(false);

    const getResponse = await request(app.getHttpServer())
      .get(`/brand-library/records/${created.id}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(getResponse.body.data.title).toBe("Primary Logo");

    const listResponse = await request(app.getHttpServer())
      .get("/brand-library/records")
      .set("Cookie", cookie)
      .expect(200);
    expect((listResponse.body.data as Array<{ id: string }>).some((r) => r.id === created.id)).toBe(
      true,
    );

    const updateResponse = await request(app.getHttpServer())
      .post(`/brand-library/records/${created.id}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ title: "Primary Logo (revised)" })
      .expect(200);
    expect(updateResponse.body.data.title).toBe("Primary Logo (revised)");
    expect(updateResponse.body.data.approvalStatus).toBe("draft"); // update never touches status
    expect(updateResponse.body.data.version).toBe(2); // update increments version server-side
  });

  it("denies brand library record creation with 403 for a read_only session (only V grant, not C)", async () => {
    const cookie = await cookieForNewSession(readOnlyUserId);
    await request(app.getHttpServer())
      .post("/brand-library/records")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: uniquePublicId("BRAND"), recordType: "logo", title: "Denied" })
      .expect(403);
  });

  it("allows a read_only session to list brand library records (V grant)", async () => {
    const cookie = await cookieForNewSession(readOnlyUserId);
    await request(app.getHttpServer())
      .get("/brand-library/records")
      .set("Cookie", cookie)
      .expect(200);
  });

  it("rejects brand library record creation with 400 when publicId is already in use", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const publicId = uniquePublicId("BRAND");
    await request(app.getHttpServer())
      .post("/brand-library/records")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId, recordType: "logo", title: "First" })
      .expect(201);
    await request(app.getHttpServer())
      .post("/brand-library/records")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId, recordType: "logo", title: "Second" })
      .expect(400);
  });

  it("creates a brand library record with description/fileReference/usageNotes and round-trips them on GET", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftRecord(cookie, {
      title: "Brand Color Palette",
      recordType: "color",
      description: "Primary color family",
      fileReference: "https://example.com/brand/colors.pdf",
      usageNotes: "Use on white backgrounds only",
    });

    const getResponse = await request(app.getHttpServer())
      .get(`/brand-library/records/${created.id}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(getResponse.body.data.description).toBe("Primary color family");
    expect(getResponse.body.data.fileReference).toBe("https://example.com/brand/colors.pdf");
    expect(getResponse.body.data.usageNotes).toBe("Use on white backgrounds only");
  });

  it("rejects a fileReference with an unsafe URL scheme (safeHttpUrlSchema)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .post("/brand-library/records")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        publicId: uniquePublicId("BRAND"),
        recordType: "logo",
        title: "Unsafe URL",
        fileReference: "javascript:alert(1)",
      })
      .expect(400);
  });

  it("rejects an empty update patch with 400 (no-op saves shouldn't burn a version)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftRecord(cookie);
    await request(app.getHttpServer())
      .post(`/brand-library/records/${created.id}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({})
      .expect(400);
  });

  it("clears a text field with an explicit null, distinct from omitting it", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftRecord(cookie, {
      description: "Some description",
      usageNotes: "Some usage notes",
    });

    const updateResponse = await request(app.getHttpServer())
      .post(`/brand-library/records/${created.id}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ description: null })
      .expect(200);

    expect(updateResponse.body.data.description).toBeNull();
    expect(updateResponse.body.data.usageNotes).toBe("Some usage notes");
  });

  it("designer_creative_reviewer (VCERAS) can drive the full lifecycle: create, submit, review, approve", async () => {
    const cookie = await cookieForNewSession(designerCreativeReviewerUserId);
    const created = await createDraftRecord(cookie, { title: "Reviewer Lifecycle Fixture" });

    await request(app.getHttpServer())
      .post(`/brand-library/records/${created.id}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/brand-library/records/${created.id}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "under_review" })
      .expect(200);

    const approveResponse = await request(app.getHttpServer())
      .post(`/brand-library/records/${created.id}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "approved" })
      .expect(200);
    expect(approveResponse.body.data.approvalStatus).toBe("approved");
  });

  it("marketing_editor (VR only) can view and review, but is denied create and approve", async () => {
    const adminCookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftRecord(adminCookie, { title: "Marketing Editor Fixture" });
    const reviewerCookie = await cookieForNewSession(designerCreativeReviewerUserId);
    await request(app.getHttpServer())
      .post(`/brand-library/records/${created.id}/status`)
      .set("Cookie", reviewerCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(200);

    const marketingCookie = await cookieForNewSession(marketingEditorUserId);
    await request(app.getHttpServer())
      .post("/brand-library/records")
      .set("Cookie", marketingCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: uniquePublicId("BRAND"), recordType: "logo", title: "Denied create" })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/brand-library/records/${created.id}/status`)
      .set("Cookie", marketingCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "under_review" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/brand-library/records/${created.id}/status`)
      .set("Cookie", marketingCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "approved" })
      .expect(403);
  });

  it("owner_growth_approver (VERAPX, no C, no S) is denied create, but can review/approve once submitted by the reviewer", async () => {
    const reviewerCookie = await cookieForNewSession(designerCreativeReviewerUserId);
    const approverCookie = await cookieForNewSession(ownerGrowthApproverUserId);

    await request(app.getHttpServer())
      .post("/brand-library/records")
      .set("Cookie", approverCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: uniquePublicId("BRAND"), recordType: "logo", title: "Denied create" })
      .expect(403);

    const created = await createDraftRecord(reviewerCookie, { title: "Owner Approver Fixture" });

    await request(app.getHttpServer())
      .post(`/brand-library/records/${created.id}/status`)
      .set("Cookie", approverCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/brand-library/records/${created.id}/status`)
      .set("Cookie", reviewerCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/brand-library/records/${created.id}/status`)
      .set("Cookie", approverCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "under_review" })
      .expect(200);

    const approveResponse = await request(app.getHttpServer())
      .post(`/brand-library/records/${created.id}/status`)
      .set("Cookie", approverCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "approved" })
      .expect(200);
    expect(approveResponse.body.data.approvalStatus).toBe("approved");
  });

  it("rejects an invalid approval-status transition (archived -> submitted, archived is terminal) with 400", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftRecord(cookie, { title: "Terminal State Fixture" });

    await request(app.getHttpServer())
      .post(`/brand-library/records/${created.id}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "archived" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/brand-library/records/${created.id}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(400);
  });

  describe("publish/unpublish (D5 — only super_admin/owner_growth_approver hold P)", () => {
    it("rejects publishing a draft (not yet approved) record with 400, via a super_admin session that DOES hold publish", async () => {
      const cookie = await cookieForNewSession(superAdminUserId);
      const created = await createDraftRecord(cookie, { title: "Not Yet Approved" });

      await request(app.getHttpServer())
        .post(`/brand-library/records/${created.id}/publish`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .expect(400);
    });

    it("publishes an approved record as super_admin, stamping publishedAt, then unpublishes it, leaving publishedAt unchanged", async () => {
      const adminCookie = await cookieForNewSession(superAdminUserId);
      const reviewerCookie = await cookieForNewSession(designerCreativeReviewerUserId);
      const created = await createDraftRecord(adminCookie, { title: "Publish Fixture" });
      await approveRecord(created.id, reviewerCookie);

      const publishResponse = await request(app.getHttpServer())
        .post(`/brand-library/records/${created.id}/publish`)
        .set("Cookie", adminCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .expect(200);
      expect(publishResponse.body.data.isPublished).toBe(true);
      const publishedAt = publishResponse.body.data.publishedAt as string;
      expect(publishedAt).toBeTruthy();

      const unpublishResponse = await request(app.getHttpServer())
        .post(`/brand-library/records/${created.id}/unpublish`)
        .set("Cookie", adminCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .expect(200);
      expect(unpublishResponse.body.data.isPublished).toBe(false);
      expect(unpublishResponse.body.data.publishedAt).toBe(publishedAt);
    });

    it("denies publish with 403 for a designer_creative_reviewer session (VCERAS — no P grant)", async () => {
      const adminCookie = await cookieForNewSession(superAdminUserId);
      const reviewerCookie = await cookieForNewSession(designerCreativeReviewerUserId);
      const created = await createDraftRecord(adminCookie, {
        title: "Reviewer Publish Denied Fixture",
      });
      await approveRecord(created.id, reviewerCookie);

      await request(app.getHttpServer())
        .post(`/brand-library/records/${created.id}/publish`)
        .set("Cookie", reviewerCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .expect(403);
    });

    it("denies unpublish with 403 for a read_only session (V only — no P grant)", async () => {
      const adminCookie = await cookieForNewSession(superAdminUserId);
      const reviewerCookie = await cookieForNewSession(designerCreativeReviewerUserId);
      const readOnlyCookie = await cookieForNewSession(readOnlyUserId);
      const created = await createDraftRecord(adminCookie, {
        title: "Read Only Unpublish Denied Fixture",
      });
      await approveRecord(created.id, reviewerCookie);
      await request(app.getHttpServer())
        .post(`/brand-library/records/${created.id}/publish`)
        .set("Cookie", adminCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .expect(200);

      await request(app.getHttpServer())
        .post(`/brand-library/records/${created.id}/unpublish`)
        .set("Cookie", readOnlyCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .expect(403);
    });

    it("owner_growth_approver (holds P) can publish a record it approved itself", async () => {
      const reviewerCookie = await cookieForNewSession(designerCreativeReviewerUserId);
      const approverCookie = await cookieForNewSession(ownerGrowthApproverUserId);
      const created = await createDraftRecord(reviewerCookie, {
        title: "Owner Approver Publish Fixture",
      });
      await request(app.getHttpServer())
        .post(`/brand-library/records/${created.id}/status`)
        .set("Cookie", reviewerCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ approvalStatus: "submitted" })
        .expect(200);
      await request(app.getHttpServer())
        .post(`/brand-library/records/${created.id}/status`)
        .set("Cookie", approverCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ approvalStatus: "under_review" })
        .expect(200);
      await request(app.getHttpServer())
        .post(`/brand-library/records/${created.id}/status`)
        .set("Cookie", approverCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ approvalStatus: "approved" })
        .expect(200);

      const publishResponse = await request(app.getHttpServer())
        .post(`/brand-library/records/${created.id}/publish`)
        .set("Cookie", approverCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .expect(200);
      expect(publishResponse.body.data.isPublished).toBe(true);
    });

    it("unpublish succeeds even after the record later moves to archived (no automatic unpublish on a later status transition)", async () => {
      const adminCookie = await cookieForNewSession(superAdminUserId);
      const reviewerCookie = await cookieForNewSession(designerCreativeReviewerUserId);
      const created = await createDraftRecord(adminCookie, {
        title: "Archive Then Unpublish",
      });
      await approveRecord(created.id, reviewerCookie);
      await request(app.getHttpServer())
        .post(`/brand-library/records/${created.id}/publish`)
        .set("Cookie", adminCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .expect(200);

      const archiveResponse = await request(app.getHttpServer())
        .post(`/brand-library/records/${created.id}/status`)
        .set("Cookie", adminCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ approvalStatus: "archived" })
        .expect(200);
      expect(archiveResponse.body.data.isPublished).toBe(true);

      const unpublishResponse = await request(app.getHttpServer())
        .post(`/brand-library/records/${created.id}/unpublish`)
        .set("Cookie", adminCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .expect(200);
      expect(unpublishResponse.body.data.isPublished).toBe(false);
      expect(unpublishResponse.body.data.approvalStatus).toBe("archived");
    });

    it("returns 409 (not a silent success) when publishing an already-published record", async () => {
      const adminCookie = await cookieForNewSession(superAdminUserId);
      const reviewerCookie = await cookieForNewSession(designerCreativeReviewerUserId);
      const created = await createDraftRecord(adminCookie, {
        title: "Double Publish Fixture",
      });
      await approveRecord(created.id, reviewerCookie);
      await request(app.getHttpServer())
        .post(`/brand-library/records/${created.id}/publish`)
        .set("Cookie", adminCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .expect(200);

      await request(app.getHttpServer())
        .post(`/brand-library/records/${created.id}/publish`)
        .set("Cookie", adminCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .expect(409);
    });

    it("returns 409 (not a silent success) when unpublishing an already-unpublished record", async () => {
      const cookie = await cookieForNewSession(superAdminUserId);
      const created = await createDraftRecord(cookie, { title: "Double Unpublish Fixture" });

      await request(app.getHttpServer())
        .post(`/brand-library/records/${created.id}/unpublish`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .expect(409);
    });

    it("returns 404 (not a raw 500) publishing a nonexistent brand library record", async () => {
      const cookie = await cookieForNewSession(superAdminUserId);
      await request(app.getHttpServer())
        .post(`/brand-library/records/${randomUUID()}/publish`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .expect(404);
    });
  });

  it("returns 404 for a GET on a nonexistent brand library record id", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .get(`/brand-library/records/${randomUUID()}`)
      .set("Cookie", cookie)
      .expect(404);
  });

  it("returns 400 (not a raw 500) for a malformed brand library record id", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .get("/brand-library/records/not-a-uuid")
      .set("Cookie", cookie)
      .expect(400);
  });

  it("rejects a mutating request with no Origin header (OriginCheckGuard)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .post("/brand-library/records")
      .set("Cookie", cookie)
      .send({ publicId: uniquePublicId("BRAND"), recordType: "logo", title: "No origin" })
      .expect(403);
  });
});
