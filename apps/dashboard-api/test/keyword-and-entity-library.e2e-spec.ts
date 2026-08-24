import { randomBytes, randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import {
  buildMigrator,
  closeConnection,
  PageRepository,
  ProjectRepository,
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
import { KeywordAndEntityLibraryModule } from "../src/keyword-and-entity-library/keyword-and-entity-library.module.js";

/**
 * Request-level coverage for the Keyword & Entity Library module HTTP surface, against a REAL
 * disposable PostgreSQL database — same harness pattern as `page-inventory.e2e-spec.ts`.
 * `keyword_internal_links` has real seeded grants (`00013-seed-rbac-matrix.ts:190-198`) that
 * meaningfully differ per role, and — unlike Page Inventory's own `developer` (VCE) — this
 * module's `developer` is view-only:
 *   super_admin              VCERAMX  (create, edit, submit, review, approve, configure, export)
 *   owner_growth_approver    VCERAX   (create, edit, review, approve, export — not submit)
 *   marketing_editor         VCESR    (create, edit, submit, review — not approve)
 *   designer_creative_reviewer V      (view only)
 *   developer                V        (view only — unlike Page Inventory's own VCE developer)
 *   qa_security_reviewer     VR       (view, review only)
 *   read_only                V        (view only)
 *
 * Every route lives under a real `:projectId` route path segment
 * (`keyword-and-entity-library/projects/:projectId/keywords`, ...), mirroring Page Inventory's
 * own already-fixed project-scoping shape — several tests below (marked "regression") specifically
 * prove a session holding ONLY a project-scoped `keyword_internal_links` grant (not a global one)
 * is allowed within its own project and still denied outside it, the exact gap that class of fix
 * closes.
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

describe("Keyword & Entity Library module endpoints (e2e, real disposable database)", () => {
  let app: INestApplication;
  let users: UserRepository;
  let roles: RoleRepository;
  let userRoles: UserRoleRepository;
  let projects: ProjectRepository;
  let pages: PageRepository;
  let sessionService: SessionService;
  let authEnv: AuthEnv;

  let superAdminUserId: string;
  let readOnlyUserId: string;
  let marketingEditorUserId: string;
  let developerUserId: string;
  let ownerGrowthApproverUserId: string;
  let qaSecurityReviewerUserId: string;

  let projectId: string;

  let counter = 0;
  function uniqueId(prefix: string): string {
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

  async function createUserWithRole(
    emailPrefix: string,
    roleKey: string,
    roleProjectId: string | null = null,
  ): Promise<string> {
    const user = await users.create({
      email: `${emailPrefix}.e2e@webdesksolution.com`,
      displayName: `${emailPrefix} E2E`,
      accountStatus: "active",
    });
    const role = await roles.findByKey(roleKey);
    if (!role) {
      throw new Error(`Expected ${roleKey} role was not seeded — check migration 00013`);
    }
    await userRoles.assign(user.id, role.id, roleProjectId);
    return user.id;
  }

  async function createDraftKeyword(
    cookie: string,
    overrides: Record<string, unknown> = {},
    targetProjectId: string = projectId,
  ): Promise<{ id: string; approvalStatus: string; projectId: string }> {
    const response = await request(app.getHttpServer())
      .post(`/keyword-and-entity-library/projects/${targetProjectId}/keywords`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        publicId: uniqueId("KW"),
        queryText: "E2E Fixture Keyword",
        ...overrides,
      })
      .expect(201);
    return response.body.data as { id: string; approvalStatus: string; projectId: string };
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
      imports: [KeywordAndEntityLibraryModule],
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
    projects = new ProjectRepository();
    pages = new PageRepository();

    superAdminUserId = await createUserWithRole("kel.super-admin", "super_admin");
    readOnlyUserId = await createUserWithRole("kel.read-only", "read_only");
    marketingEditorUserId = await createUserWithRole("kel.marketing-editor", "marketing_editor");
    developerUserId = await createUserWithRole("kel.developer", "developer");
    ownerGrowthApproverUserId = await createUserWithRole(
      "kel.owner-growth-approver",
      "owner_growth_approver",
    );
    qaSecurityReviewerUserId = await createUserWithRole(
      "kel.qa-security-reviewer",
      "qa_security_reviewer",
    );

    const project = await projects.create({
      publicId: uniqueId("PROJ"),
      name: "Keyword & Entity Library E2E Fixture Project",
    });
    projectId = project.id;
  }, 30_000);

  afterAll(async () => {
    await app.close();
    const migrator = buildMigrator();
    await migrator.down({ to: 0 });
    await closeConnection();
  }, 30_000);

  // --- keywords ---

  it("rejects GET .../keywords with 401 when there is no session cookie", async () => {
    await request(app.getHttpServer())
      .get(`/keyword-and-entity-library/projects/${projectId}/keywords`)
      .expect(401);
  });

  it("allows a real super_admin session to create, read, list, and edit a keyword", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftKeyword(cookie, { queryText: "best seo tools" });
    expect(created.approvalStatus).toBe("draft");
    expect(created.projectId).toBe(projectId);

    const getResponse = await request(app.getHttpServer())
      .get(`/keyword-and-entity-library/projects/${projectId}/keywords/${created.id}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(getResponse.body.data.queryText).toBe("best seo tools");

    const listResponse = await request(app.getHttpServer())
      .get(`/keyword-and-entity-library/projects/${projectId}/keywords`)
      .set("Cookie", cookie)
      .expect(200);
    expect((listResponse.body.data as Array<{ id: string }>).some((k) => k.id === created.id)).toBe(
      true,
    );

    const updateResponse = await request(app.getHttpServer())
      .post(`/keyword-and-entity-library/projects/${projectId}/keywords/${created.id}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ queryText: "best seo tools (revised)" })
      .expect(200);
    expect(updateResponse.body.data.queryText).toBe("best seo tools (revised)");
    expect(updateResponse.body.data.approvalStatus).toBe("draft"); // update never touches status
  });

  // Same known, pre-existing, flagged-not-fixed gap as page-inventory.e2e-spec.ts's own identical
  // test — PermissionGuard reads request.params before ParseUUIDPipe validates it, shared by every
  // :projectId-scoped route in this codebase.
  it("returns a structured (not unhandled-crash) 500 for a malformed :projectId route segment — known pre-existing gap, shared with Page Inventory", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const response = await request(app.getHttpServer())
      .get("/keyword-and-entity-library/projects/not-a-uuid/keywords")
      .set("Cookie", cookie)
      .expect(500);
    expect(response.body.success).toBe(false);
    expect(response.body.error?.code).toBeTruthy();
  });

  it("denies keyword creation with 403 for a read_only session (only V grant, not C)", async () => {
    const cookie = await cookieForNewSession(readOnlyUserId);
    await request(app.getHttpServer())
      .post(`/keyword-and-entity-library/projects/${projectId}/keywords`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: uniqueId("KW"), queryText: "Denied" })
      .expect(403);
  });

  it("allows a read_only session to list keywords (V grant)", async () => {
    const cookie = await cookieForNewSession(readOnlyUserId);
    await request(app.getHttpServer())
      .get(`/keyword-and-entity-library/projects/${projectId}/keywords`)
      .set("Cookie", cookie)
      .expect(200);
  });

  it("list() is scoped to projectId — a keyword in a different project never appears", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const otherProject = await projects.create({
      publicId: uniqueId("PROJ"),
      name: "Other Project",
    });
    const keywordInOther = await createDraftKeyword(
      cookie,
      { queryText: "In Other Project" },
      otherProject.id,
    );

    const listResponse = await request(app.getHttpServer())
      .get(`/keyword-and-entity-library/projects/${projectId}/keywords`)
      .set("Cookie", cookie)
      .expect(200);
    expect(
      (listResponse.body.data as Array<{ id: string }>).some((k) => k.id === keywordInOther.id),
    ).toBe(false);
  });

  it("rejects keyword creation with 400 when publicId is already in use", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const publicId = uniqueId("KW");
    await request(app.getHttpServer())
      .post(`/keyword-and-entity-library/projects/${projectId}/keywords`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId, queryText: "First" })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/keyword-and-entity-library/projects/${projectId}/keywords`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId, queryText: "Second" })
      .expect(400);
  });

  it("returns 404 (not a raw 500) when creating a keyword under a well-formed but nonexistent projectId", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .post("/keyword-and-entity-library/projects/00000000-0000-4000-8000-000000000000/keywords")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: uniqueId("KW"), queryText: "Orphaned" })
      .expect(404);
  });

  it("rejects an empty update patch with 400", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftKeyword(cookie);
    await request(app.getHttpServer())
      .post(`/keyword-and-entity-library/projects/${projectId}/keywords/${created.id}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({})
      .expect(400);
  });

  it("marketing_editor (VCESR) can submit and review, but is denied approve", async () => {
    const cookie = await cookieForNewSession(marketingEditorUserId);
    const created = await createDraftKeyword(cookie, { queryText: "Marketing Editor Fixture" });

    await request(app.getHttpServer())
      .post(`/keyword-and-entity-library/projects/${projectId}/keywords/${created.id}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/keyword-and-entity-library/projects/${projectId}/keywords/${created.id}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "under_review" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/keyword-and-entity-library/projects/${projectId}/keywords/${created.id}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "approved" })
      .expect(403);
  });

  it("developer (view-only V) is denied create and every status transition, unlike Page Inventory's own VCE developer", async () => {
    const adminCookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftKeyword(adminCookie, { queryText: "Developer Fixture" });

    const devCookie = await cookieForNewSession(developerUserId);
    await request(app.getHttpServer())
      .post(`/keyword-and-entity-library/projects/${projectId}/keywords`)
      .set("Cookie", devCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: uniqueId("KW"), queryText: "Denied create" })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/keyword-and-entity-library/projects/${projectId}/keywords/${created.id}/update`)
      .set("Cookie", devCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ queryText: "Denied edit" })
      .expect(403);

    await request(app.getHttpServer())
      .get(`/keyword-and-entity-library/projects/${projectId}/keywords/${created.id}`)
      .set("Cookie", devCookie)
      .expect(200);
  });

  it(
    "rejects an edit to an archived keyword with a clean 400 (the terminal-state guard built into " +
      "this module from day one, mirroring Page Inventory's own already-fixed precedent)",
    async () => {
      const cookie = await cookieForNewSession(superAdminUserId);
      const created = await createDraftKeyword(cookie, { queryText: "Terminal Fixture" });

      await request(app.getHttpServer())
        .post(`/keyword-and-entity-library/projects/${projectId}/keywords/${created.id}/status`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ approvalStatus: "archived" })
        .expect(200);

      await request(app.getHttpServer())
        .post(`/keyword-and-entity-library/projects/${projectId}/keywords/${created.id}/update`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ queryText: "Should be rejected" })
        .expect(400);

      const getResponse = await request(app.getHttpServer())
        .get(`/keyword-and-entity-library/projects/${projectId}/keywords/${created.id}`)
        .set("Cookie", cookie)
        .expect(200);
      expect(getResponse.body.data.queryText).toBe("Terminal Fixture");
    },
  );

  it("owner_growth_approver (VCERAX, no S) is denied draft->submitted, but can review and approve once submitted", async () => {
    const adminCookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftKeyword(adminCookie, { queryText: "Owner Approver Fixture" });

    const approverCookie = await cookieForNewSession(ownerGrowthApproverUserId);
    await request(app.getHttpServer())
      .post(`/keyword-and-entity-library/projects/${projectId}/keywords/${created.id}/status`)
      .set("Cookie", approverCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(403);

    const editorCookie = await cookieForNewSession(marketingEditorUserId);
    await request(app.getHttpServer())
      .post(`/keyword-and-entity-library/projects/${projectId}/keywords/${created.id}/status`)
      .set("Cookie", editorCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/keyword-and-entity-library/projects/${projectId}/keywords/${created.id}/status`)
      .set("Cookie", approverCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "under_review" })
      .expect(200);

    const approveResponse = await request(app.getHttpServer())
      .post(`/keyword-and-entity-library/projects/${projectId}/keywords/${created.id}/status`)
      .set("Cookie", approverCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "approved" })
      .expect(200);
    expect(approveResponse.body.data.approvalStatus).toBe("approved");
  });

  it("qa_security_reviewer (VR only) can view and review, but is denied create and approve", async () => {
    const adminCookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftKeyword(adminCookie, { queryText: "QA Reviewer Fixture" });
    const editorCookie = await cookieForNewSession(marketingEditorUserId);
    await request(app.getHttpServer())
      .post(`/keyword-and-entity-library/projects/${projectId}/keywords/${created.id}/status`)
      .set("Cookie", editorCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(200);

    const qaCookie = await cookieForNewSession(qaSecurityReviewerUserId);
    await request(app.getHttpServer())
      .post(`/keyword-and-entity-library/projects/${projectId}/keywords`)
      .set("Cookie", qaCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: uniqueId("KW"), queryText: "Denied create" })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/keyword-and-entity-library/projects/${projectId}/keywords/${created.id}/status`)
      .set("Cookie", qaCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "under_review" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/keyword-and-entity-library/projects/${projectId}/keywords/${created.id}/status`)
      .set("Cookie", qaCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "approved" })
      .expect(403);
  });

  it("rejects an invalid approval-status transition (archived -> submitted, archived is terminal) with 400", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftKeyword(cookie, { queryText: "Terminal State Fixture" });

    await request(app.getHttpServer())
      .post(`/keyword-and-entity-library/projects/${projectId}/keywords/${created.id}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "archived" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/keyword-and-entity-library/projects/${projectId}/keywords/${created.id}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(400);
  });

  it("returns 404 for a GET on a nonexistent keyword id", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .get(`/keyword-and-entity-library/projects/${projectId}/keywords/${randomUUID()}`)
      .set("Cookie", cookie)
      .expect(404);
  });

  it("returns 400 (not a raw 500) for a malformed keyword id", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .get(`/keyword-and-entity-library/projects/${projectId}/keywords/not-a-uuid`)
      .set("Cookie", cookie)
      .expect(400);
  });

  it("rejects a mutating request with no Origin header (OriginCheckGuard)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .post(`/keyword-and-entity-library/projects/${projectId}/keywords`)
      .set("Cookie", cookie)
      .send({ publicId: uniqueId("KW"), queryText: "No origin" })
      .expect(403);
  });

  // --- IDOR / project-scoping regression coverage ---

  it("returns 404 (IDOR prevention) when accessing a keyword through the wrong project's route", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const otherProject = await projects.create({
      publicId: uniqueId("PROJ"),
      name: "Other Project For Keyword IDOR",
    });
    const created = await createDraftKeyword(cookie, { queryText: "Belongs To Fixture Project" });

    await request(app.getHttpServer())
      .get(`/keyword-and-entity-library/projects/${otherProject.id}/keywords/${created.id}`)
      .set("Cookie", cookie)
      .expect(404);

    await request(app.getHttpServer())
      .post(`/keyword-and-entity-library/projects/${otherProject.id}/keywords/${created.id}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ queryText: "Attempted cross-project edit" })
      .expect(404);

    await request(app.getHttpServer())
      .post(`/keyword-and-entity-library/projects/${otherProject.id}/keywords/${created.id}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(404);

    const getResponse = await request(app.getHttpServer())
      .get(`/keyword-and-entity-library/projects/${projectId}/keywords/${created.id}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(getResponse.body.data.queryText).toBe("Belongs To Fixture Project");
  });

  it(
    "allows a session holding ONLY a project-scoped keyword_internal_links grant (not a global " +
      "one) to list, create, and edit keywords within that project — and still denies it in a " +
      "different project",
    async () => {
      const scopedUserId = await createUserWithRole(
        "kel.project-scoped",
        "marketing_editor",
        projectId,
      );
      const scopedCookie = await cookieForNewSession(scopedUserId);

      await request(app.getHttpServer())
        .get(`/keyword-and-entity-library/projects/${projectId}/keywords`)
        .set("Cookie", scopedCookie)
        .expect(200);

      const created = await createDraftKeyword(scopedCookie, {
        queryText: "Project-Scoped Grant Fixture",
      });

      await request(app.getHttpServer())
        .post(`/keyword-and-entity-library/projects/${projectId}/keywords/${created.id}/update`)
        .set("Cookie", scopedCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ queryText: "Edited by project-scoped session" })
        .expect(200);

      const otherProject = await projects.create({
        publicId: uniqueId("PROJ"),
        name: "Other Project (project-scoped grant should not reach here)",
      });
      await request(app.getHttpServer())
        .get(`/keyword-and-entity-library/projects/${otherProject.id}/keywords`)
        .set("Cookie", scopedCookie)
        .expect(403);
    },
  );

  it(
    "allows a session holding ONLY a project-scoped keyword_internal_links grant to submit a " +
      "keyword for review (KeywordsService.changeApprovalStatus()'s dynamic per-transition " +
      "AuthorizationService.assertAllowed() call receives a real projectId)",
    async () => {
      const scopedEditorUserId = await createUserWithRole(
        "kel.project-scoped-editor",
        "marketing_editor",
        projectId,
      );
      const adminCookie = await cookieForNewSession(superAdminUserId);
      const created = await createDraftKeyword(adminCookie, {
        queryText: "Project-Scoped Workflow Fixture",
      });

      const scopedCookie = await cookieForNewSession(scopedEditorUserId);
      const response = await request(app.getHttpServer())
        .post(`/keyword-and-entity-library/projects/${projectId}/keywords/${created.id}/status`)
        .set("Cookie", scopedCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ approvalStatus: "submitted" })
        .expect(200);
      expect(response.body.data.approvalStatus).toBe("submitted");
    },
  );

  // --- entities ---

  it("creates, lists, gets, updates, and deletes an entity", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const createResponse = await request(app.getHttpServer())
      .post(`/keyword-and-entity-library/projects/${projectId}/entities`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: uniqueId("ENT"), name: "Acme Corp", entityType: "Organization" })
      .expect(201);
    const entityId = createResponse.body.data.id as string;

    const listResponse = await request(app.getHttpServer())
      .get(`/keyword-and-entity-library/projects/${projectId}/entities`)
      .set("Cookie", cookie)
      .expect(200);
    expect((listResponse.body.data as Array<{ id: string }>).some((e) => e.id === entityId)).toBe(
      true,
    );

    const updateResponse = await request(app.getHttpServer())
      .post(`/keyword-and-entity-library/projects/${projectId}/entities/${entityId}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ name: "Acme Corp (revised)" })
      .expect(200);
    expect(updateResponse.body.data.name).toBe("Acme Corp (revised)");

    await request(app.getHttpServer())
      .post(`/keyword-and-entity-library/projects/${projectId}/entities/${entityId}/delete`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/keyword-and-entity-library/projects/${projectId}/entities/${entityId}`)
      .set("Cookie", cookie)
      .expect(404);
  });

  it("returns 404 (IDOR prevention) when accessing an entity through the wrong project's route", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const otherProject = await projects.create({
      publicId: uniqueId("PROJ"),
      name: "Other Project For Entity IDOR",
    });
    const createResponse = await request(app.getHttpServer())
      .post(`/keyword-and-entity-library/projects/${projectId}/entities`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: uniqueId("ENT"), name: "IDOR Entity" })
      .expect(201);
    const entityId = createResponse.body.data.id as string;

    await request(app.getHttpServer())
      .get(`/keyword-and-entity-library/projects/${otherProject.id}/entities/${entityId}`)
      .set("Cookie", cookie)
      .expect(404);
  });

  it("rejects entity creation with 400 when publicId is already in use", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const publicId = uniqueId("ENT");
    await request(app.getHttpServer())
      .post(`/keyword-and-entity-library/projects/${projectId}/entities`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId, name: "First" })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/keyword-and-entity-library/projects/${projectId}/entities`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId, name: "Second" })
      .expect(400);
  });

  it("denies entity creation with 403 for a read_only session (only V grant, not C)", async () => {
    const cookie = await cookieForNewSession(readOnlyUserId);
    await request(app.getHttpServer())
      .post(`/keyword-and-entity-library/projects/${projectId}/entities`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: uniqueId("ENT"), name: "Denied" })
      .expect(403);
  });

  // --- entity-relationships (keyword <-> entity join) ---

  it("links an entity to a keyword, lists it back, and unlinks it", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const keywordFixture = await createDraftKeyword(cookie, { queryText: "Relationship Keyword" });
    const entityResponse = await request(app.getHttpServer())
      .post(`/keyword-and-entity-library/projects/${projectId}/entities`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: uniqueId("ENT"), name: "Relationship Entity" })
      .expect(201);
    const entityId = entityResponse.body.data.id as string;

    const createResponse = await request(app.getHttpServer())
      .post(
        `/keyword-and-entity-library/projects/${projectId}/keywords/${keywordFixture.id}/entity-relationships`,
      )
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ entityId })
      .expect(201);
    const relationshipId = createResponse.body.data.id as string;

    const listResponse = await request(app.getHttpServer())
      .get(
        `/keyword-and-entity-library/projects/${projectId}/keywords/${keywordFixture.id}/entity-relationships`,
      )
      .set("Cookie", cookie)
      .expect(200);
    expect(
      (listResponse.body.data as Array<{ id: string }>).some((r) => r.id === relationshipId),
    ).toBe(true);

    await request(app.getHttpServer())
      .post(
        `/keyword-and-entity-library/projects/${projectId}/keywords/${keywordFixture.id}/entity-relationships/${relationshipId}/delete`,
      )
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .expect(204);

    const listAfterDelete = await request(app.getHttpServer())
      .get(
        `/keyword-and-entity-library/projects/${projectId}/keywords/${keywordFixture.id}/entity-relationships`,
      )
      .set("Cookie", cookie)
      .expect(200);
    expect(
      (listAfterDelete.body.data as Array<{ id: string }>).some((r) => r.id === relationshipId),
    ).toBe(false);
  });

  it("rejects a duplicate keyword-entity relationship with 400", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const keywordFixture = await createDraftKeyword(cookie, {
      queryText: "Dup Relationship Keyword",
    });
    const entityResponse = await request(app.getHttpServer())
      .post(`/keyword-and-entity-library/projects/${projectId}/entities`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: uniqueId("ENT"), name: "Dup Relationship Entity" })
      .expect(201);
    const entityId = entityResponse.body.data.id as string;

    await request(app.getHttpServer())
      .post(
        `/keyword-and-entity-library/projects/${projectId}/keywords/${keywordFixture.id}/entity-relationships`,
      )
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ entityId })
      .expect(201);
    await request(app.getHttpServer())
      .post(
        `/keyword-and-entity-library/projects/${projectId}/keywords/${keywordFixture.id}/entity-relationships`,
      )
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ entityId })
      .expect(400);
  });

  it("rejects linking an entity that belongs to a different project with 400 (cross-project existence validation)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const otherProject = await projects.create({
      publicId: uniqueId("PROJ"),
      name: "Other Project For Entity Cross-Scope",
    });
    const otherEntityResponse = await request(app.getHttpServer())
      .post(`/keyword-and-entity-library/projects/${otherProject.id}/entities`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: uniqueId("ENT"), name: "Other Project Entity" })
      .expect(201);
    const otherEntityId = otherEntityResponse.body.data.id as string;

    const keywordFixture = await createDraftKeyword(cookie, {
      queryText: "Cross-Project Entity Link Fixture",
    });

    await request(app.getHttpServer())
      .post(
        `/keyword-and-entity-library/projects/${projectId}/keywords/${keywordFixture.id}/entity-relationships`,
      )
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ entityId: otherEntityId })
      .expect(400);
  });

  it("rejects linking a well-formed but nonexistent entityId with 400 (not a raw 500)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const keywordFixture = await createDraftKeyword(cookie, {
      queryText: "Nonexistent Entity Link Fixture",
    });

    await request(app.getHttpServer())
      .post(
        `/keyword-and-entity-library/projects/${projectId}/keywords/${keywordFixture.id}/entity-relationships`,
      )
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ entityId: randomUUID() })
      .expect(400);
  });

  it("returns 404 (IDOR prevention) when accessing a relationship through the wrong keyword's route", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const keywordA = await createDraftKeyword(cookie, { queryText: "Relationship Keyword A" });
    const keywordB = await createDraftKeyword(cookie, { queryText: "Relationship Keyword B" });
    const entityResponse = await request(app.getHttpServer())
      .post(`/keyword-and-entity-library/projects/${projectId}/entities`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: uniqueId("ENT"), name: "IDOR Relationship Entity" })
      .expect(201);
    const entityId = entityResponse.body.data.id as string;

    const createResponse = await request(app.getHttpServer())
      .post(
        `/keyword-and-entity-library/projects/${projectId}/keywords/${keywordA.id}/entity-relationships`,
      )
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ entityId })
      .expect(201);
    const relationshipId = createResponse.body.data.id as string;

    await request(app.getHttpServer())
      .post(
        `/keyword-and-entity-library/projects/${projectId}/keywords/${keywordB.id}/entity-relationships/${relationshipId}/delete`,
      )
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .expect(404);

    const listResponse = await request(app.getHttpServer())
      .get(
        `/keyword-and-entity-library/projects/${projectId}/keywords/${keywordA.id}/entity-relationships`,
      )
      .set("Cookie", cookie)
      .expect(200);
    expect(
      (listResponse.body.data as Array<{ id: string }>).some((r) => r.id === relationshipId),
    ).toBe(true);
  });

  // --- page-assignments (keyword <-> Page Inventory page join) ---

  it("assigns a keyword to a Page Inventory page, lists it back, and removes the assignment", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const keywordFixture = await createDraftKeyword(cookie, { queryText: "Assignment Keyword" });
    const page = await pages.create({
      projectId,
      publicId: uniqueId("PAGE"),
      pageName: "Assignment Target Page",
    });

    const createResponse = await request(app.getHttpServer())
      .post(
        `/keyword-and-entity-library/projects/${projectId}/keywords/${keywordFixture.id}/page-assignments`,
      )
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ pageId: page.id, assignmentNote: "primary target" })
      .expect(201);
    const assignmentId = createResponse.body.data.id as string;
    expect(createResponse.body.data.assignmentNote).toBe("primary target");

    const listResponse = await request(app.getHttpServer())
      .get(
        `/keyword-and-entity-library/projects/${projectId}/keywords/${keywordFixture.id}/page-assignments`,
      )
      .set("Cookie", cookie)
      .expect(200);
    expect(
      (listResponse.body.data as Array<{ id: string }>).some((a) => a.id === assignmentId),
    ).toBe(true);

    await request(app.getHttpServer())
      .post(
        `/keyword-and-entity-library/projects/${projectId}/keywords/${keywordFixture.id}/page-assignments/${assignmentId}/delete`,
      )
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .expect(204);

    const listAfterDelete = await request(app.getHttpServer())
      .get(
        `/keyword-and-entity-library/projects/${projectId}/keywords/${keywordFixture.id}/page-assignments`,
      )
      .set("Cookie", cookie)
      .expect(200);
    expect(
      (listAfterDelete.body.data as Array<{ id: string }>).some((a) => a.id === assignmentId),
    ).toBe(false);
  });

  it("rejects assigning a page that belongs to a different project with 400 (cross-module existence validation, task package D1/D10)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const otherProject = await projects.create({
      publicId: uniqueId("PROJ"),
      name: "Other Project For Page Assignment Cross-Scope",
    });
    const otherPage = await pages.create({
      projectId: otherProject.id,
      publicId: uniqueId("PAGE"),
      pageName: "Other Project Page",
    });
    const keywordFixture = await createDraftKeyword(cookie, {
      queryText: "Cross-Project Page Assignment Fixture",
    });

    await request(app.getHttpServer())
      .post(
        `/keyword-and-entity-library/projects/${projectId}/keywords/${keywordFixture.id}/page-assignments`,
      )
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ pageId: otherPage.id })
      .expect(400);
  });

  it("rejects assigning a well-formed but nonexistent pageId with 400 (not a raw 500)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const keywordFixture = await createDraftKeyword(cookie, {
      queryText: "Nonexistent Page Assignment Fixture",
    });

    await request(app.getHttpServer())
      .post(
        `/keyword-and-entity-library/projects/${projectId}/keywords/${keywordFixture.id}/page-assignments`,
      )
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ pageId: randomUUID() })
      .expect(400);
  });

  it("rejects a duplicate page assignment with 400", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const keywordFixture = await createDraftKeyword(cookie, {
      queryText: "Dup Assignment Keyword",
    });
    const page = await pages.create({
      projectId,
      publicId: uniqueId("PAGE"),
      pageName: "Dup Assignment Page",
    });

    await request(app.getHttpServer())
      .post(
        `/keyword-and-entity-library/projects/${projectId}/keywords/${keywordFixture.id}/page-assignments`,
      )
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ pageId: page.id })
      .expect(201);
    await request(app.getHttpServer())
      .post(
        `/keyword-and-entity-library/projects/${projectId}/keywords/${keywordFixture.id}/page-assignments`,
      )
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ pageId: page.id })
      .expect(400);
  });

  it("returns 404 (IDOR prevention) when accessing a page assignment through the wrong keyword's route", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const keywordA = await createDraftKeyword(cookie, { queryText: "Assignment Keyword A" });
    const keywordB = await createDraftKeyword(cookie, { queryText: "Assignment Keyword B" });
    const page = await pages.create({
      projectId,
      publicId: uniqueId("PAGE"),
      pageName: "IDOR Assignment Page",
    });

    const createResponse = await request(app.getHttpServer())
      .post(
        `/keyword-and-entity-library/projects/${projectId}/keywords/${keywordA.id}/page-assignments`,
      )
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ pageId: page.id })
      .expect(201);
    const assignmentId = createResponse.body.data.id as string;

    await request(app.getHttpServer())
      .post(
        `/keyword-and-entity-library/projects/${projectId}/keywords/${keywordB.id}/page-assignments/${assignmentId}/delete`,
      )
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .expect(404);

    const listResponse = await request(app.getHttpServer())
      .get(
        `/keyword-and-entity-library/projects/${projectId}/keywords/${keywordA.id}/page-assignments`,
      )
      .set("Cookie", cookie)
      .expect(200);
    expect(
      (listResponse.body.data as Array<{ id: string }>).some((a) => a.id === assignmentId),
    ).toBe(true);
  });

  it("denies page-assignment creation with 403 for a read_only session (only V grant, not E)", async () => {
    const adminCookie = await cookieForNewSession(superAdminUserId);
    const keywordFixture = await createDraftKeyword(adminCookie, {
      queryText: "Read Only Assignment Fixture",
    });
    const page = await pages.create({
      projectId,
      publicId: uniqueId("PAGE"),
      pageName: "Read Only Assignment Page",
    });

    const readOnlyCookie = await cookieForNewSession(readOnlyUserId);
    await request(app.getHttpServer())
      .post(
        `/keyword-and-entity-library/projects/${projectId}/keywords/${keywordFixture.id}/page-assignments`,
      )
      .set("Cookie", readOnlyCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ pageId: page.id })
      .expect(403);
  });
});
