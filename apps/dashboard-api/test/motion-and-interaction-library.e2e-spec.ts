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
import { MotionAndInteractionLibraryModule } from "../src/motion-and-interaction-library/motion-and-interaction-library.module.js";

/**
 * Request-level coverage for the Motion and Interaction Library module HTTP surface, against a
 * REAL disposable PostgreSQL database — same harness pattern as
 * `section-and-pattern-library.e2e-spec.ts`/`page-template-library.e2e-spec.ts`. Reuses the
 * identical `creative_design` seeded RBAC matrix (`00013-seed-rbac-matrix.ts:132-140`):
 *   super_admin              VCERAPX  (create, edit, review, approve, publish/unpublish, export — not submit)
 *   owner_growth_approver    VERAPX   (edit, review, approve, publish, export — not create, not submit)
 *   marketing_editor         VR       (view, review only — not create, edit, submit, or approve)
 *   designer_creative_reviewer VCERAS (create, edit, review, approve, SUBMIT — the only role holding submit)
 *   qa_security_reviewer     VR       (view, review only)
 *   read_only                V        (view only)
 * `designer_creative_reviewer` is the only role that can drive the full submit->review->approve
 * loop alone. This module also imports `ComponentLibraryModule` for the real
 * `relatedComponentIds` existence check — several tests exercise this cross-module validation
 * over real HTTP.
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

describe("Motion and Interaction Library module endpoints (e2e, real disposable database)", () => {
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
  let designerCreativeReviewerUserId: string;
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
      .post("/motion-and-interaction-library/records")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        publicId: uniquePublicId("MIL"),
        category: "modal_drawer",
        name: "E2E Fixture Motion",
        ...overrides,
      })
      .expect(201);
    return response.body.data as {
      id: string;
      recordId: string;
      publicId: string;
      versionNumber: number;
      isCurrent: boolean;
      approvalStatus: string;
      name: string;
      relatedComponentIds: string[];
    };
  }

  async function createDraftComponent(cookie: string, overrides: Record<string, unknown> = {}) {
    const response = await request(app.getHttpServer())
      .post("/component-library/components")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        publicId: uniquePublicId("CMP"),
        category: "buttons",
        name: "E2E Component Fixture",
        ...overrides,
      })
      .expect(201);
    return response.body.data as { recordId: string };
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
      imports: [MotionAndInteractionLibraryModule],
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

    superAdminUserId = await createUserWithRole("mil.super-admin", "super_admin");
    readOnlyUserId = await createUserWithRole("mil.read-only", "read_only");
    marketingEditorUserId = await createUserWithRole("mil.marketing-editor", "marketing_editor");
    ownerGrowthApproverUserId = await createUserWithRole(
      "mil.owner-growth-approver",
      "owner_growth_approver",
    );
    designerCreativeReviewerUserId = await createUserWithRole(
      "mil.designer-creative-reviewer",
      "designer_creative_reviewer",
    );
    qaSecurityReviewerUserId = await createUserWithRole(
      "mil.qa-security-reviewer",
      "qa_security_reviewer",
    );
  }, 30_000);

  afterAll(async () => {
    await app.close();
    const migrator = buildMigrator();
    await migrator.down({ to: 0 });
    await closeConnection();
  }, 30_000);

  it("rejects GET /motion-and-interaction-library/records with 401 when there is no session cookie", async () => {
    await request(app.getHttpServer()).get("/motion-and-interaction-library/records").expect(401);
  });

  it("allows a real super_admin session to create, read, list, and edit a record", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftRecord(cookie, { name: "Modal open transition" });
    expect(created.approvalStatus).toBe("draft");
    expect(created.versionNumber).toBe(1);
    expect(created.isCurrent).toBe(true);

    const getResponse = await request(app.getHttpServer())
      .get(`/motion-and-interaction-library/records/${created.recordId}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(getResponse.body.data.name).toBe("Modal open transition");

    const listResponse = await request(app.getHttpServer())
      .get("/motion-and-interaction-library/records")
      .set("Cookie", cookie)
      .expect(200);
    expect(
      (listResponse.body.data as Array<{ recordId: string }>).some(
        (r) => r.recordId === created.recordId,
      ),
    ).toBe(true);

    const versionsResponse = await request(app.getHttpServer())
      .get(`/motion-and-interaction-library/records/${created.recordId}/versions`)
      .set("Cookie", cookie)
      .expect(200);
    expect(versionsResponse.body.data).toHaveLength(1);

    const updateResponse = await request(app.getHttpServer())
      .post(`/motion-and-interaction-library/records/${created.recordId}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ name: "Modal open transition (revised)" })
      .expect(200);
    expect(updateResponse.body.data.name).toBe("Modal open transition (revised)");
    expect(updateResponse.body.data.approvalStatus).toBe("draft"); // update never touches status
    // Still the SAME row (id unchanged) — an edit on a non-approved version is an in-place
    // mutation, not a new version.
    expect(updateResponse.body.data.id).toBe(created.id);
    expect(updateResponse.body.data.versionNumber).toBe(1);
  });

  it("denies record creation with 403 for a read_only session (only V grant, not C)", async () => {
    const cookie = await cookieForNewSession(readOnlyUserId);
    await request(app.getHttpServer())
      .post("/motion-and-interaction-library/records")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: uniquePublicId("MIL"), category: "loader", name: "Denied" })
      .expect(403);
  });

  it("allows a read_only session to list records (V grant)", async () => {
    const cookie = await cookieForNewSession(readOnlyUserId);
    await request(app.getHttpServer())
      .get("/motion-and-interaction-library/records")
      .set("Cookie", cookie)
      .expect(200);
  });

  it("denies record creation with 403 for owner_growth_approver (VERAPX has no C)", async () => {
    const cookie = await cookieForNewSession(ownerGrowthApproverUserId);
    await request(app.getHttpServer())
      .post("/motion-and-interaction-library/records")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: uniquePublicId("MIL"), category: "loader", name: "Denied" })
      .expect(403);
  });

  it("list() search treats a literal % as literal text, not a SQL wildcard (escapeLikePattern)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const uniqueSuffix = uniquePublicId("PCT");
    const wildcardMatch = await createDraftRecord(cookie, {
      name: `50% Off Motion ${uniqueSuffix}`,
    });
    const plainMatch = await createDraftRecord(cookie, {
      name: `50X Off Motion ${uniqueSuffix}`,
    });

    const response = await request(app.getHttpServer())
      .get("/motion-and-interaction-library/records")
      .query({ search: `50% Off Motion ${uniqueSuffix}` })
      .set("Cookie", cookie)
      .expect(200);
    const ids = (response.body.data as Array<{ id: string }>).map((r) => r.id);
    expect(ids).toContain(wildcardMatch.id);
    expect(ids).not.toContain(plainMatch.id);
  });

  it("rejects record creation with 400 when publicId is already in use", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const publicId = uniquePublicId("MIL");
    await request(app.getHttpServer())
      .post("/motion-and-interaction-library/records")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId, category: "loader", name: "First" })
      .expect(201);
    await request(app.getHttpServer())
      .post("/motion-and-interaction-library/records")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId, category: "loader", name: "Second" })
      .expect(400);
  });

  it("rejects an empty update patch with 400", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftRecord(cookie);
    await request(app.getHttpServer())
      .post(`/motion-and-interaction-library/records/${created.recordId}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({})
      .expect(400);
  });

  it("rejects an unrecognized category at the API boundary (Zod enum validation)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .post("/motion-and-interaction-library/records")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: uniquePublicId("MIL"), category: "not_a_real_category", name: "X" })
      .expect(400);
  });

  it("rejects an unsafe URL scheme for designReference at the API boundary (safeHttpUrlSchema)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .post("/motion-and-interaction-library/records")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        publicId: uniquePublicId("MIL"),
        category: "loader",
        name: "X",
        designReference: "javascript:alert(1)",
      })
      .expect(400);
  });

  it("sanitizes a rich-text description field over real HTTP", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftRecord(cookie, {
      description: "<p>Safe</p><script>alert(1)</script>",
    });
    const getResponse = await request(app.getHttpServer())
      .get(`/motion-and-interaction-library/records/${created.recordId}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(getResponse.body.data.description).not.toContain("<script>");
  });

  it("designer_creative_reviewer (VCERAS) alone can drive the full submit->review->approve loop (the only role holding submit)", async () => {
    const cookie = await cookieForNewSession(designerCreativeReviewerUserId);
    const created = await createDraftRecord(cookie, { name: "Designer Reviewer Fixture" });

    await request(app.getHttpServer())
      .post(`/motion-and-interaction-library/records/${created.recordId}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/motion-and-interaction-library/records/${created.recordId}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "under_review" })
      .expect(200);

    const approveResponse = await request(app.getHttpServer())
      .post(`/motion-and-interaction-library/records/${created.recordId}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "approved" })
      .expect(200);
    expect(approveResponse.body.data.approvalStatus).toBe("approved");
  });

  it("marketing_editor (VR only) can view and review, but is denied create, submit, and approve", async () => {
    const adminCookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftRecord(adminCookie, { name: "Marketing Editor Fixture" });
    const editorCookie = await cookieForNewSession(marketingEditorUserId);

    await request(app.getHttpServer())
      .post("/motion-and-interaction-library/records")
      .set("Cookie", editorCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: uniquePublicId("MIL"), category: "loader", name: "Denied create" })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/motion-and-interaction-library/records/${created.recordId}/status`)
      .set("Cookie", editorCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(403);

    const reviewerCookie = await cookieForNewSession(designerCreativeReviewerUserId);
    await request(app.getHttpServer())
      .post(`/motion-and-interaction-library/records/${created.recordId}/status`)
      .set("Cookie", reviewerCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/motion-and-interaction-library/records/${created.recordId}/status`)
      .set("Cookie", editorCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "under_review" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/motion-and-interaction-library/records/${created.recordId}/status`)
      .set("Cookie", editorCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "approved" })
      .expect(403);
  });

  it("owner_growth_approver (VERAPX, no C, no S) is denied create and denied draft->submitted, but can review and approve once submitted", async () => {
    const reviewerCookie = await cookieForNewSession(designerCreativeReviewerUserId);
    const created = await createDraftRecord(reviewerCookie, { name: "Owner Approver Fixture" });

    const approverCookie = await cookieForNewSession(ownerGrowthApproverUserId);
    await request(app.getHttpServer())
      .post(`/motion-and-interaction-library/records/${created.recordId}/status`)
      .set("Cookie", approverCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/motion-and-interaction-library/records/${created.recordId}/status`)
      .set("Cookie", reviewerCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/motion-and-interaction-library/records/${created.recordId}/status`)
      .set("Cookie", approverCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "under_review" })
      .expect(200);

    const approveResponse = await request(app.getHttpServer())
      .post(`/motion-and-interaction-library/records/${created.recordId}/status`)
      .set("Cookie", approverCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "approved" })
      .expect(200);
    expect(approveResponse.body.data.approvalStatus).toBe("approved");
  });

  it("qa_security_reviewer (VR only) can view and review, but is denied create and approve", async () => {
    const adminCookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftRecord(adminCookie, { name: "QA Reviewer Fixture" });
    const reviewerCookie = await cookieForNewSession(designerCreativeReviewerUserId);
    await request(app.getHttpServer())
      .post(`/motion-and-interaction-library/records/${created.recordId}/status`)
      .set("Cookie", reviewerCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(200);

    const qaCookie = await cookieForNewSession(qaSecurityReviewerUserId);
    await request(app.getHttpServer())
      .post("/motion-and-interaction-library/records")
      .set("Cookie", qaCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: uniquePublicId("MIL"), category: "loader", name: "Denied create" })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/motion-and-interaction-library/records/${created.recordId}/status`)
      .set("Cookie", qaCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "under_review" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/motion-and-interaction-library/records/${created.recordId}/status`)
      .set("Cookie", qaCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "approved" })
      .expect(403);
  });

  it("rejects an invalid approval-status transition (archived -> submitted, archived is terminal) with 400", async () => {
    const cookie = await cookieForNewSession(designerCreativeReviewerUserId);
    const created = await createDraftRecord(cookie, { name: "Terminal State Fixture" });

    await request(app.getHttpServer())
      .post(`/motion-and-interaction-library/records/${created.recordId}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "archived" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/motion-and-interaction-library/records/${created.recordId}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(400);
  });

  it("rejects a direct 'approved -> superseded' status request with 400, over real HTTP (supersede is only ever an automatic side effect of a different version's own approval)", async () => {
    const reviewerCookie = await cookieForNewSession(designerCreativeReviewerUserId);
    const created = await createDraftRecord(reviewerCookie, { name: "Direct Supersede Fixture" });

    await request(app.getHttpServer())
      .post(`/motion-and-interaction-library/records/${created.recordId}/status`)
      .set("Cookie", reviewerCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/motion-and-interaction-library/records/${created.recordId}/status`)
      .set("Cookie", reviewerCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "under_review" })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/motion-and-interaction-library/records/${created.recordId}/status`)
      .set("Cookie", reviewerCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "approved" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/motion-and-interaction-library/records/${created.recordId}/status`)
      .set("Cookie", reviewerCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "superseded" })
      .expect(400);

    // The record's own status is unaffected by the rejected request — still approved.
    const stillApproved = await request(app.getHttpServer())
      .get(`/motion-and-interaction-library/records/${created.recordId}`)
      .set("Cookie", reviewerCookie)
      .expect(200);
    expect(stillApproved.body.data.approvalStatus).toBe("approved");
  });

  it("rejects editing an archived record with 400, over real HTTP, without mutating it (archived/superseded are terminal)", async () => {
    const cookie = await cookieForNewSession(designerCreativeReviewerUserId);
    const created = await createDraftRecord(cookie, { name: "Terminal Edit Fixture" });

    await request(app.getHttpServer())
      .post(`/motion-and-interaction-library/records/${created.recordId}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "archived" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/motion-and-interaction-library/records/${created.recordId}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ name: "Should never be applied" })
      .expect(400);

    const stillOriginal = await request(app.getHttpServer())
      .get(`/motion-and-interaction-library/records/${created.recordId}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(stillOriginal.body.data.name).toBe("Terminal Edit Fixture");
    expect(stillOriginal.body.data.approvalStatus).toBe("archived");
  });

  it("returns 404 for a GET on a nonexistent record id", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .get(`/motion-and-interaction-library/records/${randomUUID()}`)
      .set("Cookie", cookie)
      .expect(404);
  });

  it("returns 400 (not a raw 500) for a malformed record id", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .get("/motion-and-interaction-library/records/not-a-uuid")
      .set("Cookie", cookie)
      .expect(400);
  });

  it("returns 404 for GET .../versions on a nonexistent record id", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .get(`/motion-and-interaction-library/records/${randomUUID()}/versions`)
      .set("Cookie", cookie)
      .expect(404);
  });

  it("rejects a mutating request with no Origin header (OriginCheckGuard)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .post("/motion-and-interaction-library/records")
      .set("Cookie", cookie)
      .send({ publicId: uniquePublicId("MIL"), category: "loader", name: "No origin" })
      .expect(403);
  });

  // --- relatedComponentIds real cross-module existence validation ---

  it("creates a motion/interaction record whose relatedComponentIds resolve to real, current Component Library records", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const component = await createDraftComponent(cookie);

    const created = await createDraftRecord(cookie, {
      relatedComponentIds: [component.recordId],
    });
    expect(created.relatedComponentIds).toEqual([component.recordId]);
  });

  it("rejects a motion/interaction record create with 400 when a relatedComponentIds entry does not resolve to a real component", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .post("/motion-and-interaction-library/records")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        publicId: uniquePublicId("MIL"),
        category: "loader",
        name: "Bad Component Ref",
        relatedComponentIds: [randomUUID()],
      })
      .expect(400);
  });

  it("rejects a motion/interaction record update with 400 when a patched relatedComponentIds entry does not resolve to a real component", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftRecord(cookie);
    await request(app.getHttpServer())
      .post(`/motion-and-interaction-library/records/${created.recordId}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ relatedComponentIds: [randomUUID()] })
      .expect(400);
  });

  // --- real versioning behavior, over real HTTP, against the real database ---

  it("editing an APPROVED record creates a genuinely new version over real HTTP, then approving the new version supersedes the old one", async () => {
    // designer_creative_reviewer (VCERAS) holds create/edit/review/approve/submit all at once —
    // the only role in this module that can drive the entire workflow alone.
    const cookie = await cookieForNewSession(designerCreativeReviewerUserId);
    const created = await createDraftRecord(cookie, {
      name: "Modal open V1",
      category: "modal_drawer",
    });

    // draft -> submitted -> under_review -> approved
    await request(app.getHttpServer())
      .post(`/motion-and-interaction-library/records/${created.recordId}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/motion-and-interaction-library/records/${created.recordId}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "under_review" })
      .expect(200);
    const approvedV1 = await request(app.getHttpServer())
      .post(`/motion-and-interaction-library/records/${created.recordId}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "approved" })
      .expect(200);
    expect(approvedV1.body.data.approvalStatus).toBe("approved");
    expect(approvedV1.body.data.versionNumber).toBe(1);

    // Editing the now-approved current version creates a NEW version — a different row id, the
    // same recordId, versionNumber incremented, status reset to draft.
    const editResponse = await request(app.getHttpServer())
      .post(`/motion-and-interaction-library/records/${created.recordId}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ name: "Modal open V2 (revised)" })
      .expect(200);
    expect(editResponse.body.data.id).not.toBe(created.id);
    expect(editResponse.body.data.recordId).toBe(created.recordId);
    expect(editResponse.body.data.versionNumber).toBe(2);
    expect(editResponse.body.data.isCurrent).toBe(true);
    expect(editResponse.body.data.approvalStatus).toBe("draft");
    // category is carried forward unchanged since the patch has no such field to send.
    expect(editResponse.body.data.category).toBe("modal_drawer");

    // Both versions are now visible via the version-history route.
    const versionsAfterEdit = await request(app.getHttpServer())
      .get(`/motion-and-interaction-library/records/${created.recordId}/versions`)
      .set("Cookie", cookie)
      .expect(200);
    expect(versionsAfterEdit.body.data).toHaveLength(2);
    const v1AfterEdit = (
      versionsAfterEdit.body.data as Array<{
        id: string;
        isCurrent: boolean;
        approvalStatus: string;
      }>
    ).find((r) => r.id === created.id);
    expect(v1AfterEdit?.isCurrent).toBe(false);
    expect(v1AfterEdit?.approvalStatus).toBe("approved"); // still approved, not yet superseded

    // Approve v2.
    await request(app.getHttpServer())
      .post(`/motion-and-interaction-library/records/${created.recordId}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/motion-and-interaction-library/records/${created.recordId}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "under_review" })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/motion-and-interaction-library/records/${created.recordId}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "approved" })
      .expect(200);

    // v1 is now superseded; v2 is the current, approved version.
    const finalVersions = await request(app.getHttpServer())
      .get(`/motion-and-interaction-library/records/${created.recordId}/versions`)
      .set("Cookie", cookie)
      .expect(200);
    const finalV1 = (finalVersions.body.data as Array<{ id: string; approvalStatus: string }>).find(
      (r) => r.id === created.id,
    );
    const finalV2 = (
      finalVersions.body.data as Array<{
        id: string;
        approvalStatus: string;
        isCurrent: boolean;
      }>
    ).find((r) => r.id === editResponse.body.data.id);
    expect(finalV1?.approvalStatus).toBe("superseded");
    expect(finalV2?.approvalStatus).toBe("approved");
    expect(finalV2?.isCurrent).toBe(true);

    const currentRecord = await request(app.getHttpServer())
      .get(`/motion-and-interaction-library/records/${created.recordId}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(currentRecord.body.data.id).toBe(editResponse.body.data.id);
    expect(currentRecord.body.data.name).toBe("Modal open V2 (revised)");
  });

  it("editing a non-approved record mutates it in place (no new version) over real HTTP", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftRecord(cookie, { name: "Draft, still editable in place" });

    const editResponse = await request(app.getHttpServer())
      .post(`/motion-and-interaction-library/records/${created.recordId}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ name: "Renamed while still draft" })
      .expect(200);

    expect(editResponse.body.data.id).toBe(created.id);
    expect(editResponse.body.data.versionNumber).toBe(1);

    const versions = await request(app.getHttpServer())
      .get(`/motion-and-interaction-library/records/${created.recordId}/versions`)
      .set("Cookie", cookie)
      .expect(200);
    expect(versions.body.data).toHaveLength(1);
  });

  // A genuine `Promise.all()`-driven concurrent-edit race against real HTTP/a real database was
  // tried in section-and-pattern-library.e2e-spec.ts and found unreliably flaky (see that file's
  // own trailing comment for the full explanation) — no other `*.e2e-spec.ts` file in this
  // codebase attempts this shape of test for exactly that reason. The real concurrent-edit-
  // collision behavior (`MotionInteractionsService.update()`'s `catch` block translating a
  // `SequelizeUniqueConstraintError` on `(record_id, version_number)` into a clean 409) is already
  // covered deterministically at the unit-test level via a mocked rejection — see
  // `motion-interactions.service.spec.ts`'s "translates a concurrent version-creation collision..."
  // test.
});
