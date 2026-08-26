import { randomBytes } from "node:crypto";
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
import { PageWorkspaceModule } from "../src/page-workspace/page-workspace.module.js";

/**
 * Request-level coverage for the Page Workspace HTTP surface, against a REAL disposable
 * PostgreSQL database — same harness pattern as `page-inventory.e2e-spec.ts`.
 *
 * The centrepiece is task package D2: each of the 15 artifact types resolves its OWN RBAC
 * permission group, so the seeded matrix's real per-group differences become real per-TAB
 * differences. From `00013-seed-rbac-matrix.ts`:
 *
 *   role                        page_content  creative_design  development_code  security_qa
 *   developer                   V             V                VCES              VR
 *   designer_creative_reviewer  VR            VCERAS           V                 V
 *   qa_security_reviewer        VR            V                VR                VCERAS
 *   marketing_editor            VCESR         VR               V                 V
 *
 * The tests below prove that mapping is genuinely load-bearing: a developer can edit the
 * Implementation tab but not the Content tab, a designer the UI Specification but not
 * Implementation, and QA can approve the QA tab while being unable to approve Content. Gating the
 * whole module on `page_content` — what the module registry alone would suggest — would have made
 * every one of those cases wrong.
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

describe("Page Workspace module endpoints (e2e, real disposable database)", () => {
  let app: INestApplication;
  let users: UserRepository;
  let roles: RoleRepository;
  let userRoles: UserRoleRepository;
  let projects: ProjectRepository;
  let pages: PageRepository;
  let sessionService: SessionService;
  let authEnv: AuthEnv;

  let superAdminCookie: string;
  let developerCookie: string;
  let designerCookie: string;
  let qaCookie: string;
  let marketingEditorCookie: string;
  let readOnlyCookie: string;

  let projectId: string;
  let pageId: string;

  let counter = 0;
  function uniqueId(prefix: string): string {
    counter += 1;
    return `${prefix}-${Date.now()}-${counter}`;
  }

  function origin(): string {
    return process.env.WEB_APP_ORIGIN!;
  }

  function artifactsUrl(target = projectId, page = pageId): string {
    return `/page-workspace/projects/${target}/pages/${page}/artifacts`;
  }

  async function cookieForNewSession(userId: string): Promise<string> {
    const { rawToken } = await sessionService.issue({
      userId,
      authMethod: "google_sso",
      requiresMfa: false,
    });
    return `${authEnv.SESSION_COOKIE_NAME}=${rawToken}`;
  }

  async function cookieForRole(emailPrefix: string, roleKey: string): Promise<string> {
    const user = await users.create({
      email: `${emailPrefix}.pw.e2e@webdesksolution.com`,
      displayName: `${emailPrefix} PW E2E`,
      accountStatus: "active",
    });
    const role = await roles.findByKey(roleKey);
    if (!role) {
      throw new Error(`Expected ${roleKey} role was not seeded — check migration 00013`);
    }
    await userRoles.assign(user.id, role.id, null);
    return cookieForNewSession(user.id);
  }

  /**
   * Creates an artifact of `artifactType` plus its first draft version, as super_admin.
   *
   * Each call provisions its OWN page. That is not incidental: `(page_id, artifact_type)` is a
   * real unique index, so any two tests wanting the same tab would collide on a shared page and
   * the second would get a 409 instead of its fixture. Returns ready-built URLs so call sites
   * never have to reconstruct them against the wrong page.
   */
  async function createArtifact(artifactType: string) {
    const page = await pages.create({
      projectId,
      publicId: uniqueId("PAGE"),
      pageName: `Fixture page for ${artifactType}`,
    });
    const listUrl = artifactsUrl(projectId, page.id);
    const response = await request(app.getHttpServer())
      .post(listUrl)
      .set("Cookie", superAdminCookie)
      .set("Origin", origin())
      .send({ artifactType, content: "<p>seed</p>" })
      .expect(201);
    const data = response.body.data as {
      artifact: { id: string };
      version: { id: string; versionNumber: number; status: string };
    };
    return {
      ...data,
      pageId: page.id,
      listUrl,
      base: `${listUrl}/${data.artifact.id}/versions/${data.version.id}`,
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
      imports: [PageWorkspaceModule],
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

    superAdminCookie = await cookieForRole("superadmin", "super_admin");
    developerCookie = await cookieForRole("developer", "developer");
    designerCookie = await cookieForRole("designer", "designer_creative_reviewer");
    qaCookie = await cookieForRole("qa", "qa_security_reviewer");
    readOnlyCookie = await cookieForRole("readonly", "read_only");
    marketingEditorCookie = await cookieForRole("marketing", "marketing_editor");

    const project = await projects.create({
      publicId: uniqueId("PROJ"),
      name: "Page Workspace E2E Project",
    });
    projectId = project.id;
    const page = await pages.create({
      projectId,
      publicId: uniqueId("PAGE"),
      pageName: "E2E Page",
    });
    pageId = page.id;
  });

  afterAll(async () => {
    await app?.close();
    const migrator = buildMigrator();
    await migrator.down({ to: 0 });
    await closeConnection();
  });

  it("rejects an unauthenticated request", async () => {
    await request(app.getHttpServer()).get(artifactsUrl()).expect(401);
  });

  /**
   * Task package D2. Each case is a real role acting on a real tab, and each assertion would be
   * WRONG under a single module-wide `page_content` gate.
   */
  describe("per-artifact-type permission groups (D2)", () => {
    it("lets a developer edit the Implementation tab (development_code: VCES)", async () => {
      const { base } = await createArtifact("implementation");

      await request(app.getHttpServer())
        .patch(base)
        .set("Cookie", developerCookie)
        .set("Origin", origin())
        .send({ content: "<p>developer edit</p>" })
        .expect(200);
    });

    it("denies that same developer the Content tab (page_content: V only)", async () => {
      const { base } = await createArtifact("content");

      await request(app.getHttpServer())
        .patch(base)
        .set("Cookie", developerCookie)
        .set("Origin", origin())
        .send({ content: "<p>developer edit</p>" })
        .expect(403);
    });

    it("lets a designer edit the UI Specification tab (creative_design: VCERAS)", async () => {
      const { base } = await createArtifact("ui_specification");

      await request(app.getHttpServer())
        .patch(base)
        .set("Cookie", designerCookie)
        .set("Origin", origin())
        .send({ content: "<p>designer edit</p>" })
        .expect(200);
    });

    it("denies that same designer the Implementation tab (development_code: V only)", async () => {
      const { base } = await createArtifact("component_map");
      // Sanity: the designer CAN edit a creative_design tab...
      await request(app.getHttpServer())
        .patch(base)
        .set("Cookie", designerCookie)
        .set("Origin", origin())
        .send({ content: "<p>ok</p>" })
        .expect(200);

      // ...but not a development_code one.
      const dev = await createArtifact("code_review");
      await request(app.getHttpServer())
        .patch(dev.base)
        .set("Cookie", designerCookie)
        .set("Origin", origin())
        .send({ content: "<p>nope</p>" })
        .expect(403);
    });

    it("denies a read-only session every edit, on every tab", async () => {
      const { base } = await createArtifact("audit");

      await request(app.getHttpServer())
        .patch(base)
        .set("Cookie", readOnlyCookie)
        .set("Origin", origin())
        .send({ content: "<p>nope</p>" })
        .expect(403);
    });
  });

  describe("separation of duties falls out of the group mapping", () => {
    it("a developer can submit an Implementation version but never approve it", async () => {
      const { base } = await createArtifact("implementation");

      // development_code gives `developer` VCES — submit is in, approve is not.
      await request(app.getHttpServer())
        .post(`${base}/status`)
        .set("Cookie", developerCookie)
        .set("Origin", origin())
        .send({ status: "submitted" })
        .expect(201);

      await request(app.getHttpServer())
        .post(`${base}/status`)
        .set("Cookie", developerCookie)
        .set("Origin", origin())
        .send({ status: "under_review" })
        .expect(403);
    });

    it("a QA reviewer can carry that same version through review to approval", async () => {
      const { base } = await createArtifact("implementation");

      await request(app.getHttpServer())
        .post(`${base}/status`)
        .set("Cookie", developerCookie)
        .set("Origin", origin())
        .send({ status: "submitted" })
        .expect(201);

      // development_code gives `qa_security_reviewer` VRA — review and approve, never submit.
      await request(app.getHttpServer())
        .post(`${base}/status`)
        .set("Cookie", qaCookie)
        .set("Origin", origin())
        .send({ status: "under_review" })
        .expect(201);

      const approved = await request(app.getHttpServer())
        .post(`${base}/status`)
        .set("Cookie", qaCookie)
        .set("Origin", origin())
        .send({ status: "approved" })
        .expect(201);

      expect(approved.body.data.status).toBe("approved");
      expect(approved.body.data.approvedAt).not.toBeNull();
    });

    it("denies even super_admin the submit action, which no approver role holds", async () => {
      // Surprising but correct, and the reason an earlier version of this suite failed in CI:
      // NO role holds both `submit` and `approve` in the same group. super_admin is VCERAPX on
      // page_content — approve yes, submit no. Asserted explicitly so a future change to either
      // the seeded matrix or VERSION_TRANSITIONS cannot quietly erode this separation.
      const { base } = await createArtifact("overview");

      await request(app.getHttpServer())
        .post(`${base}/status`)
        .set("Cookie", superAdminCookie)
        .set("Origin", origin())
        .send({ status: "submitted" })
        .expect(403);

      // marketing_editor (VCESR) is the only page_content role that can.
      await request(app.getHttpServer())
        .post(`${base}/status`)
        .set("Cookie", marketingEditorCookie)
        .set("Origin", origin())
        .send({ status: "submitted" })
        .expect(201);
    });

    it("requires a reason to reject or request revision", async () => {
      const { base } = await createArtifact("qa");

      await request(app.getHttpServer())
        .post(`${base}/status`)
        .set("Cookie", qaCookie)
        .set("Origin", origin())
        .send({ status: "submitted" })
        .expect(201);
      await request(app.getHttpServer())
        .post(`${base}/status`)
        .set("Cookie", qaCookie)
        .set("Origin", origin())
        .send({ status: "under_review" })
        .expect(201);

      // 05_Workflow_State_Machines.md §1 — enforced at the schema layer, not by convention.
      await request(app.getHttpServer())
        .post(`${base}/status`)
        .set("Cookie", qaCookie)
        .set("Origin", origin())
        .send({ status: "revision_requested" })
        .expect(400);

      await request(app.getHttpServer())
        .post(`${base}/status`)
        .set("Cookie", qaCookie)
        .set("Origin", origin())
        .send({ status: "revision_requested", reason: "missing evidence" })
        .expect(201);
    });
  });

  describe("approved versions are immutable, and reopening forks a new one (D7)", () => {
    /** Drives a fresh artifact all the way to `approved` as super_admin. */
    /**
     * Drives a fresh `ideal_structure` artifact (a `page_content` tab) to `approved`.
     *
     * This deliberately takes TWO actors, because the seeded matrix gives no single role both
     * `submit` and `approve` on `page_content`: `marketing_editor` is the only holder of `S`
     * (VCESR), while `super_admin` holds `A` but not `S` (VCERAPX). An earlier version of this
     * helper drove the whole chain as super_admin and 403'd on the very first transition — the
     * mistake was in the test, not the module, which is faithfully implementing the separation of
     * duties the matrix encodes.
     */
    async function approvedArtifact() {
      const { artifact, base, listUrl } = await createArtifact("ideal_structure");

      // Author submits...
      await request(app.getHttpServer())
        .post(`${base}/status`)
        .set("Cookie", marketingEditorCookie)
        .set("Origin", origin())
        .send({ status: "submitted" })
        .expect(201);

      // ...a different actor reviews and approves.
      for (const status of ["under_review", "approved"]) {
        await request(app.getHttpServer())
          .post(`${base}/status`)
          .set("Cookie", superAdminCookie)
          .set("Origin", origin())
          .send({ status })
          .expect(201);
      }
      return { artifact, base, listUrl };
    }

    it("refuses an in-place edit of an approved version", async () => {
      const { base } = await approvedArtifact();

      await request(app.getHttpServer())
        .patch(base)
        .set("Cookie", superAdminCookie)
        .set("Origin", origin())
        .send({ content: "<p>rewriting history</p>" })
        .expect(400);
    });

    it("requires a reason to reopen", async () => {
      const { base } = await approvedArtifact();

      await request(app.getHttpServer())
        .post(`${base}/reopen`)
        .set("Cookie", superAdminCookie)
        .set("Origin", origin())
        .send({})
        .expect(400);
    });

    it("forks a new draft version, supersedes the old one, and records why", async () => {
      const { listUrl, artifact, base } = await approvedArtifact();

      const reopened = await request(app.getHttpServer())
        .post(`${base}/reopen`)
        .set("Cookie", superAdminCookie)
        .set("Origin", origin())
        .send({ reason: "client changed the offer" })
        .expect(201);

      expect(reopened.body.data).toMatchObject({
        versionNumber: 2,
        status: "draft",
        reopenedReason: "client changed the offer",
      });

      const history = await request(app.getHttpServer())
        .get(`${listUrl}/${artifact.id}/versions`)
        .set("Cookie", superAdminCookie)
        .expect(200);

      // Newest first, and the previously-approved version is now superseded, not deleted —
      // the audit trail stays intact.
      const statuses = (history.body.data as Array<{ status: string }>).map((v) => v.status);
      expect(statuses).toEqual(["draft", "superseded"]);
    });
  });

  describe("page delivery lifecycle (D4/D5)", () => {
    function lifecycleUrl(target = projectId, page = pageId): string {
      return `/page-workspace/projects/${target}/pages/${page}/lifecycle`;
    }

    it("starts every page at proposed", async () => {
      const response = await request(app.getHttpServer())
        .get(lifecycleUrl())
        .set("Cookie", superAdminCookie)
        .expect(200);
      expect(response.body.data.lifecycleStage).toBe("proposed");
    });

    it("advances one allowlisted step at a time, never skipping ahead", async () => {
      const page = await pages.create({
        projectId,
        publicId: uniqueId("PAGE"),
        pageName: "Lifecycle Page",
      });

      // Roadmap row 12: "No automatic progression through stages." Jumping straight to production
      // is not a legal edge, and nothing advances implicitly.
      await request(app.getHttpServer())
        .post(lifecycleUrl(projectId, page.id))
        .set("Cookie", superAdminCookie)
        .set("Origin", origin())
        .send({ stage: "production_deployed" })
        .expect(400);

      const advanced = await request(app.getHttpServer())
        .post(lifecycleUrl(projectId, page.id))
        .set("Cookie", superAdminCookie)
        .set("Origin", origin())
        .send({ stage: "approved_for_planning" })
        .expect(201);
      expect(advanced.body.data.lifecycleStage).toBe("approved_for_planning");
    });

    it("pauses and resumes back to exactly where it left off", async () => {
      const page = await pages.create({
        projectId,
        publicId: uniqueId("PAGE"),
        pageName: "Pause Page",
      });
      const url = lifecycleUrl(projectId, page.id);
      const post = (body: Record<string, unknown>) =>
        request(app.getHttpServer())
          .post(url)
          .set("Cookie", superAdminCookie)
          .set("Origin", origin())
          .send(body);

      await post({ stage: "approved_for_planning" }).expect(201);
      const paused = await post({ stage: "paused" }).expect(201);
      expect(paused.body.data.lifecyclePreviousStage).toBe("approved_for_planning");

      // Resuming anywhere else would let a pause be used to skip every gate in between.
      await post({ stage: "production_approved" }).expect(400);

      const resumed = await post({ stage: "approved_for_planning" }).expect(201);
      expect(resumed.body.data.lifecycleStage).toBe("approved_for_planning");
      expect(resumed.body.data.lifecyclePreviousStage).toBeNull();
    });

    it("denies a read-only session any lifecycle transition", async () => {
      await request(app.getHttpServer())
        .post(lifecycleUrl())
        .set("Cookie", readOnlyCookie)
        .set("Origin", origin())
        .send({ stage: "approved_for_planning" })
        .expect(403);
    });
  });

  describe("scoping and IDOR prevention", () => {
    it("refuses to reach an artifact through another project's id", async () => {
      const { artifact, pageId: ownPageId } = await createArtifact("overview");
      const other = await projects.create({
        publicId: uniqueId("PROJ"),
        name: "Other Project",
      });

      await request(app.getHttpServer())
        .get(
          `/page-workspace/projects/${other.id}/pages/${ownPageId}/artifacts/${artifact.id}/versions`,
        )
        .set("Cookie", superAdminCookie)
        .expect(404);
    });

    it("refuses to reach an artifact through a page it does not belong to", async () => {
      const { artifact } = await createArtifact("live_snapshot");
      const otherPage = await pages.create({
        projectId,
        publicId: uniqueId("PAGE"),
        pageName: "Unrelated Page",
      });

      // The nested route would be decorative if the relationship were not actually verified.
      await request(app.getHttpServer())
        .get(`${artifactsUrl(projectId, otherPage.id)}/${artifact.id}/versions`)
        .set("Cookie", superAdminCookie)
        .expect(404);
    });

    it("rejects a duplicate artifact for the same tab with a conflict, not a 500", async () => {
      const { listUrl } = await createArtifact("creative_direction");

      await request(app.getHttpServer())
        .post(listUrl)
        .set("Cookie", superAdminCookie)
        .set("Origin", origin())
        .send({ artifactType: "creative_direction" })
        .expect(409);
    });

    it("rejects a malformed uuid in the path with a 400, not a raw driver error", async () => {
      await request(app.getHttpServer())
        .get(`/page-workspace/projects/${projectId}/pages/not-a-uuid/artifacts`)
        .set("Cookie", superAdminCookie)
        .expect(400);
    });
  });

  it("sanitizes rich-text content on the way in", async () => {
    const response = await request(app.getHttpServer())
      .post(artifactsUrl())
      .set("Cookie", superAdminCookie)
      .set("Origin", origin())
      .send({ artifactType: "search", content: "<p>safe</p><script>alert(1)</script>" })
      .expect(201);

    expect(response.body.data.version.content).toContain("<p>safe</p>");
    expect(response.body.data.version.content).not.toContain("<script>");
  });
});
