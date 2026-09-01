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
import { WorkflowAndTaskTemplateLibraryModule } from "../src/workflow-and-task-template-library/workflow-and-task-template-library.module.js";

/**
 * Request-level coverage for the Workflow and Task Template Library module HTTP surface, against
 * a REAL disposable PostgreSQL database — same harness pattern as `brand-library.e2e-spec.ts`.
 * `ready_for_claude` has real seeded grants (`00013-seed-rbac-matrix.ts:199-207`) with a real
 * two-tier role split:
 *   super_admin                  VCERAM  (view/create/edit/review/approve/configure)
 *   owner_growth_approver        VCERAM  (same as super_admin)
 *   marketing_editor             VCSE    (view/create/submit/edit — not review, not approve)
 *   designer_creative_reviewer   VCSE    (same as marketing_editor)
 *   developer                    VCSE    (same as marketing_editor)
 *   qa_security_reviewer         VCSE    (same as marketing_editor)
 *   read_only                    V       (view only)
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

describe("Workflow and Task Template Library module endpoints (e2e, real disposable database)", () => {
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
      .post("/workflow-and-task-template-library/templates")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        publicId: uniquePublicId("WTT"),
        templateType: "content",
        title: "E2E Fixture Template",
        authorizedStage: "content_production",
        ...overrides,
      })
      .expect(201);
    return response.body.data as { id: string; approvalStatus: string; version: number };
  }

  /** Drives a fixture template from `draft` all the way to `approved`, using a session that holds
   *  submit AND review AND approve (only super_admin/owner_growth_approver hold review/approve
   *  for this module — unlike Brand Library's designer_creative_reviewer, no mid-tier role here
   *  can drive the full lifecycle alone). */
  async function approveTemplate(id: string, submitterCookie: string, approverCookie: string) {
    await request(app.getHttpServer())
      .post(`/workflow-and-task-template-library/templates/${id}/status`)
      .set("Cookie", submitterCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/workflow-and-task-template-library/templates/${id}/status`)
      .set("Cookie", approverCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "under_review" })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/workflow-and-task-template-library/templates/${id}/status`)
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
      imports: [WorkflowAndTaskTemplateLibraryModule],
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

    superAdminUserId = await createUserWithRole("wtt.super-admin", "super_admin");
    readOnlyUserId = await createUserWithRole("wtt.read-only", "read_only");
    marketingEditorUserId = await createUserWithRole("wtt.marketing-editor", "marketing_editor");
    ownerGrowthApproverUserId = await createUserWithRole(
      "wtt.owner-growth-approver",
      "owner_growth_approver",
    );
  }, 30_000);

  afterAll(async () => {
    await app.close();
    const migrator = buildMigrator();
    await migrator.down({ to: 0 });
    await closeConnection();
  }, 30_000);

  it("rejects GET /workflow-and-task-template-library/templates with 401 when there is no session cookie", async () => {
    await request(app.getHttpServer())
      .get("/workflow-and-task-template-library/templates")
      .expect(401);
  });

  it("allows a real super_admin session to create, read, list, and edit a workflow task template", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftTemplate(cookie, { title: "Existing Page Audit Template" });
    expect(created.approvalStatus).toBe("draft");
    expect(created.version).toBe(1);

    const getResponse = await request(app.getHttpServer())
      .get(`/workflow-and-task-template-library/templates/${created.id}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(getResponse.body.data.title).toBe("Existing Page Audit Template");

    const listResponse = await request(app.getHttpServer())
      .get("/workflow-and-task-template-library/templates")
      .set("Cookie", cookie)
      .expect(200);
    expect((listResponse.body.data as Array<{ id: string }>).some((r) => r.id === created.id)).toBe(
      true,
    );

    const updateResponse = await request(app.getHttpServer())
      .post(`/workflow-and-task-template-library/templates/${created.id}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ title: "Existing Page Audit Template (revised)" })
      .expect(200);
    expect(updateResponse.body.data.title).toBe("Existing Page Audit Template (revised)");
    expect(updateResponse.body.data.approvalStatus).toBe("draft"); // update never touches status
    expect(updateResponse.body.data.version).toBe(2); // update increments version server-side
  });

  it("denies workflow task template creation with 403 for a read_only session (only V grant, not C)", async () => {
    const cookie = await cookieForNewSession(readOnlyUserId);
    await request(app.getHttpServer())
      .post("/workflow-and-task-template-library/templates")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        publicId: uniquePublicId("WTT"),
        templateType: "content",
        title: "Denied",
        authorizedStage: "content_production",
      })
      .expect(403);
  });

  it("allows a read_only session to list workflow task templates (V grant)", async () => {
    const cookie = await cookieForNewSession(readOnlyUserId);
    await request(app.getHttpServer())
      .get("/workflow-and-task-template-library/templates")
      .set("Cookie", cookie)
      .expect(200);
  });

  it("rejects workflow task template creation with 400 when publicId is already in use", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const publicId = uniquePublicId("WTT");
    await request(app.getHttpServer())
      .post("/workflow-and-task-template-library/templates")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        publicId,
        templateType: "content",
        title: "First",
        authorizedStage: "content_production",
      })
      .expect(201);
    await request(app.getHttpServer())
      .post("/workflow-and-task-template-library/templates")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        publicId,
        templateType: "content",
        title: "Second",
        authorizedStage: "content_production",
      })
      .expect(400);
  });

  it("creates a workflow task template with all optional fields and round-trips them on GET", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftTemplate(cookie, {
      title: "Security Review Template",
      templateType: "security",
      authorizedStage: "pre_release_review",
      requiredInputs: "Threat model, dependency audit",
      expectedOutputs: "Signed-off security review report",
      restrictions: "Cannot authorize execution by itself",
      agentAssignment: "qa_security_reviewer",
      validationCriteria: "No Critical/High findings open",
      requiredApprovals: "QA and security sign-off required",
    });

    const getResponse = await request(app.getHttpServer())
      .get(`/workflow-and-task-template-library/templates/${created.id}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(getResponse.body.data.requiredInputs).toBe("Threat model, dependency audit");
    expect(getResponse.body.data.expectedOutputs).toBe("Signed-off security review report");
    expect(getResponse.body.data.restrictions).toBe("Cannot authorize execution by itself");
    expect(getResponse.body.data.agentAssignment).toBe("qa_security_reviewer");
    expect(getResponse.body.data.validationCriteria).toBe("No Critical/High findings open");
    expect(getResponse.body.data.requiredApprovals).toBe("QA and security sign-off required");
  });

  it("rejects an empty update patch with 400 (no-op saves shouldn't burn a version)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftTemplate(cookie);
    await request(app.getHttpServer())
      .post(`/workflow-and-task-template-library/templates/${created.id}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({})
      .expect(400);
  });

  it("clears a text field with an explicit null, distinct from omitting it", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftTemplate(cookie, {
      requiredInputs: "Some inputs",
      expectedOutputs: "Some outputs",
    });

    const updateResponse = await request(app.getHttpServer())
      .post(`/workflow-and-task-template-library/templates/${created.id}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ requiredInputs: null })
      .expect(200);

    expect(updateResponse.body.data.requiredInputs).toBeNull();
    expect(updateResponse.body.data.expectedOutputs).toBe("Some outputs");
  });

  it("marketing_editor (VCSE) can create and submit, but is denied review and approve", async () => {
    const cookie = await cookieForNewSession(marketingEditorUserId);
    const created = await createDraftTemplate(cookie, { title: "Marketing Editor Fixture" });

    await request(app.getHttpServer())
      .post(`/workflow-and-task-template-library/templates/${created.id}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/workflow-and-task-template-library/templates/${created.id}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "under_review" })
      .expect(403);
  });

  it("owner_growth_approver (VCERAM, no S) is denied submit, but can review/approve once a submitter (VCSE) submits", async () => {
    const approverCookie = await cookieForNewSession(ownerGrowthApproverUserId);
    const submitterCookie = await cookieForNewSession(marketingEditorUserId);
    const created = await createDraftTemplate(submitterCookie, {
      title: "Owner Approver Lifecycle",
    });

    // super_admin/owner_growth_approver hold VCERAM — no `S` (submit) — a real separation-of-
    // duties split from Brand Library's own designer_creative_reviewer, which holds VCERAS
    // (submit AND review AND approve on one role).
    await request(app.getHttpServer())
      .post(`/workflow-and-task-template-library/templates/${created.id}/status`)
      .set("Cookie", approverCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/workflow-and-task-template-library/templates/${created.id}/status`)
      .set("Cookie", submitterCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/workflow-and-task-template-library/templates/${created.id}/status`)
      .set("Cookie", approverCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "under_review" })
      .expect(200);

    const approveResponse = await request(app.getHttpServer())
      .post(`/workflow-and-task-template-library/templates/${created.id}/status`)
      .set("Cookie", approverCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "approved" })
      .expect(200);
    expect(approveResponse.body.data.approvalStatus).toBe("approved");
  });

  it("full submit/review/approve path: marketing_editor submits, owner_growth_approver reviews and approves", async () => {
    const marketingCookie = await cookieForNewSession(marketingEditorUserId);
    const approverCookie = await cookieForNewSession(ownerGrowthApproverUserId);
    const created = await createDraftTemplate(marketingCookie, {
      title: "Cross-Role Lifecycle Fixture",
    });

    await approveTemplate(created.id, marketingCookie, approverCookie);

    const getResponse = await request(app.getHttpServer())
      .get(`/workflow-and-task-template-library/templates/${created.id}`)
      .set("Cookie", approverCookie)
      .expect(200);
    expect(getResponse.body.data.approvalStatus).toBe("approved");
  });

  it("rejects an invalid approval-status transition (archived -> submitted, archived is terminal) with 400", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftTemplate(cookie, { title: "Terminal State Fixture" });

    await request(app.getHttpServer())
      .post(`/workflow-and-task-template-library/templates/${created.id}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "archived" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/workflow-and-task-template-library/templates/${created.id}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(400);
  });

  it("rejects editing a terminal (archived) workflow task template with 400", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftTemplate(cookie, { title: "Terminal Edit Fixture" });
    await request(app.getHttpServer())
      .post(`/workflow-and-task-template-library/templates/${created.id}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "archived" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/workflow-and-task-template-library/templates/${created.id}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ title: "Should not be allowed" })
      .expect(400);
  });

  // A genuine concurrent-request-level race (two real HTTP requests via Promise.all()) is not
  // deterministically reproducible here: WorkflowAndTaskTemplateLibraryService.changeApprovalStatus()
  // treats re-requesting the template's own already-current status as a harmless no-op (mirroring
  // BrandLibraryService's/PersonasService's/ServicesService's identical short-circuit), and it
  // always re-reads the current status fresh before computing the required action/CAS guard — so
  // if the loser's fresh findById() read happens to land after the winner's write has committed
  // (a real possibility against a small local connection pool, i.e. effectively sequential rather
  // than truly concurrent), it legitimately observes the new status and either takes the no-op
  // path or issues a now-valid transition of its own — both correct outcomes, neither a 409. The
  // repository-level atomic compare-and-swap itself (loser sees a real "conflict" outcome, no
  // partial write) is proven deterministically instead, in
  // packages/database/test/module-workflow-and-task-template-library.integration.test.ts's own
  // "reports conflict"/"only one wins" tests and in workflow-and-task-template-library.service.spec.ts's
  // own mocked-repository equivalent — matching the precedent that Persona Library's/Service
  // Library's own e2e suites don't attempt this race either.

  it("returns 404 for a GET on a nonexistent workflow task template id", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .get(`/workflow-and-task-template-library/templates/${randomUUID()}`)
      .set("Cookie", cookie)
      .expect(404);
  });

  it("returns 400 (not a raw 500) for a malformed workflow task template id", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .get("/workflow-and-task-template-library/templates/not-a-uuid")
      .set("Cookie", cookie)
      .expect(400);
  });

  it("rejects a mutating request with no Origin header (OriginCheckGuard)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .post("/workflow-and-task-template-library/templates")
      .set("Cookie", cookie)
      .send({
        publicId: uniquePublicId("WTT"),
        templateType: "content",
        title: "No origin",
        authorizedStage: "content_production",
      })
      .expect(403);
  });
});
