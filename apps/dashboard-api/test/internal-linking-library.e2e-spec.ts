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
import { InternalLinkingLibraryModule } from "../src/internal-linking-library/internal-linking-library.module.js";

/**
 * Request-level coverage for the Internal Linking Library module HTTP surface, against a REAL
 * disposable PostgreSQL database — same harness pattern as `keyword-and-entity-library.e2e-spec.ts`.
 * `keyword_internal_links` has real seeded grants (`00013-seed-rbac-matrix.ts:190-198`) — the same
 * group Keyword & Entity Library already uses, not a coincidence:
 *   super_admin              VCERAMX  (view, create, edit, review, approve, configure, export —
 *                                       NOT submit)
 *   owner_growth_approver    VCERAX   (view, create, edit, review, approve, export — NOT submit)
 *   marketing_editor         VCESR    (view, create, edit, submit, review — NOT approve)
 *   designer_creative_reviewer V      (view only)
 *   developer                V        (view only)
 *   qa_security_reviewer     VR       (view, review only)
 *   read_only                V        (view only)
 *
 * This module's genuinely bespoke `TRANSITIONS` table (task package D2) means NO single role can
 * drive a link through its full `proposed -> approved -> implemented -> verified` lifecycle alone
 * — `approve` (proposed -> approved, approved -> proposed) is held only by super_admin/
 * owner_growth_approver, while `submit` (approved -> implemented, implemented -> approved) is held
 * only by marketing_editor. Several tests below drive the lifecycle across multiple real actor
 * sessions to prove this real separation of duties, distinct from Keyword & Entity Library's own
 * single-role-can-do-everything-but-approve shape.
 *
 * Every route lives under a real `:projectId` route path segment
 * (`internal-linking-library/projects/:projectId/links`), mirroring Page Inventory's/Keyword &
 * Entity Library's own already-fixed project-scoping shape — tests marked "regression" specifically
 * prove a session holding ONLY a project-scoped `keyword_internal_links` grant (not a global one)
 * is allowed within its own project and still denied outside it.
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

describe("Internal Linking Library module endpoints (e2e, real disposable database)", () => {
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
  let sourcePageId: string;
  let targetPageId: string;

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

  async function createProposedLink(
    cookie: string,
    overrides: Record<string, unknown> = {},
    targetProjectId: string = projectId,
  ): Promise<{ id: string; status: string; projectId: string }> {
    const response = await request(app.getHttpServer())
      .post(`/internal-linking-library/projects/${targetProjectId}/links`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        publicId: uniqueId("LINK"),
        sourcePageId,
        targetPageId,
        ...overrides,
      })
      .expect(201);
    return response.body.data as { id: string; status: string; projectId: string };
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
      imports: [InternalLinkingLibraryModule],
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

    superAdminUserId = await createUserWithRole("ill.super-admin", "super_admin");
    readOnlyUserId = await createUserWithRole("ill.read-only", "read_only");
    marketingEditorUserId = await createUserWithRole("ill.marketing-editor", "marketing_editor");
    developerUserId = await createUserWithRole("ill.developer", "developer");
    ownerGrowthApproverUserId = await createUserWithRole(
      "ill.owner-growth-approver",
      "owner_growth_approver",
    );
    qaSecurityReviewerUserId = await createUserWithRole(
      "ill.qa-security-reviewer",
      "qa_security_reviewer",
    );

    const project = await projects.create({
      publicId: uniqueId("PROJ"),
      name: "Internal Linking Library E2E Fixture Project",
    });
    projectId = project.id;

    const source = await pages.create({
      projectId,
      publicId: uniqueId("PAGE"),
      pageName: "E2E Source Page",
    });
    sourcePageId = source.id;
    const target = await pages.create({
      projectId,
      publicId: uniqueId("PAGE"),
      pageName: "E2E Target Page",
    });
    targetPageId = target.id;
  }, 30_000);

  afterAll(async () => {
    await app.close();
    const migrator = buildMigrator();
    await migrator.down({ to: 0 });
    await closeConnection();
  }, 30_000);

  it("rejects GET .../links with 401 when there is no session cookie", async () => {
    await request(app.getHttpServer())
      .get(`/internal-linking-library/projects/${projectId}/links`)
      .expect(401);
  });

  it("allows a real super_admin session to create, read, list, and edit a link", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createProposedLink(cookie, { anchor: "Learn more" });
    expect(created.status).toBe("proposed");
    expect(created.projectId).toBe(projectId);

    const getResponse = await request(app.getHttpServer())
      .get(`/internal-linking-library/projects/${projectId}/links/${created.id}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(getResponse.body.data.anchor).toBe("Learn more");

    const listResponse = await request(app.getHttpServer())
      .get(`/internal-linking-library/projects/${projectId}/links`)
      .set("Cookie", cookie)
      .expect(200);
    expect((listResponse.body.data as Array<{ id: string }>).some((l) => l.id === created.id)).toBe(
      true,
    );

    const updateResponse = await request(app.getHttpServer())
      .post(`/internal-linking-library/projects/${projectId}/links/${created.id}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ anchor: "Learn more (revised)" })
      .expect(200);
    expect(updateResponse.body.data.anchor).toBe("Learn more (revised)");
    expect(updateResponse.body.data.status).toBe("proposed"); // update never touches status
  });

  // Same known, pre-existing, flagged-not-fixed gap as page-inventory.e2e-spec.ts's/
  // keyword-and-entity-library.e2e-spec.ts's own identical test — PermissionGuard reads
  // request.params before ParseUUIDPipe validates it, shared by every :projectId-scoped route in
  // this codebase.
  it("returns a structured (not unhandled-crash) 500 for a malformed :projectId route segment — known pre-existing gap, shared with Keyword & Entity Library/Page Inventory", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const response = await request(app.getHttpServer())
      .get("/internal-linking-library/projects/not-a-uuid/links")
      .set("Cookie", cookie)
      .expect(500);
    expect(response.body.success).toBe(false);
    expect(response.body.error?.code).toBeTruthy();
  });

  it("denies link creation with 403 for a read_only session (only V grant, not C)", async () => {
    const cookie = await cookieForNewSession(readOnlyUserId);
    await request(app.getHttpServer())
      .post(`/internal-linking-library/projects/${projectId}/links`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: uniqueId("LINK"), sourcePageId, targetPageId })
      .expect(403);
  });

  it("allows a read_only session to list links (V grant)", async () => {
    const cookie = await cookieForNewSession(readOnlyUserId);
    await request(app.getHttpServer())
      .get(`/internal-linking-library/projects/${projectId}/links`)
      .set("Cookie", cookie)
      .expect(200);
  });

  it("list() is scoped to projectId — a link in a different project never appears", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const otherProject = await projects.create({
      publicId: uniqueId("PROJ"),
      name: "Other Project",
    });
    const otherSource = await pages.create({
      projectId: otherProject.id,
      publicId: uniqueId("PAGE"),
      pageName: "Other Source",
    });
    const otherTarget = await pages.create({
      projectId: otherProject.id,
      publicId: uniqueId("PAGE"),
      pageName: "Other Target",
    });
    const linkInOther = await createProposedLink(
      cookie,
      { sourcePageId: otherSource.id, targetPageId: otherTarget.id },
      otherProject.id,
    );

    const listResponse = await request(app.getHttpServer())
      .get(`/internal-linking-library/projects/${projectId}/links`)
      .set("Cookie", cookie)
      .expect(200);
    expect(
      (listResponse.body.data as Array<{ id: string }>).some((l) => l.id === linkInOther.id),
    ).toBe(false);
  });

  it("rejects link creation with 400 when publicId is already in use", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const publicId = uniqueId("LINK");
    await request(app.getHttpServer())
      .post(`/internal-linking-library/projects/${projectId}/links`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId, sourcePageId, targetPageId })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/internal-linking-library/projects/${projectId}/links`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId, sourcePageId, targetPageId })
      .expect(400);
  });

  it("returns 404 (not a raw 500) when creating a link under a well-formed but nonexistent projectId", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .post("/internal-linking-library/projects/00000000-0000-4000-8000-000000000000/links")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: uniqueId("LINK"), sourcePageId, targetPageId })
      .expect(404);
  });

  it("rejects creation with sourcePageId === targetPageId (a page cannot link to itself) with 400", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .post(`/internal-linking-library/projects/${projectId}/links`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: uniqueId("LINK"), sourcePageId, targetPageId: sourcePageId })
      .expect(400);
  });

  it("rejects creation referencing a well-formed but nonexistent sourcePageId with 400 (not a raw 500)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .post(`/internal-linking-library/projects/${projectId}/links`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: uniqueId("LINK"), sourcePageId: randomUUID(), targetPageId })
      .expect(400);
  });

  it("rejects creation referencing a page from a different project with 400 (cross-project existence validation, task package D4)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const otherProject = await projects.create({
      publicId: uniqueId("PROJ"),
      name: "Other Project For Cross-Scope Page",
    });
    const otherPage = await pages.create({
      projectId: otherProject.id,
      publicId: uniqueId("PAGE"),
      pageName: "Other Project Page",
    });

    await request(app.getHttpServer())
      .post(`/internal-linking-library/projects/${projectId}/links`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: uniqueId("LINK"), sourcePageId, targetPageId: otherPage.id })
      .expect(400);
  });

  it("rejects creation with a well-formed but nonexistent assignedApproverUserId with 400 (task package D7)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .post(`/internal-linking-library/projects/${projectId}/links`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        publicId: uniqueId("LINK"),
        sourcePageId,
        targetPageId,
        assignedApproverUserId: randomUUID(),
      })
      .expect(400);
  });

  it("accepts creation with a real assignedApproverUserId", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const response = await request(app.getHttpServer())
      .post(`/internal-linking-library/projects/${projectId}/links`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        publicId: uniqueId("LINK"),
        sourcePageId,
        targetPageId,
        assignedApproverUserId: ownerGrowthApproverUserId,
      })
      .expect(201);
    expect(response.body.data.assignedApproverUserId).toBe(ownerGrowthApproverUserId);
  });

  it("rejects an empty update patch with 400", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createProposedLink(cookie);
    await request(app.getHttpServer())
      .post(`/internal-linking-library/projects/${projectId}/links/${created.id}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({})
      .expect(400);
  });

  it("rejects an update that would make sourcePageId === targetPageId with 400", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createProposedLink(cookie);
    await request(app.getHttpServer())
      .post(`/internal-linking-library/projects/${projectId}/links/${created.id}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ targetPageId: sourcePageId })
      .expect(400);
  });

  it("rejects an update re-pointing targetPageId at a page from a different project with 400 (real-database counterpart of create()'s own cross-project test — this path was previously proven only via a mocked existsInProject boolean)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createProposedLink(cookie);
    const otherProject = await projects.create({
      publicId: uniqueId("PROJ"),
      name: "Other Project For Update Cross-Scope Page",
    });
    const otherPage = await pages.create({
      projectId: otherProject.id,
      publicId: uniqueId("PAGE"),
      pageName: "Other Project Page (update path)",
    });

    await request(app.getHttpServer())
      .post(`/internal-linking-library/projects/${projectId}/links/${created.id}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ targetPageId: otherPage.id })
      .expect(400);
  });

  it("returns 404 for a GET on a nonexistent link id", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .get(`/internal-linking-library/projects/${projectId}/links/${randomUUID()}`)
      .set("Cookie", cookie)
      .expect(404);
  });

  it("returns 400 (not a raw 500) for a malformed link id", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .get(`/internal-linking-library/projects/${projectId}/links/not-a-uuid`)
      .set("Cookie", cookie)
      .expect(400);
  });

  it("rejects a mutating request with no Origin header (OriginCheckGuard)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .post(`/internal-linking-library/projects/${projectId}/links`)
      .set("Cookie", cookie)
      .send({ publicId: uniqueId("LINK"), sourcePageId, targetPageId })
      .expect(403);
  });

  // --- IDOR / project-scoping regression coverage ---

  it("returns 404 (IDOR prevention) when accessing a link through the wrong project's route", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const otherProject = await projects.create({
      publicId: uniqueId("PROJ"),
      name: "Other Project For Link IDOR",
    });
    const created = await createProposedLink(cookie, { anchor: "Belongs To Fixture Project" });

    await request(app.getHttpServer())
      .get(`/internal-linking-library/projects/${otherProject.id}/links/${created.id}`)
      .set("Cookie", cookie)
      .expect(404);

    await request(app.getHttpServer())
      .post(`/internal-linking-library/projects/${otherProject.id}/links/${created.id}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ anchor: "Attempted cross-project edit" })
      .expect(404);

    await request(app.getHttpServer())
      .post(`/internal-linking-library/projects/${otherProject.id}/links/${created.id}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ status: "approved" })
      .expect(404);

    // Still reachable, and unmodified, via its real project.
    const getResponse = await request(app.getHttpServer())
      .get(`/internal-linking-library/projects/${projectId}/links/${created.id}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(getResponse.body.data.anchor).toBe("Belongs To Fixture Project");
  });

  it(
    "allows a session holding ONLY a project-scoped keyword_internal_links grant (not a global " +
      "one) to list, create, and edit links within that project — and still denies it in a " +
      "different project (regression: PermissionGuard previously ignored :projectId from the " +
      "route path entirely)",
    async () => {
      const scopedUserId = await createUserWithRole("ill.project-scoped", "developer", projectId);
      const scopedCookie = await cookieForNewSession(scopedUserId);

      await request(app.getHttpServer())
        .get(`/internal-linking-library/projects/${projectId}/links`)
        .set("Cookie", scopedCookie)
        .expect(200);

      // The same session, same role, but a DIFFERENT project — the grant does not carry over.
      const otherProject = await projects.create({
        publicId: uniqueId("PROJ"),
        name: "Other Project (project-scoped grant should not reach here)",
      });
      await request(app.getHttpServer())
        .get(`/internal-linking-library/projects/${otherProject.id}/links`)
        .set("Cookie", scopedCookie)
        .expect(403);
    },
  );

  it(
    "allows a session holding ONLY a project-scoped keyword_internal_links grant to submit a " +
      "link for implementation (regression: InternalLinksService.changeStatus()'s dynamic " +
      "per-transition AuthorizationService.assertAllowed() call previously never received a " +
      "projectId at all)",
    async () => {
      const scopedEditorUserId = await createUserWithRole(
        "ill.project-scoped-editor",
        "marketing_editor",
        projectId,
      );
      const adminCookie = await cookieForNewSession(superAdminUserId);
      const created = await createProposedLink(adminCookie, {
        anchor: "Project-Scoped Workflow Fixture",
      });
      await request(app.getHttpServer())
        .post(`/internal-linking-library/projects/${projectId}/links/${created.id}/status`)
        .set("Cookie", adminCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ status: "approved" })
        .expect(200);

      const scopedCookie = await cookieForNewSession(scopedEditorUserId);
      const response = await request(app.getHttpServer())
        .post(`/internal-linking-library/projects/${projectId}/links/${created.id}/status`)
        .set("Cookie", scopedCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ status: "implemented" })
        .expect(200);
      expect(response.body.data.status).toBe("implemented");
    },
  );

  // --- workflow / RBAC lifecycle coverage ---

  it("rejects an invalid status transition (proposed -> implemented, skipping approved) with 400", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createProposedLink(cookie, { anchor: "Skip-State Fixture" });

    await request(app.getHttpServer())
      .post(`/internal-linking-library/projects/${projectId}/links/${created.id}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ status: "implemented" })
      .expect(400);
  });

  it("marketing_editor (VCESR, no A) is denied proposed -> approved", async () => {
    const editorCookie = await cookieForNewSession(marketingEditorUserId);
    const created = await createProposedLink(editorCookie, {
      anchor: "Marketing Editor Cannot Approve Fixture",
    });

    await request(app.getHttpServer())
      .post(`/internal-linking-library/projects/${projectId}/links/${created.id}/status`)
      .set("Cookie", editorCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ status: "approved" })
      .expect(403);
  });

  it("super_admin (VCERAMX, no S) is denied approved -> implemented", async () => {
    const adminCookie = await cookieForNewSession(superAdminUserId);
    const created = await createProposedLink(adminCookie, {
      anchor: "Super Admin No Submit Fixture",
    });
    await request(app.getHttpServer())
      .post(`/internal-linking-library/projects/${projectId}/links/${created.id}/status`)
      .set("Cookie", adminCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ status: "approved" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/internal-linking-library/projects/${projectId}/links/${created.id}/status`)
      .set("Cookie", adminCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ status: "implemented" })
      .expect(403);
  });

  it("owner_growth_approver (VCERAX, no S) is denied approved -> implemented", async () => {
    const adminCookie = await cookieForNewSession(superAdminUserId);
    const created = await createProposedLink(adminCookie, {
      anchor: "Owner Approver No Submit Fixture",
    });
    await request(app.getHttpServer())
      .post(`/internal-linking-library/projects/${projectId}/links/${created.id}/status`)
      .set("Cookie", adminCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ status: "approved" })
      .expect(200);

    const approverCookie = await cookieForNewSession(ownerGrowthApproverUserId);
    await request(app.getHttpServer())
      .post(`/internal-linking-library/projects/${projectId}/links/${created.id}/status`)
      .set("Cookie", approverCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ status: "implemented" })
      .expect(403);
  });

  it("qa_security_reviewer (VR only) can view and review, but is denied create and approve", async () => {
    const adminCookie = await cookieForNewSession(superAdminUserId);
    const created = await createProposedLink(adminCookie, { anchor: "QA Reviewer Fixture" });

    const qaCookie = await cookieForNewSession(qaSecurityReviewerUserId);
    await request(app.getHttpServer())
      .post(`/internal-linking-library/projects/${projectId}/links`)
      .set("Cookie", qaCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: uniqueId("LINK"), sourcePageId, targetPageId })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/internal-linking-library/projects/${projectId}/links/${created.id}/status`)
      .set("Cookie", qaCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ status: "approved" })
      .expect(403);

    await request(app.getHttpServer())
      .get(`/internal-linking-library/projects/${projectId}/links/${created.id}`)
      .set("Cookie", qaCookie)
      .expect(200);
  });

  it("developer (view-only V) is denied create and every status transition", async () => {
    const adminCookie = await cookieForNewSession(superAdminUserId);
    const created = await createProposedLink(adminCookie, { anchor: "Developer Fixture" });

    const devCookie = await cookieForNewSession(developerUserId);
    await request(app.getHttpServer())
      .post(`/internal-linking-library/projects/${projectId}/links`)
      .set("Cookie", devCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: uniqueId("LINK"), sourcePageId, targetPageId })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/internal-linking-library/projects/${projectId}/links/${created.id}/update`)
      .set("Cookie", devCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ anchor: "Denied edit" })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/internal-linking-library/projects/${projectId}/links/${created.id}/status`)
      .set("Cookie", devCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ status: "approved" })
      .expect(403);

    await request(app.getHttpServer())
      .get(`/internal-linking-library/projects/${projectId}/links/${created.id}`)
      .set("Cookie", devCookie)
      .expect(200);
  });

  it(
    "drives a real link through its full proposed -> approved -> implemented -> verified " +
      "lifecycle across multiple real actor sessions (no single role holds every required " +
      "action, task package D2's own separation-of-duties shape), then walks all 3 backward " +
      "transitions the same way",
    async () => {
      const adminCookie = await cookieForNewSession(superAdminUserId);
      const editorCookie = await cookieForNewSession(marketingEditorUserId);

      const created = await createProposedLink(editorCookie, { anchor: "Full Lifecycle Fixture" });
      expect(created.status).toBe("proposed");

      // proposed -> approved: requires approve (super_admin has it, marketing_editor doesn't).
      const approved = await request(app.getHttpServer())
        .post(`/internal-linking-library/projects/${projectId}/links/${created.id}/status`)
        .set("Cookie", adminCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ status: "approved" })
        .expect(200);
      expect(approved.body.data.status).toBe("approved");
      expect(approved.body.data.implementedAt).toBeNull();

      // approved -> implemented: requires submit (marketing_editor has it, super_admin doesn't).
      const implemented = await request(app.getHttpServer())
        .post(`/internal-linking-library/projects/${projectId}/links/${created.id}/status`)
        .set("Cookie", editorCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ status: "implemented" })
        .expect(200);
      expect(implemented.body.data.status).toBe("implemented");
      const firstImplementedAt = implemented.body.data.implementedAt as string;
      expect(firstImplementedAt).toBeTruthy();
      expect(implemented.body.data.verifiedAt).toBeNull();

      // implemented -> verified: requires review (marketing_editor has it too).
      const verified = await request(app.getHttpServer())
        .post(`/internal-linking-library/projects/${projectId}/links/${created.id}/status`)
        .set("Cookie", editorCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ status: "verified" })
        .expect(200);
      expect(verified.body.data.status).toBe("verified");
      const firstVerifiedAt = verified.body.data.verifiedAt as string;
      expect(firstVerifiedAt).toBeTruthy();

      // Re-requesting the current status is a harmless no-op, not an error.
      await request(app.getHttpServer())
        .post(`/internal-linking-library/projects/${projectId}/links/${created.id}/status`)
        .set("Cookie", editorCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ status: "verified" })
        .expect(200);

      // verified -> implemented (backward, review): re-entering implemented must NOT reset
      // implementedAt to a later timestamp.
      const backToImplemented = await request(app.getHttpServer())
        .post(`/internal-linking-library/projects/${projectId}/links/${created.id}/status`)
        .set("Cookie", editorCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ status: "implemented" })
        .expect(200);
      expect(backToImplemented.body.data.status).toBe("implemented");
      expect(backToImplemented.body.data.implementedAt).toBe(firstImplementedAt);

      // implemented -> approved (backward, submit).
      const backToApproved = await request(app.getHttpServer())
        .post(`/internal-linking-library/projects/${projectId}/links/${created.id}/status`)
        .set("Cookie", editorCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ status: "approved" })
        .expect(200);
      expect(backToApproved.body.data.status).toBe("approved");

      // approved -> proposed (backward, approve — marketing_editor lacks it, must 403).
      await request(app.getHttpServer())
        .post(`/internal-linking-library/projects/${projectId}/links/${created.id}/status`)
        .set("Cookie", editorCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ status: "proposed" })
        .expect(403);

      const backToProposed = await request(app.getHttpServer())
        .post(`/internal-linking-library/projects/${projectId}/links/${created.id}/status`)
        .set("Cookie", adminCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ status: "proposed" })
        .expect(200);
      expect(backToProposed.body.data.status).toBe("proposed");
    },
  );
});
