import { randomBytes } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import {
  buildMigrator,
  CaseStudyRepository,
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
import { CaseStudyLibraryModule } from "../src/case-study-library/case-study-library.module.js";

/**
 * Request-level coverage for the Case Study Library module HTTP surface, against a REAL
 * disposable PostgreSQL database — same harness pattern as `case-study-studio.e2e-spec.ts`.
 * Reuses the `case_studies` permission group verbatim (D6 in Case Study Studio's own design
 * account, since `case_study_library`'s own module-registry entry shares that same permission
 * group), `00013-seed-rbac-matrix.ts`:
 *   super_admin              VCERAPX  (create, view, edit)
 *   owner_growth_approver    VCERAPX  (same)
 *   marketing_editor         VCESR    (create, view, edit)
 *   qa_security_reviewer     VR       (view only)
 *   developer / read_only    V        (view only)
 *
 * `CaseStudyLibraryModule` imports `CaseStudyStudioModule`/`PageInventoryModule` internally, so a
 * real parent case study is created directly via `CaseStudyRepository` (bypassing
 * `CaseStudiesService`'s own workflow gating — the same "force to X directly, no workflow
 * enforcement at the repository layer" convenience `module-case-study-studio.integration.test.ts`
 * itself already uses) rather than walking the full 14-stage lifecycle through HTTP for every
 * fixture.
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

const ORIGIN = process.env.WEB_APP_ORIGIN!;

describe("Case Study Library module endpoints (e2e, real disposable database)", () => {
  let app: INestApplication;
  let users: UserRepository;
  let roles: RoleRepository;
  let userRoles: UserRoleRepository;
  let caseStudies: CaseStudyRepository;
  let sessionService: SessionService;
  let authEnv: AuthEnv;

  let superAdminUserId: string;
  let readOnlyUserId: string;
  let marketingEditorUserId: string;

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

  /** Creates a real parent case study directly at the requested status, bypassing
   *  `CaseStudiesService`'s own workflow enforcement (that's this module's own already-tested
   *  responsibility, not this module's). Defaults to `published`, the smallest status this
   *  module's own `create()` accepts (D5). */
  async function createParentCaseStudy(
    status: "published" | "unpublished" | "archived" | "intake" = "published",
  ): Promise<string> {
    const cs = await caseStudies.create({
      publicId: uniquePublicId("CS"),
      clientName: "Acme Corp",
      projectTitle: "Website Relaunch",
    });
    if (status !== "intake") {
      await caseStudies.updateStatus(cs.id, "intake", status, null);
    }
    return cs.id;
  }

  async function createLibraryRecord(
    cookie: string,
    overrides: Record<string, unknown> = {},
  ): Promise<{ id: string; caseStudyId: string; caseStudy: { status: string } }> {
    const caseStudyId =
      (overrides.caseStudyId as string | undefined) ?? (await createParentCaseStudy());
    const response = await request(app.getHttpServer())
      .post("/case-study-library/records")
      .set("Cookie", cookie)
      .set("Origin", ORIGIN)
      .send({ publicId: uniquePublicId("CSL"), caseStudyId, ...overrides })
      .expect(201);
    return response.body.data;
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
      imports: [CaseStudyLibraryModule],
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
    caseStudies = new CaseStudyRepository();

    superAdminUserId = await createUserWithRole("cs-library.super-admin", "super_admin");
    readOnlyUserId = await createUserWithRole("cs-library.read-only", "read_only");
    marketingEditorUserId = await createUserWithRole(
      "cs-library.marketing-editor",
      "marketing_editor",
    );
  }, 30_000);

  afterAll(async () => {
    await app.close();
    const migrator = buildMigrator();
    await migrator.down({ to: 0 });
    await closeConnection();
  }, 30_000);

  it("rejects GET /case-study-library/records with 401 when there is no session cookie", async () => {
    await request(app.getHttpServer()).get("/case-study-library/records").expect(401);
  });

  it("allows a real super_admin session to create, read, list, and edit a library record", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createLibraryRecord(cookie, {
      technologies: ["Next.js", "PostgreSQL"],
      testimonials: [{ quote: "Fantastic partnership!", author: "Jane Doe", role: "VP" }],
    });
    expect(created.caseStudy.status).toBe("published");

    const getResponse = await request(app.getHttpServer())
      .get(`/case-study-library/records/${created.id}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(getResponse.body.data.technologies).toEqual(["Next.js", "PostgreSQL"]);
    expect(getResponse.body.data.caseStudy.id).toBe(created.caseStudyId);

    const listResponse = await request(app.getHttpServer())
      .get("/case-study-library/records")
      .set("Cookie", cookie)
      .expect(200);
    expect((listResponse.body.data as Array<{ id: string }>).some((r) => r.id === created.id)).toBe(
      true,
    );

    const updateResponse = await request(app.getHttpServer())
      .patch(`/case-study-library/records/${created.id}`)
      .set("Cookie", cookie)
      .set("Origin", ORIGIN)
      .send({ technologies: ["Next.js"] })
      .expect(200);
    expect(updateResponse.body.data.technologies).toEqual(["Next.js"]);
    // publicId/caseStudyId are immutable — the update payload never sent them, and the response
    // still reflects the original create-time values.
    expect(updateResponse.body.data.caseStudyId).toBe(created.caseStudyId);
  });

  it("denies library-record creation with 403 for a read_only session (only V grant, not C)", async () => {
    const cookie = await cookieForNewSession(readOnlyUserId);
    const caseStudyId = await createParentCaseStudy();
    await request(app.getHttpServer())
      .post("/case-study-library/records")
      .set("Cookie", cookie)
      .set("Origin", ORIGIN)
      .send({ publicId: uniquePublicId("CSL"), caseStudyId })
      .expect(403);
  });

  it("allows a read_only session to list and view library records (V grant)", async () => {
    const editorCookie = await cookieForNewSession(marketingEditorUserId);
    const created = await createLibraryRecord(editorCookie);

    const readOnlyCookie = await cookieForNewSession(readOnlyUserId);
    await request(app.getHttpServer())
      .get("/case-study-library/records")
      .set("Cookie", readOnlyCookie)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/case-study-library/records/${created.id}`)
      .set("Cookie", readOnlyCookie)
      .expect(200);
  });

  it("rejects creation with 400 when the parent case study has not yet reached published/unpublished/archived (D5)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const caseStudyId = await createParentCaseStudy("intake");
    await request(app.getHttpServer())
      .post("/case-study-library/records")
      .set("Cookie", cookie)
      .set("Origin", ORIGIN)
      .send({ publicId: uniquePublicId("CSL"), caseStudyId })
      .expect(400);
  });

  it("accepts creation against an unpublished or archived case study, not just published", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const unpublishedId = await createParentCaseStudy("unpublished");
    await createLibraryRecord(cookie, { caseStudyId: unpublishedId });

    const archivedId = await createParentCaseStudy("archived");
    await createLibraryRecord(cookie, { caseStudyId: archivedId });
  });

  it("rejects a second library record for the same case study with 409 (one record per case study, D1)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const caseStudyId = await createParentCaseStudy();
    await createLibraryRecord(cookie, { caseStudyId });

    await request(app.getHttpServer())
      .post("/case-study-library/records")
      .set("Cookie", cookie)
      .set("Origin", ORIGIN)
      .send({ publicId: uniquePublicId("CSL"), caseStudyId })
      .expect(409);
  });

  it("rejects creation with 400 when publicId is already in use", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const publicId = uniquePublicId("CSL");
    const firstCaseStudyId = await createParentCaseStudy();
    await createLibraryRecord(cookie, { publicId, caseStudyId: firstCaseStudyId });

    const secondCaseStudyId = await createParentCaseStudy();
    await request(app.getHttpServer())
      .post("/case-study-library/records")
      .set("Cookie", cookie)
      .set("Origin", ORIGIN)
      .send({ publicId, caseStudyId: secondCaseStudyId })
      .expect(400);
  });

  it("rejects creation with 400 when relatedPageIds references a nonexistent page (D2)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const caseStudyId = await createParentCaseStudy();
    await request(app.getHttpServer())
      .post("/case-study-library/records")
      .set("Cookie", cookie)
      .set("Origin", ORIGIN)
      .send({
        publicId: uniquePublicId("CSL"),
        caseStudyId,
        relatedPageIds: ["00000000-0000-4000-8000-000000000000"],
      })
      .expect(400);
  });

  it("rejects creation with 404 when caseStudyId does not reference a real case study", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .post("/case-study-library/records")
      .set("Cookie", cookie)
      .set("Origin", ORIGIN)
      .send({
        publicId: uniquePublicId("CSL"),
        caseStudyId: "00000000-0000-4000-8000-000000000000",
      })
      .expect(404);
  });

  it("rejects an update with a genuinely empty patch with 400", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createLibraryRecord(cookie);
    await request(app.getHttpServer())
      .patch(`/case-study-library/records/${created.id}`)
      .set("Cookie", cookie)
      .set("Origin", ORIGIN)
      .send({})
      .expect(400);
  });

  it("rejects an update with 400 once the parent case study is archived", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const archivedId = await createParentCaseStudy("archived");
    const created = await createLibraryRecord(cookie, { caseStudyId: archivedId });

    await request(app.getHttpServer())
      .patch(`/case-study-library/records/${created.id}`)
      .set("Cookie", cookie)
      .set("Origin", ORIGIN)
      .send({ technologies: ["React"] })
      .expect(400);
  });

  it("returns 404 for a missing library record", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .get("/case-study-library/records/00000000-0000-4000-8000-000000000000")
      .set("Cookie", cookie)
      .expect(404);
  });
});
