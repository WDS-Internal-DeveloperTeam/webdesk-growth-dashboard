import { randomBytes, randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import {
  buildMigrator,
  closeConnection,
  RoleRepository,
  ServiceCategoryRepository,
  ServiceRepository,
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
import { PersonaLibraryModule } from "../src/persona-library/persona-library.module.js";

/**
 * Request-level coverage for the Persona Library module HTTP surface, against a REAL disposable
 * PostgreSQL database — same harness pattern as `service-library.e2e-spec.ts`. `service_persona_proof`
 * has real seeded grants (`00013-seed-rbac-matrix.ts:50,181-189`) that meaningfully differ per
 * role — this module reuses the identical group and the identical three-tier
 * submit/review/approve vocabulary:
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

describe("Persona Library module endpoints (e2e, real disposable database)", () => {
  let app: INestApplication;
  let users: UserRepository;
  let roles: RoleRepository;
  let userRoles: UserRoleRepository;
  let services: ServiceRepository;
  let serviceCategories: ServiceCategoryRepository;
  let sessionService: SessionService;
  let authEnv: AuthEnv;

  let superAdminUserId: string;
  let readOnlyUserId: string;
  let marketingEditorUserId: string;
  let ownerGrowthApproverUserId: string;
  let qaSecurityReviewerUserId: string;

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

  async function createDraftPersona(cookie: string, overrides: Record<string, unknown> = {}) {
    const response = await request(app.getHttpServer())
      .post("/persona-library/personas")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        publicId: uniquePublicId("PERSONA"),
        name: "E2E Fixture Persona",
        ...overrides,
      })
      .expect(201);
    return response.body.data as {
      id: string;
      approvalStatus: string;
      version: number;
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
      imports: [PersonaLibraryModule],
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
    services = new ServiceRepository();
    serviceCategories = new ServiceCategoryRepository();

    superAdminUserId = await createUserWithRole("personalib.super-admin", "super_admin");
    readOnlyUserId = await createUserWithRole("personalib.read-only", "read_only");
    marketingEditorUserId = await createUserWithRole(
      "personalib.marketing-editor",
      "marketing_editor",
    );
    ownerGrowthApproverUserId = await createUserWithRole(
      "personalib.owner-growth-approver",
      "owner_growth_approver",
    );
    qaSecurityReviewerUserId = await createUserWithRole(
      "personalib.qa-security-reviewer",
      "qa_security_reviewer",
    );
  }, 30_000);

  afterAll(async () => {
    await app.close();
    const migrator = buildMigrator();
    await migrator.down({ to: 0 });
    await closeConnection();
  }, 30_000);

  it("rejects GET /persona-library/personas with 401 when there is no session cookie", async () => {
    await request(app.getHttpServer()).get("/persona-library/personas").expect(401);
  });

  it("allows a real super_admin session to create, read, list, and edit a persona", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftPersona(cookie, { name: "Headless Commerce IT Director" });
    expect(created.approvalStatus).toBe("draft");
    expect(created.version).toBe(1);

    const getResponse = await request(app.getHttpServer())
      .get(`/persona-library/personas/${created.id}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(getResponse.body.data.name).toBe("Headless Commerce IT Director");

    const listResponse = await request(app.getHttpServer())
      .get("/persona-library/personas")
      .set("Cookie", cookie)
      .expect(200);
    expect((listResponse.body.data as Array<{ id: string }>).some((p) => p.id === created.id)).toBe(
      true,
    );

    const updateResponse = await request(app.getHttpServer())
      .post(`/persona-library/personas/${created.id}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ name: "Headless Commerce IT Director (revised)" })
      .expect(200);
    expect(updateResponse.body.data.name).toBe("Headless Commerce IT Director (revised)");
    expect(updateResponse.body.data.approvalStatus).toBe("draft"); // update never touches status
    expect(updateResponse.body.data.version).toBe(2); // update increments version server-side
  });

  it("denies persona creation with 403 for a read_only session (only V grant, not C)", async () => {
    const cookie = await cookieForNewSession(readOnlyUserId);
    await request(app.getHttpServer())
      .post("/persona-library/personas")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: uniquePublicId("PERSONA"), name: "Denied" })
      .expect(403);
  });

  it("allows a read_only session to list personas (V grant)", async () => {
    const cookie = await cookieForNewSession(readOnlyUserId);
    await request(app.getHttpServer())
      .get("/persona-library/personas")
      .set("Cookie", cookie)
      .expect(200);
  });

  it("list() search treats a literal % as literal text, not a SQL wildcard (escapeLikePattern)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const uniqueSuffix = uniquePublicId("PCT");
    const wildcardMatch = await createDraftPersona(cookie, {
      name: `50% Off Persona ${uniqueSuffix}`,
    });
    const plainMatch = await createDraftPersona(cookie, {
      name: `50X Off Persona ${uniqueSuffix}`,
    });

    const response = await request(app.getHttpServer())
      .get("/persona-library/personas")
      .query({ search: `50% Off Persona ${uniqueSuffix}` })
      .set("Cookie", cookie)
      .expect(200);
    const ids = (response.body.data as Array<{ id: string }>).map((p) => p.id);
    expect(ids).toContain(wildcardMatch.id);
    // If "%" were treated as a wildcard, this would also incorrectly match — it must not.
    expect(ids).not.toContain(plainMatch.id);
  });

  it("rejects persona creation with 400 when publicId is already in use", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const publicId = uniquePublicId("PERSONA");
    await request(app.getHttpServer())
      .post("/persona-library/personas")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId, name: "First" })
      .expect(201);
    await request(app.getHttpServer())
      .post("/persona-library/personas")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId, name: "Second" })
      .expect(400);
  });

  it("creates a persona with real relatedServiceIds and round-trips roles/industries on GET", async () => {
    // relatedServiceIds is now validated against the real services table (code-review finding) —
    // unlike Service Library's own icpIds/relatedPageIds, whose target modules genuinely don't
    // exist yet, `services` does exist, so real ids are used here via a direct-repository fixture
    // (bypassing the full Service Library HTTP surface, which needs its own category/RBAC setup
    // out of scope for this test).
    const category = await serviceCategories.create({
      publicId: uniquePublicId("SVC-CATEGORY"),
      name: "E2E Fixture Category",
    });
    const service = await services.create({
      publicId: uniquePublicId("SVC"),
      canonicalName: "E2E Fixture Service",
      categoryId: category.id,
    });

    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftPersona(cookie, {
      name: "Relationship Fixture Persona",
      roles: ["VP Marketing", "Growth Lead"],
      industries: ["SaaS"],
      relatedServiceIds: [service.id],
    });

    const getResponse = await request(app.getHttpServer())
      .get(`/persona-library/personas/${created.id}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(getResponse.body.data.roles).toEqual(["VP Marketing", "Growth Lead"]);
    expect(getResponse.body.data.industries).toEqual(["SaaS"]);
    expect(getResponse.body.data.relatedServiceIds).toEqual([service.id]);
  });

  it("rejects persona creation with 400 when relatedServiceIds don't resolve to real services", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .post("/persona-library/personas")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        publicId: uniquePublicId("PERSONA"),
        name: "X",
        relatedServiceIds: [randomUUID(), "not-even-a-uuid"],
      })
      .expect(400);
  });

  it("rejects an empty update patch with 400 (no-op saves shouldn't burn a version)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftPersona(cookie);
    await request(app.getHttpServer())
      .post(`/persona-library/personas/${created.id}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({})
      .expect(400);
  });

  it("clears an array field with an explicit null, distinct from omitting it", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftPersona(cookie, { roles: ["CTO"], industries: ["SaaS"] });

    const updateResponse = await request(app.getHttpServer())
      .post(`/persona-library/personas/${created.id}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ roles: null })
      .expect(200);

    expect(updateResponse.body.data.roles).toEqual([]);
    expect(updateResponse.body.data.industries).toEqual(["SaaS"]);
  });

  it("marketing_editor (VCESR) can submit and review, but is denied approve (draft->submitted->under_review->approved)", async () => {
    const cookie = await cookieForNewSession(marketingEditorUserId);
    const created = await createDraftPersona(cookie, { name: "Marketing Editor Fixture" });

    await request(app.getHttpServer())
      .post(`/persona-library/personas/${created.id}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/persona-library/personas/${created.id}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "under_review" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/persona-library/personas/${created.id}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "approved" })
      .expect(403);
  });

  it("marketing_editor can revert their own submitted/rejected work back to draft (submit action, not approve)", async () => {
    const editorCookie = await cookieForNewSession(marketingEditorUserId);
    const adminCookie = await cookieForNewSession(superAdminUserId);

    // submitted -> draft: the editor un-submits their own work.
    const p1 = await createDraftPersona(editorCookie, { name: "Revert From Submitted" });
    await request(app.getHttpServer())
      .post(`/persona-library/personas/${p1.id}/status`)
      .set("Cookie", editorCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/persona-library/personas/${p1.id}/status`)
      .set("Cookie", editorCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "draft" })
      .expect(200);

    // rejected -> draft: the editor picks their rejected work back up to revise.
    const p2 = await createDraftPersona(editorCookie, { name: "Revert From Rejected" });
    await request(app.getHttpServer())
      .post(`/persona-library/personas/${p2.id}/status`)
      .set("Cookie", editorCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/persona-library/personas/${p2.id}/status`)
      .set("Cookie", editorCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "under_review" })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/persona-library/personas/${p2.id}/status`)
      .set("Cookie", adminCookie) // only super_admin/owner_growth_approver hold "approve" (rejects too)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "rejected" })
      .expect(200);
    const revertResponse = await request(app.getHttpServer())
      .post(`/persona-library/personas/${p2.id}/status`)
      .set("Cookie", editorCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "draft" })
      .expect(200);
    expect(revertResponse.body.data.approvalStatus).toBe("draft");
  });

  it("owner_growth_approver (VCERAX, no S) is denied draft->submitted, but can review and approve once submitted", async () => {
    const adminCookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftPersona(adminCookie, {
      name: "Owner Approver Fixture",
    });

    const approverCookie = await cookieForNewSession(ownerGrowthApproverUserId);
    await request(app.getHttpServer())
      .post(`/persona-library/personas/${created.id}/status`)
      .set("Cookie", approverCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(403);

    // Neither super_admin nor owner_growth_approver holds "submit" (VCERAMX/VCERAX, no S) — only
    // marketing_editor does. A real marketing_editor submits it so the owner_growth_approver's
    // own review/approve path can be exercised.
    const editorCookie = await cookieForNewSession(marketingEditorUserId);
    await request(app.getHttpServer())
      .post(`/persona-library/personas/${created.id}/status`)
      .set("Cookie", editorCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/persona-library/personas/${created.id}/status`)
      .set("Cookie", approverCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "under_review" })
      .expect(200);

    const approveResponse = await request(app.getHttpServer())
      .post(`/persona-library/personas/${created.id}/status`)
      .set("Cookie", approverCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "approved" })
      .expect(200);
    expect(approveResponse.body.data.approvalStatus).toBe("approved");
  });

  it("qa_security_reviewer (VR only) can view and review, but is denied create and approve", async () => {
    const adminCookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftPersona(adminCookie, { name: "QA Reviewer Fixture" });
    // Neither super_admin nor qa_security_reviewer holds "submit" — only marketing_editor does.
    const editorCookie = await cookieForNewSession(marketingEditorUserId);
    await request(app.getHttpServer())
      .post(`/persona-library/personas/${created.id}/status`)
      .set("Cookie", editorCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(200);

    const qaCookie = await cookieForNewSession(qaSecurityReviewerUserId);
    await request(app.getHttpServer())
      .post("/persona-library/personas")
      .set("Cookie", qaCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: uniquePublicId("PERSONA"), name: "Denied create" })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/persona-library/personas/${created.id}/status`)
      .set("Cookie", qaCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "under_review" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/persona-library/personas/${created.id}/status`)
      .set("Cookie", qaCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "approved" })
      .expect(403);
  });

  it("rejects an invalid approval-status transition (archived -> submitted, archived is terminal) with 400", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftPersona(cookie, { name: "Terminal State Fixture" });

    await request(app.getHttpServer())
      .post(`/persona-library/personas/${created.id}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "archived" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/persona-library/personas/${created.id}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(400);
  });

  // A genuine concurrent-request-level race (two real HTTP requests via Promise.all()) is not
  // deterministically reproducible here: PersonasService.changeApprovalStatus() treats
  // re-requesting the persona's own already-current status as a harmless no-op (mirroring
  // ServicesService's identical short-circuit), so if the loser's fresh findById() read happens
  // to land after the winner's write has committed, it legitimately observes the new status and
  // either takes the no-op path or issues a now-valid compare-and-swap of its own — both correct
  // outcomes, neither a 409. The repository-level atomic compare-and-swap itself (loser sees a
  // real "conflict" outcome, no partial write) is proven deterministically instead, in
  // packages/database/test/module-persona-library.integration.test.ts's own
  // "updateStatus() reports conflict" test and in this file's mocked service-level equivalent —
  // matching the precedent that Service Library's own e2e suite doesn't attempt this race either.

  it("returns 404 for a GET on a nonexistent persona id", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .get(`/persona-library/personas/${randomUUID()}`)
      .set("Cookie", cookie)
      .expect(404);
  });

  it("returns 400 (not a raw 500) for a malformed persona id", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .get("/persona-library/personas/not-a-uuid")
      .set("Cookie", cookie)
      .expect(400);
  });

  it("rejects a mutating request with no Origin header (OriginCheckGuard)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .post("/persona-library/personas")
      .set("Cookie", cookie)
      .send({ publicId: uniquePublicId("PERSONA"), name: "No origin" })
      .expect(403);
  });
});
