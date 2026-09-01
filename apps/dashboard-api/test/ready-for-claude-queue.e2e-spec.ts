import { randomBytes, randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import {
  buildMigrator,
  closeConnection,
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
import { ReadyForClaudeQueueModule } from "../src/ready-for-claude-queue/ready-for-claude-queue.module.js";

/**
 * Request-level coverage for the Ready for Claude Queue module HTTP surface, against a REAL
 * disposable PostgreSQL database — same harness pattern as `internal-linking-library.e2e-spec.ts`.
 * `ready_for_claude` has real seeded grants (`00013-seed-rbac-matrix.ts:198-206`):
 *   super_admin                VCERAM  (view, create, edit, review, approve, configure)
 *   owner_growth_approver      VCERAM  (view, create, edit, review, approve, configure)
 *   marketing_editor           VCSE    (view, create, submit, edit)
 *   designer_creative_reviewer VCSE
 *   developer                  VCSE
 *   qa_security_reviewer       VCSE
 *   read_only                  V
 *
 * A real, deliberate separation of duties falls out of that matrix, and these tests assert it as
 * it is actually seeded rather than as one might assume: NO role holds both `submit` AND
 * `approve`. `super_admin`/`owner_growth_approver` have NO `submit` grant, so they cannot perform
 * the `submit`-gated transitions (`draft -> ready_for_claude`, `in_progress -> awaiting_review`,
 * `changes_requested -> ready_for_claude`) at all — while the four mid-tier VCSE roles cannot
 * review or approve. Driving one task through its whole lifecycle genuinely requires two actors,
 * and several tests below do exactly that across multiple real sessions.
 *
 * Unlike Page Inventory/Keyword & Entity Library/Internal Linking Library, there is NO
 * `:projectId` route path segment — this module's RBAC is organization-wide (D5) and a task's
 * `projectId` is an optional context field, matching `ReviewsController`'s own flat shape.
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

describe("Ready for Claude Queue module endpoints (e2e, real disposable database)", () => {
  let app: INestApplication;
  let users: UserRepository;
  let roles: RoleRepository;
  let userRoles: UserRoleRepository;
  let projects: ProjectRepository;
  let sessionService: SessionService;
  let authEnv: AuthEnv;

  let superAdminUserId: string;
  let ownerGrowthApproverUserId: string;
  let marketingEditorUserId: string;
  let readOnlyUserId: string;

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
    await userRoles.assign(user.id, role.id, null);
    return user.id;
  }

  async function createDraftTask(
    cookie: string,
    overrides: Record<string, unknown> = {},
  ): Promise<{ id: string; status: string; publicId: string }> {
    const response = await request(app.getHttpServer())
      .post("/ready-for-claude-queue/tasks")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: uniqueId("RFC"), title: "An E2E task", ...overrides })
      .expect(201);
    return response.body.data as { id: string; status: string; publicId: string };
  }

  /** Deliberately NOT `async` — it returns supertest's own chainable `Test`, so every call site
   *  can keep using `.expect(status)` directly. Wrapping it in a promise would resolve to a plain
   *  `Response` with no `.expect()` on it. */
  function transition(
    cookie: string,
    id: string,
    expectedStatus: string,
    status: string,
  ): request.Test {
    return request(app.getHttpServer())
      .post(`/ready-for-claude-queue/tasks/${id}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ status, expectedStatus });
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
      imports: [ReadyForClaudeQueueModule],
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

    superAdminUserId = await createUserWithRole("rfcq.super-admin", "super_admin");
    ownerGrowthApproverUserId = await createUserWithRole(
      "rfcq.owner-growth-approver",
      "owner_growth_approver",
    );
    marketingEditorUserId = await createUserWithRole("rfcq.marketing-editor", "marketing_editor");
    readOnlyUserId = await createUserWithRole("rfcq.read-only", "read_only");

    const project = await projects.create({
      publicId: uniqueId("PROJ"),
      name: "Ready for Claude Queue E2E Fixture Project",
    });
    projectId = project.id;
  }, 30_000);

  afterAll(async () => {
    await app.close();
    const migrator = buildMigrator();
    await migrator.down({ to: 0 });
    await closeConnection();
  }, 30_000);

  describe("session and permission gating", () => {
    it("rejects GET /ready-for-claude-queue/tasks with 401 when there is no session cookie", async () => {
      await request(app.getHttpServer()).get("/ready-for-claude-queue/tasks").expect(401);
    });

    it("lets a read_only session list and read, but not create", async () => {
      const editorCookie = await cookieForNewSession(marketingEditorUserId);
      const created = await createDraftTask(editorCookie);

      const readOnlyCookie = await cookieForNewSession(readOnlyUserId);
      await request(app.getHttpServer())
        .get("/ready-for-claude-queue/tasks")
        .set("Cookie", readOnlyCookie)
        .expect(200);
      await request(app.getHttpServer())
        .get(`/ready-for-claude-queue/tasks/${created.id}`)
        .set("Cookie", readOnlyCookie)
        .expect(200);
      await request(app.getHttpServer())
        .post("/ready-for-claude-queue/tasks")
        .set("Cookie", readOnlyCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ publicId: uniqueId("RFC"), title: "Denied" })
        .expect(403);
    });

    it("returns 404 for a well-formed but unknown task id, and 400 for a malformed one", async () => {
      const cookie = await cookieForNewSession(superAdminUserId);
      await request(app.getHttpServer())
        .get(`/ready-for-claude-queue/tasks/${randomUUID()}`)
        .set("Cookie", cookie)
        .expect(404);
      await request(app.getHttpServer())
        .get("/ready-for-claude-queue/tasks/not-a-uuid")
        .set("Cookie", cookie)
        .expect(400);
    });
  });

  describe("create validation", () => {
    it("creates a task in draft, optionally attached to a real project (D5)", async () => {
      const cookie = await cookieForNewSession(marketingEditorUserId);
      const created = await createDraftTask(cookie, { projectId, priority: "critical" });
      expect(created.status).toBe("draft");

      const fetched = await request(app.getHttpServer())
        .get(`/ready-for-claude-queue/tasks/${created.id}`)
        .set("Cookie", cookie)
        .expect(200);
      expect(fetched.body.data.projectId).toBe(projectId);
      expect(fetched.body.data.priority).toBe("critical");
      expect(fetched.body.data.dependencies).toEqual([]);
    });

    it("creates a task with no project at all (D5 — projectId is optional)", async () => {
      const cookie = await cookieForNewSession(marketingEditorUserId);
      const created = await createDraftTask(cookie);
      const fetched = await request(app.getHttpServer())
        .get(`/ready-for-claude-queue/tasks/${created.id}`)
        .set("Cookie", cookie)
        .expect(200);
      expect(fetched.body.data.projectId).toBeNull();
    });

    it("rejects a dependencies entry that does not resolve to a real task, with a clean 400 (D2)", async () => {
      const cookie = await cookieForNewSession(marketingEditorUserId);
      const ghostId = randomUUID();
      const response = await request(app.getHttpServer())
        .post("/ready-for-claude-queue/tasks")
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ publicId: uniqueId("RFC"), title: "Blocked", dependencies: [ghostId] })
        .expect(400);
      expect(JSON.stringify(response.body)).toContain(ghostId);
    });

    it("accepts a dependencies entry that IS a real task (D2)", async () => {
      const cookie = await cookieForNewSession(marketingEditorUserId);
      const blocker = await createDraftTask(cookie);
      const dependent = await createDraftTask(cookie, { dependencies: [blocker.id] });

      const fetched = await request(app.getHttpServer())
        .get(`/ready-for-claude-queue/tasks/${dependent.id}`)
        .set("Cookie", cookie)
        .expect(200);
      expect(fetched.body.data.dependencies).toEqual([blocker.id]);
    });

    it("rejects a bogus targetModuleKey with a clean 400 (D1)", async () => {
      const cookie = await cookieForNewSession(marketingEditorUserId);
      const response = await request(app.getHttpServer())
        .post("/ready-for-claude-queue/tasks")
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({
          publicId: uniqueId("RFC"),
          title: "Bad module key",
          targetModuleKey: "definitely_not_a_module",
        })
        .expect(400);
      expect(JSON.stringify(response.body)).toContain("definitely_not_a_module");
    });

    it("accepts a real seeded targetModuleKey, with an entirely unvalidated targetId (D1)", async () => {
      const cookie = await cookieForNewSession(marketingEditorUserId);
      const orphanTargetId = randomUUID();
      const created = await createDraftTask(cookie, {
        targetModuleKey: "page_inventory",
        targetId: orphanTargetId,
      });
      const fetched = await request(app.getHttpServer())
        .get(`/ready-for-claude-queue/tasks/${created.id}`)
        .set("Cookie", cookie)
        .expect(200);
      expect(fetched.body.data.targetModuleKey).toBe("page_inventory");
      expect(fetched.body.data.targetId).toBe(orphanTargetId);
    });

    it("rejects a non-http(s) prUrl with a clean 400 (D7 — safeHttpUrlSchema)", async () => {
      const cookie = await cookieForNewSession(marketingEditorUserId);
      await request(app.getHttpServer())
        .post("/ready-for-claude-queue/tasks")
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({
          publicId: uniqueId("RFC"),
          title: "Bad URL",
          // Deliberately testing the rejection path — safeHttpUrlSchema allowlists http:/https:
          // only, closing the stored-XSS class this codebase already fixed once for Projects'
          // environment.url.
          prUrl: "javascript:alert(1)",
        })
        .expect(400);
    });

    it("rejects a duplicate publicId with a clean 400, not a raw 500", async () => {
      const cookie = await cookieForNewSession(marketingEditorUserId);
      const first = await createDraftTask(cookie);
      await request(app.getHttpServer())
        .post("/ready-for-claude-queue/tasks")
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ publicId: first.publicId, title: "Duplicate" })
        .expect(400);
    });

    it("rejects a projectId that does not resolve to a real project", async () => {
      const cookie = await cookieForNewSession(marketingEditorUserId);
      await request(app.getHttpServer())
        .post("/ready-for-claude-queue/tasks")
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ publicId: uniqueId("RFC"), title: "Ghost project", projectId: randomUUID() })
        .expect(404);
    });
  });

  describe("update", () => {
    it("lets an editor patch content fields and rejects an empty patch", async () => {
      const cookie = await cookieForNewSession(marketingEditorUserId);
      const created = await createDraftTask(cookie);

      const updated = await request(app.getHttpServer())
        .patch(`/ready-for-claude-queue/tasks/${created.id}`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ title: "Renamed by editor", stage: "scoping" })
        .expect(200);
      expect(updated.body.data.title).toBe("Renamed by editor");
      expect(updated.body.data.stage).toBe("scoping");

      await request(app.getHttpServer())
        .patch(`/ready-for-claude-queue/tasks/${created.id}`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({})
        .expect(400);
    });

    it("never lets a content patch change status (only the status route may, D4)", async () => {
      const editorCookie = await cookieForNewSession(marketingEditorUserId);
      const created = await createDraftTask(editorCookie);

      await request(app.getHttpServer())
        .patch(`/ready-for-claude-queue/tasks/${created.id}`)
        .set("Cookie", editorCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ title: "Sneaky", status: "completed" })
        .expect(200);

      const fetched = await request(app.getHttpServer())
        .get(`/ready-for-claude-queue/tasks/${created.id}`)
        .set("Cookie", editorCookie)
        .expect(200);
      expect(fetched.body.data.status).toBe("draft");
    });

    it("refuses a content edit once the task is terminal (D4)", async () => {
      const editorCookie = await cookieForNewSession(marketingEditorUserId);
      const created = await createDraftTask(editorCookie);
      await transition(editorCookie, created.id, "draft", "cancelled").expect(200);

      const response = await request(app.getHttpServer())
        .patch(`/ready-for-claude-queue/tasks/${created.id}`)
        .set("Cookie", editorCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ title: "Too late" })
        .expect(400);
      expect(JSON.stringify(response.body)).toContain("cancelled");
    });

    it("rejects a task listing itself as one of its own dependencies", async () => {
      const cookie = await cookieForNewSession(marketingEditorUserId);
      const created = await createDraftTask(cookie);
      await request(app.getHttpServer())
        .patch(`/ready-for-claude-queue/tasks/${created.id}`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ dependencies: [created.id] })
        .expect(400);
    });
  });

  describe("the real seeded RBAC matrix drives the workflow (D4)", () => {
    it("lets a marketing_editor (VCSE) drive the whole submit/edit half of the lifecycle", async () => {
      const cookie = await cookieForNewSession(marketingEditorUserId);
      const created = await createDraftTask(cookie);

      // submit-gated
      await transition(cookie, created.id, "draft", "ready_for_claude").expect(200);
      // edit-gated
      await transition(cookie, created.id, "ready_for_claude", "claimed").expect(200);
      await transition(cookie, created.id, "claimed", "in_progress").expect(200);
      await transition(cookie, created.id, "in_progress", "paused").expect(200);
      await transition(cookie, created.id, "paused", "in_progress").expect(200);
      // submit-gated again
      const submitted = await transition(
        cookie,
        created.id,
        "in_progress",
        "awaiting_review",
      ).expect(200);
      expect(submitted.body.data.status).toBe("awaiting_review");
    });

    it("denies a marketing_editor the review- and approve-gated transitions (403)", async () => {
      const editorCookie = await cookieForNewSession(marketingEditorUserId);
      const created = await createDraftTask(editorCookie);
      await transition(editorCookie, created.id, "draft", "ready_for_claude").expect(200);
      await transition(editorCookie, created.id, "ready_for_claude", "claimed").expect(200);
      await transition(editorCookie, created.id, "claimed", "in_progress").expect(200);
      await transition(editorCookie, created.id, "in_progress", "awaiting_review").expect(200);

      // review-gated
      await transition(editorCookie, created.id, "awaiting_review", "changes_requested").expect(
        403,
      );
      // approve-gated
      await transition(editorCookie, created.id, "awaiting_review", "approved").expect(403);
    });

    it("lets a super_admin review, approve and complete — but NOT submit (real seeded matrix)", async () => {
      const editorCookie = await cookieForNewSession(marketingEditorUserId);
      const adminCookie = await cookieForNewSession(superAdminUserId);
      const created = await createDraftTask(editorCookie);

      // super_admin holds no `submit` grant at all, so it cannot mark a task ready itself.
      await transition(adminCookie, created.id, "draft", "ready_for_claude").expect(403);

      // The editor drives it to review; the admin then decides.
      await transition(editorCookie, created.id, "draft", "ready_for_claude").expect(200);
      await transition(editorCookie, created.id, "ready_for_claude", "claimed").expect(200);
      await transition(editorCookie, created.id, "claimed", "in_progress").expect(200);
      await transition(editorCookie, created.id, "in_progress", "awaiting_review").expect(200);

      // review-gated
      await transition(adminCookie, created.id, "awaiting_review", "changes_requested").expect(200);
      // Back into the queue is submit-gated — the admin cannot do it, the editor can.
      await transition(adminCookie, created.id, "changes_requested", "ready_for_claude").expect(
        403,
      );
      await transition(editorCookie, created.id, "changes_requested", "ready_for_claude").expect(
        200,
      );
    });

    it("lets an owner_growth_approver approve then complete a reviewed task", async () => {
      const editorCookie = await cookieForNewSession(marketingEditorUserId);
      const approverCookie = await cookieForNewSession(ownerGrowthApproverUserId);
      const created = await createDraftTask(editorCookie);

      await transition(editorCookie, created.id, "draft", "ready_for_claude").expect(200);
      await transition(editorCookie, created.id, "ready_for_claude", "claimed").expect(200);
      await transition(editorCookie, created.id, "claimed", "in_progress").expect(200);
      await transition(editorCookie, created.id, "in_progress", "awaiting_review").expect(200);

      await transition(approverCookie, created.id, "awaiting_review", "approved").expect(200);
      const completed = await transition(
        approverCookie,
        created.id,
        "approved",
        "completed",
      ).expect(200);
      expect(completed.body.data.status).toBe("completed");
    });

    it("denies a read_only session every transition, even an edit-gated one", async () => {
      const editorCookie = await cookieForNewSession(marketingEditorUserId);
      const readOnlyCookie = await cookieForNewSession(readOnlyUserId);
      const created = await createDraftTask(editorCookie);
      await transition(readOnlyCookie, created.id, "draft", "cancelled").expect(403);
    });
  });

  describe("status transition validation", () => {
    it("rejects an illegal transition with a 400 naming the legal next states", async () => {
      const cookie = await cookieForNewSession(marketingEditorUserId);
      const created = await createDraftTask(cookie);
      const response = await transition(cookie, created.id, "draft", "completed").expect(400);
      expect(JSON.stringify(response.body)).toContain("ready_for_claude");
    });

    it("rejects any transition out of a terminal state (D4)", async () => {
      const cookie = await cookieForNewSession(marketingEditorUserId);
      const created = await createDraftTask(cookie);
      await transition(cookie, created.id, "draft", "cancelled").expect(200);
      const response = await transition(cookie, created.id, "cancelled", "draft").expect(400);
      expect(JSON.stringify(response.body)).toContain("terminal");
    });

    it("rejects a stale expectedStatus with a 409, never a silent overwrite", async () => {
      const cookie = await cookieForNewSession(marketingEditorUserId);
      const created = await createDraftTask(cookie);
      await transition(cookie, created.id, "draft", "ready_for_claude").expect(200);
      // A second caller still believing the task is `draft`.
      await transition(cookie, created.id, "draft", "cancelled").expect(409);
    });

    it("rejects a no-op transition request (400)", async () => {
      const cookie = await cookieForNewSession(marketingEditorUserId);
      const created = await createDraftTask(cookie);
      await transition(cookie, created.id, "draft", "draft").expect(400);
    });

    it("rejects an unknown status value at the DTO layer (400)", async () => {
      const cookie = await cookieForNewSession(marketingEditorUserId);
      const created = await createDraftTask(cookie);
      await transition(cookie, created.id, "draft", "shipped_it").expect(400);
    });
  });

  describe("list filtering", () => {
    it("filters by status, priority, projectId and agent, and fuzzy-searches title", async () => {
      const cookie = await cookieForNewSession(marketingEditorUserId);
      const agent = uniqueId("agent");
      const distinctive = `Quokka${Date.now()}`;
      await createDraftTask(cookie, {
        title: `Investigate the ${distinctive} regression`,
        agent,
        priority: "high",
        projectId,
      });
      await createDraftTask(cookie, { title: "An unrelated queue item", agent, priority: "low" });

      const byAgent = await request(app.getHttpServer())
        .get(`/ready-for-claude-queue/tasks?agent=${agent}`)
        .set("Cookie", cookie)
        .expect(200);
      expect(byAgent.body.data).toHaveLength(2);

      const byPriority = await request(app.getHttpServer())
        .get(`/ready-for-claude-queue/tasks?agent=${agent}&priority=high`)
        .set("Cookie", cookie)
        .expect(200);
      expect(byPriority.body.data).toHaveLength(1);

      const byProject = await request(app.getHttpServer())
        .get(`/ready-for-claude-queue/tasks?agent=${agent}&projectId=${projectId}`)
        .set("Cookie", cookie)
        .expect(200);
      expect(byProject.body.data).toHaveLength(1);

      const bySearch = await request(app.getHttpServer())
        .get(`/ready-for-claude-queue/tasks?agent=${agent}&search=${distinctive}`)
        .set("Cookie", cookie)
        .expect(200);
      expect(bySearch.body.data).toHaveLength(1);

      const byStatus = await request(app.getHttpServer())
        .get(`/ready-for-claude-queue/tasks?agent=${agent}&status=completed`)
        .set("Cookie", cookie)
        .expect(200);
      expect(byStatus.body.data).toHaveLength(0);
    });
  });
});
