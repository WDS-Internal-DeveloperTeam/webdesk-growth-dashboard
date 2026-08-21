import { randomBytes, randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import {
  buildMigrator,
  closeConnection,
  DeliverableRepository,
  EngagementModelRepository,
  PlatformTechnologyRepository,
  RoleRepository,
  ServiceCategoryRepository,
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
import { ServiceLibraryModule } from "../src/service-library/service-library.module.js";

/**
 * Request-level coverage for the Service Library module HTTP surface
 * (docs/task-packages/module-service-library.md), against a REAL disposable PostgreSQL database —
 * same harness pattern as ../test/business-knowledge.e2e-spec.ts. `service_persona_proof` has real
 * seeded grants (00013-seed-rbac-matrix.ts:50,181-189) that meaningfully differ per role in a way
 * BKC's own two-role split doesn't fully exercise — three distinct tiers (submit/review/approve),
 * not two, per task package D5:
 *   super_admin              VCERAMX  (create, edit, review, approve — not submit)
 *   owner_growth_approver    VCERAX   (create, edit, review, approve — not submit)
 *   marketing_editor         VCESR    (create, edit, submit, review — not approve)
 *   qa_security_reviewer     VR       (view, review only)
 *   read_only                V        (view only)
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

describe("Service Library module endpoints (e2e, real disposable database)", () => {
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
  let qaSecurityReviewerUserId: string;
  let categoryId: string;

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

  async function createDraftService(cookie: string, overrides: Record<string, unknown> = {}) {
    const response = await request(app.getHttpServer())
      .post("/service-library/services")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        publicId: uniquePublicId("SVC"),
        canonicalName: "E2E Fixture Service",
        categoryId,
        ...overrides,
      })
      .expect(201);
    return response.body.data as { id: string; approvalStatus: string };
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
      imports: [ServiceLibraryModule],
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

    superAdminUserId = await createUserWithRole("svclib.super-admin", "super_admin");
    readOnlyUserId = await createUserWithRole("svclib.read-only", "read_only");
    marketingEditorUserId = await createUserWithRole("svclib.marketing-editor", "marketing_editor");
    ownerGrowthApproverUserId = await createUserWithRole(
      "svclib.owner-growth-approver",
      "owner_growth_approver",
    );
    qaSecurityReviewerUserId = await createUserWithRole(
      "svclib.qa-security-reviewer",
      "qa_security_reviewer",
    );

    const categories = new ServiceCategoryRepository();
    const category = await categories.create({
      publicId: uniquePublicId("CAT"),
      name: "E2E Category",
    });
    categoryId = category.id;
  }, 30_000);

  afterAll(async () => {
    await app.close();
    const migrator = buildMigrator();
    await migrator.down({ to: 0 });
    await closeConnection();
  }, 30_000);

  it("rejects GET /service-library/services with 401 when there is no session cookie", async () => {
    await request(app.getHttpServer()).get("/service-library/services").expect(401);
  });

  it("allows a real super_admin session to create, read, list, and edit a service", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftService(cookie, { canonicalName: "Headless Commerce Build" });
    expect(created.approvalStatus).toBe("draft");

    const getResponse = await request(app.getHttpServer())
      .get(`/service-library/services/${created.id}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(getResponse.body.data.canonicalName).toBe("Headless Commerce Build");
    expect(getResponse.body.data.publicationStatus).toBe("draft");

    const listResponse = await request(app.getHttpServer())
      .get("/service-library/services")
      .query({ categoryId })
      .set("Cookie", cookie)
      .expect(200);
    expect((listResponse.body.data as Array<{ id: string }>).some((s) => s.id === created.id)).toBe(
      true,
    );

    const updateResponse = await request(app.getHttpServer())
      .post(`/service-library/services/${created.id}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ canonicalName: "Headless Commerce Build (revised)" })
      .expect(200);
    expect(updateResponse.body.data.canonicalName).toBe("Headless Commerce Build (revised)");
    expect(updateResponse.body.data.approvalStatus).toBe("draft"); // update never touches status
  });

  it("denies service creation with 403 for a read_only session (only V grant, not C)", async () => {
    const cookie = await cookieForNewSession(readOnlyUserId);
    await request(app.getHttpServer())
      .post("/service-library/services")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: uniquePublicId("SVC"), canonicalName: "Denied", categoryId })
      .expect(403);
  });

  it("allows a read_only session to list services (V grant)", async () => {
    const cookie = await cookieForNewSession(readOnlyUserId);
    await request(app.getHttpServer())
      .get("/service-library/services")
      .set("Cookie", cookie)
      .expect(200);
  });

  it("rejects service creation with 400 when categoryId does not exist", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .post("/service-library/services")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        publicId: uniquePublicId("SVC"),
        canonicalName: "No category",
        categoryId: randomUUID(),
      })
      .expect(400);
  });

  it("creates a service with deliverable/platform/engagement-model relationships and round-trips them on GET", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const deliverables = new DeliverableRepository();
    const platforms = new PlatformTechnologyRepository();
    const engagementModels = new EngagementModelRepository();
    const deliverable = await deliverables.create({
      publicId: uniquePublicId("DEL"),
      name: "Onboarding",
    });
    const platform = await platforms.create({
      publicId: uniquePublicId("PLATFORM"),
      name: "Shopify",
    });
    const engagementModel = await engagementModels.create({
      publicId: uniquePublicId("EM"),
      name: "Retainer",
    });

    const created = await createDraftService(cookie, {
      canonicalName: "Relationship Fixture",
      icpIds: ["ICP-1"],
      relatedPageIds: ["page-abc"],
      relatedCaseStudyIds: ["CS-1"],
      deliverableIds: [deliverable.id],
      platformIds: [platform.id],
      engagementModelIds: [engagementModel.id],
    });

    const getResponse = await request(app.getHttpServer())
      .get(`/service-library/services/${created.id}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(getResponse.body.data.icpIds).toEqual(["ICP-1"]);
    expect(getResponse.body.data.relatedPageIds).toEqual(["page-abc"]);
    expect(getResponse.body.data.relatedCaseStudyIds).toEqual(["CS-1"]);
    expect(getResponse.body.data.deliverableIds).toEqual([deliverable.id]);
    expect(getResponse.body.data.platformIds).toEqual([platform.id]);
    expect(getResponse.body.data.engagementModelIds).toEqual([engagementModel.id]);

    // update() replaces the relationship set wholesale — clearing to [] removes every link.
    await request(app.getHttpServer())
      .post(`/service-library/services/${created.id}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ deliverableIds: [] })
      .expect(200);
    const afterClear = await request(app.getHttpServer())
      .get(`/service-library/services/${created.id}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(afterClear.body.data.deliverableIds).toEqual([]);
    expect(afterClear.body.data.platformIds).toEqual([platform.id]); // untouched — not included in that patch
  });

  it("marketing_editor (VCESR) can submit and review, but is denied approve (draft->submitted->under_review->approved)", async () => {
    const cookie = await cookieForNewSession(marketingEditorUserId);
    const created = await createDraftService(cookie, { canonicalName: "Marketing Editor Fixture" });

    await request(app.getHttpServer())
      .post(`/service-library/services/${created.id}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/service-library/services/${created.id}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "under_review" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/service-library/services/${created.id}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "approved" })
      .expect(403);
  });

  it("owner_growth_approver (VCERAX, no S) is denied draft->submitted, but can review and approve once submitted", async () => {
    const adminCookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftService(adminCookie, {
      canonicalName: "Owner Approver Fixture",
    });

    const approverCookie = await cookieForNewSession(ownerGrowthApproverUserId);
    await request(app.getHttpServer())
      .post(`/service-library/services/${created.id}/status`)
      .set("Cookie", approverCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(403);

    // Neither super_admin nor owner_growth_approver holds "submit" (VCERAMX/VCERAX, no S) —
    // only marketing_editor does. A real marketing_editor submits it so the
    // owner_growth_approver's own review/approve path can be exercised.
    const editorCookie = await cookieForNewSession(marketingEditorUserId);
    await request(app.getHttpServer())
      .post(`/service-library/services/${created.id}/status`)
      .set("Cookie", editorCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/service-library/services/${created.id}/status`)
      .set("Cookie", approverCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "under_review" })
      .expect(200);

    const approveResponse = await request(app.getHttpServer())
      .post(`/service-library/services/${created.id}/status`)
      .set("Cookie", approverCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "approved" })
      .expect(200);
    expect(approveResponse.body.data.approvalStatus).toBe("approved");
  });

  it("qa_security_reviewer (VR only) can view and review, but is denied create and approve", async () => {
    const adminCookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftService(adminCookie, { canonicalName: "QA Reviewer Fixture" });
    // Neither super_admin nor qa_security_reviewer holds "submit" — only marketing_editor does.
    const editorCookie = await cookieForNewSession(marketingEditorUserId);
    await request(app.getHttpServer())
      .post(`/service-library/services/${created.id}/status`)
      .set("Cookie", editorCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(200);

    const qaCookie = await cookieForNewSession(qaSecurityReviewerUserId);
    await request(app.getHttpServer())
      .post("/service-library/services")
      .set("Cookie", qaCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: uniquePublicId("SVC"), canonicalName: "Denied create", categoryId })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/service-library/services/${created.id}/status`)
      .set("Cookie", qaCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "under_review" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/service-library/services/${created.id}/status`)
      .set("Cookie", qaCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "approved" })
      .expect(403);
  });

  it("rejects an invalid approval-status transition (archived -> submitted, archived is terminal) with 400", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftService(cookie, { canonicalName: "Terminal State Fixture" });

    await request(app.getHttpServer())
      .post(`/service-library/services/${created.id}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "archived" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/service-library/services/${created.id}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(400);
  });

  it("returns 404 for a GET on a nonexistent service id", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .get(`/service-library/services/${randomUUID()}`)
      .set("Cookie", cookie)
      .expect(404);
  });

  it("returns 400 (not a raw 500) for a malformed service id", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .get("/service-library/services/not-a-uuid")
      .set("Cookie", cookie)
      .expect(400);
  });

  it("rejects a mutating request with no Origin header (OriginCheckGuard)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .post("/service-library/services")
      .set("Cookie", cookie)
      .send({ publicId: uniquePublicId("SVC"), canonicalName: "No origin", categoryId })
      .expect(403);
  });

  describe("dimension endpoints (read-only in this pass)", () => {
    it("lists categories/deliverables/platforms/engagement-models for a read_only session", async () => {
      const cookie = await cookieForNewSession(readOnlyUserId);
      await request(app.getHttpServer())
        .get("/service-library/categories")
        .set("Cookie", cookie)
        .expect(200);
      await request(app.getHttpServer())
        .get("/service-library/deliverables")
        .set("Cookie", cookie)
        .expect(200);
      await request(app.getHttpServer())
        .get("/service-library/platforms")
        .set("Cookie", cookie)
        .expect(200);
      await request(app.getHttpServer())
        .get("/service-library/engagement-models")
        .set("Cookie", cookie)
        .expect(200);
    });

    it("rejects dimension listing with 401 when there is no session cookie", async () => {
      await request(app.getHttpServer()).get("/service-library/categories").expect(401);
    });
  });
});
