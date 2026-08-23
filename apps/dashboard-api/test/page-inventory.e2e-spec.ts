import { randomBytes, randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import {
  buildMigrator,
  closeConnection,
  ProjectRepository,
  RoadmapItemRepository,
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
import { PageInventoryModule } from "../src/page-inventory/page-inventory.module.js";

/**
 * Request-level coverage for the Page Inventory module HTTP surface, against a REAL disposable
 * PostgreSQL database — same harness pattern as `proof-and-claims-library.e2e-spec.ts`/
 * `persona-library.e2e-spec.ts`. `page_inventory` has real seeded grants
 * (`00013-seed-rbac-matrix.ts:118-124`) that meaningfully differ per role:
 *   super_admin              VCERAMX  (create, edit, review, approve — not submit)
 *   owner_growth_approver    VCERAX   (create, edit, review, approve — not submit)
 *   marketing_editor         VCES     (create, edit, submit — not review/approve)
 *   developer                VCE      (create, edit — not submit/review/approve)
 *   qa_security_reviewer     VR       (view, review only)
 *   read_only                V        (view only)
 *
 * Unlike every prior content-library module's own e2e suite, this one also exercises Page
 * Inventory's first-of-its-kind project-scoping (task package D2): every page lives under a real
 * `:projectId` route path segment (`page-inventory/projects/:projectId/pages`, ...), not a
 * client-supplied query/body field — closing a real code-review finding where
 * `PermissionGuard`/`AuthorizationService.assertAllowed()` only ever read `request.params?.projectId`,
 * so a `projectId` sent any other way was silently never checked by authorization at all. Several
 * tests below (marked "regression") specifically prove a session holding ONLY a project-scoped
 * `page_inventory` grant (not a global one) — previously denied on every route — is now allowed
 * within its own project, and still denied outside it.
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

describe("Page Inventory module endpoints (e2e, real disposable database)", () => {
  let app: INestApplication;
  let users: UserRepository;
  let roles: RoleRepository;
  let userRoles: UserRoleRepository;
  let projects: ProjectRepository;
  let roadmapItems: RoadmapItemRepository;
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

  async function createDraftPage(
    cookie: string,
    overrides: Record<string, unknown> = {},
    targetProjectId: string = projectId,
  ): Promise<{ id: string; workflowStage: string; projectId: string }> {
    const response = await request(app.getHttpServer())
      .post(`/page-inventory/projects/${targetProjectId}/pages`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        publicId: uniqueId("PAGE"),
        pageName: "E2E Fixture Page",
        ...overrides,
      })
      .expect(201);
    return response.body.data as { id: string; workflowStage: string; projectId: string };
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
      imports: [PageInventoryModule],
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
    roadmapItems = new RoadmapItemRepository();

    superAdminUserId = await createUserWithRole("pageinv.super-admin", "super_admin");
    readOnlyUserId = await createUserWithRole("pageinv.read-only", "read_only");
    marketingEditorUserId = await createUserWithRole(
      "pageinv.marketing-editor",
      "marketing_editor",
    );
    developerUserId = await createUserWithRole("pageinv.developer", "developer");
    ownerGrowthApproverUserId = await createUserWithRole(
      "pageinv.owner-growth-approver",
      "owner_growth_approver",
    );
    qaSecurityReviewerUserId = await createUserWithRole(
      "pageinv.qa-security-reviewer",
      "qa_security_reviewer",
    );

    const project = await projects.create({
      publicId: uniqueId("PROJ"),
      name: "Page Inventory E2E Fixture Project",
    });
    projectId = project.id;
  }, 30_000);

  afterAll(async () => {
    await app.close();
    const migrator = buildMigrator();
    await migrator.down({ to: 0 });
    await closeConnection();
  }, 30_000);

  it("rejects GET .../pages with 401 when there is no session cookie", async () => {
    await request(app.getHttpServer())
      .get(`/page-inventory/projects/${projectId}/pages`)
      .expect(401);
  });

  it("allows a real super_admin session to create, read, list, and edit a page", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftPage(cookie, { pageName: "Home" });
    expect(created.workflowStage).toBe("draft");
    expect(created.projectId).toBe(projectId);

    const getResponse = await request(app.getHttpServer())
      .get(`/page-inventory/projects/${projectId}/pages/${created.id}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(getResponse.body.data.pageName).toBe("Home");

    const listResponse = await request(app.getHttpServer())
      .get(`/page-inventory/projects/${projectId}/pages`)
      .set("Cookie", cookie)
      .expect(200);
    expect((listResponse.body.data as Array<{ id: string }>).some((p) => p.id === created.id)).toBe(
      true,
    );

    const updateResponse = await request(app.getHttpServer())
      .post(`/page-inventory/projects/${projectId}/pages/${created.id}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ pageName: "Home (revised)" })
      .expect(200);
    expect(updateResponse.body.data.pageName).toBe("Home (revised)");
    expect(updateResponse.body.data.workflowStage).toBe("draft"); // update never touches status
  });

  // NOT a 400: NestJS runs guards (PermissionGuard) BEFORE pipes (ParseUUIDPipe) in its request
  // lifecycle, so `PermissionGuard`'s own raw `request.params?.projectId` read reaches
  // `AuthorizationService.evaluate()` — and a real Postgres query on a UUID-typed column —
  // *before* `ParseUUIDPipe` ever gets a chance to reject the malformed value with a clean 400.
  // This is a real, pre-existing gap shared by every `:projectId`-scoped route in this codebase
  // (`RoadmapItemsController`'s own routes have the identical exposure — no test in
  // `projects.e2e-spec.ts` has ever exercised this input, so it was never caught there either),
  // not something this fix introduces or could close without touching `PermissionGuard` itself —
  // explicitly out of scope per this task's own instruction. It's caught cleanly, not an
  // unhandled crash (`AllExceptionsFilter` still returns a structured JSON error body), but the
  // status/message aren't the clean, safe 400 a malformed-UUID input should get — asserted here
  // only to record the real current behavior as known, flagged, out-of-scope debt, not to imply
  // it's the intended shape.
  it("returns a structured (not unhandled-crash) 500 for a malformed :projectId route segment — known pre-existing gap, PermissionGuard reads request.params before ParseUUIDPipe validates it", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const response = await request(app.getHttpServer())
      .get("/page-inventory/projects/not-a-uuid/pages")
      .set("Cookie", cookie)
      .expect(500);
    expect(response.body.success).toBe(false);
    expect(response.body.error?.code).toBeTruthy();
  });

  it("denies page creation with 403 for a read_only session (only V grant, not C)", async () => {
    const cookie = await cookieForNewSession(readOnlyUserId);
    await request(app.getHttpServer())
      .post(`/page-inventory/projects/${projectId}/pages`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: uniqueId("PAGE"), pageName: "Denied" })
      .expect(403);
  });

  it("allows a read_only session to list pages (V grant)", async () => {
    const cookie = await cookieForNewSession(readOnlyUserId);
    await request(app.getHttpServer())
      .get(`/page-inventory/projects/${projectId}/pages`)
      .set("Cookie", cookie)
      .expect(200);
  });

  it("list() is scoped to projectId — a page in a different project never appears", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const otherProject = await projects.create({
      publicId: uniqueId("PROJ"),
      name: "Other Project",
    });
    const pageInOther = await createDraftPage(
      cookie,
      { pageName: "In Other Project" },
      otherProject.id,
    );

    const listResponse = await request(app.getHttpServer())
      .get(`/page-inventory/projects/${projectId}/pages`)
      .set("Cookie", cookie)
      .expect(200);
    expect(
      (listResponse.body.data as Array<{ id: string }>).some((p) => p.id === pageInOther.id),
    ).toBe(false);
  });

  it("rejects page creation with 400 when publicId is already in use", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const publicId = uniqueId("PAGE");
    await request(app.getHttpServer())
      .post(`/page-inventory/projects/${projectId}/pages`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId, pageName: "First" })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/page-inventory/projects/${projectId}/pages`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId, pageName: "Second" })
      .expect(400);
  });

  it("returns 404 (not a raw 500) when creating a page under a well-formed but nonexistent projectId", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .post("/page-inventory/projects/00000000-0000-4000-8000-000000000000/pages")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: uniqueId("PAGE"), pageName: "Orphaned" })
      .expect(404);
  });

  it("creates a page with a real roadmapPhaseId scoped to the same project, and round-trips it on GET", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const phase = await roadmapItems.create({ projectId, name: "Phase 1" });

    const created = await createDraftPage(cookie, { roadmapPhaseId: phase.id });

    const getResponse = await request(app.getHttpServer())
      .get(`/page-inventory/projects/${projectId}/pages/${created.id}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(getResponse.body.data.roadmapPhaseId).toBe(phase.id);
  });

  it("rejects page creation with 400 when roadmapPhaseId belongs to a different project", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const otherProject = await projects.create({
      publicId: uniqueId("PROJ"),
      name: "Other Project For Phase",
    });
    const phaseInOtherProject = await roadmapItems.create({
      projectId: otherProject.id,
      name: "Other Project's Phase",
    });

    await request(app.getHttpServer())
      .post(`/page-inventory/projects/${projectId}/pages`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        publicId: uniqueId("PAGE"),
        pageName: "X",
        roadmapPhaseId: phaseInOtherProject.id,
      })
      .expect(400);
  });

  it("rejects page creation with 400 when roadmapPhaseId doesn't resolve to a real roadmap item", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .post(`/page-inventory/projects/${projectId}/pages`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        publicId: uniqueId("PAGE"),
        pageName: "X",
        roadmapPhaseId: randomUUID(),
      })
      .expect(400);
  });

  it("rejects an empty update patch with 400", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftPage(cookie);
    await request(app.getHttpServer())
      .post(`/page-inventory/projects/${projectId}/pages/${created.id}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({})
      .expect(400);
  });

  it("marketing_editor (VCES) can submit, but is denied review and approve (draft->submitted->under_review)", async () => {
    const cookie = await cookieForNewSession(marketingEditorUserId);
    const created = await createDraftPage(cookie, { pageName: "Marketing Editor Fixture" });

    await request(app.getHttpServer())
      .post(`/page-inventory/projects/${projectId}/pages/${created.id}/workflow-stage`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ workflowStage: "submitted" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/page-inventory/projects/${projectId}/pages/${created.id}/workflow-stage`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ workflowStage: "under_review" })
      .expect(403);
  });

  it("developer (VCE, no S/R/A) can create and edit, but is denied every workflow-stage transition", async () => {
    const adminCookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftPage(adminCookie, { pageName: "Developer Fixture" });

    const devCookie = await cookieForNewSession(developerUserId);
    await request(app.getHttpServer())
      .post(`/page-inventory/projects/${projectId}/pages/${created.id}/update`)
      .set("Cookie", devCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ pageName: "Edited by developer" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/page-inventory/projects/${projectId}/pages/${created.id}/workflow-stage`)
      .set("Cookie", devCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ workflowStage: "submitted" })
      .expect(403);
  });

  it("owner_growth_approver (VCERAX, no S) is denied draft->submitted, but can review and approve once submitted", async () => {
    const adminCookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftPage(adminCookie, { pageName: "Owner Approver Fixture" });

    const approverCookie = await cookieForNewSession(ownerGrowthApproverUserId);
    await request(app.getHttpServer())
      .post(`/page-inventory/projects/${projectId}/pages/${created.id}/workflow-stage`)
      .set("Cookie", approverCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ workflowStage: "submitted" })
      .expect(403);

    const editorCookie = await cookieForNewSession(marketingEditorUserId);
    await request(app.getHttpServer())
      .post(`/page-inventory/projects/${projectId}/pages/${created.id}/workflow-stage`)
      .set("Cookie", editorCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ workflowStage: "submitted" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/page-inventory/projects/${projectId}/pages/${created.id}/workflow-stage`)
      .set("Cookie", approverCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ workflowStage: "under_review" })
      .expect(200);

    const approveResponse = await request(app.getHttpServer())
      .post(`/page-inventory/projects/${projectId}/pages/${created.id}/workflow-stage`)
      .set("Cookie", approverCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ workflowStage: "approved" })
      .expect(200);
    expect(approveResponse.body.data.workflowStage).toBe("approved");
  });

  it("qa_security_reviewer (VR only) can view and review, but is denied create and approve", async () => {
    const adminCookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftPage(adminCookie, { pageName: "QA Reviewer Fixture" });
    const editorCookie = await cookieForNewSession(marketingEditorUserId);
    await request(app.getHttpServer())
      .post(`/page-inventory/projects/${projectId}/pages/${created.id}/workflow-stage`)
      .set("Cookie", editorCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ workflowStage: "submitted" })
      .expect(200);

    const qaCookie = await cookieForNewSession(qaSecurityReviewerUserId);
    await request(app.getHttpServer())
      .post(`/page-inventory/projects/${projectId}/pages`)
      .set("Cookie", qaCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: uniqueId("PAGE"), pageName: "Denied create" })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/page-inventory/projects/${projectId}/pages/${created.id}/workflow-stage`)
      .set("Cookie", qaCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ workflowStage: "under_review" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/page-inventory/projects/${projectId}/pages/${created.id}/workflow-stage`)
      .set("Cookie", qaCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ workflowStage: "approved" })
      .expect(403);
  });

  it("rejects an invalid workflow-stage transition (archived -> submitted, archived is terminal) with 400", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftPage(cookie, { pageName: "Terminal State Fixture" });

    await request(app.getHttpServer())
      .post(`/page-inventory/projects/${projectId}/pages/${created.id}/workflow-stage`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ workflowStage: "archived" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/page-inventory/projects/${projectId}/pages/${created.id}/workflow-stage`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ workflowStage: "submitted" })
      .expect(400);
  });

  it("returns 404 for a GET on a nonexistent page id", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .get(`/page-inventory/projects/${projectId}/pages/${randomUUID()}`)
      .set("Cookie", cookie)
      .expect(404);
  });

  it("returns 400 (not a raw 500) for a malformed page id", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .get(`/page-inventory/projects/${projectId}/pages/not-a-uuid`)
      .set("Cookie", cookie)
      .expect(400);
  });

  it("rejects a mutating request with no Origin header (OriginCheckGuard)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .post(`/page-inventory/projects/${projectId}/pages`)
      .set("Cookie", cookie)
      .send({ publicId: uniqueId("PAGE"), pageName: "No origin" })
      .expect(403);
  });

  // --- IDOR / project-scoping regression coverage (code-review finding, module-page-inventory) ---

  it("returns 404 (IDOR prevention) when accessing a page through the wrong project's route", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const otherProject = await projects.create({
      publicId: uniqueId("PROJ"),
      name: "Other Project For Page IDOR",
    });
    const created = await createDraftPage(cookie, { pageName: "Belongs To Fixture Project" });

    await request(app.getHttpServer())
      .get(`/page-inventory/projects/${otherProject.id}/pages/${created.id}`)
      .set("Cookie", cookie)
      .expect(404);

    await request(app.getHttpServer())
      .post(`/page-inventory/projects/${otherProject.id}/pages/${created.id}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ pageName: "Attempted cross-project edit" })
      .expect(404);

    await request(app.getHttpServer())
      .post(`/page-inventory/projects/${otherProject.id}/pages/${created.id}/workflow-stage`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ workflowStage: "submitted" })
      .expect(404);

    // Still reachable, and unmodified, via its real project.
    const getResponse = await request(app.getHttpServer())
      .get(`/page-inventory/projects/${projectId}/pages/${created.id}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(getResponse.body.data.pageName).toBe("Belongs To Fixture Project");
  });

  it(
    "allows a session holding ONLY a project-scoped page_inventory grant (not a global one) to " +
      "list, create, and edit pages within that project — and still denies it in a different " +
      "project (regression: PermissionGuard previously ignored :projectId from the route path " +
      "entirely, since every route sent projectId via query/body instead of the path)",
    async () => {
      const developerRole = await roles.findByKey("developer");
      if (!developerRole) {
        throw new Error("Expected developer role was not seeded — check migration 00013");
      }
      const scopedUserId = await createUserWithRole(
        "pageinv.project-scoped",
        "developer",
        // Assigned scoped to `projectId` only — no global-scope row for this user at all, so
        // pre-fix this session would be denied everywhere (PermissionGuard resolved
        // `request.params?.projectId` as `undefined`, so `findRoleIdsForUser` only ever checked
        // global-scope roles, of which this user holds none).
        projectId,
      );
      const scopedCookie = await cookieForNewSession(scopedUserId);

      await request(app.getHttpServer())
        .get(`/page-inventory/projects/${projectId}/pages`)
        .set("Cookie", scopedCookie)
        .expect(200);

      const created = await createDraftPage(scopedCookie, {
        pageName: "Project-Scoped Grant Fixture",
      });

      await request(app.getHttpServer())
        .post(`/page-inventory/projects/${projectId}/pages/${created.id}/update`)
        .set("Cookie", scopedCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ pageName: "Edited by project-scoped session" })
        .expect(200);

      // The same session, same role, but a DIFFERENT project — the grant does not carry over.
      const otherProject = await projects.create({
        publicId: uniqueId("PROJ"),
        name: "Other Project (project-scoped grant should not reach here)",
      });
      await request(app.getHttpServer())
        .get(`/page-inventory/projects/${otherProject.id}/pages`)
        .set("Cookie", scopedCookie)
        .expect(403);
    },
  );

  it(
    "allows a session holding ONLY a project-scoped page_inventory grant to submit a page for " +
      "review (regression: PagesService.changeWorkflowStage()'s dynamic per-transition " +
      "AuthorizationService.assertAllowed() call previously never received a projectId at all)",
    async () => {
      const scopedEditorUserId = await createUserWithRole(
        "pageinv.project-scoped-editor",
        "marketing_editor",
        projectId,
      );
      const adminCookie = await cookieForNewSession(superAdminUserId);
      const created = await createDraftPage(adminCookie, {
        pageName: "Project-Scoped Workflow Fixture",
      });

      const scopedCookie = await cookieForNewSession(scopedEditorUserId);
      const response = await request(app.getHttpServer())
        .post(`/page-inventory/projects/${projectId}/pages/${created.id}/workflow-stage`)
        .set("Cookie", scopedCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ workflowStage: "submitted" })
        .expect(200);
      expect(response.body.data.workflowStage).toBe("submitted");
    },
  );

  // --- page_urls (child sub-resource) ---

  it("creates, lists, updates, and deletes a page URL, scoped to its parent page", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftPage(cookie, { pageName: "URL Parent Fixture" });

    const createResponse = await request(app.getHttpServer())
      .post(`/page-inventory/projects/${projectId}/pages/${created.id}/urls`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ url: `https://example.com/${uniqueId("home")}` })
      .expect(201);
    const urlId = createResponse.body.data.id as string;
    expect(createResponse.body.data.isCanonical).toBe(true);

    const listResponse = await request(app.getHttpServer())
      .get(`/page-inventory/projects/${projectId}/pages/${created.id}/urls`)
      .set("Cookie", cookie)
      .expect(200);
    expect((listResponse.body.data as Array<{ id: string }>).some((u) => u.id === urlId)).toBe(
      true,
    );

    const updateResponse = await request(app.getHttpServer())
      .post(`/page-inventory/projects/${projectId}/pages/${created.id}/urls/${urlId}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ url: `https://example.com/${uniqueId("revised")}` })
      .expect(200);
    expect(updateResponse.body.data.url).toContain("revised");

    await request(app.getHttpServer())
      .post(`/page-inventory/projects/${projectId}/pages/${created.id}/urls/${urlId}/delete`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .expect(204);

    const listAfterDelete = await request(app.getHttpServer())
      .get(`/page-inventory/projects/${projectId}/pages/${created.id}/urls`)
      .set("Cookie", cookie)
      .expect(200);
    expect((listAfterDelete.body.data as Array<{ id: string }>).some((u) => u.id === urlId)).toBe(
      false,
    );
  });

  it("returns 404 (IDOR prevention) when accessing a URL through the wrong parent page's route", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const pageA = await createDraftPage(cookie, { pageName: "Page A" });
    const pageB = await createDraftPage(cookie, { pageName: "Page B" });

    const createResponse = await request(app.getHttpServer())
      .post(`/page-inventory/projects/${projectId}/pages/${pageA.id}/urls`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ url: `https://example.com/${uniqueId("belongs-to-a")}` })
      .expect(201);
    const urlId = createResponse.body.data.id as string;

    // Accessed via page B's route — must 404, not silently succeed or leak page A's data.
    await request(app.getHttpServer())
      .post(`/page-inventory/projects/${projectId}/pages/${pageB.id}/urls/${urlId}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ url: "https://example.com/attempted-cross-page-edit" })
      .expect(404);

    await request(app.getHttpServer())
      .post(`/page-inventory/projects/${projectId}/pages/${pageB.id}/urls/${urlId}/delete`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .expect(404);

    const listResponse = await request(app.getHttpServer())
      .get(`/page-inventory/projects/${projectId}/pages/${pageA.id}/urls`)
      .set("Cookie", cookie)
      .expect(200);
    expect((listResponse.body.data as Array<{ id: string }>).some((u) => u.id === urlId)).toBe(
      true,
    );
  });

  it("returns 404 (IDOR prevention) when accessing page_urls through the wrong project's route", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const otherProject = await projects.create({
      publicId: uniqueId("PROJ"),
      name: "Other Project For URL IDOR",
    });
    const created = await createDraftPage(cookie, { pageName: "URL Cross-Project Fixture" });

    await request(app.getHttpServer())
      .get(`/page-inventory/projects/${otherProject.id}/pages/${created.id}/urls`)
      .set("Cookie", cookie)
      .expect(404);

    await request(app.getHttpServer())
      .post(`/page-inventory/projects/${otherProject.id}/pages/${created.id}/urls`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ url: "https://example.com/cross-project-attempt" })
      .expect(404);
  });

  it("returns 404 (not a raw 500) when creating a URL under a well-formed but nonexistent page id", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const nonexistentPageId = "00000000-0000-4000-8000-000000000000";

    await request(app.getHttpServer())
      .post(`/page-inventory/projects/${projectId}/pages/${nonexistentPageId}/urls`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ url: "https://example.com/orphaned" })
      .expect(404);
  });

  it("rejects a page URL with a javascript: scheme (stored-XSS prevention, safeHttpUrlSchema)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftPage(cookie, { pageName: "Unsafe URL Fixture" });

    await request(app.getHttpServer())
      .post(`/page-inventory/projects/${projectId}/pages/${created.id}/urls`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ url: "javascript:alert(document.cookie)" })
      .expect(400);
  });

  it("enforces at most one canonical URL per (project, url) — rejects a duplicate canonical submission with 400", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const pageA = await createDraftPage(cookie, { pageName: "Canonical Conflict Page A" });
    const pageB = await createDraftPage(cookie, { pageName: "Canonical Conflict Page B" });
    const url = `https://example.com/${uniqueId("shared")}`;

    await request(app.getHttpServer())
      .post(`/page-inventory/projects/${projectId}/pages/${pageA.id}/urls`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ url, isCanonical: true })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/page-inventory/projects/${projectId}/pages/${pageB.id}/urls`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ url, isCanonical: true })
      .expect(400);
  });

  it("denies page-URL creation with 403 for a read_only session (only V grant, not E)", async () => {
    const adminCookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftPage(adminCookie, { pageName: "Read Only URL Fixture" });

    const readOnlyCookie = await cookieForNewSession(readOnlyUserId);
    await request(app.getHttpServer())
      .post(`/page-inventory/projects/${projectId}/pages/${created.id}/urls`)
      .set("Cookie", readOnlyCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ url: "https://example.com/denied" })
      .expect(403);
  });
});
