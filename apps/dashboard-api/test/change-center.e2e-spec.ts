import { randomBytes } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import {
  buildMigrator,
  closeConnection,
  ProjectRepository,
  RoleRepository,
  ScanDefinitionRepository,
  ScanFindingRepository,
  ScanRunRepository,
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
import { ChangeCenterModule } from "../src/change-center/change-center.module.js";

/**
 * Request-level coverage for the Change Center module HTTP surface, against a REAL disposable
 * PostgreSQL database — same harness pattern as `internal-linking-library.e2e-spec.ts`/
 * `scan-center.e2e-spec.ts`. `change_center` has real seeded grants
 * (`00013-seed-rbac-matrix.ts:226-234`):
 *   super_admin              VCERA  (view, create, edit, review, approve)
 *   owner_growth_approver    VCERA  (view, create, edit, review, approve)
 *   marketing_editor         VRA    (view, review, approve — NOT create/edit)
 *   designer_creative_reviewer VRA  (view, review, approve — NOT create/edit)
 *   developer                VRA    (view, review, approve — NOT create/edit)
 *   qa_security_reviewer     VRA    (view, review, approve — NOT create/edit)
 *   read_only                V      (view only)
 *
 * Every route lives under a real `:projectId` route path segment
 * (`change-center/projects/:projectId/records`), mirroring Scan Center's/Internal Linking
 * Library's own already-fixed project-scoping shape.
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

describe("Change Center module endpoints (e2e, real disposable database)", () => {
  let app: INestApplication;
  let users: UserRepository;
  let roles: RoleRepository;
  let userRoles: UserRoleRepository;
  let projects: ProjectRepository;
  let scanDefinitions: ScanDefinitionRepository;
  let scanRuns: ScanRunRepository;
  let scanFindings: ScanFindingRepository;
  let sessionService: SessionService;
  let authEnv: AuthEnv;

  let superAdminUserId: string;
  let readOnlyUserId: string;
  let marketingEditorUserId: string;
  let ownerGrowthApproverUserId: string;

  let projectId: string;
  let otherProjectId: string;
  let scanFindingId: string;

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

  async function createDetectedRecord(
    cookie: string,
    overrides: Record<string, unknown> = {},
    targetProjectId: string = projectId,
  ): Promise<{ id: string; status: string; projectId: string }> {
    const response = await request(app.getHttpServer())
      .post(`/change-center/projects/${targetProjectId}/records`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        publicId: uniqueId("CHG"),
        category: "plugin",
        severity: "medium",
        recordLabel: "Plugin X 1.2.0 -> 1.3.0",
        ...overrides,
      })
      .expect(201);
    return response.body.data as { id: string; status: string; projectId: string };
  }

  // NOT async — must return the chainable supertest `Test` object itself (not a Promise wrapping
  // it), so every call site can chain `.expect(...)` directly.
  function transition(
    cookie: string,
    id: string,
    body: Record<string, unknown>,
    targetProjectId: string = projectId,
  ) {
    return request(app.getHttpServer())
      .post(`/change-center/projects/${targetProjectId}/records/${id}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send(body);
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
      imports: [ChangeCenterModule],
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
    scanDefinitions = new ScanDefinitionRepository();
    scanRuns = new ScanRunRepository();
    scanFindings = new ScanFindingRepository();

    superAdminUserId = await createUserWithRole("cc.super-admin", "super_admin");
    readOnlyUserId = await createUserWithRole("cc.read-only", "read_only");
    marketingEditorUserId = await createUserWithRole("cc.marketing-editor", "marketing_editor");
    ownerGrowthApproverUserId = await createUserWithRole(
      "cc.owner-growth-approver",
      "owner_growth_approver",
    );

    const project = await projects.create({
      publicId: uniqueId("PROJ"),
      name: "Change Center E2E Fixture Project",
    });
    projectId = project.id;

    const otherProject = await projects.create({
      publicId: uniqueId("PROJ"),
      name: "Change Center E2E Other Project",
    });
    otherProjectId = otherProject.id;

    const definition = await scanDefinitions.create({
      projectId,
      publicId: uniqueId("SCAN"),
      name: "E2E fixture scan definition",
      scanType: "theme_plugin_core_currency",
    });
    const run = await scanRuns.create({
      projectId,
      publicId: uniqueId("RUN"),
      scanDefinitionId: definition.id,
      triggerType: "manual",
    });
    const finding = await scanFindings.create({
      projectId,
      publicId: uniqueId("FND"),
      scanRunId: run.id,
      severity: "medium",
      title: "E2E fixture finding",
    });
    scanFindingId = finding.id;
  }, 30_000);

  afterAll(async () => {
    await app.close();
    const migrator = buildMigrator();
    await migrator.down({ to: 0 });
    await closeConnection();
  }, 30_000);

  it("rejects GET .../records with 401 when there is no session cookie", async () => {
    await request(app.getHttpServer())
      .get(`/change-center/projects/${projectId}/records`)
      .expect(401);
  });

  it("allows a real super_admin session to create, read, list, and edit a change record", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDetectedRecord(cookie, { source: "manual", scanFindingId });
    expect(created.status).toBe("detected");
    expect(created.projectId).toBe(projectId);

    const getResponse = await request(app.getHttpServer())
      .get(`/change-center/projects/${projectId}/records/${created.id}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(getResponse.body.data.recordLabel).toBe("Plugin X 1.2.0 -> 1.3.0");
    expect(getResponse.body.data.scanFindingId).toBe(scanFindingId);

    const listResponse = await request(app.getHttpServer())
      .get(`/change-center/projects/${projectId}/records`)
      .set("Cookie", cookie)
      .expect(200);
    expect((listResponse.body.data as Array<{ id: string }>).some((r) => r.id === created.id)).toBe(
      true,
    );

    const updateResponse = await request(app.getHttpServer())
      .post(`/change-center/projects/${projectId}/records/${created.id}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ recordLabel: "Plugin X 1.2.0 -> 1.3.0 (revised)" })
      .expect(200);
    expect(updateResponse.body.data.recordLabel).toBe("Plugin X 1.2.0 -> 1.3.0 (revised)");
    expect(updateResponse.body.data.status).toBe("detected"); // update never touches status
  });

  it("denies change record creation with 403 for a read_only session (only V grant, not C)", async () => {
    const cookie = await cookieForNewSession(readOnlyUserId);
    await request(app.getHttpServer())
      .post(`/change-center/projects/${projectId}/records`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        publicId: uniqueId("CHG"),
        category: "plugin",
        severity: "low",
        recordLabel: "Read-only attempt",
      })
      .expect(403);
  });

  it("denies change record creation with 403 for a marketing_editor session (VRA — no C)", async () => {
    const cookie = await cookieForNewSession(marketingEditorUserId);
    await request(app.getHttpServer())
      .post(`/change-center/projects/${projectId}/records`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        publicId: uniqueId("CHG"),
        category: "plugin",
        severity: "low",
        recordLabel: "Marketing editor attempt",
      })
      .expect(403);
  });

  it("allows a real marketing_editor session to review/approve transitions (VRA grant)", async () => {
    const superAdminCookie = await cookieForNewSession(superAdminUserId);
    const editorCookie = await cookieForNewSession(marketingEditorUserId);
    const created = await createDetectedRecord(superAdminCookie);

    const toReview = await transition(editorCookie, created.id, { status: "under_review" });
    expect(toReview.status).toBe(200);
    expect(toReview.body.data.status).toBe("under_review");

    const toAccepted = await transition(editorCookie, created.id, { status: "accepted" });
    expect(toAccepted.status).toBe(200);
    expect(toAccepted.body.data.status).toBe("accepted");
    expect(toAccepted.body.data.decidedByUserId).toBe(marketingEditorUserId);
  });

  it("allows a real owner_growth_approver session to create AND transition a change record (VCERA grant)", async () => {
    const cookie = await cookieForNewSession(ownerGrowthApproverUserId);
    const created = await createDetectedRecord(cookie);
    expect(created.status).toBe("detected");

    const toReview = await transition(cookie, created.id, { status: "under_review" });
    expect(toReview.status).toBe(200);
    expect(toReview.body.data.status).toBe("under_review");
  });

  it("rejects an in-place edit once the record has moved past detected/under_review", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDetectedRecord(cookie);
    await transition(cookie, created.id, { status: "under_review" }).expect(200);
    await transition(cookie, created.id, { status: "accepted" }).expect(200);

    await request(app.getHttpServer())
      .post(`/change-center/projects/${projectId}/records/${created.id}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ recordLabel: "Should be rejected" })
      .expect(400);
  });

  it("drives a full real lifecycle: detected -> under_review -> accepted -> applying -> applied -> verified", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDetectedRecord(cookie);

    await transition(cookie, created.id, { status: "under_review" }).expect(200);
    const accepted = await transition(cookie, created.id, {
      status: "accepted",
      decisionNotes: "Looks safe to apply",
    }).expect(200);
    expect(accepted.body.data.decisionNotes).toBe("Looks safe to apply");

    await transition(cookie, created.id, { status: "applying" }).expect(200);
    const applied = await transition(cookie, created.id, { status: "applied" }).expect(200);
    expect(applied.body.data.appliedByUserId).toBe(superAdminUserId);
    expect(applied.body.data.appliedAt).not.toBeNull();

    const verified = await transition(cookie, created.id, { status: "verified" }).expect(200);
    expect(verified.body.data.status).toBe("verified");
    expect(verified.body.data.verifiedByUserId).toBe(superAdminUserId);
    expect(verified.body.data.verifiedAt).not.toBeNull();

    // verified is terminal — no further transition is legal.
    await transition(cookie, created.id, { status: "applying" }).expect(400);
  });

  it("routes through manual_merge_required before a real decision", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDetectedRecord(cookie);

    await transition(cookie, created.id, { status: "under_review" }).expect(200);
    const merge = await transition(cookie, created.id, {
      status: "manual_merge_required",
    }).expect(200);
    expect(merge.body.data.status).toBe("manual_merge_required");

    const rejected = await transition(cookie, created.id, { status: "rejected" }).expect(200);
    expect(rejected.body.data.status).toBe("rejected");
    expect(rejected.body.data.decidedByUserId).toBe(superAdminUserId);

    // rejected is terminal.
    await transition(cookie, created.id, { status: "under_review" }).expect(400);
  });

  it("retries a failed apply with rollbackGuidance, then succeeds", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDetectedRecord(cookie);

    await transition(cookie, created.id, { status: "under_review" }).expect(200);
    await transition(cookie, created.id, { status: "accepted" }).expect(200);
    await transition(cookie, created.id, { status: "applying" }).expect(200);

    const failed = await transition(cookie, created.id, {
      status: "apply_failed",
      rollbackGuidance: "Revert to plugin version 1.2.0",
    }).expect(200);
    expect(failed.body.data.status).toBe("apply_failed");
    expect(failed.body.data.rollbackGuidance).toBe("Revert to plugin version 1.2.0");

    const retryApplying = await transition(cookie, created.id, { status: "applying" }).expect(200);
    expect(retryApplying.body.data.status).toBe("applying");

    const applied = await transition(cookie, created.id, { status: "applied" }).expect(200);
    expect(applied.body.data.status).toBe("applied");
  });

  it("rejects rollbackGuidance paired with a non-apply_failed transition with a clean 400", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDetectedRecord(cookie);

    const response = await transition(cookie, created.id, {
      status: "under_review",
      rollbackGuidance: "Should not be accepted here",
    });
    expect(response.status).toBe(400);
  });

  it("rejects a create payload with only one of targetModuleKey/targetId with a clean 400", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const response = await request(app.getHttpServer())
      .post(`/change-center/projects/${projectId}/records`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        publicId: uniqueId("CHG"),
        category: "seo_metadata",
        severity: "low",
        recordLabel: "Missing pair",
        targetModuleKey: "business_knowledge_center",
      });
    expect(response.status).toBe(400);
  });

  it("accepts a create payload with both targetModuleKey and targetId set", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDetectedRecord(cookie, {
      targetModuleKey: "business_knowledge_center",
      targetId: readOnlyUserId,
    });
    expect(created.status).toBe("detected");
  });

  it("rejects a create payload with a real but unknown targetModuleKey with a clean 400", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const response = await request(app.getHttpServer())
      .post(`/change-center/projects/${projectId}/records`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        publicId: uniqueId("CHG"),
        category: "seo_metadata",
        severity: "low",
        recordLabel: "Unknown module",
        targetModuleKey: "not_a_real_module",
        targetId: readOnlyUserId,
      });
    expect(response.status).toBe(400);
  });

  it("returns 404 for a change record accessed via a different project's own route (IDOR)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDetectedRecord(cookie);

    await request(app.getHttpServer())
      .get(`/change-center/projects/${otherProjectId}/records/${created.id}`)
      .set("Cookie", cookie)
      .expect(404);
  });

  it("allows a session holding only a project-scoped grant within its own project, and denies it in another project", async () => {
    const scopedUserId = await createUserWithRole(
      "cc.scoped-owner",
      "owner_growth_approver",
      projectId,
    );
    const cookie = await cookieForNewSession(scopedUserId);

    const created = await createDetectedRecord(cookie);
    expect(created.projectId).toBe(projectId);

    await request(app.getHttpServer())
      .post(`/change-center/projects/${otherProjectId}/records`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        publicId: uniqueId("CHG"),
        category: "plugin",
        severity: "medium",
        recordLabel: "Cross-project attempt",
      })
      .expect(403);
  });
});
