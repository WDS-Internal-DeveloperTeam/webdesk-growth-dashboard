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
import { TechnicalCenterModule } from "../src/technical-center/technical-center.module.js";

/**
 * Request-level coverage for the Technical Center module HTTP surface, against a REAL disposable
 * PostgreSQL database — same harness pattern as `scan-center.e2e-spec.ts`. The `development_code`
 * RBAC group has real seeded grants (`00013-seed-rbac-matrix.ts:145-153`):
 *   super_admin              VCERL  (view, create, edit, review, release, rollback)
 *   owner_growth_approver    VRL    (view, review, release, rollback — NOT create/edit)
 *   marketing_editor         V      (view only)
 *   designer_creative_reviewer V    (view only)
 *   developer                VCES   (view, create, edit, submit — NOT review/approve)
 *   qa_security_reviewer     VRA    (view, review, approve — NOT create/edit/submit)
 *   read_only                V      (view only)
 *
 * Every route lives under a real `:projectId` route path segment
 * (`technical-center/projects/:projectId/...`) — the test marked "regression" proves a session
 * holding ONLY a project-scoped `development_code` grant (not a global one) is allowed within its
 * own project and still denied outside it.
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

describe("Technical Center module endpoints (e2e, real disposable database)", () => {
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

  async function createDefinition(
    cookie: string,
    targetProjectId: string = projectId,
    overrides: Record<string, unknown> = {},
  ): Promise<{ id: string; publicId: string }> {
    const response = await request(app.getHttpServer())
      .post(`/technical-center/projects/${targetProjectId}/definitions`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        publicId: uniqueId("TCDEF"),
        name: "Lint check",
        checkType: "linting",
        ...overrides,
      })
      .expect(201);
    return response.body.data as { id: string; publicId: string };
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
      imports: [TechnicalCenterModule],
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

    developerUserId = await createUserWithRole("tc.developer", "developer");
    ownerGrowthApproverUserId = await createUserWithRole(
      "tc.owner-growth-approver",
      "owner_growth_approver",
    );
    marketingEditorUserId = await createUserWithRole("tc.marketing-editor", "marketing_editor");
    qaSecurityReviewerUserId = await createUserWithRole(
      "tc.qa-security-reviewer",
      "qa_security_reviewer",
    );
    readOnlyUserId = await createUserWithRole("tc.read-only", "read_only");

    const project = await projects.create({
      publicId: uniqueId("PROJ"),
      name: "Technical Center E2E Fixture Project",
    });
    projectId = project.id;
    const otherProject = await projects.create({
      publicId: uniqueId("PROJ"),
      name: "Technical Center E2E Other Project",
    });
    otherProjectId = otherProject.id;
  }, 30_000);

  afterAll(async () => {
    await app.close();
    const migrator = buildMigrator();
    await migrator.down({ to: 0 });
    await closeConnection();
  }, 30_000);

  it("rejects GET .../definitions with 401 when there is no session cookie", async () => {
    await request(app.getHttpServer())
      .get(`/technical-center/projects/${projectId}/definitions`)
      .expect(401);
  });

  it("denies a read_only session from creating a technical check definition (403)", async () => {
    const cookie = await cookieForNewSession(readOnlyUserId);
    await request(app.getHttpServer())
      .post(`/technical-center/projects/${projectId}/definitions`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: uniqueId("TCDEF"), name: "x", checkType: "linting" })
      .expect(403);
  });

  it("full lifecycle: developer (VCES) creates a definition, runs a check through to completion with findings, and a qa_security_reviewer (VRA) resolves a finding", async () => {
    const developerCookie = await cookieForNewSession(developerUserId);

    const definition = await createDefinition(developerCookie);

    const runResponse = await request(app.getHttpServer())
      .post(`/technical-center/projects/${projectId}/runs`)
      .set("Cookie", developerCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        technicalCheckDefinitionId: definition.id,
        publicId: uniqueId("TCRUN"),
        triggerType: "manual",
      })
      .expect(201);
    const run = runResponse.body.data as { id: string; status: string };
    expect(run.status).toBe("requested");

    await request(app.getHttpServer())
      .post(`/technical-center/projects/${projectId}/runs/${run.id}/status`)
      .set("Cookie", developerCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ status: "queued" })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/technical-center/projects/${projectId}/runs/${run.id}/status`)
      .set("Cookie", developerCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ status: "running" })
      .expect(200);

    const completeResponse = await request(app.getHttpServer())
      .post(`/technical-center/projects/${projectId}/runs/${run.id}/status`)
      .set("Cookie", developerCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        status: "completed",
        findings: [
          { severity: "critical", title: "3 known CVEs in dependencies" },
          { severity: "info", title: "Minor style nit" },
        ],
      })
      .expect(200);
    expect(completeResponse.body.data.status).toBe("completed");
    expect(completeResponse.body.data.completedAt).not.toBeNull();

    const findingsListResponse = await request(app.getHttpServer())
      .get(`/technical-center/projects/${projectId}/findings`)
      .query({ technicalCheckRunId: run.id })
      .set("Cookie", developerCookie)
      .expect(200);
    const findings = findingsListResponse.body.data as Array<{ id: string; severity: string }>;
    expect(findings).toHaveLength(2);
    const critical = findings.find((f) => f.severity === "critical")!;
    expect(critical).toBeDefined();

    // developer holds no `review` action — the dynamic per-transition check must reject this.
    await request(app.getHttpServer())
      .post(`/technical-center/projects/${projectId}/findings/${critical.id}/status`)
      .set("Cookie", developerCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ status: "resolved" })
      .expect(403);

    // qa_security_reviewer (VRA) holds `review` — this must succeed.
    const qaCookie = await cookieForNewSession(qaSecurityReviewerUserId);
    const resolveResponse = await request(app.getHttpServer())
      .post(`/technical-center/projects/${projectId}/findings/${critical.id}/status`)
      .set("Cookie", qaCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ status: "resolved" })
      .expect(200);
    expect(resolveResponse.body.data.status).toBe("resolved");
    expect(resolveResponse.body.data.resolvedAt).not.toBeNull();
  });

  it("owner_growth_approver (VRL, no create/edit) is denied creating a definition and denied transitioning a run's status", async () => {
    const developerCookie = await cookieForNewSession(developerUserId);
    const definition = await createDefinition(developerCookie);

    const runResponse = await request(app.getHttpServer())
      .post(`/technical-center/projects/${projectId}/runs`)
      .set("Cookie", developerCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        technicalCheckDefinitionId: definition.id,
        publicId: uniqueId("TCRUN"),
        triggerType: "manual",
      })
      .expect(201);
    const run = runResponse.body.data as { id: string };

    const cookie = await cookieForNewSession(ownerGrowthApproverUserId);
    await request(app.getHttpServer())
      .post(`/technical-center/projects/${projectId}/definitions`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: uniqueId("TCDEF"), name: "y", checkType: "linting" })
      .expect(403);

    // No `edit` grant — the dynamic per-transition check inside TechnicalCheckRunsService must
    // reject this.
    await request(app.getHttpServer())
      .post(`/technical-center/projects/${projectId}/runs/${run.id}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ status: "queued" })
      .expect(403);
  });

  it("marketing_editor (V, no create/edit) is denied creating a technical check definition", async () => {
    const cookie = await cookieForNewSession(marketingEditorUserId);
    await request(app.getHttpServer())
      .post(`/technical-center/projects/${projectId}/definitions`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: uniqueId("TCDEF"), name: "z", checkType: "linting" })
      .expect(403);
  });

  it("regression: a project-scoped-only session is allowed within its own project and denied in another", async () => {
    const scopedUserId = await createUserWithRole("tc.project-scoped", "developer", projectId);
    const cookie = await cookieForNewSession(scopedUserId);

    await createDefinition(cookie, projectId);

    await request(app.getHttpServer())
      .post(`/technical-center/projects/${otherProjectId}/definitions`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: uniqueId("TCDEF"), name: "denied", checkType: "linting" })
      .expect(403);
  });

  it("rejects an invalid definition -> run relationship (cross-project) with a clean 404", async () => {
    const cookie = await cookieForNewSession(developerUserId);
    const definitionInProjectA = await createDefinition(cookie, projectId);

    await request(app.getHttpServer())
      .post(`/technical-center/projects/${otherProjectId}/runs`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        technicalCheckDefinitionId: definitionInProjectA.id,
        publicId: uniqueId("TCRUN"),
        triggerType: "manual",
      })
      .expect(404);
  });

  it("rejects a duplicate publicId at the route layer with a clean 400", async () => {
    const cookie = await cookieForNewSession(developerUserId);
    const definition = await createDefinition(cookie);
    await request(app.getHttpServer())
      .post(`/technical-center/projects/${projectId}/definitions`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: definition.publicId, name: "dup", checkType: "linting" })
      .expect(400);
  });

  it("rejects a run against a disabled definition with a clean 400", async () => {
    const cookie = await cookieForNewSession(developerUserId);
    const definition = await createDefinition(cookie, projectId, { isEnabled: false });

    await request(app.getHttpServer())
      .post(`/technical-center/projects/${projectId}/runs`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        technicalCheckDefinitionId: definition.id,
        publicId: uniqueId("TCRUN"),
        triggerType: "manual",
      })
      .expect(400);
  });

  it("rejects an invalid status transition with a clean 400", async () => {
    const cookie = await cookieForNewSession(developerUserId);
    const definition = await createDefinition(cookie);
    const runResponse = await request(app.getHttpServer())
      .post(`/technical-center/projects/${projectId}/runs`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        technicalCheckDefinitionId: definition.id,
        publicId: uniqueId("TCRUN"),
        triggerType: "manual",
      })
      .expect(201);
    const run = runResponse.body.data as { id: string };

    await request(app.getHttpServer())
      .post(`/technical-center/projects/${projectId}/runs/${run.id}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ status: "completed" })
      .expect(400);
  });
});
