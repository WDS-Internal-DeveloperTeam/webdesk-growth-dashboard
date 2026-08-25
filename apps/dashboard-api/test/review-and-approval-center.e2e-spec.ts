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
import { ReviewAndApprovalCenterModule } from "../src/review-and-approval-center/review-and-approval-center.module.js";

/**
 * Request-level coverage for the Review and Approval Center module HTTP surface, against a REAL
 * disposable PostgreSQL database — same harness pattern as `content-template-library.e2e-spec.ts`.
 * `review_center` has real seeded grants (`00013-seed-rbac-matrix.ts:208-215`):
 *   super_admin              VCERA  (view, create, edit, review, approve)
 *   owner_growth_approver    VCERA  (same as super_admin)
 *   marketing_editor         VRA    (view, review, approve — NOT create, NOT edit)
 *   designer_creative_reviewer VRA  (same as marketing_editor)
 *   developer                VRA    (same as marketing_editor)
 *   qa_security_reviewer     VRA    (same as marketing_editor)
 *   read_only                V      (view only)
 *
 * A real, flagged-not-resolved RBAC oddity (task package §1): only super_admin/owner_growth_approver
 * hold C — none of the 4 mid-tier "VRA" roles can submit a review through this module's own UI,
 * even though they can review/approve one. This suite exercises the RBAC matrix as seeded, not a
 * hypothetical one — every "VRA" role tested below holds BOTH `review` and `approve` (not just
 * `review`), so `decide()`'s own dual-action-gate split (approve/approve_with_notes/reject need
 * "approve"; request_revision needs only "review") is real per D10 but not currently distinguishable
 * by role — every VRA role holds both. `delegate()` (needs "edit") is the one action that DOES
 * differ for these roles today.
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

describe("Review and Approval Center module endpoints (e2e, real disposable database)", () => {
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

  async function createReview(
    cookie: string,
    overrides: Record<string, unknown> = {},
  ): Promise<{ id: string; status: string; submittedByUserId: string }> {
    const response = await request(app.getHttpServer())
      .post("/reviews")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        targetModuleKey: "business_knowledge_center",
        targetId: randomUUID(),
        ...overrides,
      })
      .expect(201);
    return response.body.data as { id: string; status: string; submittedByUserId: string };
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
      imports: [ReviewAndApprovalCenterModule],
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

    superAdminUserId = await createUserWithRole("rac.super-admin", "super_admin");
    readOnlyUserId = await createUserWithRole("rac.read-only", "read_only");
    marketingEditorUserId = await createUserWithRole("rac.marketing-editor", "marketing_editor");
    ownerGrowthApproverUserId = await createUserWithRole(
      "rac.owner-growth-approver",
      "owner_growth_approver",
    );
    qaSecurityReviewerUserId = await createUserWithRole(
      "rac.qa-security-reviewer",
      "qa_security_reviewer",
    );
    designerCreativeReviewerUserId = await createUserWithRole(
      "rac.designer-creative-reviewer",
      "designer_creative_reviewer",
    );
  }, 30_000);

  afterAll(async () => {
    await app.close();
    const migrator = buildMigrator();
    await migrator.down({ to: 0 });
    await closeConnection();
  }, 30_000);

  it("rejects GET /reviews with 401 when there is no session cookie", async () => {
    await request(app.getHttpServer()).get("/reviews").expect(401);
  });

  it("(a) a review_center-holding role (super_admin) can create, list, and view a review", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createReview(cookie, { targetLabel: "A real business record" });
    expect(created.status).toBe("submitted");

    const getResponse = await request(app.getHttpServer())
      .get(`/reviews/${created.id}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(getResponse.body.data.targetLabel).toBe("A real business record");

    const listResponse = await request(app.getHttpServer())
      .get("/reviews")
      .set("Cookie", cookie)
      .expect(200);
    expect((listResponse.body.data as Array<{ id: string }>).some((r) => r.id === created.id)).toBe(
      true,
    );
  });

  it("(b) denies review creation with 403 for a read_only session (V only, not C)", async () => {
    const cookie = await cookieForNewSession(readOnlyUserId);
    await request(app.getHttpServer())
      .post("/reviews")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ targetModuleKey: "business_knowledge_center", targetId: randomUUID() })
      .expect(403);
  });

  it("allows a read_only session to list and view reviews (V grant)", async () => {
    const adminCookie = await cookieForNewSession(superAdminUserId);
    const created = await createReview(adminCookie);
    const readOnlyCookie = await cookieForNewSession(readOnlyUserId);

    await request(app.getHttpServer()).get("/reviews").set("Cookie", readOnlyCookie).expect(200);
    await request(app.getHttpServer())
      .get(`/reviews/${created.id}`)
      .set("Cookie", readOnlyCookie)
      .expect(200);
  });

  it("rejects creation with 400 when targetModuleKey does not resolve to a real module (D6)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .post("/reviews")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ targetModuleKey: "no-such-module-key", targetId: randomUUID() })
      .expect(400);
  });

  it("rejects creation with 400 when assignedToUserId doesn't resolve to a real user", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .post("/reviews")
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        targetModuleKey: "business_knowledge_center",
        targetId: randomUUID(),
        assignedToUserId: randomUUID(),
      })
      .expect(400);
  });

  it("(c) separation of duties genuinely blocks a submitter from deciding their own review, via a real HTTP 403", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createReview(cookie);
    expect(created.submittedByUserId).toBe(superAdminUserId);

    // super_admin holds "approve" (VCERA) — RBAC alone would allow this; the block must come from
    // separation of duties, not a missing grant.
    await request(app.getHttpServer())
      .post(`/reviews/${created.id}/decide`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ action: "approve", expectedStatus: "submitted" })
      .expect(403);

    const stillSubmitted = await request(app.getHttpServer())
      .get(`/reviews/${created.id}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(stillSubmitted.body.data.status).toBe("submitted");
  });

  it("a different, distinct approver can decide a review the submitter cannot decide themselves", async () => {
    const submitterCookie = await cookieForNewSession(superAdminUserId);
    const approverCookie = await cookieForNewSession(ownerGrowthApproverUserId);
    const created = await createReview(submitterCookie);

    const decideResponse = await request(app.getHttpServer())
      .post(`/reviews/${created.id}/decide`)
      .set("Cookie", approverCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ action: "approve_with_notes", notes: "Looks solid", expectedStatus: "submitted" })
      .expect(200);
    expect(decideResponse.body.data.status).toBe("approved");
    expect(decideResponse.body.data.decidedByUserId).toBe(ownerGrowthApproverUserId);
  });

  it("(d) marketing_editor (VRA, no E) is denied delegate() with 403 but can decide() with request_revision", async () => {
    const submitterCookie = await cookieForNewSession(superAdminUserId);
    const editorCookie = await cookieForNewSession(marketingEditorUserId);
    const created = await createReview(submitterCookie);

    await request(app.getHttpServer())
      .post(`/reviews/${created.id}/delegate`)
      .set("Cookie", editorCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ assignedToUserId: marketingEditorUserId, expectedAssignedToUserId: null })
      .expect(403);

    const decideResponse = await request(app.getHttpServer())
      .post(`/reviews/${created.id}/decide`)
      .set("Cookie", editorCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ action: "request_revision", expectedStatus: "submitted" })
      .expect(200);
    expect(decideResponse.body.data.status).toBe("revision_requested");
  });

  it("super_admin (holds E) can delegate a review to a new assignee", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createReview(cookie);

    const delegateResponse = await request(app.getHttpServer())
      .post(`/reviews/${created.id}/delegate`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ assignedToUserId: marketingEditorUserId, expectedAssignedToUserId: null })
      .expect(200);
    expect(delegateResponse.body.data.assignedToUserId).toBe(marketingEditorUserId);
  });

  it("returns 409 delegating on a stale expectedAssignedToUserId (code-review fix, the concurrent-delegate race)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createReview(cookie);

    // The review is really unassigned (null); claim we expected it already assigned to a
    // different user — a stale read, exactly the shape of two concurrent delegate() calls racing.
    await request(app.getHttpServer())
      .post(`/reviews/${created.id}/delegate`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({
        assignedToUserId: marketingEditorUserId,
        expectedAssignedToUserId: qaSecurityReviewerUserId,
      })
      .expect(409);

    const stillUnassigned = await request(app.getHttpServer())
      .get(`/reviews/${created.id}`)
      .set("Cookie", cookie)
      .expect(200);
    expect(stillUnassigned.body.data.assignedToUserId).toBeNull();
  });

  it("returns 409 re-deciding an already-terminal review — approved/rejected can never be reversed (code-review fix)", async () => {
    const submitterCookie = await cookieForNewSession(superAdminUserId);
    const approverCookie = await cookieForNewSession(ownerGrowthApproverUserId);
    const created = await createReview(submitterCookie);

    await request(app.getHttpServer())
      .post(`/reviews/${created.id}/decide`)
      .set("Cookie", approverCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ action: "approve", expectedStatus: "submitted" })
      .expect(200);

    // A caller who observed the review as "approved" and replays that as expectedStatus must never
    // be able to flip it to "rejected".
    await request(app.getHttpServer())
      .post(`/reviews/${created.id}/decide`)
      .set("Cookie", approverCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ action: "reject", expectedStatus: "approved" })
      .expect(409);

    const stillApproved = await request(app.getHttpServer())
      .get(`/reviews/${created.id}`)
      .set("Cookie", submitterCookie)
      .expect(200);
    expect(stillApproved.body.data.status).toBe("approved");
  });

  it("GET /reviews/:id/decisions lists the review's decision history (task package D1)", async () => {
    const submitterCookie = await cookieForNewSession(superAdminUserId);
    const approverCookie = await cookieForNewSession(ownerGrowthApproverUserId);
    const created = await createReview(submitterCookie);

    await request(app.getHttpServer())
      .post(`/reviews/${created.id}/decide`)
      .set("Cookie", approverCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ action: "approve_with_notes", notes: "Looks good", expectedStatus: "submitted" })
      .expect(200);

    const decisionsResponse = await request(app.getHttpServer())
      .get(`/reviews/${created.id}/decisions`)
      .set("Cookie", submitterCookie)
      .expect(200);
    expect(decisionsResponse.body.data).toHaveLength(1);
    expect(decisionsResponse.body.data[0].action).toBe("approve_with_notes");
    expect(decisionsResponse.body.data[0].notes).toBe("Looks good");
  });

  it("GET /reviews/:id/decisions returns 404 for a nonexistent review", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .get(`/reviews/${randomUUID()}/decisions`)
      .set("Cookie", cookie)
      .expect(404);
  });

  it("?assignedToMe=true resolves to the caller's own id", async () => {
    const adminCookie = await cookieForNewSession(superAdminUserId);
    const created = await createReview(adminCookie, { assignedToUserId: qaSecurityReviewerUserId });

    const qaCookie = await cookieForNewSession(qaSecurityReviewerUserId);
    const listResponse = await request(app.getHttpServer())
      .get("/reviews?assignedToMe=true")
      .set("Cookie", qaCookie)
      .expect(200);
    expect((listResponse.body.data as Array<{ id: string }>).some((r) => r.id === created.id)).toBe(
      true,
    );

    const otherCookie = await cookieForNewSession(designerCreativeReviewerUserId);
    const otherListResponse = await request(app.getHttpServer())
      .get("/reviews?assignedToMe=true")
      .set("Cookie", otherCookie)
      .expect(200);
    expect(
      (otherListResponse.body.data as Array<{ id: string }>).some((r) => r.id === created.id),
    ).toBe(false);
  });

  it("pauses and resumes a review (advisory only, orthogonal to status)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createReview(cookie);

    const pauseResponse = await request(app.getHttpServer())
      .post(`/reviews/${created.id}/pause`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ isPaused: true, expectedIsPaused: false })
      .expect(200);
    expect(pauseResponse.body.data.isPaused).toBe(true);
    expect(pauseResponse.body.data.status).toBe("submitted"); // unaffected

    const resumeResponse = await request(app.getHttpServer())
      .post(`/reviews/${created.id}/pause`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ isPaused: false, expectedIsPaused: true })
      .expect(200);
    expect(resumeResponse.body.data.isPaused).toBe(false);
  });

  it("returns 409 (not a silent success) pausing on a stale expectedIsPaused", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createReview(cookie);
    await request(app.getHttpServer())
      .post(`/reviews/${created.id}/pause`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ isPaused: true, expectedIsPaused: true }) // it's really false
      .expect(409);
  });

  it("returns 409 pausing a review that has already been decided (terminal)", async () => {
    const submitterCookie = await cookieForNewSession(superAdminUserId);
    const approverCookie = await cookieForNewSession(ownerGrowthApproverUserId);
    const created = await createReview(submitterCookie);
    await request(app.getHttpServer())
      .post(`/reviews/${created.id}/decide`)
      .set("Cookie", approverCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ action: "reject", expectedStatus: "submitted" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/reviews/${created.id}/pause`)
      .set("Cookie", submitterCookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ isPaused: true, expectedIsPaused: false })
      .expect(409);
  });

  it("(e) the atomic compare-and-swap returns a real 409 (not both succeeding) when two decisions race over real HTTP", async () => {
    const submitterCookie = await cookieForNewSession(superAdminUserId);
    const created = await createReview(submitterCookie);

    // Two genuinely distinct, non-submitter approvers, both holding "approve" — neither is the
    // submitter, so separation of duties doesn't interfere; the CAS on expectedStatus is what
    // decides this race.
    const qaCookie = await cookieForNewSession(qaSecurityReviewerUserId);
    const designerCookie = await cookieForNewSession(designerCreativeReviewerUserId);

    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post(`/reviews/${created.id}/decide`)
        .set("Cookie", qaCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ action: "approve", expectedStatus: "submitted" }),
      request(app.getHttpServer())
        .post(`/reviews/${created.id}/decide`)
        .set("Cookie", designerCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ action: "reject", expectedStatus: "submitted" }),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 409]);

    const finalGet = await request(app.getHttpServer())
      .get(`/reviews/${created.id}`)
      .set("Cookie", submitterCookie)
      .expect(200);
    expect(["approved", "rejected"]).toContain(finalGet.body.data.status);
  });

  it("rejects an invalid decide() action-vs-expectedStatus payload with 400 (Zod validation)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    const created = await createReview(cookie);
    await request(app.getHttpServer())
      .post(`/reviews/${created.id}/decide`)
      .set("Cookie", cookie)
      .set("Origin", process.env.WEB_APP_ORIGIN!)
      .send({ action: "not_a_real_action", expectedStatus: "submitted" })
      .expect(400);
  });

  describe("comments (sub-resource, task package §4)", () => {
    it("adds and lists comments on a review", async () => {
      const cookie = await cookieForNewSession(superAdminUserId);
      const created = await createReview(cookie);

      await request(app.getHttpServer())
        .post(`/reviews/${created.id}/comments`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ body: "First real comment" })
        .expect(201);

      const listResponse = await request(app.getHttpServer())
        .get(`/reviews/${created.id}/comments`)
        .set("Cookie", cookie)
        .expect(200);
      expect(listResponse.body.data).toHaveLength(1);
      expect(listResponse.body.data[0].body).toBe("First real comment");
    });

    it("denies adding a comment with 403 for a read_only session (V only, not R)", async () => {
      const adminCookie = await cookieForNewSession(superAdminUserId);
      const created = await createReview(adminCookie);
      const readOnlyCookie = await cookieForNewSession(readOnlyUserId);

      await request(app.getHttpServer())
        .post(`/reviews/${created.id}/comments`)
        .set("Cookie", readOnlyCookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ body: "Should be denied" })
        .expect(403);
    });

    it("returns 404 (not a raw 500) adding a comment to a nonexistent review", async () => {
      const cookie = await cookieForNewSession(superAdminUserId);
      await request(app.getHttpServer())
        .post(`/reviews/${randomUUID()}/comments`)
        .set("Cookie", cookie)
        .set("Origin", process.env.WEB_APP_ORIGIN!)
        .send({ body: "Orphan" })
        .expect(404);
    });
  });

  it("returns 404 for a GET on a nonexistent review id", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .get(`/reviews/${randomUUID()}`)
      .set("Cookie", cookie)
      .expect(404);
  });

  it("returns 400 (not a raw 500) for a malformed review id", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer()).get("/reviews/not-a-uuid").set("Cookie", cookie).expect(400);
  });

  it("rejects a mutating request with no Origin header (OriginCheckGuard)", async () => {
    const cookie = await cookieForNewSession(superAdminUserId);
    await request(app.getHttpServer())
      .post("/reviews")
      .set("Cookie", cookie)
      .send({ targetModuleKey: "business_knowledge_center", targetId: randomUUID() })
      .expect(403);
  });
});
