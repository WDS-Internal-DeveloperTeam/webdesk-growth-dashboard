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
import { WebsiteStrategyCenterModule } from "../src/website-strategy-center/website-strategy-center.module.js";

/**
 * Request-level coverage for the Website Strategy Center module HTTP surface, against a REAL
 * disposable PostgreSQL database — same harness pattern as `proof-and-claims-library.e2e-spec.ts`.
 * `website_strategy` has real seeded grants (`00013-seed-rbac-matrix.ts:109-116`) that
 * meaningfully differ per role:
 *   super_admin              VCERAMX  (create, edit, review, approve — not submit)
 *   owner_growth_approver    VCERAX   (create, edit, review, approve — not submit)
 *   marketing_editor         VCESR    (create, edit, submit, review — not approve)
 *   designer_creative_reviewer VCR    (create, review — not submit, not approve)
 *   qa_security_reviewer     VR       (view, review only)
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

describe("Website Strategy Center module endpoints (e2e, real disposable database)", () => {
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
      .post("/website-strategy-center/records")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        publicId: uniquePublicId("WSC"),
        recordType: "navigation_plan",
        title: "E2E Fixture Record",
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
      imports: [WebsiteStrategyCenterModule],
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

    superAdminUserId = await createUserWithRole("wsc.super-admin", "super_admin");
    readOnlyUserId = await createUserWithRole("wsc.read-only", "read_only");
    marketingEditorUserId = await createUserWithRole("wsc.marketing-editor", "marketing_editor");
    ownerGrowthApproverUserId = await createUserWithRole(
      "wsc.owner-growth-approver",
      "owner_growth_approver",
    );
    designerCreativeReviewerUserId = await createUserWithRole(
      "wsc.designer-creative-reviewer",
      "designer_creative_reviewer",
    );
    qaSecurityReviewerUserId = await createUserWithRole(
      "wsc.qa-security-reviewer",
      "qa_security_reviewer",
    );
  }, 30_000);

  afterAll(async () => {
    await app.close();
    const migrator = buildMigrator();
    await migrator.down({ to: 0 });
    await closeConnection();
  }, 30_000);

  it("rejects GET /website-strategy-center/records with 401 when there is no session cookie", async () => {
    await request(app.getHttpServer()).get("/website-strategy-center/records").expect(401);
  });

  it("allows a real super_admin session to create, read, list, and edit a record", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftRecord(cookie, { title: "Q1 Navigation Plan" });
    expect(created.approvalStatus).toBe("draft");
    expect(created.versionNumber).toBe(1);
    expect(created.isCurrent).toBe(true);

    const getResponse = await request(app.getHttpServer())
      .get(`/website-strategy-center/records/${created.recordId}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(getResponse.body.data.title).toBe("Q1 Navigation Plan");

    const listResponse = await request(app.getHttpServer())
      .get("/website-strategy-center/records")
      .set("Cookie", cookie)
      .expect(200);
    expect(
      (listResponse.body.data as Array<{ recordId: string }>).some(
        (r) => r.recordId === created.recordId,
      ),
    ).toBe(true);

    const versionsResponse = await request(app.getHttpServer())
      .get(`/website-strategy-center/records/${created.recordId}/versions`)
      .set("Cookie", cookie)
      .expect(200);
    expect(versionsResponse.body.data).toHaveLength(1);

    const updateResponse = await request(app.getHttpServer())
      .post(`/website-strategy-center/records/${created.recordId}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ title: "Q1 Navigation Plan (revised)" })
      .expect(200);
    expect(updateResponse.body.data.title).toBe("Q1 Navigation Plan (revised)");
    expect(updateResponse.body.data.approvalStatus).toBe("draft"); // update never touches status
    // Still the SAME row (id unchanged) — an edit on a non-approved version is an in-place
    // mutation, not a new version.
    expect(updateResponse.body.data.id).toBe(created.id);
    expect(updateResponse.body.data.versionNumber).toBe(1);
  });

  it("denies record creation with 403 for a read_only session (only V grant, not C)", async () => {
    const cookie = await cookieForNewSession(readOnlyUserId);
    await request(app.getHttpServer())
      .post("/website-strategy-center/records")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: uniquePublicId("WSC"), recordType: "navigation_plan", title: "Denied" })
      .expect(403);
  });

  it("allows a read_only session to list records (V grant)", async () => {
    const cookie = await cookieForNewSession(readOnlyUserId);
    await request(app.getHttpServer())
      .get("/website-strategy-center/records")
      .set("Cookie", cookie)
      .expect(200);
  });

  it("list() search treats a literal % as literal text, not a SQL wildcard (escapeLikePattern)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const uniqueSuffix = uniquePublicId("PCT");
    const wildcardMatch = await createDraftRecord(cookie, {
      title: `50% Off Plan ${uniqueSuffix}`,
    });
    const plainMatch = await createDraftRecord(cookie, {
      title: `50X Off Plan ${uniqueSuffix}`,
    });

    const response = await request(app.getHttpServer())
      .get("/website-strategy-center/records")
      .query({ search: `50% Off Plan ${uniqueSuffix}` })
      .set("Cookie", cookie)
      .expect(200);
    const ids = (response.body.data as Array<{ id: string }>).map((r) => r.id);
    expect(ids).toContain(wildcardMatch.id);
    expect(ids).not.toContain(plainMatch.id);
  });

  it("rejects record creation with 400 when publicId is already in use", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const publicId = uniquePublicId("WSC");
    await request(app.getHttpServer())
      .post("/website-strategy-center/records")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId, recordType: "navigation_plan", title: "First" })
      .expect(201);
    await request(app.getHttpServer())
      .post("/website-strategy-center/records")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId, recordType: "navigation_plan", title: "Second" })
      .expect(400);
  });

  it("rejects an empty update patch with 400", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftRecord(cookie);
    await request(app.getHttpServer())
      .post(`/website-strategy-center/records/${created.recordId}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({})
      .expect(400);
  });

  it("rejects an unrecognized recordType at the API boundary (Zod enum validation)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .post("/website-strategy-center/records")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: uniquePublicId("WSC"), recordType: "not_a_real_type", title: "X" })
      .expect(400);
  });

  it("marketing_editor (VCESR) can submit and review, but is denied approve (draft->submitted->under_review->approved)", async () => {
    const cookie = await cookieForNewSession(marketingEditorUserId);
    const created = await createDraftRecord(cookie, { title: "Marketing Editor Fixture" });

    await request(app.getHttpServer())
      .post(`/website-strategy-center/records/${created.recordId}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/website-strategy-center/records/${created.recordId}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "under_review" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/website-strategy-center/records/${created.recordId}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "approved" })
      .expect(403);
  });

  it("owner_growth_approver (VCERAX, no S) is denied draft->submitted, but can review and approve once submitted", async () => {
    const adminCookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftRecord(adminCookie, { title: "Owner Approver Fixture" });

    const approverCookie = await cookieForNewSession(ownerGrowthApproverUserId);
    await request(app.getHttpServer())
      .post(`/website-strategy-center/records/${created.recordId}/status`)
      .set("Cookie", approverCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(403);

    const editorCookie = await cookieForNewSession(marketingEditorUserId);
    await request(app.getHttpServer())
      .post(`/website-strategy-center/records/${created.recordId}/status`)
      .set("Cookie", editorCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/website-strategy-center/records/${created.recordId}/status`)
      .set("Cookie", approverCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "under_review" })
      .expect(200);

    const approveResponse = await request(app.getHttpServer())
      .post(`/website-strategy-center/records/${created.recordId}/status`)
      .set("Cookie", approverCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "approved" })
      .expect(200);
    expect(approveResponse.body.data.approvalStatus).toBe("approved");
  });

  it("designer_creative_reviewer (VCR) can create and review, but is denied submit and approve", async () => {
    const cookie = await cookieForNewSession(designerCreativeReviewerUserId);
    const created = await createDraftRecord(cookie, { title: "Designer Reviewer Fixture" });

    await request(app.getHttpServer())
      .post(`/website-strategy-center/records/${created.recordId}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(403);

    const editorCookie = await cookieForNewSession(marketingEditorUserId);
    await request(app.getHttpServer())
      .post(`/website-strategy-center/records/${created.recordId}/status`)
      .set("Cookie", editorCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/website-strategy-center/records/${created.recordId}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "under_review" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/website-strategy-center/records/${created.recordId}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "approved" })
      .expect(403);
  });

  it("qa_security_reviewer (VR only) can view and review, but is denied create and approve", async () => {
    const adminCookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftRecord(adminCookie, { title: "QA Reviewer Fixture" });
    const editorCookie = await cookieForNewSession(marketingEditorUserId);
    await request(app.getHttpServer())
      .post(`/website-strategy-center/records/${created.recordId}/status`)
      .set("Cookie", editorCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(200);

    const qaCookie = await cookieForNewSession(qaSecurityReviewerUserId);
    await request(app.getHttpServer())
      .post("/website-strategy-center/records")
      .set("Cookie", qaCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        publicId: uniquePublicId("WSC"),
        recordType: "navigation_plan",
        title: "Denied create",
      })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/website-strategy-center/records/${created.recordId}/status`)
      .set("Cookie", qaCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "under_review" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/website-strategy-center/records/${created.recordId}/status`)
      .set("Cookie", qaCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "approved" })
      .expect(403);
  });

  it("rejects an invalid approval-status transition (archived -> submitted, archived is terminal) with 400", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftRecord(cookie, { title: "Terminal State Fixture" });

    await request(app.getHttpServer())
      .post(`/website-strategy-center/records/${created.recordId}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "archived" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/website-strategy-center/records/${created.recordId}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(400);
  });

  it("returns 404 for a GET on a nonexistent record id", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .get(`/website-strategy-center/records/${randomUUID()}`)
      .set("Cookie", cookie)
      .expect(404);
  });

  it("returns 400 (not a raw 500) for a malformed record id", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .get("/website-strategy-center/records/not-a-uuid")
      .set("Cookie", cookie)
      .expect(400);
  });

  it("returns 404 for GET .../versions on a nonexistent record id", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .get(`/website-strategy-center/records/${randomUUID()}/versions`)
      .set("Cookie", cookie)
      .expect(404);
  });

  it("rejects a mutating request with no Origin header (OriginCheckGuard)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .post("/website-strategy-center/records")
      .set("Cookie", cookie)
      .send({ publicId: uniquePublicId("WSC"), recordType: "navigation_plan", title: "No origin" })
      .expect(403);
  });

  // --- real versioning behavior, over real HTTP, against the real database ---

  it("editing an APPROVED record creates a genuinely new version over real HTTP, then approving the new version supersedes the old one", async () => {
    // super_admin (VCERAMX) holds view/create/edit/review/approve but NOT submit — mirrors
    // service_persona_proof's/proof_and_claims_library's own identical shape. Submits go through
    // marketing_editor (VCESR); create/edit/review/approve go through super_admin, matching
    // "owner_growth_approver (VCERAX, no S)..." test's own established pattern above.
    const cookie = await cookieForNewSession(superAdminUserId);
    const editorCookie = await cookieForNewSession(marketingEditorUserId);
    const created = await createDraftRecord(cookie, {
      title: "Pillar Strategy V1",
      recordType: "pillar_strategy",
      content: "Original content",
    });

    // draft -> submitted (marketing_editor) -> under_review -> approved (super_admin)
    await request(app.getHttpServer())
      .post(`/website-strategy-center/records/${created.recordId}/status`)
      .set("Cookie", editorCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/website-strategy-center/records/${created.recordId}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "under_review" })
      .expect(200);
    const approvedV1 = await request(app.getHttpServer())
      .post(`/website-strategy-center/records/${created.recordId}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "approved" })
      .expect(200);
    expect(approvedV1.body.data.approvalStatus).toBe("approved");
    expect(approvedV1.body.data.versionNumber).toBe(1);

    // Editing the now-approved current version creates a NEW version — a different row id, the
    // same recordId, versionNumber incremented, status reset to draft.
    const editResponse = await request(app.getHttpServer())
      .post(`/website-strategy-center/records/${created.recordId}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ title: "Pillar Strategy V2 (revised)" })
      .expect(200);
    expect(editResponse.body.data.id).not.toBe(created.id);
    expect(editResponse.body.data.recordId).toBe(created.recordId);
    expect(editResponse.body.data.versionNumber).toBe(2);
    expect(editResponse.body.data.isCurrent).toBe(true);
    expect(editResponse.body.data.approvalStatus).toBe("draft");
    // content is carried forward unchanged since the patch didn't touch it.
    expect(editResponse.body.data.content).toBe("Original content");

    // Both versions are now visible via the version-history route.
    const versionsAfterEdit = await request(app.getHttpServer())
      .get(`/website-strategy-center/records/${created.recordId}/versions`)
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

    // Approve v2 (draft -> submitted (marketing_editor) -> under_review -> approved (super_admin)).
    await request(app.getHttpServer())
      .post(`/website-strategy-center/records/${created.recordId}/status`)
      .set("Cookie", editorCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/website-strategy-center/records/${created.recordId}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "under_review" })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/website-strategy-center/records/${created.recordId}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "approved" })
      .expect(200);

    // v1 is now superseded; v2 is the current, approved version.
    const finalVersions = await request(app.getHttpServer())
      .get(`/website-strategy-center/records/${created.recordId}/versions`)
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
      .get(`/website-strategy-center/records/${created.recordId}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(currentRecord.body.data.id).toBe(editResponse.body.data.id);
    expect(currentRecord.body.data.title).toBe("Pillar Strategy V2 (revised)");
  });

  it("editing a non-approved record mutates it in place (no new version) over real HTTP", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftRecord(cookie, { title: "Draft, still editable in place" });

    const editResponse = await request(app.getHttpServer())
      .post(`/website-strategy-center/records/${created.recordId}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ title: "Renamed while still draft" })
      .expect(200);

    expect(editResponse.body.data.id).toBe(created.id);
    expect(editResponse.body.data.versionNumber).toBe(1);

    const versions = await request(app.getHttpServer())
      .get(`/website-strategy-center/records/${created.recordId}/versions`)
      .set("Cookie", cookie)
      .expect(200);
    expect(versions.body.data).toHaveLength(1);
  });
});
