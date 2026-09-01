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
import { CaseStudyStudioModule } from "../src/case-study-studio/case-study-studio.module.js";

/**
 * Request-level coverage for the Case Study Studio module HTTP surface, against a REAL disposable
 * PostgreSQL database — same harness pattern as `proof-and-claims-library.e2e-spec.ts`. Reuses the
 * `case_studies` permission group (D6, `06_Roles_and_Permissions.md`,
 * `00013-seed-rbac-matrix.ts`):
 *   super_admin              VCERAPX  (create, edit, review, approve, publish/unpublish)
 *   owner_growth_approver    VCERAPX  (same)
 *   marketing_editor         VCESR    (create, edit, submit, review — not approve/publish)
 *   qa_security_reviewer     VR       (view, review only)
 *   designer_creative_reviewer VR     (view, review only)
 *   developer / read_only    V        (view only)
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

const ORIGIN = process.env.WEB_APP_ORIGIN!;

describe("Case Study Studio module endpoints (e2e, real disposable database)", () => {
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

  async function createCaseStudy(cookie: string, overrides: Record<string, unknown> = {}) {
    const response = await request(app.getHttpServer())
      .post("/case-study-studio/case-studies")
      .set("Cookie", cookie)
      .set("Origin", ORIGIN)
      .send({
        publicId: uniquePublicId("CS"),
        clientName: "Acme Corp",
        projectTitle: "Website Relaunch",
        ...overrides,
      })
      .expect(201);
    return response.body.data as { id: string; status: string; clientApprovalRequired: boolean };
  }

  async function moveStatus(
    cookie: string,
    id: string,
    body: Record<string, unknown>,
    expectStatus: number,
  ) {
    return request(app.getHttpServer())
      .post(`/case-study-studio/case-studies/${id}/status`)
      .set("Cookie", cookie)
      .set("Origin", ORIGIN)
      .send(body)
      .expect(expectStatus);
  }

  /** Walks a freshly-created case study from `intake` to `internal_approval` — every one of these
   *  transitions requires either `submit` or `review`, neither of which `super_admin`/
   *  `owner_growth_approver` hold in the `case_studies` permission group (D6:
   *  `super_admin`/`owner_growth_approver` = `VCERAPX`, no `S`) — so this uses the
   *  `marketing_editor` (`VCESR`, holds both submit and review) cookie throughout, matching the
   *  real seeded RBAC matrix rather than assuming super_admin can drive every stage. */
  async function advanceToInternalApproval(editorCookie: string, id: string): Promise<void> {
    await moveStatus(editorCookie, id, { status: "upload" }, 200);
    await moveStatus(editorCookie, id, { status: "completeness_review" }, 200);
    await moveStatus(editorCookie, id, { status: "ready_for_claude" }, 200);
    await moveStatus(editorCookie, id, { status: "draft" }, 200);
    await moveStatus(editorCookie, id, { status: "search_review" }, 200);
    await moveStatus(editorCookie, id, { status: "fact_confidentiality_review" }, 200);
    await moveStatus(editorCookie, id, { status: "internal_approval" }, 200);
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
      imports: [CaseStudyStudioModule],
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

    superAdminUserId = await createUserWithRole("cs-studio.super-admin", "super_admin");
    readOnlyUserId = await createUserWithRole("cs-studio.read-only", "read_only");
    marketingEditorUserId = await createUserWithRole(
      "cs-studio.marketing-editor",
      "marketing_editor",
    );
    ownerGrowthApproverUserId = await createUserWithRole(
      "cs-studio.owner-growth-approver",
      "owner_growth_approver",
    );
    qaSecurityReviewerUserId = await createUserWithRole(
      "cs-studio.qa-security-reviewer",
      "qa_security_reviewer",
    );
  }, 30_000);

  afterAll(async () => {
    await app.close();
    const migrator = buildMigrator();
    await migrator.down({ to: 0 });
    await closeConnection();
  }, 30_000);

  it("rejects GET /case-study-studio/case-studies with 401 when there is no session cookie", async () => {
    await request(app.getHttpServer()).get("/case-study-studio/case-studies").expect(401);
  });

  it("allows a real super_admin session to create, read, list, and edit a case study", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createCaseStudy(cookie, { clientName: "Widgets Inc" });
    expect(created.status).toBe("intake");

    const getResponse = await request(app.getHttpServer())
      .get(`/case-study-studio/case-studies/${created.id}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(getResponse.body.data.clientName).toBe("Widgets Inc");

    const listResponse = await request(app.getHttpServer())
      .get("/case-study-studio/case-studies")
      .set("Cookie", cookie)
      .expect(200);
    expect((listResponse.body.data as Array<{ id: string }>).some((c) => c.id === created.id)).toBe(
      true,
    );

    const updateResponse = await request(app.getHttpServer())
      .post(`/case-study-studio/case-studies/${created.id}/update`)
      .set("Cookie", cookie)
      .set("Origin", ORIGIN)
      .send({ projectTitle: "Website Relaunch (revised)" })
      .expect(200);
    expect(updateResponse.body.data.projectTitle).toBe("Website Relaunch (revised)");
    expect(updateResponse.body.data.status).toBe("intake"); // update never touches status
    expect(updateResponse.body.data.version).toBe(2);
  });

  it("denies case study creation with 403 for a read_only session (only V grant, not C)", async () => {
    const cookie = await cookieForNewSession(readOnlyUserId);
    await request(app.getHttpServer())
      .post("/case-study-studio/case-studies")
      .set("Cookie", cookie)
      .set("Origin", ORIGIN)
      .send({ publicId: uniquePublicId("CS"), clientName: "X", projectTitle: "Y" })
      .expect(403);
  });

  it("allows a read_only session to list case studies (V grant)", async () => {
    const cookie = await cookieForNewSession(readOnlyUserId);
    await request(app.getHttpServer())
      .get("/case-study-studio/case-studies")
      .set("Cookie", cookie)
      .expect(200);
  });

  it("rejects case study creation with 400 when publicId is already in use", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const publicId = uniquePublicId("CS");
    await request(app.getHttpServer())
      .post("/case-study-studio/case-studies")
      .set("Cookie", cookie)
      .set("Origin", ORIGIN)
      .send({ publicId, clientName: "A", projectTitle: "First" })
      .expect(201);
    await request(app.getHttpServer())
      .post("/case-study-studio/case-studies")
      .set("Cookie", cookie)
      .set("Origin", ORIGIN)
      .send({ publicId, clientName: "A", projectTitle: "Second" })
      .expect(400);
  });

  it("rejects an empty update patch with 400", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createCaseStudy(cookie);
    await request(app.getHttpServer())
      .post(`/case-study-studio/case-studies/${created.id}/update`)
      .set("Cookie", cookie)
      .set("Origin", ORIGIN)
      .send({})
      .expect(400);
  });

  it("rejects editing an archived case study with 400 (D8 terminal-state guard)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createCaseStudy(cookie);
    await moveStatus(cookie, created.id, { status: "archived" }, 200);

    await request(app.getHttpServer())
      .post(`/case-study-studio/case-studies/${created.id}/update`)
      .set("Cookie", cookie)
      .set("Origin", ORIGIN)
      .send({ projectTitle: "Should be rejected" })
      .expect(400);
  });

  it("sanitizes the four narrative fields, stripping a disallowed tag", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createCaseStudy(cookie, {
      challenge: "<script>alert(1)</script><p>Legacy CMS</p>",
    });

    const getResponse = await request(app.getHttpServer())
      .get(`/case-study-studio/case-studies/${created.id}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(getResponse.body.data.challenge).toBe("<p>Legacy CMS</p>");
  });

  it("returns 404 for a GET on a nonexistent case study id", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .get(`/case-study-studio/case-studies/${randomUUID()}`)
      .set("Cookie", cookie)
      .expect(404);
  });

  it("returns 400 (not a raw 500) for a malformed case study id", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .get("/case-study-studio/case-studies/not-a-uuid")
      .set("Cookie", cookie)
      .expect(400);
  });

  it("rejects a mutating request with no Origin header (OriginCheckGuard)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .post("/case-study-studio/case-studies")
      .set("Cookie", cookie)
      .send({ publicId: uniquePublicId("CS"), clientName: "X", projectTitle: "Y" })
      .expect(403);
  });

  // --- status transitions / RBAC matrix (D7) ---

  it("marketing_editor (VCESR) can submit and review, but is denied approve", async () => {
    const cookie = await cookieForNewSession(marketingEditorUserId);
    const created = await createCaseStudy(cookie, { clientName: "Marketing Editor Fixture" });

    await moveStatus(cookie, created.id, { status: "upload" }, 200);
    await moveStatus(cookie, created.id, { status: "completeness_review" }, 200);
    await moveStatus(cookie, created.id, { status: "ready_for_claude" }, 200);
    await moveStatus(cookie, created.id, { status: "draft" }, 200);
    await moveStatus(cookie, created.id, { status: "search_review" }, 200);
    await moveStatus(cookie, created.id, { status: "fact_confidentiality_review" }, 200);
    // fact_confidentiality_review -> internal_approval requires "review" — marketing_editor holds it.
    await moveStatus(cookie, created.id, { status: "internal_approval" }, 200);
    // internal_approval -> scheduled requires "approve" — marketing_editor does not hold it.
    await moveStatus(cookie, created.id, { status: "scheduled" }, 403);
  });

  it("owner_growth_approver (VCERAPX, no S) is denied intake->upload, but can review and approve the approval stages", async () => {
    const adminCookie = await cookieForNewSession(superAdminUserId);
    const created = await createCaseStudy(adminCookie, { clientName: "Owner Approver Fixture" });

    const approverCookie = await cookieForNewSession(ownerGrowthApproverUserId);
    await moveStatus(approverCookie, created.id, { status: "upload" }, 403);

    const editorCookie = await cookieForNewSession(marketingEditorUserId);
    await moveStatus(editorCookie, created.id, { status: "upload" }, 200);
    await moveStatus(editorCookie, created.id, { status: "completeness_review" }, 200);
    await moveStatus(approverCookie, created.id, { status: "ready_for_claude" }, 200);
    await moveStatus(editorCookie, created.id, { status: "draft" }, 200);
    await moveStatus(editorCookie, created.id, { status: "search_review" }, 200);
    await moveStatus(approverCookie, created.id, { status: "fact_confidentiality_review" }, 200);
    await moveStatus(approverCookie, created.id, { status: "internal_approval" }, 200);

    const scheduledResponse = await moveStatus(
      approverCookie,
      created.id,
      { status: "scheduled" },
      200,
    );
    expect(scheduledResponse.body.data.status).toBe("scheduled");
  });

  it("qa_security_reviewer (VR only) can view and review, but is denied create and approve", async () => {
    const adminCookie = await cookieForNewSession(superAdminUserId);
    const created = await createCaseStudy(adminCookie, { clientName: "QA Reviewer Fixture" });

    const qaCookie = await cookieForNewSession(qaSecurityReviewerUserId);
    await request(app.getHttpServer())
      .post("/case-study-studio/case-studies")
      .set("Cookie", qaCookie)
      .set("Origin", ORIGIN)
      .send({ publicId: uniquePublicId("CS"), clientName: "Denied", projectTitle: "X" })
      .expect(403);

    const editorCookie = await cookieForNewSession(marketingEditorUserId);
    await moveStatus(editorCookie, created.id, { status: "upload" }, 200);
    // upload -> completeness_review requires "submit" — QA doesn't hold it.
    await moveStatus(qaCookie, created.id, { status: "completeness_review" }, 403);
  });

  it("blocks internal_approval -> client_approval when clientApprovalRequired is false", async () => {
    const editorCookie = await cookieForNewSession(marketingEditorUserId);
    const approverCookie = await cookieForNewSession(superAdminUserId);
    const created = await createCaseStudy(editorCookie, { clientApprovalRequired: false });
    await advanceToInternalApproval(editorCookie, created.id);

    await moveStatus(approverCookie, created.id, { status: "client_approval" }, 400);
    const scheduled = await moveStatus(approverCookie, created.id, { status: "scheduled" }, 200);
    expect(scheduled.body.data.status).toBe("scheduled");
  });

  it("requires internal_approval -> client_approval when clientApprovalRequired is true, then client_approval -> scheduled, recording two approvals", async () => {
    const editorCookie = await cookieForNewSession(marketingEditorUserId);
    const approverCookie = await cookieForNewSession(superAdminUserId);
    const created = await createCaseStudy(editorCookie, { clientApprovalRequired: true });
    await advanceToInternalApproval(editorCookie, created.id);

    // Blocked: cannot skip straight to scheduled when client approval is required.
    await moveStatus(approverCookie, created.id, { status: "scheduled" }, 400);

    await moveStatus(
      approverCookie,
      created.id,
      { status: "client_approval", notes: "<p>Looks good internally</p>" },
      200,
    );
    const scheduled = await moveStatus(approverCookie, created.id, { status: "scheduled" }, 200);
    expect(scheduled.body.data.status).toBe("scheduled");

    const approvalsResponse = await request(app.getHttpServer())
      .get(`/case-study-studio/case-studies/${created.id}/approvals`)
      .set("Cookie", approverCookie)
      .expect(200);
    const approvals = approvalsResponse.body.data as Array<{
      approvalType: string;
      decision: string;
      notes: string | null;
    }>;
    expect(approvals.length).toBe(2);
    expect(approvals.some((a) => a.approvalType === "internal" && a.decision === "approved")).toBe(
      true,
    );
    expect(approvals.some((a) => a.approvalType === "client" && a.decision === "approved")).toBe(
      true,
    );
    // notes was sanitized before being recorded on the approvals row.
    expect(approvals.find((a) => a.approvalType === "internal")?.notes).toBe(
      "<p>Looks good internally</p>",
    );
  });

  it("requires a non-empty unpublishReason on published -> unpublished (D5)", async () => {
    const editorCookie = await cookieForNewSession(marketingEditorUserId);
    const approverCookie = await cookieForNewSession(superAdminUserId);
    const created = await createCaseStudy(editorCookie, { clientApprovalRequired: false });
    await advanceToInternalApproval(editorCookie, created.id);
    await moveStatus(approverCookie, created.id, { status: "scheduled" }, 200);
    await moveStatus(approverCookie, created.id, { status: "published" }, 200);

    await moveStatus(approverCookie, created.id, { status: "unpublished" }, 400);
    const unpublished = await moveStatus(
      approverCookie,
      created.id,
      { status: "unpublished", unpublishReason: "Client requested a pause" },
      200,
    );
    expect(unpublished.body.data.unpublishReason).toBe("Client requested a pause");

    const rePublished = await moveStatus(approverCookie, created.id, { status: "published" }, 200);
    expect(rePublished.body.data.status).toBe("published");
  });

  it("rejects an invalid status transition (archived -> upload, archived is terminal) with 400", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createCaseStudy(cookie, { clientName: "Terminal State Fixture" });

    await moveStatus(cookie, created.id, { status: "archived" }, 200);
    await moveStatus(cookie, created.id, { status: "upload" }, 400);
  });

  it("no-ops idempotently when re-requesting the case study's current status (not a conflict)", async () => {
    const editorCookie = await cookieForNewSession(marketingEditorUserId);
    const created = await createCaseStudy(editorCookie);
    await moveStatus(editorCookie, created.id, { status: "upload" }, 200);
    await moveStatus(editorCookie, created.id, { status: "completeness_review" }, 200);
    // Retrying the already-applied transition again is a genuine no-op success (idempotent), not
    // a conflict — the CAS conflict path itself is covered at the unit level
    // (case-studies.service.spec.ts), since reliably racing two real concurrent HTTP requests to
    // land on the same microsecond window isn't practical in an e2e harness.
    const noop = await moveStatus(editorCookie, created.id, { status: "completeness_review" }, 200);
    expect(noop.body.data.status).toBe("completeness_review");
  });

  // --- case_study_assets (child sub-resource, D3) ---

  it("creates, lists, updates, and deletes a case study asset link, scoped to its parent case study", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createCaseStudy(cookie, { clientName: "Asset Parent Fixture" });
    const asset = await assets.create({
      publicId: uniquePublicId("ASSET"),
      title: "Hero screenshot",
    });

    const createResponse = await request(app.getHttpServer())
      .post(`/case-study-studio/case-studies/${created.id}/assets`)
      .set("Cookie", cookie)
      .set("Origin", ORIGIN)
      .send({ assetId: asset.id, role: "hero_screenshot", caption: "Homepage hero" })
      .expect(201);
    const linkId = createResponse.body.data.id as string;

    const listResponse = await request(app.getHttpServer())
      .get(`/case-study-studio/case-studies/${created.id}/assets`)
      .set("Cookie", cookie)
      .expect(200);
    expect((listResponse.body.data as Array<{ id: string }>).some((a) => a.id === linkId)).toBe(
      true,
    );

    const updateResponse = await request(app.getHttpServer())
      .post(`/case-study-studio/case-studies/${created.id}/assets/${linkId}/update`)
      .set("Cookie", cookie)
      .set("Origin", ORIGIN)
      .send({ caption: "Revised caption" })
      .expect(200);
    expect(updateResponse.body.data.caption).toBe("Revised caption");

    await request(app.getHttpServer())
      .post(`/case-study-studio/case-studies/${created.id}/assets/${linkId}/delete`)
      .set("Cookie", cookie)
      .set("Origin", ORIGIN)
      .expect(204);

    const listAfterDelete = await request(app.getHttpServer())
      .get(`/case-study-studio/case-studies/${created.id}/assets`)
      .set("Cookie", cookie)
      .expect(200);
    expect((listAfterDelete.body.data as Array<{ id: string }>).some((a) => a.id === linkId)).toBe(
      false,
    );
  });

  it("returns 404 (IDOR prevention) when accessing an asset link through the wrong parent case study's route", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const csA = await createCaseStudy(cookie, { clientName: "Case Study A" });
    const csB = await createCaseStudy(cookie, { clientName: "Case Study B" });
    const asset = await assets.create({ publicId: uniquePublicId("ASSET"), title: "Asset" });

    const createResponse = await request(app.getHttpServer())
      .post(`/case-study-studio/case-studies/${csA.id}/assets`)
      .set("Cookie", cookie)
      .set("Origin", ORIGIN)
      .send({ assetId: asset.id, role: "logo" })
      .expect(201);
    const linkId = createResponse.body.data.id as string;

    await request(app.getHttpServer())
      .post(`/case-study-studio/case-studies/${csB.id}/assets/${linkId}/update`)
      .set("Cookie", cookie)
      .set("Origin", ORIGIN)
      .send({ caption: "Attempted cross-case-study edit" })
      .expect(404);

    await request(app.getHttpServer())
      .post(`/case-study-studio/case-studies/${csB.id}/assets/${linkId}/delete`)
      .set("Cookie", cookie)
      .set("Origin", ORIGIN)
      .expect(404);
  });

  it("returns 404 when creating an asset link under a well-formed but nonexistent case study id", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const asset = await assets.create({ publicId: uniquePublicId("ASSET"), title: "Orphan Asset" });

    await request(app.getHttpServer())
      .post(`/case-study-studio/case-studies/${randomUUID()}/assets`)
      .set("Cookie", cookie)
      .set("Origin", ORIGIN)
      .send({ assetId: asset.id, role: "logo" })
      .expect(404);
  });

  it("rejects an assetId that doesn't resolve to a real asset with 400 (D3, no DB-level FK)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createCaseStudy(cookie, { clientName: "Bad Asset Fixture" });

    await request(app.getHttpServer())
      .post(`/case-study-studio/case-studies/${created.id}/assets`)
      .set("Cookie", cookie)
      .set("Origin", ORIGIN)
      .send({ assetId: randomUUID(), role: "logo" })
      .expect(400);
  });

  it("denies asset-link creation with 403 for a read_only session (only V grant, not E)", async () => {
    const adminCookie = await cookieForNewSession(superAdminUserId);
    const created = await createCaseStudy(adminCookie, { clientName: "Read Only Asset Fixture" });
    const asset = await assets.create({ publicId: uniquePublicId("ASSET"), title: "X" });

    const readOnlyCookie = await cookieForNewSession(readOnlyUserId);
    await request(app.getHttpServer())
      .post(`/case-study-studio/case-studies/${created.id}/assets`)
      .set("Cookie", readOnlyCookie)
      .set("Origin", ORIGIN)
      .send({ assetId: asset.id, role: "logo" })
      .expect(403);
  });

  // --- case_study_consents (child sub-resource) ---

  it("creates, lists, updates, and deletes a case study consent record, scoped to its parent case study, and rejects an unsafe evidence-reference URL", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createCaseStudy(cookie, { clientName: "Consent Parent Fixture" });

    await request(app.getHttpServer())
      .post(`/case-study-studio/case-studies/${created.id}/consents`)
      .set("Cookie", cookie)
      .set("Origin", ORIGIN)
      .send({ consentType: "client_publication", consentEvidenceReference: "javascript:alert(1)" })
      .expect(400);

    const createResponse = await request(app.getHttpServer())
      .post(`/case-study-studio/case-studies/${created.id}/consents`)
      .set("Cookie", cookie)
      .set("Origin", ORIGIN)
      .send({
        consentType: "client_publication",
        consentEvidenceReference: "https://example.com/signed.pdf",
        grantedBy: "Jane Client",
      })
      .expect(201);
    const consentId = createResponse.body.data.id as string;

    const listResponse = await request(app.getHttpServer())
      .get(`/case-study-studio/case-studies/${created.id}/consents`)
      .set("Cookie", cookie)
      .expect(200);
    expect((listResponse.body.data as Array<{ id: string }>).some((c) => c.id === consentId)).toBe(
      true,
    );

    const updateResponse = await request(app.getHttpServer())
      .post(`/case-study-studio/case-studies/${created.id}/consents/${consentId}/update`)
      .set("Cookie", cookie)
      .set("Origin", ORIGIN)
      .send({ notes: "Confirmed via email" })
      .expect(200);
    expect(updateResponse.body.data.notes).toBe("Confirmed via email");

    await request(app.getHttpServer())
      .post(`/case-study-studio/case-studies/${created.id}/consents/${consentId}/delete`)
      .set("Cookie", cookie)
      .set("Origin", ORIGIN)
      .expect(204);

    const listAfterDelete = await request(app.getHttpServer())
      .get(`/case-study-studio/case-studies/${created.id}/consents`)
      .set("Cookie", cookie)
      .expect(200);
    expect(
      (listAfterDelete.body.data as Array<{ id: string }>).some((c) => c.id === consentId),
    ).toBe(false);
  });

  it("returns 404 (IDOR prevention) when accessing a consent record through the wrong parent case study's route", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const csA = await createCaseStudy(cookie, { clientName: "Consent Case Study A" });
    const csB = await createCaseStudy(cookie, { clientName: "Consent Case Study B" });

    const createResponse = await request(app.getHttpServer())
      .post(`/case-study-studio/case-studies/${csA.id}/consents`)
      .set("Cookie", cookie)
      .set("Origin", ORIGIN)
      .send({ consentType: "testimonial" })
      .expect(201);
    const consentId = createResponse.body.data.id as string;

    await request(app.getHttpServer())
      .post(`/case-study-studio/case-studies/${csB.id}/consents/${consentId}/update`)
      .set("Cookie", cookie)
      .set("Origin", ORIGIN)
      .send({ notes: "Attempted cross-case-study edit" })
      .expect(404);

    await request(app.getHttpServer())
      .post(`/case-study-studio/case-studies/${csB.id}/consents/${consentId}/delete`)
      .set("Cookie", cookie)
      .set("Origin", ORIGIN)
      .expect(404);
  });

  it("returns 404 when creating a consent record under a well-formed but nonexistent case study id", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);

    await request(app.getHttpServer())
      .post(`/case-study-studio/case-studies/${randomUUID()}/consents`)
      .set("Cookie", cookie)
      .set("Origin", ORIGIN)
      .send({ consentType: "other" })
      .expect(404);
  });

  it("denies consent-record creation with 403 for a read_only session (only V grant, not E)", async () => {
    const adminCookie = await cookieForNewSession(superAdminUserId);
    const created = await createCaseStudy(adminCookie, { clientName: "Read Only Consent Fixture" });

    const readOnlyCookie = await cookieForNewSession(readOnlyUserId);
    await request(app.getHttpServer())
      .post(`/case-study-studio/case-studies/${created.id}/consents`)
      .set("Cookie", readOnlyCookie)
      .set("Origin", ORIGIN)
      .send({ consentType: "other" })
      .expect(403);
  });
});
