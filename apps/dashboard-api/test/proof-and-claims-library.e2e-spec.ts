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
import { ProofAndClaimsLibraryModule } from "../src/proof-and-claims-library/proof-and-claims-library.module.js";

/**
 * Request-level coverage for the Proof and Claims Library module HTTP surface, against a REAL
 * disposable PostgreSQL database — same harness pattern as `persona-library.e2e-spec.ts`.
 * `service_persona_proof` has real seeded grants (`00013-seed-rbac-matrix.ts:50,181-189`) that
 * meaningfully differ per role — this module reuses the identical group and the identical
 * three-tier submit/review/approve vocabulary:
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

describe("Proof and Claims Library module endpoints (e2e, real disposable database)", () => {
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

  async function createDraftClaim(cookie: string, overrides: Record<string, unknown> = {}) {
    const response = await request(app.getHttpServer())
      .post("/proof-and-claims-library/claims")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        publicId: uniquePublicId("PROOF"),
        claim: "E2E Fixture Claim",
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
      imports: [ProofAndClaimsLibraryModule],
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

    superAdminUserId = await createUserWithRole("prooflib.super-admin", "super_admin");
    readOnlyUserId = await createUserWithRole("prooflib.read-only", "read_only");
    marketingEditorUserId = await createUserWithRole(
      "prooflib.marketing-editor",
      "marketing_editor",
    );
    ownerGrowthApproverUserId = await createUserWithRole(
      "prooflib.owner-growth-approver",
      "owner_growth_approver",
    );
    qaSecurityReviewerUserId = await createUserWithRole(
      "prooflib.qa-security-reviewer",
      "qa_security_reviewer",
    );
  }, 30_000);

  afterAll(async () => {
    await app.close();
    const migrator = buildMigrator();
    await migrator.down({ to: 0 });
    await closeConnection();
  }, 30_000);

  it("rejects GET /proof-and-claims-library/claims with 401 when there is no session cookie", async () => {
    await request(app.getHttpServer()).get("/proof-and-claims-library/claims").expect(401);
  });

  it("allows a real super_admin session to create, read, list, and edit a claim", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftClaim(cookie, { claim: "99.9% uptime SLA" });
    expect(created.approvalStatus).toBe("draft");

    const getResponse = await request(app.getHttpServer())
      .get(`/proof-and-claims-library/claims/${created.id}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(getResponse.body.data.claim).toBe("99.9% uptime SLA");

    const listResponse = await request(app.getHttpServer())
      .get("/proof-and-claims-library/claims")
      .set("Cookie", cookie)
      .expect(200);
    expect((listResponse.body.data as Array<{ id: string }>).some((c) => c.id === created.id)).toBe(
      true,
    );

    const updateResponse = await request(app.getHttpServer())
      .post(`/proof-and-claims-library/claims/${created.id}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ claim: "99.9% uptime SLA (revised)" })
      .expect(200);
    expect(updateResponse.body.data.claim).toBe("99.9% uptime SLA (revised)");
    expect(updateResponse.body.data.approvalStatus).toBe("draft"); // update never touches status
  });

  it("denies claim creation with 403 for a read_only session (only V grant, not C)", async () => {
    const cookie = await cookieForNewSession(readOnlyUserId);
    await request(app.getHttpServer())
      .post("/proof-and-claims-library/claims")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: uniquePublicId("PROOF"), claim: "Denied" })
      .expect(403);
  });

  it("allows a read_only session to list claims (V grant)", async () => {
    const cookie = await cookieForNewSession(readOnlyUserId);
    await request(app.getHttpServer())
      .get("/proof-and-claims-library/claims")
      .set("Cookie", cookie)
      .expect(200);
  });

  it("list() search treats a literal % as literal text, not a SQL wildcard (escapeLikePattern)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const uniqueSuffix = uniquePublicId("PCT");
    const wildcardMatch = await createDraftClaim(cookie, {
      claim: `50% Off Claim ${uniqueSuffix}`,
    });
    const plainMatch = await createDraftClaim(cookie, {
      claim: `50X Off Claim ${uniqueSuffix}`,
    });

    const response = await request(app.getHttpServer())
      .get("/proof-and-claims-library/claims")
      .query({ search: `50% Off Claim ${uniqueSuffix}` })
      .set("Cookie", cookie)
      .expect(200);
    const ids = (response.body.data as Array<{ id: string }>).map((c) => c.id);
    expect(ids).toContain(wildcardMatch.id);
    expect(ids).not.toContain(plainMatch.id);
  });

  it("rejects claim creation with 400 when publicId is already in use", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const publicId = uniquePublicId("PROOF");
    await request(app.getHttpServer())
      .post("/proof-and-claims-library/claims")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId, claim: "First" })
      .expect(201);
    await request(app.getHttpServer())
      .post("/proof-and-claims-library/claims")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId, claim: "Second" })
      .expect(400);
  });

  it("creates a claim with real relatedServiceIds and round-trips relatedCaseStudyIds/relatedPageIds on GET", async () => {
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
    const created = await createDraftClaim(cookie, {
      claim: "Relationship Fixture Claim",
      relatedServiceIds: [service.id],
      relatedCaseStudyIds: ["CASE-1"],
      relatedPageIds: ["PAGE-1"],
    });

    const getResponse = await request(app.getHttpServer())
      .get(`/proof-and-claims-library/claims/${created.id}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(getResponse.body.data.relatedServiceIds).toEqual([service.id]);
    expect(getResponse.body.data.relatedCaseStudyIds).toEqual(["CASE-1"]);
    expect(getResponse.body.data.relatedPageIds).toEqual(["PAGE-1"]);
  });

  it("rejects claim creation with 400 when relatedServiceIds don't resolve to real services", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .post("/proof-and-claims-library/claims")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        publicId: uniquePublicId("PROOF"),
        claim: "X",
        relatedServiceIds: [randomUUID(), "not-even-a-uuid"],
      })
      .expect(400);
  });

  it("does not validate relatedCaseStudyIds/relatedPageIds against any table (unvalidated identifier lists)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .post("/proof-and-claims-library/claims")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        publicId: uniquePublicId("PROOF"),
        claim: "X",
        relatedCaseStudyIds: ["not-a-real-case-study"],
        relatedPageIds: ["not-a-real-page"],
      })
      .expect(201);
  });

  it("rejects an empty update patch with 400", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftClaim(cookie);
    await request(app.getHttpServer())
      .post(`/proof-and-claims-library/claims/${created.id}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({})
      .expect(400);
  });

  it("clears an array field with an explicit null, distinct from omitting it", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftClaim(cookie, {
      relatedServiceIds: [],
      relatedCaseStudyIds: ["CASE-KEEP"],
    });

    const updateResponse = await request(app.getHttpServer())
      .post(`/proof-and-claims-library/claims/${created.id}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ relatedCaseStudyIds: null })
      .expect(200);

    expect(updateResponse.body.data.relatedCaseStudyIds).toEqual([]);
  });

  it("marketing_editor (VCESR) can submit and review, but is denied approve (draft->submitted->under_review->approved)", async () => {
    const cookie = await cookieForNewSession(marketingEditorUserId);
    const created = await createDraftClaim(cookie, { claim: "Marketing Editor Fixture" });

    await request(app.getHttpServer())
      .post(`/proof-and-claims-library/claims/${created.id}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/proof-and-claims-library/claims/${created.id}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "under_review" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/proof-and-claims-library/claims/${created.id}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "approved" })
      .expect(403);
  });

  it("owner_growth_approver (VCERAX, no S) is denied draft->submitted, but can review and approve once submitted", async () => {
    const adminCookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftClaim(adminCookie, { claim: "Owner Approver Fixture" });

    const approverCookie = await cookieForNewSession(ownerGrowthApproverUserId);
    await request(app.getHttpServer())
      .post(`/proof-and-claims-library/claims/${created.id}/status`)
      .set("Cookie", approverCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(403);

    const editorCookie = await cookieForNewSession(marketingEditorUserId);
    await request(app.getHttpServer())
      .post(`/proof-and-claims-library/claims/${created.id}/status`)
      .set("Cookie", editorCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/proof-and-claims-library/claims/${created.id}/status`)
      .set("Cookie", approverCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "under_review" })
      .expect(200);

    const approveResponse = await request(app.getHttpServer())
      .post(`/proof-and-claims-library/claims/${created.id}/status`)
      .set("Cookie", approverCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "approved" })
      .expect(200);
    expect(approveResponse.body.data.approvalStatus).toBe("approved");
  });

  it("qa_security_reviewer (VR only) can view and review, but is denied create and approve", async () => {
    const adminCookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftClaim(adminCookie, { claim: "QA Reviewer Fixture" });
    const editorCookie = await cookieForNewSession(marketingEditorUserId);
    await request(app.getHttpServer())
      .post(`/proof-and-claims-library/claims/${created.id}/status`)
      .set("Cookie", editorCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(200);

    const qaCookie = await cookieForNewSession(qaSecurityReviewerUserId);
    await request(app.getHttpServer())
      .post("/proof-and-claims-library/claims")
      .set("Cookie", qaCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: uniquePublicId("PROOF"), claim: "Denied create" })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/proof-and-claims-library/claims/${created.id}/status`)
      .set("Cookie", qaCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "under_review" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/proof-and-claims-library/claims/${created.id}/status`)
      .set("Cookie", qaCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "approved" })
      .expect(403);
  });

  it("rejects an invalid approval-status transition (archived -> submitted, archived is terminal) with 400", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftClaim(cookie, { claim: "Terminal State Fixture" });

    await request(app.getHttpServer())
      .post(`/proof-and-claims-library/claims/${created.id}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "archived" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/proof-and-claims-library/claims/${created.id}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(400);
  });

  it("returns 404 for a GET on a nonexistent claim id", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .get(`/proof-and-claims-library/claims/${randomUUID()}`)
      .set("Cookie", cookie)
      .expect(404);
  });

  it("returns 400 (not a raw 500) for a malformed claim id", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .get("/proof-and-claims-library/claims/not-a-uuid")
      .set("Cookie", cookie)
      .expect(400);
  });

  it("rejects a mutating request with no Origin header (OriginCheckGuard)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .post("/proof-and-claims-library/claims")
      .set("Cookie", cookie)
      .send({ publicId: uniquePublicId("PROOF"), claim: "No origin" })
      .expect(403);
  });

  // --- claim_sources (child sub-resource) ---

  it("creates, lists, updates, and deletes a claim source, scoped to its parent claim", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftClaim(cookie, { claim: "Source Parent Fixture" });

    const createResponse = await request(app.getHttpServer())
      .post(`/proof-and-claims-library/claims/${created.id}/sources`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ source: "Third-party audit report, 2026", sourceUrl: "https://example.com/r.pdf" })
      .expect(201);
    const sourceId = createResponse.body.data.id as string;

    const listResponse = await request(app.getHttpServer())
      .get(`/proof-and-claims-library/claims/${created.id}/sources`)
      .set("Cookie", cookie)
      .expect(200);
    expect((listResponse.body.data as Array<{ id: string }>).some((s) => s.id === sourceId)).toBe(
      true,
    );

    const updateResponse = await request(app.getHttpServer())
      .post(`/proof-and-claims-library/claims/${created.id}/sources/${sourceId}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ source: "Revised source" })
      .expect(200);
    expect(updateResponse.body.data.source).toBe("Revised source");

    await request(app.getHttpServer())
      .post(`/proof-and-claims-library/claims/${created.id}/sources/${sourceId}/delete`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .expect(204);

    const listAfterDelete = await request(app.getHttpServer())
      .get(`/proof-and-claims-library/claims/${created.id}/sources`)
      .set("Cookie", cookie)
      .expect(200);
    expect(
      (listAfterDelete.body.data as Array<{ id: string }>).some((s) => s.id === sourceId),
    ).toBe(false);
  });

  it("returns 404 (IDOR prevention) when accessing a source through the wrong parent claim's route", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const claimA = await createDraftClaim(cookie, { claim: "Claim A" });
    const claimB = await createDraftClaim(cookie, { claim: "Claim B" });

    const createResponse = await request(app.getHttpServer())
      .post(`/proof-and-claims-library/claims/${claimA.id}/sources`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ source: "Belongs to claim A" })
      .expect(201);
    const sourceId = createResponse.body.data.id as string;

    // Accessed via claim B's route — must 404, not silently succeed or leak claim A's data.
    await request(app.getHttpServer())
      .post(`/proof-and-claims-library/claims/${claimB.id}/sources/${sourceId}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ source: "Attempted cross-claim edit" })
      .expect(404);

    await request(app.getHttpServer())
      .post(`/proof-and-claims-library/claims/${claimB.id}/sources/${sourceId}/delete`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .expect(404);

    // Still there, accessed via the correct claim.
    const listResponse = await request(app.getHttpServer())
      .get(`/proof-and-claims-library/claims/${claimA.id}/sources`)
      .set("Cookie", cookie)
      .expect(200);
    expect((listResponse.body.data as Array<{ id: string }>).some((s) => s.id === sourceId)).toBe(
      true,
    );
  });

  it("denies claim-source creation with 403 for a read_only session (only V grant, not E)", async () => {
    const adminCookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftClaim(adminCookie, { claim: "Read Only Source Fixture" });

    const readOnlyCookie = await cookieForNewSession(readOnlyUserId);
    await request(app.getHttpServer())
      .post(`/proof-and-claims-library/claims/${created.id}/sources`)
      .set("Cookie", readOnlyCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ source: "Denied" })
      .expect(403);
  });
});
