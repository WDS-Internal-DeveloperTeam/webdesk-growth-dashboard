import { randomBytes, randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import {
  AssetRepository,
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
import { PortfolioLibraryModule } from "../src/portfolio-library/portfolio-library.module.js";

/**
 * Request-level coverage for the Portfolio Library module HTTP surface, against a REAL disposable
 * PostgreSQL database — same harness pattern as `content-template-library.e2e-spec.ts`. `portfolio`
 * has real seeded grants (`00013-seed-rbac-matrix.ts:172-179`) that meaningfully differ per role:
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

describe("Portfolio Library module endpoints (e2e, real disposable database)", () => {
  let app: INestApplication;
  let users: UserRepository;
  let roles: RoleRepository;
  let userRoles: UserRoleRepository;
  let assets: AssetRepository;
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

  async function createDraftRecord(cookie: string, overrides: Record<string, unknown> = {}) {
    const response = await request(app.getHttpServer())
      .post("/portfolio-library/records")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        publicId: uniquePublicId("PORTFOLIO"),
        projectOrClientName: "E2E Fixture Client",
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
   *  `approveTemplate()`. */
  async function approveRecord(id: string, editorCookie: string, approverCookie: string) {
    await request(app.getHttpServer())
      .post(`/portfolio-library/records/${id}/status`)
      .set("Cookie", editorCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/portfolio-library/records/${id}/status`)
      .set("Cookie", approverCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "under_review" })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/portfolio-library/records/${id}/status`)
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
      imports: [PortfolioLibraryModule],
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
    assets = new AssetRepository();

    superAdminUserId = await createUserWithRole("pl.super-admin", "super_admin");
    readOnlyUserId = await createUserWithRole("pl.read-only", "read_only");
    marketingEditorUserId = await createUserWithRole("pl.marketing-editor", "marketing_editor");
    ownerGrowthApproverUserId = await createUserWithRole(
      "pl.owner-growth-approver",
      "owner_growth_approver",
    );
    qaSecurityReviewerUserId = await createUserWithRole(
      "pl.qa-security-reviewer",
      "qa_security_reviewer",
    );
  }, 30_000);

  afterAll(async () => {
    await app.close();
    const migrator = buildMigrator();
    await migrator.down({ to: 0 });
    await closeConnection();
  }, 30_000);

  it("rejects GET /portfolio-library/records with 401 when there is no session cookie", async () => {
    await request(app.getHttpServer()).get("/portfolio-library/records").expect(401);
  });

  it("allows a real super_admin session to create, read, list, and edit a portfolio record", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftRecord(cookie, { projectOrClientName: "Acme Redesign" });
    expect(created.approvalStatus).toBe("draft");
    expect(created.version).toBe(1);
    expect(created.isPublished).toBe(false);

    const getResponse = await request(app.getHttpServer())
      .get(`/portfolio-library/records/${created.id}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(getResponse.body.data.projectOrClientName).toBe("Acme Redesign");

    const listResponse = await request(app.getHttpServer())
      .get("/portfolio-library/records")
      .set("Cookie", cookie)
      .expect(200);
    expect((listResponse.body.data as Array<{ id: string }>).some((r) => r.id === created.id)).toBe(
      true,
    );

    const updateResponse = await request(app.getHttpServer())
      .post(`/portfolio-library/records/${created.id}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ projectOrClientName: "Acme Redesign (revised)" })
      .expect(200);
    expect(updateResponse.body.data.projectOrClientName).toBe("Acme Redesign (revised)");
    expect(updateResponse.body.data.approvalStatus).toBe("draft"); // update never touches status
    expect(updateResponse.body.data.version).toBe(2); // update increments version server-side
  });

  it("denies portfolio record creation with 403 for a read_only session (only V grant, not C)", async () => {
    const cookie = await cookieForNewSession(readOnlyUserId);
    await request(app.getHttpServer())
      .post("/portfolio-library/records")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: uniquePublicId("PORTFOLIO"), projectOrClientName: "Denied" })
      .expect(403);
  });

  it("allows a read_only session to list portfolio records (V grant)", async () => {
    const cookie = await cookieForNewSession(readOnlyUserId);
    await request(app.getHttpServer())
      .get("/portfolio-library/records")
      .set("Cookie", cookie)
      .expect(200);
  });

  it("rejects portfolio record creation with 400 when publicId is already in use", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const publicId = uniquePublicId("PORTFOLIO");
    await request(app.getHttpServer())
      .post("/portfolio-library/records")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId, projectOrClientName: "First" })
      .expect(201);
    await request(app.getHttpServer())
      .post("/portfolio-library/records")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId, projectOrClientName: "Second" })
      .expect(400);
  });

  it("rejects a create with an unsafe (non-http/https) url scheme (matches Projects'/Brand Library's own precedent)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .post("/portfolio-library/records")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        publicId: uniquePublicId("PORTFOLIO"),
        projectOrClientName: "Unsafe URL Fixture",
        url: "javascript:alert(1)",
      })
      .expect(400);
  });

  it("rejects create with a relatedProofIds entry that doesn't resolve to a real proof claim (D3, no DB-level FK)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .post("/portfolio-library/records")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        publicId: uniquePublicId("PORTFOLIO"),
        projectOrClientName: "Bad Proof Fixture",
        relatedProofIds: [randomUUID()],
      })
      .expect(400);
  });

  it("creates a portfolio record with categories/tags and round-trips them on GET", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftRecord(cookie, {
      projectOrClientName: "Relationship Fixture Client",
      additionalCategories: ["E-Commerce", "SaaS"],
      tags: ["Featured"],
    });

    const getResponse = await request(app.getHttpServer())
      .get(`/portfolio-library/records/${created.id}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(getResponse.body.data.additionalCategories).toEqual(["E-Commerce", "SaaS"]);
    expect(getResponse.body.data.tags).toEqual(["Featured"]);
  });

  it("rejects an empty update patch with 400 (no-op saves shouldn't burn a version)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftRecord(cookie);
    await request(app.getHttpServer())
      .post(`/portfolio-library/records/${created.id}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({})
      .expect(400);
  });

  it("clears an array field with an explicit null, distinct from omitting it", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftRecord(cookie, {
      additionalCategories: ["Category A"],
      tags: ["Tag A"],
    });

    const updateResponse = await request(app.getHttpServer())
      .post(`/portfolio-library/records/${created.id}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ additionalCategories: null })
      .expect(200);

    expect(updateResponse.body.data.additionalCategories).toEqual([]);
    expect(updateResponse.body.data.tags).toEqual(["Tag A"]);
  });

  it("marketing_editor (VCESR) can submit and review, but is denied approve (draft->submitted->under_review->approved)", async () => {
    const cookie = await cookieForNewSession(marketingEditorUserId);
    const created = await createDraftRecord(cookie, {
      projectOrClientName: "Marketing Editor Fixture",
    });

    await request(app.getHttpServer())
      .post(`/portfolio-library/records/${created.id}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/portfolio-library/records/${created.id}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "under_review" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/portfolio-library/records/${created.id}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "approved" })
      .expect(403);
  });

  it("owner_growth_approver (VCERAPX, no S) is denied draft->submitted, but can review and approve once submitted", async () => {
    const adminCookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftRecord(adminCookie, {
      projectOrClientName: "Owner Approver Fixture",
    });

    const approverCookie = await cookieForNewSession(ownerGrowthApproverUserId);
    await request(app.getHttpServer())
      .post(`/portfolio-library/records/${created.id}/status`)
      .set("Cookie", approverCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(403);

    // Neither super_admin nor owner_growth_approver holds "submit" (VCERAPX, no S) — only
    // marketing_editor does. A real marketing_editor submits it so the owner_growth_approver's own
    // review/approve path can be exercised.
    const editorCookie = await cookieForNewSession(marketingEditorUserId);
    await request(app.getHttpServer())
      .post(`/portfolio-library/records/${created.id}/status`)
      .set("Cookie", editorCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/portfolio-library/records/${created.id}/status`)
      .set("Cookie", approverCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "under_review" })
      .expect(200);

    const approveResponse = await request(app.getHttpServer())
      .post(`/portfolio-library/records/${created.id}/status`)
      .set("Cookie", approverCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "approved" })
      .expect(200);
    expect(approveResponse.body.data.approvalStatus).toBe("approved");
  });

  it("qa_security_reviewer (VR only) can view and review, but is denied create and approve", async () => {
    const adminCookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftRecord(adminCookie, {
      projectOrClientName: "QA Reviewer Fixture",
    });
    const editorCookie = await cookieForNewSession(marketingEditorUserId);
    await request(app.getHttpServer())
      .post(`/portfolio-library/records/${created.id}/status`)
      .set("Cookie", editorCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(200);

    const qaCookie = await cookieForNewSession(qaSecurityReviewerUserId);
    await request(app.getHttpServer())
      .post("/portfolio-library/records")
      .set("Cookie", qaCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: uniquePublicId("PORTFOLIO"), projectOrClientName: "Denied create" })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/portfolio-library/records/${created.id}/status`)
      .set("Cookie", qaCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "under_review" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/portfolio-library/records/${created.id}/status`)
      .set("Cookie", qaCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "approved" })
      .expect(403);
  });

  it("rejects an invalid approval-status transition (archived -> submitted, archived is terminal) with 400", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftRecord(cookie, {
      projectOrClientName: "Terminal State Fixture",
    });

    await request(app.getHttpServer())
      .post(`/portfolio-library/records/${created.id}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "archived" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/portfolio-library/records/${created.id}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(400);
  });

  it("rejects editing a record after it moves to archived (terminal-state guard)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftRecord(cookie, {
      projectOrClientName: "Edit After Archive Fixture",
    });
    await request(app.getHttpServer())
      .post(`/portfolio-library/records/${created.id}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "archived" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/portfolio-library/records/${created.id}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ projectOrClientName: "Should Not Apply" })
      .expect(400);
  });

  describe("publish/unpublish (D5)", () => {
    it("rejects publishing a draft (not yet approved) record with 400, via a super_admin session that DOES hold publish", async () => {
      const cookie = await cookieForNewSession(superAdminUserId);
      const created = await createDraftRecord(cookie, {
        projectOrClientName: "Not Yet Approved",
      });

      await request(app.getHttpServer())
        .post(`/portfolio-library/records/${created.id}/publish`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .expect(400);
    });

    it("publishes an approved record as super_admin, stamping publishedAt, then unpublishes it, leaving publishedAt unchanged", async () => {
      const adminCookie = await cookieForNewSession(superAdminUserId);
      const editorCookie = await cookieForNewSession(marketingEditorUserId);
      const created = await createDraftRecord(adminCookie, {
        projectOrClientName: "Publish Fixture",
      });
      await approveRecord(created.id, editorCookie, adminCookie);

      const publishResponse = await request(app.getHttpServer())
        .post(`/portfolio-library/records/${created.id}/publish`)
        .set("Cookie", adminCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .expect(200);
      expect(publishResponse.body.data.isPublished).toBe(true);
      const publishedAt = publishResponse.body.data.publishedAt as string;
      expect(publishedAt).toBeTruthy();

      const unpublishResponse = await request(app.getHttpServer())
        .post(`/portfolio-library/records/${created.id}/unpublish`)
        .set("Cookie", adminCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .expect(200);
      expect(unpublishResponse.body.data.isPublished).toBe(false);
      // publishedAt is never cleared by unpublish() (D5) — preserved as permanent history.
      expect(unpublishResponse.body.data.publishedAt).toBe(publishedAt);
    });

    it("denies publish with 403 for a marketing_editor session (VCESR — no P grant)", async () => {
      const adminCookie = await cookieForNewSession(superAdminUserId);
      const editorCookie = await cookieForNewSession(marketingEditorUserId);
      const created = await createDraftRecord(adminCookie, {
        projectOrClientName: "Editor Publish Denied Fixture",
      });
      await approveRecord(created.id, editorCookie, adminCookie);

      await request(app.getHttpServer())
        .post(`/portfolio-library/records/${created.id}/publish`)
        .set("Cookie", editorCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .expect(403);
    });

    it("denies unpublish with 403 for a read_only session (V only — no P grant)", async () => {
      const adminCookie = await cookieForNewSession(superAdminUserId);
      const editorCookie = await cookieForNewSession(marketingEditorUserId);
      const readOnlyCookie = await cookieForNewSession(readOnlyUserId);
      const created = await createDraftRecord(adminCookie, {
        projectOrClientName: "Read Only Unpublish Denied Fixture",
      });
      await approveRecord(created.id, editorCookie, adminCookie);
      await request(app.getHttpServer())
        .post(`/portfolio-library/records/${created.id}/publish`)
        .set("Cookie", adminCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .expect(200);

      await request(app.getHttpServer())
        .post(`/portfolio-library/records/${created.id}/unpublish`)
        .set("Cookie", readOnlyCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .expect(403);
    });

    it("owner_growth_approver (holds P) can publish an approved record it approved itself", async () => {
      const editorCookie = await cookieForNewSession(marketingEditorUserId);
      const approverCookie = await cookieForNewSession(ownerGrowthApproverUserId);
      const created = await createDraftRecord(editorCookie, {
        projectOrClientName: "Owner Approver Publish Fixture",
      });
      await approveRecord(created.id, editorCookie, approverCookie);

      const publishResponse = await request(app.getHttpServer())
        .post(`/portfolio-library/records/${created.id}/publish`)
        .set("Cookie", approverCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .expect(200);
      expect(publishResponse.body.data.isPublished).toBe(true);
    });

    it("unpublish succeeds even after the record later moves to archived (no automatic unpublish on a later status transition)", async () => {
      const adminCookie = await cookieForNewSession(superAdminUserId);
      const editorCookie = await cookieForNewSession(marketingEditorUserId);
      const created = await createDraftRecord(adminCookie, {
        projectOrClientName: "Archive Then Unpublish",
      });
      await approveRecord(created.id, editorCookie, adminCookie);
      await request(app.getHttpServer())
        .post(`/portfolio-library/records/${created.id}/publish`)
        .set("Cookie", adminCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .expect(200);

      // Move to archived — a published record stays published, no side effect.
      const archiveResponse = await request(app.getHttpServer())
        .post(`/portfolio-library/records/${created.id}/status`)
        .set("Cookie", adminCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ approvalStatus: "archived" })
        .expect(200);
      expect(archiveResponse.body.data.isPublished).toBe(true);

      const unpublishResponse = await request(app.getHttpServer())
        .post(`/portfolio-library/records/${created.id}/unpublish`)
        .set("Cookie", adminCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .expect(200);
      expect(unpublishResponse.body.data.isPublished).toBe(false);
      expect(unpublishResponse.body.data.approvalStatus).toBe("archived");
    });

    it("returns 409 (not a silent success) when publishing an already-published record", async () => {
      const adminCookie = await cookieForNewSession(superAdminUserId);
      const editorCookie = await cookieForNewSession(marketingEditorUserId);
      const created = await createDraftRecord(adminCookie, {
        projectOrClientName: "Double Publish Fixture",
      });
      await approveRecord(created.id, editorCookie, adminCookie);
      await request(app.getHttpServer())
        .post(`/portfolio-library/records/${created.id}/publish`)
        .set("Cookie", adminCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .expect(200);

      await request(app.getHttpServer())
        .post(`/portfolio-library/records/${created.id}/publish`)
        .set("Cookie", adminCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .expect(409);
    });

    it("returns 409 (not a silent success) when unpublishing an already-unpublished record", async () => {
      const cookie = await cookieForNewSession(superAdminUserId);
      const created = await createDraftRecord(cookie, {
        projectOrClientName: "Double Unpublish Fixture",
      });

      await request(app.getHttpServer())
        .post(`/portfolio-library/records/${created.id}/unpublish`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .expect(409);
    });

    it("returns 404 (not a raw 500) publishing a nonexistent portfolio record", async () => {
      const cookie = await cookieForNewSession(superAdminUserId);
      await request(app.getHttpServer())
        .post(`/portfolio-library/records/${randomUUID()}/publish`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .expect(404);
    });
  });

  describe("screenshots sub-resource (D2 — real join into `assets`, no DB-level FK)", () => {
    it("links, lists, updates, and unlinks a screenshot, scoped to the parent record", async () => {
      const cookie = await cookieForNewSession(superAdminUserId);
      const created = await createDraftRecord(cookie, {
        projectOrClientName: "Screenshot Fixture",
      });
      const asset = await assets.create({ publicId: uniquePublicId("ASSET"), title: "Screenshot" });
      const assetId = asset.id;

      const createResponse = await request(app.getHttpServer())
        .post(`/portfolio-library/records/${created.id}/screenshots`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ assetId, role: "hero_screenshot", caption: "Homepage hero" })
        .expect(201);
      const screenshotId = createResponse.body.data.id as string;
      expect(createResponse.body.data.assetId).toBe(assetId);

      const listResponse = await request(app.getHttpServer())
        .get(`/portfolio-library/records/${created.id}/screenshots`)
        .set("Cookie", cookie)
        .expect(200);
      expect(
        (listResponse.body.data as Array<{ id: string }>).some((s) => s.id === screenshotId),
      ).toBe(true);

      const updateResponse = await request(app.getHttpServer())
        .post(`/portfolio-library/records/${created.id}/screenshots/${screenshotId}/update`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ role: "other" })
        .expect(200);
      expect(updateResponse.body.data.role).toBe("other");

      await request(app.getHttpServer())
        .post(`/portfolio-library/records/${created.id}/screenshots/${screenshotId}/delete`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .expect(204);

      const listAfterDelete = await request(app.getHttpServer())
        .get(`/portfolio-library/records/${created.id}/screenshots`)
        .set("Cookie", cookie)
        .expect(200);
      expect(
        (listAfterDelete.body.data as Array<{ id: string }>).some((s) => s.id === screenshotId),
      ).toBe(false);
    });

    it("404s linking a screenshot to a nonexistent portfolio record, not a raw 500", async () => {
      const cookie = await cookieForNewSession(superAdminUserId);
      await request(app.getHttpServer())
        .post(`/portfolio-library/records/${randomUUID()}/screenshots`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ assetId: randomUUID(), role: "logo" })
        .expect(404);
    });

    it("denies linking a screenshot with 403 for a read_only session (V only — no edit grant)", async () => {
      const adminCookie = await cookieForNewSession(superAdminUserId);
      const created = await createDraftRecord(adminCookie, {
        projectOrClientName: "Screenshot RBAC Fixture",
      });
      const readOnlyCookie = await cookieForNewSession(readOnlyUserId);

      await request(app.getHttpServer())
        .post(`/portfolio-library/records/${created.id}/screenshots`)
        .set("Cookie", readOnlyCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ assetId: randomUUID(), role: "logo" })
        .expect(403);
    });

    it("404s updating/deleting a screenshot scoped to a different portfolio record (IDOR prevention)", async () => {
      const cookie = await cookieForNewSession(superAdminUserId);
      const recordA = await createDraftRecord(cookie, { projectOrClientName: "IDOR Record A" });
      const recordB = await createDraftRecord(cookie, { projectOrClientName: "IDOR Record B" });
      const asset = await assets.create({ publicId: uniquePublicId("ASSET"), title: "IDOR Asset" });

      const createResponse = await request(app.getHttpServer())
        .post(`/portfolio-library/records/${recordA.id}/screenshots`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ assetId: asset.id, role: "logo" })
        .expect(201);
      const screenshotId = createResponse.body.data.id as string;

      await request(app.getHttpServer())
        .post(`/portfolio-library/records/${recordB.id}/screenshots/${screenshotId}/update`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ role: "video" })
        .expect(404);

      await request(app.getHttpServer())
        .post(`/portfolio-library/records/${recordB.id}/screenshots/${screenshotId}/delete`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .expect(404);
    });
  });

  it("returns 404 for a GET on a nonexistent portfolio record id", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .get(`/portfolio-library/records/${randomUUID()}`)
      .set("Cookie", cookie)
      .expect(404);
  });

  it("returns 400 (not a raw 500) for a malformed portfolio record id", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .get("/portfolio-library/records/not-a-uuid")
      .set("Cookie", cookie)
      .expect(400);
  });

  it("rejects a mutating request with no Origin header (OriginCheckGuard)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .post("/portfolio-library/records")
      .set("Cookie", cookie)
      .send({ publicId: uniquePublicId("PORTFOLIO"), projectOrClientName: "No origin" })
      .expect(403);
  });
});
