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
import { PageTemplateLibraryModule } from "../src/page-template-library/page-template-library.module.js";

/**
 * Request-level coverage for the Page Template Library module HTTP surface, against a REAL
 * disposable PostgreSQL database — same harness pattern as `component-library.e2e-spec.ts`.
 * `creative_design` has real seeded grants (`00013-seed-rbac-matrix.ts:132-140`), identical to
 * Component Library's/Design Token Library's own matrix (all three modules reuse the group
 * verbatim, design decision D6):
 *   super_admin              VCERAPX  (create, edit, review, approve, publish/unpublish, export — not submit)
 *   owner_growth_approver    VERAPX   (edit, review, approve, publish, export — not create, not submit)
 *   marketing_editor         VR       (view, review only — not create, edit, submit, or approve)
 *   designer_creative_reviewer VCERAS (create, edit, review, approve, SUBMIT — the only role holding submit)
 *   qa_security_reviewer     VR       (view, review only)
 *   read_only                V        (view only)
 * This module also imports `SectionAndPatternLibraryModule` for the real `requiredSectionIds`/
 * `optionalSectionIds` existence check (design decision D2) and `ComponentLibraryModule` for the
 * real `supportedComponentIds` existence check (design decision D3) — several tests exercise both
 * cross-module validations over real HTTP.
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

describe("Page Template Library module endpoints (e2e, real disposable database)", () => {
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
  let designerCreativeReviewerUserId: string;
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

  async function createDraftPageTemplate(cookie: string, overrides: Record<string, unknown> = {}) {
    const response = await request(app.getHttpServer())
      .post("/page-template-library/page-templates")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        publicId: uniquePublicId("PGT"),
        pageType: "homepage",
        name: "E2E Fixture Page Template",
        ...overrides,
      })
      .expect(201);
    return response.body.data as {
      id: string;
      recordId: string;
      publicId: string;
      versionNumber: number;
      isCurrent: boolean;
      approvalStatus: string;
      name: string;
      requiredSectionIds: string[];
      optionalSectionIds: string[];
      supportedComponentIds: string[];
      wireframeReferences: string[];
    };
  }

  async function createDraftSectionPattern(
    cookie: string,
    overrides: Record<string, unknown> = {},
  ) {
    const response = await request(app.getHttpServer())
      .post("/section-and-pattern-library/records")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        publicId: uniquePublicId("SPL"),
        patternType: "homepage_storytelling",
        name: "E2E Section Fixture",
        ...overrides,
      })
      .expect(201);
    return response.body.data as { recordId: string };
  }

  async function createDraftComponent(cookie: string, overrides: Record<string, unknown> = {}) {
    const response = await request(app.getHttpServer())
      .post("/component-library/components")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        publicId: uniquePublicId("CMP"),
        category: "buttons",
        name: "E2E Component Fixture",
        ...overrides,
      })
      .expect(201);
    return response.body.data as { recordId: string };
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
      imports: [PageTemplateLibraryModule],
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

    superAdminUserId = await createUserWithRole("pgt.super-admin", "super_admin");
    readOnlyUserId = await createUserWithRole("pgt.read-only", "read_only");
    marketingEditorUserId = await createUserWithRole("pgt.marketing-editor", "marketing_editor");
    ownerGrowthApproverUserId = await createUserWithRole(
      "pgt.owner-growth-approver",
      "owner_growth_approver",
    );
    designerCreativeReviewerUserId = await createUserWithRole(
      "pgt.designer-creative-reviewer",
      "designer_creative_reviewer",
    );
    qaSecurityReviewerUserId = await createUserWithRole(
      "pgt.qa-security-reviewer",
      "qa_security_reviewer",
    );
  }, 30_000);

  afterAll(async () => {
    await app.close();
    const migrator = buildMigrator();
    await migrator.down({ to: 0 });
    await closeConnection();
  }, 30_000);

  it("rejects GET /page-template-library/page-templates with 401 when there is no session cookie", async () => {
    await request(app.getHttpServer()).get("/page-template-library/page-templates").expect(401);
  });

  it("allows a real super_admin session to create, read, list, and edit a page template", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftPageTemplate(cookie, { name: "Homepage Template" });
    expect(created.approvalStatus).toBe("draft");
    expect(created.versionNumber).toBe(1);
    expect(created.isCurrent).toBe(true);

    const getResponse = await request(app.getHttpServer())
      .get(`/page-template-library/page-templates/${created.recordId}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(getResponse.body.data.name).toBe("Homepage Template");

    const listResponse = await request(app.getHttpServer())
      .get("/page-template-library/page-templates")
      .set("Cookie", cookie)
      .expect(200);
    expect(
      (listResponse.body.data as Array<{ recordId: string }>).some(
        (r) => r.recordId === created.recordId,
      ),
    ).toBe(true);

    const versionsResponse = await request(app.getHttpServer())
      .get(`/page-template-library/page-templates/${created.recordId}/versions`)
      .set("Cookie", cookie)
      .expect(200);
    expect(versionsResponse.body.data).toHaveLength(1);

    const updateResponse = await request(app.getHttpServer())
      .post(`/page-template-library/page-templates/${created.recordId}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ name: "Homepage Template (revised)" })
      .expect(200);
    expect(updateResponse.body.data.name).toBe("Homepage Template (revised)");
    expect(updateResponse.body.data.approvalStatus).toBe("draft"); // update never touches status
    expect(updateResponse.body.data.id).toBe(created.id);
    expect(updateResponse.body.data.versionNumber).toBe(1);
  });

  it("denies page template creation with 403 for a read_only session (only V grant, not C)", async () => {
    const cookie = await cookieForNewSession(readOnlyUserId);
    await request(app.getHttpServer())
      .post("/page-template-library/page-templates")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: uniquePublicId("PGT"), pageType: "homepage", name: "Denied" })
      .expect(403);
  });

  it("allows a read_only session to list page templates (V grant)", async () => {
    const cookie = await cookieForNewSession(readOnlyUserId);
    await request(app.getHttpServer())
      .get("/page-template-library/page-templates")
      .set("Cookie", cookie)
      .expect(200);
  });

  it("denies page template creation with 403 for owner_growth_approver (VERAPX has no C)", async () => {
    const cookie = await cookieForNewSession(ownerGrowthApproverUserId);
    await request(app.getHttpServer())
      .post("/page-template-library/page-templates")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: uniquePublicId("PGT"), pageType: "homepage", name: "Denied" })
      .expect(403);
  });

  it("list() search treats a literal % as literal text, not a SQL wildcard (escapeLikePattern)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const uniqueSuffix = uniquePublicId("PCT");
    const wildcardMatch = await createDraftPageTemplate(cookie, {
      name: `50% Off Alert ${uniqueSuffix}`,
    });
    const plainMatch = await createDraftPageTemplate(cookie, {
      name: `50X Off Alert ${uniqueSuffix}`,
    });

    const response = await request(app.getHttpServer())
      .get("/page-template-library/page-templates")
      .query({ search: `50% Off Alert ${uniqueSuffix}` })
      .set("Cookie", cookie)
      .expect(200);
    const ids = (response.body.data as Array<{ id: string }>).map((r) => r.id);
    expect(ids).toContain(wildcardMatch.id);
    expect(ids).not.toContain(plainMatch.id);
  });

  it("rejects page template creation with 400 when publicId is already in use", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const publicId = uniquePublicId("PGT");
    await request(app.getHttpServer())
      .post("/page-template-library/page-templates")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId, pageType: "homepage", name: "First" })
      .expect(201);
    await request(app.getHttpServer())
      .post("/page-template-library/page-templates")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId, pageType: "homepage", name: "Second" })
      .expect(400);
  });

  it("rejects an empty update patch with 400", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftPageTemplate(cookie);
    await request(app.getHttpServer())
      .post(`/page-template-library/page-templates/${created.recordId}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({})
      .expect(400);
  });

  // --- requiredSectionIds/optionalSectionIds real cross-module existence validation (design decision D2) ---

  it("creates a page template whose requiredSectionIds/optionalSectionIds resolve to real, current Section and Pattern Library records", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const required = await createDraftSectionPattern(cookie);
    const optional = await createDraftSectionPattern(cookie);

    const created = await createDraftPageTemplate(cookie, {
      requiredSectionIds: [required.recordId],
      optionalSectionIds: [optional.recordId],
    });
    expect(created.requiredSectionIds).toEqual([required.recordId]);
    expect(created.optionalSectionIds).toEqual([optional.recordId]);
  });

  it("rejects a page template create with 400 when a requiredSectionIds entry does not resolve to a real section/pattern record", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .post("/page-template-library/page-templates")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        publicId: uniquePublicId("PGT"),
        pageType: "homepage",
        name: "X",
        requiredSectionIds: [randomUUID()],
      })
      .expect(400);
  });

  it("rejects a page template create with 400 when an optionalSectionIds entry does not resolve to a real section/pattern record", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .post("/page-template-library/page-templates")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        publicId: uniquePublicId("PGT"),
        pageType: "homepage",
        name: "X",
        optionalSectionIds: [randomUUID()],
      })
      .expect(400);
  });

  it("rejects a page template update with 400 when a patched requiredSectionIds entry does not resolve to a real section/pattern record", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftPageTemplate(cookie);
    await request(app.getHttpServer())
      .post(`/page-template-library/page-templates/${created.recordId}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ requiredSectionIds: [randomUUID()] })
      .expect(400);
  });

  // --- supportedComponentIds real cross-module existence validation (design decision D3) ---

  it("creates a page template whose supportedComponentIds resolve to real, current Component Library records", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const component = await createDraftComponent(cookie);

    const created = await createDraftPageTemplate(cookie, {
      supportedComponentIds: [component.recordId],
    });
    expect(created.supportedComponentIds).toEqual([component.recordId]);
  });

  it("rejects a page template create with 400 when a supportedComponentIds entry does not resolve to a real component", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .post("/page-template-library/page-templates")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        publicId: uniquePublicId("PGT"),
        pageType: "homepage",
        name: "X",
        supportedComponentIds: [randomUUID()],
      })
      .expect(400);
  });

  it("rejects a page template update with 400 when a patched supportedComponentIds entry does not resolve to a real component", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftPageTemplate(cookie);
    await request(app.getHttpServer())
      .post(`/page-template-library/page-templates/${created.recordId}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ supportedComponentIds: [randomUUID()] })
      .expect(400);
  });

  // --- wireframeReferences: plain, UNVALIDATED strings (design decision D4) ---

  it("creates a page template with arbitrary wireframeReferences strings, with no existence validation at all", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftPageTemplate(cookie, {
      wireframeReferences: ["not-a-uuid-reference", "https://figma.com/file/wireframe-1"],
    });
    expect(created.wireframeReferences).toEqual([
      "not-a-uuid-reference",
      "https://figma.com/file/wireframe-1",
    ]);
  });

  // --- replacementRecordId real in-module existence validation ---

  it("creates a page template whose replacementRecordId resolves to a real, current page template", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const original = await createDraftPageTemplate(cookie, { name: "Legacy Template" });
    const replacement = await createDraftPageTemplate(cookie, {
      name: "New Template",
      replacementRecordId: original.recordId,
    });
    expect(replacement.name).toBe("New Template");
  });

  it("rejects a page template create with 400 when replacementRecordId does not resolve to a real page template", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .post("/page-template-library/page-templates")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        publicId: uniquePublicId("PGT"),
        pageType: "homepage",
        name: "X",
        replacementRecordId: randomUUID(),
      })
      .expect(400);
  });

  // --- RBAC per-role matrix ---

  it("designer_creative_reviewer (VCERAS) alone can drive the full submit->review->approve loop (the only role holding submit)", async () => {
    const cookie = await cookieForNewSession(designerCreativeReviewerUserId);
    const created = await createDraftPageTemplate(cookie, { name: "Designer Reviewer Fixture" });

    await request(app.getHttpServer())
      .post(`/page-template-library/page-templates/${created.recordId}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/page-template-library/page-templates/${created.recordId}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "under_review" })
      .expect(200);

    const approveResponse = await request(app.getHttpServer())
      .post(`/page-template-library/page-templates/${created.recordId}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "approved" })
      .expect(200);
    expect(approveResponse.body.data.approvalStatus).toBe("approved");
  });

  it("marketing_editor (VR only) can view and review, but is denied create, submit, and approve", async () => {
    const adminCookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftPageTemplate(adminCookie, {
      name: "Marketing Editor Fixture",
    });
    const editorCookie = await cookieForNewSession(marketingEditorUserId);

    await request(app.getHttpServer())
      .post("/page-template-library/page-templates")
      .set("Cookie", editorCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: uniquePublicId("PGT"), pageType: "homepage", name: "Denied create" })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/page-template-library/page-templates/${created.recordId}/status`)
      .set("Cookie", editorCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(403);

    const reviewerCookie = await cookieForNewSession(designerCreativeReviewerUserId);
    await request(app.getHttpServer())
      .post(`/page-template-library/page-templates/${created.recordId}/status`)
      .set("Cookie", reviewerCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/page-template-library/page-templates/${created.recordId}/status`)
      .set("Cookie", editorCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "under_review" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/page-template-library/page-templates/${created.recordId}/status`)
      .set("Cookie", editorCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "approved" })
      .expect(403);
  });

  it("owner_growth_approver (VERAPX, no C, no S) is denied create and denied draft->submitted, but can review and approve once submitted", async () => {
    const reviewerCookie = await cookieForNewSession(designerCreativeReviewerUserId);
    const created = await createDraftPageTemplate(reviewerCookie, {
      name: "Owner Approver Fixture",
    });

    const approverCookie = await cookieForNewSession(ownerGrowthApproverUserId);
    await request(app.getHttpServer())
      .post(`/page-template-library/page-templates/${created.recordId}/status`)
      .set("Cookie", approverCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/page-template-library/page-templates/${created.recordId}/status`)
      .set("Cookie", reviewerCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/page-template-library/page-templates/${created.recordId}/status`)
      .set("Cookie", approverCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "under_review" })
      .expect(200);

    const approveResponse = await request(app.getHttpServer())
      .post(`/page-template-library/page-templates/${created.recordId}/status`)
      .set("Cookie", approverCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "approved" })
      .expect(200);
    expect(approveResponse.body.data.approvalStatus).toBe("approved");
  });

  it("qa_security_reviewer (VR only) can view and review, but is denied create and approve", async () => {
    const adminCookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftPageTemplate(adminCookie, { name: "QA Reviewer Fixture" });
    const reviewerCookie = await cookieForNewSession(designerCreativeReviewerUserId);
    await request(app.getHttpServer())
      .post(`/page-template-library/page-templates/${created.recordId}/status`)
      .set("Cookie", reviewerCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(200);

    const qaCookie = await cookieForNewSession(qaSecurityReviewerUserId);
    await request(app.getHttpServer())
      .post("/page-template-library/page-templates")
      .set("Cookie", qaCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ publicId: uniquePublicId("PGT"), pageType: "homepage", name: "Denied create" })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/page-template-library/page-templates/${created.recordId}/status`)
      .set("Cookie", qaCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "under_review" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/page-template-library/page-templates/${created.recordId}/status`)
      .set("Cookie", qaCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "approved" })
      .expect(403);
  });

  it("rejects an invalid approval-status transition (archived -> submitted, archived is terminal) with 400", async () => {
    const cookie = await cookieForNewSession(designerCreativeReviewerUserId);
    const created = await createDraftPageTemplate(cookie, { name: "Terminal State Fixture" });

    await request(app.getHttpServer())
      .post(`/page-template-library/page-templates/${created.recordId}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "archived" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/page-template-library/page-templates/${created.recordId}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(400);
  });

  it("rejects a direct 'approved -> superseded' status request with 400, over real HTTP (supersede is only ever an automatic side effect of a different version's own approval)", async () => {
    const reviewerCookie = await cookieForNewSession(designerCreativeReviewerUserId);
    const created = await createDraftPageTemplate(reviewerCookie, {
      name: "Direct Supersede Fixture",
    });

    await request(app.getHttpServer())
      .post(`/page-template-library/page-templates/${created.recordId}/status`)
      .set("Cookie", reviewerCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/page-template-library/page-templates/${created.recordId}/status`)
      .set("Cookie", reviewerCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "under_review" })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/page-template-library/page-templates/${created.recordId}/status`)
      .set("Cookie", reviewerCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "approved" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/page-template-library/page-templates/${created.recordId}/status`)
      .set("Cookie", reviewerCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "superseded" })
      .expect(400);

    const stillApproved = await request(app.getHttpServer())
      .get(`/page-template-library/page-templates/${created.recordId}`)
      .set("Cookie", reviewerCookie)
      .expect(200);
    expect(stillApproved.body.data.approvalStatus).toBe("approved");
  });

  it("rejects editing an archived page template with 400, over real HTTP, without mutating it (archived/superseded are terminal)", async () => {
    const cookie = await cookieForNewSession(designerCreativeReviewerUserId);
    const created = await createDraftPageTemplate(cookie, { name: "Terminal Edit Fixture" });

    await request(app.getHttpServer())
      .post(`/page-template-library/page-templates/${created.recordId}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "archived" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/page-template-library/page-templates/${created.recordId}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ name: "Should never be applied" })
      .expect(400);

    const stillOriginal = await request(app.getHttpServer())
      .get(`/page-template-library/page-templates/${created.recordId}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(stillOriginal.body.data.name).toBe("Terminal Edit Fixture");
    expect(stillOriginal.body.data.approvalStatus).toBe("archived");
  });

  it("returns 404 for a GET on a nonexistent page template id", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .get(`/page-template-library/page-templates/${randomUUID()}`)
      .set("Cookie", cookie)
      .expect(404);
  });

  it("returns 400 (not a raw 500) for a malformed page template id", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .get("/page-template-library/page-templates/not-a-uuid")
      .set("Cookie", cookie)
      .expect(400);
  });

  it("returns 404 for GET .../versions on a nonexistent page template id", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .get(`/page-template-library/page-templates/${randomUUID()}/versions`)
      .set("Cookie", cookie)
      .expect(404);
  });

  it("rejects a mutating request with no Origin header (OriginCheckGuard)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .post("/page-template-library/page-templates")
      .set("Cookie", cookie)
      .send({ publicId: uniquePublicId("PGT"), pageType: "homepage", name: "No origin" })
      .expect(403);
  });

  // --- real versioning behavior, over real HTTP, against the real database ---

  it("editing an APPROVED page template creates a genuinely new version over real HTTP, then approving the new version supersedes the old one", async () => {
    const cookie = await cookieForNewSession(designerCreativeReviewerUserId);
    const created = await createDraftPageTemplate(cookie, {
      name: "Primary V1",
      pageType: "homepage",
    });

    await request(app.getHttpServer())
      .post(`/page-template-library/page-templates/${created.recordId}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/page-template-library/page-templates/${created.recordId}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "under_review" })
      .expect(200);
    const approvedV1 = await request(app.getHttpServer())
      .post(`/page-template-library/page-templates/${created.recordId}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "approved" })
      .expect(200);
    expect(approvedV1.body.data.approvalStatus).toBe("approved");
    expect(approvedV1.body.data.versionNumber).toBe(1);

    const editResponse = await request(app.getHttpServer())
      .post(`/page-template-library/page-templates/${created.recordId}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ name: "Primary V2 (revised)" })
      .expect(200);
    expect(editResponse.body.data.id).not.toBe(created.id);
    expect(editResponse.body.data.recordId).toBe(created.recordId);
    expect(editResponse.body.data.versionNumber).toBe(2);
    expect(editResponse.body.data.isCurrent).toBe(true);
    expect(editResponse.body.data.approvalStatus).toBe("draft");

    const versionsAfterEdit = await request(app.getHttpServer())
      .get(`/page-template-library/page-templates/${created.recordId}/versions`)
      .set("Cookie", cookie)
      .expect(200);
    expect(versionsAfterEdit.body.data).toHaveLength(2);
    const v1AfterEdit = (
      versionsAfterEdit.body.data as Array<{
        id: string;
        isCurrent: boolean;
        approvalStatus: string;
      }>
    ).find((r) => r.id === created.id);
    expect(v1AfterEdit?.isCurrent).toBe(false);
    expect(v1AfterEdit?.approvalStatus).toBe("approved"); // still approved, not yet superseded

    await request(app.getHttpServer())
      .post(`/page-template-library/page-templates/${created.recordId}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "submitted" })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/page-template-library/page-templates/${created.recordId}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "under_review" })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/page-template-library/page-templates/${created.recordId}/status`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ approvalStatus: "approved" })
      .expect(200);

    const finalVersions = await request(app.getHttpServer())
      .get(`/page-template-library/page-templates/${created.recordId}/versions`)
      .set("Cookie", cookie)
      .expect(200);
    const finalV1 = (finalVersions.body.data as Array<{ id: string; approvalStatus: string }>).find(
      (r) => r.id === created.id,
    );
    const finalV2 = (
      finalVersions.body.data as Array<{
        id: string;
        approvalStatus: string;
        isCurrent: boolean;
      }>
    ).find((r) => r.id === editResponse.body.data.id);
    expect(finalV1?.approvalStatus).toBe("superseded");
    expect(finalV2?.approvalStatus).toBe("approved");
    expect(finalV2?.isCurrent).toBe(true);

    const currentPageTemplate = await request(app.getHttpServer())
      .get(`/page-template-library/page-templates/${created.recordId}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(currentPageTemplate.body.data.id).toBe(editResponse.body.data.id);
    expect(currentPageTemplate.body.data.name).toBe("Primary V2 (revised)");
  });

  it("editing a non-approved page template mutates it in place (no new version) over real HTTP", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDraftPageTemplate(cookie, {
      name: "Draft, still editable in place",
    });

    const editResponse = await request(app.getHttpServer())
      .post(`/page-template-library/page-templates/${created.recordId}/update`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ name: "Renamed while still draft" })
      .expect(200);

    expect(editResponse.body.data.id).toBe(created.id);
    expect(editResponse.body.data.versionNumber).toBe(1);

    const versions = await request(app.getHttpServer())
      .get(`/page-template-library/page-templates/${created.recordId}/versions`)
      .set("Cookie", cookie)
      .expect(200);
    expect(versions.body.data).toHaveLength(1);
  });
});
