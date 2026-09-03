import { randomBytes } from "node:crypto";
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
import { ReleaseCenterModule } from "../src/release-center/release-center.module.js";

/**
 * Request-level coverage for the Release Center module HTTP surface, against a REAL disposable
 * PostgreSQL database — same harness pattern as `technical-center.e2e-spec.ts`. The `releases`
 * RBAC group has real seeded grants (`00013-seed-rbac-matrix.ts:253-260`):
 *   super_admin              VCERAL (view, create, edit, review, approve, release, rollback)
 *   owner_growth_approver    VCRAL  (view, create, review, approve, release, rollback — NOT edit)
 *   marketing_editor         V      (view only)
 *   designer_creative_reviewer V    (view only)
 *   developer                VCESR  (view, create, edit, submit, review — NOT approve/release)
 *   qa_security_reviewer     VRA    (view, review, approve — NOT create/edit/submit/release)
 *   read_only                V      (view only)
 *
 * Every route lives under a real `:projectId` route path segment
 * (`release-center/projects/:projectId/...`) — the test marked "regression" proves a session
 * holding ONLY a project-scoped `releases` grant (not a global one) is allowed within its own
 * project and still denied outside it.
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

describe("Release Center module endpoints (e2e, real disposable database)", () => {
  let app: INestApplication;
  let users: UserRepository;
  let roles: RoleRepository;
  let userRoles: UserRoleRepository;
  let projects: ProjectRepository;
  let sessionService: SessionService;
  let authEnv: AuthEnv;

  let developerUserId: string;
  let ownerGrowthApproverUserId: string;
  let marketingEditorUserId: string;
  let qaSecurityReviewerUserId: string;
  let readOnlyUserId: string;

  let projectId: string;
  let otherProjectId: string;

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

  async function createRelease(
    cookie: string,
    targetProjectId: string = projectId,
    overrides: Record<string, unknown> = {},
  ): Promise<{ id: string; publicId: string; status: string }> {
    const response = await request(app.getHttpServer())
      .post(`/release-center/projects/${targetProjectId}/releases`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        publicId: uniqueId("REL"),
        releaseType: "staging",
        title: "September release",
        ...overrides,
      })
      .expect(201);
    return response.body.data as { id: string; publicId: string; status: string };
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
      imports: [ReleaseCenterModule],
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

    developerUserId = await createUserWithRole("rc.developer", "developer");
    ownerGrowthApproverUserId = await createUserWithRole(
      "rc.owner-growth-approver",
      "owner_growth_approver",
    );
    marketingEditorUserId = await createUserWithRole("rc.marketing-editor", "marketing_editor");
    qaSecurityReviewerUserId = await createUserWithRole(
      "rc.qa-security-reviewer",
      "qa_security_reviewer",
    );
    readOnlyUserId = await createUserWithRole("rc.read-only", "read_only");

    const project = await projects.create({
      publicId: uniqueId("PROJ"),
      name: "Release Center E2E Fixture Project",
    });
    projectId = project.id;
    const otherProject = await projects.create({
      publicId: uniqueId("PROJ"),
      name: "Release Center E2E Other Project",
    });
    otherProjectId = otherProject.id;
  }, 30_000);

  afterAll(async () => {
    await app.close();
    const migrator = buildMigrator();
    await migrator.down({ to: 0 });
    await closeConnection();
  }, 30_000);

  it("rejects GET .../releases with 401 when there is no session cookie", async () => {
    await request(app.getHttpServer())
      .get(`/release-center/projects/${projectId}/releases`)
      .expect(401);
  });

  it("denies a read_only session from creating a release (403)", async () => {
    const cookie = await cookieForNewSession(readOnlyUserId);
    await request(app.getHttpServer())
      .post(`/release-center/projects/${projectId}/releases`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: uniqueId("REL"), releaseType: "staging", title: "x" })
      .expect(403);
  });

  it("marketing_editor (V, no create) is denied creating a release", async () => {
    const cookie = await cookieForNewSession(marketingEditorUserId);
    await request(app.getHttpServer())
      .post(`/release-center/projects/${projectId}/releases`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: uniqueId("REL"), releaseType: "staging", title: "z" })
      .expect(403);
  });

  it("full happy-path lifecycle across the three-tier submit/review/release/approve matrix, ending completed", async () => {
    const developerCookie = await cookieForNewSession(developerUserId);
    const qaCookie = await cookieForNewSession(qaSecurityReviewerUserId);
    const ownerCookie = await cookieForNewSession(ownerGrowthApproverUserId);

    const release = await createRelease(developerCookie);
    expect(release.status).toBe("proposed");

    async function transition(
      cookie: string,
      status: string,
      expectStatus = 200,
    ): Promise<request.Response> {
      return request(app.getHttpServer())
        .post(`/release-center/projects/${projectId}/releases/${release.id}/status`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ status })
        .expect(expectStatus);
    }

    // developer holds `submit` — proposed -> checks_running
    await transition(developerCookie, "checks_running");
    // developer holds `review` too — checks_running -> ready_for_staging
    await transition(developerCookie, "ready_for_staging");

    // developer lacks `release` (no L letter) — must be denied.
    await transition(developerCookie, "staging_deployed", 403);
    // owner_growth_approver holds `release` — ready_for_staging -> staging_deployed
    await transition(ownerCookie, "staging_deployed");
    // qa holds `review` — staging_deployed -> staging_verification
    await transition(qaCookie, "staging_verification");

    // developer lacks `approve` — must be denied.
    await transition(developerCookie, "staging_approved", 403);
    // qa holds `approve` — staging_verification -> staging_approved, inserting a release_approvals row
    const approvedResponse = await transition(qaCookie, "staging_approved");
    expect(approvedResponse.body.data.status).toBe("staging_approved");

    const approvalsResponse = await request(app.getHttpServer())
      .get(`/release-center/projects/${projectId}/releases/${release.id}/approvals`)
      .set("Cookie", developerCookie)
      .expect(200);
    const approvalRows = approvalsResponse.body.data as Array<{ approvalStage: string }>;
    expect(approvalRows).toHaveLength(1);
    expect(approvalRows[0]?.approvalStage).toBe("staging");

    // owner_growth_approver holds `approve` — staging_approved -> production_approval
    await transition(ownerCookie, "production_approval");
    // owner_growth_approver holds `release` — production_approval -> production_deployed, stamping
    // productionApproverUserId since this transition departs FROM production_approval.
    const deployedResponse = await transition(ownerCookie, "production_deployed");
    expect(deployedResponse.body.data.productionApproverUserId).toBe(ownerGrowthApproverUserId);

    // qa holds `review` — production_deployed -> production_verification
    await transition(qaCookie, "production_verification");
    // qa holds `approve` — production_verification -> completed
    const completedResponse = await transition(qaCookie, "completed");
    expect(completedResponse.body.data.status).toBe("completed");
    expect(completedResponse.body.data.completedAt).not.toBeNull();
    expect(completedResponse.body.data.productionVerifiedAt).not.toBeNull();

    // completed is terminal for content edits.
    await request(app.getHttpServer())
      .post(`/release-center/projects/${projectId}/releases/${release.id}/update`)
      .set("Cookie", developerCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ title: "Renamed" })
      .expect(400);
  });

  it("rejects a rollback transition missing reason/rolledBackSha, then succeeds with both and creates a rollback record", async () => {
    const developerCookie = await cookieForNewSession(developerUserId);
    const ownerCookie = await cookieForNewSession(ownerGrowthApproverUserId);
    const release = await createRelease(developerCookie);

    await request(app.getHttpServer())
      .post(`/release-center/projects/${projectId}/releases/${release.id}/status`)
      .set("Cookie", developerCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ status: "checks_running" })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/release-center/projects/${projectId}/releases/${release.id}/status`)
      .set("Cookie", developerCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ status: "ready_for_staging" })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/release-center/projects/${projectId}/releases/${release.id}/status`)
      .set("Cookie", ownerCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ status: "staging_deployed" })
      .expect(200);

    // developer lacks `release` — rolling back must be denied outright regardless of payload.
    await request(app.getHttpServer())
      .post(`/release-center/projects/${projectId}/releases/${release.id}/status`)
      .set("Cookie", developerCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ status: "rolled_back", reason: "bad build", rolledBackSha: "abc123" })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/release-center/projects/${projectId}/releases/${release.id}/status`)
      .set("Cookie", ownerCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ status: "rolled_back", rolledBackSha: "abc123" })
      .expect(400);

    const rollbackResponse = await request(app.getHttpServer())
      .post(`/release-center/projects/${projectId}/releases/${release.id}/status`)
      .set("Cookie", ownerCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ status: "rolled_back", reason: "bad build", rolledBackSha: "abc123" })
      .expect(200);
    expect(rollbackResponse.body.data.status).toBe("rolled_back");

    const rollbackRecordResponse = await request(app.getHttpServer())
      .get(`/release-center/projects/${projectId}/releases/${release.id}/rollback`)
      .set("Cookie", developerCookie)
      .expect(200);
    expect(rollbackRecordResponse.body.data.reason).toBe("bad build");
    expect(rollbackRecordResponse.body.data.rolledBackSha).toBe("abc123");
  });

  it("GET .../rollback returns 404 when the release has never been rolled back", async () => {
    const developerCookie = await cookieForNewSession(developerUserId);
    const release = await createRelease(developerCookie);
    await request(app.getHttpServer())
      .get(`/release-center/projects/${projectId}/releases/${release.id}/rollback`)
      .set("Cookie", developerCookie)
      .expect(404);
  });

  it("regression: a project-scoped-only session is allowed within its own project and denied in another", async () => {
    const scopedUserId = await createUserWithRole("rc.project-scoped", "developer", projectId);
    const cookie = await cookieForNewSession(scopedUserId);

    await createRelease(cookie, projectId);

    await request(app.getHttpServer())
      .post(`/release-center/projects/${otherProjectId}/releases`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: uniqueId("REL"), releaseType: "staging", title: "denied" })
      .expect(403);
  });

  it("rejects a duplicate publicId at the route layer with a clean 400", async () => {
    const cookie = await cookieForNewSession(developerUserId);
    const release = await createRelease(cookie);
    await request(app.getHttpServer())
      .post(`/release-center/projects/${projectId}/releases`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: release.publicId, releaseType: "staging", title: "dup" })
      .expect(400);
  });

  it("rejects an invalid status transition with a clean 400", async () => {
    const cookie = await cookieForNewSession(developerUserId);
    const release = await createRelease(cookie);
    await request(app.getHttpServer())
      .post(`/release-center/projects/${projectId}/releases/${release.id}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ status: "completed" })
      .expect(400);
  });

  it("release artifacts: create, list, and rejects removal once the release is completed", async () => {
    const developerCookie = await cookieForNewSession(developerUserId);
    const qaCookie = await cookieForNewSession(qaSecurityReviewerUserId);
    const ownerCookie = await cookieForNewSession(ownerGrowthApproverUserId);
    const release = await createRelease(developerCookie);

    const artifactResponse = await request(app.getHttpServer())
      .post(`/release-center/projects/${projectId}/releases/${release.id}/artifacts`)
      .set("Cookie", developerCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ repoOwner: "webdesk", repoName: "growth-dashboard", commitSha: "abc123" })
      .expect(201);
    const artifact = artifactResponse.body.data as { id: string };

    const listResponse = await request(app.getHttpServer())
      .get(`/release-center/projects/${projectId}/releases/${release.id}/artifacts`)
      .set("Cookie", developerCookie)
      .expect(200);
    expect(listResponse.body.data).toHaveLength(1);

    // Walk the release to completed.
    await request(app.getHttpServer())
      .post(`/release-center/projects/${projectId}/releases/${release.id}/status`)
      .set("Cookie", developerCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ status: "checks_running" })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/release-center/projects/${projectId}/releases/${release.id}/status`)
      .set("Cookie", developerCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ status: "ready_for_staging" })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/release-center/projects/${projectId}/releases/${release.id}/status`)
      .set("Cookie", ownerCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ status: "staging_deployed" })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/release-center/projects/${projectId}/releases/${release.id}/status`)
      .set("Cookie", qaCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ status: "staging_verification" })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/release-center/projects/${projectId}/releases/${release.id}/status`)
      .set("Cookie", qaCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ status: "staging_approved" })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/release-center/projects/${projectId}/releases/${release.id}/status`)
      .set("Cookie", ownerCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ status: "production_approval" })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/release-center/projects/${projectId}/releases/${release.id}/status`)
      .set("Cookie", ownerCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ status: "production_deployed" })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/release-center/projects/${projectId}/releases/${release.id}/status`)
      .set("Cookie", qaCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ status: "production_verification" })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/release-center/projects/${projectId}/releases/${release.id}/status`)
      .set("Cookie", qaCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ status: "completed" })
      .expect(200);

    await request(app.getHttpServer())
      .delete(
        `/release-center/projects/${projectId}/releases/${release.id}/artifacts/${artifact.id}`,
      )
      .set("Cookie", developerCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .expect(400);
  });

  it("deployments and smoke tests: create and list, append-only", async () => {
    const developerCookie = await cookieForNewSession(developerUserId);
    const release = await createRelease(developerCookie);

    await request(app.getHttpServer())
      .post(`/release-center/projects/${projectId}/releases/${release.id}/deployments`)
      .set("Cookie", developerCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ environment: "staging", outcome: "succeeded" })
      .expect(201);
    const deploymentsList = await request(app.getHttpServer())
      .get(`/release-center/projects/${projectId}/releases/${release.id}/deployments`)
      .set("Cookie", developerCookie)
      .expect(200);
    expect(deploymentsList.body.data).toHaveLength(1);

    await request(app.getHttpServer())
      .post(`/release-center/projects/${projectId}/releases/${release.id}/smoke-tests`)
      .set("Cookie", developerCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ environment: "staging", name: "Homepage loads", result: "passed" })
      .expect(201);
    const smokeTestsList = await request(app.getHttpServer())
      .get(`/release-center/projects/${projectId}/releases/${release.id}/smoke-tests`)
      .set("Cookie", developerCookie)
      .expect(200);
    expect(smokeTestsList.body.data).toHaveLength(1);
  });
});
