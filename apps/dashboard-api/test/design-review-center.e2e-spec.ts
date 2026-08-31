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
import { DesignReviewCenterModule } from "../src/design-review-center/design-review-center.module.js";

/**
 * Request-level coverage for the Design Review Center module HTTP surface, against a REAL
 * disposable PostgreSQL database — same harness pattern as
 * `review-and-approval-center.e2e-spec.ts`. `review_center` has real seeded grants
 * (`00013-seed-rbac-matrix.ts:208-215`), shared with Review and Approval Center per this module's
 * own scope doc:
 *   super_admin              VCERA  (view, create, edit, review, approve)
 *   owner_growth_approver    VCERA  (same as super_admin)
 *   marketing_editor         VRA    (view, review, approve — NOT create, NOT edit)
 *   designer_creative_reviewer VRA  (same as marketing_editor)
 *   developer                VRA    (same as marketing_editor)
 *   qa_security_reviewer     VRA    (same as marketing_editor)
 *   read_only                V      (view only)
 *
 * This module has no `edit`-gated route at all (no delegate/pause/resume — D5), so unlike
 * `review-and-approval-center.e2e-spec.ts`'s own suite, there is no scenario distinguishing the
 * VRA roles from super_admin/owner_growth_approver beyond `create`.
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

describe("Design Review Center module endpoints (e2e, real disposable database)", () => {
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
  let designerCreativeReviewerUserId: string;

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

  async function createDesignReview(
    cookie: string,
    overrides: Record<string, unknown> = {},
  ): Promise<{ id: string; status: string; submittedByUserId: string; reviewType: string }> {
    const response = await request(app.getHttpServer())
      .post("/design-reviews")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        targetModuleKey: "component_library",
        targetId: randomUUID(),
        reviewType: "ui",
        ...overrides,
      })
      .expect(201);
    return response.body.data as {
      id: string;
      status: string;
      submittedByUserId: string;
      reviewType: string;
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
      imports: [DesignReviewCenterModule],
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

    superAdminUserId = await createUserWithRole("drc.super-admin", "super_admin");
    readOnlyUserId = await createUserWithRole("drc.read-only", "read_only");
    marketingEditorUserId = await createUserWithRole("drc.marketing-editor", "marketing_editor");
    ownerGrowthApproverUserId = await createUserWithRole(
      "drc.owner-growth-approver",
      "owner_growth_approver",
    );
    qaSecurityReviewerUserId = await createUserWithRole(
      "drc.qa-security-reviewer",
      "qa_security_reviewer",
    );
    designerCreativeReviewerUserId = await createUserWithRole(
      "drc.designer-creative-reviewer",
      "designer_creative_reviewer",
    );
  }, 30_000);

  afterAll(async () => {
    await app.close();
    const migrator = buildMigrator();
    await migrator.down({ to: 0 });
    await closeConnection();
  }, 30_000);

  it("rejects GET /design-reviews with 401 when there is no session cookie", async () => {
    await request(app.getHttpServer()).get("/design-reviews").expect(401);
  });

  it("(a) a review_center-holding role (super_admin) can create, list, and view a design review", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDesignReview(cookie, { targetLabel: "A real component" });
    expect(created.status).toBe("submitted");
    expect(created.reviewType).toBe("ui");

    const getResponse = await request(app.getHttpServer())
      .get(`/design-reviews/${created.id}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(getResponse.body.data.targetLabel).toBe("A real component");

    const listResponse = await request(app.getHttpServer())
      .get("/design-reviews")
      .set("Cookie", cookie)
      .expect(200);
    expect((listResponse.body.data as Array<{ id: string }>).some((r) => r.id === created.id)).toBe(
      true,
    );
  });

  it("(b) denies design review creation with 403 for a read_only session (V only, not C)", async () => {
    const cookie = await cookieForNewSession(readOnlyUserId);
    await request(app.getHttpServer())
      .post("/design-reviews")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ targetModuleKey: "component_library", targetId: randomUUID(), reviewType: "ui" })
      .expect(403);
  });

  it("allows a read_only session to list and view design reviews (V grant)", async () => {
    const adminCookie = await cookieForNewSession(superAdminUserId);
    const created = await createDesignReview(adminCookie);
    const readOnlyCookie = await cookieForNewSession(readOnlyUserId);

    await request(app.getHttpServer())
      .get("/design-reviews")
      .set("Cookie", readOnlyCookie)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/design-reviews/${created.id}`)
      .set("Cookie", readOnlyCookie)
      .expect(200);
  });

  it("rejects creation with 400 when targetModuleKey does not resolve to a real module (D9)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .post("/design-reviews")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ targetModuleKey: "no-such-module-key", targetId: randomUUID(), reviewType: "ui" })
      .expect(400);
  });

  it("rejects creation with 400 when reviewType is not one of the 9 real values", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .post("/design-reviews")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        targetModuleKey: "component_library",
        targetId: randomUUID(),
        reviewType: "not_a_real_review_type",
      })
      .expect(400);
  });

  it("rejects creation with 400 when assignedToUserId doesn't resolve to a real user", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .post("/design-reviews")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        targetModuleKey: "component_library",
        targetId: randomUUID(),
        reviewType: "ui",
        assignedToUserId: randomUUID(),
      })
      .expect(400);
  });

  it("(c) separation of duties genuinely blocks a submitter from deciding their own design review, via a real HTTP 403", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDesignReview(cookie);
    expect(created.submittedByUserId).toBe(superAdminUserId);

    // super_admin holds "approve" (VCERA) — RBAC alone would allow this; the block must come from
    // separation of duties, not a missing grant.
    await request(app.getHttpServer())
      .post(`/design-reviews/${created.id}/decide`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ action: "approve", expectedStatus: "submitted" })
      .expect(403);

    const stillSubmitted = await request(app.getHttpServer())
      .get(`/design-reviews/${created.id}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(stillSubmitted.body.data.status).toBe("submitted");
  });

  it("a different, distinct approver can decide a design review the submitter cannot decide themselves", async () => {
    const submitterCookie = await cookieForNewSession(superAdminUserId);
    const approverCookie = await cookieForNewSession(ownerGrowthApproverUserId);
    const created = await createDesignReview(submitterCookie);

    const decideResponse = await request(app.getHttpServer())
      .post(`/design-reviews/${created.id}/decide`)
      .set("Cookie", approverCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ action: "approve_with_notes", notes: "Looks solid", expectedStatus: "submitted" })
      .expect(200);
    expect(decideResponse.body.data.status).toBe("approved");
    expect(decideResponse.body.data.decidedByUserId).toBe(ownerGrowthApproverUserId);
  });

  it("(d) marketing_editor (VRA) is denied a nonexistent /delegate route with 404, but can decide() with request_revision", async () => {
    const submitterCookie = await cookieForNewSession(superAdminUserId);
    const editorCookie = await cookieForNewSession(marketingEditorUserId);
    const created = await createDesignReview(submitterCookie);

    // This module has no delegate/pause/resume route at all (D5) — unlike Review and Approval
    // Center's sibling suite, there is no /edit-gated action to distinguish VRA from VCERA here.
    await request(app.getHttpServer())
      .post(`/design-reviews/${created.id}/delegate`)
      .set("Cookie", editorCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ assignedToUserId: marketingEditorUserId })
      .expect(404);

    const decideResponse = await request(app.getHttpServer())
      .post(`/design-reviews/${created.id}/decide`)
      .set("Cookie", editorCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ action: "request_revision", expectedStatus: "submitted" })
      .expect(200);
    expect(decideResponse.body.data.status).toBe("revision_requested");
  });

  it("returns 409 re-deciding an already-terminal design review — approved/rejected can never be reversed", async () => {
    const submitterCookie = await cookieForNewSession(superAdminUserId);
    const approverCookie = await cookieForNewSession(ownerGrowthApproverUserId);
    const created = await createDesignReview(submitterCookie);

    await request(app.getHttpServer())
      .post(`/design-reviews/${created.id}/decide`)
      .set("Cookie", approverCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ action: "approve", expectedStatus: "submitted" })
      .expect(200);

    // A caller who observed the design review as "approved" and replays that as expectedStatus
    // must never be able to flip it to "rejected".
    await request(app.getHttpServer())
      .post(`/design-reviews/${created.id}/decide`)
      .set("Cookie", approverCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ action: "reject", expectedStatus: "approved" })
      .expect(409);

    const stillApproved = await request(app.getHttpServer())
      .get(`/design-reviews/${created.id}`)
      .set("Cookie", submitterCookie)
      .expect(200);
    expect(stillApproved.body.data.status).toBe("approved");
  });

  it("GET /design-reviews/:id/decisions lists the design review's decision history", async () => {
    const submitterCookie = await cookieForNewSession(superAdminUserId);
    const approverCookie = await cookieForNewSession(ownerGrowthApproverUserId);
    const created = await createDesignReview(submitterCookie);

    await request(app.getHttpServer())
      .post(`/design-reviews/${created.id}/decide`)
      .set("Cookie", approverCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ action: "approve_with_notes", notes: "Looks good", expectedStatus: "submitted" })
      .expect(200);

    const decisionsResponse = await request(app.getHttpServer())
      .get(`/design-reviews/${created.id}/decisions`)
      .set("Cookie", submitterCookie)
      .expect(200);
    expect(decisionsResponse.body.data).toHaveLength(1);
    expect(decisionsResponse.body.data[0].action).toBe("approve_with_notes");
    expect(decisionsResponse.body.data[0].notes).toBe("Looks good");
  });

  it("GET /design-reviews/:id/decisions returns 404 for a nonexistent design review", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .get(`/design-reviews/${randomUUID()}/decisions`)
      .set("Cookie", cookie)
      .expect(404);
  });

  it("?assignedToMe=true resolves to the caller's own id", async () => {
    const adminCookie = await cookieForNewSession(superAdminUserId);
    const created = await createDesignReview(adminCookie, {
      assignedToUserId: qaSecurityReviewerUserId,
    });

    const qaCookie = await cookieForNewSession(qaSecurityReviewerUserId);
    const listResponse = await request(app.getHttpServer())
      .get("/design-reviews?assignedToMe=true")
      .set("Cookie", qaCookie)
      .expect(200);
    expect((listResponse.body.data as Array<{ id: string }>).some((r) => r.id === created.id)).toBe(
      true,
    );

    const otherCookie = await cookieForNewSession(designerCreativeReviewerUserId);
    const otherListResponse = await request(app.getHttpServer())
      .get("/design-reviews?assignedToMe=true")
      .set("Cookie", otherCookie)
      .expect(200);
    expect(
      (otherListResponse.body.data as Array<{ id: string }>).some((r) => r.id === created.id),
    ).toBe(false);
  });

  it("?reviewType= filters list results", async () => {
    const adminCookie = await cookieForNewSession(superAdminUserId);
    const uxReview = await createDesignReview(adminCookie, { reviewType: "ux" });
    await createDesignReview(adminCookie, { reviewType: "motion" });

    const listResponse = await request(app.getHttpServer())
      .get("/design-reviews?reviewType=ux")
      .set("Cookie", adminCookie)
      .expect(200);
    const ids = (listResponse.body.data as Array<{ id: string; reviewType: string }>).map(
      (r) => r.id,
    );
    expect(ids).toContain(uxReview.id);
    for (const row of listResponse.body.data as Array<{ reviewType: string }>) {
      expect(row.reviewType).toBe("ux");
    }
  });

  it("(e) the atomic compare-and-swap returns a real 409 (not both succeeding) when two decisions race over real HTTP", async () => {
    const submitterCookie = await cookieForNewSession(superAdminUserId);
    const created = await createDesignReview(submitterCookie);

    // Two genuinely distinct, non-submitter approvers, both holding "approve" — neither is the
    // submitter, so separation of duties doesn't interfere; the CAS on expectedStatus is what
    // decides this race.
    const qaCookie = await cookieForNewSession(qaSecurityReviewerUserId);
    const designerCookie = await cookieForNewSession(designerCreativeReviewerUserId);

    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post(`/design-reviews/${created.id}/decide`)
        .set("Cookie", qaCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ action: "approve", expectedStatus: "submitted" }),
      request(app.getHttpServer())
        .post(`/design-reviews/${created.id}/decide`)
        .set("Cookie", designerCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ action: "reject", expectedStatus: "submitted" }),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 409]);

    const finalGet = await request(app.getHttpServer())
      .get(`/design-reviews/${created.id}`)
      .set("Cookie", submitterCookie)
      .expect(200);
    expect(["approved", "rejected"]).toContain(finalGet.body.data.status);
  });

  it("rejects an invalid decide() action-vs-expectedStatus payload with 400 (Zod validation)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDesignReview(cookie);
    await request(app.getHttpServer())
      .post(`/design-reviews/${created.id}/decide`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ action: "not_a_real_action", expectedStatus: "submitted" })
      .expect(400);
  });

  it("rejects a direct request for the 'supersede' action with 400 — it is never a directly-requested decide() action (D4)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createDesignReview(cookie);
    await request(app.getHttpServer())
      .post(`/design-reviews/${created.id}/decide`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ action: "supersede", expectedStatus: "submitted" })
      .expect(400);
  });

  describe("automatic supersede on approve (D4), end-to-end over real HTTP", () => {
    it("approving a new design review for the SAME (targetModuleKey, targetId, reviewType) tuple automatically supersedes the previously-approved one", async () => {
      const submitterCookie = await cookieForNewSession(superAdminUserId);
      const approverCookie = await cookieForNewSession(ownerGrowthApproverUserId);
      const targetId = randomUUID();

      const original = await createDesignReview(submitterCookie, {
        targetModuleKey: "design_token_library",
        targetId,
        reviewType: "creative_direction",
      });
      await request(app.getHttpServer())
        .post(`/design-reviews/${original.id}/decide`)
        .set("Cookie", approverCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ action: "approve", expectedStatus: "submitted" })
        .expect(200);

      const replacement = await createDesignReview(submitterCookie, {
        targetModuleKey: "design_token_library",
        targetId,
        reviewType: "creative_direction",
      });
      const replacementDecide = await request(app.getHttpServer())
        .post(`/design-reviews/${replacement.id}/decide`)
        .set("Cookie", approverCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ action: "approve", expectedStatus: "submitted" })
        .expect(200);
      expect(replacementDecide.body.data.status).toBe("approved");

      const originalAfter = await request(app.getHttpServer())
        .get(`/design-reviews/${original.id}`)
        .set("Cookie", submitterCookie)
        .expect(200);
      expect(originalAfter.body.data.status).toBe("superseded");

      const originalDecisions = await request(app.getHttpServer())
        .get(`/design-reviews/${original.id}/decisions`)
        .set("Cookie", submitterCookie)
        .expect(200);
      const supersedeDecision = (
        originalDecisions.body.data as Array<{ action: string; actorUserId: string }>
      ).find((d) => d.action === "supersede");
      expect(supersedeDecision?.actorUserId).toBe(ownerGrowthApproverUserId);
    });

    it("does NOT supersede an approved review for a DIFFERENT reviewType on the same target", async () => {
      const submitterCookie = await cookieForNewSession(superAdminUserId);
      const approverCookie = await cookieForNewSession(ownerGrowthApproverUserId);
      const targetId = randomUUID();

      const uiReview = await createDesignReview(submitterCookie, {
        targetModuleKey: "component_library",
        targetId,
        reviewType: "ui",
      });
      await request(app.getHttpServer())
        .post(`/design-reviews/${uiReview.id}/decide`)
        .set("Cookie", approverCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ action: "approve", expectedStatus: "submitted" })
        .expect(200);

      const uxReview = await createDesignReview(submitterCookie, {
        targetModuleKey: "component_library",
        targetId,
        reviewType: "ux",
      });
      await request(app.getHttpServer())
        .post(`/design-reviews/${uxReview.id}/decide`)
        .set("Cookie", approverCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ action: "approve", expectedStatus: "submitted" })
        .expect(200);

      const uiAfter = await request(app.getHttpServer())
        .get(`/design-reviews/${uiReview.id}`)
        .set("Cookie", submitterCookie)
        .expect(200);
      expect(uiAfter.body.data.status).toBe("approved");
    });

    it("returns 409 (never silently resurrects) re-deciding an already-superseded design review", async () => {
      const submitterCookie = await cookieForNewSession(superAdminUserId);
      const approverCookie = await cookieForNewSession(ownerGrowthApproverUserId);
      const targetId = randomUUID();

      const original = await createDesignReview(submitterCookie, {
        targetModuleKey: "asset_library",
        targetId,
        reviewType: "performance_impact",
      });
      await request(app.getHttpServer())
        .post(`/design-reviews/${original.id}/decide`)
        .set("Cookie", approverCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ action: "approve", expectedStatus: "submitted" })
        .expect(200);

      const replacement = await createDesignReview(submitterCookie, {
        targetModuleKey: "asset_library",
        targetId,
        reviewType: "performance_impact",
      });
      await request(app.getHttpServer())
        .post(`/design-reviews/${replacement.id}/decide`)
        .set("Cookie", approverCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ action: "approve", expectedStatus: "submitted" })
        .expect(200);

      // original is now superseded — replaying "superseded" as expectedStatus must never
      // resurrect it.
      await request(app.getHttpServer())
        .post(`/design-reviews/${original.id}/decide`)
        .set("Cookie", approverCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ action: "approve", expectedStatus: "superseded" })
        .expect(409);
    });
  });

  it("returns 404 for a GET on a nonexistent design review id", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .get(`/design-reviews/${randomUUID()}`)
      .set("Cookie", cookie)
      .expect(404);
  });

  it("returns 400 (not a raw 500) for a malformed design review id", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .get("/design-reviews/not-a-uuid")
      .set("Cookie", cookie)
      .expect(400);
  });

  it("rejects a mutating request with no Origin header (OriginCheckGuard)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .post("/design-reviews")
      .set("Cookie", cookie)
      .send({ targetModuleKey: "component_library", targetId: randomUUID(), reviewType: "ui" })
      .expect(403);
  });
});
