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
import { ProjectsModule } from "../src/projects/projects.module.js";

/**
 * Request-level coverage for the Projects module HTTP surface
 * (docs/task-packages/module-projects-foundation.md), against a REAL disposable PostgreSQL
 * database — same pattern as ../test/operational-contacts.e2e-spec.ts. Unlike that module,
 * `project_configuration` has real seeded grants (00013-seed-rbac-matrix.ts), so this proves both
 * the positive path (super_admin can create/view/update/transition a project) and the negative
 * path (a view-only role is correctly denied mutation).
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

describe("Projects module endpoints (e2e, real disposable database)", () => {
  let app: INestApplication;
  let users: UserRepository;
  let roles: RoleRepository;
  let userRoles: UserRoleRepository;
  let sessionService: SessionService;
  let authEnv: AuthEnv;

  let superAdminUserId: string;
  let readOnlyUserId: string;

  async function cookieForNewSession(userId: string): Promise<string> {
    const { rawToken } = await sessionService.issue({
      userId,
      authMethod: "google_sso",
      requiresMfa: false,
    });
    return `${authEnv.SESSION_COOKIE_NAME}=${rawToken}`;
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
      imports: [ProjectsModule],
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

    const superAdminUser = await users.create({
      email: "projects.super-admin.e2e@webdesksolution.com",
      displayName: "Projects Super Admin E2E",
      accountStatus: "active",
    });
    superAdminUserId = superAdminUser.id;
    const superAdminRole = await roles.findByKey("super_admin");
    if (!superAdminRole) {
      throw new Error("Expected super_admin role was not seeded — check migration 00013");
    }
    await userRoles.assign(superAdminUserId, superAdminRole.id);

    const readOnlyUser = await users.create({
      email: "projects.read-only.e2e@webdesksolution.com",
      displayName: "Projects Read Only E2E",
      accountStatus: "active",
    });
    readOnlyUserId = readOnlyUser.id;
    const readOnlyRole = await roles.findByKey("read_only");
    if (!readOnlyRole) {
      throw new Error("Expected read_only role was not seeded — check migration 00013");
    }
    await userRoles.assign(readOnlyUserId, readOnlyRole.id);
  }, 30_000);

  afterAll(async () => {
    await app.close();
    const migrator = buildMigrator();
    await migrator.down({ to: 0 });
    await closeConnection();
  }, 30_000);

  it("rejects GET /projects with 401 when there is no session cookie", async () => {
    await request(app.getHttpServer()).get("/projects").expect(401);
  });

  it("allows a real super_admin session to create and read a project (real seeded grants)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const publicId = `e2e-${randomUUID()}`;

    const createResponse = await request(app.getHttpServer())
      .post("/projects")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId, name: "E2E Test Project" })
      .expect(201);

    expect(createResponse.body.success).toBe(true);
    expect(createResponse.body.data.status).toBe("active");
    const projectId = createResponse.body.data.id as string;

    const getResponse = await request(app.getHttpServer())
      .get(`/projects/${projectId}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(getResponse.body.data.publicId).toBe(publicId);
  });

  it("denies project creation with 403 for a read_only session (only V grant, not C)", async () => {
    const cookie = await cookieForNewSession(readOnlyUserId);
    await request(app.getHttpServer())
      .post("/projects")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: `denied-${randomUUID()}`, name: "Should Be Denied" })
      .expect(403);
  });

  it("allows a read_only session to list projects (V grant)", async () => {
    const cookie = await cookieForNewSession(readOnlyUserId);
    await request(app.getHttpServer()).get("/projects").set("Cookie", cookie).expect(200);
  });

  it("rejects an invalid status transition (archived -> active) with 400, via a real request", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const createResponse = await request(app.getHttpServer())
      .post("/projects")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: `transition-${randomUUID()}`, name: "Transition Test" })
      .expect(201);
    const projectId = createResponse.body.data.id as string;

    await request(app.getHttpServer())
      .post(`/projects/${projectId}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ status: "archived" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/projects/${projectId}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ status: "active" })
      .expect(400);
  });

  it("creates a roadmap item, sets it active, then rejects removing it (destructive-deletion guard)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const createResponse = await request(app.getHttpServer())
      .post("/projects")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: `roadmap-${randomUUID()}`, name: "Roadmap Test" })
      .expect(201);
    const projectId = createResponse.body.data.id as string;

    const roadmapResponse = await request(app.getHttpServer())
      .post(`/projects/${projectId}/roadmap-items`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ name: "Discovery" })
      .expect(201);
    const roadmapItemId = roadmapResponse.body.data.id as string;

    await request(app.getHttpServer())
      .post(`/projects/${projectId}/active-phase`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ roadmapItemId })
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/projects/${projectId}/roadmap-items/${roadmapItemId}`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .expect(400);
  });

  describe("POST /projects/:projectId/approvers (security-review fix: users_roles:edit re-check)", () => {
    it("rejects an owner_growth_approver session with 403 — that role holds project_configuration:approve but not users_roles:edit", async () => {
      const approverUser = await users.create({
        email: `projects.approver.e2e.${randomUUID()}@webdesksolution.com`,
        displayName: "Projects Approver E2E",
        accountStatus: "active",
      });
      const approverRole = await roles.findByKey("owner_growth_approver");
      if (!approverRole) {
        throw new Error(
          "Expected owner_growth_approver role was not seeded — check migration 00013",
        );
      }
      await userRoles.assign(approverUser.id, approverRole.id);

      const adminCookie = await cookieForNewSession(superAdminUserId);
      const createResponse = await request(app.getHttpServer())
        .post("/projects")
        .set("Cookie", adminCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ publicId: `approver-bypass-${randomUUID()}`, name: "Approver Bypass Test" })
        .expect(201);
      const projectId = createResponse.body.data.id as string;

      const approverCookie = await cookieForNewSession(approverUser.id);
      await request(app.getHttpServer())
        .post(`/projects/${projectId}/approvers`)
        .set("Cookie", approverCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ userId: readOnlyUserId })
        .expect(403);

      const grantedRoleIds = await userRoles.findRoleIdsForUser(readOnlyUserId, projectId);
      expect(grantedRoleIds).not.toContain(approverRole.id);
    });

    it("allows a super_admin session (holds users_roles:edit) to assign a project-scoped approver, and the grant can then be revoked via ?projectId=", async () => {
      const adminCookie = await cookieForNewSession(superAdminUserId);
      const createResponse = await request(app.getHttpServer())
        .post("/projects")
        .set("Cookie", adminCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ publicId: `approver-ok-${randomUUID()}`, name: "Approver OK Test" })
        .expect(201);
      const projectId = createResponse.body.data.id as string;

      const newApprover = await users.create({
        email: `projects.new-approver.e2e.${randomUUID()}@webdesksolution.com`,
        displayName: "New Approver E2E",
        accountStatus: "active",
      });

      await request(app.getHttpServer())
        .post(`/projects/${projectId}/approvers`)
        .set("Cookie", adminCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ userId: newApprover.id })
        .expect(204);

      const approverRole = await roles.findByKey("owner_growth_approver");
      const grantedRoleIds = await userRoles.findRoleIdsForUser(newApprover.id, projectId);
      expect(grantedRoleIds).toContain(approverRole!.id);

      // Omitting ?projectId= can only match a global-scope grant — the project-scoped one survives.
      const revokeWithoutProjectId = await request(app.getHttpServer())
        .delete(`/authz/users/${newApprover.id}/roles/${approverRole!.id}`)
        .set("Cookie", adminCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .expect(200);
      expect(revokeWithoutProjectId.body.data).toEqual({ revoked: false });
      expect(await userRoles.findRoleIdsForUser(newApprover.id, projectId)).toContain(
        approverRole!.id,
      );

      const revokeWithProjectId = await request(app.getHttpServer())
        .delete(`/authz/users/${newApprover.id}/roles/${approverRole!.id}`)
        .query({ projectId })
        .set("Cookie", adminCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .expect(200);
      expect(revokeWithProjectId.body.data).toEqual({ revoked: true });
      expect(await userRoles.findRoleIdsForUser(newApprover.id, projectId)).not.toContain(
        approverRole!.id,
      );
    });

    it("lists the current approvers for a project, reflecting an assignment made moments earlier", async () => {
      const adminCookie = await cookieForNewSession(superAdminUserId);
      const createResponse = await request(app.getHttpServer())
        .post("/projects")
        .set("Cookie", adminCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ publicId: `approver-list-${randomUUID()}`, name: "Approver List Test" })
        .expect(201);
      const projectId = createResponse.body.data.id as string;

      const emptyList = await request(app.getHttpServer())
        .get(`/projects/${projectId}/approvers`)
        .set("Cookie", adminCookie)
        .expect(200);
      expect(emptyList.body.data).toEqual([]);

      const approver = await users.create({
        email: `projects.list-approver.e2e.${randomUUID()}@webdesksolution.com`,
        displayName: "List Approver E2E",
        accountStatus: "active",
      });
      await request(app.getHttpServer())
        .post(`/projects/${projectId}/approvers`)
        .set("Cookie", adminCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ userId: approver.id })
        .expect(204);

      const populatedList = await request(app.getHttpServer())
        .get(`/projects/${projectId}/approvers`)
        .set("Cookie", adminCookie)
        .expect(200);
      expect(populatedList.body.data).toEqual([
        { id: approver.id, displayName: "List Approver E2E", email: approver.email },
      ]);
    });

    it("rejects a read_only session with 403 — that role holds project_configuration:view but no users_roles grant at all (code-review finding: this route must not reuse the sibling routes' project_configuration:view gate, since listing approvers exposes users_roles-scoped PII)", async () => {
      const adminCookie = await cookieForNewSession(superAdminUserId);
      const createResponse = await request(app.getHttpServer())
        .post("/projects")
        .set("Cookie", adminCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ publicId: `approver-list-gate-${randomUUID()}`, name: "Approver List Gate Test" })
        .expect(201);
      const projectId = createResponse.body.data.id as string;

      const readOnlyCookie = await cookieForNewSession(readOnlyUserId);
      await request(app.getHttpServer())
        .get(`/projects/${projectId}/approvers`)
        .set("Cookie", readOnlyCookie)
        .expect(403);
    });
  });

  describe("POST /projects/:projectId/update", () => {
    it("updates a project's fields, including a real, active ownerUserId", async () => {
      const cookie = await cookieForNewSession(superAdminUserId);
      const createResponse = await request(app.getHttpServer())
        .post("/projects")
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ publicId: `update-${randomUUID()}`, name: "Update Test" })
        .expect(201);
      const projectId = createResponse.body.data.id as string;

      const updateResponse = await request(app.getHttpServer())
        .post(`/projects/${projectId}/update`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ name: "Updated Name", ownerUserId: readOnlyUserId })
        .expect(200);

      expect(updateResponse.body.data.name).toBe("Updated Name");
      expect(updateResponse.body.data.ownerUserId).toBe(readOnlyUserId);
    });

    it("rejects an ownerUserId that doesn't resolve to any real user, with a clean 400", async () => {
      const cookie = await cookieForNewSession(superAdminUserId);
      const createResponse = await request(app.getHttpServer())
        .post("/projects")
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ publicId: `update-bad-owner-${randomUUID()}`, name: "Update Bad Owner Test" })
        .expect(201);
      const projectId = createResponse.body.data.id as string;

      await request(app.getHttpServer())
        .post(`/projects/${projectId}/update`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ ownerUserId: randomUUID() })
        .expect(400);
    });
  });

  describe("project team roster", () => {
    it("adds, lists, and removes a team member", async () => {
      const cookie = await cookieForNewSession(superAdminUserId);
      const createResponse = await request(app.getHttpServer())
        .post("/projects")
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ publicId: `team-${randomUUID()}`, name: "Team Test" })
        .expect(201);
      const projectId = createResponse.body.data.id as string;

      const teamMember = await users.create({
        email: `projects.team-member.e2e.${randomUUID()}@webdesksolution.com`,
        displayName: "Team Member E2E",
        accountStatus: "active",
      });

      const addResponse = await request(app.getHttpServer())
        .post(`/projects/${projectId}/team`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ userId: teamMember.id })
        .expect(201);
      const teamEntryId = addResponse.body.data.id as string;

      const listResponse = await request(app.getHttpServer())
        .get(`/projects/${projectId}/team`)
        .set("Cookie", cookie)
        .expect(200);
      expect(listResponse.body.data).toHaveLength(1);
      expect(listResponse.body.data[0].userId).toBe(teamMember.id);

      await request(app.getHttpServer())
        .delete(`/projects/${projectId}/team/${teamEntryId}`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .expect(204);

      const finalListResponse = await request(app.getHttpServer())
        .get(`/projects/${projectId}/team`)
        .set("Cookie", cookie)
        .expect(200);
      expect(finalListResponse.body.data).toEqual([]);
    });
  });

  describe("project environments", () => {
    it("creates, lists, updates, and removes an environment", async () => {
      const cookie = await cookieForNewSession(superAdminUserId);
      const createResponse = await request(app.getHttpServer())
        .post("/projects")
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ publicId: `env-${randomUUID()}`, name: "Environment Test" })
        .expect(201);
      const projectId = createResponse.body.data.id as string;

      const createEnvResponse = await request(app.getHttpServer())
        .post(`/projects/${projectId}/environments`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ name: "Staging", url: "https://staging.example.com" })
        .expect(201);
      const environmentId = createEnvResponse.body.data.id as string;

      const listResponse = await request(app.getHttpServer())
        .get(`/projects/${projectId}/environments`)
        .set("Cookie", cookie)
        .expect(200);
      expect(listResponse.body.data).toHaveLength(1);

      await request(app.getHttpServer())
        .post(`/projects/${projectId}/environments/${environmentId}/update`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ name: "Production" })
        .expect(200);

      await request(app.getHttpServer())
        .delete(`/projects/${projectId}/environments/${environmentId}`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .expect(204);
    });

    it("rejects a non-http(s) URL scheme (e.g. javascript:) with a clean 400 (backend hardening for the stored-XSS class the frontend already guards against)", async () => {
      const cookie = await cookieForNewSession(superAdminUserId);
      const createResponse = await request(app.getHttpServer())
        .post("/projects")
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ publicId: `env-xss-${randomUUID()}`, name: "Environment XSS Test" })
        .expect(201);
      const projectId = createResponse.body.data.id as string;

      await request(app.getHttpServer())
        .post(`/projects/${projectId}/environments`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ name: "Malicious", url: "javascript:alert(1)" })
        .expect(400);
    });
  });

  describe("project objectives", () => {
    it("creates, lists, updates, and removes an objective", async () => {
      const cookie = await cookieForNewSession(superAdminUserId);
      const createResponse = await request(app.getHttpServer())
        .post("/projects")
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ publicId: `objective-${randomUUID()}`, name: "Objective Test" })
        .expect(201);
      const projectId = createResponse.body.data.id as string;

      const createObjResponse = await request(app.getHttpServer())
        .post(`/projects/${projectId}/objectives`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ description: "Grow organic traffic 20%" })
        .expect(201);
      const objectiveId = createObjResponse.body.data.id as string;

      const listResponse = await request(app.getHttpServer())
        .get(`/projects/${projectId}/objectives`)
        .set("Cookie", cookie)
        .expect(200);
      expect(listResponse.body.data).toHaveLength(1);

      await request(app.getHttpServer())
        .post(`/projects/${projectId}/objectives/${objectiveId}/update`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ status: "complete" })
        .expect(200);

      await request(app.getHttpServer())
        .delete(`/projects/${projectId}/objectives/${objectiveId}`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .expect(204);
    });
  });

  describe("project repositories", () => {
    it("links, lists, updates, and unlinks a repository", async () => {
      const cookie = await cookieForNewSession(superAdminUserId);
      const createResponse = await request(app.getHttpServer())
        .post("/projects")
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ publicId: `repo-${randomUUID()}`, name: "Repository Test" })
        .expect(201);
      const projectId = createResponse.body.data.id as string;

      const createRepoResponse = await request(app.getHttpServer())
        .post(`/projects/${projectId}/repositories`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ repoOwner: "WDS-Internal-DeveloperTeam", repoName: "webdesk-growth-dashboard" })
        .expect(201);
      const repositoryId = createRepoResponse.body.data.id as string;

      const listResponse = await request(app.getHttpServer())
        .get(`/projects/${projectId}/repositories`)
        .set("Cookie", cookie)
        .expect(200);
      expect(listResponse.body.data).toHaveLength(1);

      await request(app.getHttpServer())
        .post(`/projects/${projectId}/repositories/${repositoryId}/update`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ defaultBranch: "develop" })
        .expect(200);

      await request(app.getHttpServer())
        .delete(`/projects/${projectId}/repositories/${repositoryId}`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .expect(204);
    });
  });

  describe("project roadmap items — list and update", () => {
    it("lists a project's roadmap items and updates one's name/sequence", async () => {
      const cookie = await cookieForNewSession(superAdminUserId);
      const createResponse = await request(app.getHttpServer())
        .post("/projects")
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ publicId: `roadmap-list-${randomUUID()}`, name: "Roadmap List Test" })
        .expect(201);
      const projectId = createResponse.body.data.id as string;

      const roadmapResponse = await request(app.getHttpServer())
        .post(`/projects/${projectId}/roadmap-items`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ name: "Discovery" })
        .expect(201);
      const roadmapItemId = roadmapResponse.body.data.id as string;

      const listResponse = await request(app.getHttpServer())
        .get(`/projects/${projectId}/roadmap-items`)
        .set("Cookie", cookie)
        .expect(200);
      expect(listResponse.body.data).toHaveLength(1);

      const updateResponse = await request(app.getHttpServer())
        .post(`/projects/${projectId}/roadmap-items/${roadmapItemId}/update`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ name: "Discovery — Renamed", sequence: 3 })
        .expect(200);
      expect(updateResponse.body.data.name).toBe("Discovery — Renamed");
      expect(updateResponse.body.data.sequence).toBe(3);
    });
  });
});
